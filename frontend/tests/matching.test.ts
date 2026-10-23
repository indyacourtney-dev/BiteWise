import { passesDietaryFilter } from '../utils/matching';
import type { Recipe, UserPreferences } from '../types';

const basePreferences: UserPreferences = {
  name: 'Test User',
  dietary: [],
  avoidAllergens: [],
  maxCookMinutes: null,
  preferredDifficulty: null,
  householdSize: 1,
  favoriteTags: [],
  dislikedTags: [],
  spiceTolerance: null,
  cuisines: [],
  customAllergies: [],
  customAvoid: [],
  customLoves: [],
  allowAlcohol: true,
};

const baseRecipe: Recipe = {
  id: 'test-recipe',
  name: 'Test Recipe',
  emoji: '🍝',
  tags: [],
  vibe: 'savory',
  plate: {
    produce: 50,
    protein: 25,
    carbs: 25,
    healthyFats: 8,
  },
  nutrition: {
    calories: 500,
    protein: 25,
    carbs: 50,
    totalFat: 20,
    healthyFat: 10,
  },
  prepMinutes: 10,
  cookMinutes: 20,
  servings: 2,
  difficulty: 'easy',
  ingredients: [],
  instructions: [],
  dietary: [],
  allergens: [],
  allergensVerified: true,
};

describe('passesDietaryFilter', () => {
  test('allows a recipe when there are no dietary or allergen conflicts', () => {
    const result = passesDietaryFilter(
      baseRecipe,
      basePreferences
    );

    expect(result).toBe(true);
  });

  test('rejects a recipe containing an allergen the user avoids', () => {
    const recipe: Recipe = {
      ...baseRecipe,
      allergens: ['peanuts'],
    };

    const preferences: UserPreferences = {
      ...basePreferences,
      avoidAllergens: ['peanuts'],
    };

    const result = passesDietaryFilter(recipe, preferences);

    expect(result).toBe(false);
  });

  test('allows a recipe when it does not contain an avoided allergen', () => {
    const recipe: Recipe = {
      ...baseRecipe,
      allergens: ['dairy'],
    };

    const preferences: UserPreferences = {
      ...basePreferences,
      avoidAllergens: ['peanuts'],
    };

    const result = passesDietaryFilter(recipe, preferences);

    expect(result).toBe(true);
  });

  test('rejects a recipe when an avoided allergen appears in mayContain', () => {
    const recipe: Recipe = {
      ...baseRecipe,
      allergens: [],
      mayContain: ['peanuts'],
    };

    const preferences: UserPreferences = {
      ...basePreferences,
      avoidAllergens: ['peanuts'],
    };

    const result = passesDietaryFilter(recipe, preferences);

    expect(result).toBe(false);
  });

  test('rejects a recipe when allergens are not verified and the user has allergen restrictions', () => {
    const recipe: Recipe = {
      ...baseRecipe,
      allergens: [],
      allergensVerified: false,
    };

    const preferences: UserPreferences = {
      ...basePreferences,
      avoidAllergens: ['peanuts'],
    };

    const result = passesDietaryFilter(recipe, preferences);

    expect(result).toBe(false);
  });

  test('allows a recipe that satisfies the users dietary preference', () => {
    const recipe: Recipe = {
      ...baseRecipe,
      dietary: ['vegetarian'],
    };

    const preferences: UserPreferences = {
      ...basePreferences,
      dietary: ['vegetarian'],
    };

    const result = passesDietaryFilter(recipe, preferences);

    expect(result).toBe(true);
  });

  test('rejects a recipe that does not satisfy the users dietary preference', () => {
    const recipe: Recipe = {
      ...baseRecipe,
      dietary: ['vegetarian'],
    };

    const preferences: UserPreferences = {
      ...basePreferences,
      dietary: ['vegan'],
    };

    const result = passesDietaryFilter(recipe, preferences);

    expect(result).toBe(false);
  });

  test('rejects a recipe that conflicts with a custom allergy', () => {
    const recipe: Recipe = {
      ...baseRecipe,
      name: 'Strawberry Smoothie',
      ingredients: [
        {
          name: 'kiwi',
          amount: '1',
          category: 'produce',
        },
      ],
    };

    const preferences: UserPreferences = {
      ...basePreferences,
      customAllergies: ['kiwi'],
    };

    const result = passesDietaryFilter(recipe, preferences);

    expect(result).toBe(false);
  });

  test('rejects a recipe containing a custom food the user wants to avoid', () => {
    const recipe: Recipe = {
      ...baseRecipe,
      name: 'Mushroom Pasta',
      ingredients: [
        {
          name: 'mushrooms',
          amount: '1 cup',
          category: 'produce',
        },
      ],
    };

    const preferences: UserPreferences = {
      ...basePreferences,
      customAvoid: ['mushrooms'],
    };

    const result = passesDietaryFilter(recipe, preferences);

    expect(result).toBe(false);
  });

  test('rejects a recipe that exceeds the users maximum cooking time', () => {
    const recipe: Recipe = {
      ...baseRecipe,
      prepMinutes: 20,
      cookMinutes: 30,
    };

    const preferences: UserPreferences = {
      ...basePreferences,
      maxCookMinutes: 40,
    };

    const result = passesDietaryFilter(recipe, preferences);

    expect(result).toBe(false);
  });
});