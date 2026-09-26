// utils/matching.ts
//
// All scoring + filtering logic, kept out of the screens so it can be
// tested on its own.
//
// WHY THE SCORING CHANGED
// -----------------------
// The old formula was: (recipe tags the user picked) / (total recipe tags).
// That reads like it should work, but it punishes descriptive recipes.
// A recipe tagged with 20 things could satisfy every single answer the
// user gave and still score 40%, because the denominator counted tags
// the user was never asked about. Nothing ever cleared the 70% bar, so
// the results screen always fell through to "closest fit."
//
// The new formula asks a better question:
//
//     Of the decisions the user actually made, how many does this recipe satisfy?
//
// Each quiz question covers one DIMENSION (protein-type, carb-richness,
// veg-prep, and so on). A recipe "satisfies" a dimension if it carries any
// of the tags from the option the user chose. Score is simply:
//
//     satisfied dimensions / answered dimensions
//
// Skipped questions never enter the denominator, so a skip stays neutral —
// which is the behavior the team agreed on. Vibe is scored as one more
// dimension instead of being a hard filter, so picking "spicy" nudges
// results rather than deleting two-thirds of the library.

import { findCustomConflicts } from './customFoods';
import { recipeHasAlcohol } from './alcohol';
import type {
  Recipe,
  ScoredRecipe,
  PlateComposition,
  PantryItem,
  UserPreferences,
  Vibe,
} from '../types';

export const MATCH_THRESHOLD = 70;

// ============================================
// MATCH SCORE
// ============================================

/** One answered question: which decision it covered, and what was chosen. */
export interface UserSelection {
  dimension: string;
  tags: string[];
}

/**
 * Fraction of the user's answered dimensions that this recipe satisfies,
 * as a 0–100 integer.
 */
export function calculateMatchScore(
  selections: UserSelection[],
  recipeTags: string[]
): number {
  if (selections.length === 0) return 0;

  const recipeTagSet = new Set(recipeTags.map(t => t.toLowerCase()));
  const satisfied = selections.filter(sel =>
    sel.tags.some(t => recipeTagSet.has(t.toLowerCase()))
  ).length;

  return Math.round((satisfied / selections.length) * 100);
}

/**
 * Which of the user's choices this recipe did and didn't satisfy.
 * Useful for a "why this meal?" breakdown on the results screen.
 */
export function explainMatch(
  selections: UserSelection[],
  recipeTags: string[]
): { matched: string[]; missed: string[] } {
  const recipeTagSet = new Set(recipeTags.map(t => t.toLowerCase()));
  const matched: string[] = [];
  const missed: string[] = [];

  selections.forEach(sel => {
    const hit = sel.tags.some(t => recipeTagSet.has(t.toLowerCase()));
    (hit ? matched : missed).push(sel.dimension);
  });

  return { matched, missed };
}

/**
 * Folds the vibe answer in as one more dimension, so it influences the
 * ranking without wiping out every recipe of a different flavor.
 */
