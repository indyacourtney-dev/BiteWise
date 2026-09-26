// backend/scripts/pushCleanedRecipes.ts
//
// Pushes the cleaned recipe database (built by
// backend/database/import_recipes.py) into Supabase.
//
//   cd backend && npm run db:push            (defaults: --db database/bitewise.db --limit 50000)
//
// What it sends:
//   1. Reference data: ingredients, aliases, allergens, dietary tags, swaps.
//   2. Kaggle recipes (breakfast, brunch, lunch, dinner and dessert —
//      drinks, sauces and plain sides are skipped): quiz tags, emoji, vibe
//      and times come from kaggle/transform.ts; allergens, may-contain, dietary tags, macros,
//      plate composition and ingredient categories come from the cleaned
//      data, which is far more accurate than keyword guessing.
//      The app's Recipe type requires `nutrition` and `plate`, so only
//      recipes whose macros are trustworthy (>= 80% of ingredient
//      weights known) are sent.
//   3. recipe_ingredients + recipe_substitutions for each pushed recipe.
//   4. Re-indexes the curated recipes against the ingredient catalog.
//
// Recipes whose ingredients were ALL recognised are pushed first, so a
// --limit keeps the recipes that are safest to show allergic users.
// Re-running is safe: everything is upserted.
//
// Flags:
//   --db <path>        cleaned SQLite file (default backend/database/bitewise.db)
//   --limit <n|all>    max Kaggle recipes to push (default: all that fit the size budget)
//   --max-db-mb <n>    stop when the database reaches this size (default 450 — the Free plan
//                      turns read-only above 500 MB; on Pro, try 7500 for its 8 GB)
//   --batch <n>        recipes per request (default 500)
//   --reference-only   only push reference data
//   --dry-run          build everything, send nothing, print a sample

import 'dotenv/config';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { transformKaggleRow } from './kaggle/transform';
import type { RecipeNutritionRow, RecipeRow } from '../../frontend/lib/recipeRow';
import type { MealType, PantryCategoryId, PlateComposition } from '../../frontend/types';

// ============================================
// ARGS
// ============================================

// The LAST occurrence wins, so `npm run db:push -- --limit 1000` overrides the default in package.json.
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.lastIndexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const DB_PATH = path.resolve(arg('db', path.join(__dirname, '..', 'database', 'bitewise.db'))!);   // backend/database/bitewise.db
const LIMIT_ARG = arg('limit', 'all')!;
const LIMIT = LIMIT_ARG === 'all' ? Infinity : Number(LIMIT_ARG);
const MAX_DB_MB = Number(arg('max-db-mb', '450'));
const BATCH = Number(arg('batch', '500'));
const DRY_RUN = flag('dry-run');
const REFERENCE_ONLY = flag('reference-only');

// Health numbers are only shown when most ingredient weights were known
// (same threshold as backend/database/cleaning/dietary.py).
const MIN_COVERAGE_FOR_NUTRITION = 0.8;

// Allergy safety uses the allergens / may_contain lists, and the recipe screen
// works out "Free from" itself, so of the "<allergen>-free" tags only the ones
// users can pick as a diet are stored. Saves ~1 KB per recipe.
const KEEP_FREE_TAGS = new Set(['gluten-free', 'dairy-free']);
const slimDietary = (tags: string[]) =>
  tags.filter(t => !(t.endsWith('-free') || t === 'alpha-gal-safe') || KEEP_FREE_TAGS.has(t));

// Catalog categories -> the app's shopping-list categories.
const APP_CATEGORY: Record<string, PantryCategoryId> = {
  proteins: 'proteins', dairy: 'dairy', grains: 'grains', produce: 'produce',
  pantry: 'pantry', spices: 'pantry', condiments: 'pantry', oils: 'pantry', sweeteners: 'pantry',
  baking: 'pantry', nuts_seeds: 'pantry', beverages: 'other',
};

