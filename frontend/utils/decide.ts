// utils/decide.ts
//
// "Decide for me": takes the recipes that suit a meal and returns them
// ranked, best first, each with the reasons it was picked. The Decide
// screen shows ONE pick at a time, so the user never faces a wall of
// options — the point of the app is to take the decision off their plate.
//
// Signals (all soft; hard filters already ran in useRecipeLibrary):
//   craving      the one question we ask ("quick", "comforting", ...)
//   taste        onboarding loves / dislikes / cuisines / spice level
//   pantry       how much of the recipe they already have
//   history      what they picked for this meal before (learned taste),
//                and not repeating the last few picks
//   community    how many BiteWise cooks saved it
//   favorites    their own hearts
//
// VARIETY (utils/variety.ts): recipes it showed you recently lose points
// (fading over a few days), the order is a weighted draw rather than
// always the top score, and each next pick avoids the kind of dish and
// protein you just skipped. tests/decide.sim.ts measures the effect.

import { favoriteOverlap, dislikeOverlap, getPantryCoverage, isPlateBalanced } from './matching';
import { getTotalTime } from '../constants/recipes';
import { lovedFoodsIn } from './customFoods';
import { drawOrder, recencyPenalty, type Exposure } from './variety';
import type { MealType, PantryItem, QuizRun, Recipe, SavedRecipe, UserPreferences } from '../types';

// ============================================
// CRAVINGS — the single question we ask
// ============================================

export type Craving =
  | 'anything' | 'quick' | 'light' | 'comforting' | 'healthy' | 'spicy' | 'sweet' | 'savory'
  | 'chocolate' | 'fruity';

export const CRAVINGS: Record<Craving, { label: string; emoji: string }> = {
  anything: { label: 'Anything — just pick', emoji: '🎯' },
  quick: { label: 'Quick', emoji: '⚡' },
  light: { label: 'Something light', emoji: '🥗' },
  comforting: { label: 'Comforting', emoji: '🛋️' },
  healthy: { label: 'Healthy', emoji: '💚' },
  spicy: { label: 'Spicy', emoji: '🌶️' },
  sweet: { label: 'Sweet', emoji: '🍯' },
  savory: { label: 'Savory', emoji: '🧂' },
  chocolate: { label: 'Chocolate', emoji: '🍫' },
  fruity: { label: 'Fruity', emoji: '🍓' },
};

/** Which cravings to offer for each meal (a short list keeps it easy). */
export const CRAVINGS_FOR_MEAL: Record<MealType, Craving[]> = {
  breakfast: ['anything', 'quick', 'sweet', 'savory', 'healthy'],
  brunch: ['anything', 'sweet', 'savory', 'comforting', 'light'],
  lunch: ['anything', 'quick', 'light', 'comforting', 'spicy'],
  dinner: ['anything', 'quick', 'comforting', 'healthy', 'spicy'],
  dessert: ['anything', 'chocolate', 'fruity', 'quick', 'light'],
};

const COMFORT_TAGS = ['comfort', 'hearty', 'cheesy', 'creamy', 'rich', 'classic', 'saucy'];
const LIGHT_TAGS = ['light', 'fresh', 'salad', 'greens', 'leafy'];
const HEALTH_TAGS = ['heart-healthy', 'high-fiber', 'low-calorie', 'diabetic-friendly', 'low-sodium'];
const CHOCOLATE = /chocolate|cocoa|fudge|brownie/i;
const FRUIT = /berr|apple|banana|peach|cherry|lemon|lime|orange|pineapple|mango|pear|plum|raspberr|strawberr|blueberr/i;

function hasAnyTag(recipe: Recipe, tags: string[]) {
  const set = new Set([...recipe.tags, ...recipe.dietary].map(t => t.toLowerCase()));
  return tags.some(t => set.has(t));
}

export function matchesCraving(recipe: Recipe, craving: Craving): boolean {
  const text = `${recipe.name} ${recipe.ingredients.map(i => i.name).join(' ')}`;
  switch (craving) {
    case 'anything': return true;
    case 'quick': return getTotalTime(recipe) <= 30;
    case 'light': return hasAnyTag(recipe, LIGHT_TAGS)
      || (recipe.nutrition.calories > 0 && recipe.nutrition.calories <= 450);
    case 'comforting': return hasAnyTag(recipe, COMFORT_TAGS);
    case 'healthy': return hasAnyTag(recipe, HEALTH_TAGS)
      || (recipe.nutrition.calories > 0 && isPlateBalanced(recipe.plate));
    case 'spicy': return recipe.vibe === 'spicy';
    case 'sweet': return recipe.vibe === 'sweet';
    case 'savory': return recipe.vibe !== 'sweet';
    case 'chocolate': return CHOCOLATE.test(text);
    case 'fruity': return FRUIT.test(text);
  }
}

// ============================================
// RANKING
// ============================================

export interface DecideContext {
  mealType: MealType;
  craving: Craving;
  preferences: UserPreferences;
  pantry: PantryItem[];
  favorites: SavedRecipe[];
  history: QuizRun[];
  /** Recipes already shown and skipped this session. */
  exclude?: string[];
  /** Recipes shown or chosen before, newest first (AppContext.recipeExposure). */
  exposure?: Exposure[];
  now?: number;
  random?: () => number;
  /** false = the old ranking (top score, tiny shuffle). Only for comparisons. */
  variety?: boolean;
}

export interface Decision {
  recipe: Recipe;
  score: number;
  reasons: string[];
  pantryPercent: number | null;
}

const MIN_POOL_AFTER_CRAVING = 3;