export function withVibeSelection(
  selections: UserSelection[],
  vibe: Vibe | null
): UserSelection[] {
  if (!vibe) return selections;
  return [...selections, { dimension: 'vibe', tags: [vibe] }];
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
 * A specific, actionable tip instead of a generic "add more veggies"
 * on every unbalanced plate.
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

/** Loose match so "Chicken Breast" in the pantry satisfies "chicken" in a recipe. */
export function pantryHas(pantry: PantryItem[], ingredientName: string): boolean {
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
 * Allergens are a hard exclusion — never surface a recipe containing
 * something the user flagged.
 */
/**
 * Age safeguard on its own, for screens that show a recipe without the
 * other filters (a shared link, chat, Community, favorites).
 */
export function ageAllowsRecipe(recipe: Recipe, prefs: Pick<UserPreferences, 'allowAlcohol'>): boolean {
  return prefs.allowAlcohol === true || !recipeHasAlcohol(recipe);
}

export function passesDietaryFilter(
  recipe: Recipe,
  prefs: UserPreferences
): boolean {
  // Age safeguard: recipes made with alcohol only for people 21+ (utils/alcohol.ts).
  if (!ageAllowsRecipe(recipe, prefs)) return false;

  const hasAllergen = recipe.allergens.some(a => prefs.avoidAllergens.includes(a));
  if (hasAllergen) return false;

  // Recipes from the database can also list hidden allergens ("bread may
  // contain eggs"), and imported/community recipes with an unrecognised
  // ingredient have allergensVerified === false. For anyone with an
  // allergy, both mean "don't show it".
  const customAllergies = prefs.customAllergies ?? [];
  if (prefs.avoidAllergens.length > 0 || customAllergies.length > 0) {
    if (recipe.allergensVerified === false) return false;
    if (recipe.mayContain?.some(a => prefs.avoidAllergens.includes(a))) return false;
  }

  // Allergies and foods-to-avoid the user typed in Profile.
  if (customAllergies.length > 0 || (prefs.customAvoid ?? []).length > 0) {
    const conflicts = findCustomConflicts(recipe, prefs);
    if (conflicts.allergies.length > 0 || conflicts.avoid.length > 0) return false;
  }

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
  /** One entry per answered question. Skips are simply absent. */
  selections: UserSelection[];
  vibe: Vibe | null;
  preferences: UserPreferences;
  pantry?: PantryItem[]; // only passed in pantry mode
  requirePantryMatch?: boolean;
  /** Minimum pantry coverage in pantry mode. */
  pantryThreshold?: number;
}

/**
 * How many of the user's onboarding taste tags a recipe carries.
 * Used ONLY as a tie-breaker between equal match scores — the quiz
 * answers always outrank standing preferences, because "what I feel
 * like tonight" should beat "what I generally like."
 */
export function favoriteOverlap(recipe: Recipe, favoriteTags: string[]): number {
  if (favoriteTags.length === 0) return 0;
  const favs = new Set(favoriteTags.map(t => t.toLowerCase()));
  return recipe.tags.filter(t => favs.has(t.toLowerCase())).length;
}

/**
 * How many "rather skip" tags a recipe carries. Mirrors favoriteOverlap
 * on the other side of the scale: a SOFT penalty in tie-breaks, never a
 * hard filter (that's what allergens are for). tasteBias below combines
 * both so one preference signal decides ties.
 */
export function dislikeOverlap(recipe: Recipe, dislikedTags: string[]): number {
  if (dislikedTags.length === 0) return 0;
  const bad = new Set(dislikedTags.map(t => t.toLowerCase()));
  return recipe.tags.filter(t => bad.has(t.toLowerCase())).length;
}

/** Net taste signal: loves push a recipe up ties, dislikes push it down. */
function tasteBias(recipe: Recipe, favs: string[], dislikes: string[]): number {
  return favoriteOverlap(recipe, favs) - dislikeOverlap(recipe, dislikes);
}

function scoreAll(recipes: Recipe[], opts: ScoreOptions): ScoredRecipe[] {
  const scoringSelections = withVibeSelection(opts.selections, opts.vibe);

  return recipes.map(r => ({
    ...r,
    // Score against tags PLUS the recipe's vibe, so the final flavor
    // question matches on the vibe field instead of relying on the
    // word happening to appear in the tag list.
    matchScore: calculateMatchScore(scoringSelections, [...r.tags, r.vibe]),
    isBalanced: isPlateBalanced(r.plate),
    suggestion: getPlateSuggestion(r.plate),
  }));
}

/**
 * Single entry point the results screen calls.
 * Order matters: hard filters first, then score, then threshold, then sort.
 */
export function scoreAndFilterRecipes(
  recipes: Recipe[],
  opts: ScoreOptions
): ScoredRecipe[] {
  const { preferences, pantry, requirePantryMatch, pantryThreshold = 70 } = opts;

  const eligible = recipes
    .filter(r => passesDietaryFilter(r, preferences))
    .filter(r => {
      if (!requirePantryMatch || !pantry) return true;
      return getPantryCoverage(r, pantry).percent >= pantryThreshold;
    });

  const favs = opts.preferences.favoriteTags ?? [];
  const dislikes = opts.preferences.dislikedTags ?? [];

  return scoreAll(eligible, opts)
    .filter(r => r.matchScore >= MATCH_THRESHOLD)
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        tasteBias(b, favs, dislikes) - tasteBias(a, favs, dislikes)
    );
}

// ============================================
// FALLBACK — avoid dead-end empty states
// ============================================

/**
 * If nothing clears the threshold, return the next-best few so the user
 * always sees something rather than a dead end. Pantry mode is relaxed
 * here on purpose: a near miss is more useful than an empty screen.
 */
export function getNearMisses(
  recipes: Recipe[],
  opts: ScoreOptions,
  limit = 3
): ScoredRecipe[] {
  const eligible = recipes.filter(r => passesDietaryFilter(r, opts.preferences));
  const favs = opts.preferences.favoriteTags ?? [];
  const dislikes = opts.preferences.dislikedTags ?? [];

  return scoreAll(eligible, opts)
    .filter(r => r.matchScore > 0)
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        tasteBias(b, favs, dislikes) - tasteBias(a, favs, dislikes)
    )
    .slice(0, limit);
}
