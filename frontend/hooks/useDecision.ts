// hooks/useDecision.ts
//
// One pick at a time, shared by Home ("Tonight's pick") and Pick for me
// (app/decide.tsx). Wraps the ranking in utils/decide.ts with the state a
// screen needs around it: the candidate pool, your star-rating feedback,
// what you've skipped this round, and the bookkeeping when you lock one in.
//
//   const d = useDecision({ mealType, craving });
//   d.pick            the current suggestion (null while loading / none fit)
//   d.skip()          "Not tonight" → next best; counts as shown for variety
//   d.lockIn()        "Let's make this" → recorded in history, returns the recipe
//   d.restart(c)      new round (optionally with a new craving)
//
// `noteShown`: Pick for me logs every card it shows so tomorrow's picks
// differ. Home leaves it off, so simply opening the app doesn't "use up" a
// suggestion — only Swap (skip) and Cook (lock in) count there.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useApp } from '../context/AppContext';
import { useRecipeLibrary } from './useRecipeLibrary';
import { configured } from '../lib/supabase';
import { fetchMyRatingFeedback } from '../lib/reviewsApi';
import { rankForDecision, type Craving, type Decision } from '../utils/decide';
import { ageOn } from '../utils/age';
import { goalForMeal } from '../utils/goals';
import type { MealType, RecipeRatingFeedback } from '../types';

export interface UseDecisionOptions {
  mealType: MealType;
  craving: Craving;
  /** false = don't rank yet (e.g. still on the question screen). */
  active?: boolean;
  /** Log every shown pick to the variety memory. Default true. */
  noteShown?: boolean;
}

// Shared across hook instances for the session: Home and Decide both need it
// and it rarely changes.
let ratingCache: RecipeRatingFeedback[] | null = null;

export function useDecision({ mealType, craving, active = true, noteShown = true }: UseDecisionOptions) {
  const {
    preferences, pantry, favorites, history, recordQuizRun, recipeExposure, noteRecipesShown, birthDate,
  } = useApp();
  const { recipes, loading, error } = useRecipeLibrary(mealType, preferences);

  const [ratings, setRatings] = useState<RecipeRatingFeedback[]>(ratingCache ?? []);
  const [ratingsLoading, setRatingsLoading] = useState(configured && ratingCache === null);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  useEffect(() => {
    if (!configured || ratingCache !== null) return;
    let cancelled = false;
    fetchMyRatingFeedback()
      .then(rows => {
        ratingCache = rows;
        if (!cancelled) setRatings(rows);
      })
      .catch(e => {
        if (!cancelled) setRatingsError(e instanceof Error ? e.message : 'Could not load your review preferences.');
      })
      .finally(() => {
        if (!cancelled) setRatingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [skipped, setSkipped] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  // Snapshot of the variety memory when the round started, so logging a
  // shown pick doesn't reshuffle the card you're looking at.
  const exposureAtStart = useRef(recipeExposure);

  const ranked: Decision[] = useMemo(
    () =>
      active
        ? rankForDecision(recipes, {
            mealType, craving, preferences, pantry, favorites, history,
            ratings, exposure: exposureAtStart.current,
            goal: goalForMeal(preferences.goals, birthDate ? ageOn(birthDate) : null, mealType),
          })
        : [],
    // history/favorites left out on purpose: re-ranking while a pick is on
    // screen (after tapping the heart, say) would swap the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, round, recipes, mealType, craving, preferences, pantry, ratings, birthDate]
  );
  const remaining = useMemo(() => ranked.filter(d => !skipped.includes(d.recipe.id)), [ranked, skipped]);
  const pick = remaining[0] ?? null;

  useEffect(() => {
    if (noteShown && active && pick) noteRecipesShown([pick.recipe.id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteShown, active, pick?.recipe.id]);

  const restart = useCallback(() => {
    exposureAtStart.current = recipeExposure;
    setRound(r => r + 1);
    setSkipped([]);
  }, [recipeExposure]);

  // A new meal means a new round.
  useEffect(() => {
    setSkipped([]);
  }, [mealType, craving]);

  const skip = useCallback(() => {
    if (!pick) return;
    if (!noteShown) noteRecipesShown([pick.recipe.id]); // Home: a swap counts as shown
    setSkipped(prev => [...prev, pick.recipe.id]);
  }, [pick, noteShown, noteRecipesShown]);

  const lockIn = useCallback((d: Decision = pick!, mode: 'decide' | 'pantry' = 'decide') => {
    if (!d) return null;
    noteRecipesShown([d.recipe.id], true);
    recordQuizRun({
      mode,
      mealType,
      chosenRecipeId: d.recipe.id,
      vibe: null,
      tags: d.recipe.tags,
      topRecipeIds: remaining.slice(0, 3).map(x => x.recipe.id),
    });
    return d.recipe;
  }, [pick, remaining, mealType, noteRecipesShown, recordQuizRun]);

  return {
    pick,
    remaining,
    skipped,
    skip,
    restart,
    lockIn,
    loading: loading || ratingsLoading,
    poolEmpty: !loading && recipes.length === 0,
    error: error ?? ratingsError,
    recipes,
  };
}
