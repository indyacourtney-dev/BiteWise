// tests/drinks.test.ts — Drinks is its own section: cocktails only for
// accounts whose age allows them, mocktails for everyone, and ordering
// that favours what's already in the pantry.

import { describe, expect, it } from '@jest/globals';
import { CURATED_DRINKS } from '../constants/drinks';
import { applyDrinkFilters, drinksForSegment, isCocktail, isForACrowd, isLowEffort, keyIngredients, rankDrinks } from '../utils/drinks';
import type { PantryItem, UserPreferences } from '../types';

const prefs: UserPreferences = {
  name: 'Test', dietary: [], avoidAllergens: [], maxCookMinutes: null, preferredDifficulty: null,
  householdSize: 2, favoriteTags: [], dislikedTags: [], spiceTolerance: null, cuisines: [],
  customAllergies: [], customAvoid: [], customLoves: [],
};
const adult: UserPreferences = { ...prefs, allowAlcohol: true };

const item = (name: string, quantity = 1): PantryItem => ({
  id: name, name, quantity, unit: 'Items', category: 'other', icon: '•', addedAt: 0,
});

describe('curated drinks', () => {
  it('are all kind = drink and split evenly into cocktails and mocktails', () => {
    expect(CURATED_DRINKS.every(d => d.kind === 'drink')).toBe(true);
    expect(CURATED_DRINKS.filter(isCocktail)).toHaveLength(16);
    expect(CURATED_DRINKS.filter(d => !isCocktail(d))).toHaveLength(16);
  });

  it('have unique ids that match the database seed prefix', () => {
    const ids = CURATED_DRINKS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => id.startsWith('d-'))).toBe(true);
  });
});

describe('segments', () => {
  it('never shows a cocktail to an account that does not allow alcohol — in either segment', () => {
    expect(drinksForSegment(CURATED_DRINKS, 'cocktails', prefs)).toHaveLength(0);
    const mocktails = drinksForSegment(CURATED_DRINKS, 'mocktails', prefs);
    expect(mocktails.length).toBeGreaterThan(0);
    expect(mocktails.some(isCocktail)).toBe(false);
  });

  it('shows cocktails only in the cocktails segment for an allowed account', () => {
    const cocktails = drinksForSegment(CURATED_DRINKS, 'cocktails', adult);
    const mocktails = drinksForSegment(CURATED_DRINKS, 'mocktails', adult);
    expect(cocktails.length).toBe(16);
    expect(cocktails.every(isCocktail)).toBe(true);
    expect(mocktails.some(isCocktail)).toBe(false);
  });

  it('respects allergies and diets, but not the meal cooking-time limit', () => {
    const dairyFree = drinksForSegment(CURATED_DRINKS, 'mocktails', { ...prefs, avoidAllergens: ['dairy'] });
    expect(dairyFree.some(d => d.allergens.includes('dairy'))).toBe(false);
    expect(dairyFree.some(d => d.name === 'Fresh Lemonade')).toBe(true);

    const vegan = drinksForSegment(CURATED_DRINKS, 'mocktails', { ...prefs, dietary: ['vegan'] });
    expect(vegan.every(d => d.dietary.includes('vegan'))).toBe(true);

    // A 10-minute pitcher drink still shows with a 5-minute meal limit.
    const quickMeals = drinksForSegment(CURATED_DRINKS, 'mocktails', { ...prefs, maxCookMinutes: 5 });
    expect(quickMeals.some(d => d.name === 'Fresh Lemonade')).toBe(true);
  });

  it('ignores food', () => {
    const food = { ...CURATED_DRINKS[0], id: 'food', kind: undefined, containsAlcohol: undefined };
    expect(drinksForSegment([food], 'mocktails', prefs)).toHaveLength(0);
  });
});

describe('filters', () => {
  const mocktails = drinksForSegment(CURATED_DRINKS, 'mocktails', prefs);

  it('low effort = 5 minutes or less and 5 ingredients or fewer', () => {
    const quick = applyDrinkFilters(mocktails, new Set(['quick']), []);
    expect(quick.every(isLowEffort)).toBe(true);
    expect(quick.some(d => d.name === 'Shirley Temple')).toBe(true);
    expect(quick.some(d => d.name === 'Peach Iced Tea')).toBe(false);
  });

  it('for a crowd = 4+ servings or a pitcher', () => {
    const crowd = applyDrinkFilters(mocktails, new Set(['crowd']), []);
    expect(crowd.every(isForACrowd)).toBe(true);
    expect(crowd.some(d => d.name === 'Fresh Lemonade')).toBe(true);
    expect(crowd.some(d => d.name === 'Iced Matcha Latte')).toBe(false);
  });

  it('with what I have needs a pantry and at least half the ingredients', () => {
    expect(applyDrinkFilters(mocktails, new Set(['pantry']), [])).toHaveLength(0);
    const pantry = [item('ginger ale'), item('grenadine'), item('lime juice'), item('cherry')];
    const can = applyDrinkFilters(mocktails, new Set(['pantry']), pantry);
    expect(can.some(d => d.name === 'Shirley Temple')).toBe(true);
    expect(can.some(d => d.name === 'Mango Lassi')).toBe(false);
  });
});

describe('ranking', () => {
  it('puts drinks you can make now first, then saved ones', () => {
    const pantry = [item('ginger ale'), item('grenadine'), item('fresh lime juice'), item('maraschino cherry'), item('ice')];
    const ranked = rankDrinks(drinksForSegment(CURATED_DRINKS, 'mocktails', prefs), pantry, ['d-golden-latte']);
    expect(ranked[0].recipe.name).toBe('Shirley Temple');
    expect(ranked[0].status.label).toBe('Ready');
    expect(ranked[0].note).toContain('you have everything');
    // Among the drinks with the same (zero) coverage, the saved one comes
    // first — ahead of "Classic Hot Chocolate", which would otherwise win on name.
    const zero = ranked.filter(r => (r.coverage?.percent ?? 0) === 0);
    expect(zero[0].recipe.id).toBe('d-golden-latte');
    expect(zero[1].recipe.id).toBe('d-hot-chocolate');
  });

  it('says what is missing when it is one or two things', () => {
    const pantry = [item('ginger ale'), item('fresh lime juice'), item('maraschino cherry'), item('ice')];
    const ranked = rankDrinks(drinksForSegment(CURATED_DRINKS, 'mocktails', prefs), pantry, []);
    const st = ranked.find(r => r.recipe.name === 'Shirley Temple')!;
    expect(st.status.label).toBe('1 missing');
    expect(st.note).toContain('missing grenadine');
  });

  it('with no pantry, describes the drink instead', () => {
    const ranked = rankDrinks(drinksForSegment(CURATED_DRINKS, 'cocktails', adult), [], []);
    const marg = ranked.find(r => r.recipe.name === 'Classic Margarita')!;
    expect(marg.coverage).toBeNull();
    expect(marg.note).toMatch(/^5 min · tequila blanco · lime juice · triple sec/);
  });
});

describe('keyIngredients', () => {
  it('skips ice, water, sugar and garnishes', () => {
    const lemonade = CURATED_DRINKS.find(d => d.id === 'd-lemonade')!;
    expect(keyIngredients(lemonade)).toBe('lemon juice');
  });
});
