// utils/goals.ts — fitness & nutrition goals → daily and per-meal targets.
//
// Optional, set in Profile (never in onboarding). The app turns a goal
// plus height, weight and how active someone is into two numbers a day —
// calories and protein — then splits them across meals, and uses them to:
//   * nudge picks (utils/decide.ts): more protein for "gain muscle",
//     lighter, filling plates for "lose weight", about-right for "maintain"
//   * say on a recipe how a serving fits, and suggest a portion when it
//     doesn't ("have ¾ of a serving", "add a protein side")
//
// The math is the usual estimate: Mifflin-St Jeor for resting energy, a
// standard activity multiplier, a modest adjustment for the goal, and
// floors so "lose weight" never turns into a crash diet. These are
// estimates for planning meals, not medical advice; the screen says so.

import type { MealType } from '../types';

export type GoalKind = 'maintain' | 'lose' | 'gain';
export type ActivityLevel = 'low' | 'light' | 'moderate' | 'high';
/** Used only for the resting-energy formula. 'unspecified' uses the midpoint. */
export type BodyType = 'female' | 'male' | 'unspecified';
export type UnitSystem = 'imperial' | 'metric';

export interface NutritionGoals {
  goal: GoalKind;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  body?: BodyType;
  /** How the numbers are shown; stored values are always metric. */
  units?: UnitSystem;
  updatedAt?: number;
}

export interface DailyTargets {
  calories: number;
  protein: number;
  /** Resting energy (kcal/day). */
  bmr: number;
  /** Energy with activity (kcal/day). */
  tdee: number;
  /** true when the calorie floor kicked in. */
  floored: boolean;
}

export interface MealTargets {
  calories: number;
  protein: number;
}

export interface GoalFit {
  /** 0..1 — how well one serving fits this meal's target for the goal. */
  score: number;
  /** A short, positive reason when it fits well; null otherwise. */
  reason: string | null;
  /** Advice when it doesn't fit as is; null when a plain serving is fine. */
  portion: string | null;
}

export const GOAL_LABELS: Record<GoalKind, string> = {
  maintain: 'Stay where I am',
  lose: 'Lose weight',
  gain: 'Gain muscle',
};

export const GOAL_BLURBS: Record<GoalKind, string> = {
  maintain: 'Meals that are about right for your day.',
  lose: 'Lighter, filling plates and sensible portions — no crash diets.',
  gain: 'More protein at every meal, with enough fuel to build on.',
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; hint: string }> = {
  low: { label: 'Mostly sitting', hint: 'Desk work, little exercise' },
  light: { label: 'Lightly active', hint: 'Walks or light exercise 1–3 days a week' },
  moderate: { label: 'Active', hint: 'Exercise 3–5 days a week' },
  high: { label: 'Very active', hint: 'Hard training most days, or a physical job' },
};

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };

/** Share of the day's calories and protein for each meal. */
export const MEAL_SHARE: Record<MealType, number> = {
  breakfast: 0.25,
  brunch: 0.35,   // breakfast and lunch in one
  lunch: 0.3,
  dinner: 0.35,
  dessert: 0.1,
};

/** Protein per kg of body weight, per day. */
const PROTEIN_PER_KG: Record<GoalKind, number> = { maintain: 1.2, lose: 1.6, gain: 1.8 };
const CALORIE_ADJUST: Record<GoalKind, number> = { maintain: 0, lose: -500, gain: 300 };

/** Nobody is sent below this, whatever the arithmetic says. */
export function calorieFloor(body: BodyType = 'unspecified'): number {
  return body === 'male' ? 1500 : 1200;
}

export const HEIGHT_RANGE_CM = { min: 120, max: 230 };
export const WEIGHT_RANGE_KG = { min: 30, max: 300 };

/** Mifflin-St Jeor resting energy (kcal/day). */
export function restingEnergy(g: Pick<NutritionGoals, 'heightCm' | 'weightKg' | 'body'>, age: number): number {
  const base = 10 * g.weightKg + 6.25 * g.heightCm - 5 * age;
  const offset = g.body === 'male' ? 5 : g.body === 'female' ? -161 : -78;
  return Math.max(800, Math.round(base + offset));
}

export function dailyTargets(g: NutritionGoals, age: number): DailyTargets {
  const bmr = restingEnergy(g, age);
  const tdee = Math.round(bmr * ACTIVITY_FACTOR[g.activity]);
  const floor = calorieFloor(g.body);
  const raw = tdee + CALORIE_ADJUST[g.goal];
  const floored = raw < floor;
  const calories = roundTo(Math.max(floor, raw), 10);
  const protein = roundTo(g.weightKg * PROTEIN_PER_KG[g.goal], 5);
  return { calories, protein, bmr, tdee, floored };
}

export function mealTargets(daily: DailyTargets, meal: MealType): MealTargets {
  const share = MEAL_SHARE[meal] ?? 0.3;
  return { calories: Math.round(daily.calories * share), protein: Math.round(daily.protein * share) };
}

