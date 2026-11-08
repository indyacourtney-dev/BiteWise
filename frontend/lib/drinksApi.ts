// lib/drinksApi.ts
//
// The Drinks section's pool: every kind = 'drink' recipe the account is
// allowed to see, merged with the curated starter set so the screen works
// offline. Cocktails (contains_alcohol) are also kept out at the database
// level for accounts whose age doesn't allow them; the app filters again
// (utils/matching.ts ageAllowsRecipe) so nothing depends on one layer.

import { CURATED_DRINKS } from '../constants/drinks';
import { DRINK_EMOJI } from '../utils/drinks';
import { fetchCandidateRecipes } from './recipesApi';
import { configured } from './supabase';
import type { Recipe } from '../types';

let cache: Recipe[] | null = null;

export function clearDrinksCache() {
  cache = null;
}

/** Curated + database drinks, de-duplicated by id (database copy wins). */
export async function fetchDrinks(): Promise<Recipe[]> {
  if (cache) return cache;
  let remote: Recipe[] = [];
  if (configured) {
    try {
      remote = await fetchCandidateRecipes({ kind: 'drink', limit: 400, shuffle: false });
    } catch {
      remote = [];
    }
  }
  const byId = new Map<string, Recipe>();
  // One glass for every drink (the database rows already come through
  // rowToRecipe with it; the curated set keeps its emojis for seeding).
  for (const r of CURATED_DRINKS) byId.set(r.id, { ...r, emoji: DRINK_EMOJI });
  for (const r of remote) byId.set(r.id, r);
  cache = Array.from(byId.values());
  return cache;
}
