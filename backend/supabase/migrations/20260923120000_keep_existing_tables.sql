-- backend/supabase/migrations/20260923120000_keep_existing_tables.sql
--
-- Some projects already have tables with the names the next migrations
-- use (recipe_ingredients, favorites, messages, ...) but a different
-- layout, e.g. from an earlier prototype. This keeps each such table,
-- with all its rows, renamed to <name>_legacy (or _legacy_2, ...), so the
-- following migrations can create the tables the app expects.
--
-- A table is only renamed when it EXISTS and is MISSING a column the new
-- layout needs. Tables that already match are left alone, and nothing is
-- ever deleted.
--
-- `profiles` is handled differently: many Supabase projects already use
-- it for sign-up, so it is kept as-is and only gains the columns chat
-- needs (see 20260925000000_meals_favorites_community.sql).

do $$
declare
  -- table name -> a column only the BiteWise layout has
  expected constant text[][] := array[
    ['allergens',            'free_tag'],
    ['diet_tags',            'kind'],
    ['ingredients',          'is_staple'],
    ['ingredient_aliases',   'alias'],
    ['ingredient_allergens', 'level'],
    ['ingredient_flags',     'flag'],
    ['ingredient_ancestors', 'ancestor_id'],
    ['substitutions',        'from_ingredient_id'],
    ['substitution_helps',   'substitution_id'],
    ['recipe_ingredients',   'is_required'],
    ['recipe_substitutions', 'substitution_id'],
    ['user_pantry',          'expires_on'],
    ['user_allergens',       'allergen_id'],
    ['user_diet_tags',       'tag_id'],
    ['favorites',            'recipe_id'],
    ['chat_rooms',           'is_default'],
    ['room_members',         'room_id'],
    ['messages',             'room_id']
  ];
  i int;
  tbl text;
  col text;
  legacy text;
  n int;
  idx record;
begin
  for i in 1 .. array_length(expected, 1) loop
    tbl := expected[i][1];
    col := expected[i][2];
    continue when to_regclass('public.' || tbl) is null;
    continue when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = tbl and column_name = col);

    legacy := tbl || '_legacy';
    n := 1;
    while to_regclass('public.' || legacy) is not null loop
      n := n + 1;
      legacy := tbl || '_legacy_' || n;
    end loop;

    execute format('alter table public.%I rename to %I', tbl, legacy);
    -- Rename its indexes (including the primary key) so the new table can reuse the names.
    for idx in
      select c.relname as name
      from pg_index x join pg_class c on c.oid = x.indexrelid
      where x.indrelid = ('public.' || legacy)::regclass
    loop
      execute format('alter index public.%I rename to %I', idx.name, left(legacy || '_' || idx.name, 63));
    end loop;
    raise notice 'Existing % table kept as public.%', tbl, legacy;
  end loop;

  -- The favorites layout also needs text recipe ids (recipes.id is text).
  if to_regclass('public.favorites') is not null and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'favorites' and column_name = 'recipe_id'
         and data_type <> 'text') then
    legacy := 'favorites_legacy';
    n := 1;
    while to_regclass('public.' || legacy) is not null loop
      n := n + 1;
      legacy := 'favorites_legacy_' || n;
    end loop;
    execute format('alter table public.favorites rename to %I', legacy);
    for idx in
      select c.relname as name from pg_index x join pg_class c on c.oid = x.indexrelid
      where x.indrelid = ('public.' || legacy)::regclass
    loop
      execute format('alter index public.%I rename to %I', idx.name, left(legacy || '_' || idx.name, 63));
    end loop;
    raise notice 'Existing favorites table kept as public.%', legacy;
  end if;
end $$;
