// backend/supabase/functions/delete-account/index.ts
//
// Permanently deletes the signed-in user's account (Settings → Account →
// Delete account). Deleting a user needs admin rights, which must never be
// shipped inside the app, so it runs here on Supabase's servers.
//
// What goes: the login, profile, profile photos, favorites, pantry,
// preferences, chat memberships and messages (database cascades).
// What stays: recipes they shared with the community (without their name).
//
// Deploy (from backend/):   npx supabase functions deploy delete-account
// The app calls it with:    supabase.functions.invoke('delete-account')

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server is missing its Supabase settings' }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Who is asking? (The token proves it; users can only delete themselves.)
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'Not signed in' }, 401);

  // Profile photos aren't linked by a foreign key, so remove them first.
  const { data: files } = await admin.storage.from('avatars').list(user.id);
  if (files && files.length > 0) {
    await admin.storage.from('avatars').remove(files.map(f => `${user.id}/${f.name}`));
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ ok: true });
});