// ---------- Plate composition (estimated from ingredient weights) ----------
// Mirrors the app's plate model (utils/matching.ts PLATE_TARGETS):
// produce / protein / carbs / healthy fats as shares of the plate.
// Potatoes and corn count as carbs, dairy and sauces aren't on the plate.
const PLATE_CARB_IDS = new Set(['potato', 'sweet_potato', 'corn']);
const PLATE_FAT_IDS = new Set(['olive_oil', 'vegetable_oil', 'corn_oil', 'sesame_oil', 'avocado', 'olives']);
// Weights for these are DRY; they roughly 2.5x in volume once cooked.
const EXPANDS_WHEN_COOKED = new Set([
  'rice', 'brown_rice', 'quinoa', 'couscous', 'barley', 'oats', 'lentils',
  'pasta', 'egg_noodles', 'whole_wheat_pasta', 'chickpea_pasta', 'rice_noodles', 'ramen_noodles',
]);

// ============================================
// SQLITE ROW SHAPES
// ============================================

interface SqlRecipe {
  id: number; title: string; source_url: string | null; site: string | null; directions: string;
  required_count: number; all_ingredients_known: number; nutrition_coverage: number; meal_types: string;
  servings: number; servings_estimated: number;
  kcal: number; protein_g: number; carbs_g: number; net_carbs_g: number; fat_g: number; sat_fat_g: number;
  fiber_g: number; sugar_g: number; added_sugar_g: number; sodium_mg: number; cholesterol_mg: number;
}
interface SqlLine {
  recipe_id: number; position: number; ingredient_id: string | null; raw_text: string; quantity: number | null;
  unit: string | null; grams: number | null; form: string | null; preparation: string | null;
  is_optional: number; is_required: number; category: string | null;
}

