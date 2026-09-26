"""
backend/database/tests/test_pipeline.py

End-to-end checks: cleaning -> import -> tags -> pantry queries.
Uses only the standard library.

    python3 -m unittest discover backend/database/tests -v
"""

import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import pantry                                                     # noqa: E402
from cleaning.catalog import validate_catalog                     # noqa: E402
from cleaning.normalize import ALIAS_COLLISIONS, parse_line       # noqa: E402
from cleaning.substitutions import validate_substitutions         # noqa: E402
from import_recipes import run_import                             # noqa: E402

SAMPLE_CSV = HERE / 'sample_recipes.csv'


class TestCatalog(unittest.TestCase):
    def test_catalog_is_valid(self):
        self.assertEqual(validate_catalog(), [])
        self.assertEqual(validate_substitutions(), [])
        self.assertEqual(ALIAS_COLLISIONS, [])


class TestNormalize(unittest.TestCase):
    def check(self, line, ingredient_id, **expected):
        p = parse_line(line)
        self.assertEqual(p.ingredient_id, ingredient_id, line)
        for key, value in expected.items():
            self.assertEqual(getattr(p, key), value, f'{line}: {key}')

    def test_tomato_variants_become_one_ingredient(self):
        self.check('1 (14.5 oz.) can diced tomatoes, drained', 'tomato', unit='can')
        self.check('2 fresh tomatoes, chopped', 'tomato', quantity=2.0)
        self.check('1 c. chopped tomato', 'tomato')
        self.check('1 can Rotel tomatoes', 'tomato')
        self.check('4 Roma tomatoes', 'tomato')

    def test_related_products_stay_distinct(self):
        self.check('1 (6 oz.) can tomato paste', 'tomato_paste')
        self.check('1 (8 oz.) can tomato sauce', 'tomato_sauce')
        self.check('1 c. cherry tomatoes', 'cherry_tomato')
        self.check('1 c. chicken broth', 'chicken_broth')
        self.check('1 c. peanut butter', 'peanut_butter')
        self.check('1/2 c. sour cream', 'sour_cream')

    def test_quantities_units_sizes(self):
        self.check('1 1/2 lb. lean ground beef', 'ground_beef', quantity=1.5, unit='lb')
        self.check('½ cup milk', 'milk', quantity=0.5, unit='cup')
        self.check('2 to 3 lb. chuck roast', 'beef_roast', quantity=2.5)
        p = parse_line('1 (8 oz.) pkg. cream cheese, softened')
        self.assertAlmostEqual(p.size_g, 226.8, places=1)
        self.assertIn('softened', p.preparation)

    def test_ambiguous_words(self):
        self.check('1/2 tsp. red pepper', 'cayenne')
        self.check('1 red pepper, diced', 'bell_pepper')
        self.check('2 green peppers', 'bell_pepper')
        self.check('1/4 tsp. pepper', 'black_pepper')
        self.check('1 tsp. soda', 'baking_soda')
        self.check('1 T. Worcestershire sauce', 'worcestershire', unit='tbsp')
        self.check('1 t. salt', 'salt', unit='tsp')
        self.check('juice of 2 limes', 'lime_juice', quantity=2.0)

    def test_optional(self):
        self.assertTrue(parse_line('1/2 c. chopped nuts (optional)').optional)
        self.assertTrue(parse_line('salt and pepper to taste').optional)


