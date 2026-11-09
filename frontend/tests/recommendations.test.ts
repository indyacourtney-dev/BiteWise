// tests/recommendations.test.ts
//
// The fixes to how allergies, diets and tastes shape recommendations:
//   * a shellfish allergy also excludes molluscs (clams, mussels, squid)
//   * taste chips count once each, not once per tag they expand to
//   * "Spicy food" / "Sweet & glazed" read the recipe's vibe field
//   * cuisines are inferred, since the database has no cuisine tags
//   * Decide for me and the pool query use all of the above

import { describe, expect, it } from '@jest/globals';
import { RECIPES } from '../constants/recipes';
import { tagsForTasteIds } from '../constants/preferenceOptions';
import { poolFilters } from '../hooks/useRecipeLibrary';
import { cuisineMatches, inferCuisines, normalizeCuisine, resetCuisineCache } from '../utils/cuisine';
import { DISLIKE_PENALTY, dislikePenalty, rankForDecision } from '../utils/decide';
import { dislikeOverlap, expandAllergens, favoriteOverlap, passesDietaryFilter, tasteOverlap } from '../utils/matching';
import type { Recipe, UserPreferences } from '../types';

const prefs: UserPreferences = {
  name: 'Test', dietary: [], avoidAllergens: [], maxCookMinutes: null, preferredDifficulty: null,
  householdSize: 2, favoriteTags: [], dislikedTags: [], spiceTolerance: null, cuisines: [],
  customAllergies: [], customAvoid: [], customLoves: [], allowAlcohol: true,
};

const recipe = (patch: Partial<Recipe>): Recipe => ({
  ...RECIPES[0],
  id: `t-${Math.random().toString(36).slice(2, 8)}`,
  name: 'Plain dish',
  tags: [],
  vibe: 'savory',
  dietary: [],
  allergens: [],
  mayContain: [],
  allergensVerified: true,
  // An empty list can't be checked, so the safety check holds it for review.
  ingredients: [{ name: 'rice', amount: '1 cup', category: 'grains' }],
  ...patch,
});

describe('expandAllergens', () => {
  it('shellfish implies mollusc, gluten implies wheat', () => {
    expect(expandAllergens(['shellfish'])).toEqual(expect.arrayContaining(['shellfish', 'mollusc']));
    expect(expandAllergens(['gluten'])).toEqual(expect.arrayContaining(['gluten', 'wheat']));
    expect(expandAllergens(['peanuts'])).toEqual(['peanuts']);
    expect(expandAllergens([])).toEqual([]);
  });

  it('a shellfish allergy hides a mollusc-only recipe (the database tags them apart)', () => {
    const clams = recipe({ name: 'Linguine with clams', allergens: ['mollusc'] });
    expect(passesDietaryFilter(clams, { ...prefs, avoidAllergens: ['shellfish'] })).toBe(false);
    expect(passesDietaryFilter(clams, { ...prefs, avoidAllergens: ['peanuts'] })).toBe(true);
    const mayHave = recipe({ name: 'Seafood stock', mayContain: ['mollusc'] });
    expect(passesDietaryFilter(mayHave, { ...prefs, avoidAllergens: ['shellfish'] })).toBe(false);
  });

  it('is sent to the server pool query too', () => {
    const { random } = poolFilters('dinner', { ...prefs, avoidAllergens: ['shellfish'] });
    expect(random.excludeAllergens).toEqual(expect.arrayContaining(['shellfish', 'mollusc']));
  });
});

describe('tasteOverlap', () => {
  it('counts a chip once even though it saves several tags the database applies together', () => {
    const loves = tagsForTasteIds(['chicken']); // chicken + poultry
    const r = recipe({ tags: ['chicken', 'poultry', 'baked'] });
    expect(favoriteOverlap(r, loves)).toBe(1);
  });

  it('counts each chosen chip separately', () => {
    const loves = tagsForTasteIds(['chicken', 'rice', 'cheesy']);
    const r = recipe({ tags: ['chicken', 'poultry', 'rice', 'grain', 'bowl'] });
    expect(favoriteOverlap(r, loves)).toBe(2); // chicken + rice, not cheesy
  });

  it('"Plant-based" skipped is one penalty, not four, on a vegetarian recipe', () => {
    const dislikes = tagsForTasteIds(['plant']); // beans, tofu, plant-based, vegetarian
    const r = recipe({ tags: ['vegetarian', 'plant-based', 'beans', 'cheesy'] });
    expect(dislikeOverlap(r, dislikes)).toBe(1);
  });

  it('reads spicy / sweet off the vibe field', () => {
    const spicyFan = tagsForTasteIds(['spicy']);
    expect(favoriteOverlap(recipe({ vibe: 'spicy', tags: [] }), spicyFan)).toBe(1);
    expect(favoriteOverlap(recipe({ vibe: 'savory', tags: [] }), spicyFan)).toBe(0);
    const sweetTooth = tagsForTasteIds(['sweet']);
    expect(favoriteOverlap(recipe({ vibe: 'sweet', tags: [] }), sweetTooth)).toBe(1);
  });

  it('tags that belong to no chip still count one each', () => {
    expect(tasteOverlap(recipe({ tags: ['garlic', 'lemon'] }), ['garlic', 'lemon', 'thyme'])).toBe(2);
  });

  it('is zero with nothing chosen', () => {
    expect(tasteOverlap(recipe({ tags: ['chicken'] }), [])).toBe(0);
  });
});

