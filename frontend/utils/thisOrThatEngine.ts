// utils/thisOrThatEngine.ts
//
// Scoring logic for the This or That game.
//
// Skip algorithm (per team discussion 7/24):
//   - A skip contributes NO tags and is NOT counted toward the
//     answered total. This keeps skipped questions from diluting
//     the match — a skip is treated as "no signal" rather than a
//     negative vote.
//   - If skipping would leave zero answered questions, matching
//     falls back to showing top-rated / most popular recipes
//     (wire this into your existing recipes.ts sort).
//   - Skipped questions are tracked separately so you can re-offer
//     them later if you want a "finish the round" nudge — that hook
//     is included below (getSkippedQuestions) but not wired to UI.

import { ThisOrThatQuestion } from '../data/thisOrThatData';

export interface RoundAnswer {
  questionId: string;
  category: string;
  skipped: boolean;
  chosenTags: string[];
}

export interface RoundState {
  answers: RoundAnswer[];
}

export function createRoundState(): RoundState {
  return { answers: [] };
}

export function recordAnswer(
  state: RoundState,
  question: ThisOrThatQuestion,
  choice: 'A' | 'B' | 'SKIP'
): RoundState {
  const skipped = choice === 'SKIP';
  const chosenTags = skipped
    ? []
    : choice === 'A'
    ? question.optionA.tags
    : question.optionB.tags;

  return {
    answers: [
      ...state.answers,
      { questionId: question.id, category: question.category, skipped, chosenTags },
    ],
  };
}

export function getAnsweredCount(state: RoundState): number {
  return state.answers.filter((a) => !a.skipped).length;
}

export function getSkippedQuestions(state: RoundState): RoundAnswer[] {
  return state.answers.filter((a) => a.skipped);
}

// Flatten every non-skipped tag collected across the round.
export function collectPreferenceTags(state: RoundState): string[] {
  return state.answers.filter((a) => !a.skipped).flatMap((a) => a.chosenTags);
}

// --- Recipe scoring ---
// Fraction of a recipe's tags that overlap with the collected
// preference tags. A recipe needs to clear the 70% threshold
// (per team decision on meal match) to be shown.

export interface ScorableRecipe {
  id: string | number;
  name: string;
  tags: string[];
}

export interface ScoredRecipe {
  recipe: ScorableRecipe;
  score: number; // 0–1
}

const MATCH_THRESHOLD = 0.7;

export function scoreRecipes(
  recipes: ScorableRecipe[],
  preferenceTags: string[]
): ScoredRecipe[] {
  if (preferenceTags.length === 0) {
    // Nothing answered (all skipped) — no scoring signal.
    // Caller should fall back to a default sort (e.g. popularity).
    return [];
  }

  const prefSet = new Set(preferenceTags.map((t) => t.toLowerCase()));

  return recipes
    .map((recipe) => {
      const recipeTags = recipe.tags.map((t) => t.toLowerCase());
      const overlap = recipeTags.filter((t) => prefSet.has(t)).length;
      const score = recipeTags.length === 0 ? 0 : overlap / recipeTags.length;
      return { recipe, score };
    })
    .filter((r) => r.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}
