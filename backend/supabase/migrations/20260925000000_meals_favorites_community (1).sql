-- backend/supabase/migrations/20260925000000_meals_favorites_community.sql
--
--   1. Meal types      recipes.meal_types: breakfast, brunch, lunch, dinner, dessert
--   2. Favorites       (Task 1.6) hearts saved per user, with a live
--                      favorite_count on each recipe ("saved by 23 cooks")
--   3. Profiles        display name + emoji for chat and shared recipes
--   4. Home recipes    (Task 1.7) users share their own recipes; the database
--                      tags allergens and diets itself so nobody can mislabel them
--   5. Chat rooms      (Task 1.7) public rooms, membership, messages (with an
--                      optional recipe card), live via Supabase Realtime
--   6. Pantry functions gain a meal-type filter
--
-- App side: frontend/lib/favoritesApi.ts, frontend/lib/communityApi.ts,
-- frontend/lib/pantryApi.ts.

-- =====================================================================
-- 1. MEAL TYPES
-- =====================================================================

alter table public.recipes
  add column if not exists meal_types text[] not null default '{}';

do $$ begin
  alter table public.recipes add constraint recipes_meal_types_check
    check (meal_types <@ array['breakfast', 'brunch', 'lunch', 'dinner', 'dessert']);
exception when duplicate_object then null;
end $$;

create index if not exists recipes_meal_types_gin on public.recipes using gin (meal_types);

comment on column public.recipes.meal_types is
  'Meals the recipe suits (breakfast, brunch, lunch, dinner, dessert). Empty = not suggested on its own.';

-- Curated recipes seeded before this migration were all dinners.
update public.recipes set meal_types = '{dinner}' where source = 'bitewise' and meal_types = '{}';

-- =====================================================================
-- 3. PROFILES (needed by favorites counts, chat and shared recipes)
-- =====================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text,
  avatar_emoji text not null default '🧑‍🍳',
  created_at   timestamptz not null default now()
);
-- Projects that already had a profiles table keep it; it just gains
-- whichever of these columns it's missing.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_emoji text not null default '🧑‍🍳';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

alter table public.profiles enable row level security;
drop policy if exists "profiles are visible to signed-in users" on public.profiles;
create policy "profiles are visible to signed-in users" on public.profiles
  for select to authenticated using (true);
drop policy if exists "users edit their own profile" on public.profiles;
create policy "users edit their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "users create their own profile" on public.profiles;
create policy "users create their own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

-- New sign-ups get a profile automatically (username from sign-up metadata).
--
-- Many projects already have a profile trigger on auth.users (Supabase's
-- starter template does). Postgres runs triggers in ALPHABETICAL order, so
-- this one is named "zz_..." to run LAST: an existing trigger creates the
-- profile first, and this one only fills in the username. Running first
-- would make an existing trigger's plain INSERT fail and block sign-ups.
--
-- It never blocks a sign-up itself: if its insert fails (e.g. an existing
-- profiles table with extra required columns), the app's ensure_profile()
-- call fills the gap later.
create or replace function public.bitewise_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.profiles (id, username)
    values (new.id, nullif(trim(new.raw_user_meta_data ->> 'username'), ''))
    on conflict (id) do update
      set username = coalesce(public.profiles.username, excluded.username);
  exception when others then
    raise warning 'bitewise_handle_new_user: could not create profile for %: %', new.id, sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists bitewise_on_auth_user_created on auth.users;   -- earlier draft name
drop trigger if exists zz_bitewise_on_auth_user_created on auth.users;
create trigger zz_bitewise_on_auth_user_created
  after insert on auth.users
  for each row execute function public.bitewise_handle_new_user();

-- Existing accounts (skipped quietly if an existing profiles table needs more columns).
do $$
begin
  insert into public.profiles (id, username)
  select id, nullif(trim(raw_user_meta_data ->> 'username'), '') from auth.users
  on conflict (id) do nothing;
exception when others then
  raise notice 'Could not backfill profiles (%). ensure_profile() will create them on sign-in.', sqlerrm;
end $$;

-- Called by the app after sign-in, in case a profile is missing.
create or replace function public.ensure_profile()
returns public.profiles language plpgsql volatile security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.profiles (id, username)
  select u.id, nullif(trim(u.raw_user_meta_data ->> 'username'), '') from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing;
  select * into p from public.profiles where id = auth.uid();
  return p;
end
$$;
revoke execute on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

-- =====================================================================
-- 2. FAVORITES (Task 1.6)
-- =====================================================================

alter table public.recipes
  add column if not exists favorite_count int not null default 0;
create index if not exists recipes_favorite_count_idx on public.recipes (favorite_count desc);

