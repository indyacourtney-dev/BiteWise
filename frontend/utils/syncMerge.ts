// utils/syncMerge.ts — how the phone's pantry/grocery list and the
// account's copy are combined (see lib/kitchenSync.ts for when it runs).
//
//   * same id on both sides        -> the newer updatedAt wins
//   * only on the server           -> added on another device: keep it,
//                                     unless deleted on this phone (tombstone)
//   * only on this phone           -> changed since the last sync: keep it (it
//                                     gets uploaded); otherwise it was deleted
//                                     on another device, so drop it

export interface Synced {
  id: string;
  updatedAt?: number;
}

export function mergeRows<T extends Synced>(
  local: T[],
  remote: T[],
  opts: { tombstones: Set<string>; lastSyncAt: number | null },
): T[] {
  const byId = new Map<string, T>();
  const remoteIds = new Set(remote.map(r => r.id));

  for (const r of remote) {
    if (!opts.tombstones.has(r.id)) byId.set(r.id, r);
  }
  for (const l of local) {
    const r = byId.get(l.id);
    if (r) {
      if ((l.updatedAt ?? 0) > (r.updatedAt ?? 0)) byId.set(l.id, l);
      continue;
    }
    if (remoteIds.has(l.id)) continue; // tombstoned here: skip
    const changedSinceSync = opts.lastSyncAt === null || (l.updatedAt ?? 0) > opts.lastSyncAt;
    if (changedSinceSync) byId.set(l.id, l);
  }

  // Keep this phone's order, then anything new from other devices.
  const order = new Map(local.map((l, i) => [l.id, i]));
  return [...byId.values()].sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
}

/** Rows whose updatedAt differs from what was last synced. */
export function changedRows<T extends Synced>(rows: T[], synced: Map<string, number>): T[] {
  return rows.filter(r => synced.get(r.id) !== (r.updatedAt ?? 0));
}

