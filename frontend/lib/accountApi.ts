// lib/accountApi.ts
//
// Everything on the Account settings screen:
//   profile photo (Supabase Storage "avatars" bucket), display name (shown
//   in chat), email and password (Supabase Auth), download my data, and
//   delete account (Edge Function backend/supabase/functions/delete-account).

import { Share } from 'react-native';
import { supabase, configured } from './supabase';
import type { AppSettings, GroceryItem, PantryItem, PlannedMeal, QuizRun, SavedRecipe, UserPreferences } from '../types';

export interface MyProfile {
  id: string;
  username: string | null;
  avatarEmoji: string;
  avatarUrl: string | null;
}

function need() {
  if (!configured) throw new Error('This needs the Supabase backend. Add the keys to frontend/.env.');
}

export async function fetchMyProfile(): Promise<MyProfile> {
  need();
  const { data, error } = await supabase.rpc('ensure_profile');   // creates it if missing
  if (error) throw new Error(error.message);
  const p = data as any;
  return { id: p.id, username: p.username, avatarEmoji: p.avatar_emoji, avatarUrl: p.avatar_url ?? null };
}

/** Name shown next to your chat messages and shared recipes. */
export async function updateDisplayName(userId: string, name: string): Promise<void> {
  need();
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error('Your display name can\'t be empty.');
  const { error } = await supabase.from('profiles').update({ username: clean }).eq('id', userId);
  if (error) throw new Error(error.message);
}

// ---------- Profile photo ----------

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

/**
 * Upload a photo picked with expo-image-picker and make it the profile picture.
 * Each upload gets a new file name so phones don't keep showing a cached old
 * photo; older files are removed afterwards.
 */
export async function uploadAvatar(userId: string, uri: string, mimeType = 'image/jpeg'): Promise<string> {
  need();
  const type = EXT[mimeType] ? mimeType : 'image/jpeg';
  const path = `${userId}/avatar-${Date.now()}.${EXT[type]}`;

  const bytes = await (await fetch(uri)).arrayBuffer();
  if (bytes.byteLength > 2 * 1024 * 1024) {
    throw new Error('That photo is too large (max 2 MB). Try cropping it or picking another.');
  }

  const bucket = supabase.storage.from('avatars');
  const { error: upErr } = await bucket.upload(path, bytes, { contentType: type, upsert: true });
  if (upErr) throw new Error(upErr.message);

  const url = bucket.getPublicUrl(path).data.publicUrl;
  const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (dbErr) throw new Error(dbErr.message);

  // Clean up older photos (best effort).
  const { data: files } = await bucket.list(userId);
  const old = (files ?? []).map(f => `${userId}/${f.name}`).filter(p => p !== path);
  if (old.length) await bucket.remove(old);

  return url;
}

export async function removeAvatar(userId: string): Promise<void> {
  need();
  const bucket = supabase.storage.from('avatars');
  const { data: files } = await bucket.list(userId);
  if (files?.length) await bucket.remove(files.map(f => `${userId}/${f.name}`));
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) throw new Error(error.message);
}

// ---------- Email & password ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Starts an email change. Supabase emails a confirmation link (by default to
 * both the old and the new address); the change applies once confirmed.
 */
export async function changeEmail(newEmail: string): Promise<void> {
  need();
  const email = newEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('That doesn\'t look like an email address.');
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new Error(error.message);
}

/** Checks the current password first, so a borrowed unlocked phone can't change it. */
export async function changePassword(currentEmail: string, currentPassword: string, newPassword: string): Promise<void> {
  need();
  if (newPassword.length < 8) throw new Error('Use at least 8 characters for the new password.');
  if (newPassword === currentPassword) throw new Error('The new password is the same as the current one.');
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: currentEmail, password: currentPassword });
  if (authErr) throw new Error('Your current password is incorrect.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

// ---------- Privacy ----------

/** Share a JSON copy of everything BiteWise keeps about you. */
export async function exportMyData(data: {
  email: string | undefined;
  profile: MyProfile | null;
  birthDate: string | null;
  preferences: UserPreferences;
  settings: AppSettings;
  favorites: SavedRecipe[];
  pantry: PantryItem[];
  grocery: GroceryItem[];
  mealPlan: PlannedMeal[];
  history: QuizRun[];
}): Promise<void> {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'BiteWise', ...data }, null, 2);
  await Share.share({ title: 'My BiteWise data', message: payload });
}

/** Permanently deletes the account on the server. The caller should sign out afterwards. */
export async function deleteMyAccount(): Promise<void> {
  need();
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    // Edge Function not deployed yet, or a server error with a message.
    let message = error.message;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message.includes('Failed to send') || message.includes('404')
      ? 'Account deletion isn\'t set up on the server yet (deploy the delete-account function).'
      : message);
  }
  if (!(data as any)?.ok) throw new Error('The server didn\'t confirm the deletion. Please try again.');
}
