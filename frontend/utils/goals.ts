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

import type { MealType, Recipe } from '../types';
import {
  addedSugar, checkFocus, focusFit, hasComplexCarbs, hasWholeGrains, moodFoods, processedSalty,
  type FocusId,
} from './focus';

export type { FocusId } from './focus';
export { FOCUS_IDS, FOCUS_INFO, focusFit } from './focus';

/**
 * What someone is working toward. Each kind has its own calorie and
 * protein rule (dailyTargets) and its own way of judging a serving
 * (goalFit):
 *   lose         a deficit; light, filling plates; portions suggested
 *   gain         protein first, a modest surplus
 *   performance  complex carbs to fuel, protein to recover
 *   health       lots of veg, whole grains, less sugar / salt / saturated fat
 *   energy       steady protein + fiber, no sugar crashes, mood foods
 *   maintain     about what you burn
 */
export type GoalKind = 'maintain' | 'lose' | 'gain' | 'performance' | 'health' | 'energy';
export type ActivityLevel = 'low' | 'light' | 'moderate' | 'high';
/** Used only for the resting-energy formula. 'unspecified' uses the midpoint. */
export type BodyType = 'female' | 'male' | 'unspecified';
export type UnitSystem = 'imperial' | 'metric';

export interface NutritionGoals {
  goal: GoalKind;
  /** Extra things to lean toward (utils/focus.ts). Optional; any number. */
  focuses?: FocusId[];
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
  /** Grams of carbohydrate a day. */
  carbs: number;
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
  /** Grams; used by the performance goal. */
  carbs: number;
}

export interface GoalFit {
  /** 0..1 — how well one serving fits this meal's target for the goal. */
  score: number;
  /** A short, positive reason when it fits well; null otherwise. */
  reason: string | null;
  /** Advice when it doesn't fit as is; null when a plain serving is fine. */
  portion: string | null;
}

export const GOAL_KINDS: GoalKind[] = ['lose', 'gain', 'performance', 'health', 'energy', 'maintain'];

export const GOAL_LABELS: Record<GoalKind, string> = {
  lose: 'Lose weight',
  gain: 'Build muscle',
  performance: 'Athletic performance',
  health: 'General health',
  energy: 'Energy & sleep',
  maintain: 'Stay where I am',
};

/** The aim, in a few words. */
export const GOAL_AIMS: Record<GoalKind, string> = {
  lose: 'Lose body fat and keep lean muscle.',
  gain: 'More muscle, strength and definition.',
  performance: 'Stamina, power, speed and recovery.',
  health: 'Heart health, blood pressure, cholesterol, steady blood sugar.',
  energy: 'No midday crash; deeper, more restful sleep.',
  maintain: 'Stay at the weight you are.',
};

/** How meals will lean — the strategy, in plain words. */
export const GOAL_BLURBS: Record<GoalKind, string> = {
  lose: 'A sustainable calorie deficit, plenty of lean protein to protect muscle, high-fiber whole foods to stay full.',
  gain: 'Maintenance or a moderate surplus, enough protein every day, and fuel around your workouts.',
  performance: 'Complex carbs for glycogen, protein to recover, and fluids and electrolytes through the day.',
  health: 'More colorful fruit and veg, whole grains over refined, and less added sugar, salt and saturated fat.',
  energy: 'Balanced meals with steady protein and fiber — no blood-sugar crashes — plus nuts, fish and greens.',
  maintain: 'Meals that are about right for your day.',
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
const PROTEIN_PER_KG: Record<GoalKind, number> = { maintain: 1.2, lose: 1.6, gain: 1.8, performance: 1.6, health: 1.2, energy: 1.3 };
const CALORIE_ADJUST: Record<GoalKind, number> = { maintain: 0, lose: -500, gain: 300, performance: 200, health: 0, energy: 0 };
/** Share of calories from carbohydrate, for the carb target (4 kcal/g). */
const CARB_SHARE: Record<GoalKind, number> = { maintain: 0.5, lose: 0.4, gain: 0.45, performance: 0.55, health: 0.5, energy: 0.45 };

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
  const carbs = roundTo((calories * CARB_SHARE[g.goal]) / 4, 5);
  return { calories, protein, carbs, bmr, tdee, floored };
}

export function mealTargets(daily: DailyTargets, meal: MealType): MealTargets {
  const share = MEAL_SHARE[meal] ?? 0.3;
  return {
    calories: Math.round(daily.calories * share),
    protein: Math.round(daily.protein * share),
    carbs: Math.round(daily.carbs * share),
  };
}

export interface MealGoal {
  kind: GoalKind;
  target: MealTargets;
  focuses: FocusId[];
}

/** Everything a ranker needs for one meal, or null when no goal is set. */
export function goalForMeal(goals: NutritionGoals | null | undefined, age: number | null, meal: MealType): MealGoal | null {
  if (!goals || !isCompleteGoals(goals)) return null;
  const daily = dailyTargets(goals, age ?? 30);
  return { kind: goals.goal, target: mealTargets(daily, meal), focuses: goals.focuses ?? [] };
}

