-- backend/supabase/migrations/20261107000000_user_preferences_sync.sql
--
-- PREFERENCES + ONBOARDING FOLLOW THE ACCOUNT.
--
-- Until now the onboarding answers (diet, allergies, tastes, name...) and the
-- "finished onboarding" flag lived only in the phone's AsyncStorage, scoped
-- per account. The pantry, favorites and birthday were already saved to the
-- account, so a user who set up on the web and then signed in on iOS saw
-- their pantry but was sent through onboarding again — with nothing
-- remembered. This table makes preferences work like the pantry does
-- (frontend/lib/preferencesSync.ts): the phone keeps a working copy, and
-- the newer change wins.
--
--   user_preferences.preferences   the app's UserPreferences object, as JSON
--   user_preferences.onboarded_at  ms since epoch when setup was finished,
--                                  null = not yet
--   user_preferences.updated_at    ms since epoch of the last change
--
-- A trigger mirrors avoidAllergens / dietary into the existing
-- user_allergens and user_diet_tags tables (only ids the catalog knows), so
-- server-side functions like pantry_matches() that call my_allergens() /
-- my_diet_tags() start respecting the user's choices without the app
-- having to send them each time.

create table if not exists public.user_preferences (
  user_id      uuid    primary key default auth.uid() references auth.users (id) on delete cascade,
  preferences  jsonb   not null default '{}'::jsonb,
  onboarded_at bigint,
  updated_at   bigint  not null,
  constraint user_preferences_is_object check (jsonb_typeof(preferences) = 'object'),
  constraint user_preferences_size check (pg_column_size(preferences) <= 32768)
);

comment on table public.user_preferences is
  'Each user''s onboarding answers and whether setup is done. Synced from the app (frontend/lib/preferencesSync.ts); times are ms since epoch.';

-- ---------------------------------------------------------------
-- Access: owner only
-- ---------------------------------------------------------------
alter table public.user_preferences enable row level security;

grant select, insert, update, delete on public.user_preferences to authenticated;
revoke all on public.user_preferences from anon;

drop policy if exists "own row: read" on public.user_preferences;
create policy "own row: read" on public.user_preferences
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own row: add" on public.user_preferences;
create policy "own row: add" on public.user_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "own row: change" on public.user_preferences;
create policy "own row: change" on public.user_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own row: remove" on public.user_preferences;
create policy "own row: remove" on public.user_preferences
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------
-- Mirror allergies and diets into the catalog-backed tables
-- ---------------------------------------------------------------
-- user_allergens / user_diet_tags have foreign keys to the ingredient
-- catalog, which knows fewer ids than the app offers (no sesame or corn,
-- for instance), so only matching ids are copied. The app's own filter
-- still applies the full list.
create or replace function public.user_preferences_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted_allergens text[] := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(coalesce(new.preferences -> 'avoidAllergens', '[]'::jsonb)) as x), '{}');
  wanted_diets text[] := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(coalesce(new.preferences -> 'dietary', '[]'::jsonb)) as x), '{}');
begin
  delete from public.user_allergens where user_id = new.user_id and not (allergen_id = any (wanted_allergens));
  insert into public.user_allergens (user_id, allergen_id)
    select new.user_id, a.id from public.allergens a where a.id = any (wanted_allergens)
  on conflict do nothing;

  delete from public.user_diet_tags where user_id = new.user_id and not (tag_id = any (wanted_diets));
  insert into public.user_diet_tags (user_id, tag_id)
    select new.user_id, d.id from public.diet_tags d where d.id = any (wanted_diets)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists user_preferences_mirror on public.user_preferences;
create trigger user_preferences_mirror
  after insert or update of preferences on public.user_preferences
  for each row execute function public.user_preferences_mirror();