/** Everything a ranker needs for one meal, or null when no goal is set. */
export function goalForMeal(goals: NutritionGoals | null | undefined, age: number | null, meal: MealType): { kind: GoalKind; target: MealTargets } | null {
  if (!goals || !isCompleteGoals(goals)) return null;
  const daily = dailyTargets(goals, age ?? 30);
  return { kind: goals.goal, target: mealTargets(daily, meal) };
}

export function isCompleteGoals(g: Partial<NutritionGoals> | null | undefined): g is NutritionGoals {
  return !!g
    && (g.goal === 'maintain' || g.goal === 'lose' || g.goal === 'gain')
    && typeof g.heightCm === 'number' && g.heightCm >= HEIGHT_RANGE_CM.min && g.heightCm <= HEIGHT_RANGE_CM.max
    && typeof g.weightKg === 'number' && g.weightKg >= WEIGHT_RANGE_KG.min && g.weightKg <= WEIGHT_RANGE_KG.max
    && !!g.activity && g.activity in ACTIVITY_FACTOR;
}

/**
 * How one serving (calories, protein) fits a meal target under a goal.
 * Desserts and recipes with no nutrition should not be scored (callers skip).
 */
export function goalFit(serving: { calories: number; protein: number }, kind: GoalKind, target: MealTargets): GoalFit {
  const c = Math.max(0, serving.calories);
  const p = Math.max(0, serving.protein);
  const ratio = target.calories > 0 ? c / target.calories : 1;
  const proteinFit = target.protein > 0 ? Math.min(1, p / target.protein) : 1;

  if (kind === 'lose') {
    // Light enough, and filling enough that it sticks.
    const calFit = ratio <= 1 ? 1 : Math.max(0, 1 - (ratio - 1) / 0.6);
    const score = 0.7 * calFit + 0.3 * proteinFit;
    let reason: string | null = null;
    if (ratio <= 1 && proteinFit >= 0.7) reason = 'Light and filling — fits your goal';
    else if (ratio <= 1) reason = 'Fits your calorie target';
    let portion: string | null = null;
    if (ratio > 1.15) {
      const f = Math.max(0.5, Math.floor((target.calories / c) * 4) / 4);
      portion = f <= 0.5
        ? `Half a serving (~${roundTo(c / 2, 10)} cal) with a big salad or veg on the side`
        : `Have ${fraction(f)} of a serving (~${roundTo(c * f, 10)} cal) to stay on target`;
    } else if (proteinFit < 0.5 && ratio <= 1) {
      portion = `Add a lean protein side to reach ~${target.protein} g`;
    }
    return { score, reason, portion };
  }

  if (kind === 'gain') {
    // Protein first; enough fuel second.
    const calFit = ratio >= 0.7 ? 1 : ratio / 0.7;
    const score = 0.75 * proteinFit + 0.25 * calFit;
    let reason: string | null = null;
    if (proteinFit >= 0.9) reason = `${Math.round(p)} g protein — great for building muscle`;
    else if (proteinFit >= 0.6) reason = 'A good protein hit for your goal';
    let portion: string | null = null;
    if (proteinFit < 0.6) {
      portion = `Add a protein side (eggs, Greek yogurt, chicken, beans) to reach ~${target.protein} g`;
    } else if (ratio < 0.6) {
      portion = 'A bigger serving, or a side, would give you more to build on';
    }
    return { score, reason, portion };
  }

  // maintain
  const score = Math.max(0, 1 - Math.abs(ratio - 1) / 0.5);
  const reason = Math.abs(ratio - 1) <= 0.2 ? 'About right for your day' : null;
  let portion: string | null = null;
  if (ratio > 1.35) portion = `A smaller serving (~${roundTo(target.calories, 10)} cal) keeps your day on track`;
  else if (ratio < 0.6) portion = 'On the light side — add a side or a snack later';
  return { score, reason, portion };
}

/** "Lose weight · ~1,650 cal/day · 110 g protein" */
export function goalSummary(g: NutritionGoals, daily: DailyTargets): string {
  return `${GOAL_LABELS[g.goal]} · ~${formatInt(daily.calories)} cal/day · ${daily.protein} g protein`;
}

// ---- units -------------------------------------------------------------

export const cmToFtIn = (cm: number): { ft: number; in: number } => {
  const totalIn = Math.round(cm / 2.54);
  return { ft: Math.floor(totalIn / 12), in: totalIn % 12 };
};
export const ftInToCm = (ft: number, inches: number): number => Math.round((ft * 12 + inches) * 2.54);
export const kgToLb = (kg: number): number => Math.round(kg * 2.20462);
export const lbToKg = (lb: number): number => Math.round((lb / 2.20462) * 10) / 10;

export function formatHeight(cm: number, units: UnitSystem = 'imperial'): string {
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const { ft, in: inch } = cmToFtIn(cm);
  return `${ft}′ ${inch}″`;
}
export function formatWeight(kg: number, units: UnitSystem = 'imperial'): string {
  return units === 'metric' ? `${Math.round(kg)} kg` : `${kgToLb(kg)} lb`;
}

// ---- small helpers -----------------------------------------------------

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}
function formatInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
function fraction(f: number): string {
  if (f === 0.75) return '¾';
  if (f === 0.5) return '½';
  if (f === 0.25) return '¼';
  return `${f}`;
}
