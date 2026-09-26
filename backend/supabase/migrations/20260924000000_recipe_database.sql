-- backend/supabase/migrations/20260924000000_recipe_database.sql
--
-- Adds the cleaned recipe data produced by backend/database (Python
-- pipeline) to Supabase:
--
--   1. Reference data   ingredients, aliases, allergens, dietary tags,
--                       healthier swaps (pushed by backend/scripts/pushCleanedRecipes.ts)
--   2. Recipes          new columns on `recipes` for may-contain allergens,
--                       macros, and data quality; plus recipe_ingredients
--                       (every line mapped to a canonical ingredient)
--   3. Users            pantry, allergies, diet/health tags, one row set per
--                       signed-in user (row-level security)
--   4. Functions        pantry matching and ingredient lookup, called from
--                       the app with supabase.rpc(...) — see frontend/lib/pantryApi.ts
--
-- Vocabulary is shared with frontend/types/index.ts: allergens are 'dairy',
-- 'eggs', 'nuts', 'peanuts', 'gluten', ...; dietary tags are 'vegan',
-- 'gluten-free', 'halal', 'diabetic-friendly', ...

-- =====================================================================
-- 1. REFERENCE DATA
-- =====================================================================

create table if not exists public.allergens (
  id        text primary key,            -- 'nuts'
  label     text not null,               -- 'Tree nuts'
  free_tag  text not null unique,        -- 'nut-free'
  avoid     text not null                -- foods to avoid, for the app's allergy screen
);

create table if not exists public.diet_tags (
  id          text primary key,          -- 'diabetic-friendly'
  label       text not null,
  kind        text not null check (kind in ('allergen_free', 'diet', 'religious', 'health')),
  description text not null
);

create table if not exists public.ingredients (
  id              text primary key,      -- 'tomato'
  name            text not null,         -- 'Tomato'
  category        text not null,
  parent_id       text references public.ingredients (id),
  is_staple       boolean not null default false,   -- salt, pepper, water: never "missing"
  -- nutrition per 100 g (USDA averages)
  kcal real, protein_g real, carbs_g real, fat_g real, sat_fat_g real,
  fiber_g real, sugar_g real, sodium_mg real, cholesterol_mg real,
  density_g_ml    real,
  each_g          real
);

-- Every spelling in the dataset -> one canonical ingredient.
-- Stored normalised (lower-case, singular): 'diced tomato' -> 'tomato'.
create table if not exists public.ingredient_aliases (
  alias         text primary key,
  ingredient_id text not null references public.ingredients (id) on delete cascade
);
create index if not exists ingredient_aliases_ingredient_idx on public.ingredient_aliases (ingredient_id);
create index if not exists ingredient_aliases_trgm on public.ingredient_aliases using gin (alias gin_trgm_ops);

create table if not exists public.ingredient_allergens (
  ingredient_id text not null references public.ingredients (id) on delete cascade,
  allergen_id   text not null references public.allergens (id) on delete cascade,
  level         text not null check (level in ('contains', 'may_contain')),
  primary key (ingredient_id, allergen_id)
);

create table if not exists public.ingredient_flags (
  ingredient_id text not null references public.ingredients (id) on delete cascade,
  flag          text not null,           -- 'mammal', 'added_sugar', 'high_fodmap', ...
  primary key (ingredient_id, flag)
);

-- (ingredient, ancestor) pairs including itself at depth 0.
-- A pantry item covers a recipe ingredient when the recipe asks for the
-- item or something more general: chicken_breast covers "chicken".
create table if not exists public.ingredient_ancestors (
  ingredient_id text not null references public.ingredients (id) on delete cascade,
  ancestor_id   text not null references public.ingredients (id) on delete cascade,
  depth         int  not null,
  primary key (ingredient_id, ancestor_id)
);
create index if not exists ingredient_ancestors_ancestor_idx on public.ingredient_ancestors (ancestor_id);

