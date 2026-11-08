// hooks/useRecipeLibrary.ts
//
// The recipes a screen can suggest for one meal: the curated recipes in
// constants/recipes.ts that suit it, plus a pool from Supabase (imported
// and community recipes) filtered by the user's allergies and diets.
//
// The pool is three slices, so the user's tastes and goals actually show
// up in it:
//   * a random slice of everything that passes the hard filters (variety)
//   * a slice that overlaps the "foods you enjoy" tags from onboarding
//   * a slice that carries at least one of their eating goals
//     (heart-healthy, low-sodium…) — goals are favored in ranking, never
//     required, see utils/diets.ts
// With 120k+ recipes, a purely random 200 rarely contained anything the
// user said they love, so Decide for me and Plan my week couldn't act on it.
//
// Offline or without Supabase keys it quietly falls back to the curated
// recipes, so every screen keeps working.
//
// Pools are cached per meal + preferences for the session, so moving
// between screens doesn't refetch.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { RECIPES } from '../constants/recipes';
import { fetchCandidateRecipes } from '../lib/recipesApi';
import { dietGoals, dietRules } from '../utils/diets';
import { expandAllergens, passesDietaryFilter } from '../utils/matching';
import { suitsMeal } from '../utils/meals';
import type { MealType, Recipe, UserPreferences } from '../types';

const cache = new Map<string, Recipe[]>();
const RANDOM_POOL_SIZE = 300;
const TASTE_POOL_SIZE = 150;
const GOAL_POOL_SIZE = 200;
/** Each "load more" appends another random slice of this size. */
const MORE_POOL_SIZE = 300;

export function clearRecipeLibraryCache() {
  cache.clear();
}

/** The two pool queries for a meal + preferences (exported for tests). */
export function poolFilters(mealType: MealType, preferences: UserPreferences) {
  const base = {
    mealType,
    // Only diet RULES filter on the server; eating GOALS get their own slice.
    dietary: dietRules(preferences),
    excludeAllergens: expandAllergens(preferences.avoidAllergens),
    // Cook time alone is a safe pre-filter on the server; the exact
    // prep + cook check still happens in passesDietaryFilter.
    maxTotalMinutes: preferences.maxCookMinutes,
    shuffle: true as const,
  };
  const tasteTags = preferences.favoriteTags ?? [];
  const goals = dietGoals(preferences);
  return {
    random: { ...base, limit: RANDOM_POOL_SIZE },
    taste: tasteTags.length > 0 ? { ...base, tags: tasteTags, limit: TASTE_POOL_SIZE } : null,
    goal: goals.length > 0 ? { ...base, dietaryAny: goals, limit: GOAL_POOL_SIZE } : null,
  };
}

/** Curated recipes for the meal + the remote pool, through the same hard filter every screen uses. */
function buildLibrary(remote: Recipe[], mealType: MealType, preferences: UserPreferences): Recipe[] {
  const local = RECIPES.filter(r => suitsMeal(r, mealType));
  const localIds = new Set(local.map(r => r.id));
  // Curated recipes are also in Supabase; prefer the local copy.
  const merged = [...local, ...remote.filter(r => !localIds.has(r.id) && suitsMeal(r, mealType))];
  // Allergens, diet rules, time limit (utils/matching.ts).
  return merged.filter(r => passesDietaryFilter(r, preferences));
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
    const { random, taste, goal } = poolFilters(mealType, preferences);
    const none = Promise.resolve([] as Recipe[]);
    Promise.all([
      fetchCandidateRecipes(random),
      // The taste and goal slices are bonuses: if one fails, the random slice still loads.
      taste ? fetchCandidateRecipes(taste).catch(() => [] as Recipe[]) : none,
      goal ? fetchCandidateRecipes(goal).catch(() => [] as Recipe[]) : none,
    ])
      .then(([randomRows, tasteRows, goalRows]) => {
        const seen = new Set<string>();
        const rows = [...goalRows, ...tasteRows, ...randomRows].filter(r => !seen.has(r.id) && seen.add(r.id));
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

  /**
   * Pull another random slice of the whole database into this pool (a new
   * random offset each time), so "show me more" really is more — the app
   * can reach every recipe, just not all at once. Resolves to how many new
   * recipes arrived (0 offline or when the pool is exhausted).
   */
  const loadMore = useCallback(async (): Promise<{ added: number; recipes: Recipe[] }> => {
    const { random } = poolFilters(mealType, preferences);
    const current = cache.get(key) ?? [];
    let rows: Recipe[] = [];
    try {
      rows = await fetchCandidateRecipes({ ...random, limit: MORE_POOL_SIZE });
    } catch {
      return { added: 0, recipes: buildLibrary(current, mealType, preferences) };
    }
    const seen = new Set(current.map(r => r.id));
    const fresh = rows.filter(r => !seen.has(r.id));
    const merged = fresh.length ? [...current, ...fresh] : current;
    if (fresh.length) {
      cache.set(key, merged);
      setRemote(merged);
    }
    return { added: fresh.length, recipes: buildLibrary(merged, mealType, preferences) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const recipes = useMemo(() => buildLibrary(remote, mealType, preferences), [remote, mealType, preferences]);

  return { recipes, loading, error, loadMore };
}