// ============================================
// SUPABASE HELPERS
// ============================================

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function upsert(sb: SupabaseClient | null, table: string, rows: object[], onConflict: string) {
  if (!sb || !rows.length) return;
  for (const part of chunks(rows, 1000)) {
    const { error } = await sb.from(table).upsert(part, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function replaceAll(sb: SupabaseClient | null, table: string, keyColumn: string, rows: object[]) {
  if (!sb) return;
  const { error } = await sb.from(table).delete().neq(keyColumn, '');
  if (error) throw new Error(`${table}: ${error.message}`);
  for (const part of chunks(rows, 1000)) {
    const { error: e } = await sb.from(table).insert(part);
    if (e) throw new Error(`${table}: ${e.message}`);
  }
}

// ============================================
// 1. REFERENCE DATA
// ============================================

async function pushReferenceData(db: DatabaseSync, sb: SupabaseClient | null) {
  const all = (sql: string) => db.prepare(sql).all() as any[];

  await upsert(sb, 'allergens', all('SELECT id, label, free_tag, avoid FROM allergens'), 'id');
  await upsert(sb, 'diet_tags', all('SELECT id, label, kind, description FROM tags'), 'id');

  // Parents before children so the parent_id foreign key is satisfied.
  const ingredients = all(`
    SELECT i.*, (SELECT MAX(depth) FROM ingredient_ancestors a WHERE a.ingredient_id = i.id) AS lvl
    FROM ingredients i ORDER BY lvl, i.id`).map(({ lvl, is_staple, ...rest }) => ({ ...rest, is_staple: !!is_staple }));
  await upsert(sb, 'ingredients', ingredients, 'id');

  await replaceAll(sb, 'ingredient_aliases', 'alias', all('SELECT alias, ingredient_id FROM ingredient_aliases'));
  await replaceAll(sb, 'ingredient_allergens', 'ingredient_id',
    all('SELECT ingredient_id, allergen_id, level FROM ingredient_allergens'));
  await replaceAll(sb, 'ingredient_flags', 'ingredient_id', all('SELECT ingredient_id, flag FROM ingredient_flags'));
  await replaceAll(sb, 'ingredient_ancestors', 'ingredient_id',
    all('SELECT ingredient_id, ancestor_id, depth FROM ingredient_ancestors'));
  await upsert(sb, 'substitutions',
    all('SELECT id, from_ingredient_id, to_ingredient_id, tip FROM substitutions'), 'id');
  await replaceAll(sb, 'substitution_helps', 'substitution_id',
    all('SELECT substitution_id, tag_id FROM substitution_helps'));

  console.log(`Reference data: ${ingredients.length} ingredients, `
    + `${all('SELECT COUNT(*) n FROM ingredient_aliases')[0].n} aliases, `
    + `${all('SELECT COUNT(*) n FROM substitutions')[0].n} swaps`);
}

// ============================================
// 2. RECIPES
// ============================================

function nutritionFor(r: SqlRecipe): RecipeNutritionRow | null {
  if (r.nutrition_coverage < MIN_COVERAGE_FOR_NUTRITION || !r.kcal) return null;
  const round = (n: number) => Math.round(n);
  return {
    calories: round(r.kcal),
    protein: round(r.protein_g),
    carbs: round(r.carbs_g),
    totalFat: round(r.fat_g),
    healthyFat: round(Math.max(0, r.fat_g - r.sat_fat_g)),   // unsaturated fat
    netCarbs: round(r.net_carbs_g),
    satFat: round(r.sat_fat_g),
    fiber: round(r.fiber_g),
    sugar: round(r.sugar_g),
    addedSugar: round(r.added_sugar_g),
    sodium: round(r.sodium_mg),
    cholesterol: round(r.cholesterol_mg),
  };
}

function estimatePlate(lines: SqlLine[]): PlateComposition | null {
  const g = { produce: 0, protein: 0, carbs: 0, healthyFats: 0 };
  for (const l of lines) {
    if (!l.ingredient_id || !l.grams || l.is_optional) continue;
    const grams = EXPANDS_WHEN_COOKED.has(l.ingredient_id) ? l.grams * 2.5 : l.grams;
    if (PLATE_CARB_IDS.has(l.ingredient_id) || l.category === 'grains') g.carbs += grams;
    else if (PLATE_FAT_IDS.has(l.ingredient_id) || l.category === 'nuts_seeds') g.healthyFats += grams;
    else if (l.category === 'proteins') g.protein += grams;
    else if (l.category === 'produce') g.produce += grams;
  }
  const total = g.produce + g.protein + g.carbs + g.healthyFats;
  if (total <= 0) return null;
  const plate = {
    produce: Math.round((g.produce / total) * 100),
    protein: Math.round((g.protein / total) * 100),
    carbs: Math.round((g.carbs / total) * 100),
    healthyFats: Math.round((g.healthyFats / total) * 100),
  };
  // Make the four shares add up to exactly 100 after rounding.
  const drift = 100 - (plate.produce + plate.protein + plate.carbs + plate.healthyFats);
  const largest = (Object.keys(plate) as (keyof PlateComposition)[]).reduce((a, b) => (plate[a] >= plate[b] ? a : b));
  plate[largest] += drift;
  return plate;
}

type SkipReason = 'notMeal' | 'noNutrition';

interface Built {
  row: RecipeRow;
  lines: object[];
  swaps: object[];
}

function buildRecipe(
  r: SqlRecipe, lines: SqlLine[], contains: string[], mayContain: string[], tags: string[], swaps: string[],
): Built | SkipReason {
  const nutrition = nutritionFor(r);
  const plate = estimatePlate(lines);
  if (!nutrition || !plate) return 'noNutrition';

  // Breakfast / brunch / lunch / dinner / dessert from the cleaner.
  // Empty = drinks, sauces, dips, plain sides: not suggested on their own.
  const mealTypes = JSON.parse(r.meal_types || '[]') as MealType[];
  if (mealTypes.length === 0) return 'notMeal';

  // Quiz tags, emoji, vibe and times from the existing transform.
  const quiz = transformKaggleRow({
    title: r.title,
    ingredients: JSON.stringify(lines.map(l => l.raw_text)),
    directions: r.directions,
    link: r.source_url ?? '',
    source: '',
    NER: '[]',
    site: r.site ?? '',
  }, { mealsOnly: false });
  if (!quiz) return 'notMeal';

  const knownAll = !!r.all_ingredients_known;
  const quizTags = new Set(quiz.tags);
  // The cleaned data knows vegetarian status better than keyword rules.
  if (tags.includes('vegetarian')) { quizTags.add('vegetarian'); quizTags.add('plant-based'); }
  else { quizTags.delete('vegetarian'); quizTags.delete('plant-based'); }

  const row: RecipeRow = {
    ...quiz,
    tags: [...quizTags],
    meal_types: mealTypes,
    // Desserts are sweet whatever keyword rules guessed.
    vibe: mealTypes.length === 1 && mealTypes[0] === 'dessert' ? 'sweet' : quiz.vibe,
    servings: r.servings,
    nutrition,
    plate,
    dietary: slimDietary(tags),
    allergens: contains,
    may_contain: mayContain,
    allergens_verified: knownAll,
    all_ingredients_known: knownAll,
    nutrition_coverage: r.nutrition_coverage,
    servings_estimated: !!r.servings_estimated,
    required_count: r.required_count,
    ingredients: quiz.ingredients.map((ing, i) => {
      const cat = lines[i]?.category;
      return cat ? { ...ing, category: APP_CATEGORY[cat] ?? ing.category } : ing;
    }),
  };

  return {
    row,
    lines: lines.map(l => ({
      // The original wording is already in recipes.ingredients; keep it here only
      // for lines the catalog didn't recognise (they're shown by name elsewhere).
      recipe_id: row.id, position: l.position, ingredient_id: l.ingredient_id,
      raw_text: l.ingredient_id ? '' : l.raw_text,
      quantity: l.quantity, unit: l.unit, grams: l.grams, form: l.form, preparation: l.preparation,
      is_optional: !!l.is_optional, is_required: !!l.is_required,
    })),
    swaps: swaps.map(s => ({ recipe_id: row.id, substitution_id: s })),
  };
}

// Database size in MB, or null when the size function isn't available
// (migration 20260927000000_fit_more_recipes.sql not applied yet).
async function dbSizeMb(sb: SupabaseClient | null): Promise<number | null> {
  if (!sb) return null;
  const { data, error } = await sb.rpc('bitewise_db_size_mb');
  return error ? null : Number(data);
}

async function pushRecipes(db: DatabaseSync, sb: SupabaseClient | null) {
  const startMb = await dbSizeMb(sb);
  if (sb && startMb === null) {
    throw new Error('Can\'t check the database size. Run `npx supabase db push` first '
      + '(migration 20260927000000_fit_more_recipes.sql), then try again.');
  }
  if (startMb !== null) {
    console.log(`Database is ${startMb} MB; uploading until ${MAX_DB_MB} MB`
      + (Number.isFinite(LIMIT) ? ` or ${LIMIT.toLocaleString()} recipes.` : '.'));
    if (startMb >= MAX_DB_MB) {
      console.log('Already at the size budget - nothing to upload. Raise --max-db-mb if your plan allows.');
      return;
    }
  }

  // Fully recognised, well-measured recipes first.
  const ids = (db.prepare(`SELECT id FROM recipes
      ORDER BY all_ingredients_known DESC, nutrition_coverage DESC, id`).all() as { id: number }[]).map(x => x.id);

  let pushed = 0;
  const skipped: Record<SkipReason, number> = { notMeal: 0, noNutrition: 0 };
  let sample: RecipeRow | undefined;

  let stopReason = '';
  let batches = 0;
  let lastMb = startMb ?? 0;
  for (const idChunk of chunks(ids, BATCH)) {
    if (pushed >= LIMIT) { stopReason = `reached --limit ${LIMIT.toLocaleString()}`; break; }
    const list = idChunk.join(',');
    const recipes = db.prepare(`SELECT * FROM recipes WHERE id IN (${list})`).all() as unknown as SqlRecipe[];
    const byId = <T extends { recipe_id: number }>(rows: T[]) => {
      const m = new Map<number, T[]>();
      for (const row of rows) m.set(row.recipe_id, [...(m.get(row.recipe_id) ?? []), row]);
      return m;
    };
    const lines = byId(db.prepare(`SELECT ri.*, i.category FROM recipe_ingredients ri
        LEFT JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id IN (${list}) ORDER BY ri.recipe_id, ri.position`).all() as unknown as SqlLine[]);
    const allergens = byId(db.prepare(`SELECT recipe_id, allergen_id, level FROM recipe_allergens
        WHERE recipe_id IN (${list})`).all() as any[]);
    const tags = byId(db.prepare(`SELECT recipe_id, tag_id FROM recipe_tags
        WHERE recipe_id IN (${list})`).all() as any[]);
    const swaps = new Map<number, any[]>();   // worked out in the database now

    const built: Built[] = [];
    for (const r of recipes) {
      if (pushed + built.length >= LIMIT) break;
      const al = allergens.get(r.id) ?? [];
      const b = buildRecipe(
        r,
        lines.get(r.id) ?? [],
        al.filter(a => a.level === 'contains').map(a => a.allergen_id),
        al.filter(a => a.level === 'may_contain').map(a => a.allergen_id),
        (tags.get(r.id) ?? []).map(t => t.tag_id),
        (swaps.get(r.id) ?? []).map(s => s.substitution_id),
      );
      if (typeof b === 'string') skipped[b]++;
      else built.push(b);
    }
    if (!built.length) continue;

    // Two Kaggle rows can share a link; keep one per id within a batch.
    const unique = [...new Map(built.map(b => [b.row.id, b])).values()];
    sample ??= unique[0].row;

    if (sb) {
      await upsert(sb, 'recipes', unique.map(b => b.row), 'id');
      const recipeIds = unique.map(b => b.row.id);
      for (const table of ['recipe_ingredients', 'recipe_substitutions']) {
        const { error } = await sb.from(table).delete().in('recipe_id', recipeIds);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
      await upsert(sb, 'recipe_ingredients', unique.flatMap(b => b.lines), 'recipe_id,position');
      // Swaps are worked out from recipe_ingredients (safe_substitutions), so no rows here.
    }
    pushed += unique.length;
    process.stdout.write(`\r  ${pushed.toLocaleString()} recipes pushed; skipped ${skipped.notMeal.toLocaleString()} `
      + `(not meals), ${skipped.noNutrition.toLocaleString()} (macros not measurable)`);

    // Size guard: every 10 batches, and every batch once within 10% of the budget.
    batches++;
    if (sb && (batches % 10 === 0 || lastMb >= MAX_DB_MB * 0.9)) {
      const mb = await dbSizeMb(sb);
      if (mb !== null) {
        lastMb = mb;
        process.stdout.write(` · ${mb} MB   `);
        if (mb >= MAX_DB_MB) { stopReason = `database reached ${mb} MB (budget ${MAX_DB_MB} MB)`; break; }
      }
    }
  }
  console.log('');
  const endMb = await dbSizeMb(sb);
  if (endMb !== null) console.log(`Database size now: ${endMb} MB`);
  console.log(stopReason ? `Stopped: ${stopReason}.` : 'Uploaded every recipe that qualifies.');
  if (DRY_RUN && sample) console.log('Sample row:\n' + JSON.stringify(sample, null, 2).slice(0, 2500));
}

// ============================================
// MAIN
// ============================================

async function main() {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });

  let sb: SupabaseClient | null = null;
  if (!DRY_RUN) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (or use --dry-run)');
    sb = createClient(url, key, { auth: { persistSession: false } });
  }

  console.log(`${DRY_RUN ? '[dry run] ' : ''}Reading ${DB_PATH}`);
  await pushReferenceData(db, sb);
  if (!REFERENCE_ONLY) await pushRecipes(db, sb);

  // Curated recipes (seedCuratedRecipes.ts) get matched to the catalog so
  // they show up in pantry results too.
  if (sb) {
    const { data, error } = await sb.rpc('index_curated_recipes');
    if (error) throw new Error(`index_curated_recipes: ${error.message}`);
    console.log(`Indexed ${data} curated recipes`);
  }
  db.close();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