class TestImportAndQueries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.db = Path(cls.tmp.name) / 'test.db'
        cls.summary = run_import(SAMPLE_CSV, cls.db, workers=1, fresh=True, quiet=True)
        cls.conn = sqlite3.connect(cls.db)

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()
        cls.tmp.cleanup()

    def setUp(self):
        with self.conn:
            for t in ('user_pantry', 'user_allergens', 'user_diet_tags', 'users'):
                self.conn.execute(f'DELETE FROM {t}')

    # ---------- helpers ----------
    def rid(self, title):
        return self.conn.execute('SELECT id FROM recipes WHERE title = ?', (title,)).fetchone()[0]

    def tags(self, title):
        return {t for (t,) in self.conn.execute('SELECT tag_id FROM recipe_tags WHERE recipe_id = ?', (self.rid(title),))}

    def titles(self, rows):
        return {r['title'] for r in rows}

    def stock(self, *items):
        for it in items:
            self.assertIsNotNone(pantry.add_pantry_item(self.conn, 1, it), it)

    # ---------- import ----------
    def test_import_counts(self):
        self.assertEqual(self.summary['recipes'], 24)
        self.assertEqual(self.summary['skipped_invalid'], 1)
        self.assertEqual(self.summary['skipped_duplicate'], 1)
        self.assertEqual(self.summary['foreign_key_errors'], 0)

    def test_reimport_is_idempotent(self):
        again = run_import(SAMPLE_CSV, self.db, workers=1, quiet=True)
        self.assertEqual(again['recipes'], 0)
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM recipes').fetchone()[0], 24)

    # ---------- tags ----------
    def test_allergen_tags(self):
        self.assertNotIn('nut-free', self.tags('Zucchini Noodles with Pesto'))       # pine nuts in pesto
        self.assertNotIn('nut-free', self.tags('No-Bake Nut Cookies'))
        self.assertNotIn('peanut-free', self.tags('Peanut Butter Noodles'))
        self.assertIn('nut-free', self.tags('Peanut Butter Noodles'))                # peanuts aren't tree nuts
        self.assertNotIn('shellfish-free', self.tags('Shrimp Scampi'))
        self.assertNotIn('gluten-free', self.tags('Chicken Stir-Fry'))               # soy sauce has wheat
        self.assertNotIn('gluten-free', self.tags('Tofu Veggie Bowl'))               # tamari MAY contain gluten
        self.assertNotIn('egg-free', self.tags('Garlic Butter Pasta'))               # pasta may contain egg
        self.assertNotIn('fish-free', self.tags("Mom's Meat Loaf"))                  # Worcestershire = anchovies

    def test_unknown_ingredient_blocks_safety_tags(self):
        tags = self.tags("Grandma's Mystery Casserole")
        self.assertFalse({'nut-free', 'vegan', 'vegetarian', 'gluten-free'} & tags)

    def test_diet_tags(self):
        self.assertTrue({'vegan', 'vegetarian', 'gluten-free'} <= self.tags('Lentil Soup'))
        self.assertIn('vegetarian', self.tags('Veggie Omelet'))
        self.assertNotIn('vegan', self.tags('Veggie Omelet'))
        self.assertNotIn('vegan', self.tags('Peanut Butter Noodles'))                # honey
        self.assertIn('pescatarian', self.tags('Baked Salmon'))
        self.assertNotIn('no-red-meat', self.tags('Beef Tacos'))
        self.assertNotIn('alcohol-free', self.tags('Shrimp Scampi'))
        self.assertNotIn('halal', self.tags('Shrimp Scampi'))
        self.assertNotIn('kosher-style', self.tags('Beef Tacos'))                   # meat + cheese
        self.assertIn('halal', self.tags('Baked Salmon'))
        self.assertNotIn('halal', self.tags('Shrimp Scampi'))                       # shellfish excluded, as in the app

    def test_keto_matches_app_definition(self):
        # frontend/types: "very low carb: no grains, potatoes, beans, or sugars"
        self.assertIn('keto', self.tags('Baked Salmon'))
        self.assertNotIn('keto', self.tags('Oven Fries'))                          # potatoes
        self.assertNotIn('keto', self.tags('Black Bean Quinoa Salad'))              # beans + grain

    def test_health_tags(self):
        self.assertIn('diabetic-friendly', self.tags('Lentil Soup'))
        self.assertIn('heart-healthy', self.tags('Turkey Chili'))
        self.assertNotIn('heart-healthy', self.tags('Beef Tacos'))
        self.assertIn('keto', self.tags('Baked Salmon'))
        self.assertIn('healthy-fats', self.tags('Baked Salmon'))
        self.assertNotIn('healthy-fats', self.tags("Mom's Meat Loaf"))
        self.assertNotIn('low-cholesterol', self.tags('Veggie Omelet'))              # 3 eggs

    def test_macros_are_plausible(self):
        kcal, protein, servings = self.conn.execute(
            'SELECT kcal, protein_g, servings FROM recipes WHERE id = ?', (self.rid('Chicken Stir-Fry'),)).fetchone()
        self.assertEqual(servings, 4)
        self.assertTrue(250 < kcal < 500, kcal)
        self.assertTrue(20 < protein < 45, protein)

    # ---------- pantry queries ----------
    def test_cook_now(self):
        self.stock('chicken breasts', 'broccoli', 'red bell pepper', 'garlic', 'fresh ginger', 'soy sauce',
                   'cornstarch', 'canola oil', 'brown rice')
        rows = pantry.run(self.conn, 'cook_now', user_id=1, limit=10)
        self.assertIn('Chicken Stir-Fry', self.titles(rows))

    def test_general_pantry_item_does_not_cover_specific(self):
        # "chicken" in the pantry does NOT satisfy "chicken breasts"
        self.stock('chicken', 'broccoli', 'red bell pepper', 'garlic', 'ginger', 'soy sauce', 'cornstarch',
                   'vegetable oil', 'brown rice')
        rows = pantry.run(self.conn, 'cook_now', user_id=1, limit=10)
        self.assertNotIn('Chicken Stir-Fry', self.titles(rows))

    def test_pantry_matches_lists_missing(self):
        self.stock('ground beef', 'taco seasoning', 'cheddar', 'lettuce', 'tomatoes')
        rows = pantry.run(self.conn, 'pantry_matches', user_id=1, max_missing=3, min_match=0.5, limit=10)
        tacos = next(r for r in rows if r['title'] == 'Beef Tacos')
        self.assertEqual(tacos['missing_count'], 3)
        self.assertIn('Corn tortilla', tacos['missing_ingredients'])

    def test_allergy_filter(self):
        self.stock('spaghetti', 'peanut butter', 'soy sauce', 'honey', 'sesame oil', 'green onions', 'sesame seeds',
                   'zucchini', 'pesto', 'cherry tomatoes', 'parmesan')
        before = self.titles(pantry.run(self.conn, 'pantry_matches', user_id=1, max_missing=0, min_match=0, limit=50))
        self.assertTrue({'Peanut Butter Noodles', 'Zucchini Noodles with Pesto'} <= before)
        pantry.set_allergies(self.conn, 1, ['peanuts'])
        after = self.titles(pantry.run(self.conn, 'pantry_matches', user_id=1, max_missing=0, min_match=0, limit=50))
        self.assertNotIn('Peanut Butter Noodles', after)
        self.assertIn('Zucchini Noodles with Pesto', after)
        pantry.set_allergies(self.conn, 1, ['peanuts', 'nuts'])
        after = self.titles(pantry.run(self.conn, 'pantry_matches', user_id=1, max_missing=0, min_match=0, limit=50))
        self.assertNotIn('Zucchini Noodles with Pesto', after)

    def test_unknown_recipes_hidden_from_allergic_users(self):
        self.stock('ground beef', 'tater tots')
        pantry.set_allergies(self.conn, 1, ['sesame'])
        rows = pantry.run(self.conn, 'pantry_matches', user_id=1, max_missing=10, min_match=0, limit=50)
        self.assertNotIn("Grandma's Mystery Casserole", self.titles(rows))

    def test_diet_filter(self):
        self.stock('onion', 'garlic', 'olive oil', 'carrots', 'celery', 'lentils', 'diced tomatoes', 'broth')
        pantry.set_diet_tags(self.conn, 1, ['vegan', 'diabetic-friendly'])
        rows = pantry.run(self.conn, 'pantry_matches', user_id=1, max_missing=3, min_match=0.3, limit=50)
        self.assertIn('Lentil Soup', self.titles(rows))
        self.assertNotIn('Turkey Chili', self.titles(rows))

    def test_recipes_with_ingredients(self):
        rows = pantry.run(self.conn, 'recipes_with_ingredients', user_id=1,
                          ingredient_ids='["chicken", "broccoli"]', limit=10)
        self.assertEqual(self.titles(rows), {'Chicken Stir-Fry'})

    def test_use_it_up(self):
        pantry.add_pantry_item(self.conn, 1, 'fresh spinach', expires_on='2000-01-01')
        pantry.add_pantry_item(self.conn, 1, 'onion')
        rows = pantry.run(self.conn, 'use_it_up', user_id=1, days=3, max_missing=20, limit=10)
        self.assertTrue({'Lentil Soup', 'Chickpea Curry'} <= self.titles(rows))

    def test_shopping_list(self):
        self.stock('ground beef', 'cheddar')
        rows = pantry.run(self.conn, 'shopping_list', user_id=1, recipe_id=self.rid('Beef Tacos'))
        items = {r['item'] for r in rows}
        self.assertIn('Corn tortilla', items)
        self.assertNotIn('Ground beef', items)
        self.assertNotIn('Water', items)          # staples are never on the list

    def test_substitutions_respect_allergies(self):
        smoothie = self.rid('Banana Oat Smoothie')
        pantry.ensure_user(self.conn, 1)
        rows = pantry.run(self.conn, 'safe_substitutions', user_id=1, recipe_id=smoothie)
        pantry.set_allergies(self.conn, 1, ['coconut'])
        rows = pantry.run(self.conn, 'safe_substitutions', user_id=1, recipe_id=self.rid('Chicken Stir-Fry'))
        swap_ids = {r['id'] for r in rows}
        self.assertIn('soy_sauce_to_low_sodium', swap_ids)
        self.assertNotIn('soy_sauce_to_coconut_aminos', swap_ids)       # coconut allergy

    def test_recipe_detail(self):
        row = pantry.run(self.conn, 'recipe_detail', recipe_id=self.rid('Shrimp Scampi'))[0]
        self.assertIn('Shellfish', row['contains_allergens'])
        self.assertIn('pescatarian', row['tags'])


