// lib/recipeRow.ts
//
// The shape of a row in the Supabase `recipes` table, and the two
// mappers between that row and the app's Recipe type (types/index.ts).
//
// Postgres columns are snake_case; the app is camelCase. Keeping the
// translation in this one file means nothing else in the app needs to
// know the database exists. backend/scripts also import this file.

import type { Allergen, DietaryTag, MealType, Nutrition, PlateComposition, Recipe } from '../types';

/**
 * The nutrition jsonb. Curated recipes have the five Nutrition fields;
 * imported recipes also carry the rest (all per serving). The database
 * exposes each one as a numeric column (kcal, protein_g, sodium_mg, ...)
 * for filtering.
 */
export type RecipeNutritionRow = Nutrition & {
  netCarbs?: number;
  satFat?: number;
  fiber?: number;
  sugar?: number;
  addedSugar?: number;
  sodium?: number;       // mg
  cholesterol?: number;  // mg
};

export interface RecipeRow {
  id: string;
  name: string;
  emoji: string;
  tags: string[];
  vibe: Recipe['vibe'];
  plate: PlateComposition | null;
  nutrition: RecipeNutritionRow | null;
  prep_minutes: number;
  cook_minutes: number;
  servings: number | null;
  difficulty: Recipe['difficulty'];
  dietary: string[];
  allergens: string[];
  /** Allergens hidden in common ingredients (e.g. bread may contain eggs). */
  may_contain?: string[];
  allergens_verified: boolean;
  /** Maintained by a database trigger (age safeguard). Missing until that migration runs. */
  contains_alcohol?: boolean;
  // Set by the cleaning pipeline (imported) or a database trigger (curated).
  all_ingredients_known?: boolean;
  nutrition_coverage?: number | null;
  servings_estimated?: boolean;
  required_count?: number;
  ingredients: Recipe['ingredients'];
  instructions: string[];
  meal_types?: MealType[];
  source: 'bitewise' | 'kaggle' | 'community';
  source_url: string | null;
  // Read-only, maintained by the database.
  favorite_count?: number;
  author_id?: string | null;
  /** Embedded with select('*, profiles(username)') for community recipes. */
  profiles?: { username: string | null } | null;
}

// Every recipe the push script sends has both of these; the fallbacks only
// guard against a hand-edited row so screens never crash on undefined.
const EMPTY_PLATE: PlateComposition = { produce: 0, protein: 0, carbs: 0, healthyFats: 0 };
const EMPTY_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, totalFat: 0, healthyFat: 0 };
const DEFAULT_SERVINGS = 4;

export function rowToRecipe(row: RecipeRow): Recipe {
  const n = row.nutrition;
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    tags: row.tags,
    vibe: row.vibe,
    plate: row.plate ?? EMPTY_PLATE,
    nutrition: n
      ? { calories: n.calories, protein: n.protein, carbs: n.carbs, totalFat: n.totalFat, healthyFat: n.healthyFat }
      : EMPTY_NUTRITION,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    servings: row.servings ?? DEFAULT_SERVINGS,
    difficulty: row.difficulty,
    ingredients: row.ingredients,
    instructions: row.instructions,
    dietary: row.dietary as DietaryTag[],
    allergens: row.allergens as Allergen[],
    mayContain: (row.may_contain ?? []) as Allergen[],
    allergensVerified: row.allergens_verified,
    ...(row.contains_alcohol ? { containsAlcohol: true } : {}),
    servingsEstimated: row.servings_estimated ?? false,
    mealTypes: row.meal_types?.length ? row.meal_types : undefined,
    source: row.source,
    sourceUrl: row.source_url ?? undefined,
    favoriteCount: row.favorite_count ?? 0,
    authorId: row.author_id ?? undefined,
    authorName: row.profiles?.username ?? undefined,
  };
}

/** Curated recipes from constants/recipes.ts → database rows (backend/scripts/seedCuratedRecipes.ts). */
export function recipeToRow(recipe: Recipe): RecipeRow {
  return {
    id: recipe.id,
    name: recipe.name,
    emoji: recipe.emoji,
    tags: recipe.tags,
    vibe: recipe.vibe,
    plate: recipe.plate,
    nutrition: recipe.nutrition,
    prep_minutes: recipe.prepMinutes,
    cook_minutes: recipe.cookMinutes,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    dietary: recipe.dietary,
    allergens: recipe.allergens,
    may_contain: recipe.mayContain ?? [],
    // Hand-written recipes have been checked by a person.
    allergens_verified: recipe.allergensVerified ?? true,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    meal_types: recipe.mealTypes ?? ['dinner'],   // curated recipes were written as dinners
    source: recipe.source ?? 'bitewise',
    source_url: recipe.sourceUrl ?? null,
  };
}
