// Run: npx tsx tests/pantryStatus.test.ts
import { aisleFor, freshness, lowLevel, stockStatus, storageFor, summarizePantry } from '../utils/pantryStatus';
import type { PantryItem } from '../types';

let passed = 0;
const eq = (actual: unknown, expected: unknown, what: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  passed++;
};
const DAY = 86400000;
const now = Date.UTC(2026, 8, 25);
const item = (p: Partial<PantryItem>): PantryItem => ({
  id: 'x', name: 'Eggs', quantity: 12, unit: 'Items', category: 'dairy', icon: '🥚', addedAt: now, ...p,
});

// Running low = a quarter of what you last stocked up
eq(lowLevel(item({ quantity: 12, stockedQty: 12 })), 3, '12 eggs -> low at 3');
eq(stockStatus(item({ quantity: 4, stockedQty: 12 })), 'ok', '4 of 12 is fine');
eq(stockStatus(item({ quantity: 3, stockedQty: 12 })), 'low', '3 of 12 is low');
eq(stockStatus(item({ quantity: 1, stockedQty: 1 })), 'ok', 'a single carton is not "low"');
eq(stockStatus(item({ quantity: 0, stockedQty: 1 })), 'out', 'none left is out');
eq(stockStatus(item({ quantity: 2, stockedQty: 2, lowAt: 2 })), 'low', 'custom level wins');
eq(lowLevel(item({ quantity: 5 })), 1, 'old items without stockedQty use current amount');

// Freshness from the library's shelf life
const milk = item({ name: 'Milk', stockedAt: now - 2 * DAY, quantity: 1 });
const f = freshness(milk, now);
eq(f.status, 'fresh', 'milk bought 2 days ago is fresh');
eq(freshness(item({ name: 'Milk', stockedAt: now - 30 * DAY, quantity: 1 }), now).status, 'expired', 'milk after a month is past');
eq(freshness(item({ name: 'Salt', category: 'pantry', quantity: 1 }), now).status, 'fresh', 'salt keeps');
eq(freshness(item({ quantity: 0 }), now).status, 'unknown', 'out-of-stock items have no freshness');
eq(storageFor(item({ name: 'Frozen Peas', category: 'produce' })), 'freezer', 'frozen peas live in the freezer');

// Store aisles
eq(aisleFor('Black Beans', 'proteins'), 'Pantry Staples', 'canned beans go to the canned aisle');
eq(aisleFor('Chicken Breast', 'proteins'), 'Meat & Seafood', 'chicken');
eq(aisleFor('Spinach', 'produce'), 'Produce', 'spinach');
eq(aisleFor('Mystery Sauce From Grandma', 'other'), 'Other', 'unknown item');

// Summary
const s = summarizePantry([item({ id: 'a', quantity: 3, stockedQty: 12 }), item({ id: 'b', name: 'Rice', category: 'grains', quantity: 0 }), milk], now);
eq([s.total, s.low.length, s.out.length], [2, 1, 1], 'summary counts');

console.log(`pantryStatus: all ${passed} checks passed`);
