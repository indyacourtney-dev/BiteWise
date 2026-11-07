// utils/pantryWords.ts — the pantry in plain words.
//
// Numbers and units on their own are easy to misread ("1 bottles", "2
// items", a thin grey bar). These helpers turn an item's state into the
// sentence a person would say: "2 eggs left of 12 · running low",
// "1 bottle · best within 3 days", "Out — add it to your list".

import { freshness, lowLevel, stockStatus, type Freshness } from './pantryStatus';
import type { PantryItem } from '../types';

// Units that don't change with the number.
const UNCOUNTABLE = new Set(['tbsp', 'tsp', 'oz', 'fl oz', 'lbs', 'lb', 'grams', 'g', 'kg', 'ml', 'liters', 'l', 'dozen']);
// Units whose singular isn't just "drop the s".
const SINGULAR: Record<string, string> = {
  bunches: 'bunch', boxes: 'box', loaves: 'loaf', cartons: 'carton', packages: 'package', packets: 'packet',
  bags: 'bag', cans: 'can', jars: 'jar', bottles: 'bottle', containers: 'container', heads: 'head', cloves: 'clove',
  slices: 'slice', sticks: 'stick', cups: 'cup', pints: 'pint', quarts: 'quart', gallons: 'gallon', servings: 'serving',
  items: 'item', pieces: 'piece', pcs: 'piece',
};
const PLURAL: Record<string, string> = Object.fromEntries(Object.entries(SINGULAR).map(([p, s]) => [s, p]));

/** "Bottles" → "bottle" / "bottles" depending on the number. */
export function unitWord(unit: string, quantity: number): string {
  const u = unit.trim().toLowerCase();
  if (!u) return '';
  if (UNCOUNTABLE.has(u)) return u === 'lb' && quantity !== 1 ? 'lbs' : u;
  const singular = SINGULAR[u] ?? (u.endsWith('s') ? u.slice(0, -1) : u);
  if (quantity === 1) return singular;
  return PLURAL[singular] ?? (singular.endsWith('s') || singular.endsWith('x') || singular.endsWith('ch') || singular.endsWith('sh') ? `${singular}es` : `${singular}s`);
}

/** Nouns the pantry can count on their own: "2 lemons", "1 egg". */
export function nameWord(name: string, quantity: number): string {
  const n = name.trim();
  if (!n) return '';
  const lower = n.toLowerCase();
  const irregular: Record<string, string> = { tomatoes: 'tomato', potatoes: 'potato', loaves: 'loaf', leaves: 'leaf' };
  const singular =
    irregular[lower] ??
    (lower.endsWith('ies') ? `${lower.slice(0, -3)}y`
      : /(ches|shes|xes|sses)$/.test(lower) ? lower.slice(0, -2)
      : lower.endsWith('s') && !lower.endsWith('ss') ? lower.slice(0, -1)
      : lower);
  if (quantity === 1) return singular;
  if (lower.endsWith('s')) return lower;
  if (singular.endsWith('y') && !/[aeiou]y$/.test(singular)) return `${singular.slice(0, -1)}ies`;
  if (/(ch|sh|s|x|o)$/.test(singular)) return `${singular}es`;
  return `${singular}s`;
}

const GENERIC_UNITS = new Set(['items', 'item', 'pieces', 'piece', 'pcs', '']);

/** "12 eggs", "1 bottle of olive oil" shortened to "1 bottle", "3 cups". */
export function describeQuantity(item: Pick<PantryItem, 'name' | 'quantity' | 'unit'>): string {
  const q = item.quantity;
  const u = (item.unit ?? '').trim().toLowerCase();
  if (GENERIC_UNITS.has(u)) return `${q} ${nameWord(item.name, q)}`;
  return `${q} ${unitWord(item.unit, q)}`;
}

/** "a dozen" style counting for the unit itself: "2 bottles", used after the name. */
export function unitOnly(item: Pick<PantryItem, 'name' | 'quantity' | 'unit'>): string {
  const u = (item.unit ?? '').trim().toLowerCase();
  if (GENERIC_UNITS.has(u)) return `${item.quantity}`;
  return `${item.quantity} ${unitWord(item.unit, item.quantity)}`;
}

/** One line about stock: what's left and whether to buy more. */
export function stockSentence(item: PantryItem): { text: string; tone: 'ok' | 'low' | 'out' } {
  const stock = stockStatus(item);
  if (stock === 'out') return { text: 'Out', tone: 'out' };
  const full = item.stockedQty ?? item.quantity;
  const have = describeQuantity(item);
  if (stock === 'low') {
    const ofFull = full > item.quantity ? ` of ${full}` : '';
    return { text: `${have} left${ofFull} · running low`, tone: 'low' };
  }
  return { text: have, tone: 'ok' };
}

/** "Best within 3 days", "Use today", "2 days past its best", "Keeps about 6 months". */
export function freshnessSentence(f: Freshness): string | null {
  if (f.daysLeft === null) return null;
  if (f.daysLeft < 0) return `${-f.daysLeft} day${f.daysLeft === -1 ? '' : 's'} past its best`;
  if (f.daysLeft === 0) return 'Use today';
  if (f.daysLeft === 1) return 'Use by tomorrow';
  if (f.status === 'soon') return `Use within ${f.daysLeft} days`;
  if (f.daysLeft > 90) return `Keeps about ${Math.round(f.daysLeft / 30)} months`;
  if (f.daysLeft > 21) return `Keeps about ${Math.round(f.daysLeft / 7)} weeks`;
  return `Best within ${f.daysLeft} days`;
}

/** "added today", "bought 3 days ago" — when the current stock went in. */
export function sinceSentence(item: PantryItem, now = Date.now()): string {
  const start = item.stockedAt ?? item.addedAt;
  const days = Math.floor((now - start) / 86400000);
  const verb = item.stockedAt && item.stockedAt !== item.addedAt ? 'Bought' : 'Added';
  if (days <= 0) return `${verb} today`;
  if (days === 1) return `${verb} yesterday`;
  if (days < 14) return `${verb} ${days} days ago`;
  if (days < 60) return `${verb} ${Math.round(days / 7)} weeks ago`;
  return `${verb} ${Math.round(days / 30)} months ago`;
}

/** Everything a row needs to say, ready to render. */
export interface ItemWords {
  stock: ReturnType<typeof stockSentence>;
  fresh: Freshness;
  freshText: string | null;
  /** The one most useful line under the name. */
  line: string;
  tone: 'ok' | 'low' | 'out' | 'soon' | 'expired';
}

export function itemWords(item: PantryItem, now = Date.now()): ItemWords {
  const stock = stockSentence(item);
  const fresh = freshness(item, now);
  const freshText = freshnessSentence(fresh);
  if (stock.tone === 'out') return { stock, fresh, freshText, line: 'Out', tone: 'out' };
  if (fresh.status === 'expired') return { stock, fresh, freshText, line: `${stock.text} · ${freshText}`, tone: 'expired' };
  if (stock.tone === 'low') return { stock, fresh, freshText, line: stock.text, tone: 'low' };
  if (fresh.status === 'soon') return { stock, fresh, freshText, line: `${stock.text} · ${freshText}`, tone: 'soon' };
  return { stock, fresh, freshText, line: stock.text, tone: 'ok' };
}

/** "Tell me when I'm down to 3" — the level, in words. */
export function lowLevelSentence(item: PantryItem): string {
  const level = lowLevel(item);
  if (level <= 0) return 'Only when it runs out';
  return `When ${describeQuantity({ ...item, quantity: level })} ${level === 1 ? 'is' : 'are'} left`;
}