export function rankForDecision(pool: Recipe[], ctx: DecideContext): Decision[] {
  const exclude = new Set(ctx.exclude ?? []);
  let candidates = pool.filter(r => !exclude.has(r.id));

  // The craving is a filter when enough recipes match it, otherwise a boost,
  // so answering the question never leads to an empty screen.
  const craved = candidates.filter(r => matchesCraving(r, ctx.craving));
  const cravingIsFilter = craved.length >= MIN_POOL_AFTER_CRAVING;
  if (cravingIsFilter) candidates = craved;

  const prefs = ctx.preferences;
  const favIds = new Set(ctx.favorites.map(f => f.recipeId));
  const cuisines = prefs.cuisines.map(c => c.toLowerCase());

  // What they chose for this meal before: tag counts = learned taste.
  const pastRuns = ctx.history.filter(h => h.mealType === ctx.mealType && h.chosenRecipeId);
  const learned = new Map<string, number>();
  pastRuns.forEach(h => h.tags.forEach(t => learned.set(t, (learned.get(t) ?? 0) + 1)));
  const recentPicks = new Set(ctx.history.slice(0, 5).map(h => h.chosenRecipeId).filter(Boolean) as string[]);
  const everPicked = new Set(ctx.history.map(h => h.chosenRecipeId).filter(Boolean) as string[]);

  const scored = candidates
    .map(recipe => {
      let score = 0;
      const reasons: { weight: number; text: string }[] = [];
      const total = getTotalTime(recipe);

      if (!cravingIsFilter && matchesCraving(recipe, ctx.craving)) score += 15;

      // Taste profile from onboarding
      const loves = favoriteOverlap(recipe, prefs.favoriteTags);
      const dislikes = dislikeOverlap(recipe, prefs.dislikedTags);
      score += loves * 8 - dislikes * 12;
      if (loves >= 2) reasons.push({ weight: 7, text: 'Lines up with the foods you said you love' });
      const cuisineHit = cuisines.find(c => recipe.tags.some(t => t.toLowerCase() === c));
      if (cuisineHit) {
        score += 6;
        reasons.push({ weight: 6, text: `${cuisineHit[0].toUpperCase()}${cuisineHit.slice(1)}, one of your favorite cuisines` });
      }
      // Foods they told us they love (Profile)
      const loved = lovedFoodsIn(recipe, prefs);
      if (loved.length > 0) {
        score += Math.min(16, loved.length * 8);
        reasons.push({ weight: 8, text: `Has ${loved.slice(0, 2).join(' and ')}, which you love` });
      }

      if (recipe.vibe === 'spicy') {
        if (prefs.spiceTolerance === 'mild') score -= 15;
        if (prefs.spiceTolerance === 'hot') { score += 8; reasons.push({ weight: 4, text: 'Has the heat you like' }); }
      }

      // Pantry
      let pantryPercent: number | null = null;
      if (ctx.pantry.length > 0) {
        const cov = getPantryCoverage(recipe, ctx.pantry);
        pantryPercent = cov.percent;
        score += cov.percent * 0.3;
        const need = cov.have.length + cov.missing.length;
        if (cov.missing.length === 0) reasons.push({ weight: 10, text: 'You have everything for it already' });
        else if (cov.percent >= 60) reasons.push({ weight: 8, text: `You already have ${cov.have.length} of ${need} ingredients` });
      }

      // Time
      if (total <= 30) {
        score += ctx.mealType === 'breakfast' || ctx.mealType === 'lunch' ? 8 : 4;
        reasons.push({ weight: 5, text: `Ready in ${total} minutes` });
      }
      if (prefs.preferredDifficulty && recipe.difficulty === prefs.preferredDifficulty) score += 5;

      // History: learned taste, no repeats
      const learnedHits = recipe.tags.reduce((n, t) => n + (learned.get(t) ?? 0), 0);
      if (learnedHits > 0) {
        // Capped low so past picks nudge rather than lock in the same dishes.
        score += Math.min(8, learnedHits * 2);
        if (learnedHits >= 3) reasons.push({ weight: 6, text: `Like the ${ctx.mealType}s you usually pick` });
      }
      if (recentPicks.has(recipe.id)) score -= 25;
      else if (!everPicked.has(recipe.id) && pastRuns.length >= 3) reasons.push({ weight: 2, text: 'Something new for you' });

      // Hearts
      if (favIds.has(recipe.id)) {
        score += 6;
        reasons.push({ weight: 7, text: "One of your favorites" });
      }
      const saves = recipe.favoriteCount ?? 0;
      if (saves > 0) {
        score += Math.min(10, Math.log2(1 + saves) * 3);
        if (saves >= 3) reasons.push({ weight: 5, text: `Saved by ${saves} BiteWise cooks` });
      }
      if (recipe.source === 'community' && recipe.authorName) {
        reasons.push({ weight: 3, text: `A home recipe from ${recipe.authorName}` });
      }

      // Balanced plate (meals only, not dessert)
      if (ctx.mealType !== 'dessert' && recipe.nutrition.calories > 0 && isPlateBalanced(recipe.plate)) {
        score += 4;
        reasons.push({ weight: 4, text: 'A balanced plate' });
      }
      if (!recipe.source || recipe.source === 'bitewise') score += 3;   // hand-checked recipes

      if (ctx.variety === false) score += Math.random() * 4; // old behaviour
      else score -= recencyPenalty(recipe.id, ctx.exposure ?? [], ctx.now);

      return {
        recipe,
        score,
        pantryPercent,
        reasons: reasons.sort((a, b) => b.weight - a.weight).slice(0, 3).map(r => r.text),
      };
    });

  if (ctx.variety === false) return scored.sort((a, b) => b.score - a.score);
  return drawOrder(scored, d => d.score, d => d.recipe, { temperature: 5, diverseCount: 8, random: ctx.random });
}
