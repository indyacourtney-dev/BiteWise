// lib/favoritesApi.ts
//
// Favorites (the heart) stored in Supabase, per signed-in user
// (table `favorites`, backend/supabase/migrations/20260925000000_*).
//
// AppContext is the only caller: it keeps favorites in memory and
// AsyncStorage for instant hearts and offline use, and syncs with these
// functions in the background. Screens use useApp().toggleFavorite.

import { supabase, configured } from './supabase';
import type { SavedRecipe } from '../types';

export async function fetchFavorites(): Promise<SavedRecipe[]> {
  if (!configured) return [];
  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({ recipeId: r.recipe_id as string, savedAt: Date.parse(r.created_at as string) }));
}

export async function addFavorite(recipeId: string): Promise<void> {
  if (!configured) return;
  const { error } = await supabase
    .from('favorites')
    .upsert({ recipe_id: recipeId }, { onConflict: 'user_id,recipe_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeFavorite(recipeId: string): Promise<void> {
  if (!configured) return;
  const { error } = await supabase.from('favorites').delete().eq('recipe_id', recipeId);
  if (error) throw error;
}

/**
 * First sync after sign-in: favorites saved on this phone before (or while
 * offline) are uploaded, then the combined list is returned. Nothing is lost
 * whichever side had it.
 */
export async function syncFavorites(local: SavedRecipe[]): Promise<SavedRecipe[]> {
  const remote = await fetchFavorites();
  const remoteIds = new Set(remote.map(f => f.recipeId));
  const toUpload = local.filter(f => !remoteIds.has(f.recipeId));
  for (const f of toUpload) {
    try {
      await addFavorite(f.recipeId);
    } catch {
      // A recipe that no longer exists in the database can't be saved there;
      // keep it locally rather than failing the whole sync.
    }
  }
  const merged = new Map<string, SavedRecipe>();
  [...remote, ...local].forEach(f => {
    const prev = merged.get(f.recipeId);
    if (!prev || f.savedAt > prev.savedAt) merged.set(f.recipeId, f);
  });
  return [...merged.values()].sort((a, b) => b.savedAt - a.savedAt);
}
