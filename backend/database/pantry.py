"""
backend/database/pantry.py

Small helpers around queries/pantry_queries.sql so the app backend (or a
quick script) can manage a pantry and ask for recipes.

    import sqlite3, pantry
    conn = sqlite3.connect('database/bitewise.db')
    pantry.add_pantry_item(conn, user_id=1, text='2 cans diced tomatoes', expires_on='2026-09-30')
    pantry.set_allergies(conn, 1, ['nuts', 'peanuts'])
    pantry.set_diet_tags(conn, 1, ['vegetarian', 'diabetic-friendly'])
    rows = pantry.run(conn, 'pantry_matches', user_id=1, max_missing=2, min_match=0.5, limit=20)

Pantry text goes through the same cleaner as the recipes, so
"diced tomatoes", "Roma tomato" and "1 can Rotel" all become `tomato`.
"""

import re
import sqlite3
import sys
from pathlib import Path
from typing import Iterable, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from cleaning.catalog import CATALOG_BY_ID  # noqa: E402
from cleaning.normalize import standardize_name  # noqa: E402

QUERIES_PATH = HERE / 'queries' / 'pantry_queries.sql'


def load_queries(path: Path = QUERIES_PATH) -> dict:
    """Split the .sql file on '-- name: x' headers."""
    queries, name, buf = {}, None, []
    for line in path.read_text().splitlines():
        m = re.match(r'--\s*name:\s*(\w+)', line)
        if m:
            if name:
                queries[name] = '\n'.join(buf).strip()
            name, buf = m.group(1), []
        elif name:
            buf.append(line)
    if name:
        queries[name] = '\n'.join(buf).strip()
    return queries


QUERIES = load_queries()


def run(conn: sqlite3.Connection, query_name: str, **params) -> list:
    conn.row_factory = sqlite3.Row
    return [dict(r) for r in conn.execute(QUERIES[query_name], params)]


def ensure_user(conn: sqlite3.Connection, user_id: int, name: Optional[str] = None) -> None:
    with conn:
        conn.execute('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)', (user_id, name))


def add_pantry_item(conn: sqlite3.Connection, user_id: int, text: str,
                    expires_on: Optional[str] = None, quantity_note: Optional[str] = None) -> Optional[str]:
    """Standardise free text to a canonical ingredient and store it. Returns the id, or None if unknown."""
    ingredient_id = standardize_name(text)
    if ingredient_id is None:
        return None
    ensure_user(conn, user_id)
    with conn:
        conn.execute(
            '''INSERT INTO user_pantry (user_id, ingredient_id, quantity_note, expires_on)
               VALUES (?, ?, ?, ?)
               ON CONFLICT (user_id, ingredient_id) DO UPDATE SET
                   quantity_note = COALESCE(excluded.quantity_note, quantity_note),
                   expires_on    = COALESCE(excluded.expires_on, expires_on)''',
            (user_id, ingredient_id, quantity_note or text, expires_on))
    return ingredient_id


def remove_pantry_item(conn: sqlite3.Connection, user_id: int, text_or_id: str) -> None:
    ingredient_id = text_or_id if text_or_id in CATALOG_BY_ID else standardize_name(text_or_id)
    with conn:
        conn.execute('DELETE FROM user_pantry WHERE user_id = ? AND ingredient_id = ?', (user_id, ingredient_id))


def set_allergies(conn: sqlite3.Connection, user_id: int, allergen_ids: Iterable[str]) -> None:
    ensure_user(conn, user_id)
    with conn:
        conn.execute('DELETE FROM user_allergens WHERE user_id = ?', (user_id,))
        conn.executemany('INSERT INTO user_allergens VALUES (?, ?)', [(user_id, a) for a in allergen_ids])


def set_diet_tags(conn: sqlite3.Connection, user_id: int, tag_ids: Iterable[str]) -> None:
    ensure_user(conn, user_id)
    with conn:
        conn.execute('DELETE FROM user_diet_tags WHERE user_id = ?', (user_id,))
        conn.executemany('INSERT INTO user_diet_tags VALUES (?, ?)', [(user_id, t) for t in tag_ids])


if __name__ == '__main__':
    # Quick demo:  python3 backend/database/pantry.py database/bitewise.db "chicken breast" rice broccoli "soy sauce"
    import json
    db, *items = sys.argv[1:] or ['']
    if not db or not items:
        sys.exit('usage: python pantry.py <db> "item" "item" ...')
    conn = sqlite3.connect(db)
    for it in items:
        print(f'{it!r:25} -> {add_pantry_item(conn, 1, it)}')
    for row in run(conn, 'pantry_matches', user_id=1, max_missing=2, min_match=0.5, limit=10):
        print(json.dumps(row, default=str))
