-- backend/supabase/migrations/20261112000000_drinks_cleanup.sql
--
-- A few imported recipes slipped into Drinks on a word in their name
-- ("Cocktail Sandwiches", "Manhattan Clam Chowder", "Old Fashioned Slaw",
-- "Ginger-Cocoa Crisps", "Hot Dog Cooler"…). Teach the classifier those
-- words, and move the rows back to food. Also: anything whose ingredients
-- include flour, dough or a hot dog is food, whatever the name says.

set statement_timeout = 0;

create or replace function public.recipe_is_drink(p_name text, p_instructions text[])
returns boolean
language sql
immutable
as $$
  with t as (
    select lower(coalesce(p_name, '')) as name,
           lower(array_to_string(coalesce(p_instructions, '{}'), ' ')) as steps
  )
  select
    name ~ '\m(margaritas?|mojitos?|martinis?|daiquiris?|sangria|mimosas?|spritzers?|spritz|negroni|bloody mary|mules?|juleps?|coladas?|cosmopolitans?|cosmos?|old fashioned|manhattans?|highballs?|fizz|fizzes|shandy|toddy|eggnog|egg nog|bellinis?|palomas?|caipirinhas?|mai tais?|whiskey sour|whisky sour|amaretto sour|pisco sour|gin sour|vodka sour|hurricanes?|cocktails?|smoothies?|lemonade|limeade|iced tea|sweet tea|lattes?|frappes?|milkshakes?|hot chocolate|hot cocoa|punch|slush|slushie|slushy|coolers?|agua fresca|mocktails?|floats?|horchata|lassi|mulled wine|mulled cider|hot cider|wassail|kombucha|sodas?|nog|cordial|shrub|tonic|chai|cappuccino|espresso|mocha|juice|nectar|cocoa|tea)\M'
    and name !~ '\m(cakes?|pies?|bars?|cookies?|bread|muffins?|pudding|salads?|dips?|sauce|wieners?|sausages?|shrimp|meatballs?|glaze|marinade|chicken|pork|beef|fish|dressing|jello|jell-o|cheesecake|frosting|icing|cupcakes?|brownies?|trifle|fudge|candy|candies|popsicles?|ice cream|sorbet|sherbet|granita|jam|jelly|syrup|crumble|cobbler|fruit cocktail|cocktail wieners|cocktail sauce|cocktail meatballs|cocktail franks|cocktail smokies|roast|ham|turkey|casserole|rolls?|biscuits?|pancakes?|waffles?|scones?|loaf|tart|torte|mousse|custard|truffles?|balls|squares|dessert|parfait|granola|oatmeal|soup|chili|stew|rice|noodles|pasta|wings|ribs|tenderloin|tea cakes?|tea sandwiches|tea ring|punch bowl|concentrate|mix|wedges?|mounds?|canned|canning|cups|cubes|pops|freeze|frozen dessert|sandwich(es)?|cuplets?|thumbprints?|crisps?|chowder|gingerbread|slaw|drops|hot dogs?|clam|lemon coolers|coolers \(cookies?\))\M'
    and steps !~ '\m(bake|baked|baking|oven|preheat|fry|fried|frying|roast|grill|broil|knead|dough|saute|skillet|casserole|degrees|cookie sheet|flour)\M'
    and steps ~ '\m(shake|stir|pour|blend|blender|over ice|ice cubes?|glass|glasses|pitcher|strain|muddle|garnish|rim|chill|chilled|crushed ice|cold|refrigerate|float|serve hot|mugs?|percolator)\M'
  from t
$$;

-- Back to food: name says food, or the ingredients do.
update public.recipes r
set kind = 'food'
where r.kind = 'drink' and r.source in ('kaggle', 'community')
  and (
    not public.recipe_is_drink(r.name, r.instructions)
    or exists (
      select 1 from jsonb_array_elements(r.ingredients) i
      where lower(i->>'name') ~ '\m(flour|dough|hot dogs?|clams?|cabbage|shortening|baking (powder|soda))\M'
    )
  );

reset statement_timeout;
