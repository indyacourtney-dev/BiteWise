"""
backend/database/import_recipes.py

Cleans the Kaggle "Recipe Dataset (over 2M)" and loads it into SQLite
in one run.

    python3 backend/database/import_recipes.py --csv data/recipes_data.csv --db backend/database/bitewise.db

What it does, in order:
  1. Validates the ingredient catalog and swap list (stops if broken).
  2. Creates the tables from schema.sql.
  3. Loads reference data: ingredients, aliases, allergens, tags, swaps.
  4. Streams the CSV (never loads the 2 GB file into memory) and, for
     each recipe:
       - parses every ingredient line to a canonical ingredient,
       - works out grams and counts macros per serving,
       - finds allergens (contains / may contain),
       - assigns dietary, allergen-free and health tags,
       - links the healthier swaps that apply.
     Parsing runs on all CPU cores (--workers).
  5. Creates indexes, runs ANALYZE, writes the unmatched-ingredient
     report, and prints a summary.

It is safe to re-run: recipes already in the database (same source
link) are skipped, so an interrupted import resumes where it stopped.
Use --fresh to start over.

Useful flags:
  --limit 50000    import only the first N recipes (good for testing)
  --workers 1      single process (easier debugging)
  --fresh          delete the existing database first
"""

import argparse
import csv
import hashlib
import json
import os
import sqlite3
import sys
import time
from collections import Counter
from multiprocessing import Pool
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from cleaning.allergens import ALLERGENS, ALLERGEN_BY_ID                       # noqa: E402
from cleaning.catalog import CATALOG, CATALOG_BY_ID, validate_catalog        # noqa: E402
from cleaning.meal_types import classify_meal_types                          # noqa: E402
from cleaning.dietary import (MIN_COVERAGE_FOR_TAGS, TAG_DEFS,               # noqa: E402
                              ingredient_tags, nutrition_tags)
from cleaning.normalize import (ALIAS_INDEX, ALIAS_COLLISIONS, is_non_ingredient,  # noqa: E402
                                parse_line)
from cleaning.nutrition import compute_nutrition, line_grams                 # noqa: E402
from cleaning.substitutions import (SUBSTITUTIONS, SUBSTITUTIONS_BY_FROM,    # noqa: E402
                                   validate_substitutions)

SCHEMA_PATH = HERE / 'schema.sql'
UNMATCHED_TRACK_LIMIT = 300_000   # distinct unmatched strings to count (keeps memory bounded)
UNMATCHED_REPORT_ROWS = 5_000

# =====================================================================
# Per-recipe cleaning (runs in worker processes)
# =====================================================================


def _json_list(value) -> list:
    if not value:
        return []
    try:
        data = json.loads(value)
        return [str(x).strip() for x in data if str(x).strip()] if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def clean_recipe(row: dict):
    """Turn one CSV row into everything we store. Returns None to skip the row.

    A row that can't be read (unexpected characters, broken JSON...) is
    skipped rather than stopping a multi-million-row import.
    """
    try:
        return _clean_recipe(row)
    except Exception as exc:                      # noqa: BLE001 - one bad row must not stop the run
        return ('error', f"{(row.get('title') or '')[:80]!r}: {type(exc).__name__}: {exc}")


