import { ageOn, isOfDrinkingAge, parseBirthDate } from '../utils/age';
import {
  libraryItemIsAlcohol,
  nameMentionsAlcohol,
  recipeHasAlcohol,
  textMentionsAlcohol,
} from '../utils/alcohol';
import { passesDietaryFilter } from '../utils/matching';
import { RECIPES } from '../constants/recipes';
import { SUGGESTION_LIBRARY } from '../constants/pantryData';
import type { Recipe, UserPreferences } from '../types';

describe('Age and alcohol safeguards', () => {
  test('calculates age correctly', () => {
    expect(ageOn('2005-09-25', '2026-09-25')).toBe(21);
    expect(ageOn('2005-09-26', '2026-09-25')).toBe(20);

    expect(isOfDrinkingAge('2005-09-26', '2026-09-25')).toBe(false);
    expect(isOfDrinkingAge('2005-09-25', '2026-09-25')).toBe(true);

    expect(ageOn('2004-02-29', '2025-02-28')).toBe(20);
    expect(ageOn('2004-02-29', '2025-03-01')).toBe(21);

    expect(isOfDrinkingAge(null)).toBe(false);
    expect(isOfDrinkingAge(undefined)).toBe(false);
  });

  test('validates birthday input', () => {
    expect(
      parseBirthDate('3', '4', '2004', '2026-09-25')
    ).toEqual({
      ok: true,
      iso: '2004-03-04',
    });

    expect(parseBirthDate('2', '30', '2004', '2026-09-25').ok).toBe(false);
    expect(parseBirthDate('2', '29', '2003', '2026-09-25').ok).toBe(false);
    expect(parseBirthDate('13', '1', '2004', '2026-09-25').ok).toBe(false);
    expect(parseBirthDate('1', '1', '2030', '2026-09-25').ok).toBe(false);
    expect(parseBirthDate('1', '1', '04', '2026-09-25').ok).toBe(false);
    expect(parseBirthDate('', '1', '2004', '2026-09-25').ok).toBe(false);
  });

  test('identifies alcohol in names', () => {
    const alcoholicNames = [
      'red wine',
      'Dry White Wine',
      'beer',
      'dark rum',
      'bourbon',
      'mirin',
      'Shaoxing wine',
      'cooking sherry',
      'vodka',
      'gin',
      'sake',
      'Guinness stout',
      'triple sec',
      'brandy',
      'hard cider',
      'Angostura bitters',
    ];

    for (const name of alcoholicNames) {
      expect(nameMentionsAlcohol(name)).toBe(true);
    }
  });

  test('does not incorrectly identify non-alcoholic names as alcohol', () => {
    const nonAlcoholicNames = [
      'red wine vinegar',
      'apple cider vinegar',
      'rice wine vinegar',
      'sherry vinegar',
      'ginger ale',
      'root beer',
      'ginger beer',
      'vanilla extract',
      'rum extract',
      'apple cider',
      'ginger',
      'drumsticks',
      'crumbs',
      'kale',
      'portobello mushrooms',
      'original recipe',
      'non-alcoholic beer',
      'virgin mojito',
      'Beer-Can Chicken',
    ];

    for (const name of nonAlcoholicNames) {
      expect(nameMentionsAlcohol(name)).toBe(false);
    }
  });

  test('detects alcohol in recipe instructions when appropriate', () => {
    expect(
      textMentionsAlcohol('For the sake of time, use leftover rice.')
    ).toBe(false);

    expect(
      textMentionsAlcohol('Deglaze the pan with the wine.')
    ).toBe(true);
  });

  test('detects alcohol in recipes', () => {
    const base: Recipe = {
      ...RECIPES[0],
      id: 't1',
      name: 'Test',
      tags: [],
      ingredients: [{ name: 'chicken breast' }] as any,
    };

    expect(
      recipeHasAlcohol({
        ...base,
        ingredients: [
          { name: 'chicken' },
          { name: 'white wine' },
        ] as any,
      })
    ).toBe(true);

    expect(
      recipeHasAlcohol({
        ...base,
        name: 'Classic Margarita',
      })
    ).toBe(true);

    expect(
      recipeHasAlcohol({
        ...base,
        containsAlcohol: true,
      } as any)
    ).toBe(true);
  });

  test('does not flag curated recipes containing safe vinegar ingredients', () => {
    expect(RECIPES.filter(recipeHasAlcohol).map(r => r.name)).toEqual([]);
  });

  test('allows alcohol when the preference allows it', () => {
    const base: Recipe = {
      ...RECIPES[0],
      id: 't1',
      name: 'Test',
      tags: [],
      ingredients: [{ name: 'chicken breast' }] as any,
    };

    const boozy = {
      ...base,
      ingredients: [
        { name: 'beef' },
        { name: 'red wine' },
      ] as any,
    };

    const preferences: UserPreferences = {
      name: '',
      dietary: [],
      avoidAllergens: [],
      maxCookMinutes: null,
      preferredDifficulty: null,
      householdSize: 2,
      favoriteTags: [],
      dislikedTags: [],
      spiceTolerance: null,
      cuisines: [],
      customAllergies: [],
      customAvoid: [],
      customLoves: [],
      allowAlcohol: true,
    };

    expect(passesDietaryFilter(boozy, preferences)).toBe(true);
  });

  test('blocks alcohol when the preference does not allow it', () => {
    const base: Recipe = {
      ...RECIPES[0],
      id: 't1',
      name: 'Test',
      tags: [],
      ingredients: [{ name: 'chicken breast' }] as any,
    };

    const boozy = {
      ...base,
      ingredients: [
        { name: 'beef' },
        { name: 'red wine' },
      ] as any,
    };

    const preferences: UserPreferences = {
      name: '',
      dietary: [],
      avoidAllergens: [],
      maxCookMinutes: null,
      preferredDifficulty: null,
      householdSize: 2,
      favoriteTags: [],
      dislikedTags: [],
      spiceTolerance: null,
      cuisines: [],
      customAllergies: [],
      customAvoid: [],
      customLoves: [],
      allowAlcohol: false,
    };

    expect(passesDietaryFilter(boozy, preferences)).toBe(false);
  });

  test('blocks alcohol when the drinking-age preference is unknown', () => {
    const base: Recipe = {
      ...RECIPES[0],
      id: 't1',
      name: 'Test',
      tags: [],
      ingredients: [{ name: 'chicken breast' }] as any,
    };

    const boozy = {
      ...base,
      ingredients: [
        { name: 'beef' },
        { name: 'red wine' },
      ] as any,
    };

    const preferences: UserPreferences = {
      name: '',
      dietary: [],
      avoidAllergens: [],
      maxCookMinutes: null,
      preferredDifficulty: null,
      householdSize: 2,
      favoriteTags: [],
      dislikedTags: [],
      spiceTolerance: null,
      cuisines: [],
      customAllergies: [],
      customAvoid: [],
      customLoves: [],
      allowAlcohol: false,
    };

    expect(passesDietaryFilter(boozy, preferences)).toBe(false);
  });

  test('still allows normal recipes when alcohol is not allowed', () => {
    const base: Recipe = {
      ...RECIPES[0],
      id: 't1',
      name: 'Test',
      tags: [],
      ingredients: [{ name: 'chicken breast' }] as any,
    };

    const preferences: UserPreferences = {
      name: '',
      dietary: [],
      avoidAllergens: [],
      maxCookMinutes: null,
      preferredDifficulty: null,
      householdSize: 2,
      favoriteTags: [],
      dislikedTags: [],
      spiceTolerance: null,
      cuisines: [],
      customAllergies: [],
      customAvoid: [],
      customLoves: [],
      allowAlcohol: false,
    };

    expect(passesDietaryFilter(base, preferences)).toBe(true);
  });

  test('identifies alcoholic pantry items', () => {
    const flagged = SUGGESTION_LIBRARY
      .filter(libraryItemIsAlcohol)
      .map(i => i.name)
      .sort();

    expect(flagged).toEqual([
      'Beer',
      'Bourbon',
      'Brandy',
      'Cooking Sherry',
      'Mirin',
      'Red Wine',
      'Rum',
      'Sake',
      'Sparkling Wine',
      'Vodka',
      'White Wine',
    ]);
  });
});