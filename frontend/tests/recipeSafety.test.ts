// tests/recipeSafety.test.ts — the safety gate every recommendation goes through.

import { RECIPES } from '../constants/recipes';
import { passesDietaryFilter } from '../utils/matching';
import { scanIngredientLine, screenRecipesForUser, validateRecipe } from '../utils/recipeSafety';
import type { Recipe, UserPreferences } from '../types';

const prefs = (over: Partial<UserPreferences> = {}): UserPreferences => ({
  name: '', dietary: [], avoidAllergens: [], maxCookMinutes: null, preferredDifficulty: null, householdSize: 2,
  favoriteTags: [], dislikedTags: [], spiceTolerance: null, cuisines: [], customAllergies: [], customAvoid: [],
  customLoves: [], allowAlcohol: true, ...over,
});

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: 't1', name: 'Test Bowl', emoji: '🥗', tags: [], vibe: 'savory',
  plate: { produce: 50, protein: 25, carbs: 25, healthyFats: 0 },
  nutrition: { calories: 400, protein: 20, carbs: 40, totalFat: 10, healthyFat: 6 },
  prepMinutes: 10, cookMinutes: 10, servings: 2, difficulty: 'easy',
  ingredients: [{ name: 'brown rice', amount: '1 cup', category: 'grains' }, { name: 'spinach', amount: '2 cups', category: 'produce' }],
  instructions: ['Cook.'], dietary: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'halal', 'kosher-style', 'no-red-meat', 'pescatarian'],
  allergens: [], ...over,
});
const ing = (...names: string[]) => names.map(name => ({ name, amount: '1', category: 'other' as const }));

describe('statuses', () => {
  test('nothing to check is safe', () => {
    const v = validateRecipe(recipe(), prefs({ dietary: ['vegan'], avoidAllergens: ['peanuts'] }));
    expect(v).toEqual({ status: 'safe', issues: [], reason: null });
  });

  test('a listed allergen is rejected with the reason', () => {
    const v = validateRecipe(recipe({ allergens: ['peanuts'], ingredients: ing('peanut butter', 'rice') }), prefs({ avoidAllergens: ['peanuts'] }));
    expect(v.status).toBe('rejected');
    expect(v.reason).toBe('Contains peanuts (peanut butter)');
    expect(v.issues[0]).toMatchObject({ kind: 'allergen', allergen: 'peanuts', ingredient: 'peanut butter' });
  });

  test('an allergen missing from the label is caught from the ingredients', () => {
    const v = validateRecipe(recipe({ ingredients: ing('rice', 'butter') }), prefs({ avoidAllergens: ['dairy'] }));
    expect(v.status).toBe('rejected');
    expect(v.reason).toBe('Contains dairy (butter)');
  });

  test('shellfish allergy also rejects molluscs (oyster sauce)', () => {
    const v = validateRecipe(recipe({ ingredients: ing('chicken', 'oyster sauce') }), prefs({ avoidAllergens: ['shellfish'] }));
    expect(v.status).toBe('rejected');
    expect(v.issues[0].allergen).toBe('mollusc');
  });

  test('"may contain" and vague ingredients are review, not safe', () => {
    expect(validateRecipe(recipe({ mayContain: ['eggs'] }), prefs({ avoidAllergens: ['eggs'] })).status).toBe('review');
    expect(validateRecipe(recipe({ ingredients: ing('red curry paste') }), prefs({ avoidAllergens: ['fish'] })).status).toBe('review');
  });

  test('an unrecognised ingredient is review for allergic users only', () => {
    const r = recipe({ allergensVerified: false });
    expect(validateRecipe(r, prefs({ avoidAllergens: ['soy'] }))).toMatchObject({ status: 'review', issues: [{ kind: 'unverified' }] });
    expect(validateRecipe(r, prefs()).status).toBe('safe');
  });

  test('rejections are listed before reviews', () => {
    const v = validateRecipe(recipe({ mayContain: ['eggs'], allergens: ['dairy'] }), prefs({ avoidAllergens: ['eggs', 'dairy'] }));
    expect(v.status).toBe('rejected');
    expect(v.issues.map(i => i.status)).toEqual(['rejected', 'review']);
  });
});