def _clean_recipe(row: dict):
    title = (row.get('title') or '').strip()
    # Section headers ("For the filling:") and separators aren't ingredients.
    ingredients = [line for line in _json_list(row.get('ingredients')) if not is_non_ingredient(line)]
    directions = _json_list(row.get('directions'))
    if not title or not ingredients or not directions:
        return None
    link = (row.get('link') or '').strip()
    source_key = link or 'h:' + hashlib.sha1((title + '|' + '|'.join(ingredients)).encode()).hexdigest()

    parsed = [parse_line(line) for line in ingredients]
    grams = [line_grams(p) for p in parsed]
    nut = compute_nutrition(parsed, grams, title, directions)

    contains, may_contain, flags = set(), set(), set()
    unmatched = []
    for p in parsed:
        ing = CATALOG_BY_ID.get(p.ingredient_id) if p.ingredient_id else None
        if ing:
            contains.update(ing.allergens)
            may_contain.update(ing.may)
            flags.update(ing.flags)
            for alt_id in p.alt_ids:       # "curry powder or paste": either could be used
                alt = CATALOG_BY_ID[alt_id]
                may_contain.update(alt.allergens + alt.may)
        else:
            unmatched.append(p.name_text or p.raw)
            # Unknown line: scan the raw words so the app can still warn "may contain".
            low = p.raw.lower()
            for a in ALLERGENS:
                if any(k in low for k in a.raw_keywords):
                    may_contain.add(a.id)
    may_contain -= contains
    all_known = not unmatched

    tags = []
    if all_known:
        tags += ingredient_tags(flags, contains, may_contain)
    if nut.coverage >= MIN_COVERAGE_FOR_TAGS and nut.per_serving['kcal'] > 0:
        tags += nutrition_tags(nut, flags, all_known, ' '.join(directions))

    ingredient_ids = {p.ingredient_id for p in parsed if p.ingredient_id}
    kcal = nut.per_serving['kcal']
    added_sugar_share = (nut.added_sugar_g * 4 / kcal) if kcal > 0 else 0.0
    meal_types = classify_meal_types(title, ingredient_ids, flags, added_sugar_share)
    swaps = sorted({s.id for iid in ingredient_ids for s in SUBSTITUTIONS_BY_FROM.get(iid, ())})

    lines = []
    for pos, (p, g) in enumerate(zip(parsed, grams)):
        ing = CATALOG_BY_ID.get(p.ingredient_id) if p.ingredient_id else None
        required = int(not p.optional and not (ing and ing.staple))
        lines.append((pos, p.ingredient_id, p.raw, p.quantity, p.unit, g,
                      ', '.join(p.form) or None, ', '.join(p.preparation) or None, int(p.optional), required))

    s = nut.per_serving
    macros = (nut.pct_kcal('protein_g'), nut.pct_kcal('carbs_g'), nut.pct_kcal('fat_g'))
    recipe = dict(
        source_key=source_key, title=title[:300], source_url=link or None, site=(row.get('site') or None),
        directions=json.dumps(directions, ensure_ascii=False), ingredient_count=len(parsed),
        required_count=sum(l[9] for l in lines), all_known=int(all_known), coverage=nut.coverage,
        servings=nut.servings, servings_estimated=int(nut.servings_estimated),
        nutrients=(s['kcal'], s['protein_g'], s['carbs_g'], round(nut.net_carbs_g, 1), s['fat_g'], s['sat_fat_g'],
                   s['fiber_g'], s['sugar_g'], nut.added_sugar_g, s['sodium_mg'], s['cholesterol_mg']),
        macros=tuple(round(m, 1) if m is not None else None for m in macros),
        meal_types=json.dumps(meal_types),
    )
    return recipe, lines, sorted(contains), sorted(may_contain), tags, swaps, unmatched


# =====================================================================
# Database helpers
# =====================================================================


def split_schema() -> tuple:
    sql = SCHEMA_PATH.read_text()
    tables, _, indexes = sql.partition('-- @indexes')
    return tables, indexes


def seed_reference_data(conn: sqlite3.Connection) -> None:
    """(Re)load catalog-derived tables. Safe to run on every import."""
    cur = conn.cursor()
    for table in ('substitution_helps', 'substitutions', 'ingredient_ancestors', 'ingredient_flags',
                  'ingredient_allergens', 'ingredient_aliases', 'tags', 'allergens'):
        cur.execute(f'DELETE FROM {table}')

    cur.executemany('INSERT INTO allergens VALUES (?, ?, ?, ?)',
                    [(a.id, a.label, a.free_tag, a.avoid) for a in ALLERGENS])
    cur.executemany('INSERT INTO tags VALUES (?, ?, ?, ?)',
                    [(t.id, t.label, t.kind, t.description) for t in TAG_DEFS])
    cur.executemany(
        'INSERT OR REPLACE INTO ingredients VALUES (?,?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?)',
        [(i.id, i.name, i.category, i.parent, int(i.staple), *i.n, i.density, i.each) for i in CATALOG])
    cur.executemany('INSERT INTO ingredient_aliases VALUES (?, ?)', sorted(ALIAS_INDEX.items()))
    cur.executemany('INSERT INTO ingredient_allergens VALUES (?, ?, ?)',
                    [(i.id, a, 'contains') for i in CATALOG for a in i.allergens] +
                    [(i.id, a, 'may_contain') for i in CATALOG for a in i.may])
    cur.executemany('INSERT INTO ingredient_flags VALUES (?, ?)', [(i.id, f) for i in CATALOG for f in i.flags])

    ancestors = []
    for ing in CATALOG:
        node, depth, seen = ing, 0, set()
        while node and node.id not in seen:
            seen.add(node.id)
            ancestors.append((ing.id, node.id, depth))
            node, depth = CATALOG_BY_ID.get(node.parent) if node.parent else None, depth + 1
    cur.executemany('INSERT INTO ingredient_ancestors VALUES (?, ?, ?)', ancestors)

    cur.executemany('INSERT INTO substitutions VALUES (?, ?, ?, ?)',
                    [(s.id, s.from_id, s.to_id, s.tip) for s in SUBSTITUTIONS])
    cur.executemany('INSERT INTO substitution_helps VALUES (?, ?)',
                    [(s.id, t) for s in SUBSTITUTIONS for t in s.helps])
    conn.commit()


