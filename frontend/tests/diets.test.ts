// tests/diets.test.ts — diet rules are hard, eating goals are favored.

import { RECIPES } from '../constants/recipes';
import { dietGoalMatch, dietGoals, dietGoalsSentence, dietRules } from '../utils/diets';
import { passesDietaryFilter } from '../utils/matching';
import { rankForDecision } from '../utils/decide';
import { nameFamily, pickForSlot } from '../utils/weekPlan';
import type { Recipe, UserPreferences } from '../types';

const base: UserPreferences = {
  name: '', dietary: [], avoidAllergens: [], maxCookMinutes: null, preferredDifficulty: null, householdSize: 2,
  favoriteTags: [], dislikedTags: [], spiceTolerance: null, cuisines: [], customAllergies: [], customAvoid: [], customLoves: [],
  allowAlcohol: true,
};
const five = ['diabetic-friendly', 'low-sodium', 'low-cholesterol', 'heart-healthy', 'high-fiber'] as const;

describe('rules vs goals', () => {
  test('vegan is a rule, heart-healthy is a goal', () => {
    const prefs = { ...base, dietary: ['vegan', 'heart-healthy', 'low-sodium'] as UserPreferences['dietary'] };
    expect(dietRules(prefs)).toEqual(['vegan']);
    expect(dietGoals(prefs)).toEqual(['heart-healthy', 'low-sodium']);
  });

  test('five health goals never empty the pool', () => {
    const prefs = { ...base, dietary: [...five] as UserPreferences['dietary'] };
    const strictCount = RECIPES.filter(r => five.every(t => r.dietary.includes(t))).length;
    const allowed = RECIPES.filter(r => passesDietaryFilter(r, prefs)).length;
    expect(strictCount).toBeLessThan(allowed);   // the old behaviour would have left only strictCount
    expect(allowed).toBe(RECIPES.filter(r => passesDietaryFilter(r, base)).length);
  });

  test('a diet rule still filters', () => {
    const prefs = { ...base, dietary: ['vegan'] as UserPreferences['dietary'] };
    expect(RECIPES.filter(r => passesDietaryFilter(r, prefs)).every(r => r.dietary.includes('vegan'))).toBe(true);
  });

  test('goal matching is graded and worded', () => {
    const r = { dietary: ['heart-healthy', 'high-fiber'] } as Recipe;
    const m = dietGoalMatch(r, ['heart-healthy', 'low-sodium', 'high-fiber']);
    expect(m.matched).toEqual(['heart-healthy', 'high-fiber']);
    expect(m.share).toBeCloseTo(2 / 3);
    expect(dietGoalsSentence(m.matched)).toBe('Heart-healthy and high-fiber');
    expect(dietGoalsSentence(['heart-healthy', 'low-sodium', 'high-fiber', 'low-calorie'])).toMatch(/and 2 more/);
  });

  test('Pick for me puts recipes that fit the goals first and says so', () => {
    const prefs = { ...base, dietary: ['heart-healthy'] as UserPreferences['dietary'] };
    const pool = RECIPES.filter(r => passesDietaryFilter(r, prefs));
    const ranked = rankForDecision(pool, {
      mealType: 'dinner', craving: 'anything', preferences: prefs, pantry: [], favorites: [], history: [], variety: false,
    });
    const fits = ranked.filter(d => d.recipe.dietary.includes('heart-healthy'));
    const misses = ranked.filter(d => !d.recipe.dietary.includes('heart-healthy'));
    if (fits.length && misses.length) {
      const avg = (xs: typeof ranked) => xs.reduce((a, d) => a + d.score, 0) / xs.length;
      expect(avg(fits)).toBeGreaterThan(avg(misses));
      expect(fits.some(d => d.reasons.includes('Heart-healthy'))).toBe(true);
    }
  });
});

describe('week variety', () => {
  test('nameFamily groups the same dish and separates different ones', () => {
    expect(nameFamily('Chicken Tacos')).toBe(nameFamily('Easy Chicken Taco Bowls'));
    expect(nameFamily('Lemon Chicken')).not.toBe(nameFamily('Chicken Tacos'));
  });

  test('the same dish family is not picked on the next day', () => {
    const tacos: Recipe = { ...RECIPES[0], id: 't1', name: 'Chicken Tacos', tags: ['chicken'] };
    const tacoBowl: Recipe = { ...RECIPES[0], id: 't2', name: 'Chicken Taco Bowls', tags: ['chicken'] };
    const curry: Recipe = { ...RECIPES[0], id: 'c1', name: 'Chickpea Curry', tags: ['vegetarian'] };
    const byId = new Map([[tacos.id, tacos], [tacoBowl.id, tacoBowl], [curry.id, curry]]);
    const plan = [{ id: 'x', date: '2026-10-14', slot: 'dinner' as const, recipeId: 't1', name: 'Chicken Tacos', emoji: '🌮', minutes: 20, servings: 2, cooked: false, addedAt: 1 }];
    const pick = pickForSlot('2026-10-15', 'dinner', [tacoBowl, curry], plan, byId, { preferences: base, random: () => 0.5 });
    expect(pick?.id).toBe('c1');
  });
});