create table if not exists public.favorites (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id  text not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index if not exists favorites_recipe_idx on public.favorites (recipe_id);

alter table public.favorites enable row level security;
drop policy if exists "users manage their own favorites" on public.favorites;
create policy "users manage their own favorites" on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Keep recipes.favorite_count in step. Runs as the table owner because
-- users can't write to recipes directly.
create or replace function public.favorites_count_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.recipes set favorite_count = favorite_count + 1 where id = new.recipe_id;
  elsif tg_op = 'DELETE' then
    update public.recipes set favorite_count = greatest(0, favorite_count - 1) where id = old.recipe_id;
  end if;
  return null;
end
$$;

drop trigger if exists favorites_count on public.favorites;
create trigger favorites_count
  after insert or delete on public.favorites
  for each row execute function public.favorites_count_trigger();

-- =====================================================================
-- 4. HOME RECIPES SHARED BY USERS (Task 1.7)
-- =====================================================================

alter table public.recipes
  add column if not exists author_id uuid references public.profiles (id) on delete set null;
create index if not exists recipes_author_idx on public.recipes (author_id) where author_id is not null;

alter table public.recipes drop constraint if exists recipes_source_check;
alter table public.recipes add constraint recipes_source_check
  check (source in ('bitewise', 'kaggle', 'community'));

-- Users may only write the descriptive columns. Everything that affects
-- safety (allergens, dietary tags, verification) and popularity
-- (favorite_count) is computed by the trigger below.
revoke insert, update on public.recipes from anon, authenticated;
grant insert (name, emoji, tags, vibe, prep_minutes, cook_minutes, servings, difficulty,
              ingredients, instructions, meal_types, source, author_id)
  on public.recipes to authenticated;
grant update (name, emoji, tags, vibe, prep_minutes, cook_minutes, servings, difficulty,
              ingredients, instructions, meal_types)
  on public.recipes to authenticated;

drop policy if exists "users share home recipes" on public.recipes;
create policy "users share home recipes" on public.recipes
  for insert to authenticated
  with check (source = 'community' and author_id = (select auth.uid()) and cardinality(meal_types) > 0);

drop policy if exists "authors edit their home recipes" on public.recipes;
create policy "authors edit their home recipes" on public.recipes
  for update to authenticated
  using (source = 'community' and author_id = (select auth.uid()))
  with check (source = 'community' and author_id = (select auth.uid()));

drop policy if exists "authors delete their home recipes" on public.recipes;
create policy "authors delete their home recipes" on public.recipes
  for delete to authenticated
  using (source = 'community' and author_id = (select auth.uid()));
grant delete on public.recipes to authenticated;

-- Allergens and ingredient-based diet tags for a shared recipe, using the
-- same catalog and rules as the cleaning pipeline
-- (backend/database/cleaning/dietary.py ingredient_tags). Macro-based
-- health tags need measured weights, so community recipes don't get them.
create or replace function public.analyze_community_recipe()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ids       text[];
  all_known boolean;
  contains  text[];
  may       text[];
  risky     text[];
  fl        text[];
  diet      text[] := '{}';
begin
  if new.source is distinct from 'community' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.id := 'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    new.favorite_count := 0;
    new.created_at := now();
  end if;

  select array_agg(public.match_ingredient(e ->> 'name'))
  into ids
  from jsonb_array_elements(coalesce(new.ingredients, '[]')) e;
  ids := coalesce(ids, '{}');
  all_known := cardinality(ids) > 0 and array_position(ids, null) is null;

  select coalesce(array_agg(distinct allergen_id) filter (where level = 'contains'), '{}'),
         coalesce(array_agg(distinct allergen_id) filter (where level = 'may_contain'), '{}')
  into contains, may
  from public.ingredient_allergens where ingredient_id = any (ids);
  may := array(select unnest(may) except select unnest(contains));
  risky := contains || may;

  select coalesce(array_agg(distinct flag), '{}') into fl
  from public.ingredient_flags where ingredient_id = any (ids);

  if all_known then
    diet := diet || array(select a.free_tag from public.allergens a where not (a.id = any (risky)) order by a.id);
    if not fl && array['animal', 'dairy', 'egg', 'honey', 'gelatin'] then diet := diet || '{vegan}'; end if;
    if not fl && array['animal', 'gelatin'] then diet := diet || '{vegetarian}'; end if;
    if not fl && array['mammal', 'poultry', 'gelatin'] then diet := diet || '{pescatarian}'; end if;
    if not fl && array['mammal'] then diet := diet || '{no-red-meat}'; end if;
    if not fl && array['pork', 'gelatin'] then diet := diet || '{no-pork}'; end if;
    if not fl && array['processed_meat'] then diet := diet || '{no-processed-meat}'; end if;
    if not fl && array['alcohol'] then diet := diet || '{alcohol-free}'; end if;
    if not fl && array['pork', 'alcohol', 'gelatin'] and not risky && array['shellfish', 'mollusc'] then
      diet := diet || '{halal}';
    end if;
    if not fl && array['pork', 'gelatin'] and not risky && array['shellfish', 'mollusc']
       and not (fl && array['mammal', 'poultry'] and 'dairy' = any (fl)) then
      diet := diet || '{kosher-style}';
    end if;
    if not fl && array['grain', 'legume', 'dairy', 'refined_sugar', 'seed_oil', 'processed'] then
      diet := diet || '{paleo}';
    end if;
    if not fl && array['high_fodmap'] then diet := diet || '{low-fodmap}'; end if;
  end if;

  new.allergens := contains;
  new.may_contain := may;
  new.all_ingredients_known := all_known;
  new.allergens_verified := all_known;      -- unknown ingredient = never shown to allergic users
  new.dietary := diet;
  new.tags := array(select distinct t from unnest(coalesce(new.tags, '{}') || array_remove(ids, null)) t);
  new.nutrition := null;                    -- not measured for shared recipes
  new.plate := null;
  new.nutrition_coverage := null;
  new.servings_estimated := false;
  return new;
end
$$;

drop trigger if exists recipes_analyze_community on public.recipes;
create trigger recipes_analyze_community
  before insert or update of ingredients, meal_types, name on public.recipes
  for each row execute function public.analyze_community_recipe();

-- Shared recipes also get recipe_ingredients (pantry matching) and swaps,
-- exactly like curated ones.
create or replace function public.recipes_index_curated_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source in ('bitewise', 'community') then
    perform public.index_curated_recipe(new.id);
  end if;
  return null;
end
$$;

drop trigger if exists recipes_index_curated on public.recipes;
create trigger recipes_index_curated
  after insert or update of ingredients on public.recipes
  for each row execute function public.recipes_index_curated_trigger();

-- =====================================================================
-- 5. CHAT ROOMS (Task 1.7)
-- =====================================================================

create table if not exists public.chat_rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 60),
  description text check (char_length(description) <= 280),
  emoji       text not null default '💬',
  meal_type   text check (meal_type in ('breakfast', 'brunch', 'lunch', 'dinner', 'dessert')),
  is_public   boolean not null default true,
  is_default  boolean not null default false,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id   uuid not null references public.chat_rooms (id) on delete cascade,
  user_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members (user_id);

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.chat_rooms (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 2000),
  recipe_id  text references public.recipes (id) on delete set null,   -- a shared recipe card
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or recipe_id is not null)
);
create index if not exists messages_room_idx on public.messages (room_id, created_at desc);

