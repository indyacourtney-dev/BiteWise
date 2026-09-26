-- backend/supabase/migrations/20260927000000_fit_more_recipes.sql
--
-- Makes each imported recipe ~35% smaller so the database holds about
-- twice as many, and lets the push script watch the size limit.
--
--   1. bitewise_db_size_mb()  the push script checks this and stops before the
--      plan's limit (Free plan: 500 MB, over it the project goes read-only).
--   2. safe_substitutions()   works out swaps from recipe_ingredients, so the
--      recipe_substitutions table no longer needs a row per recipe and swap.
--      (Rows already there still count; nothing is lost.)
--   3. The trigram index on recipe names is dropped. Name search still works,
--      it just scans instead of using the index (fine at this size).

-- 1. Database size, for the push script (service role only).
create or replace function public.bitewise_db_size_mb()
returns numeric language sql stable security definer set search_path = public as $$
  select round(pg_database_size(current_database()) / 1024.0 / 1024.0, 1)
$$;
revoke execute on function public.bitewise_db_size_mb() from public, anon, authenticated;
grant execute on function public.bitewise_db_size_mb() to service_role;

-- 2. Swaps from the recipe's own ingredients (same results as before).
create or replace function public.safe_substitutions(
  p_recipe_id text, p_allergens text[] default null, p_dietary text[] default null
)
returns table (id text, from_ingredient_id text, replace_this text, to_ingredient_id text, with_this text,
               tip text, helps text[])
language sql stable set search_path = public as $$
  with prefs as (
    select coalesce(p_allergens, public.my_allergens()) as a, coalesce(p_dietary, public.my_diet_tags()) as d
  ),
  applicable as (
    select s.id
    from public.recipe_ingredients ri
    join public.substitutions s on s.from_ingredient_id = ri.ingredient_id
    where ri.recipe_id = p_recipe_id
    union
    select rs.substitution_id from public.recipe_substitutions rs where rs.recipe_id = p_recipe_id
  )
  select s.id, s.from_ingredient_id, fi.name, s.to_ingredient_id, ti.name, s.tip,
         array(select sh.tag_id from public.substitution_helps sh where sh.substitution_id = s.id order by sh.tag_id)
  from applicable ap
  join public.substitutions s on s.id = ap.id
  join public.ingredients fi on fi.id = s.from_ingredient_id
  left join public.ingredients ti on ti.id = s.to_ingredient_id
  cross join prefs
  where not exists (
      select 1 from public.ingredient_allergens ia
      where ia.ingredient_id = s.to_ingredient_id and ia.allergen_id = any (prefs.a))
  order by (select count(*) from public.substitution_helps sh
            where sh.substitution_id = s.id and sh.tag_id = any (prefs.d)) desc,
           s.id
$$;

-- 3. Name search keeps working without its (large) trigram index.
drop index if exists public.recipes_name_trgm;
