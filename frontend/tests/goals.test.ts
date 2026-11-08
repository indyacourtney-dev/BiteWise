// tests/goals.test.ts — goals turn into sensible, safe targets.

import {
  dailyTargets, goalFit, goalForMeal, isCompleteGoals, mealTargets, restingEnergy,
  cmToFtIn, ftInToCm, kgToLb, lbToKg, formatHeight, focusFit, type NutritionGoals,
} from '../utils/goals';
import { checkFocus, distinctColors } from '../utils/focus';
import type { Recipe } from '../types';

/** A food recipe with just what the scorers read. */
function dish(over: Partial<Recipe> & { calories: number; protein: number; carbs?: number; fat?: number; names?: string[] }): Recipe {
  const { calories, protein, carbs = 40, fat = 15, names = ['chicken breast', 'rice', 'broccoli'], ...rest } = over;
  return {
    id: 'x', name: 'Test dish', emoji: '🍽️', tags: [], vibe: 'savory',
    plate: { produce: 35, protein: 30, carbs: 25, healthyFats: 10 },
    nutrition: { calories, protein, carbs, totalFat: fat, healthyFat: fat / 2 },
    prepMinutes: 10, cookMinutes: 20, servings: 2, difficulty: 'easy',
    ingredients: names.map(n => ({ name: n, amount: '1', category: 'other' as const })),
    instructions: ['Cook.'], dietary: [], allergens: [],
    ...rest,
  } as Recipe;
}

const woman: NutritionGoals = { goal: 'lose', heightCm: 165, weightKg: 70, activity: 'light', body: 'female' };
const man: NutritionGoals = { goal: 'gain', heightCm: 180, weightKg: 75, activity: 'moderate', body: 'male' };

describe('daily targets', () => {
  test('Mifflin-St Jeor matches the textbook numbers', () => {
    // 10*70 + 6.25*165 - 5*30 - 161 = 1420.25
    expect(restingEnergy(woman, 30)).toBe(1420);
    // 10*75 + 6.25*180 - 5*25 + 5 = 1755
    expect(restingEnergy(man, 25)).toBe(1755);
  });

  test('lose weight = activity-adjusted minus 500, never below the floor', () => {
    const t = dailyTargets(woman, 30);
    expect(t.tdee).toBe(Math.round(1420 * 1.375)); // 1953
    expect(t.calories).toBe(1450);                  // 1953 - 500 → rounded to 10
    expect(t.floored).toBe(false);

    const small = dailyTargets({ ...woman, heightCm: 150, weightKg: 48, activity: 'low' }, 60);
    expect(small.calories).toBe(1200);
    expect(small.floored).toBe(true);
  });

  test('gain muscle adds a modest surplus and the most protein', () => {
    const t = dailyTargets(man, 25);
    expect(t.calories).toBe(Math.round((Math.round(1755 * 1.55) + 300) / 10) * 10);
    expect(t.protein).toBe(135); // 75 kg × 1.8
    expect(dailyTargets({ ...man, goal: 'maintain' }, 25).protein).toBe(90);
  });

  test('meals split the day: dinner is the biggest', () => {
    const t = dailyTargets(man, 25);
    const b = mealTargets(t, 'breakfast');
    const d = mealTargets(t, 'dinner');
    expect(d.calories).toBeGreaterThan(b.calories);
    expect(b.calories + mealTargets(t, 'lunch').calories + d.calories + mealTargets(t, 'dessert').calories).toBeLessThanOrEqual(t.calories + 2);
  });

  test('incomplete or silly goals are ignored', () => {
    expect(isCompleteGoals(null)).toBe(false);
    expect(isCompleteGoals({ goal: 'lose' })).toBe(false);
    expect(isCompleteGoals({ ...woman, heightCm: 20 })).toBe(false);
    expect(goalForMeal({ ...woman, weightKg: 1000 }, 30, 'dinner')).toBeNull();
    expect(goalForMeal(woman, null, 'dinner')).not.toBeNull(); // unknown age → a sensible default
  });
});

