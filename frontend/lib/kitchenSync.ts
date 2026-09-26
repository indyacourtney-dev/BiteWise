// lib/kitchenSync.ts
//
// Saves the pantry and grocery list to the user's account (Supabase tables
// pantry_items and grocery_items, created by
// backend/supabase/migrations/20260929000000_pantry_and_grocery.sql), so they
// follow the user to a new phone and can be used by the database later.
//
// The phone stays the working copy: the app reads and writes AsyncStorage as
// before and works offline. This file only syncs:
//   pull   on sign-in and when the app comes back to the foreground
//   push   changed rows, about a second after the last edit
//
// MERGE RULES (utils/syncMerge.ts, tested in tests/syncMerge.test.ts)
//   * same id on both sides        -> the newer updatedAt wins
//   * only on the server           -> added on another device: keep it,
//                                     unless deleted here (tombstone)
//   * only on this phone           -> new here since the last sync: keep it
//                                     (it gets uploaded); older than the last
//                                     sync: it was deleted on another device,
//                                     so drop it
//
// If the tables don't exist yet (migration not run), sync switches itself
// off for the session and the app carries on with local storage only.

import { supabase, configured } from './supabase';
import type { GroceryItem, GrocerySource, PantryCategoryId, PantryItem } from '../types';
import { changedRows, mergeRows } from '../utils/syncMerge';

export { changedRows, mergeRows };

export type SyncTable = 'pantry_items' | 'grocery_items';

// ============================================
// ROW MAPPING
// ============================================

const pantryToRow = (i: PantryItem) => ({
  id: i.id,
  name: i.name,
  quantity: i.quantity,
  unit: i.unit,
  category: i.category,
  icon: i.icon,
  low_at: i.lowAt ?? null,
  stocked_qty: i.stockedQty ?? null,
  stocked_at: i.stockedAt ?? null,
  added_at: i.addedAt,
  updated_at: i.updatedAt ?? i.addedAt,
});

const pantryFromRow = (r: any): PantryItem => ({
  id: r.id,
  name: r.name,
  quantity: Number(r.quantity),
  unit: r.unit,
  category: r.category as PantryCategoryId,
  icon: r.icon ?? '🥫',
  addedAt: Number(r.added_at),
  ...(r.stocked_at != null ? { stockedAt: Number(r.stocked_at) } : {}),
  ...(r.stocked_qty != null ? { stockedQty: Number(r.stocked_qty) } : {}),
  ...(r.low_at != null ? { lowAt: Number(r.low_at) } : {}),
  updatedAt: Number(r.updated_at),
});

const groceryToRow = (g: GroceryItem) => ({
  id: g.id,
  name: g.name,
  icon: g.icon,
  quantity: g.quantity,
  unit: g.unit,
  category: g.category,
  aisle: g.aisle,
  checked: g.checked,
  source: g.source,
  note: g.note ?? null,
  added_at: g.addedAt,
  updated_at: g.updatedAt,
});

const groceryFromRow = (r: any): GroceryItem => ({
  id: r.id,
  name: r.name,
  icon: r.icon ?? '🛒',
  quantity: Number(r.quantity),
  unit: r.unit,
  category: r.category as PantryCategoryId,
  aisle: r.aisle,
  checked: !!r.checked,
  source: r.source as GrocerySource,
  ...(r.note ? { note: r.note } : {}),
  addedAt: Number(r.added_at),
  updatedAt: Number(r.updated_at),
});

// ============================================
// SERVER CALLS
// ============================================

let disabled = false;

/** Table missing (migration not run) or no Supabase keys: stop trying for this session. */
function isMissingTable(message: string): boolean {
  return /does not exist|could not find the table|schema cache|PGRST205|42P01/i.test(message);
}

export function syncAvailable(): boolean {
  return configured && !disabled;
}

async function run<T>(fn: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T | null> {
  const { data, error } = await fn();
  if (error) {
    if (isMissingTable(`${error.code ?? ''} ${error.message}`)) {
      disabled = true;
      console.warn('BiteWise: pantry sync is off until the pantry/grocery migration is run.');
      return null;
    }
    throw new Error(error.message);
  }
  return data;
}

export async function pullKitchen(): Promise<{ pantry: PantryItem[]; grocery: GroceryItem[] } | null> {
  if (!syncAvailable()) return null;
  const pantry = await run(() => supabase.from('pantry_items').select('*'));
  if (pantry === null) return null;
  const grocery = await run(() => supabase.from('grocery_items').select('*'));
  if (grocery === null) return null;
  return { pantry: (pantry as any[]).map(pantryFromRow), grocery: (grocery as any[]).map(groceryFromRow) };
}

/** Upload changed rows and delete tombstoned ones. Returns false if sync is off. */
export async function pushKitchen(changes: {
  pantryUpserts: PantryItem[];
  pantryDeletes: string[];
  groceryUpserts: GroceryItem[];
  groceryDeletes: string[];
}): Promise<boolean> {
  if (!syncAvailable()) return false;
  const steps: [SyncTable, () => PromiseLike<any>][] = [];
  // user_id is filled in by the database (default auth.uid()).
  if (changes.pantryUpserts.length)
    steps.push(['pantry_items', () => supabase.from('pantry_items').upsert(changes.pantryUpserts.map(pantryToRow), { onConflict: 'user_id,id' })]);
  if (changes.pantryDeletes.length)
    steps.push(['pantry_items', () => supabase.from('pantry_items').delete().in('id', changes.pantryDeletes)]);
  if (changes.groceryUpserts.length)
    steps.push(['grocery_items', () => supabase.from('grocery_items').upsert(changes.groceryUpserts.map(groceryToRow), { onConflict: 'user_id,id' })]);
  if (changes.groceryDeletes.length)
    steps.push(['grocery_items', () => supabase.from('grocery_items').delete().in('id', changes.groceryDeletes)]);

  for (const [, step] of steps) {
    const result = await run(step);
    if (result === null && disabled) return false;
  }
  return true;
}
