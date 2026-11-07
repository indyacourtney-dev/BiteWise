// tests/pantryWords.test.ts — the pantry speaks in sentences a person would say.

import { describe, expect, it } from '@jest/globals';
import { describeQuantity, freshnessSentence, itemWords, lowLevelSentence, nameWord, sinceSentence, stockSentence, unitWord } from '../utils/pantryWords';
import { freshness } from '../utils/pantryStatus';
import type { PantryItem } from '../types';

const DAY = 86400000;
const now = Date.UTC(2026, 10, 7, 12);
const item = (patch: Partial<PantryItem>): PantryItem => ({
  id: 'x', name: 'Eggs', quantity: 2, unit: 'Items', category: 'dairy', icon: '🥚',
  addedAt: now - 9 * DAY, stockedAt: now - 9 * DAY, stockedQty: 12, ...patch,
});

describe('units and names', () => {
  it('singular and plural units', () => {
    expect(unitWord('Bottles', 1)).toBe('bottle');
    expect(unitWord('Bottles', 2)).toBe('bottles');
    expect(unitWord('Bunches', 1)).toBe('bunch');
    expect(unitWord('Loaves', 1)).toBe('loaf');
    expect(unitWord('Heads', 2)).toBe('heads');
    expect(unitWord('Tbsp', 3)).toBe('tbsp');
    expect(unitWord('Dozen', 2)).toBe('dozen');
  });

  it('counts generic items by their own name', () => {
    expect(nameWord('Eggs', 1)).toBe('egg');
    expect(nameWord('Eggs', 2)).toBe('eggs');
    expect(nameWord('Lemon', 2)).toBe('lemons');
    expect(nameWord('Tomatoes', 1)).toBe('tomato');
    expect(nameWord('Peach', 2)).toBe('peaches');
    expect(nameWord('Strawberries', 1)).toBe('strawberry');
  });

  it('describeQuantity picks the right noun', () => {
    expect(describeQuantity({ name: 'Eggs', quantity: 12, unit: 'Items' })).toBe('12 eggs');
    expect(describeQuantity({ name: 'Lemon', quantity: 1, unit: 'Items' })).toBe('1 lemon');
    expect(describeQuantity({ name: 'Olive Oil', quantity: 1, unit: 'Bottles' })).toBe('1 bottle');
    expect(describeQuantity({ name: 'Rice', quantity: 3, unit: 'Cups' })).toBe('3 cups');
    expect(describeQuantity({ name: 'Garlic', quantity: 6, unit: 'Cloves' })).toBe('6 cloves');
  });
});

describe('stock', () => {
  it('says how much is left of what you stocked when running low', () => {
    expect(stockSentence(item({ quantity: 2, stockedQty: 12 }))).toEqual({ text: '2 eggs left of 12 · running low', tone: 'low' });
    expect(stockSentence(item({ quantity: 0 }))).toEqual({ text: 'Out', tone: 'out' });
    expect(stockSentence(item({ quantity: 10, stockedQty: 12 }))).toEqual({ text: '10 eggs', tone: 'ok' });
  });

  it('explains the running-low level', () => {
    expect(lowLevelSentence(item({ quantity: 10, stockedQty: 12 }))).toBe('When 3 eggs are left');
    expect(lowLevelSentence(item({ quantity: 1, stockedQty: 1, name: 'Milk', unit: 'Cartons' }))).toBe('Only when it runs out');
  });
});

describe('freshness', () => {
  const f = (daysLeft: number, status: 'fresh' | 'soon' | 'expired' = 'fresh') =>
    ({ status, daysLeft, shelfLifeDays: 30, fraction: 0.5 }) as const;
  it('speaks in days, weeks and months', () => {
    expect(freshnessSentence(f(0, 'soon'))).toBe('Use today');
    expect(freshnessSentence(f(1, 'soon'))).toBe('Use by tomorrow');
    expect(freshnessSentence(f(2, 'soon'))).toBe('Use within 2 days');
    expect(freshnessSentence(f(5))).toBe('Best within 5 days');
    expect(freshnessSentence(f(30))).toBe('Keeps about 4 weeks');
    expect(freshnessSentence(f(200))).toBe('Keeps about 7 months');
    expect(freshnessSentence(f(-2, 'expired'))).toBe('2 days past its best');
    expect(freshnessSentence({ status: 'unknown', daysLeft: null, shelfLifeDays: null, fraction: 1 })).toBeNull();
  });

  it('uses the library shelf life for known items', () => {
    const eggs = item({ quantity: 10 });   // library: eggs keep 35 days, stocked 9 days ago
    const fr = freshness(eggs, now);
    expect(fr.daysLeft).toBe(26);
    expect(freshnessSentence(fr)).toBe('Keeps about 4 weeks');
  });
});

describe('the one line under the name', () => {
  it('leads with the most urgent thing', () => {
    expect(itemWords(item({ quantity: 0 }), now).line).toBe('Out');
    expect(itemWords(item({ quantity: 2 }), now).line).toBe('2 eggs left of 12 · running low');
    const spinach = item({ name: 'Spinach', unit: 'Bags', quantity: 1, stockedQty: 1, stockedAt: now - 4 * DAY, addedAt: now - 4 * DAY, category: 'produce' });
    const w = itemWords(spinach, now);
    expect(w.tone).toBe('soon');
    expect(w.line).toMatch(/^1 bag · Use/);
  });

  it('says when it went in', () => {
    expect(sinceSentence(item({ stockedAt: now, addedAt: now }), now)).toBe('Added today');
    expect(sinceSentence(item({ stockedAt: now - DAY, addedAt: now - 20 * DAY }), now)).toBe('Bought yesterday');
    expect(sinceSentence(item({ stockedAt: now - 3 * DAY, addedAt: now - 20 * DAY }), now)).toBe('Bought 3 days ago');
  });
});
