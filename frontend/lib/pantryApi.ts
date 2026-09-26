// lib/pantryApi.ts
//
// Pantry-based recipe lookups against the full Supabase recipe database
// (curated + imported), backed by the functions in
// backend/supabase/migrations/20260924000000_recipe_database.sql.
//
// The app keeps the pantry and preferences on the phone (AppContext /
// AsyncStorage), so every call takes them as arguments:
//
//   const { pantry, preferences } = useApp();
//   const matches = await fetchPantryMatches(pantry, preferences);
//
// Pantry names are matched to the ingredient catalog on the server, so
// "Chicken Breast", "chicken breasts" and "boneless skinless chicken"
// all count as chicken breast, and chicken breast also satisfies a
// recipe that just says "chicken".
//
// Safety rules (applied in the database, same for every call):
//   * allergies: a recipe is only returned if its allergen list is verified
//     and it neither contains nor may contain any avoided allergen
//   * diets: a recipe must carry every tag in preferences.dietary

import { supabase } from './supabase';
import type { Allergen, DietaryTag, MealType, PantryItem, UserPreferences } from '../types';

// ============================================
// TYPES
// ============================================

type Prefs = Pick<UserPreferences, 'avoidAllergens' | 'dietary'>;
type Pantry = PantryItem[] | string[];

export interface MatchedPantryItem {
  input: string;
  /** null = not recognised; the item is ignored for matching. */
  ingredientId: string | null;
  name: string | null;
  category: string | null;
}

export interface IngredientOption {
  id: string;
  name: string;
  category: string;
  matchedAlias: string;
}

export interface PantryMatch {
  recipeId: string;
  name: string;
  emoji: string;
  haveCount: number;
  requiredCount: number;
  missingCount: number;
  /** 0–100, same scale as getPantryCoverage().percent in utils/matching.ts */
  percent: number;
  missingIngredients: string[];
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  totalFat: number | null;
}

export interface ShoppingListItem {
  position: number;
  ingredientId: string | null;
  item: string;
  rawText: string;
  category: string | null;
}

export interface Substitution {
  id: string;
  replaceThis: string;
  /** null = a technique tip ("use a third less sugar") rather than a swap */
  withThis: string | null;
  tip: string;
  /** diet tags this swap moves the recipe toward, e.g. ['heart-healthy'] */
  helps: DietaryTag[];
}

// ============================================
// HELPERS
// ============================================

/** Names of items the user actually has (quantity > 0), like pantryHas() in utils/matching.ts. */
function pantryNames(pantry: Pantry): string[] {
  return (pantry as (PantryItem | string)[])
    .filter(p => typeof p === 'string' || p.quantity > 0)
    .map(p => (typeof p === 'string' ? p : p.name).trim())
    .filter(Boolean);
}

// Always pass arrays (never null): the phone is the source of truth for
// preferences, so the server must not fall back to anything else.
const prefParams = (prefs: Prefs) => ({
  p_allergens: prefs.avoidAllergens as Allergen[],
  p_dietary: prefs.dietary as DietaryTag[],
});

async function call<T>(fn: string, params: object): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

const toMatch = (r: any): PantryMatch => ({
  recipeId: r.recipe_id,
  name: r.name,
  emoji: r.emoji,
  haveCount: r.have_count,
  requiredCount: r.required_count,
  missingCount: r.missing_count,
  percent: Math.round((r.match_ratio ?? 0) * 100),
  missingIngredients: r.missing_ingredients ?? [],
  calories: r.kcal,
  protein: r.protein_g,
  carbs: r.carbs_g,
  totalFat: r.fat_g,
});

// ============================================
// INGREDIENTS
// ============================================

/** Which pantry items the database recognises, e.g. to flag "we don't know 'dragonfruit' yet". */
export async function matchPantryItems(pantry: Pantry): Promise<MatchedPantryItem[]> {
  const rows = await call<any>('match_ingredients', { p_texts: pantryNames(pantry) });
  return rows.map(r => ({ input: r.input, ingredientId: r.ingredient_id, name: r.name, category: r.category }));
}

/** Autocomplete for adding pantry items: "tom" -> Tomato, Tomato paste, Cherry tomato... */
export async function searchIngredients(query: string, limit = 10): Promise<IngredientOption[]> {
  if (!query.trim()) return [];
  const rows = await call<any>('search_ingredients', { q: query, lim: limit });
  return rows.map(r => ({ id: r.id, name: r.name, category: r.category, matchedAlias: r.matched_alias }));
}

