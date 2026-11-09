-- AI-generated recipes: allergen and diet labels from the ingredient catalog.
--
-- The generate-recipes Edge Function asks Claude for recipes. Claude also
-- says which diets a recipe fits and which allergens it has, but those are
-- claims, not checks. Before a generated recipe reaches the app, its
-- ingredient names are run through this function: the same catalog
-- matching and the same rules as shared home recipes
-- (analyze_community_recipe in 20260925000000) and the cleaning pipeline
-- (backend/database/cleaning/dietary.py ingredient_tags).
-- If you change a rule here, change it in those two places too.
--
-- Safety rules, same as everywhere else:
--  * an ingredient the catalog doesn't know means all_known = false, so the
--    allergens can't be verified and no "absence" tags are given
--    (vegan, nut-free, halal, ...);
--  * diet tags only come from the catalog, never from the AI's claims.

create or replace function public.analyze_ingredients(p_names text[])
returns table (
  ingredient_ids text[],   -- catalog id per name, null where unknown (same order as p_names)
  unmatched      text[],   -- the names the catalog didn't recognise
  all_known      boolean,
  allergens      text[],   -- contained
  may_contain    text[],   -- commonly hidden, not already in allergens
  dietary        text[]    -- absence-based tags the recipe earns
)
language plpgsql stable security definer set search_path = public as $$
declare
  ids      text[];
  unknown  text[];
  known    boolean;
  contains text[];
  may      text[];
  risky    text[];
  fl       text[];
  diet     text[] := '{}';
begin
  select coalesce(array_agg(m.id order by m.ord), '{}'),
         coalesce(array_agg(m.name order by m.ord) filter (where m.id is null), '{}')
  into ids, unknown
  from (
    select u.ord, u.name, public.match_ingredient(u.name) as id
    from unnest(coalesce(p_names, '{}')) with ordinality as u(name, ord)
    where nullif(trim(u.name), '') is not null
  ) m;
  known := cardinality(ids) > 0 and array_position(ids, null) is null;

  select coalesce(array_agg(distinct ia.allergen_id) filter (where ia.level = 'contains'), '{}'),
         coalesce(array_agg(distinct ia.allergen_id) filter (where ia.level = 'may_contain'), '{}')
  into contains, may
  from public.ingredient_allergens ia where ia.ingredient_id = any (ids);
  may := array(select unnest(may) except select unnest(contains));
  risky := contains || may;

  select coalesce(array_agg(distinct f.flag), '{}') into fl
  from public.ingredient_flags f where f.ingredient_id = any (ids);

  if known then
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

  return query select ids, unknown, known, contains, may, diet;
end
$$;

comment on function public.analyze_ingredients(text[]) is
  'Allergens, may-contain and absence-based diet tags for a list of ingredient names, from the catalog. Used to label AI-generated recipes.';

-- The Edge Function calls it with the service role; signed-in users may
-- call it too (it only reads the public ingredient catalog).
revoke all on function public.analyze_ingredients(text[]) from public;
grant execute on function public.analyze_ingredients(text[]) to authenticated, service_role;

-- One row per generation request, so the Edge Function can cap how many
-- times an account calls the AI per hour (each call costs money).
-- Only the Edge Function (service role) reads or writes it: RLS is on and
-- there are no policies for app users.
create table if not exists public.ai_generation_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  ok         boolean
);
create index if not exists ai_generation_requests_user_time
  on public.ai_generation_requests (user_id, created_at desc);
alter table public.ai_generation_requests enable row level security;
revoke all on public.ai_generation_requests from anon, authenticated;
