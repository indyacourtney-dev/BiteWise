// tests/aiRecipes.test.ts — AI recipes are read defensively and never trusted on labels.

import { normalizeGeneratedRecipe, type WireLabels } from '../utils/aiRecipes';
import { screenRecipesForUser, validateRecipe } from '../utils/recipeSafety';
import type { UserPreferences } from '../types';

const ctx = { mealType: 'dinner' as const, servings: 2, model: 'claude-opus-5-5', now: 1, index: 0 };
const prefs = (over: Partial<UserPreferences> = {}): UserPreferences => ({
  name: '', dietary: [], avoidAllergens: [], maxCookMinutes: null, preferredDifficulty: null, householdSize: 2,
  favoriteTags: [], dislikedTags: [], spiceTolerance: null, cuisines: [], customAllergies: [], customAvoid: [],
  customLoves: [], allowAlcohol: false, ...over,
});

const good = {
  name: 'Lemony Chickpea Bowl', description: 'Bright and quick.', emoji: '🥗', mealTypes: ['lunch', 'dinner'],
  servings: 2, prepMinutes: 10, cookMinutes: 15, difficulty: 'easy', vibe: 'savory', cuisine: 'Mediterranean',
  tags: ['Chickpeas', 'bowl'],
  ingredients: [
    { name: 'canned chickpeas', quantity: '1 can', category: 'pantry', optional: false },
    { name: 'brown rice', quantity: '1 cup', category: 'grains', optional: false },
    { name: 'lemon', quantity: '1', category: 'produce', optional: false },
  ],
  instructions: ['Cook the rice.', 'Warm the chickpeas.', 'Squeeze lemon over.'],
  nutritionPerServing: { calories: 480, protein: 18, carbs: 70, totalFat: 9, healthyFat: 7 },
  plate: { produce: 40, protein: 25, carbs: 30, healthyFats: 5 },
  claimedDietary: ['vegan', 'gluten-free'], claimedAllergens: [], containsAlcohol: false,
};
const checked: WireLabels = { status: 'checked', allKnown: true, allergens: [], mayContain: [], dietary: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], unmatched: [] };

describe('normalizeGeneratedRecipe', () => {
  test('a complete answer becomes a Recipe with checked labels', () => {
    const r = normalizeGeneratedRecipe(good, checked, ctx);
    if (!r.ok) throw new Error(r.reason);
    expect(r.recipe).toMatchObject({
      source: 'ai', name: 'Lemony Chickpea Bowl', description: 'Bright and quick.', servings: 2,
      prepMinutes: 10, cookMinutes: 15, allergensVerified: true, kind: 'food',
      dietary: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], mealTypes: ['dinner', 'lunch'],
    });
    expect(r.recipe.ingredients[0]).toEqual({ name: 'canned chickpeas', amount: '1 can', category: 'pantry' });
    expect(r.recipe.tags).toEqual(expect.arrayContaining(['chickpeas', 'mediterranean', 'ai-generated']));
    expect(r.recipe.ai).toMatchObject({ labelsChecked: true, claimedDietary: ['vegan', 'gluten-free'], timesKnown: true });
  });

  test('the AI’s diet claims are never used as labels', () => {
    const r = normalizeGeneratedRecipe(good, { status: 'unavailable' }, ctx);
    if (!r.ok) throw new Error(r.reason);
    expect(r.recipe.dietary).toEqual([]);
    expect(r.recipe.allergensVerified).toBe(false);
    expect(r.recipe.ai?.claimedDietary).toEqual(['vegan', 'gluten-free']);
  });

  test('allergens are the catalog’s plus whatever the AI admitted', () => {
    const r = normalizeGeneratedRecipe({ ...good, claimedAllergens: ['sesame', 'not-an-allergen'] }, { ...checked, allergens: ['soy'] }, ctx);
    if (!r.ok) throw new Error(r.reason);
    expect(r.recipe.allergens.sort()).toEqual(['sesame', 'soy']);
  });

  test.each([
    [null, /empty/],
    ['a string', /empty/],
    [{ ...good, name: '  ' }, /no name/],
    [{ ...good, ingredients: [{ quantity: '1' }, 'x'] }, /no ingredients/],
    [{ ...good, instructions: [] }, /no steps/],
  ])('unusable answers are dropped with a reason (%#)', (raw, reason) => {
    const r = normalizeGeneratedRecipe(raw, checked, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(reason);
  });

  test('missing or junk fields get safe defaults', () => {
    const r = normalizeGeneratedRecipe({
      name: 'Toast', ingredients: [{ name: 'bread', category: 'weird' }], instructions: ['Toast it.'],
      servings: -3, prepMinutes: 'soon', difficulty: 'extreme', plate: { produce: 'x' }, nutritionPerServing: null,
    }, undefined, ctx);
    if (!r.ok) throw new Error(r.reason);
    expect(r.recipe).toMatchObject({ servings: 2, servingsEstimated: true, prepMinutes: 0, cookMinutes: 0, difficulty: 'medium', vibe: 'savory', emoji: '🍽️' });
    expect(r.recipe.ingredients[0].category).toBe('other');
    expect(r.recipe.plate).toEqual({ produce: 0, protein: 0, carbs: 0, healthyFats: 0 });
    expect(r.recipe.ai).toMatchObject({ timesKnown: false, nutritionKnown: false, labelsChecked: false });
  });

  test('plate shares are scaled to 100', () => {
    const r = normalizeGeneratedRecipe({ ...good, plate: { produce: 1, protein: 1, carbs: 1, healthyFats: 1 } }, checked, ctx);
    if (!r.ok) throw new Error(r.reason);
    const p = r.recipe.plate;
    expect(p.produce + p.protein + p.carbs + p.healthyFats).toBe(100);
  });
});

describe('AI recipes go through the safety check', () => {
  const read = (raw: object, labels: WireLabels = checked) => {
    const r = normalizeGeneratedRecipe(raw, labels, ctx);
    if (!r.ok) throw new Error(r.reason);
    return r.recipe;
  };

  test('a recipe that claims vegan but lists honey is rejected', () => {
    const r = read({ ...good, ingredients: [...good.ingredients, { name: 'honey', quantity: '1 tbsp', category: 'pantry' }] });
    expect(validateRecipe(r, prefs({ dietary: ['vegan'] })).status).toBe('rejected');
  });

  test('unchecked labels are held back for anyone with restrictions, fine for everyone else', () => {
    const r = read(good, { status: 'unavailable' });
    expect(validateRecipe(r, prefs({ avoidAllergens: ['peanuts'] })).status).toBe('review');
    expect(validateRecipe(r, prefs({ dietary: ['vegan'] })).status).toBe('review');
    expect(validateRecipe(r, prefs()).status).toBe('safe');
  });

  test('an unrecognised ingredient keeps it from allergic users', () => {
    const r = read(good, { ...checked, allKnown: false, unmatched: ['mystery spice'] });
    expect(validateRecipe(r, prefs({ avoidAllergens: ['sesame'] })).status).toBe('review');
  });

  test('alcohol stays hidden from under-21s even if the AI says there is none', () => {
    const r = read({ ...good, ingredients: [...good.ingredients, { name: 'dry white wine', quantity: '1/4 cup', category: 'other' }] });
    expect(validateRecipe(r, prefs({ allowAlcohol: false })).status).toBe('rejected');
  });

  test('a clean, checked recipe is shown', () => {
    const out = screenRecipesForUser([read(good)], prefs({ dietary: ['vegan'], avoidAllergens: ['peanuts', 'dairy'] }));
    expect(out.safe).toHaveLength(1);
  });
});