create table if not exists public.substitutions (
  id                 text primary key,
  from_ingredient_id text not null references public.ingredients (id) on delete cascade,
  to_ingredient_id   text references public.ingredients (id) on delete cascade,   -- null = technique tip
  tip                text not null
);
create index if not exists substitutions_from_idx on public.substitutions (from_ingredient_id);

create table if not exists public.substitution_helps (
  substitution_id text not null references public.substitutions (id) on delete cascade,
  tag_id          text not null references public.diet_tags (id) on delete cascade,
  primary key (substitution_id, tag_id)
);

-- =====================================================================
-- 2. RECIPES
-- =====================================================================

alter table public.recipes
  add column if not exists may_contain           text[]  not null default '{}',
  add column if not exists all_ingredients_known boolean not null default false,
  add column if not exists nutrition_coverage    real,
  add column if not exists servings_estimated    boolean not null default false,
  add column if not exists required_count        int     not null default 0;

comment on column public.recipes.allergens is
  'Allergens the recipe CONTAINS (same ids as the allergens table).';
comment on column public.recipes.may_contain is
  'Allergens hidden in common ingredients (e.g. bread may contain eggs). Treat as unsafe for allergic users.';
comment on column public.recipes.allergens_verified is
  'true = allergens checked by a person (curated) or every ingredient line matched the ingredient catalog (imported). '
  'Never show a recipe with allergens_verified = false to a user with allergies.';
comment on column public.recipes.dietary is
  'Diet, allergen-free and health tags (diet_tags table): vegan, nut-free, diabetic-friendly, ...';
comment on column public.recipes.required_count is
  'Ingredient lines that count for pantry matching (not optional, not a staple like salt or water).';

-- Macros are stored once, in the `nutrition` jsonb the app already reads
-- ({calories, protein, carbs, totalFat, healthyFat, netCarbs, satFat,
-- fiber, sugar, addedSugar, sodium, cholesterol}). These generated columns
-- expose them for filtering and sorting ("under 600 kcal", "30 g+ protein").
alter table public.recipes
  add column if not exists kcal           real generated always as ((nutrition ->> 'calories')::real) stored,
  add column if not exists protein_g      real generated always as ((nutrition ->> 'protein')::real) stored,
  add column if not exists carbs_g        real generated always as ((nutrition ->> 'carbs')::real) stored,
  add column if not exists net_carbs_g    real generated always as ((nutrition ->> 'netCarbs')::real) stored,
  add column if not exists fat_g          real generated always as ((nutrition ->> 'totalFat')::real) stored,
  add column if not exists sat_fat_g      real generated always as ((nutrition ->> 'satFat')::real) stored,
  add column if not exists fiber_g        real generated always as ((nutrition ->> 'fiber')::real) stored,
  add column if not exists sugar_g        real generated always as ((nutrition ->> 'sugar')::real) stored,
  add column if not exists sodium_mg      real generated always as ((nutrition ->> 'sodium')::real) stored,
  add column if not exists cholesterol_mg real generated always as ((nutrition ->> 'cholesterol')::real) stored;

create index if not exists recipes_may_contain_gin on public.recipes using gin (may_contain);
create index if not exists recipes_kcal_idx on public.recipes (kcal);
create index if not exists recipes_protein_idx on public.recipes (protein_g);

create table if not exists public.recipe_ingredients (
  recipe_id     text    not null references public.recipes (id) on delete cascade,
  position      int     not null,
  ingredient_id text    references public.ingredients (id),   -- null = not recognised
  raw_text      text    not null,                             -- original line
  quantity      real,
  unit          text,
  grams         real,
  form          text,                                         -- 'canned', 'fresh', ...
  preparation   text,                                         -- 'diced, drained'
  is_optional   boolean not null default false,
  is_required   boolean not null,
  primary key (recipe_id, position)
);
-- Pantry matching reads required lines by ingredient.
create index if not exists recipe_ingredients_required_idx
  on public.recipe_ingredients (ingredient_id, recipe_id) where is_required;