def iter_csv_rows(path: Path, limit: int | None):
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    with open(path, newline='', encoding='utf-8', errors='replace') as f:
        for n, row in enumerate(csv.DictReader(f)):
            if limit is not None and n >= limit:
                break
            yield row


class Writer:
    """Buffers rows and writes them in batches inside one transaction each."""

    def __init__(self, conn: sqlite3.Connection, next_id: int, batch_size: int):
        self.conn, self.next_id, self.batch_size = conn, next_id, batch_size
        self.recipes, self.lines, self.allergens, self.tags, self.swaps = [], [], [], [], []

    def add(self, cleaned) -> int:
        recipe, lines, contains, may, tags, swaps, _ = cleaned
        rid = self.next_id
        self.next_id += 1
        r = recipe
        self.recipes.append((rid, r['source_key'], r['title'], r['source_url'], r['site'], r['directions'],
                             r['ingredient_count'], r['required_count'], r['all_known'], r['coverage'],
                             r['servings'], r['servings_estimated'], *r['nutrients'], *r['macros'],
                             r['meal_types']))
        self.lines.extend((rid, *l) for l in lines)
        self.allergens.extend((rid, a, 'contains') for a in contains)
        self.allergens.extend((rid, a, 'may_contain') for a in may)
        self.tags.extend((rid, t) for t in tags)
        self.swaps.extend((rid, s) for s in swaps)
        if len(self.recipes) >= self.batch_size:
            self.flush()
        return rid

    def flush(self) -> None:
        if not self.recipes:
            return
        c = self.conn
        with c:
            c.executemany('INSERT INTO recipes VALUES (' + ','.join('?' * 27) + ')', self.recipes)
            c.executemany('INSERT INTO recipe_ingredients VALUES (?,?,?,?,?,?,?,?,?,?,?)', self.lines)
            c.executemany('INSERT INTO recipe_allergens VALUES (?,?,?)', self.allergens)
            c.executemany('INSERT INTO recipe_tags VALUES (?,?)', self.tags)
            c.executemany('INSERT INTO recipe_substitutions VALUES (?,?)', self.swaps)
        self.recipes, self.lines, self.allergens, self.tags, self.swaps = [], [], [], [], []


# =====================================================================
# Main
# =====================================================================