describe('inferCuisines', () => {
  beforeEach(resetCuisineCache);

  const r = (name: string, ingredients: string[] = [], tags: string[] = []) =>
    inferCuisines({ id: name, name, tags, ingredients: ingredients.map(n => ({ name: n, amount: '1', category: 'other' as const })) });

  it('reads the cuisine off the name', () => {
    expect(r('Chicken Tikka Masala', ['chicken', 'yogurt', 'garam masala'])).toContain('indian');
    expect(r('Spaghetti Carbonara', ['spaghetti', 'pancetta', 'pecorino'])).toContain('italian');
    expect(r('Beef Tacos', ['ground beef', 'tortillas', 'cilantro'])).toContain('mexican');
    expect(r('Pad Thai', ['rice noodles', 'fish sauce', 'peanuts'])).toContain('thai');
    expect(r('Bibimbap', ['gochujang', 'rice'])).toContain('korean');
    expect(r('Jerk Chicken with Rice and Peas', ['allspice', 'scotch bonnet'])).toContain('caribbean');
    expect(r('Shrimp and Grits', ['grits', 'andouille'])).toContain('soul');
  });

  it('needs enough evidence from ingredients alone', () => {
    expect(r('Weeknight Stir-Fry', ['soy sauce', 'ginger', 'sesame oil', 'scallions'])).toContain('chinese');
    expect(r('Weeknight Skillet', ['soy sauce'])).toEqual([]); // one ingredient isn't a cuisine
  });

  it('keeps an explicit tag', () => {
    expect(r('Grandma’s pie', [], ['american'])).toContain('american');
  });

  it('prefers a specific cuisine over "American" when both fit', () => {
    expect(r('Buffalo Chicken Tacos', ['tortillas', 'ranch', 'hot sauce'])[0]).toBe('mexican');
  });

  it('matches the user’s saved cuisines whether saved as ids or labels', () => {
    const tikka = recipe({ name: 'Chicken Tikka Masala', ingredients: [{ name: 'garam masala', amount: '1 tsp', category: 'pantry' }] });
    expect(cuisineMatches(tikka, ['indian'])).toEqual(['indian']);
    expect(cuisineMatches(tikka, ['Indian'])).toEqual(['indian']);
    expect(cuisineMatches(tikka, ['Mexican'])).toEqual([]);
    expect(normalizeCuisine('Middle Eastern')).toBe('middle-eastern');
    expect(normalizeCuisine('Southern / Soul')).toBe('soul');
  });
});

