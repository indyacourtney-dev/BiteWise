# BiteWise recipe database (cleaning pipeline)

This folder builds a cleaned SQLite database. `backend/scripts/pushCleanedRecipes.ts` then loads it into Supabase (see `backend/README.md`). The SQLite queries in `queries/` and the helpers in `pantry.py` are for local testing; in the app, the same queries run in Supabase as functions (`lib/pantryApi.ts`).

Cleans the Kaggle *Recipe Dataset (over 2M)* and loads it into SQLite, with standardized ingredients, allergen and diet tags, per-serving macros, healthier swaps, and pantry queries.

Python 3.10+, standard library only. Nothing to `pip install`.

## Run it

From `backend/`:

```bash
npm run db:test    # tests
npm run db:clean   # full dataset (resumable: re-running skips recipes already imported)

# or directly, e.g. a quick 50k-row trial:
python3 database/import_recipes.py --csv data/recipes_data.csv --db database/bitewise.db --limit 50000 --fresh
```

The full 2.2M rows produce a database of roughly 5–6 GB. Use `--limit` if you don't need all of it.

## Layout

| File | What it does |
|---|---|
| `cleaning/catalog.py` | ~260 canonical ingredients: aliases, allergens, diet flags, USDA nutrition per 100 g, densities, parent ingredient |
| `cleaning/normalize.py` | Parses a raw line → quantity, unit, package size, canonical ingredient, form, preparation |
| `cleaning/nutrition.py` | Grams per line, macros per serving, servings detection |
| `cleaning/allergens.py` | 19 allergens / sensitivities and the foods to avoid for each |
| `cleaning/dietary.py` | 45 tags and every threshold, with sources, in `THRESHOLDS` |
| `cleaning/substitutions.py` | Healthier swaps and which goals each one helps |
| `schema.sql` | SQLite tables and indexes |
| `import_recipes.py` | The automated import (Task 1.5) |
| `queries/pantry_queries.sql` | Pantry lookups (Task 1.4) |
| `pantry.py` | Python helpers: add pantry items from free text, set allergies and diets, run queries |

## Rules worth knowing

- **Allergen-free and diet tags are strict.** A recipe gets `nut-free`, `vegan`, and similar tags only if every ingredient line was recognized and nothing contains or may contain the allergen. Unknown means unsafe.
- **Health tags need trustworthy macros.** They are assigned only when at least 80% of ingredient weights were worked out.
- **Servings.** When a recipe doesn't state "serves N", servings are estimated as ~500 kcal portions and `servings_estimated = 1`.
- **Not medical advice.** Nutrition values are USDA-average estimates for filtering and comparing. They are not medical values.

## Improving match rates

After an import, look at `unmatched_ingredients.csv` (also stored in the `unmatched_ingredients` table), then add aliases or new ingredients to `cleaning/catalog.py`. Re-run the tests, then re-run the import with `--fresh`.