-- Membership check without tripping RLS recursion.
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid())
$$;

alter table public.chat_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "see public rooms and rooms you're in" on public.chat_rooms;
create policy "see public rooms and rooms you're in" on public.chat_rooms
  for select to authenticated using (is_public or public.is_room_member(id));
drop policy if exists "signed-in users create rooms" on public.chat_rooms;
create policy "signed-in users create rooms" on public.chat_rooms
  for insert to authenticated with check (created_by = (select auth.uid()) and not is_default);
drop policy if exists "creators edit their rooms" on public.chat_rooms;
create policy "creators edit their rooms" on public.chat_rooms
  for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
drop policy if exists "creators delete their rooms" on public.chat_rooms;
create policy "creators delete their rooms" on public.chat_rooms
  for delete to authenticated using (created_by = (select auth.uid()) and not is_default);

drop policy if exists "see members of rooms you can see" on public.room_members;
create policy "see members of rooms you can see" on public.room_members
  for select to authenticated
  using (exists (select 1 from public.chat_rooms r where r.id = room_id
                 and (r.is_public or public.is_room_member(r.id))));
drop policy if exists "join public rooms" on public.room_members;
create policy "join public rooms" on public.room_members
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.chat_rooms r where r.id = room_id
                          and (r.is_public or r.created_by = (select auth.uid()))));
drop policy if exists "leave rooms" on public.room_members;
create policy "leave rooms" on public.room_members
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages
  for select to authenticated using (public.is_room_member(room_id));
drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_room_member(room_id));
drop policy if exists "authors delete their messages" on public.messages;
create policy "authors delete their messages" on public.messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- Room creators join their own room automatically.
create or replace function public.chat_rooms_join_creator()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.room_members (room_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  end if;
  return null;
end
$$;
drop trigger if exists chat_rooms_join_creator on public.chat_rooms;
create trigger chat_rooms_join_creator
  after insert on public.chat_rooms
  for each row execute function public.chat_rooms_join_creator();

-- Rooms everyone starts with.
insert into public.chat_rooms (name, description, emoji, meal_type, is_default, created_by)
select v.name, v.description, v.emoji, v.meal_type, true, null
from (values
  ('Breakfast Club', 'Morning ideas, quick breakfasts and weekend pancakes.', '🍳', 'breakfast'),
  ('Brunch Crew', 'Lazy weekend brunches worth getting up for.', '🥂', 'brunch'),
  ('Lunch Break', 'Lunches you can make fast or pack the night before.', '🥪', 'lunch'),
  ('Dinner Table', 'What''s for dinner? Swap ideas and family favorites.', '🍽️', 'dinner'),
  ('Sweet Tooth', 'Desserts, baking wins and baking disasters.', '🍰', 'dessert'),
  ('Can''t Decide', 'Stuck? Post your pantry and let the crew pick for you.', '🤔', null)
) as v(name, description, emoji, meal_type)
where not exists (select 1 from public.chat_rooms r where r.is_default and r.name = v.name);

-- Live messages (Supabase Realtime). Skipped where Realtime isn't installed.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Room list with member counts and whether the caller has joined.
create or replace function public.list_rooms()
returns table (id uuid, name text, description text, emoji text, meal_type text, is_default boolean,
               member_count int, joined boolean, last_message_at timestamptz)
language sql stable set search_path = public as $$
  select r.id, r.name, r.description, r.emoji, r.meal_type, r.is_default,
         (select count(*)::int from public.room_members m where m.room_id = r.id) as member_count,
         public.is_room_member(r.id) as joined,
         (select max(msg.created_at) from public.messages msg where msg.room_id = r.id) as last_msg
  from public.chat_rooms r
  order by r.is_default desc, last_msg desc nulls last, r.created_at
$$;

-- =====================================================================
-- 6. PANTRY FUNCTIONS WITH A MEAL-TYPE FILTER
-- (replaces the versions from 20260924000000_recipe_database.sql)
-- =====================================================================

drop function if exists public.cook_now(text[], int, text[], text[]);
drop function if exists public.pantry_matches(text[], int, real, int, text[], text[]);

create or replace function public.pantry_matches(
  p_pantry      text[]  default null,
  p_max_missing int     default 2,
  p_min_match   real    default 0.5,
  p_limit       int     default 20,
  p_allergens   text[]  default null,
  p_dietary     text[]  default null,
  p_meal_type   text    default null     -- 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'dessert'
)
returns table (
  recipe_id text, name text, emoji text, have_count int, required_count int, missing_count int,
  match_ratio real, missing_ingredients text[], kcal real, protein_g real, carbs_g real, fat_g real
)
language sql stable set search_path = public as $$
  with prefs as (
    select coalesce(p_allergens, public.my_allergens()) as a, coalesce(p_dietary, public.my_diet_tags()) as d
  ),
  covered as (
    select ingredient_id from public.pantry_coverage(p_pantry)
  ),
  have as (
    select ri.recipe_id, count(*)::int as have_count
    from public.recipe_ingredients ri
    join covered c on c.ingredient_id = ri.ingredient_id
    where ri.is_required
    group by ri.recipe_id
  ),
  ranked as (
    select r.id, r.name, r.emoji, h.have_count, r.required_count,
           r.required_count - h.have_count as missing_count,
           round(h.have_count::numeric / r.required_count, 2)::real as match_ratio,
           r.kcal, r.protein_g, r.carbs_g, r.fat_g, r.nutrition_coverage, r.favorite_count
    from have h
    join public.recipes r on r.id = h.recipe_id
    cross join prefs
    where r.required_count > 0
      and r.required_count - h.have_count <= p_max_missing
      and h.have_count::real / r.required_count >= p_min_match
      and (p_meal_type is null or p_meal_type = any (r.meal_types))
      and public.recipe_is_safe(r, prefs.a, prefs.d)
    order by missing_count, match_ratio desc, r.favorite_count desc, r.nutrition_coverage desc nulls last, r.id
    limit p_limit
  )
  select k.id, k.name, k.emoji, k.have_count, k.required_count, k.missing_count, k.match_ratio,
         array(
           select coalesce(i.name, ri.raw_text)
           from public.recipe_ingredients ri
           left join public.ingredients i on i.id = ri.ingredient_id
           where ri.recipe_id = k.id and ri.is_required
             and (ri.ingredient_id is null or ri.ingredient_id not in (select ingredient_id from covered))
           order by ri.position),
         k.kcal, k.protein_g, k.carbs_g, k.fat_g
  from ranked k
  order by k.missing_count, k.match_ratio desc, k.favorite_count desc
$$;

create or replace function public.cook_now(
  p_pantry text[] default null, p_limit int default 20, p_allergens text[] default null,
  p_dietary text[] default null, p_meal_type text default null
)
returns table (
  recipe_id text, name text, emoji text, have_count int, required_count int, missing_count int,
  match_ratio real, missing_ingredients text[], kcal real, protein_g real, carbs_g real, fat_g real
)
language sql stable set search_path = public as $$
  select * from public.pantry_matches(p_pantry, 0, 0, p_limit, p_allergens, p_dietary, p_meal_type)
$$;
