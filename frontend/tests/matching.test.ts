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
  // An empty list can't be checked, so the safety check holds it for review.
  ingredients: [{ name: 'rice', amount: '1 cup', category: 'grains' }],
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
describe('pantryHas — whole words, not substrings', () => {
  const { pantryHas, itemCoversIngredient } = require('../utils/matching');
  const item = (name: string, quantity = 1) => ({ id: name, name, quantity, unit: 'Items', category: 'other', icon: '•', addedAt: 0 });

  it('matches across plurals, extra words and modifiers', () => {
    expect(itemCoversIngredient('Chicken Breast', 'chicken')).toBe(true);
    expect(itemCoversIngredient('Eggs', 'large egg')).toBe(true);
    expect(itemCoversIngredient('Olive Oil', 'extra virgin olive oil')).toBe(true);
    expect(itemCoversIngredient('Tomato', 'tomatoes, diced')).toBe(true);
    expect(itemCoversIngredient('Lemon', 'fresh lemon juice')).toBe(true);
    expect(itemCoversIngredient('Garlic', 'garlic cloves')).toBe(true);
    expect(itemCoversIngredient('Milk', 'milk of your choice')).toBe(true);
  });

  it('does not match inside other words or different products', () => {
    expect(itemCoversIngredient('Ice', 'fresh lime juice')).toBe(false);
    expect(itemCoversIngredient('Ice', 'rice')).toBe(false);
    expect(itemCoversIngredient('Ice', 'milk of your choice')).toBe(false);
    expect(itemCoversIngredient('Black Beans', 'green beans')).toBe(false);
    expect(itemCoversIngredient('Garlic', 'garlic powder')).toBe(false);
    expect(itemCoversIngredient('Rice', 'rice vinegar')).toBe(false);
    expect(itemCoversIngredient('Chicken', 'chicken stock')).toBe(false);
    expect(itemCoversIngredient('Coconut', 'coconut milk')).toBe(false);
  });

  it('ignores items that are out (quantity 0)', () => {
    expect(pantryHas([item('Eggs', 0)], 'egg')).toBe(false);
    expect(pantryHas([item('Eggs', 2)], 'egg')).toBe(true);
  });
});

describe('pantryHas — a more specific pantry item is not a plainer ingredient', () => {
  const { itemCoversIngredient } = require('../utils/matching');
  it('ginger ale is not ginger; peanut butter is not peanuts', () => {
    expect(itemCoversIngredient('Ginger Ale', 'ground ginger')).toBe(false);
    expect(itemCoversIngredient('Ginger', 'ground ginger')).toBe(true);
    expect(itemCoversIngredient('Coconut Milk', 'coconut')).toBe(false);
  });
});

describe('pantry coverage — staples and display names', () => {
  const { displayIngredientName, isAlwaysOnHand } = require('../utils/matching');
  it('water and ice are always on hand; ice cream is not', () => {
    expect(isAlwaysOnHand('cold water')).toBe(true);
    expect(isAlwaysOnHand('ice')).toBe(true);
    expect(isAlwaysOnHand('vanilla ice cream')).toBe(false);
  });
  it('shows ingredients the way a person says them', () => {
    expect(displayIngredientName('cucumber, thinly sliced')).toBe('cucumber');
    expect(displayIngredientName('seedless watermelon, cubed')).toBe('watermelon');
    expect(displayIngredientName('fresh lime juice')).toBe('lime juice');
    expect(displayIngredientName('Greek yogurt')).toBe('greek yogurt');
  });
});
