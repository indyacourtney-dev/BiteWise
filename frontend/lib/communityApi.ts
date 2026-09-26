// lib/communityApi.ts
//
// Task 1.7 — people helping each other decide:
//   * chat rooms (a default room per meal plus user-made rooms), with live
//     messages and recipe cards you can share into the chat
//   * home recipes: users share their own recipes into the database so
//     everyone can find, favorite and get them suggested
//
// Backed by backend/supabase/migrations/20260925000000_meals_favorites_community.sql.
// Row-level security does the policing: you can only post in rooms you've
// joined, and allergens/diet tags on shared recipes are computed by the
// database, never taken from the user.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, configured } from './supabase';
import { rowToRecipe, RecipeRow } from './recipeRow';
import type { Difficulty, Ingredient, MealType, Recipe, Vibe } from '../types';

// ============================================
// TYPES
// ============================================

export interface Profile {
  id: string;
  username: string | null;
  avatarEmoji: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  mealType: MealType | null;
  isDefault: boolean;
  memberCount: number;
  joined: boolean;
  lastMessageAt: string | null;
}

export interface ChatMessage {
  id: number;
  roomId: string;
  userId: string;
  body: string;
  createdAt: string;
  author: { username: string | null; avatarEmoji: string; avatarUrl: string | null };
  /** A recipe card shared into the chat. */
  recipe: { id: string; name: string; emoji: string } | null;
}

export interface NewHomeRecipe {
  name: string;
  emoji: string;
  mealTypes: MealType[];
  vibe: Vibe;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  instructions: string[];
}

const MESSAGE_SELECT =
  'id, room_id, user_id, body, created_at, profiles(username, avatar_emoji, avatar_url), recipes(id, name, emoji)';

function toMessage(r: any): ChatMessage {
  return {
    id: r.id,
    roomId: r.room_id,
    userId: r.user_id,
    body: r.body ?? '',
    createdAt: r.created_at,
    author: {
      username: r.profiles?.username ?? null,
      avatarEmoji: r.profiles?.avatar_emoji ?? '🧑‍🍳',
      avatarUrl: r.profiles?.avatar_url ?? null,
    },
    recipe: r.recipes ? { id: r.recipes.id, name: r.recipes.name, emoji: r.recipes.emoji } : null,
  };
}

function assertConfigured() {
  if (!configured) throw new Error('Community needs the Supabase backend. Add the keys to frontend/.env.');
}

// ============================================
// PROFILE
// ============================================

/** Make sure the signed-in user has a profile (name + emoji shown in chat). */
export async function ensureProfile(): Promise<Profile> {
  assertConfigured();
  const { data, error } = await supabase.rpc('ensure_profile');
  if (error) throw new Error(error.message);
  const p = data as any;
  return { id: p.id, username: p.username, avatarEmoji: p.avatar_emoji };
}

export async function updateProfile(patch: { username?: string; avatarEmoji?: string }, userId: string) {
  assertConfigured();
  const { error } = await supabase
    .from('profiles')
    .update({
      ...(patch.username !== undefined ? { username: patch.username.trim() } : {}),
      ...(patch.avatarEmoji !== undefined ? { avatar_emoji: patch.avatarEmoji } : {}),
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

// ============================================
// ROOMS
// ============================================

export async function listRooms(): Promise<ChatRoom[]> {
  assertConfigured();
  const { data, error } = await supabase.rpc('list_rooms');
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    emoji: r.emoji,
    mealType: r.meal_type,
    isDefault: r.is_default,
    memberCount: r.member_count,
    joined: r.joined,
    lastMessageAt: r.last_message_at,
  }));
}

