// Run: npx tsx tests/weekPlan.test.ts
import { RECIPES } from '../constants/recipes';
import { suitsMeal } from '../utils/meals';
import { profileOf } from '../utils/thisOrThat';
import { addDays, dishType, fillWeek, ingredientsToBuy, weekDays, PLAN_SLOTS } from '../utils/weekPlan';
import type { PlanSlot, PlannedMeal, Recipe, UserPreferences } from '../types';

let passed = 0;
const eq = (actual: unknown, expected: unknown, what: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  passed++;
};
const ok = (cond: boolean, what: string) => eq(cond, true, what);

// ---- Dates
eq(addDays('2026-09-28', 5), '2026-10-03', 'across a month');
eq(addDays('2026-12-30', 3), '2027-01-02', 'across a year');
eq(addDays('2028-02-28', 1), '2028-02-29', 'leap day');
eq(addDays('2026-11-01', 1), '2026-11-02', 'across the daylight-saving change');
const days = weekDays('2026-09-25');
eq(days.map(d => d.short), ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'], 'weekday names');
eq([days[0].title, days[1].title, days[2].title, days[0].date, days[6].date], ['Today', 'Tomorrow', 'Sunday', 'Fri, Sep 25', 'Thu, Oct 1'], 'labels');

// ---- Filling the week
const prefs: UserPreferences = {
  name: '', dietary: [], avoidAllergens: [], maxCookMinutes: null, preferredDifficulty: null, householdSize: 2,
  favoriteTags: [], dislikedTags: [], spiceTolerance: null, cuisines: [], customAllergies: [], customAvoid: [], customLoves: [],
};
const libraries: Record<PlanSlot, Recipe[]> = {
  breakfast: RECIPES.filter(r => suitsMeal(r, 'breakfast')),
  lunch: RECIPES.filter(r => suitsMeal(r, 'lunch')),
  dinner: RECIPES.filter(r => suitsMeal(r, 'dinner')),
};
const byId = new Map(RECIPES.map(r => [r.id, r]));
const dates = days.map(d => d.iso);
const slots = PLAN_SLOTS.map(s => s.key).filter(s => libraries[s].length > 0);
console.log('curated library sizes:', Object.fromEntries(slots.map(s => [s, libraries[s].length])));

for (let trial = 1; trial <= 25; trial++) {
  let seed = trial * 7919;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const added = fillWeek(dates, slots, libraries, [], byId, { preferences: prefs, random: rnd });
  if (trial === 1) eq(added.length, dates.length * slots.length, 'every slot filled');
  for (const slot of slots) if (libraries[slot].length >= dates.length) {
    const ids = added.filter(p => p.slot === slot).map(p => p.recipeId);
    ok(new Set(ids).size === ids.length, `trial ${trial}: no ${slot} twice in a week`);
  }
  for (const slot of slots) {
    const row = dates.map(d => added.find(p => p.date === d && p.slot === slot)!).map(p => byId.get(p.recipeId)!);
    for (let i = 1; i < row.length; i++) {
      ok(row[i].id !== row[i - 1].id, `trial ${trial}: ${slot} same dish two days running`);
      if (libraries[slot].length < 20) continue; // e.g. only 4 curated breakfasts offline
      const a = profileOf(row[i - 1])['protein-type'];
      const b = profileOf(row[i])['protein-type'];
      ok(!a || a !== b, `trial ${trial}: ${slot} ${dates[i]} repeats yesterday's protein (${a})`);
    }
    if (libraries[slot].length < 20) continue;
    const types = row.map(dishType).filter(t => t !== 'other');
    const worst = Math.max(0, ...[...new Set(types)].map(t => types.filter(x => x === t).length));
    ok(worst <= 3, `trial ${trial}: ${slot} uses one dish type ${worst} times`);
  }
}

// Keeps what's already planned and fills around it
const kept: PlannedMeal = { id: 'x', date: dates[0], slot: 'dinner', recipeId: libraries.dinner[0].id, name: 'x', emoji: 'x', cooked: false, addedAt: 0 };
const around = fillWeek(dates.slice(0, 2), ['dinner'], libraries, [kept], byId, { preferences: prefs });
eq(around.map(p => p.date), [dates[1]], 'only the empty slot is filled');
ok(around[0].recipeId !== kept.recipeId, 'and not with the recipe already planned');

// Favorites get picked more
let favHits = 0;
const fav = libraries.dinner[5];
for (let t = 0; t < 40; t++) {
  const a = fillWeek([dates[0]], ['dinner'], libraries, [], byId, { preferences: prefs, favoriteIds: new Set([fav.id]) });
  if (a[0].recipeId === fav.id) favHits++;
}
ok(favHits > 0, 'a favorite can be chosen');

// ---- Shopping
const r1 = libraries.dinner[0];
const plan: PlannedMeal[] = [
  { id: 'a', date: dates[0], slot: 'dinner', recipeId: r1.id, name: r1.name, emoji: '', cooked: false, addedAt: 0 },
  { id: 'b', date: dates[1], slot: 'dinner', recipeId: r1.id, name: r1.name, emoji: '', cooked: true, addedAt: 0 },
];
const need = ingredientsToBuy(plan, byId, () => false);
eq(need.length, new Set(r1.ingredients.filter(i => !i.optional).map(i => i.name.trim().toLowerCase())).size, 'each missing ingredient once');
eq(ingredientsToBuy(plan, byId, () => true), [], 'nothing to buy when the pantry has it all');
eq(ingredientsToBuy([{ ...plan[0], cooked: true }], byId, () => false), [], 'cooked meals need nothing');

console.log(`weekPlan: all ${passed} checks passed`);
