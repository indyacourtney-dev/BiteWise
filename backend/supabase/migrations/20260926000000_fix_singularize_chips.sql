-- backend/supabase/migrations/20260926000000_fix_singularize_chips.sql
--
-- "chips" was wrongly on the never-singularize list, so "butterscotch chips"
-- and "tortilla chips" didn't match catalog aliases ("... chip"). Same fix
-- as backend/database/cleaning/normalize.py. The function signature is
-- unchanged, so everything that uses it picks this up immediately.

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
               'grass', 'lettuce', 'cheese', 'mayonnaise', 'watercress', 'octopus', 'schnapps', 'lemongrass',
               'brussels', 'cress', 'hass', 'haas') then w
    when w like '%ies' then left(w, -3) || 'y'
    when w ~ '(ches|shes|xes|sses|zes)$' then left(w, -2)
    when w like '%oes' then left(w, -2)
    when w like '%s' and w !~ '(ss|us|is)$' then left(w, -1)
    else w
  end
$$;
