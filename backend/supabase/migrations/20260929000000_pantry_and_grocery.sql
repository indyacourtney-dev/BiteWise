-- backend/supabase/migrations/20260929000000_pantry_and_grocery.sql
--
-- The pantry and grocery list, saved to the user's account.
--
-- Until now the pantry lived only on the phone (AsyncStorage). The app still
-- keeps a local copy and works offline; frontend/lib/kitchenSync.ts syncs it
-- with these tables (pull on sign-in / app open, push about a second after
-- each change, newest change wins).
--
--   pantry_items   what's in the kitchen, incl. "running low" settings
--   grocery_items  the shopping list
--
-- Ids are made on the phone (so items can be created offline), so the
-- primary key is (user_id, id). Times are milliseconds since 1970 as sent by
-- the phone (bigint), which keeps "newest change wins" exact.
--
-- Each user can only see and change their own rows. Deleting an account
-- (delete-account function) removes both lists through the foreign key.

-- ---------------------------------------------------------------
-- pantry_items
-- ---------------------------------------------------------------
create table if not exists public.pantry_items (
  user_id      uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  id           text    not null check (char_length(id) between 1 and 64),
  name         text    not null check (char_length(name) between 1 and 80),
  quantity     numeric not null default 1 check (quantity >= 0),
  unit         text    not null default 'Items' check (char_length(unit) <= 20),
  category     text    not null default 'other'
                       check (category in ('proteins', 'produce', 'dairy', 'grains', 'pantry', 'other')),
  icon         text    check (char_length(icon) <= 16),
  low_at       numeric check (low_at >= 0),          -- null = automatic (a quarter of stocked_qty)
  stocked_qty  numeric check (stocked_qty >= 0),     -- how much there was at the last restock
  stocked_at   bigint,                               -- when it was bought (freshness counts from here)
  added_at     bigint  not null,
  updated_at   bigint  not null,
  primary key (user_id, id)
);

comment on table public.pantry_items is
  'Each user''s pantry. Synced from the app (frontend/lib/kitchenSync.ts); times are ms since epoch.';

-- ---------------------------------------------------------------
-- grocery_items
-- ---------------------------------------------------------------
create table if not exists public.grocery_items (
  user_id     uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  id          text    not null check (char_length(id) between 1 and 64),
  name        text    not null check (char_length(name) between 1 and 80),
  icon        text    check (char_length(icon) <= 16),
  quantity    numeric not null default 1 check (quantity > 0),
  unit        text    not null default 'Items' check (char_length(unit) <= 20),
  category    text    not null default 'other'
                      check (category in ('proteins', 'produce', 'dairy', 'grains', 'pantry', 'other')),
  aisle       text    not null default 'Other' check (char_length(aisle) <= 40),
  checked     boolean not null default false,
  source      text    not null default 'manual' check (source in ('manual', 'low-stock', 'recipe')),
  note        text    check (char_length(note) <= 120),   -- e.g. the recipe it's for
  added_at    bigint  not null,
  updated_at  bigint  not null,
  primary key (user_id, id)
);

comment on table public.grocery_items is
  'Each user''s grocery list. Synced from the app (frontend/lib/kitchenSync.ts); times are ms since epoch.';

-- ---------------------------------------------------------------
-- Access: owner only
-- ---------------------------------------------------------------
alter table public.pantry_items  enable row level security;
alter table public.grocery_items enable row level security;

grant select, insert, update, delete on public.pantry_items  to authenticated;
grant select, insert, update, delete on public.grocery_items to authenticated;
revoke all on public.pantry_items  from anon;
revoke all on public.grocery_items from anon;

do $$
declare
  t text;
begin
  foreach t in array array['pantry_items', 'grocery_items'] loop
    execute format('drop policy if exists "own rows: read" on public.%I', t);
    execute format('create policy "own rows: read" on public.%I for select to authenticated
                      using (user_id = (select auth.uid()))', t);

    execute format('drop policy if exists "own rows: add" on public.%I', t);
    execute format('create policy "own rows: add" on public.%I for insert to authenticated
                      with check (user_id = (select auth.uid()))', t);

    execute format('drop policy if exists "own rows: change" on public.%I', t);
    execute format('create policy "own rows: change" on public.%I for update to authenticated
                      using (user_id = (select auth.uid()))
                      with check (user_id = (select auth.uid()))', t);

    execute format('drop policy if exists "own rows: remove" on public.%I', t);
    execute format('create policy "own rows: remove" on public.%I for delete to authenticated
                      using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- Convenience for server-side features (e.g. pantry recipe matching
-- without sending the pantry from the phone): names of what the
-- signed-in user has in stock.
-- ---------------------------------------------------------------
create or replace function public.my_pantry_names()
returns text[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(array_agg(name order by name), '{}')
  from public.pantry_items
  where user_id = (select auth.uid()) and quantity > 0
$$;

grant execute on function public.my_pantry_names() to authenticated;