if __name__ == '__main__':
    unittest.main()


class TestTagCurated(unittest.TestCase):
    """backend/database/tag_curated_recipes.py on small hand-written recipes."""

    def recipe(self, rid, ingredients, dietary=(), allergens=(), servings=4, kcal=400):
        return {'id': rid, 'name': rid, 'servings': servings, 'instructions': ['Cook.'],
                'dietary': list(dietary), 'allergens': list(allergens),
                'nutrition': {'calories': kcal},
                'ingredients': [{'name': n, 'amount': a} for a, n in ingredients]}

    def test_flags_problems_in_hand_written_data(self):
        from tag_curated_recipes import analyse
        r = self.recipe('r1', [('1 cup', 'tofu'), ('2 tbsp', 'soy sauce'), ('1 tbsp', 'honey')],
                        dietary=['vegan'], allergens=['soy'])
        notes = ' | '.join(analyse(r)['warnings'])
        self.assertIn("missing 'gluten'", notes)       # soy sauce contains wheat
        self.assertIn("tagged 'vegan' but: Honey", notes)

    def test_allergen_free_needs_both_sources_to_agree(self):
        from tag_curated_recipes import analyse
        r = self.recipe('r2', [('1 lb', 'chicken breast'), ('2 cups', 'broccoli'), ('1 tbsp', 'olive oil')],
                        allergens=['nuts'])             # hand list says nuts, cleaner found none
        auto = analyse(r)['auto']
        self.assertNotIn('nut-free', auto)
        self.assertIn('peanut-free', auto)

    def test_or_alternatives_count_for_allergens(self):
        from tag_curated_recipes import analyse
        r = self.recipe('r3', [('1 lb', 'chickpeas'), ('2 tbsp', 'curry powder or paste')])
        self.assertNotIn('shellfish-free', analyse(r)['auto'])   # curry paste may hide shrimp

    def test_write_keeps_human_tags_and_is_idempotent(self):
        from tag_curated_recipes import write_tags
        with tempfile.TemporaryDirectory() as d:
            ts = Path(d) / 'recipes.ts'
            ts.write_text("[\n  {\n    id: 'r1',\n    dietary: ['vegan'],\n  },\n  {\n    id: 'r2',\n"
                          "    dietary: [],\n  },\n]\n")
            self.assertEqual(write_tags(ts, {'r1': ['vegan', 'nut-free'], 'r2': ['low-sodium']}), 2)
            self.assertEqual(write_tags(ts, {'r1': ['vegan', 'nut-free'], 'r2': ['low-sodium']}), 0)
            text = ts.read_text()
            self.assertIn("dietary: ['vegan', 'nut-free']", text)
            self.assertIn("dietary: ['low-sodium']", text)


