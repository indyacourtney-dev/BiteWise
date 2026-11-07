// utils/servings.ts — scale "2 cups flour" for a different number of people.
//
// Uses the same quantity parser as the grocery list (utils/weekPlan.ts) so
// "1 1/2 cups", "1/2 tsp" and "2 lb" all scale; wording it can't parse
// ("a pinch", "to taste") is left exactly as written.

import { parseIngredientAmount } from './weekPlan';

const FRACTIONS: [number, string][] = [
  [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.375, '⅜'], [0.5, '½'],
  [0.625, '⅝'], [0.667, '⅔'], [0.75, '¾'], [0.875, '⅞'],
];

/** 1.5 → "1½", 0.33 → "⅓", 2 → "2", 2.4 → "2.4". */
export function formatQuantity(q: number): string {
  if (!Number.isFinite(q) || q <= 0) return '';
  const whole = Math.floor(q + 1e-9);
  const frac = q - whole;
  if (frac < 0.06) return String(whole);
  const near = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.06);
  if (near) return whole > 0 ? `${whole}${near[1]}` : near[1];
  return String(Math.round(q * 10) / 10);
}

/** "2 cups flour, sifted" × 1.5 → "3 cups flour, sifted". */
export function scaleAmount(amount: string, factor: number): string {
  if (!amount || factor === 1) return amount;
  const match = amount.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(\s*)(.*)$/);
  const parsed = parseIngredientAmount(amount);
  if (!match || !parsed) return amount;
  const scaled = parsed.quantity * factor;
  const text = formatQuantity(scaled);
  if (!text) return amount;
  // Pluralise the simplest units when going from 1 to many ("1 cup" → "2 cups").
  let rest = match[3];
  if (parsed.quantity <= 1 && scaled > 1) rest = rest.replace(/^(cup|clove|egg|lb|can|slice|bunch)\b(?!s)/i, '$1s');
  if (parsed.quantity > 1 && scaled <= 1) rest = rest.replace(/^(cups|cloves|eggs|lbs|cans|slices|bunches)\b/i, m => m.slice(0, -1));
  return `${text}${rest ? ' ' + rest : ''}`;
}
