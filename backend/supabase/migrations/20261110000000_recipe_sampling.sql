-- backend/supabase/migrations/20261110000000_recipe_sampling.sql
--
-- FAST RANDOM POOLS.
--
-- The app builds its suggestion pools by sampling a few hundred recipes
-- for a meal. It used to do that with ORDER BY id OFFSET <random>, which
-- makes Postgres read and sort every matching row first: ~25 s for the
-- 54,000 desserts, well past the 8 s statement timeout on the API role,
-- so desserts (and sometimes dinner) came back empty.
--
-- Now every recipe carries a random key, and a covering index lets the
-- planner answer "the first 300 recipes with rnd >= r that match these
-- filters" straight from the index, in milliseconds. The app then loads
-- those ids. New rows get a key from the column default.

set statement_timeout = 0;

alter table public.recipes
  add column if not exists rnd double precision not null default random();

-- Covering index: the sampling query reads only this (index-only scan).
create index if not exists recipes_sample_idx
  on public.recipes (rnd)
  include (id, kind, meal_types, dietary, allergens, may_contain, allergens_verified, tags, cook_minutes, source);

analyze public.recipes;

reset statement_timeout;
