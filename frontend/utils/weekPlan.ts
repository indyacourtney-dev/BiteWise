// utils/weekPlan.ts — the logic behind Plan my week (app/planWeek.tsx).
//
// A plan is a list of PlannedMeal: one recipe in one slot (breakfast,
// lunch or dinner) on one date ('YYYY-MM-DD'). The screen shows 7 days
// from today. Nothing here touches React, so it's tested in
// tests/weekPlan.test.ts.
//
// FILLING THE WEEK (fillWeek)
// Each empty slot gets the best-scoring recipe from that meal's library
// (curated + database recipes, already filtered for allergies, diets and
// age). Score = a little randomness, plus:
//   +1.5  it's one of your favorites     +0.4 per food you said you love
//   -0.6 per food you'd rather skip
//   -3    same main protein as the same meal the day before
//   -2    that protein is already used twice this week for this meal
//   -1.2 per earlier use of the same dish type this week (tacos, pasta...)
//   minus a fading penalty for dishes suggested or eaten in the last few
//   days (utils/variety.ts), so next week doesn't repeat this one
// A recipe isn't used twice in the same week. If a meal's library runs
// out (offline, with only the curated recipes), repeats are allowed again,
// but never the dish from the day before.

import { favoriteOverlap, dislikeOverlap } from './matching';
import { profileOf } from './thisOrThat';
import type { PantryCategoryId, PantryItem, PlannedMeal, PlanDayStatus, PlanSlot, Recipe, UserPreferences } from '../types';

