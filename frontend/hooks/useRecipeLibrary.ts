// hooks/useRecipeLibrary.ts
//
// The recipes a screen can suggest for one meal: the curated recipes in
// constants/recipes.ts that suit it, plus a pool from Supabase (imported
// and community recipes) filtered by the user's allergies and diets.
//
// Offline or without Supabase keys it quietly falls back to the curated
// recipes, so every screen keeps working.
//
// Pools are cached per meal + preferences for the session, so moving
// between screens doesn't refetch.

import { useEffect, useMemo, useState } from 'react';

import { RECIPES } from '../constants/recipes';
import { fetchCandidateRecipes } from '../lib/recipesApi';
import { passesDietaryFilter } from '../utils/matching';
import { suitsMeal } from '../utils/meals';
import type { MealType, Recipe, UserPreferences } from '../types';

const cache = new Map<string, Recipe[]>();
const REMOTE_POOL_SIZE = 200;

export function clearRecipeLibraryCache() {
  cache.clear();
}

export function useRecipeLibrary(mealType: MealType, preferences: UserPreferences) {
  const key = JSON.stringify([mealType, preferences.dietary, preferences.avoidAllergens]);
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
    fetchCandidateRecipes({
      mealType,
      dietary: preferences.dietary,
      excludeAllergens: preferences.avoidAllergens,
      limit: REMOTE_POOL_SIZE,
      shuffle: true,
    })
      .then(rows => {
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