describe('how a serving fits', () => {
  const dinner = { calories: 600, protein: 40, carbs: 75 };

  test('lose: a light, high-protein plate scores best and gets a reason', () => {
    const light = goalFit(dish({ calories: 480, protein: 38 }), 'lose', dinner);
    const heavy = goalFit(dish({ calories: 950, protein: 30 }), 'lose', dinner);
    expect(light.score).toBeGreaterThan(heavy.score);
    expect(light.reason).toMatch(/fits your goal/i);
    expect(light.portion).toBeNull();
  });

  test('lose: a heavy plate gets a portion, not a ban', () => {
    const heavy = goalFit(dish({ calories: 900, protein: 30 }), 'lose', dinner);
    expect(heavy.score).toBeGreaterThan(0);
    expect(heavy.portion).toMatch(/½|¾|Half/);
    const huge = goalFit(dish({ calories: 1500, protein: 30 }), 'lose', dinner);
    expect(huge.portion).toMatch(/Half a serving/);
  });

  test('gain: protein decides; low-protein plates are told what to add', () => {
    const steak = goalFit(dish({ calories: 650, protein: 45 }), 'gain', dinner);
    const pasta = goalFit(dish({ calories: 650, protein: 12 }), 'gain', dinner);
    expect(steak.score).toBeGreaterThan(pasta.score);
    expect(steak.reason).toMatch(/protein/);
    expect(pasta.portion).toMatch(/protein side/);
  });

  test('maintain: about right in the middle, advice at the edges', () => {
    expect(goalFit(dish({ calories: 580, protein: 30 }), 'maintain', dinner).reason).toMatch(/About right/);
    expect(goalFit(dish({ calories: 1000, protein: 30 }), 'maintain', dinner).portion).toMatch(/smaller serving/);
    expect(goalFit(dish({ calories: 250, protein: 10 }), 'maintain', dinner).portion).toMatch(/light side/);
  });

  test('performance: complex carbs plus protein beats a low-carb plate', () => {
    const bowl = goalFit(dish({ calories: 650, protein: 35, carbs: 80, names: ['chicken breast', 'brown rice', 'broccoli'] }), 'performance', dinner);
    const salad = goalFit(dish({ calories: 350, protein: 30, carbs: 12, names: ['chicken breast', 'lettuce'] }), 'performance', dinner);
    expect(bowl.score).toBeGreaterThan(salad.score);
    expect(bowl.reason).toMatch(/fuel|Fuel/);
    expect(salad.portion).toMatch(/carb side/);
  });

  test('health: veg-forward and clean scores; bacon gets a salt note', () => {
    const veg = goalFit(dish({ calories: 550, protein: 25, names: ['quinoa', 'spinach', 'tomato', 'chickpeas'], plate: { produce: 55, protein: 20, carbs: 20, healthyFats: 5 } }), 'health', dinner);
    const fry = goalFit(dish({ calories: 800, protein: 25, names: ['bacon', 'white bread', 'butter'], plate: { produce: 5, protein: 30, carbs: 45, healthyFats: 20 } }), 'health', dinner);
    expect(veg.score).toBeGreaterThan(fry.score);
    expect(veg.reason).toMatch(/Heart-friendly/);
    expect(fry.portion).toMatch(/vegetable side|bacon/);
  });

  test('energy: protein with fiber is steady; dessert is a crash', () => {
    const steady = goalFit(dish({ calories: 500, protein: 30, names: ['eggs', 'oats', 'spinach', 'walnuts'] }), 'energy', dinner);
    const cake = goalFit(dish({ calories: 500, protein: 5, vibe: 'sweet', names: ['sugar', 'flour', 'butter'] }), 'energy', dinner);
    expect(steady.score).toBeGreaterThan(cake.score);
    expect(steady.reason).toMatch(/Steady energy|Mood food/);
    expect(cake.portion).toMatch(/spike/);
  });
});

describe('nutrition focuses', () => {
  test('fiber: lentils and oats count, plain chicken and rice do not', () => {
    expect(checkFocus(dish({ calories: 1, protein: 1, names: ['red lentils', 'rolled oats', 'chia seeds'] }), 'fiber').hit).toBe(true);
    const plain = checkFocus(dish({ calories: 1, protein: 1, names: ['chicken thigh', 'white rice'], plate: { produce: 5, protein: 50, carbs: 40, healthyFats: 5 } }), 'fiber');
    expect(plain.hit).toBe(false);
    expect(plain.addTip).toMatch(/chia|beans|berries/);
  });

  test('rainbow: three colors is a hit, colors are counted once each', () => {
    const r = dish({ calories: 1, protein: 1, names: ['cherry tomatoes', 'carrots', 'baby spinach', 'red onion'] });
    expect(distinctColors(r)).toEqual(expect.arrayContaining(['red', 'orange', 'green']));
    expect(checkFocus(r, 'rainbow').hit).toBe(true);
    expect(checkFocus(dish({ calories: 1, protein: 1, names: ['tomato', 'rice'] }), 'rainbow').addTip).toMatch(/two more colors/);
  });

  test('lean protein: chicken breast yes, bacon no, and the swap is named', () => {
    expect(checkFocus(dish({ calories: 400, protein: 35, fat: 8, names: ['chicken breast', 'rice'] }), 'leanProtein').hit).toBe(true);
    const b = checkFocus(dish({ calories: 600, protein: 20, fat: 40, names: ['bacon', 'eggs'] }), 'leanProtein');
    expect(b.hit).toBe(false);
    expect(b.addTip).toMatch(/Swap bacon/);
  });

  test('healthy fats and fermented foods are read off the ingredients', () => {
    expect(checkFocus(dish({ calories: 1, protein: 1, names: ['avocado', 'extra virgin olive oil'] }), 'healthyFats').hit).toBe(true);
    expect(checkFocus(dish({ calories: 1, protein: 1, names: ['shortening', 'flour'] }), 'healthyFats').hit).toBe(false);
    expect(checkFocus(dish({ calories: 1, protein: 1, names: ['kimchi', 'rice'] }), 'fermented').reason).toMatch(/kimchi/);
    expect(checkFocus(dish({ calories: 1, protein: 1, names: ['rice'] }), 'fermented').hit).toBe(false);
  });

  test('focusFit averages the chosen focuses and offers one tip', () => {
    const r = dish({ calories: 1, protein: 1, names: ['lentils', 'oats', 'kimchi', 'bacon'] });
    const f = focusFit(r, ['fiber', 'fermented', 'leanProtein']);
    expect(f.checks).toHaveLength(3);
    expect(f.score).toBeGreaterThan(0.6);
    expect(f.reason).toMatch(/fiber|fermented/i);
    expect(f.tip).toMatch(/Swap bacon/);
    expect(focusFit(r, []).checks).toHaveLength(0);
  });
});

describe('units', () => {
  test('height and weight round-trip', () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, in: 11 });
    expect(ftInToCm(5, 11)).toBe(180);
    expect(kgToLb(70)).toBe(154);
    expect(lbToKg(154)).toBeCloseTo(69.9, 1);
    expect(formatHeight(165)).toBe('5′ 5″');
    expect(formatHeight(165, 'metric')).toBe('165 cm');
  });
});
