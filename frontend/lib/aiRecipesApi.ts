// lib/aiRecipesApi.ts — "Create with AI".
//
// Asks the generate-recipes Edge Function (backend/supabase/functions/
// generate-recipes, Claude + the ingredient catalog) for new recipes, turns
// the answer into Recipe objects (utils/aiRecipes.ts), and sorts them with
// the same safety check every suggestion uses (utils/recipeSafety.ts):
// only 'safe' ones are returned as suggestions; the rest come back with the
// reason they were held back.
//
// Generated recipes aren't in the database, so the last ones are kept on
// the phone (AsyncStorage) for the recipe screen, favorites and the week plan.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { configured, supabase } from './supabase';
import { normalizeGeneratedRecipe, type WireLabels } from '../utils/aiRecipes';
import { screenRecipesForUser, type RecipeValidation } from '../utils/recipeSafety';
import type { MealType, Recipe, UserPreferences } from '../types';

export interface GenerateOptions {
  ingredients: string[];
  mealType: MealType;
  servings: number;
  count?: number;
  pantryOnly?: boolean;
  note?: string;
}

export interface GenerateResult {
  /** Passed the safety check. */
  recipes: Recipe[];
  /** Written, but not shown as suggestions, with the reason. */
  heldBack: { recipe: Recipe; validation: RecipeValidation }[];
  /** Recipes the AI sent that couldn't be read. */
  dropped: string[];
}

export class AiRecipeError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const TIMEOUT_MS = 120_000;

function preferencesForServer(p: UserPreferences) {
  return {
    dietary: p.dietary, avoidAllergens: p.avoidAllergens, customAllergies: p.customAllergies,
    customAvoid: p.customAvoid, favoriteTags: p.favoriteTags, dislikedTags: p.dislikedTags,
    customLoves: p.customLoves, cuisines: p.cuisines, spiceTolerance: p.spiceTolerance,
    maxCookMinutes: p.maxCookMinutes, preferredDifficulty: p.preferredDifficulty,
    allowAlcohol: p.allowAlcohol === true,
  };
}

async function errorFrom(error: any): Promise<AiRecipeError> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error?.message) return new AiRecipeError(body.error.code ?? 'error', body.error.message);
  } catch {}
  const msg = String(error?.message ?? '');
  if (/Failed to send|404|not found/i.test(msg)) {
    return new AiRecipeError('not_deployed', 'AI recipes aren’t set up on the server yet (deploy generate-recipes).');
  }
  return new AiRecipeError('network', 'Couldn’t reach BiteWise. Check your connection and try again.');
}

/** Ask for new recipes. Throws AiRecipeError with a message fit to show. */
export async function generateRecipes(opts: GenerateOptions, prefs: UserPreferences): Promise<GenerateResult> {
  if (!configured) throw new AiRecipeError('not_configured', 'AI recipes need the BiteWise server. Add the Supabase keys to frontend/.env.');

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AiRecipeError('timeout', 'That took too long. Try again, or ask for fewer recipes.')), TIMEOUT_MS);
  });
  let data: any;
  try {
    const call = supabase.functions.invoke('generate-recipes', {
      method: 'POST',
      body: { ...opts, preferences: preferencesForServer(prefs) },
    });
    const { data: d, error } = await Promise.race([call, timeout]);
    if (error) throw await errorFrom(error);
    data = d;
  } catch (e) {
    throw e instanceof AiRecipeError ? e : await errorFrom(e);
  } finally {
    clearTimeout(timer);
  }

  const items: unknown[] = Array.isArray(data?.recipes) ? data.recipes : [];
  const model = typeof data?.model === 'string' ? data.model : 'unknown';
  const now = Date.now();
  const read: Recipe[] = [];
  const dropped: string[] = [];
  items.forEach((item: any, index) => {
    const r = normalizeGeneratedRecipe(item?.recipe, item?.labels as WireLabels, {
      mealType: opts.mealType, servings: opts.servings, model, now, index,
    });
    if (r.ok) read.push(r.recipe);
    else dropped.push(r.reason);
  });
  if (read.length === 0) {
    throw new AiRecipeError('malformed', 'The AI’s answer couldn’t be read. Please try again.');
  }

  // The safety gate. Anything it can't confirm is held back, never shown as a suggestion.
  const screened = screenRecipesForUser(read, prefs);
  await saveGeneratedRecipes(read);
  return { recipes: screened.safe, heldBack: [...screened.rejected, ...screened.review], dropped };
}

// ============================================
// ON-PHONE STORE
// ============================================

const KEY = 'bitewise:aiRecipes:v1';
const KEEP = 40;
const memory = new Map<string, Recipe>();
let loaded: Promise<void> | null = null;

function load(): Promise<void> {
  if (!loaded) {
    loaded = AsyncStorage.getItem(KEY)
      .then(raw => {
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) {
          for (const r of list) if (r && typeof r.id === 'string' && r.source === 'ai' && !memory.has(r.id)) memory.set(r.id, r);
        }
      })
      .catch(() => {});
  }
  return loaded;
}

async function saveGeneratedRecipes(recipes: Recipe[]): Promise<void> {
  await load();
  for (const r of recipes) {
    memory.delete(r.id);
    memory.set(r.id, r);
  }
  const all = Array.from(memory.values()).slice(-KEEP);
  memory.clear();
  all.forEach(r => memory.set(r.id, r));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export const isGeneratedRecipeId = (id: string) => id.startsWith('ai-');

/** Instant lookup (recipes made or loaded this session). */
export function getGeneratedRecipe(id: string): Recipe | undefined {
  return memory.get(id);
}

/** Lookup that also reads the on-phone store after a restart. */
export async function loadGeneratedRecipe(id: string): Promise<Recipe | undefined> {
  await load();
  return memory.get(id);
}