def run_import(csv_path: Path, db_path: Path, limit=None, batch_size=2000, workers=None,
               fresh=False, report_path: Path | None = None, quiet=False) -> dict:
    log = (lambda *a: None) if quiet else (lambda *a: print(*a, flush=True))

    problems = validate_catalog() + validate_substitutions() + \
        [f'alias collision: {c}' for c in ALIAS_COLLISIONS]
    if problems:
        raise SystemExit('Catalog problems, fix before importing:\n  ' + '\n  '.join(problems))
    if not csv_path.exists():
        raise SystemExit(f'CSV not found: {csv_path}')

    if fresh and db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    # Bulk-load settings. Safe because a failed import can simply be re-run.
    conn.executescript('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; '
                       'PRAGMA temp_store = MEMORY; PRAGMA cache_size = -200000;')

    tables_sql, indexes_sql = split_schema()
    conn.executescript(tables_sql)
    conn.execute('PRAGMA foreign_keys = OFF')   # bulk load; reference data is validated above
    seed_reference_data(conn)
    log(f'Reference data: {len(CATALOG)} ingredients, {len(ALIAS_INDEX)} aliases, '
        f'{len(ALLERGENS)} allergens, {len(TAG_DEFS)} tags, {len(SUBSTITUTIONS)} swaps')

    existing = {k for (k,) in conn.execute('SELECT source_key FROM recipes')}
    next_id = (conn.execute('SELECT MAX(id) FROM recipes').fetchone()[0] or 0) + 1
    if existing:
        log(f'Resuming: {len(existing):,} recipes already imported')

    writer = Writer(conn, next_id, batch_size)
    unmatched = Counter()
    stats = Counter()
    tag_counts = Counter()
    meal_counts = Counter()
    start = time.time()

    workers = workers or max(1, (os.cpu_count() or 2) - 1)
    rows = iter_csv_rows(csv_path, limit)
    pool = Pool(workers) if workers > 1 else None
    results = pool.imap(clean_recipe, rows, chunksize=256) if pool else map(clean_recipe, rows)

    try:
        for cleaned in results:
            stats['rows'] += 1
            if cleaned is None:
                stats['skipped_invalid'] += 1
                continue
            if cleaned[0] == 'error':
                stats['skipped_error'] += 1
                if stats['skipped_error'] <= 5:
                    log(f'  skipped a recipe that could not be read - {cleaned[1]}')
                continue
            recipe, lines, _, _, tags, _, missed = cleaned
            if recipe['source_key'] in existing:
                stats['skipped_duplicate'] += 1
                continue
            existing.add(recipe['source_key'])
            writer.add(cleaned)
            stats['recipes'] += 1
            stats['lines'] += len(lines)
            stats['lines_matched'] += sum(1 for l in lines if l[1])
            stats['all_known'] += recipe['all_known']
            stats['coverage_ok'] += recipe['coverage'] >= MIN_COVERAGE_FOR_TAGS
            tag_counts.update(tags)
            meal_counts.update(json.loads(recipe['meal_types']) or ['(not a meal)'])
            for name in missed:
                key = name.lower().strip()[:120]
                if key and (key in unmatched or len(unmatched) < UNMATCHED_TRACK_LIMIT):
                    unmatched[key] += 1
            if stats['rows'] % 50_000 == 0:
                rate = stats['rows'] / (time.time() - start)
                log(f'  {stats["rows"]:>9,} rows  {stats["recipes"]:>9,} imported  {rate:,.0f} rows/s')
        writer.flush()
    finally:
        if pool:
            pool.close()
            pool.join()

    log('Creating indexes...')
    conn.executescript(indexes_sql)
    with conn:
        conn.execute('DELETE FROM unmatched_ingredients')
        conn.executemany('INSERT INTO unmatched_ingredients VALUES (?, ?)',
                         unmatched.most_common(UNMATCHED_REPORT_ROWS))
    conn.execute('ANALYZE')
    conn.execute('PRAGMA foreign_keys = ON')
    fk_errors = conn.execute('PRAGMA foreign_key_check').fetchall()
    conn.close()

    if report_path:
        with open(report_path, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(['ingredient_text', 'occurrences'])
            w.writerows(unmatched.most_common(UNMATCHED_REPORT_ROWS))

    elapsed = time.time() - start
    n = stats['recipes'] or 1
    keys = ('rows', 'recipes', 'skipped_invalid', 'skipped_duplicate', 'skipped_error', 'lines', 'lines_matched',
            'all_known', 'coverage_ok')
    summary = {k: stats[k] for k in keys}
    summary.update(seconds=round(elapsed, 1), tag_counts=dict(tag_counts), meal_counts=dict(meal_counts),
                   foreign_key_errors=len(fk_errors))
    log('')
    log(f'Done in {elapsed:,.0f}s')
    log(f'  rows read            {stats["rows"]:,}')
    log(f'  recipes imported     {stats["recipes"]:,}  '
        f'(skipped {stats["skipped_invalid"]:,} invalid, {stats["skipped_duplicate"]:,} duplicate, '
        f'{stats["skipped_error"]:,} unreadable)')
    log(f'  ingredient lines     {stats["lines"]:,}  matched {stats["lines_matched"] / max(stats["lines"], 1):.1%}')
    log(f'  fully recognised     {stats["all_known"] / n:.1%} of recipes (eligible for allergen/diet tags)')
    log(f'  macros trustworthy   {stats["coverage_ok"] / n:.1%} of recipes (eligible for health tags)')
    log(f'  foreign key errors   {len(fk_errors)}')
    log('  meal types: ' + ', '.join(f'{m} {c / n:.0%}' for m, c in meal_counts.most_common()))
    log('  top tags: ' + ', '.join(f'{t} {c / n:.0%}' for t, c in tag_counts.most_common(12)))
    if unmatched:
        log('  top unmatched: ' + '; '.join(f'{k} ({v})' for k, v in unmatched.most_common(10)))
    return summary


def main() -> None:
    ap = argparse.ArgumentParser(description='Clean the Kaggle recipe CSV and import it into SQLite.')
    ap.add_argument('--csv', type=Path, default=Path('data/recipes_data.csv'), help='path to recipes_data.csv')
    ap.add_argument('--db', type=Path, default=HERE / 'bitewise.db', help='SQLite file to create/update')
    ap.add_argument('--limit', type=int, default=None, help='only read the first N rows')
    ap.add_argument('--batch-size', type=int, default=2000, help='recipes per transaction')
    ap.add_argument('--workers', type=int, default=None, help='parser processes (default: CPU cores - 1)')
    ap.add_argument('--fresh', action='store_true', help='delete the database before importing')
    ap.add_argument('--report', type=Path, default=HERE / 'unmatched_ingredients.csv',
                    help='where to write the unmatched-ingredient report')
    args = ap.parse_args()
    run_import(args.csv, args.db, args.limit, args.batch_size, args.workers, args.fresh, args.report)


if __name__ == '__main__':
    main()
