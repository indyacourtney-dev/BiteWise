// tests/goals.test.ts — goals turn into sensible, safe targets.

import {
  dailyTargets, goalFit, goalForMeal, isCompleteGoals, mealTargets, restingEnergy,
  cmToFtIn, ftInToCm, kgToLb, lbToKg, formatHeight, type NutritionGoals,
} from '../utils/goals';

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
  const dinner = { calories: 600, protein: 40 };

  test('lose: a light, high-protein plate scores best and gets a reason', () => {
    const light = goalFit({ calories: 480, protein: 38 }, 'lose', dinner);
    const heavy = goalFit({ calories: 950, protein: 30 }, 'lose', dinner);
    expect(light.score).toBeGreaterThan(heavy.score);
    expect(light.reason).toMatch(/fits your goal/i);
    expect(light.portion).toBeNull();
  });

  test('lose: a heavy plate gets a portion, not a ban', () => {
    const heavy = goalFit({ calories: 900, protein: 30 }, 'lose', dinner);
    expect(heavy.score).toBeGreaterThan(0);
    expect(heavy.portion).toMatch(/½|¾|Half/);
    const huge = goalFit({ calories: 1500, protein: 30 }, 'lose', dinner);
    expect(huge.portion).toMatch(/Half a serving/);
  });

  test('gain: protein decides; low-protein plates are told what to add', () => {
    const steak = goalFit({ calories: 650, protein: 45 }, 'gain', dinner);
    const pasta = goalFit({ calories: 650, protein: 12 }, 'gain', dinner);
    expect(steak.score).toBeGreaterThan(pasta.score);
    expect(steak.reason).toMatch(/protein/);
    expect(pasta.portion).toMatch(/protein side/);
  });

  test('maintain: about right in the middle, advice at the edges', () => {
    expect(goalFit({ calories: 580, protein: 30 }, 'maintain', dinner).reason).toMatch(/About right/);
    expect(goalFit({ calories: 1000, protein: 30 }, 'maintain', dinner).portion).toMatch(/smaller serving/);
    expect(goalFit({ calories: 250, protein: 10 }, 'maintain', dinner).portion).toMatch(/light side/);
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
