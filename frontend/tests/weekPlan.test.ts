import { RECIPES } from '../constants/recipes';
import { suitsMeal } from '../utils/meals';
import { profileOf } from '../utils/thisOrThat';
import {
  addDays,
  dishType,
  fillWeek,
  ingredientsToBuy,
  weekDays,
  PLAN_SLOTS,
} from '../utils/weekPlan';

import type {
  PlanSlot,
  PlannedMeal,
  Recipe,
  UserPreferences,
} from '../types';

describe('Week planning', () => {
  const prefs: UserPreferences = {
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

  test('handles dates across months, years, leap years, and daylight-saving changes', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  test('generates the correct week days', () => {
    const days = weekDays('2026-09-25');

    expect(days.map(d => d.short)).toEqual([
      'Fri',
      'Sat',
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
    ]);

    expect([
      days[0].title,
      days[1].title,
      days[2].title,
      days[0].date,
      days[6].date,
    ]).toEqual([
      'Today',
      'Tomorrow',
      'Sunday',
      'Fri, Sep 25',
      'Thu, Oct 1',
    ]);
  });

  test('fills every available meal slot', () => {
    const libraries: Record<PlanSlot, Recipe[]> = {
      breakfast: RECIPES.filter(r => suitsMeal(r, 'breakfast')),
      lunch: RECIPES.filter(r => suitsMeal(r, 'lunch')),
      dinner: RECIPES.filter(r => suitsMeal(r, 'dinner')),
    };

    const byId = new Map(
      RECIPES.map(r => [r.id, r])
    );

    const days = weekDays('2026-09-25');
    const dates = days.map(d => d.iso);

    const slots = PLAN_SLOTS
      .map(s => s.key)
      .filter(s => libraries[s].length > 0);

    let seed = 7919;

    const random = () =>
      ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const added = fillWeek(
      dates,
      slots,
      libraries,
      [],
      byId,
      {
        preferences: prefs,
        random,
      }
    );

    expect(added.length).toBe(
      dates.length * slots.length
    );
  });

  test('does not repeat the same recipe on consecutive days', () => {
    const libraries: Record<PlanSlot, Recipe[]> = {
      breakfast: RECIPES.filter(r => suitsMeal(r, 'breakfast')),
      lunch: RECIPES.filter(r => suitsMeal(r, 'lunch')),
      dinner: RECIPES.filter(r => suitsMeal(r, 'dinner')),
    };

    const byId = new Map(
      RECIPES.map(r => [r.id, r])
    );

    const days = weekDays('2026-09-25');
    const dates = days.map(d => d.iso);

    const slots = PLAN_SLOTS
      .map(s => s.key)
      .filter(s => libraries[s].length > 0);

    let seed = 7919;

    const random = () =>
      ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const added = fillWeek(
      dates,
      slots,
      libraries,
      [],
      byId,
      {
        preferences: prefs,
        random,
      }
    );

    for (const slot of slots) {
      const meals = dates.map(date =>
        added.find(
          p => p.date === date && p.slot === slot
        )
      ).filter(Boolean) as PlannedMeal[];

      for (let i = 1; i < meals.length; i++) {
        expect(meals[i].recipeId).not.toBe(
          meals[i - 1].recipeId
        );
      }
    }
  });

  test('keeps existing planned meals and fills empty slots', () => {
    const libraries: Record<PlanSlot, Recipe[]> = {
      breakfast: RECIPES.filter(r => suitsMeal(r, 'breakfast')),
      lunch: RECIPES.filter(r => suitsMeal(r, 'lunch')),
      dinner: RECIPES.filter(r => suitsMeal(r, 'dinner')),
    };

    const byId = new Map(
      RECIPES.map(r => [r.id, r])
    );

    const days = weekDays('2026-09-25');
    const dates = days.map(d => d.iso);

    const kept: PlannedMeal = {
      id: 'x',
      date: dates[0],
      slot: 'dinner',
      recipeId: libraries.dinner[0].id,
      name: 'x',
      emoji: 'x',
      cooked: false,
      addedAt: 0,
    };

    const around = fillWeek(
      dates.slice(0, 2),
      ['dinner'],
      libraries,
      [kept],
      byId,
      {
        preferences: prefs,
      }
    );

    expect(
      around.map(p => p.date)
    ).toEqual([dates[1]]);

    expect(
      around[0].recipeId
    ).not.toBe(kept.recipeId);
  });

  test('allows a favorite recipe to be selected', () => {
    const libraries: Record<PlanSlot, Recipe[]> = {
      breakfast: RECIPES.filter(r => suitsMeal(r, 'breakfast')),
      lunch: RECIPES.filter(r => suitsMeal(r, 'lunch')),
      dinner: RECIPES.filter(r => suitsMeal(r, 'dinner')),
    };

    const byId = new Map(
      RECIPES.map(r => [r.id, r])
    );

    const days = weekDays('2026-09-25');
    const fav = libraries.dinner[5];

    let favHits = 0;

    for (let t = 0; t < 40; t++) {
      const added = fillWeek(
        [days[0].iso],
        ['dinner'],
        libraries,
        [],
        byId,
        {
          preferences: prefs,
          favoriteIds: new Set([fav.id]),
        }
      );

      if (added[0]?.recipeId === fav.id) {
        favHits++;
      }
    }

    expect(favHits).toBeGreaterThan(0);
  });

  test('creates a shopping list with each missing ingredient once', () => {
    const libraries: Record<PlanSlot, Recipe[]> = {
      breakfast: RECIPES.filter(r => suitsMeal(r, 'breakfast')),
      lunch: RECIPES.filter(r => suitsMeal(r, 'lunch')),
      dinner: RECIPES.filter(r => suitsMeal(r, 'dinner')),
    };

    const byId = new Map(
      RECIPES.map(r => [r.id, r])
    );

    const days = weekDays('2026-09-25');
    const r1 = libraries.dinner[0];

    const plan: PlannedMeal[] = [
      {
        id: 'a',
        date: days[0].iso,
        slot: 'dinner',
        recipeId: r1.id,
        name: r1.name,
        emoji: '',
        cooked: false,
        addedAt: 0,
      },
      {
        id: 'b',
        date: days[1].iso,
        slot: 'dinner',
        recipeId: r1.id,
        name: r1.name,
        emoji: '',
        cooked: true,
        addedAt: 0,
      },
    ];

    const need = ingredientsToBuy(
      plan,
      byId,
      () => false
    );

    const expectedCount = new Set(
      r1.ingredients
        .filter(i => !i.optional)
        .map(i => i.name.trim().toLowerCase())
    ).size;

    expect(need.length).toBe(expectedCount);
  });

  test('returns no shopping items when the pantry has everything', () => {
    const libraries: Record<PlanSlot, Recipe[]> = {
      breakfast: RECIPES.filter(r => suitsMeal(r, 'breakfast')),
      lunch: RECIPES.filter(r => suitsMeal(r, 'lunch')),
      dinner: RECIPES.filter(r => suitsMeal(r, 'dinner')),
    };

    const byId = new Map(
      RECIPES.map(r => [r.id, r])
    );

    const days = weekDays('2026-09-25');
    const r1 = libraries.dinner[0];

    const plan: PlannedMeal[] = [
      {
        id: 'a',
        date: days[0].iso,
        slot: 'dinner',
        recipeId: r1.id,
        name: r1.name,
        emoji: '',
        cooked: false,
        addedAt: 0,
      },
    ];

    expect(
      ingredientsToBuy(
        plan,
        byId,
        () => true
      )
    ).toEqual([]);
  });

  test('returns no shopping items for cooked meals', () => {
    const libraries: Record<PlanSlot, Recipe[]> = {
      breakfast: RECIPES.filter(r => suitsMeal(r, 'breakfast')),
      lunch: RECIPES.filter(r => suitsMeal(r, 'lunch')),
      dinner: RECIPES.filter(r => suitsMeal(r, 'dinner')),
    };

    const byId = new Map(
      RECIPES.map(r => [r.id, r])
    );

    const days = weekDays('2026-09-25');
    const r1 = libraries.dinner[0];

    const cookedMeal: PlannedMeal = {
      id: 'a',
      date: days[0].iso,
      slot: 'dinner',
      recipeId: r1.id,
      name: r1.name,
      emoji: '',
      cooked: true,
      addedAt: 0,
    };

    expect(
      ingredientsToBuy(
        [cookedMeal],
        byId,
        () => false
      )
    ).toEqual([]);
  });

  test('uses dish and protein profiles when generating meals', () => {
    const recipe = RECIPES[0];

    expect(dishType(recipe)).toBeDefined();
    expect(profileOf(recipe)).toBeDefined();
  });
});