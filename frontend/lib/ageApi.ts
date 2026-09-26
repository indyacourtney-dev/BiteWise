// lib/ageApi.ts — the locked birthday, stored on the account.
//
// Table user_birthdates (backend migration 20261001000000_age_safeguard.sql):
// each person can read only their own row and can't write it directly.
// set_my_birth_date() saves it once; after that the database refuses any
// change (only an admin can fix a mistake, in the Supabase dashboard).
// Keeping it on the server means reinstalling or a new phone can't reset it.

import { supabase, configured } from './supabase';

let unavailable = false; // migration not run yet: fall back to this phone only

const missing = (msg: string) => /does not exist|could not find|schema cache|PGRST20[25]|42P01|42883/i.test(msg);

/** The birthday on the account, null if none, or undefined if the server can't say. */
export async function fetchMyBirthDate(): Promise<string | null | undefined> {
  if (!configured || unavailable) return undefined;
  const { data, error } = await supabase.from('user_birthdates').select('birth_date').maybeSingle();
  if (error) {
    if (missing(`${error.code ?? ''} ${error.message}`)) unavailable = true;
    else console.warn('BiteWise: could not load birthday', error.message);
    return undefined;
  }
  return (data as { birth_date: string } | null)?.birth_date ?? null;
}

/**
 * Saves the birthday once. Returns the birthday the account ends up with:
 * if one was already saved (say, on another phone), that one wins.
 * undefined = the server couldn't be reached; the phone keeps it and retries.
 */
export async function saveMyBirthDate(iso: string): Promise<string | undefined> {
  if (!configured || unavailable) return undefined;
  const { data, error } = await supabase.rpc('set_my_birth_date', { p_birth_date: iso });
  if (error) {
    if (missing(`${error.code ?? ''} ${error.message}`)) unavailable = true;
    else console.warn('BiteWise: could not save birthday', error.message);
    return undefined;
  }
  return (data as string) ?? iso;
}
