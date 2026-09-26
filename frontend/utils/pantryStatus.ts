// utils/pantryStatus.ts
//
// Everything the Pantry and Grocery screens say about an item:
//   * stock:     ok / running low / out
//   * freshness: days left, from its typical shelf life (constants/pantryData.ts)
//   * aisle:     which store section it's in, so the grocery list follows
//                the way you walk through a store
//
// RUNNING LOW
//   Every item remembers how much you had when you last stocked up
//   (stockedQty). It's "running low" once you're down to a quarter of that:
//   12 eggs -> low at 3, 4 cans -> low at 1. A single carton isn't "low"
//   until it's gone, which shows as "out". You can set your own level per
//   item (lowAt) in its details, e.g. "tell me when I'm down to 2".
//
// FRESHNESS
//   bestBy = stockedAt + shelfLifeDays. "Use soon" = within 3 days, or the
//   last fifth of its shelf life for short-lived foods. These are typical
//   figures, not a food-safety check.

import { findPantryLibraryItem, type PantryLibraryItem, type PantryStorage } from '../constants/pantryData';
import { CATEGORY_LABELS } from '../constants/Itemicons';
import type { PantryCategoryId, PantryItem } from '../types';

const DAY = 24 * 60 * 60 * 1000;

export type StockStatus = 'ok' | 'low' | 'out';
export type FreshStatus = 'fresh' | 'soon' | 'expired' | 'unknown';

/** Library entry (icon, shelf life, storage, allergens...) for a pantry name, if known. */
export function libraryFor(name: string): PantryLibraryItem | undefined {
  return findPantryLibraryItem(name);
}

// ============================================
// STOCK
// ============================================

/** Level at which the item counts as running low. */
export function lowLevel(item: Pick<PantryItem, 'quantity' | 'stockedQty' | 'lowAt'>): number {
  if (typeof item.lowAt === 'number') return item.lowAt;
  const full = Math.max(item.stockedQty ?? item.quantity, item.quantity);
  return Math.floor(full / 4);
}

export function stockStatus(item: Pick<PantryItem, 'quantity' | 'stockedQty' | 'lowAt'>): StockStatus {
  if (item.quantity <= 0) return 'out';
  return item.quantity <= lowLevel(item) ? 'low' : 'ok';
}

// ============================================
// STORAGE & FRESHNESS
// ============================================

/** Rough defaults for items we don't know by name. */
const CATEGORY_DEFAULTS: Record<PantryCategoryId, { storage: PantryStorage; days: number | null }> = {
  produce: { storage: 'fridge', days: 7 },
  proteins: { storage: 'fridge', days: 3 },
  dairy: { storage: 'fridge', days: 10 },
  grains: { storage: 'pantry', days: 30 },
  pantry: { storage: 'pantry', days: 365 },
  other: { storage: 'pantry', days: null },
};

export function storageFor(item: Pick<PantryItem, 'name' | 'category'>): PantryStorage {
  return libraryFor(item.name)?.storage ?? CATEGORY_DEFAULTS[item.category]?.storage ?? 'pantry';
}

export interface Freshness {
  status: FreshStatus;
  /** Whole days left (negative = past). null when unknown. */
  daysLeft: number | null;
  shelfLifeDays: number | null;
  /** 1 = just bought, 0 = at its typical limit. */
  fraction: number;
}

export function freshness(item: PantryItem, now = Date.now()): Freshness {
  const shelf = libraryFor(item.name)?.shelfLifeDays ?? CATEGORY_DEFAULTS[item.category]?.days ?? null;
  if (!shelf || item.quantity <= 0) return { status: 'unknown', daysLeft: null, shelfLifeDays: shelf, fraction: 1 };
  const start = item.stockedAt ?? item.addedAt;
  const left = (start + shelf * DAY - now) / DAY;
  const daysLeft = Math.floor(left);
  const fraction = Math.max(0, Math.min(1, left / shelf));
  const soonWindow = Math.min(3, Math.max(1, Math.round(shelf * 0.2)));
  const status: FreshStatus = left < 0 ? 'expired' : left <= soonWindow ? 'soon' : 'fresh';
  return { status, daysLeft, shelfLifeDays: shelf, fraction };
}

/** "3 days left", "Use today", "2 days past" */
export function freshnessLabel(f: Freshness): string | null {
  if (f.daysLeft === null) return null;
  if (f.daysLeft < 0) return `${-f.daysLeft} day${f.daysLeft === -1 ? '' : 's'} past`;
  if (f.daysLeft === 0) return 'Use today';
  if (f.daysLeft > 90) return `Keeps ${Math.round(f.daysLeft / 30)} months`;
  return `${f.daysLeft} day${f.daysLeft === 1 ? '' : 's'} left`;
}

