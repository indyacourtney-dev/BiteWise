// lib/preferencesSync.ts
//
// Saves the onboarding answers (diet, allergies, tastes, name, household...)
// and the "finished onboarding" flag to the user's account (Supabase table
// user_preferences, created by
// backend/supabase/migrations/20261107000000_user_preferences_sync.sql).
//
// Before this, those lived only in the phone's AsyncStorage. The pantry and
// favorites already followed the account, so someone who set up on the web
// and then signed in on iOS saw their pantry but was asked to do onboarding
// again. Now preferences work like the pantry (lib/kitchenSync.ts):
//
//   pull   on sign-in: if the account's copy is newer, it replaces the
//          phone's; if the phone's is newer (edited offline), it's uploaded
//   push   about a second after the last change
//
// One row per user, newest updated_at wins. If the table doesn't exist yet
// (migration not run) sync switches itself off for the session and the app
// carries on with local storage only.

import { supabase, configured } from './supabase';
import type { UserPreferences } from '../types';

export interface RemotePreferences {
  preferences: Partial<UserPreferences>;
  /** ms since epoch when onboarding was finished; null = not yet. */
  onboardedAt: number | null;
  /** ms since epoch of the last change on any device. */
  updatedAt: number;
}

let unavailable = false;

const missing = (msg: string) => /does not exist|could not find|schema cache|PGRST20[25]|42P01/i.test(msg);

export function preferencesSyncAvailable(): boolean {
  return configured && !unavailable;
}

/** For tests and sign-out: forget that the table was missing. */
export function resetPreferencesSync() {
  unavailable = false;
}

/**
 * The account's copy. null = the account has none yet; undefined = the
 * server couldn't say (offline, keys missing, migration not run).
 */
export async function pullPreferences(): Promise<RemotePreferences | null | undefined> {
  if (!preferencesSyncAvailable()) return undefined;
  const { data, error } = await supabase
    .from('user_preferences')
    .select('preferences, onboarded_at, updated_at')
    .maybeSingle();
  if (error) {
    if (missing(`${error.code ?? ''} ${error.message}`)) {
      unavailable = true;
      console.warn('BiteWise: preferences sync is off until the user_preferences migration is run.');
    } else {
      console.warn('BiteWise: could not load preferences from the account', error.message);
    }
    return undefined;
  }
  if (!data) return null;
  const row = data as { preferences: unknown; onboarded_at: number | string | null; updated_at: number | string };
  const prefs = row.preferences && typeof row.preferences === 'object' ? (row.preferences as Partial<UserPreferences>) : {};
  return {
    preferences: prefs,
    onboardedAt: row.onboarded_at == null ? null : Number(row.onboarded_at),
    updatedAt: Number(row.updated_at) || 0,
  };
}

/** Upload this phone's copy. Returns false if sync is off or the write failed. */
export async function pushPreferences(
  preferences: UserPreferences,
  onboardedAt: number | null,
  updatedAt: number,
): Promise<boolean> {
  if (!preferencesSyncAvailable()) return false;
  // allowAlcohol is worked out from the locked birthday on each device and
  // must never be stored or trusted from a sync payload.
  const { allowAlcohol: _ignored, ...stored } = preferences;
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { preferences: stored, onboarded_at: onboardedAt, updated_at: updatedAt },
      { onConflict: 'user_id' },
    );
  if (error) {
    if (missing(`${error.code ?? ''} ${error.message}`)) {
      unavailable = true;
      console.warn('BiteWise: preferences sync is off until the user_preferences migration is run.');
    } else {
      console.warn('BiteWise: could not save preferences to the account', error.message);
    }
    return false;
  }
  return true;
}

/**
 * Decide what to do after a pull. Pure, so tests/preferencesSync.test.ts can
 * cover every case without a network.
 *
 *   adopt   the account's copy is newer: replace the phone's
 *   push    the phone's copy is newer (or the account has none and the
 *           phone has something worth keeping): upload it
 *   none    they're the same, or nothing to do
 */
export function reconcilePreferences(
  local: { updatedAt: number; onboardedAt: number | null; hasChanges: boolean },
  remote: RemotePreferences | null | undefined,
): 'adopt' | 'push' | 'none' {
  if (remote === undefined) return 'none';
  if (remote === null) return local.onboardedAt !== null || local.hasChanges ? 'push' : 'none';
  if (remote.updatedAt > local.updatedAt) return 'adopt';
  if (local.updatedAt > remote.updatedAt) return 'push';
  // Same timestamp: an older install that finished onboarding before
  // timestamps existed still gets its flag uploaded.
  if (local.onboardedAt !== null && remote.onboardedAt === null) return 'push';
  return 'none';
}