// ============================================
// RECIPES FROM THE PANTRY
// ============================================

/**
 * Best recipes for what's in the pantry, fewest missing ingredients first.
 * Mirrors the Cook With My Pantry screen: minPercent 80 = "Ready to cook",
 * 50 = include "Almost there".
 */
export async function fetchPantryMatches(
  pantry: Pantry,
  prefs: Prefs,
  opts: { maxMissing?: number; minPercent?: number; limit?: number; mealType?: MealType } = {},
): Promise<PantryMatch[]> {
  const names = pantryNames(pantry);
  if (names.length === 0) return [];
  const rows = await call<any>('pantry_matches', {
    p_pantry: names,
    p_max_missing: opts.maxMissing ?? 3,
    p_min_match: (opts.minPercent ?? 50) / 100,
    p_limit: opts.limit ?? 20,
    p_meal_type: opts.mealType ?? null,
    ...prefParams(prefs),
  });
  return rows.map(toMatch);
}

/** Recipes the user can make right now with nothing missing. */
export async function fetchCookNow(
  pantry: Pantry, prefs: Prefs, opts: { limit?: number; mealType?: MealType } = {},
): Promise<PantryMatch[]> {
  const names = pantryNames(pantry);
  if (names.length === 0) return [];
  const rows = await call<any>('cook_now', {
    p_pantry: names, p_limit: opts.limit ?? 20, p_meal_type: opts.mealType ?? null, ...prefParams(prefs),
  });
  return rows.map(toMatch);
}

/**
 * Recipes that use the given items first — e.g. things about to go off.
 * `useUp` is a subset of the pantry (names or items).
 */
export async function fetchUseItUp(pantry: Pantry, useUp: Pantry, prefs: Prefs, opts: { maxMissing?: number; limit?: number } = {}) {
  const rows = await call<any>('use_it_up', {
    p_pantry: pantryNames(pantry),
    p_expiring: pantryNames(useUp),
    p_max_missing: opts.maxMissing ?? 3,
    p_limit: opts.limit ?? 20,
    ...prefParams(prefs),
  });
  return rows.map(r => ({
    recipeId: r.recipe_id as string, name: r.name as string, emoji: r.emoji as string,
    usesCount: r.expiring_used as number, missingCount: r.missing_count as number,
    calories: r.kcal as number | null, protein: r.protein_g as number | null,
  }));
}

/** Recipes that use ALL of these ingredients, e.g. ['chicken', 'broccoli']. Names or catalog ids. */
export async function fetchRecipesWithIngredients(ingredients: string[], prefs: Prefs, limit = 20) {
  const ids = (await matchPantryItems(ingredients)).map(m => m.ingredientId).filter((id): id is string => !!id);
  if (ids.length === 0) return [];
  const rows = await call<any>('recipes_with_ingredients', {
    p_ingredient_ids: [...new Set(ids)],
    p_limit: limit,
    ...prefParams(prefs),
  });
  return rows.map(r => ({
    recipeId: r.recipe_id as string, name: r.name as string, emoji: r.emoji as string,
    requiredCount: r.required_count as number, calories: r.kcal as number | null, protein: r.protein_g as number | null,
  }));
}

/** What's still needed for one recipe, given the pantry. */
export async function fetchShoppingList(recipeId: string, pantry: Pantry): Promise<ShoppingListItem[]> {
  const rows = await call<any>('shopping_list', { p_recipe_id: recipeId, p_pantry: pantryNames(pantry) });
  return rows.map(r => ({
    position: r.line_position, ingredientId: r.ingredient_id, item: r.item, rawText: r.raw_text, category: r.category,
  }));
}

/** Healthier swaps for a recipe, never suggesting something the user is allergic to. */
export async function fetchSubstitutions(recipeId: string, prefs: Prefs): Promise<Substitution[]> {
  const rows = await call<any>('safe_substitutions', { p_recipe_id: recipeId, ...prefParams(prefs) });
  return rows.map(r => ({ id: r.id, replaceThis: r.replace_this, withThis: r.with_this, tip: r.tip, helps: r.helps ?? [] }));
}