class TestMealTypes(unittest.TestCase):
    def check(self, title, expected, ids=(), flags=(), sugar=0.0):
        from cleaning.meal_types import classify_meal_types
        self.assertEqual(classify_meal_types(title, set(ids), set(flags), sugar), expected, title)

    def test_breakfast_and_brunch(self):
        self.check('Blueberry Pancakes', ['breakfast', 'brunch'], sugar=0.2)
        self.check('Veggie Omelet', ['breakfast', 'brunch'], ids={'egg'})
        self.check('Spinach Quiche', ['brunch', 'lunch'], ids={'egg'})
        self.check('Cinnamon Rolls', ['breakfast', 'brunch', 'dessert'], sugar=0.3)

    def test_lunch_and_dinner(self):
        self.check('Chicken Salad Sandwich', ['lunch'], flags={'poultry'})
        self.check('Lentil Soup', ['lunch', 'dinner'], ids={'lentils'})
        self.check('Chicken Pot Pie', ['dinner'], flags={'poultry'})
        self.check('Crab Cakes', ['brunch', 'dinner'], flags={'seafood'})
        self.check("Grandma's Mystery Casserole", ['dinner'], flags={'mammal'})

    def test_desserts(self):
        self.check('Apple Pie', ['dessert'], sugar=0.4)
        self.check('Cherry Delight', ['dessert'], sugar=0.4)
        self.check('Watergate Salad', ['dessert'], sugar=0.4)      # sweet "salad", no protein

    def test_not_meals(self):
        self.check('Barbecue Sauce', [], sugar=0.3)
        self.check('Party Punch', [], sugar=0.5)
        self.check('Spinach Dip', [])
        self.check('Roasted Vegetables', [])                        # a side, not suggested alone
        self.check('Chicken with Mushroom Sauce', ['dinner'], flags={'poultry'})

    def test_curated_meal_types_written(self):
        from tag_curated_recipes import write_meal_types
        with tempfile.TemporaryDirectory() as d:
            ts = Path(d) / 'recipes.ts'
            ts.write_text("[\n  {\n    id: 'r1',\n    dietary: ['vegan'],\n    allergens: [],\n  },\n]\n")
            self.assertEqual(write_meal_types(ts, {'r1': ['lunch', 'dinner']}), 1)
            self.assertIn("    dietary: ['vegan'],\n    mealTypes: ['lunch', 'dinner'],\n", ts.read_text())
            self.assertEqual(write_meal_types(ts, {'r1': ['lunch', 'dinner']}), 0)
            self.assertEqual(write_meal_types(ts, {'r1': ['dinner']}), 1)
            self.assertIn("mealTypes: ['dinner'],", ts.read_text())
