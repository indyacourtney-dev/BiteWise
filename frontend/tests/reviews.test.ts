import { describe, expect, it, jest } from '@jest/globals';
import { RECIPES } from '../constants/recipes';
import { rankForDecision } from '../utils/decide';
import type { Recipe, RecipeRatingFeedback, UserPreferences } from '../types';

const preferences: UserPreferences = {
  name: 'Test cook',
  dietary: [],
  avoidAllergens: [],
  maxCookMinutes: null,
  preferredDifficulty: null,
  householdSize: 2,
  favoriteTags: [],
  dislikedTags: [],
  spiceTolerance: 'medium',
  cuisines: [],
  customAllergies: [],
  customAvoid: [],
  customLoves: [],
  allowAlcohol: true,
};

function recipeWithTag(id: string, tag: string): Recipe {
  return {
    ...RECIPES[0],
    id,
    tags: [tag],
    dietary: [],
  };
}

describe('recipe rating personalization', () => {
  const reviewed: RecipeRatingFeedback = {
    recipeId: 'previous-recipe',
    rating: 5,
    tags: ['bright-citrus'],
    dietary: [],
    vibe: RECIPES[0].vibe === 'spicy' ? 'sweet' : 'spicy',
    ingredients: [],
  };
  const matching = recipeWithTag('matching', 'bright-citrus');
  const unrelated = recipeWithTag('unrelated', 'smoky');

  it('ranks recipes similar to highly rated recipes above unrelated options', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0);
    const baseline = rankForDecision([matching, unrelated], {
      mealType: 'dinner',
      craving: 'anything',
      preferences,
      pantry: [],
      favorites: [],
      history: [],
      variety: false,
    });
    const personalized = rankForDecision([matching, unrelated], {
      mealType: 'dinner',
      craving: 'anything',
      preferences,
      pantry: [],
      favorites: [],
      history: [],
      ratings: [reviewed],
      variety: false,
    });
    random.mockRestore();

    expect(personalized[0].recipe.id).toBe('matching');
    expect(personalized.find(item => item.recipe.id === 'matching')!.score)
      .toBeGreaterThan(baseline.find(item => item.recipe.id === 'matching')!.score);
    expect(personalized.find(item => item.recipe.id === 'unrelated')!.score)
      .toBe(baseline.find(item => item.recipe.id === 'unrelated')!.score);
  });

  it('uses low ratings as negative preference feedback', () => {
    const lowRating = { ...reviewed, rating: 1 };
    const personalized = rankForDecision([matching, unrelated], {
      mealType: 'dinner',
      craving: 'anything',
      preferences,
      pantry: [],
      favorites: [],
      history: [],
      ratings: [lowRating],
    });
    const baseline = rankForDecision([matching, unrelated], {
      mealType: 'dinner',
      craving: 'anything',
      preferences,
      pantry: [],
      favorites: [],
      history: [],
    });

    expect(personalized.find(item => item.recipe.id === 'matching')!.score)
      .toBeLessThan(baseline.find(item => item.recipe.id === 'matching')!.score);
  });
});
