// backend/supabase/functions/generate-recipes/index.ts
//
// Writes new recipes with Claude from what the user has and likes, and
// labels them with allergens and diets from the BiteWise ingredient catalog.
// The app (frontend/lib/aiRecipesApi.ts) turns the answer into Recipe
// objects and runs every one through the safety check
// (frontend/utils/recipeSafety.ts) before showing it.
//
// The API key lives only here (a Supabase secret), never in the app.
//
// Setup, from backend/ (see backend/README.md "AI recipes"):
//   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   npx supabase db push                       # analyze_ingredients + rate-limit table
//   npx supabase functions deploy generate-recipes
// Optional secrets: BITEWISE_AI_MODEL (default claude-opus-5-5),
//   BITEWISE_AI_EFFORT (default low), BITEWISE_AI_HOURLY_LIMIT (default 20).
//
// Request:  POST { ingredients, mealType, servings, count?, pantryOnly?, note?, preferences }
// Response: 200 { recipes: [{ recipe, labels }], model }
//           4xx/5xx { error: { code, message } }

import Anthropic from 'npm:@anthropic-ai/sdk@^1.6.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  GenerationError, OUTPUT_SCHEMA, RequestError, SYSTEM_PROMPT,
  buildUserPrompt, ingredientNames, parseRequest, readRecipes,
} from './generation.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

const MODEL = Deno.env.get('BITEWISE_AI_MODEL') || 'claude-opus-5-5';
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
type Effort = (typeof EFFORTS)[number];
const envEffort = Deno.env.get('BITEWISE_AI_EFFORT') as Effort | undefined;
const EFFORT: Effort = envEffort && EFFORTS.includes(envEffort) ? envEffort : 'low';
const HOURLY_LIMIT = Number(Deno.env.get('BITEWISE_AI_HOURLY_LIMIT')) || 20;

/** Allergen/diet labels from the catalog, or 'unavailable' if that check failed. */
type Labels =
  | { status: 'checked'; allKnown: boolean; allergens: string[]; mayContain: string[]; dietary: string[]; unmatched: string[] }
  | { status: 'unavailable' };

async function labelFromCatalog(admin: SupabaseClient, names: string[]): Promise<Labels> {
  if (names.length === 0) return { status: 'unavailable' };
  try {
    const { data, error } = await admin.rpc('analyze_ingredients', { p_names: names });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return { status: 'unavailable' };
    return {
      status: 'checked',
      allKnown: row.all_known === true,
      allergens: row.allergens ?? [],
      mayContain: row.may_contain ?? [],
      dietary: row.dietary ?? [],
      unmatched: row.unmatched ?? [],
    };
  } catch {
    // The app treats 'unavailable' as unverified: never shown to anyone with restrictions.
    return { status: 'unavailable' };
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'bad_request', 'Use POST');

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!url || !serviceKey) return fail(500, 'not_configured', 'Server is missing its Supabase settings');
  if (!apiKey) return fail(503, 'not_configured', 'AI recipes aren’t set up on this server yet');

  // ---- who's asking ----
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, 'not_signed_in', 'Sign in to create recipes with AI');
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return fail(401, 'not_signed_in', 'Sign in to create recipes with AI');

  // ---- what they asked for ----
  let request;
  try {
    request = parseRequest(await req.json());
  } catch (e) {
    return fail(400, 'bad_request', e instanceof RequestError ? e.message : 'Send a JSON body');
  }

  // ---- hourly limit (each call costs money) ----
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('ai_generation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if ((count ?? 0) >= HOURLY_LIMIT) {
    return fail(429, 'rate_limited', 'You’ve made a lot of recipes this hour. Try again a little later.');
  }
  const { data: logRow } = await admin.from('ai_generation_requests').insert({ user_id: user.id }).select('id').single();
  const markLog = (ok: boolean) =>
    logRow ? admin.from('ai_generation_requests').update({ ok }).eq('id', logRow.id).then(() => {}, () => {}) : Promise.resolve();

  // ---- ask Claude ----
  const client = new Anthropic({ apiKey, timeout: 110_000, maxRetries: 1 });
  let recipes: Record<string, unknown>[];
  let servedBy = MODEL;
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, retry on Anthropic's recommended model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: EFFORT, format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(request) }],
    });
    servedBy = response.model;
    recipes = readRecipes(response.stop_reason, response.content);
  } catch (e) {
    await markLog(false);
    if (e instanceof GenerationError) {
      return fail(e.code === 'refused' ? 422 : 502, e.code, e.message);
    }
    if (e instanceof Anthropic.RateLimitError) {
      return fail(503, 'ai_busy', 'The AI is busy right now. Try again in a minute.');
    }
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      console.error('[generate-recipes] Anthropic key rejected', e.status);
      return fail(503, 'not_configured', 'AI recipes aren’t set up correctly on this server');
    }
    if (e instanceof Anthropic.APIConnectionTimeoutError) {
      return fail(504, 'ai_timeout', 'The AI took too long. Try asking for fewer recipes.');
    }
    if (e instanceof Anthropic.APIConnectionError) {
      return fail(502, 'ai_unavailable', 'Couldn’t reach the AI. Try again.');
    }
    if (e instanceof Anthropic.APIError) {
      console.error('[generate-recipes] Anthropic API error', e.status, e.message);
      return fail(502, 'ai_unavailable', 'The AI couldn’t make recipes right now. Try again.');
    }
    console.error('[generate-recipes] unexpected error', e);
    return fail(500, 'server_error', 'Something went wrong making recipes');
  }

  if (recipes.length === 0) {
    await markLog(false);
    return fail(422, 'no_recipes', 'The AI couldn’t write a recipe that fits all your restrictions. Try other ingredients.');
  }

  // ---- labels from the catalog (the AI's own claims stay as claims) ----
  const labelled = await Promise.all(
    recipes.map(async recipe => ({ recipe, labels: await labelFromCatalog(admin, ingredientNames(recipe)) })),
  );
  await markLog(true);
  return json({ recipes: labelled, model: servedBy });
});