describe('rankForDecision uses the taste signals', () => {
  const ctx = {
    mealType: 'dinner' as const,
    craving: 'anything' as const,
    pantry: [],
    favorites: [],
    history: [],
    variety: false,
  };

  it('a favourite cuisine moves a recipe up and explains why', () => {
    const tikka = recipe({ id: 'tikka', name: 'Chicken Tikka Masala', ingredients: [{ name: 'garam masala', amount: '1', category: 'pantry' }] });
    const plain = recipe({ id: 'plain', name: 'Plain baked chicken' });
    const ranked = rankForDecision([plain, tikka], { ...ctx, preferences: { ...prefs, cuisines: ['indian'] } });
    expect(ranked[0].recipe.id).toBe('tikka');
    expect(ranked[0].reasons.join(' ')).toMatch(/Indian/);
  });

  it('loved spicy food (vibe) beats an otherwise identical dish', () => {
    const hot = recipe({ id: 'hot', vibe: 'spicy' });
    const mild = recipe({ id: 'mild', vibe: 'savory' });
    const ranked = rankForDecision([mild, hot], {
      ...ctx,
      preferences: { ...prefs, favoriteTags: tagsForTasteIds(['spicy']), spiceTolerance: 'hot' },
    });
    expect(ranked[0].recipe.id).toBe('hot');
  });

  it('a "rather skip" food is suggested less, not never — and backs off after two showings', () => {
    const loves = tagsForTasteIds(['chicken']);
    const skips = tagsForTasteIds(['cheesy']);
    const cheesyChicken = recipe({ id: 'cheesy', tags: ['chicken', 'poultry', 'cheesy'] });
    const plainChicken = recipe({ id: 'plain', tags: ['chicken', 'poultry'] });
    const preferences = { ...prefs, favoriteTags: loves, dislikedTags: skips };

    // Never shown: still in the running (ranked, just below the plain one).
    const fresh = rankForDecision([cheesyChicken, plainChicken], { ...ctx, preferences, exposure: [] });
    expect(fresh.map(d => d.recipe.id)).toEqual(['plain', 'cheesy']);
    // (variety: false adds up to 4 points of jitter per recipe)
    expect(fresh[0].score - fresh[1].score).toBeGreaterThan(DISLIKE_PENALTY - 4);
    expect(fresh[0].score - fresh[1].score).toBeLessThan(DISLIKE_PENALTY + 4);

    // Shown twice and passed over: it drops well behind, even against a
    // recipe with nothing else going for it.
    const nothingSpecial = recipe({ id: 'meh', tags: [] });
    const twice = [{ id: 'cheesy', at: 1 }, { id: 'cheesy', at: 2 }];
    const backedOff = rankForDecision([cheesyChicken, nothingSpecial], { ...ctx, preferences, exposure: twice });
    expect(backedOff[0].recipe.id).toBe('meh');

    // ...unless they cooked it anyway, which cancels the back-off: the
    // recipe is back to the mild nudge (≈ 60+ points better than backed off).
    const cooked = [{ id: 'cheesy', at: 1, chosen: true }, { id: 'cheesy', at: 2 }];
    const forgiven = rankForDecision([cheesyChicken, nothingSpecial], { ...ctx, preferences, exposure: cooked });
    const scoreOf = (list: typeof forgiven, id: string) => list.find(d => d.recipe.id === id)!.score;
    expect(scoreOf(forgiven, 'cheesy') - scoreOf(backedOff, 'cheesy')).toBeGreaterThan(60);
  });

  it('dislikePenalty grows with showings and caps, never for recipes that were chosen', () => {
    expect(dislikePenalty(0, 5, false)).toBe(0);
    expect(dislikePenalty(1, 0, false)).toBe(DISLIKE_PENALTY);
    expect(dislikePenalty(1, 1, false)).toBeGreaterThan(dislikePenalty(1, 0, false));
    expect(dislikePenalty(1, 2, false)).toBeGreaterThan(dislikePenalty(1, 1, false) + 30);
    expect(dislikePenalty(1, 9, false)).toBe(dislikePenalty(1, 2, false)); // caps
    expect(dislikePenalty(1, 9, true)).toBe(DISLIKE_PENALTY);
  });

  it('dietary restrictions and allergies are still a hard no, whatever the tastes say', () => {
    const loves = tagsForTasteIds(['cheesy']);
    const cheesyVegan = recipe({ id: 'v', tags: ['cheesy'], dietary: ['vegan'] });
    const cheesyDairy = recipe({ id: 'd', tags: ['cheesy'], dietary: [], allergens: ['dairy'] });
    expect(passesDietaryFilter(cheesyDairy, { ...prefs, favoriteTags: loves, dietary: ['vegan'] })).toBe(false);
    expect(passesDietaryFilter(cheesyDairy, { ...prefs, favoriteTags: loves, avoidAllergens: ['dairy'] })).toBe(false);
    expect(passesDietaryFilter(cheesyVegan, { ...prefs, favoriteTags: loves, dietary: ['vegan'] })).toBe(true);
  });

  it('the pool query asks for the user’s loved tags as a second slice', () => {
    const { taste, random } = poolFilters('dinner', { ...prefs, favoriteTags: tagsForTasteIds(['chicken']), maxCookMinutes: 30 });
    expect(taste?.tags).toEqual(expect.arrayContaining(['chicken', 'poultry']));
    expect(random.maxTotalMinutes).toBe(30);
    expect(poolFilters('dinner', prefs).taste).toBeNull();
  });
});

describe('balance over speed', () => {
  it('plateBalanceScore is 1 inside the bands and falls off gradually', () => {
    const { plateBalanceScore } = require('../utils/matching');
    expect(plateBalanceScore({ produce: 50, protein: 25, carbs: 25, healthyFats: 8 })).toBe(1);
    const nearly = plateBalanceScore({ produce: 40, protein: 25, carbs: 35, healthyFats: 8 });
    const carbHeavy = plateBalanceScore({ produce: 10, protein: 15, carbs: 75, healthyFats: 5 });
    expect(nearly).toBeGreaterThan(0.5);
    expect(nearly).toBeLessThan(1);
    expect(carbHeavy).toBe(0);
  });

  it('a balanced 40-minute dinner beats a quick carb-heavy one', () => {
    const balanced = recipe({ id: 'balanced', prepMinutes: 10, cookMinutes: 30, plate: { produce: 50, protein: 25, carbs: 25, healthyFats: 8 } });
    const quick = recipe({ id: 'quick', prepMinutes: 5, cookMinutes: 10, plate: { produce: 10, protein: 15, carbs: 75, healthyFats: 5 } });
    const ranked = rankForDecision([quick, balanced], {
      mealType: 'dinner', craving: 'anything', pantry: [], favorites: [], history: [], variety: false, preferences: prefs,
    });
    expect(ranked[0].recipe.id).toBe('balanced');
    expect(ranked[0].reasons).toContain('A balanced plate');
  });
});
