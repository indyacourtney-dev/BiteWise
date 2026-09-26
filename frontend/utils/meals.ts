// utils/meals.ts
//
// Everything about "which meal are we deciding on":
// labels and emoji, a sensible default from the clock, and helpers to ask
// whether a recipe suits a meal.

import type { MealType, Recipe } from '../types';

export const MEAL_TYPES: MealType[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'dessert'];

export const MEAL_INFO: Record<MealType, { label: string; emoji: string; prompt: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🍳', prompt: 'What sounds good this morning?' },
  brunch: { label: 'Brunch', emoji: '🥞', prompt: 'Brunch time — sweet or savory?' },
  lunch: { label: 'Lunch', emoji: '🥪', prompt: "What's for lunch?" },
  dinner: { label: 'Dinner', emoji: '🍽️', prompt: "What's the vibe for dinner?" },
  dessert: { label: 'Dessert', emoji: '🍰', prompt: 'Something sweet?' },
};

/** The This-or-That and Plan-the-Week quizzes ask about protein / carbs / greens,
 *  which only make sense for these meals. */
export const QUIZ_MEAL_TYPES: MealType[] = ['lunch', 'dinner'];

/**
 * A default meal from the clock, so the app opens on the right question:
 * breakfast until 10:30 (brunch until noon on weekends), lunch until 3pm,
 * dinner until 9pm, dessert late at night.
 */
export function getMealTypeForNow(now: Date = new Date()): MealType {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  if (minutes < 4 * 60) return 'dessert';          // midnight snack
  if (minutes < 10 * 60 + 30) return 'breakfast';
  if (weekend && minutes < 13 * 60) return 'brunch';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 21 * 60) return 'dinner';
  return 'dessert';
}

/** Curated recipes without mealTypes were all written as dinners. */
export function getMealTypes(recipe: Recipe): MealType[] {
  return recipe.mealTypes?.length ? recipe.mealTypes : ['dinner'];
}

export function suitsMeal(recipe: Recipe, mealType: MealType): boolean {
  return getMealTypes(recipe).includes(mealType);
}
