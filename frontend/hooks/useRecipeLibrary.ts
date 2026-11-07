// hooks/useRecipeLibrary.ts
//
// The recipes a screen can suggest for one meal: the curated recipes in
// constants/recipes.ts that suit it, plus a pool from Supabase (imported
// and community recipes) filtered by the user's allergies and diets.
//
// The pool is two slices, so the user's tastes actually show up in it:
//   * a random slice of everything that passes the hard filters (variety)
//   * a slice that overlaps the "foods you enjoy" tags from onboarding
// With 120k+ recipes, a purely random 200 rarely contained anything the
// user said they love, so Decide for me and Plan my week couldn't act on it.
//
// Offline or without Supabase keys it quietly falls back to the curated
// recipes, so every screen keeps working.
//
// Pools are cached per meal + preferences for the session, so moving
// between screens doesn't refetch.

import { useEffect, useMemo, useState } from 'react';

import { RECIPES } from '../constants/recipes';
import { fetchCandidateRecipes } from '../lib/recipesApi';
import { expandAllergens, passesDietaryFilter } from '../utils/matching';
import { suitsMeal } from '../utils/meals';
import type { MealType, Recipe, UserPreferences } from '../types';

const cache = new Map<string, Recipe[]>();
const RANDOM_POOL_SIZE = 160;
const TASTE_POOL_SIZE = 120;

export function clearRecipeLibraryCache() {
  cache.clear();
}

/** The two pool queries for a meal + preferences (exported for tests). */
export function poolFilters(mealType: MealType, preferences: UserPreferences) {
  const base = {
    mealType,
    dietary: preferences.dietary,
    excludeAllergens: expandAllergens(preferences.avoidAllergens),
    // Cook time alone is a safe pre-filter on the server; the exact
    // prep + cook check still happens in passesDietaryFilter.
    maxTotalMinutes: preferences.maxCookMinutes,
    shuffle: true as const,
  };
  const tasteTags = preferences.favoriteTags ?? [];
  return {
    random: { ...base, limit: RANDOM_POOL_SIZE },
    taste: tasteTags.length > 0 ? { ...base, tags: tasteTags, limit: TASTE_POOL_SIZE } : null,
  };
}

export function useRecipeLibrary(mealType: MealType, preferences: UserPreferences) {
  const key = JSON.stringify([
    mealType,
    preferences.dietary,
    preferences.avoidAllergens,
    preferences.maxCookMinutes,
    preferences.favoriteTags,
  ]);
  const [remote, setRemote] = useState<Recipe[]>(() => cache.get(key) ?? []);
  const [loading, setLoading] = useState(!cache.has(key));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (cache.has(key)) {
      setRemote(cache.get(key)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { random, taste } = poolFilters(mealType, preferences);
    Promise.all([
      fetchCandidateRecipes(random),
      // The taste slice is a bonus: if it fails, the random slice still loads.
      taste ? fetchCandidateRecipes(taste).catch(() => [] as Recipe[]) : Promise.resolve([] as Recipe[]),
    ])
      .then(([randomRows, tasteRows]) => {
        const seen = new Set<string>();
        const rows = [...tasteRows, ...randomRows].filter(r => !seen.has(r.id) && seen.add(r.id));
        cache.set(key, rows);
        if (!cancelled) {
          setRemote(rows);
          setError(null);
        }
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load recipes');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // key captures mealType + the preference fields that change the query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const recipes = useMemo(() => {
    const local = RECIPES.filter(r => suitsMeal(r, mealType));
    const localIds = new Set(local.map(r => r.id));
    // Curated recipes are also in Supabase; prefer the local copy.
    const merged = [...local, ...remote.filter(r => !localIds.has(r.id) && suitsMeal(r, mealType))];
    // Same hard filter every screen uses (allergens, diets, time limit).
    return merged.filter(r => passesDietaryFilter(r, preferences));
  }, [remote, mealType, preferences]);

  return { recipes, loading, error };
}
