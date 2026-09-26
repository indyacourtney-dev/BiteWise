-- backend/supabase/migrations/20261001000000_age_safeguard.sql
--
-- AGE SAFEGUARD: recipes made with alcohol are only for people 21+.
--
--   1. user_birthdates   each account's birthday, set ONCE and then locked.
--                        Its own table (not a profiles column) because
--                        profiles are readable by other users in Community.
--   2. set_my_birth_date the only way to save it. A second call can't
--                        change it; it returns the birthday already saved.
--   3. recipes.contains_alcohol
--                        kept up to date by a trigger, using the same word
--                        list as the app (frontend/utils/alcohol.ts).
--   4. A restrictive row-level policy on recipes: rows with alcohol are
--      only returned to signed-in users whose saved birthday makes them
--      21+. Signed-out users and anyone without a birthday get none.
--
-- The app also filters on its side (utils/matching.ts), so it's safe even
-- before this runs; this makes the rule hold for anyone calling the API
-- directly. Admins fix a wrong birthday in the dashboard (SQL editor runs
-- as postgres, which the lock allows).

-- The one-time check of existing recipes (section 2) can take a while on
-- a big imported recipe table, longer than Supabase's default per-statement
-- limit. Lift the limit for this migration only; it's reset at the end.
set statement_timeout = 0;

-- ---------------------------------------------------------------
-- 1. Birthdays
-- ---------------------------------------------------------------
create table if not exists public.user_birthdates (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  birth_date date not null,
  set_at     timestamptz not null default now()
);

comment on table public.user_birthdates is
  'Locked birthdays for the 21+ alcohol safeguard. Written only by set_my_birth_date().';

alter table public.user_birthdates enable row level security;

drop policy if exists "own birthday: read" on public.user_birthdates;
create policy "own birthday: read" on public.user_birthdates
  for select to authenticated
  using (user_id = (select auth.uid()));
-- No insert / update / delete policies: users can't write this table directly.

revoke all on public.user_birthdates from anon, authenticated;
grant select on public.user_birthdates to authenticated;

-- Sanity checks + the lock. Only database admins (dashboard / service key)
-- can change a birthday once it's saved.
create or replace function public.user_birthdates_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birth_date > current_date or new.birth_date < date '1900-01-01' then
    raise exception 'That birthday isn''t valid.' using errcode = '22008';
  end if;
  if tg_op = 'UPDATE'
     and new.birth_date is distinct from old.birth_date
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Your birthday is locked and can''t be changed.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists user_birthdates_guard on public.user_birthdates;
create trigger user_birthdates_guard
  before insert or update on public.user_birthdates
  for each row execute function public.user_birthdates_guard();

-- Save once. Returns the birthday on the account (the existing one if it
-- was already set, e.g. from another phone).
create or replace function public.set_my_birth_date(p_birth_date date)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  saved date;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  insert into public.user_birthdates (user_id, birth_date)
  values (uid, p_birth_date)
  on conflict (user_id) do nothing;
  select birth_date into saved from public.user_birthdates where user_id = uid;
  return saved;
end $$;

revoke all on function public.set_my_birth_date(date) from public, anon;
grant execute on function public.set_my_birth_date(date) to authenticated;

-- 21+ check. Feb 29 birthdays count on Mar 1 in non-leap years (same as the app).
create or replace function public.can_see_alcohol()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_birthdates
    where user_id = auth.uid()
      and birth_date <= (current_date - interval '21 years')::date
  )
$$;

revoke all on function public.can_see_alcohol() from public;
grant execute on function public.can_see_alcohol() to anon, authenticated;

-- ---------------------------------------------------------------
-- 2. Which recipes contain alcohol
-- ---------------------------------------------------------------
-- Keep these word lists in step with frontend/utils/alcohol.ts.

-- Remove things that only sound alcoholic (wine vinegar, ginger ale,
-- root beer, vanilla extract, "non-alcoholic ...", "virgin ...").
create or replace function public.alcohol_clean(t text)
returns text
language sql
immutable
as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    ' ' || lower(coalesce(t, '')) || ' ',
    '\m(red |white |rice |rice wine |sherry |champagne |apple |apple cider |malt |balsamic )?(wine|cider|sherry|champagne) vinegar\M', ' ', 'g'),
    '\mginger (ale|beer)\M', ' ', 'g'),
    '\m(root|birch) beer\M', ' ', 'g'),
    '\m(non[- ]?alcoholic|alcohol[- ]free|de-?alcoholi[sz]ed|zero[- ]proof|virgin)\s+[a-z]+(\s+[a-z]+)?', ' ', 'g'),
    '\mmocktails?\M', ' ', 'g'),
    '\m(vanilla|almond|lemon|orange|peppermint|mint|coconut|maple|rum)\s+extract\M', ' ', 'g'),
    '\m(apple|sweet|fresh|spiced) cider\M', ' ', 'g')
