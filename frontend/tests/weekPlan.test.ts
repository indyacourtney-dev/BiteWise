import { RECIPES } from '../constants/recipes';
import { suitsMeal } from '../utils/meals';
import { profileOf } from '../utils/thisOrThat';
import {
  addDays,
  clearPlanRange,
  dishType,
  fillWeek,
  ingredientsToBuy,
  planSlotKey,
  rolloverLeftovers,
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

  test('keeps Today and Tomorrow labels when browsing another week', () => {
    const days = weekDays('2026-10-19', 7, '2026-10-14');
    expect(days[0].title).toBe('Monday');
    expect(weekDays('2026-10-12', 7, '2026-10-14').slice(2, 4).map(day => day.title)).toEqual(['Today', 'Tomorrow']);
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

    const plannedSlots = new Set(added.map(meal => `${meal.date}|${meal.slot}`));
    expect(dates.every(date => slots.every(slot => plannedSlots.has(`${date}|${slot}`)))).toBe(true);
    expect(added.every(meal => (meal.servings ?? 0) >= prefs.householdSize)).toBe(true);
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
      ).filter((meal): meal is PlannedMeal => !!meal && !meal.isLeftovers);

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
      around.filter(p => !p.isLeftovers).map(p => p.date)
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

  test('scales quantities by planned servings and combines compatible units', () => {
    const recipe: Recipe = {
      ...RECIPES[0],
      id: 'portion-test',
      name: 'Portion test',
      servings: 2,
      ingredients: [
        { name: 'olive oil', amount: '1 cup', category: 'pantry' },
        { name: 'garlic', amount: '2 cloves', category: 'produce' },
      ],
    };
    const plan: PlannedMeal[] = [
      { id: 'one', date: '2026-10-14', slot: 'dinner', recipeId: recipe.id, name: recipe.name, emoji: '', cooked: false, servings: 4, addedAt: 0 },
      { id: 'two', date: '2026-10-15', slot: 'dinner', recipeId: recipe.id, name: recipe.name, emoji: '', cooked: false, servings: 2, addedAt: 0 },
    ];

    const need = ingredientsToBuy(plan, new Map([[recipe.id, recipe]]), () => false);
    expect(need).toEqual([
      { name: 'garlic', quantity: 6, unit: 'cloves', category: 'produce', forRecipes: ['Portion test'] },
      { name: 'olive oil', quantity: 3, unit: 'cups', category: 'pantry', forRecipes: ['Portion test'] },
    ]);
  });

  test('keeps incompatible ingredient units separate', () => {
    const recipeA: Recipe = {
      ...RECIPES[0], id: 'unit-a', name: 'Recipe A', servings: 1,
      ingredients: [{ name: 'tomato', amount: '1 can', category: 'pantry' }],
    };
    const recipeB: Recipe = {
      ...RECIPES[0], id: 'unit-b', name: 'Recipe B', servings: 1,
      ingredients: [{ name: 'tomato', amount: '2 cups', category: 'produce' }],
    };
    const plan: PlannedMeal[] = [recipeA, recipeB].map((recipe, index) => ({
      id: String(index), date: `2026-10-${14 + index}`, slot: 'dinner', recipeId: recipe.id,
      name: recipe.name, emoji: '', cooked: false, servings: 1, addedAt: 0,
    }));
    const need = ingredientsToBuy(plan, new Map([[recipeA.id, recipeA], [recipeB.id, recipeB]]), () => false);
    expect(need).toHaveLength(2);
    expect(need.map(item => item.unit).sort()).toEqual(['cans', 'cups']);
  });

  test('converts compatible volume units before combining ingredients', () => {
    const recipeA: Recipe = {
      ...RECIPES[0], id: 'volume-a', name: 'Recipe A', servings: 1,
      ingredients: [{ name: 'olive oil', amount: '1 cup', category: 'pantry' }],
    };
    const recipeB: Recipe = {
      ...RECIPES[0], id: 'volume-b', name: 'Recipe B', servings: 1,
      ingredients: [{ name: 'olive oil', amount: '2 tbsp', category: 'pantry' }],
    };
    const plan: PlannedMeal[] = [recipeA, recipeB].map((recipe, index) => ({
      id: String(index), date: `2026-10-${14 + index}`, slot: 'dinner', recipeId: recipe.id,
      name: recipe.name, emoji: '', cooked: false, servings: 1, addedAt: 0,
    }));
    const need = ingredientsToBuy(plan, new Map([[recipeA.id, recipeA], [recipeB.id, recipeB]]), () => false);
    expect(need).toHaveLength(1);
    expect(need[0]).toMatchObject({ name: 'olive oil', quantity: 1.13, unit: 'cups' });
  });

  test('does not add ingredients for leftovers, takeout, or no-cook days', () => {
    const recipe: Recipe = {
      ...RECIPES[0], id: 'status-test', ingredients: [{ name: 'rice', amount: '2 cups', category: 'grains' }],
    };
    const dates = ['2026-10-14', '2026-10-15', '2026-10-16'];
    const plan: PlannedMeal[] = dates.map((date, index) => ({
      id: String(index), date, slot: 'dinner', recipeId: recipe.id, name: recipe.name,
      emoji: '', cooked: false, addedAt: 0,
    }));
    const statuses = { [dates[0]]: 'leftovers', [dates[1]]: 'takeout', [dates[2]]: 'no-cook' } as const;
    expect(ingredientsToBuy(plan, new Map([[recipe.id, recipe]]), () => false, statuses)).toEqual([]);
  });

  test('dinner leftovers can use lunch and dinner without replacing planned meals', () => {
    const source: PlannedMeal = {
      id: 'source', date: '2026-10-14', slot: 'dinner', recipeId: 'recipe', name: 'Pasta', emoji: '🍝',
      cooked: false, servings: 6, addedAt: 0,
    };
    const occupied: PlannedMeal = {
      id: 'planned-lunch', date: '2026-10-15', slot: 'lunch', recipeId: 'other', name: 'Soup', emoji: '🍲',
      cooked: false, servings: 2, addedAt: 0,
    };
    const leftovers = rolloverLeftovers(source, [source, occupied], 2, {}, {}, 100);
    expect(leftovers.map(meal => [meal.date, meal.slot, meal.mealServings])).toEqual([
      ['2026-10-15', 'dinner', 2],
      ['2026-10-16', 'lunch', 2],
    ]);
    expect(leftovers.every(meal => meal.isLeftovers && meal.leftoverSourceKey === '2026-10-14|dinner|recipe')).toBe(true);
  });

  test('does not allocate surplus into takeout days or occupied leftovers slots', () => {
    const source: PlannedMeal = {
      id: 'source', date: '2026-10-14', slot: 'dinner', recipeId: 'recipe', name: 'Pasta', emoji: '🍝',
      cooked: false, servings: 4, addedAt: 0,
    };
    const allocated = rolloverLeftovers(
      source,
      [source],
      2,
      { '2026-10-15': 'takeout' },
      { [planSlotKey('2026-10-16', 'lunch')]: 'leftovers' },
      100,
    );
    expect(allocated).toEqual([
      expect.objectContaining({ date: '2026-10-16', slot: 'dinner', servings: 2, mealServings: 2, isLeftovers: true }),
    ]);
  });

  test('lunch leftovers can roll into lunch and dinner slots only', () => {
    const source: PlannedMeal = {
      id: 'source', date: '2026-10-14', slot: 'lunch', recipeId: 'recipe', name: 'Pasta', emoji: '🍝',
      cooked: false, servings: 5, mealServings: 1, addedAt: 0,
    };
    const leftovers = rolloverLeftovers(source, [source], 1, {}, {}, 100);
    expect(leftovers.map(meal => [meal.date, meal.slot])).toEqual([
      ['2026-10-14', 'dinner'],
      ['2026-10-15', 'lunch'],
      ['2026-10-15', 'dinner'],
      ['2026-10-16', 'lunch'],
    ]);
  });

  test('auto-fill spreads a four-serving batch over four meal slots', () => {
    const recipe: Recipe = { ...RECIPES[0], id: 'four-meals', name: 'Crispy beef tacos', servings: 4 };
    const dates = ['2026-10-14'];
    const added = fillWeek(
      dates,
      ['breakfast'],
      { breakfast: [recipe], lunch: [recipe], dinner: [recipe] },
      [],
      new Map([[recipe.id, recipe]]),
      { preferences: { ...prefs, householdSize: 1 }, random: () => 0 },
      100,
    );

    expect(added.map(meal => [meal.date, meal.slot, meal.mealServings, !!meal.isLeftovers])).toEqual([
      ['2026-10-14', 'breakfast', 1, false],
      ['2026-10-15', 'breakfast', 1, true],
      ['2026-10-16', 'breakfast', 1, true],
      ['2026-10-17', 'breakfast', 1, true],
    ]);
    expect(added.reduce((total, meal) => total + (meal.mealServings ?? 0), 0)).toBe(4);
  });

  test('does not shop for a per-slot leftovers entry', () => {
    const recipe: Recipe = {
      ...RECIPES[0], id: 'slot-leftovers', ingredients: [{ name: 'rice', amount: '2 cups', category: 'grains' }],
    };
    const planned: PlannedMeal = {
      id: 'slot-meal', date: '2026-10-14', slot: 'breakfast', recipeId: recipe.id, name: recipe.name,
      emoji: '', cooked: false, servings: 2, addedAt: 0,
    };
    const needed = ingredientsToBuy(
      [planned],
      new Map([[recipe.id, recipe]]),
      () => false,
      {},
      { [planSlotKey(planned.date, planned.slot)]: 'leftovers' },
    );
    expect(needed).toEqual([]);
  });

  test('clears a week and its linked rollover portions without changing other weeks', () => {
    const source: PlannedMeal = {
      id: 'source', date: '2026-10-14', slot: 'dinner', recipeId: 'recipe', name: 'Pasta', emoji: '',
      cooked: false, servings: 4, mealServings: 2, addedAt: 0,
    };
    const linkedRollover: PlannedMeal = {
      id: 'rollover', date: '2026-10-21', slot: 'dinner', recipeId: 'recipe', name: 'Pasta', emoji: '',
      cooked: false, servings: 2, mealServings: 2, isLeftovers: true,
      leftoverSourceKey: '2026-10-14|dinner|recipe', addedAt: 0,
    };
    const outside: PlannedMeal = {
      id: 'outside', date: '2026-10-22', slot: 'lunch', recipeId: 'other', name: 'Soup', emoji: '',
      cooked: false, servings: 2, mealServings: 2, addedAt: 0,
    };
    const cleared = clearPlanRange(
      [source, linkedRollover, outside],
      { '2026-10-14': 'takeout', '2026-10-22': 'no-cook' },
      { [planSlotKey('2026-10-14', 'breakfast')]: 'leftovers', [planSlotKey('2026-10-22', 'lunch')]: 'leftovers' },
      '2026-10-14',
      '2026-10-20',
    );
    expect(cleared.meals).toEqual([outside]);
    expect(cleared.dayStatuses).toEqual({ '2026-10-22': 'no-cook' });
    expect(cleared.slotStatuses).toEqual({ [planSlotKey('2026-10-22', 'lunch')]: 'leftovers' });
  });

  test('uses dish and protein profiles when generating meals', () => {
    const recipe = RECIPES[0];

    expect(dishType(recipe)).toBeDefined();
    expect(profileOf(recipe)).toBeDefined();
  });
});