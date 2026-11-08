// tests/planSync.test.ts — the week plan's cross-device bookkeeping.

import { describe, expect, it } from '@jest/globals';
import { statusMaps, statusRows } from '../lib/planSync';
import { mergeRows } from '../utils/syncMerge';
import type { PlannedMeal } from '../types';

const meal = (id: string, updatedAt: number, patch: Partial<PlannedMeal> = {}): PlannedMeal => ({
  id, date: '2026-11-07', slot: 'dinner', recipeId: 'r1', name: 'Tacos', emoji: '🌮', cooked: false,
  addedAt: updatedAt, updatedAt, ...patch,
});

describe('status rows ↔ maps', () => {
  it('round-trips day and slot statuses with their timestamps', () => {
    const rows = statusRows(
      { '2026-11-09': 'takeout' },
      { '2026-11-08|lunch': 'leftovers' },
      { 'day:2026-11-09': 5, 'slot:2026-11-08|lunch': 7 },
    );
    expect(rows).toEqual(expect.arrayContaining([
      { id: 'day:2026-11-09', status: 'takeout', updatedAt: 5 },
      { id: 'slot:2026-11-08|lunch', status: 'leftovers', updatedAt: 7 },
    ]));
    const back = statusMaps(rows);
    expect(back.days).toEqual({ '2026-11-09': 'takeout' });
    expect(back.slots).toEqual({ '2026-11-08|lunch': 'leftovers' });
    expect(back.updatedAt['day:2026-11-09']).toBe(5);
  });
});

describe('merging a plan across devices', () => {
  it('a dinner planned on the web appears on a phone that had nothing', () => {
    const merged = mergeRows<PlannedMeal>([], [meal('web-1', 100)], { tombstones: new Set(), lastSyncAt: null });
    expect(merged.map(m => m.id)).toEqual(['web-1']);
  });

  it('marking it cooked on the phone (newer) wins over the web copy', () => {
    const merged = mergeRows<PlannedMeal>(
      [meal('web-1', 200, { cooked: true })],
      [meal('web-1', 100)],
      { tombstones: new Set(), lastSyncAt: 150 },
    );
    expect(merged[0].cooked).toBe(true);
  });

  it('a meal removed on the phone stays removed when the server still has it', () => {
    const merged = mergeRows<PlannedMeal>([], [meal('web-1', 100)], { tombstones: new Set(['web-1']), lastSyncAt: 150 });
    expect(merged).toEqual([]);
  });

  it('a meal removed on another device (older than last sync, gone from server) is dropped here', () => {
    const merged = mergeRows<PlannedMeal>([meal('old', 100)], [], { tombstones: new Set(), lastSyncAt: 150 });
    expect(merged).toEqual([]);
  });

  it('a meal added here since the last sync is kept for upload', () => {
    const merged = mergeRows<PlannedMeal>([meal('new', 300)], [], { tombstones: new Set(), lastSyncAt: 150 });
    expect(merged.map(m => m.id)).toEqual(['new']);
  });
});
