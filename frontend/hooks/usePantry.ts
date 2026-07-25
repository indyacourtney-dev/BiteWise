// usePantry.ts
// Fetches GET /api/pantry and flattens it into a simple name list for
// matching against recipe ingredients.

import { useCallback, useEffect, useState } from 'react';

// Point this at your backend. In Expo, prefer an env var so it's easy to
// swap between a local Docker backend and a deployed one:
//   EXPO_PUBLIC_API_URL=http://192.168.1.23:3000   (use your LAN IP, not
//   localhost, when testing on a physical phone via Expo Go)
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface PantryItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
}

interface PantryCategory {
  category_name: string;
  items: PantryItem[];
}

interface PantryResponse {
  pantry_categories: PantryCategory[];
  quick_adds?: { id: number; name: string; category: string }[];
}

export function usePantry() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/pantry`);
      if (!res.ok) throw new Error(`Pantry request failed (${res.status})`);
      const data: PantryResponse = await res.json();
      const flat = data.pantry_categories.flatMap((c) => c.items);
      setItems(flat);
    } catch (e) {
      // Fail soft: the dinner screen still works without pantry data,
      // it just won't be able to rank by what's on hand.
      setError(e instanceof Error ? e.message : 'Could not load pantry');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pantryNames = items.map((i) => i.name.toLowerCase());

  return { items, pantryNames, loading, error, refresh: load };
}
