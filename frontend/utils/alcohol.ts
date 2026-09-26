// utils/alcohol.ts — does a recipe (or pantry item) contain alcohol?
//
// Used by the age safeguard: people under 21, or whose birthday isn't on
// file yet, never see recipes made with alcohol (utils/matching.ts,
// passesDietaryFilter). It errs on the careful side: cooking wines such as
// mirin, sake and Shaoxing count too.
//
// It looks at the recipe name, tags and ingredient names (and instructions,
// for the unambiguous words). Things that only sound alcoholic are removed
// first: wine/sherry/cider vinegar, ginger ale, root beer, ginger beer,
// non-alcoholic or "virgin" drinks. Flavour extracts like vanilla extract
// are allowed; they're used by the teaspoon in baking.
//
// The database keeps its own flag with the same word list
// (recipes.contains_alcohol, backend migration 20261001000000_age_safeguard.sql),
// and a recipe counts as alcoholic if EITHER says so.

import type { Recipe } from '../types';

/** Phrases that contain an alcohol word but aren't alcohol. Removed before matching. */
const NOT_ALCOHOL = [
  /\b(red |white |rice |rice wine |sherry |champagne |apple |apple cider |malt |balsamic )?(wine|cider|sherry|champagne) vinegar\b/g,
  /\bginger (ale|beer)\b/g,
  /\b(root|birch) beer\b/g,
  /\b(non[- ]?alcoholic|alcohol[- ]free|de-?alcoholi[sz]ed|zero[- ]proof|virgin)\s+[a-z]+(\s+[a-z]+)?/g,
  /\bmocktails?\b/g,
  /\b(vanilla|almond|lemon|orange|peppermint|mint|coconut|maple|rum)\s+extract\b/g,
  /\b(apple|sweet|fresh|spiced) cider\b(?! (beer|brandy))/g,
  /\bbeer[- ]?can chicken\b/g, // the can is the tool; flagged only if beer is an ingredient
];

/** Unambiguous words: safe to search for anywhere, instructions included. */
const STRONG = [
  'wine', 'wines', 'beer', 'beers', 'lager', 'vodka', 'whiskey', 'whisky', 'bourbon', 'brandy', 'cognac',
  'tequila', 'mezcal', 'vermouth', 'sherry', 'marsala', 'champagne', 'prosecco', 'liqueur', 'amaretto',
  'kahlua', 'kahlúa', 'triple sec', 'cointreau', 'grand marnier', 'schnapps', 'hard cider', 'hard seltzer',
  'bitters', 'mirin', 'shaoxing', 'kirsch', 'absinthe', 'limoncello', 'sangria', 'margarita', 'margaritas',
  'mojito', 'martini', 'daiquiri', 'mimosa', 'negroni', 'bloody mary', 'cocktail', 'cocktails', 'boozy',
  'spiked', 'port wine', 'cooking wine', 'rum', 'guinness', 'baileys', 'irish cream', 'ouzo', 'sambuca',
  'spirits', 'liquor',
];
/** Words that are only clearly alcohol as an ingredient name ("gin", "sake", "stout", "ale"). */
const INGREDIENT_ONLY = ['gin', 'sake', 'stout', 'ale', 'porter', 'soju', 'cider'];

const toRegex = (words: string[]) =>
  new RegExp(`\\b(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
const STRONG_RE = toRegex(STRONG);
const INGREDIENT_RE = toRegex([...STRONG, ...INGREDIENT_ONLY]);

function clean(text: string): string {
  let t = ` ${text.toLowerCase()} `;
  for (const re of NOT_ALCOHOL) t = t.replace(re, ' ');
  return t;
}

/** For names and ingredient names. */
export function nameMentionsAlcohol(text: string): boolean {
  return INGREDIENT_RE.test(clean(text));
}

/** For free text like instructions (skips words like "sake" that have other meanings). */
export function textMentionsAlcohol(text: string): boolean {
  return STRONG_RE.test(clean(text));
}

export function recipeHasAlcohol(
  recipe: Pick<Recipe, 'name' | 'tags' | 'ingredients'> & { instructions?: string[]; containsAlcohol?: boolean },
): boolean {
  if (recipe.containsAlcohol) return true;
  if (nameMentionsAlcohol(recipe.name)) return true;
  if (recipe.tags.some(nameMentionsAlcohol)) return true;
  if (recipe.ingredients.some(i => nameMentionsAlcohol(i.name))) return true;
  return (recipe.instructions ?? []).some(textMentionsAlcohol);
}

/** Pantry library sections that are alcohol (constants/pantryData.ts). */
const ALCOHOL_SUBCATEGORIES = new Set(['Wine & Beer', 'Spirits', 'Cooking Wine & Sake']);

export function libraryItemIsAlcohol(item: { name: string; subcategory?: string }): boolean {
  return (item.subcategory ? ALCOHOL_SUBCATEGORIES.has(item.subcategory) : false) || nameMentionsAlcohol(item.name);
}