describe('diet rules check the ingredients, not just the tags', () => {
  test.each([
    ['vegan', 'honey'],
    ['vegan', 'parmesan cheese'],
    ['vegetarian', 'chicken breast'],
    ['vegetarian', 'unflavored gelatin'],
    ['pescatarian', 'bacon'],
    ['halal', 'pork shoulder'],
    ['halal', 'dry white wine'],
    ['kosher-style', 'shrimp'],
    ['gluten-free', 'all-purpose flour'],
    ['dairy-free', 'heavy cream'],
    ['no-red-meat', 'ground beef'],
  ] as const)('%s recipe that lists %s is rejected', (diet, food) => {
    const v = validateRecipe(recipe({ ingredients: ing('rice', food) }), prefs({ dietary: [diet] }));
    expect(v.status).toBe('rejected');
    expect(v.issues[0]).toMatchObject({ kind: 'diet', diet, ingredient: food });
  });

  test('kosher-style: meat with dairy', () => {
    const v = validateRecipe(recipe({ ingredients: ing('chicken thighs', 'butter') }), prefs({ dietary: ['kosher-style'] }));
    expect(v.reason).toMatch(/meat .* with dairy/);
  });

  test('substitutes are not conflicts', () => {
    const r = recipe({ ingredients: ing('vegan butter', 'almond milk', 'peanut butter', 'gluten-free flour', 'vegetable broth', 'eggplant', 'coconut cream', 'butternut squash', 'flax egg') });
    expect(validateRecipe(r, prefs({ dietary: ['vegan', 'gluten-free', 'dairy-free'] })).status).toBe('safe');
  });

  test('broth of unknown kind needs review for a vegetarian', () => {
    const v = validateRecipe(recipe({ ingredients: ing('rice', 'broth') }), prefs({ dietary: ['vegetarian'] }));
    expect(v.status).toBe('review');
  });

  test('a missing diet tag is rejected, or review when ingredients were not recognised', () => {
    expect(validateRecipe(recipe({ dietary: [] }), prefs({ dietary: ['vegan'] })).status).toBe('rejected');
    expect(validateRecipe(recipe({ dietary: [], allergensVerified: false }), prefs({ dietary: ['vegan'] })).status).toBe('review');
  });

  test('eating goals and tastes never affect safety', () => {
    const p = prefs({ dietary: ['keto', 'heart-healthy'], dislikedTags: ['rice'], favoriteTags: ['spicy'], cuisines: ['Thai'] });
    expect(validateRecipe(recipe({ dietary: [] }), p).status).toBe('safe');
  });
});

describe('custom foods, age', () => {
  test('typed-in allergy vs food to avoid', () => {
    const r = recipe({ ingredients: ing('rice', 'sliced kiwi', 'mushrooms') });
    expect(validateRecipe(r, prefs({ customAllergies: ['kiwi'] })).issues[0]).toMatchObject({ kind: 'custom-allergy', status: 'rejected' });
    expect(validateRecipe(r, prefs({ customAvoid: ['mushroom'] })).issues[0]).toMatchObject({ kind: 'avoid', status: 'rejected' });
  });

  test('alcohol for under-21s', () => {
    const r = recipe({ ingredients: ing('rice', 'dry white wine') });
    expect(validateRecipe(r, prefs({ allowAlcohol: false })).issues[0].kind).toBe('age');
    expect(validateRecipe(r, prefs({ allowAlcohol: true })).status).toBe('safe');
  });
});

