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
import type { PantryItem, PlannedMeal, PlanSlot, Recipe, UserPreferences } from '../types';

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

export function weekDays(todayIso: string, count = 7): PlanDay[] {
  return Array.from({ length: count }, (_, i) => {
    const iso = addDays(todayIso, i);
    const d = toDate(iso);
    const weekday = DAY_NAMES[d.getDay()];
    return {
      iso,
      title: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekday,
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
      const entry = plannedFrom(r, date, slot, now);
      known.set(r.id, r);
      working.push(entry);
      added.push(entry);
    }
  }
  return added;
}

export function plannedFrom(r: Recipe, date: string, slot: PlanSlot, now = Date.now()): PlannedMeal {
  return {
    id: `${date}-${slot}-${r.id}`,
    date,
    slot,
    recipeId: r.id,
    name: r.name,
    emoji: r.emoji,
    minutes: r.prepMinutes + r.cookMinutes,
    cooked: false,
    addedAt: now,
  };
}

// ---------- shopping ----------

export interface NeededIngredient {
  name: string;
  forRecipes: string[];
}

/**
 * Required ingredients of the planned (not yet cooked) meals that aren't
 * in the pantry, merged across recipes: "Garlic, for Tacos and Curry".
 */
export function ingredientsToBuy(
  planned: PlannedMeal[],
  recipesById: Map<string, Recipe>,
  pantryHas: (name: string) => boolean,
): NeededIngredient[] {
  const byName = new Map<string, NeededIngredient>();
  for (const p of planned) {
    if (p.cooked) continue;
    const r = recipesById.get(p.recipeId);
    if (!r) continue;
    for (const ing of r.ingredients) {
      if (ing.optional || pantryHas(ing.name)) continue;
      const key = ing.name.trim().toLowerCase();
      const entry = byName.get(key) ?? { name: ing.name.trim(), forRecipes: [] };
      if (!entry.forRecipes.includes(r.name)) entry.forRecipes.push(r.name);
      byName.set(key, entry);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type { PantryItem };
