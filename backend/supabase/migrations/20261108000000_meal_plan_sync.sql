-- backend/supabase/migrations/20261108000000_meal_plan_sync.sql
--
-- THE WEEK PLAN FOLLOWS THE ACCOUNT.
--
-- Pantry, grocery, favorites, birthday and (since 20261107) preferences all
-- live on the account; the week plan was the last big piece still stored
-- only on the device. Plan dinners on the web, open the phone, and they
-- weren't there. These two tables fix that, synced the same way as the
-- pantry (frontend/lib/planSync.ts: pull on sign-in / foreground, push a
-- second after the last change, newest updated_at wins per row).
--
--   meal_plan_items     one row per planned meal (ids made on the device)
--   meal_plan_statuses  "leftovers / takeout / no-cook" marks on a day or
--                       slot; a day or slot set back to "cook" deletes the row
--
-- Times are ms since 1970 as sent by the device (bigint), dates 'YYYY-MM-DD'
-- text to match the app exactly. Each user sees only their own rows.

create table if not exists public.meal_plan_items (
  user_id             uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  id                  text    not null check (char_length(id) between 1 and 64),
  date                text    not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  slot                text    not null check (slot in ('breakfast', 'lunch', 'dinner')),
  recipe_id           text    not null check (char_length(recipe_id) between 1 and 64),
  name                text    not null check (char_length(name) <= 160),
  emoji               text    check (char_length(emoji) <= 16),
  minutes             integer check (minutes >= 0),
  servings            numeric check (servings > 0),
  meal_servings       numeric check (meal_servings > 0),
  is_leftovers        boolean not null default false,
  leftover_source_key text    check (char_length(leftover_source_key) <= 120),
  servings_estimated  boolean,
  cooked              boolean not null default false,
  added_at            bigint  not null,
  updated_at          bigint  not null,
  primary key (user_id, id)
);

comment on table public.meal_plan_items is
  'Each user''s planned meals. Synced from the app (frontend/lib/planSync.ts); times are ms since epoch.';

create table if not exists public.meal_plan_statuses (
  user_id    uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  key        text   not null check (char_length(key) between 1 and 64),   -- 'day:2026-11-07' | 'slot:2026-11-07|dinner'
  status     text   not null check (status in ('cook', 'leftovers', 'takeout', 'no-cook')),
  updated_at bigint not null,
  primary key (user_id, key)
);

comment on table public.meal_plan_statuses is
  'Day / slot marks for the week plan (leftovers, takeout, no-cook). Synced from the app.';

-- ---------------------------------------------------------------
-- Access: owner only
-- ---------------------------------------------------------------
alter table public.meal_plan_items    enable row level security;
alter table public.meal_plan_statuses enable row level security;

grant select, insert, update, delete on public.meal_plan_items    to authenticated;
grant select, insert, update, delete on public.meal_plan_statuses to authenticated;
revoke all on public.meal_plan_items    from anon;
revoke all on public.meal_plan_statuses from anon;

do $$
declare
  t text;
begin
  foreach t in array array['meal_plan_items', 'meal_plan_statuses'] loop
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

create index if not exists meal_plan_items_user_date_idx on public.meal_plan_items (user_id, date);
