// lib/recipesApi.ts
//
// App-side reads from the Supabase `recipes` table: curated, imported
// (Kaggle) and community recipes. Every function returns the same Recipe
// type as constants/recipes.ts, so screens don't care where a recipe came
// from. Writes happen in backend/scripts (service role) or, for shared
// home recipes, in lib/communityApi.ts.

import { supabase, configured } from './supabase';
import { rowToRecipe, RecipeRow } from './recipeRow';
import type { MealType, Recipe } from '../types';

// Author name comes along for community recipes.
const SELECT = '*, profiles(username)';

export interface CandidateFilters {
  /** Only recipes that suit this meal. */
  mealType?: MealType;
  /** Recipes sharing at least one of these tags (the user's quiz answers). */
  tags?: string[];
  /** Recipes that satisfy ALL of these, e.g. ['vegetarian', 'gluten-free']. */
  dietary?: string[];
  /** Recipes that carry at least ONE of these (eating goals like heart-healthy). */
  dietaryAny?: string[];
  /** Drop recipes that contain OR may contain ANY of these allergens. */
  excludeAllergens?: string[];
  /**
   * When the user has allergies, only return recipes whose allergens are
   * verified: checked by a person (curated) or every ingredient matched the
   * ingredient catalog (imported / community). Defaults to true whenever
   * excludeAllergens is set — an unrecognised ingredient could hide anything.
   */
  verifiedAllergensOnly?: boolean;
  /** Prep + cook time limit in minutes. */
  maxTotalMinutes?: number | null;
  source?: Recipe['source'];
  /**
   * Food is the default everywhere a meal is being chosen; the Drinks
   * section asks for 'drink'. 'any' is for search by name.
   */
  kind?: 'food' | 'drink' | 'any';
  limit?: number;
  /**
   * true: start at a random offset so repeated calls return different
   * recipes (used by Decide for Me). false: most-saved first.
   */
  shuffle?: boolean;
}

// Postgres array literal for PostgREST filters: ['a','b'] -> {"a","b"}
const pgArray = (values: string[]) => `{${values.map(v => `"${v}"`).join(',')}}`;

function applyFilters<Q extends { [k: string]: any }>(query: Q, f: CandidateFilters): Q {
  let q: any = query;
  const verifiedOnly = f.verifiedAllergensOnly ?? Boolean(f.excludeAllergens?.length);
  if (f.mealType) q = q.contains('meal_types', [f.mealType]);
  if (f.tags?.length) q = q.overlaps('tags', f.tags);
  if (f.dietary?.length) q = q.contains('dietary', f.dietary);
  if (f.dietaryAny?.length) q = q.overlaps('dietary', f.dietaryAny);
  if (f.excludeAllergens?.length) {
    q = q
      .not('allergens', 'ov', pgArray(f.excludeAllergens))
      .not('may_contain', 'ov', pgArray(f.excludeAllergens));
  }
  if (verifiedOnly) q = q.eq('allergens_verified', true);
  if (f.source) q = q.eq('source', f.source);
  const kind = f.kind ?? 'food';
  if (kind !== 'any') q = q.eq('kind', kind);
  // Total time is two columns; cook time alone is a safe pre-filter, the
  // exact prep + cook check happens in the app (utils/decide.ts).
  if (f.maxTotalMinutes) q = q.lte('cook_minutes', f.maxTotalMinutes);
  return q;
}

/**
 * A pool of recipes for the app's matchers to score. Filtering happens in
 * Postgres (GIN indexes); scoring stays in the app.
 */
export async function fetchCandidateRecipes(filters: CandidateFilters = {}): Promise<Recipe[]> {
  if (!configured) return [];
  const limit = filters.limit ?? 200;

  if (filters.shuffle) return sampleRecipes(filters, limit);

  const query = applyFilters(supabase.from('recipes').select(SELECT), filters)
    .order('favorite_count', { ascending: false })
    .range(0, limit - 1);
  const { data, error } = await query;
  if (error) throw error;
  return (data as RecipeRow[]).map(rowToRecipe);
}

/**
 * A random sample that matches the filters, in two cheap steps:
 *   1. ids: the first `limit` matches with rnd >= r (wrapping round to
 *      rnd < r if the end of the range comes first). Every recipe has a
 *      random `rnd` key and a covering index, so this is an index-only
 *      scan — milliseconds, however big the table.
 *   2. the full rows for those ids.
 * The old way (ORDER BY id OFFSET random) had to read and sort every
 * matching row first: 25 s for desserts, past the API's 8 s timeout, so
 * desserts came back empty.
 */
async function sampleRecipes(filters: CandidateFilters, limit: number): Promise<Recipe[]> {
  const r = Math.random();
  const ids: string[] = [];
  const page = async (from: number, to: number | null, n: number) => {
    let q: any = applyFilters(supabase.from('recipes').select('id'), filters).gte('rnd', from);
    if (to !== null) q = q.lt('rnd', to);
    const { data, error } = await q.order('rnd').limit(n);
    if (error) throw error;
    (data as { id: string }[]).forEach(row => ids.push(row.id));
  };
  await page(r, null, limit);
  if (ids.length < limit) await page(0, r, limit - ids.length);
  if (ids.length === 0) return [];

  // PostgREST puts the ids in the URL, so fetch them in chunks.
  const rows: RecipeRow[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await supabase.from('recipes').select(SELECT).in('id', ids.slice(i, i + ID_CHUNK));
    if (error) throw error;
    rows.push(...(data as RecipeRow[]));
  }
  // Keep the random order the sample came in.
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return rows.map(rowToRecipe);
}

const ID_CHUNK = 100;

export async function fetchRecipeById(id: string): Promise<Recipe | undefined> {
  if (!configured) return undefined;
  const { data, error } = await supabase.from('recipes').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToRecipe(data as RecipeRow) : undefined;
}

/** Several recipes at once, e.g. the user's favorites. Order follows `ids`. */
export async function fetchRecipesByIds(ids: string[]): Promise<Recipe[]> {
  if (!configured || ids.length === 0) return [];
  const { data, error } = await supabase.from('recipes').select(SELECT).in('id', ids);
  if (error) throw error;
  const byId = new Map((data as RecipeRow[]).map(r => [r.id, rowToRecipe(r)]));
  return ids.map(id => byId.get(id)).filter((r): r is Recipe => Boolean(r));
}

/** Name search for a search bar: "chick" -> Chicken Parmesan, Chickpea Bowl... */
export async function searchRecipes(term: string, filters: CandidateFilters = {}): Promise<Recipe[]> {
  if (!configured || !term.trim()) return [];
  const query = applyFilters(supabase.from('recipes').select(SELECT), filters)
    .ilike('name', `%${term.trim()}%`)
    .order('favorite_count', { ascending: false })
    .limit(filters.limit ?? 20);
  const { data, error } = await query;
  if (error) throw error;
  return (data as RecipeRow[]).map(rowToRecipe);
}
