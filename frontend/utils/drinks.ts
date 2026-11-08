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

// ---- what kind of drink ---------------------------------------------------
//
// The imported set says "drink" and nothing else, so the kind is read off
// the name, tags and ingredients. Mocktails group by what they are;
// cocktails by their spirit. Each drink lands in exactly one type.

export type DrinkType =
  | 'smoothie' | 'coffeeTea' | 'fizz' | 'warm' | 'pitcher' | 'juice'   // mocktails & more
  | 'gin' | 'vodka' | 'rum' | 'tequila' | 'whiskey' | 'wine' | 'other'; // cocktails

export const DRINK_TYPES: Record<DrinkSegment, { id: DrinkType; label: string; emoji: string }[]> = {
  mocktails: [
    { id: 'smoothie', label: 'Smoothies & shakes', emoji: '🥤' },
    { id: 'coffeeTea', label: 'Coffee & tea', emoji: '☕' },
    { id: 'fizz', label: 'Lemonades & sodas', emoji: '🍋' },
    { id: 'juice', label: 'Juices & coolers', emoji: '🧃' },
    { id: 'warm', label: 'Warm & cozy', emoji: '🍵' },
    { id: 'pitcher', label: 'Pitchers & punch', emoji: '🫗' },
  ],
  cocktails: [
    { id: 'gin', label: 'Gin', emoji: '🍸' },
    { id: 'vodka', label: 'Vodka', emoji: '🧊' },
    { id: 'rum', label: 'Rum', emoji: '🏝️' },
    { id: 'tequila', label: 'Tequila', emoji: '🌵' },
    { id: 'whiskey', label: 'Whiskey', emoji: '🥃' },
    { id: 'wine', label: 'Wine & bubbles', emoji: '🥂' },
    { id: 'warm', label: 'Warm', emoji: '🔥' },
    { id: 'pitcher', label: 'Pitchers & punch', emoji: '🫗' },
    { id: 'other', label: 'Other', emoji: '🍹' },
  ],
};

const text = (r: Recipe) => `${r.name} ${r.tags.join(' ')} ${r.ingredients.map(i => i.name).join(' ')}`.toLowerCase();
const nameAndTags = (r: Recipe) => `${r.name} ${r.tags.join(' ')}`.toLowerCase();

export function drinkTypeOf(recipe: Recipe): DrinkType {
  const nt = nameAndTags(recipe);
  const all = text(recipe);
  const warm = /\b(hot|warm|mulled|toddy|wassail|cider|cocoa|eggnog|egg nog|nog|golden milk|turmeric latte|steamer)\b/.test(nt)
    && !/\biced\b/.test(nt);
  if (isCocktail(recipe)) {
    if (warm) return 'warm';
    if (/\b(punch|sangria|pitcher|party|crowd)\b/.test(nt) || recipe.servings >= 6) return 'pitcher';
    if (/\b(vodka|moscow mule|cosmopolitan|cosmo|bloody mary|white russian|espresso martini)\b/.test(all)) return 'vodka';
    if (/\b(gin|negroni|tom collins|french 75|gimlet|martini)\b/.test(all)) return 'gin';
    if (/\b(rum|mojito|daiquiri|pi[nñ]a colada|mai tai|dark .n. stormy|hurricane|cachaça|cachaca|caipirinha)\b/.test(all)) return 'rum';
    if (/\b(tequila|mezcal|margarita|paloma)\b/.test(all)) return 'tequila';
    if (/\b(whiskey|whisky|bourbon|rye|scotch|old fashioned|manhattan|sour|julep|irish coffee)\b/.test(all)) return 'whiskey';
    if (/\b(wine|prosecco|champagne|sparkling wine|cava|spritz|mimosa|bellini|aperol|vermouth|sherry|port)\b/.test(all)) return 'wine';
    return 'other';
  }
  if (warm) return 'warm';
  if (/\b(juice)\b/.test(nt) && !/\b(smoothie|shake)\b/.test(nt)) return 'juice';
  if (/\b(smoothie|shake|milkshake|lassi|frapp\w*|blended|float|malt)\b/.test(nt)) return 'smoothie';
  if (/\b(coffee|espresso|latte|cappuccino|mocha|cold brew|chai|matcha|tea)\b/.test(nt)) return 'coffeeTea';
  if (/\b(punch|pitcher|party|crowd|wassail)\b/.test(nt) || recipe.servings >= 6) return 'pitcher';
  if (/\b(lemonade|limeade|soda|sparkl\w*|spritz\w*|fizz\w*|tonic|shrub|slush\w*|ginger ale|ginger beer|cooler|refresher)\b/.test(nt)) return 'fizz';
  return 'juice';
}

// ---- de-duplication --------------------------------------------------------
//
// The imported set has seven "Egg Nog"s and four "Banana Smoothie"s. One of
// each is plenty: group by a normalised name and keep the best copy
// (curated first, then most saved, then the shortest name).

const DRINK_STOP = new Set(['easy', 'best', 'classic', 'homemade', 'recipe', 'my', 'the', 'a', 'an', 'of', 'with', 'and', 'perfect',
  'simple', 'quick', 'fresh', 'favorite', 'favourite', 'grandma', "grandma's", 'mom', "mom's", 'ultimate', 'famous', 'style', 'drink', 'beverage', 'ii', 'iii', 'iv']);

export function drinkFamily(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !DRINK_STOP.has(w))
    .map(w => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, ''))
    .join(' ')
    .replace(/\begg ?nog\b/, 'eggnog');
}

export function dedupeDrinks(drinks: Recipe[]): Recipe[] {
  const best = new Map<string, Recipe>();
  const rank = (r: Recipe) => (r.source === 'bitewise' ? 1_000_000 : 0) + (r.favoriteCount ?? 0) * 10 - r.name.length / 100;
  for (const r of drinks) {
    // Cocktail and mocktail versions of the same drink are different drinks.
    const key = `${isCocktail(r) ? 'c' : 'm'}:${drinkFamily(r.name)}`;
    const cur = best.get(key);
    if (!cur || rank(r) > rank(cur)) best.set(key, r);
  }
  return Array.from(best.values());
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
  return dedupeDrinks(drinks.filter(r => {
    if (r.kind !== 'drink') return false;
    if (!passesDietaryFilter(r, prefsForDrinks)) return false;
    return segment === 'cocktails' ? isCocktail(r) : !isCocktail(r);
  }));
}

/** How many drinks of each type are in a pool (for the type chips). */
export function countByType(drinks: Recipe[]): Partial<Record<DrinkType, number>> {
  const out: Partial<Record<DrinkType, number>> = {};
  for (const r of drinks) { const t = drinkTypeOf(r); out[t] = (out[t] ?? 0) + 1; }
  return out;
}

export function applyDrinkFilters(drinks: Recipe[], filters: Set<DrinkFilter>, pantry: PantryItem[], type: DrinkType | null = null): Recipe[] {
  return drinks.filter(r => {
    if (type && drinkTypeOf(r) !== type) return false;
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
