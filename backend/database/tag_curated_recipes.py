"""
backend/database/tag_curated_recipes.py

Adds computed dietary tags (diabetic-friendly, heart-healthy, nut-free,
...) to the hand-written recipes in frontend/constants/recipes.ts, using
the same cleaner and rules as the imported Kaggle recipes.

    cd backend
    npm run db:tag-curated          # report only: what would change + things to check
    npm run db:tag-curated:write    # write the tags into frontend/constants/recipes.ts

WHAT IT CHANGES
---------------
The `mealTypes` line (added if missing), and in the `dietary` arrays only tags in AUTO_TAGS (health, lifestyle
and allergen-free tags). Tags your team sets by hand (HUMAN_TAGS:
vegetarian, vegan, halal, keto, ...) are never added or removed. Re-running
is safe: auto tags are recomputed from scratch each time, so editing a
recipe's ingredients and re-running keeps its tags correct.

SAFETY
------
* Allergen-free tags (nut-free, egg-free, ...) are only added when the
  cleaner AND the recipe's hand-written `allergens` list agree the
  allergen is absent.
* Health tags need at least 80% of ingredient weights to be known.
* The report lists anything that looks wrong in the hand-written data,
  e.g. soy sauce in a recipe whose allergens don't include 'soy', or a
  'vegan' recipe containing honey. Those are NOT changed automatically.
  Fix them by hand in recipes.ts.

Review the result with `git diff frontend/constants/recipes.ts` before
committing, then run `npm run db:seed` to update Supabase.
"""

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from cleaning.allergens import ALLERGEN_BY_ID                                 # noqa: E402
from cleaning.catalog import (ALCOHOL, ANIMAL, CATALOG_BY_ID, DAIRY, EGG,     # noqa: E402
                              GELATIN, HONEY, MAMMAL, PORK, POULTRY)
from cleaning.meal_types import classify_meal_types                          # noqa: E402
from cleaning.dietary import (MIN_COVERAGE_FOR_TAGS, TAG_DEFS,                # noqa: E402
                              ingredient_tags, nutrition_tags)
from cleaning.normalize import parse_line                                    # noqa: E402
from cleaning.nutrition import compute_nutrition, line_grams                 # noqa: E402

# Tags people choose when writing a recipe. The script never touches these.
HUMAN_TAGS = {
    'vegetarian', 'vegan', 'pescatarian', 'gluten-free', 'dairy-free', 'low-carb', 'high-protein',
    'halal', 'kosher-style', 'keto', 'paleo',
}
AUTO_TAGS = [t.id for t in TAG_DEFS if t.id not in HUMAN_TAGS]

# The allergens curated recipes list by hand (frontend/types Allergen, original set).
HAND_LISTED_ALLERGENS = {'nuts', 'peanuts', 'shellfish', 'fish', 'eggs', 'dairy', 'soy', 'gluten', 'sesame',
                         'mustard', 'coconut', 'corn'}

REPO_ROOT = HERE.parent.parent
DEFAULT_TS = REPO_ROOT / 'frontend' / 'constants' / 'recipes.ts'
KCAL_MISMATCH = 0.4   # report when computed calories differ from the hand-written ones by more than 40%