export async function createRoom(room: {
  name: string; description?: string; emoji?: string; mealType?: MealType | null; userId: string;
}): Promise<string> {
  assertConfigured();
  const { data, error } = await supabase
    .from('chat_rooms')
    .insert({
      name: room.name.trim(),
      description: room.description?.trim() || null,
      emoji: room.emoji || '💬',
      meal_type: room.mealType ?? null,
      created_by: room.userId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;   // the creator is added as a member by a database trigger
}

export async function joinRoom(roomId: string, userId: string): Promise<void> {
  assertConfigured();
  const { error } = await supabase
    .from('room_members')
    .upsert({ room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  assertConfigured();
  const { error } = await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ============================================
// MESSAGES
// ============================================

/** Latest messages, oldest first (ready to render top to bottom). */
export async function fetchMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
  assertConfigured();
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMessage).reverse();
}

export async function sendMessage(roomId: string, body: string, recipeId?: string | null): Promise<ChatMessage> {
  assertConfigured();
  const { data, error } = await supabase
    .from('messages')
    .insert({ room_id: roomId, body: body.trim(), recipe_id: recipeId ?? null })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return toMessage(data);
}

/**
 * Live updates: calls onMessage for every new message in the room (including
 * your own, so de-duplicate by id). Returns an unsubscribe function.
 */
export function subscribeToRoom(roomId: string, onMessage: (m: ChatMessage) => void): () => void {
  if (!configured) return () => {};
  const channel: RealtimeChannel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      async payload => {
        // The realtime payload has no author name; fetch the full row.
        const { data } = await supabase
          .from('messages')
          .select(MESSAGE_SELECT)
          .eq('id', (payload.new as any).id)
          .maybeSingle();
        if (data) onMessage(toMessage(data));
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================
// HOME RECIPES
// ============================================

/**
 * Share a home recipe with everyone. The database matches the ingredients,
 * works out allergens and diet tags, and makes it available to pantry
 * matching and suggestions. Returns the saved recipe.
 */
export async function shareHomeRecipe(recipe: NewHomeRecipe, userId: string): Promise<Recipe> {
  assertConfigured();
  const ingredients = recipe.ingredients
    .map(i => ({ ...i, name: i.name.trim(), amount: i.amount.trim() }))
    .filter(i => i.name);
  const instructions = recipe.instructions.map(s => s.trim()).filter(Boolean);
  if (!recipe.name.trim()) throw new Error('Give your recipe a name.');
  if (recipe.mealTypes.length === 0) throw new Error('Pick at least one meal it suits.');
  if (ingredients.length < 2) throw new Error('Add at least two ingredients.');
  if (instructions.length === 0) throw new Error('Add at least one step.');

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      name: recipe.name.trim(),
      emoji: recipe.emoji || '🍽️',
      meal_types: recipe.mealTypes,
      vibe: recipe.vibe,
      prep_minutes: recipe.prepMinutes,
      cook_minutes: recipe.cookMinutes,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      ingredients,
      instructions,
      tags: [],
      source: 'community',
      author_id: userId,
    })
    .select('*, profiles(username)')
    .single();
  if (error) throw new Error(error.message);
  return rowToRecipe(data as RecipeRow);
}

export async function fetchCommunityRecipes(
  opts: { mealType?: MealType; sort?: 'new' | 'popular'; authorId?: string; limit?: number } = {},
): Promise<Recipe[]> {
  if (!configured) return [];
  let q = supabase.from('recipes').select('*, profiles(username)').eq('source', 'community');
  if (opts.mealType) q = q.contains('meal_types', [opts.mealType]);
  if (opts.authorId) q = q.eq('author_id', opts.authorId);
  q = opts.sort === 'popular'
    ? q.order('favorite_count', { ascending: false }).order('created_at', { ascending: false })
    : q.order('created_at', { ascending: false });
  const { data, error } = await q.limit(opts.limit ?? 50);
  if (error) throw new Error(error.message);
  return (data as RecipeRow[]).map(rowToRecipe);
}

export async function deleteHomeRecipe(recipeId: string): Promise<void> {
  assertConfigured();
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId).eq('source', 'community');
  if (error) throw new Error(error.message);
}