export const PLAN_SLOTS: { key: PlanSlot; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🥪' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // midday: no daylight-saving edge cases
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export interface PlanDay {
  iso: string;
  /** "Today", "Tomorrow", or the weekday */
  title: string;
  /** "Fri, Sep 25" */
  date: string;
  short: string; // "Fri"
  dayNum: number;
}

export function weekDays(startIso: string, count = 7, today = startIso): PlanDay[] {
  return Array.from({ length: count }, (_, i) => {
    const iso = addDays(startIso, i);
    const d = toDate(iso);
    const weekday = DAY_NAMES[d.getDay()];
    return {
      iso,
      title: iso === today ? 'Today' : iso === addDays(today, 1) ? 'Tomorrow' : weekday,
      date: `${weekday.slice(0, 3)}, ${MONTHS[d.getMonth()]} ${d.getDate()}`,
      short: weekday.slice(0, 3),
      dayNum: d.getDate(),
    };
  });
}

// ---------- variety helpers ----------

const DISH_TYPES: [string, RegExp][] = [
  ['taco', /\btacos?\b/],
  ['pasta', /\b(pasta|penne|spaghetti|carbonara|lasagna|linguine|fettuccine|rigatoni|ziti|macaroni)\b/],
  ['noodles', /\b(noodles?|pad thai|lo mein|ramen)\b/],
  ['curry', /\bcurry\b/],
  ['bowl', /\bbowls?\b/],
  ['salad', /\b(salad|slaw)\b/],
  ['soup', /\b(soup|stew|chili|gumbo)\b/],
  ['sandwich', /\b(sandwich|burger|wrap|flatbread|sub)\b/],
  ['skillet', /\b(skillet|stir[- ]?fry|fried rice|sheet[- ]pan)\b/],
  ['eggs', /\b(eggs?|omelet|frittata|scramble)\b/],
  ['pancakes', /\b(pancakes?|waffles?|french toast)\b/],
  ['oats', /\b(oats|oatmeal|granola|parfait|yogurt)\b/],
];
export function dishType(recipe: Pick<Recipe, 'name'>): string {
  const n = recipe.name.toLowerCase();
  return DISH_TYPES.find(([, re]) => re.test(n))?.[0] ?? 'other';
}
const proteinOf = (r: Recipe) => profileOf(r)['protein-type'];

export interface FillOptions {
  preferences: UserPreferences;
  favoriteIds?: Set<string>;
  random?: () => number;
  dayStatuses?: Record<string, PlanDayStatus>;
  slotStatuses?: Record<string, PlanDayStatus>;
  /** Points to subtract, e.g. for dishes suggested or eaten recently (utils/variety.ts). */
  penalty?: (r: Recipe) => number;
}

/** Best recipe for one slot, given what's already planned. null if nothing is left. */
export function pickForSlot(
  date: string,
  slot: PlanSlot,
  library: Recipe[],
  plan: PlannedMeal[],
  recipesById: Map<string, Recipe>,
  opts: FillOptions,
): Recipe | null {
  const rand = opts.random ?? Math.random;
  const used = new Set(plan.map(p => p.recipeId));
  const sameSlot = plan.filter(p => p.slot === slot).map(p => recipesById.get(p.recipeId)).filter(Boolean) as Recipe[];
  const yesterday = plan.find(p => p.slot === slot && p.date === addDays(date, -1));
  const yesterdayProtein = yesterday ? proteinOf(recipesById.get(yesterday.recipeId) ?? ({} as Recipe)) : null;
  const proteinCount = new Map<string, number>();
  const typeCount = new Map<string, number>();
  for (const r of sameSlot) {
    const pr = proteinOf(r);
    if (pr) proteinCount.set(pr, (proteinCount.get(pr) ?? 0) + 1);
    typeCount.set(dishType(r), (typeCount.get(dishType(r)) ?? 0) + 1);
  }
  const loves = [...(opts.preferences.favoriteTags ?? []), ...(opts.preferences.customLoves ?? [])];
  const dislikes = opts.preferences.dislikedTags ?? [];

  const fresh = library.filter(r => !used.has(r.id));
  const yesterdayId = yesterday?.recipeId;
  const candidates = fresh.length > 0 ? fresh : library.filter(r => r.id !== yesterdayId);

  let best: Recipe | null = null;
  let bestScore = -Infinity;
  for (const r of candidates) {
    const pr = proteinOf(r);
    const type = dishType(r);
    let score = rand();
    if (opts.favoriteIds?.has(r.id)) score += 1.5;
    score += 0.4 * favoriteOverlap(r, loves) - 0.6 * dislikeOverlap(r, dislikes);
    if (pr && pr === yesterdayProtein) score -= 3;
    if (pr && (proteinCount.get(pr) ?? 0) >= 2) score -= 2;
    if (type !== 'other') score -= 1.2 * (typeCount.get(type) ?? 0);
    score -= opts.penalty?.(r) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

/**
 * Fills every empty slot among `days` x `slots`. Returns only the new
 * entries (the caller adds them). Days are filled in order so each pick
 * sees the ones before it.
 */
export function fillWeek(
  days: string[],
  slots: PlanSlot[],
  libraries: Partial<Record<PlanSlot, Recipe[]>>,
  plan: PlannedMeal[],
  recipesById: Map<string, Recipe>,
  opts: FillOptions,
  now = Date.now(),
): PlannedMeal[] {
  const working = [...plan];
  const known = new Map(recipesById);
  const added: PlannedMeal[] = [];
  for (const date of days) {
    for (const slot of slots) {
      if (working.some(p => p.date === date && p.slot === slot)) continue;
      const r = pickForSlot(date, slot, libraries[slot] ?? [], working, known, opts);
      if (!r) continue;
      const batchServings = Math.max(r.servings, opts.preferences.householdSize);
      const entry = plannedFrom(
        r,
        date,
        slot,
        now,
        batchServings,
        Math.min(batchServings, opts.preferences.householdSize),
      );
      known.set(r.id, r);
      working.push(entry);
      added.push(entry);
      const leftovers = rolloverLeftovers(
        entry,
        working,
        opts.preferences.householdSize,
        opts.dayStatuses,
        opts.slotStatuses,
        now,
      );
      working.push(...leftovers);
      added.push(...leftovers);
    }
  }
  return added;
}

export function plannedFrom(
  r: Recipe,
  date: string,
  slot: PlanSlot,
  now = Date.now(),
  servings = r.servings,
  mealServings = servings,
): PlannedMeal {
  return {
    id: `${date}-${slot}-${r.id}`,
    date,
    slot,
    recipeId: r.id,
    name: r.name,
    emoji: r.emoji,
    minutes: r.prepMinutes + r.cookMinutes,
    servings,
    mealServings,
    servingsEstimated: r.servingsEstimated,
    cooked: false,
    addedAt: now,
  };
}

export function planSlotKey(date: string, slot: PlanSlot): string {
  return `${date}|${slot}`;
}

export function clearPlanRange(
  meals: PlannedMeal[],
  dayStatuses: Record<string, PlanDayStatus>,
  slotStatuses: Record<string, PlanDayStatus>,
  startDate: string,
  endDate: string,
) {
  const sourceKeys = new Set(
    meals
      .filter(meal => meal.date >= startDate && meal.date <= endDate && !meal.isLeftovers)
      .map(meal => `${meal.date}|${meal.slot}|${meal.recipeId}`)
  );
  return {
    meals: meals.filter(meal =>
      (meal.date < startDate || meal.date > endDate) &&
      !(meal.leftoverSourceKey && sourceKeys.has(meal.leftoverSourceKey))
    ),
    dayStatuses: Object.fromEntries(
      Object.entries(dayStatuses).filter(([date]) => date < startDate || date > endDate)
    ),
    slotStatuses: Object.fromEntries(
      Object.entries(slotStatuses).filter(([key]) => {
        const date = key.slice(0, 10);
        return date < startDate || date > endDate;
      })
    ),
  };
}

/** Carries surplus portions forward only into compatible meal slots. */
export function rolloverLeftovers(
  source: PlannedMeal,
  existing: PlannedMeal[],
  householdSize: number,
  dayStatuses: Record<string, PlanDayStatus> = {},
  slotStatuses: Record<string, PlanDayStatus> = {},
  now = Date.now(),
): PlannedMeal[] {
  if (source.isLeftovers) return [];
  const sourceKey = `${source.date}|${source.slot}|${source.recipeId}`;
  const alreadyAllocated = existing
    .filter(meal => meal.leftoverSourceKey === sourceKey)
    .reduce((total, meal) => total + (meal.mealServings ?? meal.servings ?? 0), 0);
  const batchServings = source.servings ?? 0;
  const eatenAtSource = source.mealServings ?? Math.min(Math.max(1, householdSize), batchServings);
  let remaining = Math.max(0, batchServings - eatenAtSource - alreadyAllocated);
  if (!remaining) return [];

  const added: PlannedMeal[] = [];
  const rolloverSlots: Record<PlanSlot, readonly PlanSlot[]> = {
    breakfast: ['breakfast'],
    lunch: ['lunch', 'dinner'],
    dinner: ['lunch', 'dinner'],
  };
  for (let offset = 0; offset <= 14 && remaining > 0; offset++) {
    const date = addDays(source.date, offset);
    if (dayStatuses[date] && dayStatuses[date] !== 'cook') continue;
    const candidates = offset === 0
      ? source.slot === 'lunch' ? ['dinner'] as const : []
      : rolloverSlots[source.slot];
    for (const slot of candidates) {
      if (remaining <= 0) break;
      const key = planSlotKey(date, slot);
      if (slotStatuses[key] && slotStatuses[key] !== 'cook') continue;
      if ([...existing, ...added].some(meal => meal.date === date && meal.slot === slot)) continue;
      const servings = Math.min(Math.max(1, householdSize), remaining);
      added.push({
        id: `leftover-${source.id}-${date}-${slot}`,
        date,
        slot,
        recipeId: source.recipeId,
        name: source.name,
        emoji: source.emoji,
        minutes: 0,
        servings,
        mealServings: servings,
        servingsEstimated: source.servingsEstimated,
        cooked: false,
        isLeftovers: true,
        leftoverSourceKey: sourceKey,
        addedAt: now,
      });
      remaining -= servings;
    }
  }
  return added;
}

// ---------- shopping ----------

export interface NeededIngredient {
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategoryId;
  forRecipes: string[];
}

interface ParsedIngredientAmount {
  quantity: number;
  dimension: string;
  baseUnit: string;
  baseQuantity: number;
  displayUnit: string;
}

const UNIT_ALIASES: Record<string, { dimension: string; baseUnit: string; factor: number; displayUnit: string }> = {
  tsp: { dimension: 'volume', baseUnit: 'tsp', factor: 1, displayUnit: 'tsp' },
  teaspoon: { dimension: 'volume', baseUnit: 'tsp', factor: 1, displayUnit: 'tsp' },
  teaspoons: { dimension: 'volume', baseUnit: 'tsp', factor: 1, displayUnit: 'tsp' },
  tbsp: { dimension: 'volume', baseUnit: 'tsp', factor: 3, displayUnit: 'tbsp' },
  tablespoon: { dimension: 'volume', baseUnit: 'tsp', factor: 3, displayUnit: 'tbsp' },
  tablespoons: { dimension: 'volume', baseUnit: 'tsp', factor: 3, displayUnit: 'tbsp' },
  cup: { dimension: 'volume', baseUnit: 'tsp', factor: 48, displayUnit: 'cup' },
  cups: { dimension: 'volume', baseUnit: 'tsp', factor: 48, displayUnit: 'cup' },
  'fl oz': { dimension: 'volume', baseUnit: 'tsp', factor: 6, displayUnit: 'fl oz' },
  ml: { dimension: 'volume', baseUnit: 'tsp', factor: 0.202884, displayUnit: 'ml' },
  l: { dimension: 'volume', baseUnit: 'tsp', factor: 202.884, displayUnit: 'l' },
  oz: { dimension: 'mass', baseUnit: 'oz', factor: 1, displayUnit: 'oz' },
  ounce: { dimension: 'mass', baseUnit: 'oz', factor: 1, displayUnit: 'oz' },
  ounces: { dimension: 'mass', baseUnit: 'oz', factor: 1, displayUnit: 'oz' },
  lb: { dimension: 'mass', baseUnit: 'oz', factor: 16, displayUnit: 'lb' },
  lbs: { dimension: 'mass', baseUnit: 'oz', factor: 16, displayUnit: 'lb' },
  pound: { dimension: 'mass', baseUnit: 'oz', factor: 16, displayUnit: 'lb' },
  pounds: { dimension: 'mass', baseUnit: 'oz', factor: 16, displayUnit: 'lb' },
  g: { dimension: 'mass', baseUnit: 'oz', factor: 1 / 28.3495, displayUnit: 'g' },
  gram: { dimension: 'mass', baseUnit: 'oz', factor: 1 / 28.3495, displayUnit: 'g' },
  grams: { dimension: 'mass', baseUnit: 'oz', factor: 1 / 28.3495, displayUnit: 'g' },
  kg: { dimension: 'mass', baseUnit: 'oz', factor: 35.274, displayUnit: 'kg' },
  each: { dimension: 'count:each', baseUnit: 'each', factor: 1, displayUnit: 'each' },
  item: { dimension: 'count:each', baseUnit: 'each', factor: 1, displayUnit: 'each' },
  items: { dimension: 'count:each', baseUnit: 'each', factor: 1, displayUnit: 'each' },
  piece: { dimension: 'count:piece', baseUnit: 'piece', factor: 1, displayUnit: 'pieces' },
  pieces: { dimension: 'count:piece', baseUnit: 'piece', factor: 1, displayUnit: 'pieces' },
  clove: { dimension: 'count:clove', baseUnit: 'clove', factor: 1, displayUnit: 'cloves' },
  cloves: { dimension: 'count:clove', baseUnit: 'clove', factor: 1, displayUnit: 'cloves' },
  head: { dimension: 'count:head', baseUnit: 'head', factor: 1, displayUnit: 'heads' },
  heads: { dimension: 'count:head', baseUnit: 'head', factor: 1, displayUnit: 'heads' },
  can: { dimension: 'count:can', baseUnit: 'can', factor: 1, displayUnit: 'cans' },
  cans: { dimension: 'count:can', baseUnit: 'can', factor: 1, displayUnit: 'cans' },
  slice: { dimension: 'count:slice', baseUnit: 'slice', factor: 1, displayUnit: 'slices' },
  slices: { dimension: 'count:slice', baseUnit: 'slice', factor: 1, displayUnit: 'slices' },
  stalk: { dimension: 'count:stalk', baseUnit: 'stalk', factor: 1, displayUnit: 'stalks' },
  stalks: { dimension: 'count:stalk', baseUnit: 'stalk', factor: 1, displayUnit: 'stalks' },
  sprig: { dimension: 'count:sprig', baseUnit: 'sprig', factor: 1, displayUnit: 'sprigs' },
  sprigs: { dimension: 'count:sprig', baseUnit: 'sprig', factor: 1, displayUnit: 'sprigs' },
  package: { dimension: 'count:package', baseUnit: 'package', factor: 1, displayUnit: 'packages' },
  packages: { dimension: 'count:package', baseUnit: 'package', factor: 1, displayUnit: 'packages' },
  pack: { dimension: 'count:package', baseUnit: 'package', factor: 1, displayUnit: 'packages' },
  packs: { dimension: 'count:package', baseUnit: 'package', factor: 1, displayUnit: 'packages' },
  bunch: { dimension: 'count:bunch', baseUnit: 'bunch', factor: 1, displayUnit: 'bunches' },
  bunches: { dimension: 'count:bunch', baseUnit: 'bunch', factor: 1, displayUnit: 'bunches' },
};

function parseNumber(value: string): number {
  const parts = value.trim().split(/\s+/);
  const fraction = (text: string) => {
    const [numerator, denominator] = text.split('/').map(Number);
    return denominator ? numerator / denominator : NaN;
  };
  if (parts.length === 2) return Number(parts[0]) + fraction(parts[1]);
  if (parts[0].includes('/')) return fraction(parts[0]);
  return Number(parts[0]);
}

/** Parses common recipe quantities; unknown wording returns null instead of guessing. */
export function parseIngredientAmount(amount: string): ParsedIngredientAmount | null {
  const match = amount.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*(.*))$/);
  if (!match) return null;
  const quantity = parseNumber(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const rest = match[2].trim().toLowerCase();
  const unitToken = rest.startsWith('fl oz') ? 'fl oz' : (rest.split(/\s+/)[0] || 'each');
  const unit = UNIT_ALIASES[unitToken];
  if (!unit) {
    return {
      quantity,
      dimension: `unit:${unitToken}`,
      baseUnit: unitToken,
      baseQuantity: quantity,
      displayUnit: unitToken,
    };
  }
  return {
    quantity,
    dimension: unit.dimension,
    baseUnit: unit.baseUnit,
    baseQuantity: quantity * unit.factor,
    displayUnit: unit.displayUnit,
  };
}

function cleanQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

function displayAmount(quantity: number, dimension: string, unit: string): { quantity: number; unit: string } {
  if (dimension === 'volume') {
    if (quantity >= 48) return { quantity: cleanQuantity(quantity / 48), unit: 'cups' };
    if (quantity >= 3) return { quantity: cleanQuantity(quantity / 3), unit: 'tbsp' };
    return { quantity: cleanQuantity(quantity), unit: 'tsp' };
  }
  if (dimension === 'mass') {
    if (quantity >= 16) return { quantity: cleanQuantity(quantity / 16), unit: 'lbs' };
    return { quantity: cleanQuantity(quantity), unit: 'oz' };
  }
  return { quantity: cleanQuantity(quantity), unit };
}

/**
 * Required ingredients of the planned (not yet cooked) meals that aren't
 * in the pantry, merged across recipes: "Garlic, for Tacos and Curry".
 */
export function ingredientsToBuy(
  planned: PlannedMeal[],
  recipesById: Map<string, Recipe>,
  pantryHas: (name: string) => boolean,
  dayStatuses: Record<string, PlanDayStatus> = {},
  slotStatuses: Record<string, PlanDayStatus> = {},
): NeededIngredient[] {
  const byName = new Map<string, NeededIngredient & { dimension: string; baseQuantity: number; baseUnit: string }>();
  for (const p of planned) {
    if (
      p.cooked || p.isLeftovers ||
      (dayStatuses[p.date] && dayStatuses[p.date] !== 'cook') ||
      (slotStatuses[planSlotKey(p.date, p.slot)] && slotStatuses[planSlotKey(p.date, p.slot)] !== 'cook')
    ) continue;
    const r = recipesById.get(p.recipeId);
    if (!r) continue;
    for (const ing of r.ingredients) {
      if (ing.optional || pantryHas(ing.name)) continue;
      const parsed = parseIngredientAmount(ing.amount);
      const servings = p.servings ?? r.servings;
      const scale = servings > 0 && r.servings > 0 ? servings / r.servings : 1;
      const quantity = parsed ? parsed.baseQuantity * scale : 1;
      const dimension = parsed?.dimension ?? 'count:each';
      const baseUnit = parsed?.baseUnit ?? 'each';
      const key = `${ing.name.trim().toLowerCase()}|${dimension}`;
      const entry = byName.get(key) ?? {
        name: ing.name.trim(),
        quantity: 0,
        unit: parsed?.displayUnit ?? 'each',
        category: ing.category,
        forRecipes: [],
        dimension,
        baseQuantity: 0,
        baseUnit,
      };
      entry.baseQuantity += quantity;
      if (!entry.forRecipes.includes(r.name)) entry.forRecipes.push(r.name);
      byName.set(key, entry);
    }
  }
  return [...byName.values()]
    .map(({ dimension, baseQuantity, baseUnit, ...entry }) => ({
      ...entry,
      ...displayAmount(baseQuantity, dimension, entry.unit),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type { PantryItem };
