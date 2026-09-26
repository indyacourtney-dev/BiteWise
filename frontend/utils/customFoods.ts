// utils/customFoods.ts
//
// Matches the foods users type in Profile ("kiwi", "mushrooms", "garlic")
// against recipes. There's no fixed list for these, so matching is by
// words in the recipe name and ingredient names:
//
//   * plurals and case don't matter: "Strawberries" matches "1 cup strawberry jam"
//   * multi-word foods match as a phrase: "bell pepper"
//   * ALLERGIES are stricter: a single word also matches inside longer words,
//     so "berry" catches "strawberry" and "blueberry". Hiding one extra
//     recipe is fine; missing an allergen is not.
//
// This can't see hidden ingredients the way the standard allergen list can
// (e.g. cinnamon inside "pumpkin pie spice"), which is why recipes with any
// unrecognised ingredient are also hidden from users with custom allergies,
// and the Profile screen reminds people to check labels.

import type { Recipe, UserPreferences } from '../types';

function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (/(ches|shes|xes|sses|zes|oes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !/(ss|us)$/.test(w)) return w.slice(0, -1);
  return w;
}

export function foodWords(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')      // jalapeño -> jalapeno
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(singular);
}

/** Tidy what the user typed: trimmed, single spaces, no trailing punctuation. */
export function cleanFoodEntry(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/^[\s,.;]+|[\s,.;]+$/g, '').slice(0, 40);
}

// "Mushroom-less medley", "dairy-free cheese", "no nuts", "without onions"
// say the food is NOT there, so those phrases don't count as mentions.
// (The ingredient list is still checked, so a real mushroom is still caught.)
const ABSENCE_RE = /\b[a-z]+(?:[\s-]+[a-z]+)?-(?:less|free)\b|\b(?:no|without|minus)\s+[a-z]+(?:\s+[a-z]+)?/gi;
const withoutAbsences = (text: string) => text.replace(ABSENCE_RE, ' ');

const recipeWordsCache = new WeakMap<Recipe, string[]>();
function recipeWords(recipe: Recipe): string[] {
  let words = recipeWordsCache.get(recipe);
  if (!words) {
    words = foodWords(withoutAbsences([recipe.name, ...recipe.ingredients.map(i => i.name)].join(' | ')));
    recipeWordsCache.set(recipe, words);
  }
  return words;
}

function mentions(words: string[], term: string, strict: boolean): boolean {
  const t = foodWords(term);
  if (t.length === 0) return false;
  if (t.length === 1) {
    const [w] = t;
    return words.some(x => x === w || (strict && w.length >= 3 && x.endsWith(w)));
  }
  for (let i = 0; i + t.length <= words.length; i++) {
    if (t.every((w, j) => words[i + j] === w)) return true;
  }
  return false;
}

export interface CustomConflicts {
  /** Custom allergies this recipe mentions. */
  allergies: string[];
  /** Foods-to-avoid this recipe mentions. */
  avoid: string[];
}

export function findCustomConflicts(recipe: Recipe, prefs: Pick<UserPreferences, 'customAllergies' | 'customAvoid'>): CustomConflicts {
  const words = recipeWords(recipe);
  return {
    allergies: (prefs.customAllergies ?? []).filter(a => mentions(words, a, true)),
    avoid: (prefs.customAvoid ?? []).filter(a => mentions(words, a, false)),
  };
}

/** Loved foods this recipe contains (for boosting and "why this one"). */
export function lovedFoodsIn(recipe: Recipe, prefs: Pick<UserPreferences, 'customLoves'>): string[] {
  const words = recipeWords(recipe);
  return (prefs.customLoves ?? []).filter(l => mentions(words, l, false));
}