def analyse(recipe: dict) -> dict:
    lines, grams = [], []
    for ing in recipe['ingredients']:
        p = parse_line(f"{ing.get('amount', '')} {ing['name']}".strip())
        if ing.get('optional'):
            p.optional = True
        lines.append(p)
        grams.append(line_grams(p))

    nut = compute_nutrition(lines, grams, recipe['name'], recipe.get('instructions', []),
                            servings=recipe.get('servings'))

    contains, may, flags, found_in = set(), set(), set(), {}
    unmatched, known = [], []
    for p in lines:
        ing = CATALOG_BY_ID.get(p.ingredient_id) if p.ingredient_id else None
        if not ing:
            unmatched.append(p.raw)
            continue
        known.append(ing)
        for alt_id in p.alt_ids:           # "curry powder or paste": either could be used
            alt = CATALOG_BY_ID[alt_id]
            may.update(alt.allergens + alt.may)
        contains.update(ing.allergens)
        may.update(ing.may)
        flags.update(ing.flags)
        for a in ing.allergens:
            found_in.setdefault(a, []).append(ing.name)
    may -= contains
    all_known = not unmatched

    computed = []
    if all_known:
        computed += ingredient_tags(flags, contains, may)
    if nut.coverage >= MIN_COVERAGE_FOR_TAGS and nut.per_serving['kcal'] > 0:
        computed += nutrition_tags(nut, flags, all_known, ' '.join(recipe.get('instructions', [])))

    hand_allergens = set(recipe.get('allergens', []))
    auto = []
    for tag in AUTO_TAGS:
        if tag not in computed:
            continue
        allergen = next((a for a in ALLERGEN_BY_ID.values() if a.free_tag == tag), None)
        if allergen:
            # Both sources must agree it's absent. 'gluten' in the hand list also rules out wheat.
            if allergen.id in hand_allergens or (allergen.id == 'wheat' and 'gluten' in hand_allergens):
                continue
        auto.append(tag)

    # ---------- things a person should check ----------
    warnings = []
    for a in sorted(contains & HAND_LISTED_ALLERGENS - hand_allergens):
        warnings.append(f"allergens is missing '{a}' (found in: {', '.join(sorted(set(found_in[a])))})")
    human = set(recipe.get('dietary', []))

    def culprits(bad_flags=frozenset(), bad_allergens=frozenset()) -> list:
        """Ingredients that carry any of these flags or (may-)contain any of these allergens."""
        out = []
        for ing in known:
            hits = [f for f in ing.flags if f in bad_flags]
            hits += [a for a in ing.allergens if a in bad_allergens]
            hits += [f'may contain {a}' for a in ing.may if a in bad_allergens]
            if hits:
                out.append(f"{ing.name} ({', '.join(sorted(set(hits)))})")
        return sorted(set(out))

    checks = {
        'vegetarian': culprits({ANIMAL, GELATIN}),
        'vegan': culprits({ANIMAL, DAIRY, EGG, HONEY, GELATIN}),
        'pescatarian': culprits({MAMMAL, POULTRY, GELATIN}),
        'gluten-free': culprits(bad_allergens={'gluten'}),
        'dairy-free': culprits(bad_allergens={'dairy'}),
        'halal': culprits({PORK, ALCOHOL, GELATIN}, {'shellfish', 'mollusc'}),
        'kosher-style': culprits({PORK, GELATIN}, {'shellfish', 'mollusc'})
                        + (['meat and dairy together'] if flags & {MAMMAL, POULTRY} and DAIRY in flags else []),
    }
    for tag, found in checks.items():
        if tag in human and found:
            warnings.append(f"tagged '{tag}' but: {'; '.join(found)}")

    kcal_hand = (recipe.get('nutrition') or {}).get('calories')
    kcal_calc = nut.per_serving['kcal']
    if kcal_hand and nut.coverage >= MIN_COVERAGE_FOR_TAGS and abs(kcal_calc - kcal_hand) / kcal_hand > KCAL_MISMATCH:
        warnings.append(f'calories: recipe says {kcal_hand}, ingredients add up to ~{kcal_calc:.0f} per serving')

    # Curated recipes were all written as dinners, so 'dinner' always stays;
    # the classifier adds lunch / breakfast / brunch / dessert where they fit.
    kcal = nut.per_serving['kcal']
    sugar_share = (nut.added_sugar_g * 4 / kcal) if kcal > 0 else 0.0
    ids = {i.id for i in known}
    meal_types = classify_meal_types(recipe['name'], ids, flags, sugar_share)
    if 'dessert' not in meal_types or len(meal_types) > 1:
        meal_types = sorted(set(meal_types) | {'dinner'},
                            key=['breakfast', 'brunch', 'lunch', 'dinner', 'dessert'].index)

    return dict(auto=auto, warnings=warnings, unmatched=unmatched, coverage=nut.coverage, meal_types=meal_types)


