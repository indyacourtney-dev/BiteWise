import { changedRows, mergeRows } from '../utils/syncMerge';

type Row = {
  id: string;
  name: string;
  updatedAt: number;
};

const r = (
  id: string,
  updatedAt: number,
  name = id
): Row => ({
  id,
  name,
  updatedAt,
});

const names = (rows: Row[]) =>
  rows
    .map(x => `${x.id}:${x.name}`)
    .sort();

describe('Kitchen sync merge', () => {
  test('uploads phone items when the account is empty', () => {
    expect(
      names(
        mergeRows(
          [r('a', 10), r('b', 20)],
          [],
          {
            tombstones: new Set(),
            lastSyncAt: null,
          }
        )
      )
    ).toEqual(['a:a', 'b:b']);
  });

  test('downloads account items when the phone is empty', () => {
    expect(
      names(
        mergeRows(
          [],
          [r('a', 10), r('b', 20)],
          {
            tombstones: new Set(),
            lastSyncAt: null,
          }
        )
      )
    ).toEqual(['a:a', 'b:b']);
  });

  test('phone version wins when it is newer', () => {
    expect(
      names(
        mergeRows(
          [r('a', 50, 'phone')],
          [r('a', 40, 'server')],
          {
            tombstones: new Set(),
            lastSyncAt: 30,
          }
        )
      )
    ).toEqual(['a:phone']);
  });

  test('server version wins when it is newer', () => {
    expect(
      names(
        mergeRows(
          [r('a', 40, 'phone')],
          [r('a', 50, 'server')],
          {
            tombstones: new Set(),
            lastSyncAt: 30,
          }
        )
      )
    ).toEqual(['a:server']);
  });

  test('keeps an item deleted on the phone deleted from the merged result', () => {
    expect(
      names(
        mergeRows(
          [r('b', 20)],
          [r('a', 10), r('b', 20)],
          {
            tombstones: new Set(['a']),
            lastSyncAt: 25,
          }
        )
      )
    ).toEqual(['b:b']);
  });

  test('removes an old phone copy deleted on another device', () => {
    expect(
      names(
        mergeRows(
          [r('a', 10), r('b', 20)],
          [r('b', 20)],
          {
            tombstones: new Set(),
            lastSyncAt: 25,
          }
        )
      )
    ).toEqual(['b:b']);
  });

  test('keeps a new phone item added while offline', () => {
    expect(
      names(
        mergeRows(
          [r('a', 10), r('c', 40)],
          [r('a', 10)],
          {
            tombstones: new Set(),
            lastSyncAt: 25,
          }
        )
      )
    ).toEqual(['a:a', 'c:c']);
  });

  test('finds rows changed since the last sync', () => {
    const synced = new Map([
      ['a', 10],
      ['b', 20],
    ]);

    expect(
      changedRows(
        [r('a', 10), r('b', 21), r('c', 5)],
        synced
      ).map(x => x.id)
    ).toEqual(['b', 'c']);
  });
});