export const STORAGE_LABELS: Record<PantryStorage, { label: string; emoji: string }> = {
  fridge: { label: 'Fridge', emoji: '🧊' },
  freezer: { label: 'Freezer', emoji: '❄️' },
  pantry: { label: 'Cupboard', emoji: '🗄️' },
  counter: { label: 'Counter', emoji: '🧺' },
};

// ============================================
// STORE AISLES (grocery list order)
// ============================================

/** Roughly the order you walk a supermarket: fresh first, frozen last. */
export const AISLES = [
  'Produce',
  'Bakery',
  'Meat & Seafood',
  'Dairy & Refrigerated',
  'Pantry Staples',
  'Baking & Sweets',
  'Candy & Snacks',
  'Condiments & Sauces',
  'Spices & Seasonings',
  'Drinks',
  'Frozen',
  'Other',
] as const;
export type Aisle = (typeof AISLES)[number];

export const AISLE_EMOJI: Record<Aisle, string> = {
  Produce: '🥬',
  Bakery: '🥖',
  'Meat & Seafood': '🥩',
  'Dairy & Refrigerated': '🧀',
  'Pantry Staples': '🥫',
  'Baking & Sweets': '🧁',
  'Candy & Snacks': '🍬',
  'Condiments & Sauces': '🫙',
  'Spices & Seasonings': '🧂',
  Drinks: '🧃',
  Frozen: '❄️',
  Other: '🛒',
};

const LIBRARY_AISLE: Record<string, Aisle> = {
  Produce: 'Produce',
  Proteins: 'Meat & Seafood',
  'Dairy / Refrigerated': 'Dairy & Refrigerated',
  'Bread & Bakery': 'Bakery',
  'Pantry / Dry Goods': 'Pantry Staples',
  'Baking & Sweets': 'Baking & Sweets',
  Candy: 'Candy & Snacks',
  'Condiments & Sauces': 'Condiments & Sauces',
  'Spices & Seasonings': 'Spices & Seasonings',
  Frozen: 'Frozen',
  Drinks: 'Drinks',
};

const CATEGORY_AISLE: Record<PantryCategoryId, Aisle> = {
  produce: 'Produce',
  proteins: 'Meat & Seafood',
  dairy: 'Dairy & Refrigerated',
  grains: 'Pantry Staples',
  pantry: 'Pantry Staples',
  other: 'Other',
};

export function aisleFor(name: string, category: PantryCategoryId): Aisle {
  const lib = libraryFor(name);
  if (lib) {
    // Canned and dried beans and tinned fish live in the canned-goods aisle, tofu in the fridge.
    if (['Canned Beans', 'Canned Seafood', 'Dried Beans & Lentils'].includes(lib.subcategory)) return 'Pantry Staples';
    if (lib.subcategory === 'Plant Proteins') return 'Dairy & Refrigerated';
    return LIBRARY_AISLE[lib.category] ?? CATEGORY_AISLE[lib.pantryCategory];
  }
  return CATEGORY_AISLE[category] ?? 'Other';
}

export const aisleRank = (aisle: string) => {
  const i = (AISLES as readonly string[]).indexOf(aisle);
  return i === -1 ? AISLES.length : i;
};

// ============================================
// SUMMARY (header numbers, Home nudge, tab badge)
// ============================================

export interface PantrySummary {
  total: number;
  byStorage: Record<PantryStorage, PantryItem[]>;
  low: PantryItem[];
  out: PantryItem[];
  useSoon: PantryItem[];
  expired: PantryItem[];
}

export function summarizePantry(pantry: PantryItem[], now = Date.now()): PantrySummary {
  const byStorage: PantrySummary['byStorage'] = { fridge: [], freezer: [], pantry: [], counter: [] };
  const low: PantryItem[] = [];
  const out: PantryItem[] = [];
  const useSoon: PantryItem[] = [];
  const expired: PantryItem[] = [];
  for (const item of pantry) {
    const stock = stockStatus(item);
    if (stock === 'out') {
      out.push(item);
      continue;
    }
    byStorage[storageFor(item)].push(item);
    if (stock === 'low') low.push(item);
    const f = freshness(item, now);
    if (f.status === 'soon') useSoon.push(item);
    if (f.status === 'expired') expired.push(item);
  }
  const byDaysLeft = (a: PantryItem, b: PantryItem) =>
    (freshness(a, now).daysLeft ?? 0) - (freshness(b, now).daysLeft ?? 0);
  return {
    total: pantry.length - out.length,
    byStorage,
    low,
    out,
    useSoon: useSoon.sort(byDaysLeft),
    expired: expired.sort(byDaysLeft),
  };
}

export { CATEGORY_LABELS };
