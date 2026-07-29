// lib/supabase.ts
//
// The one file the team has to edit: paste your project's URL and anon
// key below (Supabase dashboard → Project Settings → API). Full setup
// steps live in SETUP-AUTH.md at the repo root.
//
// persistSession is deliberately FALSE: the product decision is that
// users log in every time they open the app, so the session lives in
// memory only and dies when the app closes. Flip it to true later if
// the team changes its mind — everything else keeps working.

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// ── PASTE YOUR KEYS HERE ────────────────────────────────────────────
export const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL_HERE';
export const SUPABASE_ANON_KEY = 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE';
// ────────────────────────────────────────────────────────────────────

/** True once real keys are in place; the auth screen checks this and
 *  shows setup instructions instead of a broken login when false. */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 40;

export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? SUPABASE_ANON_KEY : 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,     // ← login required on every app launch
      autoRefreshToken: true,    // keep the in-memory session alive while open
      detectSessionInUrl: false, // no web-style redirect handling in RN
    },
  }
);
