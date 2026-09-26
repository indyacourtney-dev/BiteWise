// Run: npx tsx tests/syncMerge.test.ts
import { changedRows, mergeRows } from '../utils/syncMerge';

type Row = { id: string; name: string; updatedAt: number };
const r = (id: string, updatedAt: number, name = id): Row => ({ id, name, updatedAt });
const assert = {
  deepEqual(actual: unknown, expected: unknown) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
};
const names = (rows: Row[]) => rows.map(x => `${x.id}:${x.name}`).sort();

// First sync on a phone with items and an empty account: everything uploads.
assert.deepEqual(names(mergeRows([r('a', 10), r('b', 20)], [], { tombstones: new Set(), lastSyncAt: null })), ['a:a', 'b:b']);

// New phone, empty locally: gets the account's pantry.
assert.deepEqual(names(mergeRows([], [r('a', 10), r('b', 20)], { tombstones: new Set(), lastSyncAt: null })), ['a:a', 'b:b']);

// Same item edited on both: newest wins, both directions.
assert.deepEqual(names(mergeRows([r('a', 50, 'phone')], [r('a', 40, 'server')], { tombstones: new Set(), lastSyncAt: 30 })), ['a:phone']);
assert.deepEqual(names(mergeRows([r('a', 40, 'phone')], [r('a', 50, 'server')], { tombstones: new Set(), lastSyncAt: 30 })), ['a:server']);

// Deleted on this phone (tombstone) but still on the server: stays deleted.
assert.deepEqual(names(mergeRows([r('b', 20)], [r('a', 10), r('b', 20)], { tombstones: new Set(['a']), lastSyncAt: 25 })), ['b:b']);

// Deleted on another device: phone copy is older than the last sync, so it goes.
assert.deepEqual(names(mergeRows([r('a', 10), r('b', 20)], [r('b', 20)], { tombstones: new Set(), lastSyncAt: 25 })), ['b:b']);

// Added on this phone while offline (after the last sync): kept for upload.
assert.deepEqual(names(mergeRows([r('a', 10), r('c', 40)], [r('a', 10)], { tombstones: new Set(), lastSyncAt: 25 })), ['a:a', 'c:c']);

// Only rows whose updatedAt changed since the last push are uploaded.
const synced = new Map([['a', 10], ['b', 20]]);
assert.deepEqual(changedRows([r('a', 10), r('b', 21), r('c', 5)], synced).map(x => x.id), ['b', 'c']);

console.log('syncMerge: all 8 cases passed');
