// utils/diets.ts — which diet tags are rules and which are goals.
//
// A diet tag is one of two very different things:
//
//   RULES   vegetarian, vegan, pescatarian, gluten-free, dairy-free, halal,
//           kosher-style, no red meat. A recipe either fits or it doesn't,
//           so these are hard filters — same as allergies.
//
//   GOALS   heart-healthy, low-sodium, blood-sugar friendly, high-fiber,
//           low-carb, keto, lighter meals… Ways someone wants to eat. They
//           are favored heavily in every ranking, and shown as reasons, but
//           they never empty the pool: someone who ticks five health goals
//           still gets desserts, breakfasts and a full week.
//
// Why: the database tags health styles sparsely and independently. Of
// 54,000 desserts, 11 carry all of "diabetic-friendly + low-sodium +
// low-cholesterol + heart-healthy + high-fiber" — treating those as rules
// left a real account with nothing to show. Treated as goals, the same
// account gets a pool built from recipes that match the most of them.

import { DIETARY_OPTIONS, HEALTH_OPTIONS } from '../constants/preferenceOptions';
import type { DietaryTag, Recipe, UserPreferences } from '../types';

export const DIET_RULES: readonly DietaryTag[] = [
  'vegetarian', 'vegan', 'pescatarian', 'gluten-free', 'dairy-free', 'halal', 'kosher-style', 'no-red-meat',
];

export function isDietRule(tag: DietaryTag): boolean {
  return DIET_RULES.includes(tag);
}

/** The person's hard diets (a recipe must carry every one). */
export function dietRules(prefs: Pick<UserPreferences, 'dietary'>): DietaryTag[] {
  return (prefs.dietary ?? []).filter(isDietRule);
}

/** The person's eating goals (favored, never required). */
export function dietGoals(prefs: Pick<UserPreferences, 'dietary'>): DietaryTag[] {
  return (prefs.dietary ?? []).filter(t => !isDietRule(t));
}

export interface DietGoalMatch {
  matched: DietaryTag[];
  /** matched / goals, 0..1. 1 when there are no goals (nothing to miss). */
  share: number;
}

export function dietGoalMatch(recipe: Pick<Recipe, 'dietary'>, goals: DietaryTag[]): DietGoalMatch {
  if (goals.length === 0) return { matched: [], share: 1 };
  const matched = goals.filter(g => recipe.dietary.includes(g));
  return { matched, share: matched.length / goals.length };
}

const LABELS: Record<string, string> = Object.fromEntries(
  [...DIETARY_OPTIONS, ...HEALTH_OPTIONS].map(o => [o.key, o.label]),
);

/** "Heart-healthy", "Blood-sugar friendly" — the label people saw when they chose it. */
export function dietLabel(tag: DietaryTag): string {
  return LABELS[tag] ?? tag.replace(/-/g, ' ');
}

/** "Heart-healthy and low-sodium" / "Heart-healthy, low-sodium and 2 more". */
export function dietGoalsSentence(tags: DietaryTag[]): string {
  const labels = tags.map(dietLabel);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1].toLowerCase()}`;
  return `${labels[0]}, ${labels[1].toLowerCase()} and ${labels.length - 2} more`;
}
