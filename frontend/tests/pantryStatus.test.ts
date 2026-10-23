import {
  aisleFor,
  freshness,
  lowLevel,
  stockStatus,
  storageFor,
  summarizePantry,
} from '../utils/pantryStatus';

import type { PantryItem } from '../types';

const DAY = 86400000;
const now = Date.UTC(2026, 8, 25);

const item = (p: Partial<PantryItem>): PantryItem => ({
  id: 'x',
  name: 'Eggs',
  quantity: 12,
  unit: 'Items',
  category: 'dairy',
  icon: '🥚',
  addedAt: now,
  ...p,
});

describe('Pantry status utilities', () => {
  test('calculates low stock level', () => {
    expect(
      lowLevel(
        item({
          quantity: 12,
          stockedQty: 12,
        })
      )
    ).toBe(3);

    expect(
      lowLevel(
        item({
          quantity: 5,
        })
      )
    ).toBe(1);
  });

  test('calculates stock status', () => {
    expect(
      stockStatus(
        item({
          quantity: 4,
          stockedQty: 12,
        })
      )
    ).toBe('ok');

    expect(
      stockStatus(
        item({
          quantity: 3,
          stockedQty: 12,
        })
      )
    ).toBe('low');

    expect(
      stockStatus(
        item({
          quantity: 1,
          stockedQty: 1,
        })
      )
    ).toBe('ok');

    expect(
      stockStatus(
        item({
          quantity: 0,
          stockedQty: 1,
        })
      )
    ).toBe('out');

    expect(
      stockStatus(
        item({
          quantity: 2,
          stockedQty: 2,
          lowAt: 2,
        })
      )
    ).toBe('low');
  });

  test('calculates freshness from shelf life', () => {
    const milk = item({
      name: 'Milk',
      stockedAt: now - 2 * DAY,
      quantity: 1,
    });

    expect(freshness(milk, now).status).toBe('fresh');

    expect(
      freshness(
        item({
          name: 'Milk',
          stockedAt: now - 30 * DAY,
          quantity: 1,
        }),
        now
      ).status
    ).toBe('expired');

    expect(
      freshness(
        item({
          name: 'Salt',
          category: 'pantry',
          quantity: 1,
        }),
        now
      ).status
    ).toBe('fresh');

    expect(
      freshness(
        item({
          quantity: 0,
        }),
        now
      ).status
    ).toBe('unknown');
  });

  test('determines storage location', () => {
    expect(
      storageFor(
        item({
          name: 'Frozen Peas',
          category: 'produce',
        })
      )
    ).toBe('freezer');
  });

  test('determines pantry aisles', () => {
    expect(
      aisleFor('Black Beans', 'proteins')
    ).toBe('Pantry Staples');

    expect(
      aisleFor('Chicken Breast', 'proteins')
    ).toBe('Meat & Seafood');

    expect(
      aisleFor('Spinach', 'produce')
    ).toBe('Produce');

    expect(
      aisleFor('Mystery Sauce From Grandma', 'other')
    ).toBe('Other');
  });

  test('summarizes pantry stock', () => {
    const milk = item({
      name: 'Milk',
      stockedAt: now - 2 * DAY,
      quantity: 1,
    });

    const summary = summarizePantry(
      [
        item({
          id: 'a',
          quantity: 3,
          stockedQty: 12,
        }),
        item({
          id: 'b',
          name: 'Rice',
          category: 'grains',
          quantity: 0,
        }),
        milk,
      ],
      now
    );

    expect([
      summary.total,
      summary.low.length,
      summary.out.length,
    ]).toEqual([2, 1, 1]);
  });
});