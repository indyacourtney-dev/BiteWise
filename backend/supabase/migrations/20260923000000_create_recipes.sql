-- backend/supabase/migrations/20260923000000_create_recipes.sql
--
-- The recipes table the matching engine scores against. Holds both the
-- hand-curated BiteWise recipes (frontend/constants/recipes.ts) and rows imported
-- from the Kaggle "Recipe Dataset (over 2M)".
--
-- Column names are snake_case here; frontend/lib/recipesApi.ts maps them back to
-- the camelCase Recipe type so the rest of the app doesn't change.

create extension if not exists pg_trgm;

-- If the project already has a `recipes` table with a different layout
-- (made before this migration), keep it — renamed to recipes_legacy, with
-- all its rows — and create the table the app expects. Its indexes and
-- constraints are renamed too so their names don't clash with the new ones.
do $$
declare
  legacy text := 'recipes_legacy';
  n int := 1;
  idx record;
begin
  if to_regclass('public.recipes') is not null and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'recipes' and column_name = 'tags') then
    while to_regclass('public.' || legacy) is not null loop
      n := n + 1;
      legacy := 'recipes_legacy_' || n;
    end loop;
    execute format('alter table public.recipes rename to %I', legacy);
    for idx in
      select c.relname as name
      from pg_index i join pg_class c on c.oid = i.indexrelid
      where i.indrelid = ('public.' || legacy)::regclass
    loop
      execute format('alter index public.%I rename to %I', idx.name, legacy || '_' || idx.name);
    end loop;
    raise notice 'Existing recipes table kept as public.%', legacy;
  end if;
end $$;

create table if not exists public.recipes (
  id                  text primary key,              -- 'r1'... curated, 'k123'... Kaggle
  name                text        not null,
  emoji               text        not null default '🍽️',
  tags                text[]      not null default '{}',
  vibe                text        not null default 'savory'
                        check (vibe in ('savory', 'spicy', 'sweet')),

  -- Only curated recipes have these. Kaggle rows leave them null rather
  -- than inventing numbers.
  plate               jsonb,
  nutrition           jsonb,

  prep_minutes        int         not null default 0,
  cook_minutes        int         not null default 0,
  servings            int,
  difficulty          text        not null default 'easy'
                        check (difficulty in ('easy', 'medium', 'hard')),

  dietary             text[]      not null default '{}',
  allergens           text[]      not null default '{}',
  -- false = allergens were guessed from ingredient text by the importer.
  -- Never treat an unverified row as safe for a user with an allergy.
  allergens_verified  boolean     not null default false,

  ingredients         jsonb       not null default '[]',   -- Ingredient[]
  instructions        text[]      not null default '{}',

  source              text        not null default 'bitewise'
                        check (source in ('bitewise', 'kaggle')),
  source_url          text,                               -- attribution for imported rows
  created_at          timestamptz not null default now()
);

-- Array filters used by the matcher: tags && ..., dietary @> ..., allergens && ...
create index if not exists recipes_tags_gin      on public.recipes using gin (tags);
create index if not exists recipes_dietary_gin   on public.recipes using gin (dietary);
create index if not exists recipes_allergens_gin on public.recipes using gin (allergens);
-- Fuzzy name search ("chick" -> "Chicken Parmesan")
create index if not exists recipes_name_trgm     on public.recipes using gin (name gin_trgm_ops);
create index if not exists recipes_source_idx    on public.recipes (source);

-- Anyone using the app can read recipes; only the service role
-- (import/seed scripts) can write. The service role bypasses RLS.
alter table public.recipes enable row level security;

drop policy if exists "recipes are readable by everyone" on public.recipes;
create policy "recipes are readable by everyone"
  on public.recipes for select
  to anon, authenticated
  using (true);
