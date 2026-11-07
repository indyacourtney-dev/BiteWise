// utils/drinks.ts — the Drinks section's filtering and ordering.
//
// Drinks are their own section, separate from food: nothing here feeds
// meal picks, This or That or the week plan, and nothing there shows a
// drink. Two segments:
//
//   mocktails  smoothies, coffee, tea, lemonades, sodas… for everyone
//   cocktails  only for accounts whose age allows alcohol; the segment
//              simply isn't there otherwise (the app never says why).
//
// Ordering favours what the person can make right now (pantry coverage),
// then what they've saved, then what other people save most.

import { displayIngredientName, getPantryCoverage, passesDietaryFilter, type PantryCoverage } from './matching';
import type { PantryItem, Recipe, UserPreferences } from '../types';

export type DrinkSegment = 'mocktails' | 'cocktails';
export type DrinkFilter = 'pantry' | 'quick' | 'crowd';

export const DRINK_FILTERS: { id: DrinkFilter; label: string; icon: string }[] = [
  { id: 'pantry', label: 'With what I have', icon: 'check' },
  { id: 'quick', label: 'Low effort', icon: 'bolt' },
  { id: 'crowd', label: 'For a crowd', icon: 'users' },
];

/** The database flag is the source of truth; curated cocktails set it too. */
export function isCocktail(recipe: Recipe): boolean {
  return recipe.containsAlcohol === true;
}

const QUICK_MINUTES = 5;
const QUICK_INGREDIENTS = 5;
const CROWD_SERVINGS = 4;

export function isLowEffort(recipe: Recipe): boolean {
  const required = recipe.ingredients.filter(i => !i.optional).length;
  return recipe.prepMinutes + recipe.cookMinutes <= QUICK_MINUTES && required <= QUICK_INGREDIENTS;
}

export function isForACrowd(recipe: Recipe): boolean {
  return recipe.servings >= CROWD_SERVINGS || recipe.tags.some(t => t === 'pitcher' || t === 'for a crowd' || t === 'party');
}

/**
 * The drinks one segment may show this person: kind = 'drink', their
 * allergies and diets respected, and the age rule applied again on top of
 * the database's. The cooking-time limit from preferences is about meals,
 * so it isn't applied to drinks.
 */
export function drinksForSegment(drinks: Recipe[], segment: DrinkSegment, prefs: UserPreferences): Recipe[] {
  const prefsForDrinks: UserPreferences = { ...prefs, maxCookMinutes: null };
  return drinks.filter(r => {
    if (r.kind !== 'drink') return false;
    if (!passesDietaryFilter(r, prefsForDrinks)) return false;
    return segment === 'cocktails' ? isCocktail(r) : !isCocktail(r);
  });
}

export function applyDrinkFilters(drinks: Recipe[], filters: Set<DrinkFilter>, pantry: PantryItem[]): Recipe[] {
  return drinks.filter(r => {
    if (filters.has('quick') && !isLowEffort(r)) return false;
    if (filters.has('crowd') && !isForACrowd(r)) return false;
    if (filters.has('pantry')) {
      if (pantry.length === 0) return false;
      if (getPantryCoverage(r, pantry).percent < 50) return false;
    }
    return true;
  });
}

export interface RankedDrink {
  recipe: Recipe;
  coverage: PantryCoverage | null;
  /** One line under the name: time, and what's missing. */
  note: string;
  /** Short status for the right-hand pill. */
  status: { label: string; tone: 'green' | 'yellow' | 'blue' };
}

function timeLabel(recipe: Recipe): string {
  const total = recipe.prepMinutes + recipe.cookMinutes;
  const needsChill = recipe.instructions.some(s => /\bchill\b|\bfridge\b|\brefrigerat/i.test(s)) && total >= 10;
  return `${total} min${needsChill ? ' + chill' : ''}`;
}

/** The two or three ingredients that define the drink, for the card. */
export function keyIngredients(recipe: Recipe, max = 3): string {
  const skip = /^(ice|water|cold water|hot water|boiling water|sugar|simple syrup|salt|lemon slices?|lime (wedge|wheel|slices?)|orange (slice|peel)|garnish)/i;
  const names = recipe.ingredients
    .filter(i => !i.optional && !skip.test(i.name.trim()))
    .map(i => i.name.replace(/,.*$/, '').replace(/\b(fresh|chilled|coarsely ground|ripe|frozen)\b/gi, '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(names)).slice(0, max).join(' · ');
}

export function rankDrinks(drinks: Recipe[], pantry: PantryItem[], favoriteIds: string[]): RankedDrink[] {
  const favs = new Set(favoriteIds);
  const ranked = drinks.map((recipe): RankedDrink => {
    const coverage = pantry.length > 0 ? getPantryCoverage(recipe, pantry) : null;
    const time = timeLabel(recipe);
    let note: string;
    let status: RankedDrink['status'];
    if (!coverage) {
      note = `${time} · ${keyIngredients(recipe)}`;
      status = { label: isForACrowd(recipe) ? 'Pitcher' : isLowEffort(recipe) ? 'Quick' : 'Easy', tone: 'blue' };
    } else if (coverage.missing.length === 0) {
      note = `${time} · you have everything`;
      status = { label: 'Ready', tone: 'green' };
    } else if (coverage.missing.length <= 2) {
      note = `${time} · missing ${coverage.missing.map(displayIngredientName).join(' and ')}`;
      status = { label: `${coverage.missing.length} missing`, tone: 'yellow' };
    } else {
      note = `${time} · ${keyIngredients(recipe)}`;
      status = { label: `${coverage.missing.length} missing`, tone: 'blue' };
    }
    if (isForACrowd(recipe) && !note.includes('for a crowd')) note += ' · for a crowd';
    return { recipe, coverage, note, status };
  });

  ranked.sort((a, b) => {
    const ca = a.coverage?.percent ?? 0;
    const cb = b.coverage?.percent ?? 0;
    if (cb !== ca) return cb - ca;
    const fa = favs.has(a.recipe.id) ? 1 : 0;
    const fb = favs.has(b.recipe.id) ? 1 : 0;
    if (fb !== fa) return fb - fa;
    const pa = a.recipe.favoriteCount ?? 0;
    const pb = b.recipe.favoriteCount ?? 0;
    if (pb !== pa) return pb - pa;
    return a.recipe.name.localeCompare(b.recipe.name);
  });
  return ranked;
}