create table if not exists public.recipe_substitutions (
  recipe_id       text not null references public.recipes (id) on delete cascade,
  substitution_id text not null references public.substitutions (id) on delete cascade,
  primary key (recipe_id, substitution_id)
);
create index if not exists recipe_substitutions_sub_idx on public.recipe_substitutions (substitution_id);

-- =====================================================================
-- 3. USERS: pantry, allergies, diets (one set of rows per signed-in user)
-- =====================================================================

create table if not exists public.user_pantry (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ingredient_id text not null references public.ingredients (id),
  quantity_note text,                     -- what the user typed, e.g. '2 cans diced tomatoes'
  expires_on    date,
  added_at      timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);
create index if not exists user_pantry_expiry_idx on public.user_pantry (user_id, expires_on);

create table if not exists public.user_allergens (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  allergen_id text not null references public.allergens (id),
  primary key (user_id, allergen_id)
);

-- Diets and health conditions the user wants EVERY recipe to satisfy.
create table if not exists public.user_diet_tags (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tag_id  text not null references public.diet_tags (id),
  primary key (user_id, tag_id)
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Reference and recipe data: readable by everyone, written only by the
-- service role (scripts). User data: each user sees and edits only
-- their own rows.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['allergens', 'diet_tags', 'ingredients', 'ingredient_aliases', 'ingredient_allergens',
                           'ingredient_flags', 'ingredient_ancestors', 'substitutions', 'substitution_helps',
                           'recipe_ingredients', 'recipe_substitutions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "readable by everyone" on public.%I', t);
    execute format('create policy "readable by everyone" on public.%I for select to anon, authenticated using (true)', t);
  end loop;

  foreach t in array array['user_pantry', 'user_allergens', 'user_diet_tags']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "users manage their own rows" on public.%I', t);
    execute format('create policy "users manage their own rows" on public.%I for all to authenticated '
                   'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- =====================================================================
-- 4a. INGREDIENT MATCHING (same rules as backend/database/cleaning/normalize.py)
-- Used for pantry text ("2 cans diced tomatoes" -> tomato) and for
-- indexing curated recipes.
-- =====================================================================

create or replace function public.singularize(w text)
returns text language sql immutable parallel safe as $$
  select case
    when w in ('leaves') then 'leaf'
    when w in ('loaves') then 'loaf'
    when w in ('halves') then 'half'
    when w in ('chilies', 'chillies') then 'chili'
    when w in ('chiles') then 'chile'
    when length(w) <= 3 then w
    when w in ('asparagus', 'hummus', 'couscous', 'molasses', 'swiss', 'citrus', 'grits', 'oats', 'bass', 'glass',
               'grass', 'lettuce', 'cheese', 'mayonnaise', 'chips', 'watercress', 'octopus', 'schnapps', 'lemongrass',
               'brussels', 'cress', 'hass', 'haas') then w
    when w like '%ies' then left(w, -3) || 'y'
    when w ~ '(ches|shes|xes|sses|zes)$' then left(w, -2)
    when w like '%oes' then left(w, -2)
    when w like '%s' and w !~ '(ss|us|is)$' then left(w, -1)
    else w
  end
$$;

create or replace function public.ingredient_tokens(p text)
returns text[] language sql immutable parallel safe as $$
  select coalesce(array_agg(public.singularize(m[1]) order by ord), '{}')
  from regexp_matches(
         replace(replace(replace(
           -- strip accents: 'jalapeño' -> 'jalapeno' (same as strip_accents() in normalize.py)
           translate(lower(coalesce(p, '')), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'),
           '&', ' and '), '-', ' '), '''s', ''),
         '([a-z0-9]+)', 'g') with ordinality as t(m, ord)
$$;

-- Longest (then right-most) run of words that is a known alias.
create or replace function public.match_ingredient(p_text text)
returns text language plpgsql stable set search_path = public as $$
declare
  attempt text;
  toks    text[];
  len     int;
  n       int;
  s       int;
  hit     text;
begin
  -- Try the part before a comma / "or" first ("butter or margarine", "garlic, minced").
  foreach attempt in array array[
    regexp_replace(split_part(coalesce(p_text, ''), ',', 1), '\s+or\s+.*$', '', 'i'),
    coalesce(p_text, '')]
  loop
    toks := public.ingredient_tokens(attempt);
    len  := coalesce(array_length(toks, 1), 0);
    for n in reverse least(6, len) .. 1 loop
      for s in reverse (len - n + 1) .. 1 loop
        select a.ingredient_id into hit
        from public.ingredient_aliases a
        where a.alias = array_to_string(toks[s : s + n - 1], ' ');
        if hit is not null then
          return hit;
        end if;
      end loop;
    end loop;
  end loop;
  return null;
end
$$;

-- Autocomplete for the pantry screen: "tom" -> Tomato, Tomato paste, ...
create or replace function public.search_ingredients(q text, lim int default 10)
returns table (id text, name text, category text, matched_alias text)
language sql stable set search_path = public as $$
  select x.id, x.name, x.category, x.alias
  from (
    select distinct on (i.id) i.id, i.name, i.category, a.alias,
           (a.alias = lower(trim(q)))::int * 2 + (a.alias like lower(trim(q)) || '%')::int
             + similarity(a.alias, lower(trim(q))) as score
    from public.ingredient_aliases a
    join public.ingredients i on i.id = a.ingredient_id
    where a.alias like '%' || lower(trim(q)) || '%' or a.alias % lower(trim(q))
    order by i.id, score desc
  ) x
  order by x.score desc, x.name
  limit lim
$$;

-- =====================================================================
-- 4b. PANTRY & PREFERENCES
-- =====================================================================

-- Add free text to the signed-in user's pantry. Returns the ingredient id,
-- or null if the text couldn't be matched (show search_ingredients instead).
create or replace function public.add_pantry_item(p_text text, p_expires_on date default null)
returns text language plpgsql volatile set search_path = public as $$
declare v_id text;
begin
  v_id := coalesce((select id from public.ingredients where id = p_text), public.match_ingredient(p_text));
  if v_id is null then
    return null;
  end if;
  insert into public.user_pantry (user_id, ingredient_id, quantity_note, expires_on)
  values (auth.uid(), v_id, p_text, p_expires_on)
  on conflict (user_id, ingredient_id) do update
    set quantity_note = excluded.quantity_note,
        expires_on    = coalesce(excluded.expires_on, user_pantry.expires_on);
  return v_id;
end
$$;

create or replace function public.my_allergens()
returns text[] language sql stable set search_path = public as $$
  select coalesce(array_agg(allergen_id), '{}') from public.user_allergens where user_id = auth.uid()
$$;

create or replace function public.my_diet_tags()
returns text[] language sql stable set search_path = public as $$
  select coalesce(array_agg(tag_id), '{}') from public.user_diet_tags where user_id = auth.uid()
$$;

-- The one safety rule every recipe list uses.
--  * allergies: the allergens must have been verified, and the recipe must
--    neither contain nor possibly contain any of them
--  * diets / health: the recipe must carry every requested tag
create or replace function public.recipe_is_safe(r public.recipes, p_allergens text[], p_dietary text[])
returns boolean language sql stable as $$
  select (coalesce(cardinality(p_allergens), 0) = 0
          or (r.allergens_verified
              and not (r.allergens && p_allergens)
              and not (r.may_contain && p_allergens)))
     and r.dietary @> coalesce(p_dietary, '{}')
$$;

-- =====================================================================
-- 4c. PANTRY QUERIES (call with supabase.rpc)
--
-- p_pantry     the pantry as a list of item names or ingredient ids, e.g.
--              the app's AsyncStorage pantry: ['Chicken Breast', 'rice', 'eggs'].
--              Names are matched to the catalog here. Leave null to use the
--              signed-in user's user_pantry table instead.
-- p_allergens  allergen ids to avoid; null = the user's saved user_allergens
-- p_dietary    diet tags every recipe must carry; null = saved user_diet_tags
-- =====================================================================

-- Every catalog ingredient the pantry covers: each item plus the more
-- general ingredients it can stand in for (chicken_breast -> chicken).
create or replace function public.pantry_coverage(p_pantry text[] default null)
returns table (ingredient_id text)
language sql stable set search_path = public as $$
  with items as (
    select coalesce((select i.id from public.ingredients i where i.id = t.txt),
                    public.match_ingredient(t.txt)) as id
    from unnest(p_pantry) as t(txt)
    where p_pantry is not null
    union
    select p.ingredient_id from public.user_pantry p
    where p_pantry is null and p.user_id = auth.uid()
  )
  select distinct an.ancestor_id
  from items
  join public.ingredient_ancestors an on an.ingredient_id = items.id
$$;

-- Map several pantry names at once, e.g. to show which items were recognised.
create or replace function public.match_ingredients(p_texts text[])
returns table (input text, ingredient_id text, name text, category text)
language sql stable set search_path = public as $$
  select t.txt, i.id, i.name, i.category
  from unnest(p_texts) with ordinality as t(txt, ord)
  left join lateral (select public.match_ingredient(t.txt) as id) m on true
  left join public.ingredients i on i.id = m.id
  order by t.ord
$$;

-- Best recipes for what's in the pantry, fewest missing ingredients first.
create or replace function public.pantry_matches(
  p_pantry      text[]  default null,
  p_max_missing int     default 2,
  p_min_match   real    default 0.5,
  p_limit       int     default 20,
  p_allergens   text[]  default null,
  p_dietary     text[]  default null
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
           r.kcal, r.protein_g, r.carbs_g, r.fat_g, r.nutrition_coverage
    from have h
    join public.recipes r on r.id = h.recipe_id
    cross join prefs
    where r.required_count > 0
      and r.required_count - h.have_count <= p_max_missing
      and h.have_count::real / r.required_count >= p_min_match
      and public.recipe_is_safe(r, prefs.a, prefs.d)
    order by missing_count, match_ratio desc, r.nutrition_coverage desc nulls last, r.id
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
  order by k.missing_count, k.match_ratio desc
$$;

-- Recipes the user can make right now.
create or replace function public.cook_now(
  p_pantry text[] default null, p_limit int default 20, p_allergens text[] default null, p_dietary text[] default null
)
returns table (
  recipe_id text, name text, emoji text, have_count int, required_count int, missing_count int,
  match_ratio real, missing_ingredients text[], kcal real, protein_g real, carbs_g real, fat_g real
)
language sql stable set search_path = public as $$
  select * from public.pantry_matches(p_pantry, 0, 0, p_limit, p_allergens, p_dietary)
$$;

-- Recipes that use up pantry items expiring within p_days days.
create or replace function public.use_it_up(
  p_pantry text[] default null, p_expiring text[] default null,
  p_days int default 3, p_max_missing int default 3, p_limit int default 20,
  p_allergens text[] default null, p_dietary text[] default null
)
returns table (recipe_id text, name text, emoji text, expiring_used int, missing_count int, kcal real, protein_g real)
language sql stable set search_path = public as $$
  with prefs as (
    select coalesce(p_allergens, public.my_allergens()) as a, coalesce(p_dietary, public.my_diet_tags()) as d
  ),
  covered as (
    select ingredient_id from public.pantry_coverage(p_pantry)
  ),
  expiring as (
    select ingredient_id from public.pantry_coverage(p_expiring)
    where p_expiring is not null
    union
    select distinct an.ancestor_id
    from public.user_pantry p
    join public.ingredient_ancestors an on an.ingredient_id = p.ingredient_id
    where p_expiring is null and p.user_id = auth.uid()
      and p.expires_on is not null and p.expires_on <= current_date + p_days
  ),
  uses as (
    select ri.recipe_id, count(distinct ri.ingredient_id)::int as expiring_used
    from public.recipe_ingredients ri
    join expiring e on e.ingredient_id = ri.ingredient_id
    where ri.is_required
    group by ri.recipe_id
  ),
  scored as (
    select u.recipe_id, u.expiring_used,
           (select count(*)::int from public.recipe_ingredients ri
            where ri.recipe_id = u.recipe_id and ri.is_required
              and (ri.ingredient_id is null or ri.ingredient_id not in (select ingredient_id from covered))
           ) as missing_count
    from uses u
  )
  select r.id, r.name, r.emoji, s.expiring_used, s.missing_count, r.kcal, r.protein_g
  from scored s
  join public.recipes r on r.id = s.recipe_id
  cross join prefs
  where s.missing_count <= p_max_missing
    and public.recipe_is_safe(r, prefs.a, prefs.d)
  order by s.expiring_used desc, s.missing_count, r.id
  limit p_limit
$$;

-- Recipes that use ALL of the given ingredients ("chicken and broccoli").
-- A general id also finds specific ones: 'chicken' finds chicken thighs.
create or replace function public.recipes_with_ingredients(
  p_ingredient_ids text[], p_limit int default 20, p_allergens text[] default null, p_dietary text[] default null
)
returns table (recipe_id text, name text, emoji text, required_count int, kcal real, protein_g real)
language sql stable set search_path = public as $$
  with prefs as (
    select coalesce(p_allergens, public.my_allergens()) as a, coalesce(p_dietary, public.my_diet_tags()) as d
  ),
  hits as (
    select ri.recipe_id
    from public.recipe_ingredients ri
    join public.ingredient_ancestors an on an.ingredient_id = ri.ingredient_id
    where an.ancestor_id = any (p_ingredient_ids)
    group by ri.recipe_id
    having count(distinct an.ancestor_id) = cardinality(p_ingredient_ids)
  )
  select r.id, r.name, r.emoji, r.required_count, r.kcal, r.protein_g
  from hits h
  join public.recipes r on r.id = h.recipe_id
  cross join prefs
  where public.recipe_is_safe(r, prefs.a, prefs.d)
  order by r.required_count, r.nutrition_coverage desc nulls last, r.id
  limit p_limit
$$;

-- What the user still needs to buy for one recipe.
create or replace function public.shopping_list(p_recipe_id text, p_pantry text[] default null)
returns table (line_position int, ingredient_id text, item text, raw_text text, quantity real, unit text, category text)
language sql stable set search_path = public as $$
  with covered as (
    select ingredient_id from public.pantry_coverage(p_pantry)
  )
  select ri.position, ri.ingredient_id, coalesce(i.name, ri.raw_text), ri.raw_text, ri.quantity, ri.unit, i.category
  from public.recipe_ingredients ri
  left join public.ingredients i on i.id = ri.ingredient_id
  where ri.recipe_id = p_recipe_id
    and ri.is_required
    and (ri.ingredient_id is null or ri.ingredient_id not in (select ingredient_id from covered))
  order by i.category nulls last, ri.position
$$;

-- Healthier swaps for one recipe, minus any whose replacement contains or
-- may contain one of the user's allergens. Swaps that help the user's own
-- diet tags come first.
create or replace function public.safe_substitutions(
  p_recipe_id text, p_allergens text[] default null, p_dietary text[] default null
)
returns table (id text, from_ingredient_id text, replace_this text, to_ingredient_id text, with_this text,
               tip text, helps text[])
language sql stable set search_path = public as $$
  with prefs as (
    select coalesce(p_allergens, public.my_allergens()) as a, coalesce(p_dietary, public.my_diet_tags()) as d
  )
  select s.id, s.from_ingredient_id, fi.name, s.to_ingredient_id, ti.name, s.tip,
         array(select sh.tag_id from public.substitution_helps sh where sh.substitution_id = s.id order by sh.tag_id)
  from public.recipe_substitutions rs
  join public.substitutions s on s.id = rs.substitution_id
  join public.ingredients fi on fi.id = s.from_ingredient_id
  left join public.ingredients ti on ti.id = s.to_ingredient_id
  cross join prefs
  where rs.recipe_id = p_recipe_id
    and not exists (
      select 1 from public.ingredient_allergens ia
      where ia.ingredient_id = s.to_ingredient_id and ia.allergen_id = any (prefs.a))
  order by (select count(*) from public.substitution_helps sh
            where sh.substitution_id = s.id and sh.tag_id = any (prefs.d)) desc,
           s.id
$$;

-- =====================================================================
-- 4d. CURATED RECIPES -> recipe_ingredients
-- Curated recipes (frontend/constants/recipes.ts) are matched to the catalog here
-- so they take part in pantry matching too. Runs automatically when a
-- curated recipe's ingredients change, and in bulk from the push script.
-- =====================================================================

create or replace function public.index_curated_recipe(p_recipe_id text)
returns void language plpgsql volatile set search_path = public as $$
begin
  delete from public.recipe_ingredients where recipe_id = p_recipe_id;
  delete from public.recipe_substitutions where recipe_id = p_recipe_id;

  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, raw_text, is_optional, is_required)
  select r.id,
         (e.ord - 1)::int,
         m.ingredient_id,
         trim(coalesce(e.item ->> 'amount', '') || ' ' || coalesce(e.item ->> 'name', '')),
         coalesce((e.item ->> 'optional')::boolean, false),
         not coalesce((e.item ->> 'optional')::boolean, false) and not coalesce(i.is_staple, false)
  from public.recipes r
  cross join lateral jsonb_array_elements(r.ingredients) with ordinality as e(item, ord)
  cross join lateral (select public.match_ingredient(e.item ->> 'name') as ingredient_id) m
  left join public.ingredients i on i.id = m.ingredient_id
  where r.id = p_recipe_id;

  insert into public.recipe_substitutions (recipe_id, substitution_id)
  select distinct p_recipe_id, s.id
  from public.recipe_ingredients ri
  join public.substitutions s on s.from_ingredient_id = ri.ingredient_id
  where ri.recipe_id = p_recipe_id;

  update public.recipes r
  set required_count = (select count(*) from public.recipe_ingredients ri
                        where ri.recipe_id = r.id and ri.is_required),
      all_ingredients_known = not exists (select 1 from public.recipe_ingredients ri
                                          where ri.recipe_id = r.id and ri.ingredient_id is null)
  where r.id = p_recipe_id;
end
$$;

create or replace function public.index_curated_recipes()
returns int language plpgsql volatile set search_path = public as $$
declare v_id text; n int := 0;
begin
  for v_id in select id from public.recipes where source = 'bitewise' loop
    perform public.index_curated_recipe(v_id);
    n := n + 1;
  end loop;
  return n;
end
$$;

create or replace function public.recipes_index_curated_trigger()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.source = 'bitewise' then
    perform public.index_curated_recipe(new.id);
  end if;
  return null;
end
$$;

drop trigger if exists recipes_index_curated on public.recipes;
create trigger recipes_index_curated
  after insert or update of ingredients on public.recipes
  for each row execute function public.recipes_index_curated_trigger();

-- Indexing writes shared data, so only the service role (scripts) may run it.
revoke execute on function public.index_curated_recipe(text) from public, anon, authenticated;
revoke execute on function public.index_curated_recipes() from public, anon, authenticated;
-- Pantry functions need a signed-in user.
revoke execute on function public.add_pantry_item(text, date) from public, anon;
grant  execute on function public.add_pantry_item(text, date) to authenticated;
grant  execute on function public.index_curated_recipe(text) to service_role;
grant  execute on function public.index_curated_recipes() to service_role;