def write_tags(ts_path: Path, new_dietary: dict) -> int:
    """Rewrite each recipe's `dietary: [...]` line. Returns how many lines changed."""
    text = ts_path.read_text(encoding='utf-8')
    changed = 0
    for rid, tags in new_dietary.items():
        m = re.search(rf"\bid:\s*'{re.escape(rid)}',", text)
        if not m:
            raise SystemExit(f'Could not find recipe {rid} in {ts_path}')
        nxt = re.search(r"\bid:\s*'", text[m.end():])
        end = m.end() + nxt.start() if nxt else len(text)
        d = re.compile(r"(dietary:\s*)\[[^\]]*\]").search(text, m.end(), end)
        if not d:
            raise SystemExit(f'Recipe {rid} has no single-line dietary array')
        replacement = d.group(1) + '[' + ', '.join(f"'{t}'" for t in tags) + ']'
        if replacement != d.group(0):
            text = text[:d.start()] + replacement + text[d.end():]
            changed += 1
    ts_path.write_text(text, encoding='utf-8')
    return changed


def write_meal_types(ts_path: Path, meal_types: dict) -> int:
    """Add or update a `mealTypes: [...]` line right after each recipe's dietary line."""
    text = ts_path.read_text(encoding='utf-8')
    changed = 0
    for rid, types in meal_types.items():
        m = re.search(rf"\bid:\s*'{re.escape(rid)}',", text)
        if not m:
            raise SystemExit(f'Could not find recipe {rid} in {ts_path}')
        nxt = re.search(r"\bid:\s*'", text[m.end():])
        end = m.end() + nxt.start() if nxt else len(text)
        line = 'mealTypes: [' + ', '.join(f"'{t}'" for t in types) + '],'
        existing = re.compile(r"mealTypes:\s*\[[^\]]*\],").search(text, m.end(), end)
        if existing:
            if existing.group(0) != line:
                text = text[:existing.start()] + line + text[existing.end():]
                changed += 1
            continue
        d = re.compile(r"^([ \t]*)dietary:\s*\[[^\]]*\],[ \t]*$", re.M).search(text, m.end(), end)
        if not d:
            raise SystemExit(f'Recipe {rid} has no single-line dietary array')
        text = text[:d.end()] + '\n' + d.group(1) + line + text[d.end():]
        changed += 1
    ts_path.write_text(text, encoding='utf-8')
    return changed


def main() -> None:
    ap = argparse.ArgumentParser(description='Add computed dietary tags to curated recipes.')
    ap.add_argument('--recipes', type=Path, default=HERE / 'curated_recipes.json',
                    help='JSON export of frontend/constants/recipes.ts (made by scripts/exportCuratedRecipes.ts)')
    ap.add_argument('--ts', type=Path, default=DEFAULT_TS, help='recipes.ts to update')
    ap.add_argument('--write', action='store_true', help='write the tags into recipes.ts (default: report only)')
    args = ap.parse_args()

    recipes = json.loads(args.recipes.read_text(encoding='utf-8'))
    new_dietary, new_meals, added_counts, meal_counts, n_warn = {}, {}, {}, {}, 0

    for r in recipes:
        res = analyse(r)
        human = [t for t in r.get('dietary', []) if t in HUMAN_TAGS]
        new_dietary[r['id']] = human + res['auto']
        new_meals[r['id']] = res['meal_types']
        for m in res['meal_types']:
            meal_counts[m] = meal_counts.get(m, 0) + 1
        for t in res['auto']:
            added_counts[t] = added_counts.get(t, 0) + 1
        notes = res['warnings'] + [f'unrecognised ingredient: {u!r}' for u in res['unmatched']]
        if res['coverage'] < MIN_COVERAGE_FOR_TAGS:
            notes.append(f"only {res['coverage']:.0%} of ingredient weights known — no health tags")
        if notes:
            n_warn += 1
            print(f"\n{r['id']} {r['name']}")
            for n in notes:
                print(f'   - {n}')

    print(f'\n{len(recipes)} recipes analysed, {n_warn} with notes to review (above).')
    print('Meal types (recipes): ' + ', '.join(f'{m} {c}' for m, c in meal_counts.items()))
    print('Tags that would be added (recipes):')
    for t in AUTO_TAGS:
        if t in added_counts:
            print(f'   {t:24} {added_counts[t]}')

    if args.write:
        changed = write_tags(args.ts, new_dietary)
        meals_changed = write_meal_types(args.ts, new_meals)
        print(f'\nUpdated {changed} dietary lines and {meals_changed} mealTypes lines in {args.ts}. '
              'Review with `git diff`, then `npm run db:seed`.')
    else:
        print('\nReport only. Run `npm run db:tag-curated:write` to update recipes.ts.')


if __name__ == '__main__':
    main()