$$;

-- Unambiguous words (safe to look for in instructions too).
create or replace function public.alcohol_strong(t text)
returns boolean
language sql
immutable
as $$
  select public.alcohol_clean(t) ~
    '\m(wines?|beers?|lager|vodka|whiske?y|bourbon|brandy|cognac|tequila|mezcal|vermouth|sherry|marsala|champagne|prosecco|liqueur|amaretto|kahl[uú]a|triple sec|cointreau|grand marnier|schnapps|hard cider|hard seltzer|bitters|mirin|shaoxing|kirsch|absinthe|limoncello|sangria|margaritas?|mojito|martini|daiquiri|mimosa|negroni|bloody mary|cocktails?|boozy|spiked|port wine|cooking wine|rum|guinness|baileys|irish cream|ouzo|sambuca|spirits|liquor)\M'
$$;

-- Names and ingredient names: also words like gin, sake, stout, ale.
create or replace function public.alcohol_in_name(t text)
returns boolean
language sql
immutable
as $$
  select public.alcohol_strong(t)
      or public.alcohol_clean(t) ~ '\m(gin|sake|stout|ale|porter|soju|cider)\M'
$$;

create or replace function public.recipe_mentions_alcohol(
  p_name text, p_tags jsonb, p_ingredients jsonb, p_instructions jsonb
)
returns boolean
language sql
immutable
as $$
  select public.alcohol_in_name(p_name)
    or exists (
      select 1 from jsonb_array_elements(coalesce(p_tags, '[]'::jsonb)) t
      where jsonb_typeof(t) = 'string' and public.alcohol_in_name(t #>> '{}'))
    or exists (
      select 1 from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) i
      where public.alcohol_in_name(case jsonb_typeof(i) when 'object' then i ->> 'name' else i #>> '{}' end))
    or exists (
      select 1 from jsonb_array_elements(coalesce(p_instructions, '[]'::jsonb)) s
      where jsonb_typeof(s) = 'string' and public.alcohol_strong(s #>> '{}'))
$$;

alter table public.recipes add column if not exists contains_alcohol boolean not null default false;

create or replace function public.recipes_flag_alcohol()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.contains_alcohol := public.recipe_mentions_alcohol(
    new.name, to_jsonb(new.tags), to_jsonb(new.ingredients), to_jsonb(new.instructions));
  return new;
end $$;

drop trigger if exists recipes_flag_alcohol on public.recipes;
create trigger recipes_flag_alcohol
  before insert or update of name, tags, ingredients, instructions on public.recipes
  for each row execute function public.recipes_flag_alcohol();

-- Flag the recipes already there. A single quick word search first, so
-- the careful check (which strips out vinegars, ginger ale...) only runs on
-- the few recipes that mention a candidate word at all. On 150k recipes
-- this took 9 s instead of 49 s.
update public.recipes r
set contains_alcohol = true
where not r.contains_alcohol
  and (coalesce(r.name, '') || ' ' || coalesce(to_jsonb(r.tags)::text, '') || ' ' ||
       coalesce(to_jsonb(r.ingredients)::text, '') || ' ' || coalesce(to_jsonb(r.instructions)::text, ''))
      ~* '\m(wines?|beers?|lager|vodka|whiske?y|bourbon|brandy|cognac|tequila|mezcal|vermouth|sherry|marsala|champagne|prosecco|liqueur|amaretto|kahl[uú]a|triple sec|cointreau|marnier|schnapps|cider|seltzer|bitters|mirin|shaoxing|kirsch|absinthe|limoncello|sangria|margaritas?|mojito|martini|daiquiri|mimosa|negroni|bloody mary|cocktails?|boozy|spiked|port|rum|guinness|baileys|irish cream|ouzo|sambuca|spirits|liquor|gin|sake|stout|ale|porter|soju)\M'
  and public.recipe_mentions_alcohol(r.name, to_jsonb(r.tags), to_jsonb(r.ingredients), to_jsonb(r.instructions));

create index if not exists recipes_contains_alcohol_idx on public.recipes (contains_alcohol) where contains_alcohol;

-- ---------------------------------------------------------------
-- 3. The database-side rule
-- ---------------------------------------------------------------
-- RESTRICTIVE, so it's added on top of whatever read policies recipes
-- already has. Only applied if row-level security is on for recipes;
-- turning it on here without the existing read policy would hide every
-- recipe, so in that case this just prints a notice.
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'recipes' and c.relrowsecurity) then
    execute 'drop policy if exists "age safeguard: alcohol 21+" on public.recipes';
    execute 'create policy "age safeguard: alcohol 21+" on public.recipes
               as restrictive for select to anon, authenticated
               using (not contains_alcohol or (select public.can_see_alcohol()))';
  else
    raise notice 'recipes has row-level security off; the app filter still hides alcohol recipes from under-21s.';
  end if;
end $$;

reset statement_timeout;