describe('missing data and failures never count as safe', () => {
  test('no ingredient list', () => {
    expect(validateRecipe(recipe({ ingredients: [] }), prefs({ avoidAllergens: ['nuts'] })).status).toBe('review');
    expect(validateRecipe(recipe({ ingredients: undefined as any }), prefs({ dietary: ['vegan'] })).status).toBe('review');
  });

  test('missing allergen or diet fields', () => {
    expect(validateRecipe(recipe({ allergens: undefined as any }), prefs({ avoidAllergens: ['nuts'] })).status).toBe('review');
    expect(validateRecipe(recipe({ dietary: undefined as any }), prefs({ dietary: ['vegan'] })).status).toBe('review');
  });

  test('an ingredient without a name', () => {
    const r = recipe({ ingredients: [{ name: undefined as any, amount: '1', category: 'other' }] });
    expect(validateRecipe(r, prefs({ avoidAllergens: ['nuts'] })).status).toBe('review');
  });

  test('a check that throws comes back as review', () => {
    const broken = recipe();
    Object.defineProperty(broken, 'allergens', { get() { throw new Error('boom'); } });
    const v = validateRecipe(broken, prefs({ avoidAllergens: ['nuts'] }));
    expect(v.status).toBe('review');
    expect(v.issues[0].kind).toBe('error');
    expect(passesDietaryFilter(broken, prefs({ avoidAllergens: ['nuts'] }))).toBe(false);
  });
});

describe('screening a batch (e.g. AI-generated recipes)', () => {
  test('only safe recipes come out as safe; the rest keep their reasons', () => {
    const batch = [
      recipe({ id: 'ok' }),
      recipe({ id: 'claims-vegan', ingredients: ing('tofu', 'honey') }),
      recipe({ id: 'vague', ingredients: ing('rice', 'stock') }),
      null as any,
    ];
    const out = screenRecipesForUser(batch, prefs({ dietary: ['vegan'] }));
    expect(out.safe.map(r => r.id)).toEqual(['ok']);
    expect(out.rejected.map(x => x.recipe.id)).toEqual(['claims-vegan']);
    expect(out.review.map(x => x.recipe?.id)).toEqual(['vague', undefined]);
  });
});

describe('word matching', () => {
  test.each([
    ['nutmeg', 'nuts'], ['coconut milk', 'dairy'], ['eggplant', 'eggs'], ['butternut squash', 'dairy'],
    ['black pepper', 'nightshade'], ['sweet potato', 'nightshade'], ['oyster mushrooms', 'mollusc'],
    ['red wine vinegar', 'alcohol'], ['scallions', 'mollusc'], ['water chestnuts', 'nuts'],
  ] as const)('%s is not %s', (line, marker) => {
    const s = scanIngredientLine(line);
    expect(s.contains.has(marker as any) || s.may.has(marker as any)).toBe(false);
  });

  test.each([
    ['2 tbsp unsalted butter', 'dairy'], ['anchovies', 'fish'], ['crushed tomatoes', 'nightshade'],
    ['chopped walnuts', 'nuts'], ['soy sauce', 'gluten'], ['shrimp', 'shellfish'], ['sliced ham', 'pork'],
  ] as const)('%s contains %s', (line, marker) => {
    expect(scanIngredientLine(line).contains.has(marker as any)).toBe(true);
  });
});

describe('curated library', () => {
  test('every curated recipe is checked without errors', () => {
    const p = prefs({ dietary: ['vegan'], avoidAllergens: ['peanuts', 'shellfish'], customAllergies: ['kiwi'] });
    expect(RECIPES.every(r => validateRecipe(r, p).issues.every(i => i.kind !== 'error'))).toBe(true);
  });

  test('a recipe tagged for a diet never has an ingredient that breaks it', () => {
    for (const diet of ['vegan', 'vegetarian', 'pescatarian', 'halal', 'gluten-free', 'dairy-free'] as const) {
      const bad = RECIPES.filter(r => r.dietary.includes(diet))
        .filter(r => validateRecipe(r, prefs({ dietary: [diet] })).status === 'rejected');
      expect(bad.map(r => r.name)).toEqual([]);
    }
  });
});
