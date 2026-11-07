// lib/planSync.ts
//
// Saves the week plan to the user's account (Supabase tables
// meal_plan_items and meal_plan_statuses, created by
// backend/supabase/migrations/20261108000000_meal_plan_sync.sql), so meals
// planned on the web show up on the phone and the other way round.
//
// Same shape as lib/kitchenSync.ts: the device keeps the working copy,
//   pull   on sign-in and when the app comes back to the foreground
//   push   changed rows about a second after the last edit
// and the merge rules in utils/syncMerge.ts decide conflicts (newer
// updatedAt wins; deletions travel as tombstones).
//
// Day / slot statuses ("leftovers", "takeout", "no-cook") are stored as
// rows keyed 'day:<date>' or 'slot:<date>|<slot>'; setting one back to
// "cook" deletes the row. In the app they stay the two Record<string,…>
// maps AppContext already has; statusRows()/statusMaps() convert.

import { supabase, configured } from './supabase';
import type { PlanDayStatus, PlanSlot, PlannedMeal } from '../types';

export interface StatusRow {
  id: string;         // 'day:2026-11-07' | 'slot:2026-11-07|dinner'
  status: PlanDayStatus;
  updatedAt?: number;
}

// ============================================
// ROW MAPPING
// ============================================

const mealToRow = (m: PlannedMeal) => ({
  id: m.id,
  date: m.date,
  slot: m.slot,
  recipe_id: m.recipeId,
  name: m.name,
  emoji: m.emoji,
  minutes: m.minutes ?? null,
  servings: m.servings ?? null,
  meal_servings: m.mealServings ?? null,
  is_leftovers: !!m.isLeftovers,
  leftover_source_key: m.leftoverSourceKey ?? null,
  servings_estimated: m.servingsEstimated ?? null,
  cooked: !!m.cooked,
  added_at: m.addedAt,
  updated_at: m.updatedAt ?? m.addedAt,
});

const mealFromRow = (r: any): PlannedMeal => ({
  id: r.id,
  date: r.date,
  slot: r.slot as PlanSlot,
  recipeId: r.recipe_id,
  name: r.name,
  emoji: r.emoji ?? '🍽️',
  ...(r.minutes != null ? { minutes: Number(r.minutes) } : {}),
  ...(r.servings != null ? { servings: Number(r.servings) } : {}),
  ...(r.meal_servings != null ? { mealServings: Number(r.meal_servings) } : {}),
  ...(r.is_leftovers ? { isLeftovers: true } : {}),
  ...(r.leftover_source_key ? { leftoverSourceKey: r.leftover_source_key } : {}),
  ...(r.servings_estimated != null ? { servingsEstimated: !!r.servings_estimated } : {}),
  cooked: !!r.cooked,
  addedAt: Number(r.added_at),
  updatedAt: Number(r.updated_at),
});

const statusToRow = (s: StatusRow) => ({ key: s.id, status: s.status, updated_at: s.updatedAt ?? 0 });
const statusFromRow = (r: any): StatusRow => ({ id: r.key, status: r.status as PlanDayStatus, updatedAt: Number(r.updated_at) });

/** The two status maps as rows (for merging / uploading). */
export function statusRows(
  days: Record<string, PlanDayStatus>,
  slots: Record<string, PlanDayStatus>,
  updatedAt: Record<string, number>,
): StatusRow[] {
  return [
    ...Object.entries(days).map(([date, status]) => ({ id: `day:${date}`, status, updatedAt: updatedAt[`day:${date}`] ?? 0 })),
    ...Object.entries(slots).map(([key, status]) => ({ id: `slot:${key}`, status, updatedAt: updatedAt[`slot:${key}`] ?? 0 })),
  ];
}

/** Rows back into the two maps. */
export function statusMaps(rows: StatusRow[]): {
  days: Record<string, PlanDayStatus>;
  slots: Record<string, PlanDayStatus>;
  updatedAt: Record<string, number>;
} {
  const days: Record<string, PlanDayStatus> = {};
  const slots: Record<string, PlanDayStatus> = {};
  const updatedAt: Record<string, number> = {};
  for (const r of rows) {
    if (r.id.startsWith('day:')) days[r.id.slice(4)] = r.status;
    else if (r.id.startsWith('slot:')) slots[r.id.slice(5)] = r.status;
    updatedAt[r.id] = r.updatedAt ?? 0;
  }
  return { days, slots, updatedAt };
}

// ============================================
// SERVER CALLS
// ============================================

let disabled = false;

function isMissingTable(message: string): boolean {
  return /does not exist|could not find the table|schema cache|PGRST205|42P01/i.test(message);
}

export function planSyncAvailable(): boolean {
  return configured && !disabled;
}

async function run<T>(fn: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T | null> {
  const { data, error } = await fn();
  if (error) {
    if (isMissingTable(`${error.code ?? ''} ${error.message}`)) {
      disabled = true;
      console.warn('BiteWise: week-plan sync is off until the meal plan migration is run.');
      return null;
    }
    throw new Error(error.message);
  }
  return data;
}

export async function pullPlan(): Promise<{ meals: PlannedMeal[]; statuses: StatusRow[] } | null> {
  if (!planSyncAvailable()) return null;
  const meals = await run(() => supabase.from('meal_plan_items').select('*'));
  if (meals === null) return null;
  const statuses = await run(() => supabase.from('meal_plan_statuses').select('*'));
  if (statuses === null) return null;
  return { meals: (meals as any[]).map(mealFromRow), statuses: (statuses as any[]).map(statusFromRow) };
}

/** Upload changed rows and delete tombstoned ones. Returns false if sync is off. */
export async function pushPlan(changes: {
  mealUpserts: PlannedMeal[];
  mealDeletes: string[];
  statusUpserts: StatusRow[];
  statusDeletes: string[];
}): Promise<boolean> {
  if (!planSyncAvailable()) return false;
  const steps: (() => PromiseLike<any>)[] = [];
  if (changes.mealUpserts.length)
    steps.push(() => supabase.from('meal_plan_items').upsert(changes.mealUpserts.map(mealToRow), { onConflict: 'user_id,id' }));
  if (changes.mealDeletes.length)
    steps.push(() => supabase.from('meal_plan_items').delete().in('id', changes.mealDeletes));
  if (changes.statusUpserts.length)
    steps.push(() => supabase.from('meal_plan_statuses').upsert(changes.statusUpserts.map(statusToRow), { onConflict: 'user_id,key' }));
  if (changes.statusDeletes.length)
    steps.push(() => supabase.from('meal_plan_statuses').delete().in('key', changes.statusDeletes));
  for (const step of steps) {
    const result = await run(step);
    if (result === null && disabled) return false;
  }
  return true;
}