export function isCompleteGoals(g: Partial<NutritionGoals> | null | undefined): g is NutritionGoals {
  return !!g
    && !!g.goal && GOAL_KINDS.includes(g.goal)
    && typeof g.heightCm === 'number' && g.heightCm >= HEIGHT_RANGE_CM.min && g.heightCm <= HEIGHT_RANGE_CM.max
    && typeof g.weightKg === 'number' && g.weightKg >= WEIGHT_RANGE_KG.min && g.weightKg <= WEIGHT_RANGE_KG.max
    && !!g.activity && g.activity in ACTIVITY_FACTOR;
}

/**
 * How one serving (calories, protein) fits a meal target under a goal.
 * Desserts and recipes with no nutrition should not be scored (callers skip).
 */
export function goalFit(recipe: Recipe, kind: GoalKind, target: MealTargets): GoalFit {
  const serving = recipe.nutrition;
  const c = Math.max(0, serving.calories);
  const p = Math.max(0, serving.protein);
  const carbs = Math.max(0, serving.carbs ?? 0);
  const ratio = target.calories > 0 ? c / target.calories : 1;
  const proteinFit = target.protein > 0 ? Math.min(1, p / target.protein) : 1;

  if (kind === 'performance') {
    // Fuel first (complex carbs), then protein to recover, then enough on the plate.
    const carbFit = target.carbs > 0 ? Math.min(1, carbs / target.carbs) : 1;
    const complex = hasComplexCarbs(recipe);
    const calFit = ratio >= 0.7 ? 1 : ratio / 0.7;
    const score = 0.4 * (complex.length ? Math.max(carbFit, 0.6) : carbFit) + 0.35 * proteinFit + 0.25 * calFit;
    let reason: string | null = null;
    if (carbFit >= 0.75 && proteinFit >= 0.6) reason = complex.length ? `Fuel to train on: ${complex[0]} and ${Math.round(p)} g protein` : 'Carbs to fuel, protein to recover';
    else if (carbFit >= 0.75) reason = 'Good fuel for training';
    let portion: string | null = null;
    if (carbFit < 0.5) portion = 'Add a carb side — rice, potatoes, oats or bread — to fuel training';
    else if (proteinFit < 0.5) portion = `Add protein to recover: aim for ~${target.protein} g this meal`;
    return { score, reason, portion };
  }

  if (kind === 'health') {
    // Veg-forward, whole grains, not much sugar or salt.
    const produce = Math.min(1, recipe.plate.produce / 45);
    const grains = hasWholeGrains(recipe).length > 0 ? 1 : 0.5;
    const salty = processedSalty(recipe);
    const sugar = addedSugar(recipe);
    const clean = Math.max(0, 1 - 0.5 * Math.min(1, salty.length) - 0.5 * Math.min(1, sugar.length));
    const about = Math.max(0, 1 - Math.abs(ratio - 1) / 0.6);
    const score = 0.45 * produce + 0.15 * grains + 0.25 * clean + 0.15 * about;
    let reason: string | null = null;
    if (produce >= 0.8 && clean >= 0.75) reason = grains === 1 ? 'Heart-friendly: plenty of veg and whole grains' : 'Heart-friendly: plenty of veg, little added salt or sugar';
    else if (produce >= 0.8) reason = 'Mostly vegetables';
    let portion: string | null = null;
    if (produce < 0.5) portion = 'Add a vegetable side or a salad to fill half the plate';
    else if (salty.length) portion = `Go easy on the ${salty[0]} — it carries most of the salt`;
    else if (sugar.length && sugar[0] !== 'sweet') portion = `Use less ${sugar[0]} than the recipe says`;
    return { score, reason, portion };
  }

  if (kind === 'energy') {
    // Steady energy: protein and fiber together, mood foods, no sugar spike.
    const pFit = Math.min(1, p / Math.max(15, target.protein * 0.7));
    const fiber = checkFocus(recipe, 'fiber').score;
    const mood = Math.min(1, moodFoods(recipe).length / 2);
    const sugar = addedSugar(recipe).length > 0 ? 1 : 0;
    const score = Math.max(0, 0.4 * pFit + 0.3 * fiber + 0.3 * mood - 0.3 * sugar);
    let reason: string | null = null;
    if (pFit >= 0.8 && fiber >= 0.5 && !sugar) reason = 'Steady energy: protein and fiber together';
    else if (mood >= 1 && !sugar) reason = `Mood food: ${moodFoods(recipe).slice(0, 2).join(' and ')}`;
    let portion: string | null = null;
    if (sugar) portion = 'Sweet things spike and crash — save this for after a meal, not instead of one';
    else if (pFit < 0.5) portion = 'Add protein so it holds you: eggs, beans, fish or yogurt';
    else if (fiber < 0.5) portion = 'Add fiber so it lasts: whole grains, beans or a big handful of greens';
    return { score, reason, portion };
  }

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
  const focuses = g.focuses?.length ? ` · ${g.focuses.length} focus${g.focuses.length === 1 ? '' : 'es'}` : '';
  return `${GOAL_LABELS[g.goal]} · ~${formatInt(daily.calories)} cal/day · ${daily.protein} g protein${focuses}`;
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
