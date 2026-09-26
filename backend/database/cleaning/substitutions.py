"""
backend/database/cleaning/substitutions.py

Small, practical swaps shown under a recipe ("Try Greek yogurt instead of
sour cream — same tang, a third of the fat and 4x the protein").

Each swap names the ingredient it replaces, what to use instead, a short
tip, and which dietary goals it helps. When `to_id` is a real catalog
ingredient, the pantry queries check that swap against the user's
allergies, so a nut-allergic user is never told to use almond milk.

The import script links every recipe to the swaps that apply to it
(recipe_substitutions). The app filters them per user at query time.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Substitution:
    id: str
    from_id: str
    to_id: Optional[str]      # None = technique tip, not an ingredient swap
    tip: str
    helps: tuple              # tag ids from dietary.py that this swap moves the recipe toward


SUBSTITUTIONS: tuple = (
    # ---------- Saturated fat & cholesterol ----------
    Substitution('sour_cream_to_greek_yogurt', 'sour_cream', 'greek_yogurt',
                 'Use plain Greek yogurt instead of sour cream: same tang, far less saturated fat, much more protein.',
                 ('heart-healthy', 'low-cholesterol', 'high-protein', 'low-fat')),
    Substitution('mayo_to_greek_yogurt', 'mayonnaise', 'greek_yogurt',
                 'Swap half or all of the mayo for Greek yogurt to cut fat and calories sharply.',
                 ('heart-healthy', 'low-fat', 'low-calorie')),
    Substitution('heavy_cream_to_evaporated_milk', 'heavy_cream', 'evaporated_milk',
                 'Evaporated milk gives creaminess with roughly a third of the fat of heavy cream.',
                 ('heart-healthy', 'low-cholesterol', 'low-fat')),
    Substitution('butter_to_olive_oil', 'butter', 'olive_oil',
                 'For sautéing and roasting, use olive oil instead of butter (use about 3/4 the amount).',
                 ('heart-healthy', 'low-cholesterol', 'healthy-fats', 'dairy-free')),
    Substitution('margarine_to_olive_oil', 'margarine', 'olive_oil',
                 'Olive oil instead of margarine avoids processed fats (use about 3/4 the amount).',
                 ('heart-healthy', 'healthy-fats')),
    Substitution('shortening_to_olive_oil', 'shortening', 'olive_oil',
                 'For savory cooking, olive oil replaces shortening with far less saturated fat.',
                 ('heart-healthy', 'healthy-fats')),
    Substitution('lard_to_olive_oil', 'lard', 'olive_oil',
                 'Replace lard or bacon grease with olive oil to cut saturated fat and make it pork-free.',
                 ('heart-healthy', 'low-cholesterol', 'no-pork', 'halal')),
    Substitution('coconut_oil_to_olive_oil', 'coconut_oil', 'olive_oil',
                 'Coconut oil is over 80% saturated fat; olive oil works in most savory recipes.',
                 ('heart-healthy', 'low-cholesterol', 'coconut-free')),
    Substitution('egg_to_egg_white', 'egg', 'egg_white',
                 'Use 2 egg whites per whole egg to remove nearly all the cholesterol.',
                 ('low-cholesterol', 'heart-healthy', 'low-fat')),
    Substitution('cheddar_reduce', 'cheddar', None,
                 'Use half the cheese and pick a sharp one — the flavor carries with less saturated fat and sodium.',
                 ('heart-healthy', 'low-sodium', 'low-fat')),
    Substitution('process_cheese_to_cheddar', 'process_cheese', 'cheddar',
                 'Real sharp cheddar in a smaller amount has far less sodium than processed cheese.',
                 ('heart-healthy', 'low-sodium')),
    Substitution('cheese_to_nutritional_yeast', 'cheddar', 'nutritional_yeast',
                 'Nutritional yeast gives a cheesy flavor with no dairy.',
                 ('dairy-free', 'vegan')),
    Substitution('milk_to_skim', 'milk', 'skim_milk',
                 'Skim milk instead of whole milk removes almost all the saturated fat.',
                 ('heart-healthy', 'low-cholesterol', 'low-fat')),
    Substitution('milk_to_oat_milk', 'milk', 'oat_milk',
                 'Unsweetened oat milk works in most savory sauces and baking and is dairy- and nut-free.',
                 ('dairy-free', 'vegan')),
    Substitution('milk_to_almond_milk', 'milk', 'almond_milk',
                 'Unsweetened almond milk is very low in calories and carbs.',
                 ('dairy-free', 'vegan', 'low-carb', 'low-calorie')),

    # ---------- Red & processed meat ----------
    Substitution('ground_beef_to_ground_turkey', 'ground_beef', 'ground_turkey',
                 'Lean ground turkey (93/7) cuts saturated fat by more than half in tacos, chili and sauces.',
                 ('heart-healthy', 'low-cholesterol', 'no-red-meat', 'gout-friendly')),
    Substitution('ground_beef_to_lentils', 'ground_beef', 'lentils',
                 'Replace half the beef with cooked lentils for fiber and a lower-fat, cheaper meal.',
                 ('high-fiber', 'heart-healthy', 'no-red-meat')),
    Substitution('ground_pork_to_ground_chicken', 'ground_pork', 'ground_chicken',
                 'Ground chicken in place of ground pork is leaner and pork-free.',
                 ('heart-healthy', 'no-pork', 'no-red-meat', 'halal')),
    Substitution('bacon_to_turkey_bacon', 'bacon', 'turkey_bacon',
                 'Turkey bacon has about a third less saturated fat and is pork-free (still a processed meat).',
                 ('heart-healthy', 'no-pork', 'no-red-meat', 'halal')),
    Substitution('sausage_to_chicken_sausage', 'pork_sausage', 'chicken_sausage',
                 'Chicken sausage has less saturated fat than pork sausage and is pork-free.',
                 ('heart-healthy', 'no-pork', 'no-red-meat', 'halal')),
    Substitution('steak_to_chicken_breast', 'beef_steak', 'chicken_breast',
                 'Chicken breast in place of steak is leaner and lower in saturated fat.',
                 ('heart-healthy', 'low-cholesterol', 'no-red-meat', 'gout-friendly')),

    # ---------- Refined carbs & blood sugar ----------
    Substitution('white_rice_to_brown_rice', 'rice', 'brown_rice',
                 'Brown rice has about 3x the fiber of white rice and raises blood sugar more slowly.',
                 ('diabetic-friendly', 'hypoglycemia-friendly', 'high-fiber')),
    Substitution('rice_to_cauliflower_rice', 'rice', 'cauliflower',
                 'Riced cauliflower in place of rice cuts the carbs by around 85%.',
                 ('diabetic-friendly', 'low-carb', 'keto', 'low-calorie')),
    Substitution('pasta_to_whole_wheat', 'pasta', 'whole_wheat_pasta',
                 'Whole wheat pasta has about 3x the fiber, which slows the blood-sugar rise.',
                 ('diabetic-friendly', 'hypoglycemia-friendly', 'high-fiber')),
    Substitution('pasta_to_chickpea_pasta', 'pasta', 'chickpea_pasta',
                 'Chickpea or lentil pasta adds protein and fiber and is gluten-free.',
                 ('diabetic-friendly', 'high-protein', 'high-fiber', 'gluten-free', 'wheat-free')),
    Substitution('pasta_to_zucchini', 'pasta', 'zucchini',
                 'Spiralized zucchini noodles (or half-and-half with pasta) cut carbs and calories.',
                 ('low-carb', 'keto', 'low-calorie', 'gluten-free')),
    Substitution('flour_to_whole_wheat', 'flour', 'whole_wheat_flour',
                 'Replace up to half the white flour with whole wheat flour for more fiber.',
                 ('high-fiber', 'diabetic-friendly')),
    Substitution('bread_to_whole_wheat', 'bread', 'whole_wheat_bread',
                 'Whole wheat bread has about twice the fiber of white bread.',
                 ('high-fiber', 'diabetic-friendly', 'hypoglycemia-friendly')),
    Substitution('flour_tortilla_to_corn', 'flour_tortilla', 'corn_tortilla',
                 'Corn tortillas are smaller, whole-grain, and gluten-free.',
                 ('gluten-free', 'wheat-free', 'low-calorie', 'high-fiber')),
    Substitution('bread_crumbs_to_oats', 'bread_crumbs', 'oats',
                 'Pulse rolled oats as a binder or coating instead of bread crumbs for more fiber.',
                 ('high-fiber', 'diabetic-friendly')),
    Substitution('potato_to_sweet_potato', 'potato', 'sweet_potato',
                 'Sweet potato adds fiber and vitamin A, and is nightshade-free.',
                 ('high-fiber', 'nightshade-free')),
    Substitution('ramen_to_rice_noodles', 'ramen_noodles', 'rice_noodles',
                 'Rice noodles with your own seasoning instead of instant ramen cut sodium and saturated fat drastically.',
                 ('heart-healthy', 'low-sodium', 'gluten-free')),
    Substitution('sugar_reduce', 'sugar', None,
                 'Most recipes taste the same with a third less sugar; add cinnamon or vanilla to keep the flavor.',
                 ('diabetic-friendly', 'hypoglycemia-friendly', 'low-sugar')),
    Substitution('brown_sugar_reduce', 'brown_sugar', None,
                 'Cut the brown sugar by a third; a pinch of salt and some vanilla keep it tasting sweet.',
                 ('diabetic-friendly', 'hypoglycemia-friendly', 'low-sugar')),
    Substitution('corn_syrup_reduce', 'corn_syrup', 'maple_syrup',
                 'Use less, and swap corn syrup for pure maple syrup where texture allows.',
                 ('low-sugar', 'corn-free')),
    Substitution('honey_to_maple', 'honey', 'maple_syrup',
                 'Maple syrup replaces honey 1:1 and makes the recipe vegan.',
                 ('vegan', 'low-fodmap')),

    # ---------- Sodium ----------
    Substitution('soy_sauce_to_low_sodium', 'soy_sauce', 'low_sodium_soy_sauce',
                 'Low-sodium soy sauce has about 40% less sodium with the same flavor.',
                 ('low-sodium', 'heart-healthy')),
    Substitution('soy_sauce_to_coconut_aminos', 'soy_sauce', 'coconut_aminos',
                 'Coconut aminos taste similar, have about 70% less sodium, and are soy- and gluten-free.',
                 ('low-sodium', 'soy-free', 'gluten-free', 'wheat-free', 'paleo')),
    Substitution('cream_soup_to_homemade', 'cream_soup', None,
                 'Make a quick sauce from milk, a spoon of flour, and sautéed mushrooms instead of canned cream soup — around 70% less sodium.',
                 ('low-sodium', 'heart-healthy')),
    Substitution('bouillon_to_low_sodium_broth', 'bouillon', 'vegetable_broth',
                 'Use low-sodium broth instead of bouillon cubes; one cube can hold nearly half a day of sodium.',
                 ('low-sodium', 'heart-healthy')),
    Substitution('taco_seasoning_to_spices', 'taco_seasoning', 'cumin',
                 'Mix your own seasoning (cumin, chili powder, garlic powder, oregano) and salt to taste.',
                 ('low-sodium', 'heart-healthy')),
    Substitution('onion_soup_mix_to_onion', 'onion_soup_mix', 'onion',
                 'Use a sautéed onion plus garlic powder and pepper instead of the soup mix to cut sodium.',
                 ('low-sodium', 'heart-healthy')),
    Substitution('salt_to_citrus_herbs', 'salt', 'lemon_juice',
                 'Use half the salt and finish with lemon juice and fresh herbs — acidity makes food taste saltier.',
                 ('low-sodium', 'heart-healthy')),

    # ---------- Allergies ----------
    Substitution('peanut_butter_to_sunflower', 'peanut_butter', 'sunflower_butter',
                 'Sunflower seed butter replaces peanut butter 1:1 and is peanut- and tree-nut-free.',
                 ('peanut-free', 'nut-free')),
    Substitution('pesto_nut_free', 'pesto', None,
                 'Make pesto with sunflower or pumpkin seeds instead of pine nuts for a nut-free version.',
                 ('nut-free',)),
    Substitution('nuts_to_seeds', 'nuts', 'seeds',
                 'Toasted sunflower or pumpkin seeds give the same crunch without tree nuts.',
                 ('nut-free',)),
    Substitution('wine_to_broth', 'wine', 'vegetable_broth',
                 'Use broth plus a splash of vinegar instead of wine to make it alcohol-free.',
                 ('alcohol-free', 'halal', 'sulphite-free')),
    Substitution('beer_to_broth', 'beer', 'vegetable_broth',
                 'Broth replaces beer in stews and batters; it also removes gluten and purines.',
                 ('alcohol-free', 'halal', 'gluten-free', 'gout-friendly')),

    # ---------- Frying ----------
    Substitution('frying_oil_to_oven', 'vegetable_oil', 'olive_oil',
                 'If the recipe deep-fries, try oven-baking at 425°F with a light coat of olive oil instead.',
                 ('heart-healthy', 'low-fat', 'gerd-friendly')),
)

SUBSTITUTIONS_BY_FROM: dict = {}
for _s in SUBSTITUTIONS:
    SUBSTITUTIONS_BY_FROM.setdefault(_s.from_id, []).append(_s)


def validate_substitutions() -> list:
    from .catalog import CATALOG_BY_ID
    from .dietary import TAG_BY_ID
    problems = []
    for s in SUBSTITUTIONS:
        if s.from_id not in CATALOG_BY_ID:
            problems.append(f'{s.id}: unknown from_id {s.from_id}')
        if s.to_id and s.to_id not in CATALOG_BY_ID:
            problems.append(f'{s.id}: unknown to_id {s.to_id}')
        for tag in s.helps:
            if tag not in TAG_BY_ID:
                problems.append(f'{s.id}: unknown tag {tag}')
    return problems
