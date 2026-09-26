"""
backend/database/cleaning/allergens.py

Every allergen / food sensitivity BiteWise tracks, and what it means.

HOW ALLERGENS WORK IN BITEWISE
------------------------------
Each canonical ingredient in catalog.py lists the allergens it
CONTAINS and the ones it MAY CONTAIN (common hidden sources, e.g.
Worcestershire sauce contains anchovies, bread may contain egg or milk).

A recipe earns an "<allergen>-free" tag ONLY when:
  1. every ingredient line in the recipe was recognised by the cleaner, and
  2. no ingredient contains or may contain that allergen.

If even one line couldn't be recognised, the recipe gets NO allergen-free
tags at all. For a user with an allergy, an unknown ingredient is treated
as unsafe. That is intentional: a missed nut is far worse than a missed
recommendation.

Allergen ids match the vocabulary in frontend/types/index.ts ('eggs', 'nuts',
'peanuts', 'dairy', 'gluten', ...) so curated and imported recipes agree.

Coverage: the FDA's 9 major allergens (US), the EU's 14 regulated
allergens, plus corn, coconut, nightshades, and alpha-gal syndrome.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Allergen:
    id: str
    label: str
    free_tag: str          # tag a recipe earns when it's safe for this allergen
    avoid: str             # plain-language list of foods to avoid (shown in the app)
    raw_keywords: tuple    # fallback words scanned in ingredient lines the cleaner couldn't match


ALLERGENS: tuple = (
    Allergen(
        'dairy', 'Milk / Dairy', 'dairy-free',
        'Milk, butter, cream, cheese, yogurt, sour cream, buttermilk, ghee, whey, casein, '
        'evaporated or condensed milk, most margarines, milk chocolate, cream soups, ranch.',
        ('milk', 'butter', 'cream', 'cheese', 'yogurt', 'whey', 'casein', 'ghee', 'margarine', 'oleo'),
    ),
    Allergen(
        'eggs', 'Egg', 'egg-free',
        'Eggs, egg whites/yolks, mayonnaise, egg noodles, meringue, many baked goods, '
        'some pastas and breaded coatings.',
        ('egg', 'mayonnaise', 'mayo', 'meringue', 'aioli'),
    ),
    Allergen(
        'fish', 'Fish', 'fish-free',
        'All finfish (salmon, tuna, cod, tilapia, anchovy, sardine), fish sauce, '
        'Worcestershire sauce, Caesar dressing, some curry pastes.',
        ('fish', 'salmon', 'tuna', 'cod', 'anchov', 'sardine', 'tilapia', 'worcestershire', 'caesar'),
    ),
    Allergen(
        'shellfish', 'Shellfish (crustaceans)', 'shellfish-free',
        'Shrimp, prawns, crab, lobster, crawfish, shrimp paste (common in Thai curry pastes).',
        ('shrimp', 'prawn', 'crab', 'lobster', 'crawfish', 'crayfish'),
    ),
    Allergen(
        'mollusc', 'Molluscs', 'mollusc-free',
        'Clams, mussels, oysters, scallops, squid/calamari, octopus, snails, oyster sauce.',
        ('clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari', 'octopus', 'escargot'),
    ),
    Allergen(
        'nuts', 'Tree nuts', 'nut-free',
        'Almonds, walnuts, pecans, cashews, pistachios, hazelnuts, macadamias, pine nuts, '
        'Brazil nuts, pesto, almond milk/flour, marzipan, praline, nut extracts.',
        ('nut', 'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia', 'pesto', 'praline'),
    ),
    Allergen(
        'peanuts', 'Peanuts', 'peanut-free',
        'Peanuts, peanut butter, peanut oil (unrefined), satay/peanut sauces, some candies.',
        ('peanut',),
    ),
    Allergen(
        'wheat', 'Wheat', 'wheat-free',
        'Wheat flour, bread, breadcrumbs, pasta, couscous, flour tortillas, crackers, '
        'soy sauce, most cream soups, baking mixes.',
        ('flour', 'bread', 'pasta', 'noodle', 'wheat', 'cracker', 'biscuit', 'tortilla', 'crust', 'bisquick'),
    ),
    Allergen(
        'gluten', 'Gluten (celiac)', 'gluten-free',
        'Everything under wheat, plus barley, rye, malt, beer, and oats that are not '
        'certified gluten-free.',
        ('flour', 'bread', 'pasta', 'noodle', 'wheat', 'barley', 'rye', 'malt', 'beer', 'oat', 'cracker', 'crust'),
    ),
    Allergen(
        'soy', 'Soy', 'soy-free',
        'Soybeans, edamame, tofu, tempeh, miso, soy sauce, tamari, teriyaki, hoisin, soy milk.',
        ('soy', 'tofu', 'tempeh', 'miso', 'edamame', 'teriyaki', 'hoisin', 'tamari'),
    ),
    Allergen(
        'sesame', 'Sesame', 'sesame-free',
        'Sesame seeds, sesame oil, tahini, hummus, many buns and bagels.',
        ('sesame', 'tahini', 'hummus'),
    ),
    Allergen(
        'mustard', 'Mustard', 'mustard-free',
        'Mustard (yellow, Dijon, whole-grain), mustard seed/powder, many curry powders, '
        'some dressings and mayonnaise-based sauces.',
        ('mustard', 'dijon'),
    ),
    Allergen(
        'celery', 'Celery', 'celery-free',
        'Celery stalk, celeriac, celery seed/salt, most broths and bouillon, cream of celery soup.',
        ('celery', 'celeriac', 'bouillon', 'broth', 'stock'),
    ),
    Allergen(
        'lupin', 'Lupin', 'lupin-free',
        'Lupin flour and seeds (sometimes in gluten-free baked goods). Often cross-reacts with peanut.',
        ('lupin', 'lupine'),
    ),
    Allergen(
        'sulphites', 'Sulphites', 'sulphite-free',
        'Wine, wine vinegar, balsamic vinegar, dried fruit (raisins, apricots), some pickles.',
        ('wine', 'raisin', 'dried apricot', 'balsamic'),
    ),
    Allergen(
        'corn', 'Corn', 'corn-free',
        'Corn, cornmeal, cornstarch, corn tortillas, corn syrup, polenta, grits, hominy, '
        'popcorn, baking powder (contains cornstarch).',
        ('corn', 'maize', 'polenta', 'grits', 'hominy', 'masa'),
    ),
    Allergen(
        'coconut', 'Coconut', 'coconut-free',
        'Coconut meat, flakes, milk, cream, oil, and coconut aminos.',
        ('coconut',),
    ),
    Allergen(
        'nightshade', 'Nightshades', 'nightshade-free',
        'Tomatoes (and sauces/paste/salsa/ketchup), white potatoes, bell and chili peppers, '
        'eggplant, paprika, cayenne, chili powder, most hot sauces.',
        ('tomato', 'potato', 'pepper', 'eggplant', 'paprika', 'cayenne', 'chili', 'chile', 'salsa', 'jalapeno'),
    ),
    Allergen(
        'alpha_gal', 'Alpha-gal (mammal meat)', 'alpha-gal-safe',
        'Beef, pork, lamb, veal, venison, goat and products made from them (bacon, sausage, '
        'lard, gelatin, beef broth). Some people with alpha-gal also react to dairy — '
        'users who do should also select Milk / Dairy.',
        ('beef', 'pork', 'lamb', 'veal', 'venison', 'bacon', 'ham', 'sausage', 'lard', 'gelatin', 'steak'),
    ),
)

ALLERGEN_BY_ID = {a.id: a for a in ALLERGENS}
