// utils/matching.ts
// All scoring + filtering logic lives here so it can be tested
// independently of any screen.

import type {
  Recipe,
  ScoredRecipe,
  PlateComposition,
  PantryItem,
  UserPreferences,
} from '../types';

export const MATCH_THRESHOLD = 70;

// ============================================
// MATCH SCORE
// ============================================

/**
 * Percentage of a recipe's tags that the user selected.
 * Skipped questions contribute no tags, so they neither
 * help nor hurt a recipe's score.
 */
export function calculateMatchScore(
  userTags: Set<string>,
  recipeTags: string[]
): number {
  if (userTags.size === 0) return 0;
  if (recipeTags.length === 0) return 0;

  const matches = recipeTags.filter(tag => userTags.has(tag)).length;
  return Math.round((matches / recipeTags.length) * 100);
}

// ============================================
// PLATE BALANCE (Harvard Healthy Eating Plate)
// ============================================

export const PLATE_TARGETS = {
  produce: { min: 45, max: 55, ideal: 50 },
  protein: { min: 20, max: 30, ideal: 25 },
  carbs: { min: 20, max: 30, ideal: 25 },
  healthyFats: { min: 3, max: 15, ideal: 8 },
} as const;

export function isPlateBalanced(plate: PlateComposition): boolean {
  return (
    plate.produce >= PLATE_TARGETS.produce.min &&
    plate.produce <= PLATE_TARGETS.produce.max &&
    plate.protein >= PLATE_TARGETS.protein.min &&
    plate.protein <= PLATE_TARGETS.protein.max &&
    plate.carbs >= PLATE_TARGETS.carbs.min &&
    plate.carbs <= PLATE_TARGETS.carbs.max
  );
}

/**
 * Generates a specific, actionable tip instead of a generic
 * "add more veggies" for every unbalanced plate.
 */
export function getPlateSuggestion(plate: PlateComposition): string | undefined {
  if (isPlateBalanced(plate)) return undefined;

  if (plate.produce < PLATE_TARGETS.produce.min) {
    const gap = PLATE_TARGETS.produce.ideal - plate.produce;
    return `Add a side salad or extra vegetables (+${gap}% produce) to hit the half-plate target.`;
  }
  if (plate.carbs > PLATE_TARGETS.carbs.max) {
    return `Carb-heavy — halve the grain portion and fill the space with vegetables.`;
  }
  if (plate.protein > PLATE_TARGETS.protein.max) {
    return `Protein-heavy — reduce the portion slightly and add more produce.`;
  }
  if (plate.protein < PLATE_TARGETS.protein.min) {
    return `Light on protein — add beans, eggs, or an extra few ounces of meat.`;
  }
  if (plate.produce > PLATE_TARGETS.produce.max) {
    return `Very produce-forward — add a grain or protein for staying power.`;
  }
  return `Adjust portions toward 1/2 produce, 1/4 protein, 1/4 carbs.`;
}

// ============================================
// PANTRY MATCHING
// ============================================

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** Loose match so "Chicken Breast" in pantry satisfies "chicken" in a recipe. */
function pantryHas(pantry: PantryItem[], ingredientName: string): boolean {
  const needle = normalize(ingredientName);
  return pantry.some(item => {
    if (item.quantity <= 0) return false;
    const have = normalize(item.name);
    return have.includes(needle) || needle.includes(have);
  });
}

export interface PantryCoverage {
  have: string[];
  missing: string[];
  percent: number;
}

/** Which required ingredients the user has vs. is missing. */
export function getPantryCoverage(
  recipe: Recipe,
  pantry: PantryItem[]
): PantryCoverage {
  const required = recipe.ingredients.filter(i => !i.optional);
  const have: string[] = [];
  const missing: string[] = [];

  required.forEach(ing => {
    if (pantryHas(pantry, ing.name)) have.push(ing.name);
    else missing.push(ing.name);
  });

  const percent =
    required.length === 0 ? 100 : Math.round((have.length / required.length) * 100);

  return { have, missing, percent };
}

// ============================================
// DIETARY FILTERING
// ============================================

/**
 * Allergens are a hard exclusion — never surface a recipe
 * containing something the user flagged.
 */
export function passesDietaryFilter(
  recipe: Recipe,
  prefs: UserPreferences
): boolean {
  const hasAllergen = recipe.allergens.some(a => prefs.avoidAllergens.includes(a));
  if (hasAllergen) return false;

  const meetsDiet = prefs.dietary.every(tag => recipe.dietary.includes(tag));
  if (!meetsDiet) return false;

  if (prefs.maxCookMinutes !== null) {
    const total = recipe.prepMinutes + recipe.cookMinutes;
    if (total > prefs.maxCookMinutes) return false;
  }

  return true;
}

// ============================================
// MAIN PIPELINE
// ============================================

export interface ScoreOptions {
  userTags: Set<string>;
  vibe: string | null;
  preferences: UserPreferences;
  pantry?: PantryItem[];        // only passed in pantry mode
  requirePantryMatch?: boolean;
}

/**
 * Single entry point the results screen calls.
 * Order matters: hard filters first, then score, then threshold, then sort.
 */
export function scoreAndFilterRecipes(
  recipes: Recipe[],
  opts: ScoreOptions
): ScoredRecipe[] {
  const { userTags, vibe, preferences, pantry, requirePantryMatch } = opts;

  return recipes
    .filter(r => passesDietaryFilter(r, preferences))
    .filter(r => (vibe ? r.vibe === vibe : true))
    .filter(r => {
      if (!requirePantryMatch || !pantry) return true;
      return getPantryCoverage(r, pantry).percent >= 70;
    })
    .map(r => ({
      ...r,
      matchScore: calculateMatchScore(userTags, r.tags),
      isBalanced: isPlateBalanced(r.plate),
      suggestion: getPlateSuggestion(r.plate),
    }))
    .filter(r => r.matchScore >= MATCH_THRESHOLD)
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ============================================
// FALLBACK — avoid dead-end empty states
// ============================================

/**
 * If nothing clears 70%, return the next-best few so the user
 * always sees something rather than a dead end.
 */
export function getNearMisses(
  recipes: Recipe[],
  opts: ScoreOptions,
  limit = 3
): ScoredRecipe[] {
  const { userTags, preferences } = opts;

  return recipes
    .filter(r => passesDietaryFilter(r, preferences))
    .map(r => ({
      ...r,
      matchScore: calculateMatchScore(userTags, r.tags),
      isBalanced: isPlateBalanced(r.plate),
      suggestion: getPlateSuggestion(r.plate),
    }))
    .filter(r => r.matchScore > 0 && r.matchScore < MATCH_THRESHOLD)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}