"""
backend/database/cleaning/catalog.py

The canonical ingredient list. Every raw ingredient line in the Kaggle
data is mapped to exactly one entry here, so "tomato", "diced tomatoes",
"fresh tomato" and "1 can Rotel" all become ingredient id `tomato`.
How it was prepared ("diced", "canned", "fresh") is kept separately as
form / preparation on the recipe line, so nothing is lost.

READ BEFORE ADDING AN INGREDIENT
--------------------------------
* id        snake_case, singular, as specific as the product actually is.
            `tomato_paste` is its own ingredient (different product);
            `diced tomatoes` is not (same product, different prep).
* parent    the more general ingredient it can stand in for. A pantry with
            `chicken_breast` satisfies a recipe that just says "chicken",
            but not the reverse. See ingredient_ancestors in schema.sql.
* aliases   every way the dataset writes it. Matching is word-based,
            singularised, and the LONGEST alias wins, so "chicken broth"
            beats "chicken" and "peanut butter" beats "butter".
* n         nutrition per 100 g, in this order:
            (kcal, protein g, carbs g, fat g, sat fat g, fiber g, sugar g,
             sodium mg, cholesterol mg). Values are USDA FoodData Central
            averages, rounded. They are estimates for meal planning,
            not lab values.
* density   grams per millilitre, used to convert cups/tbsp/tsp to grams.
* each      grams in one whole item ("2 eggs", "1 onion", "3 cloves garlic").
* cooked    (dry->cooked weight ratio, cooked density) for grains and
            legumes, so "2 cups cooked rice" isn't counted as dry rice.
* allergens / may   what it contains / what it commonly hides.
            IDs come from allergens.py.
* flags     diet-relevant properties used by dietary.py (see FLAG list).
* staple    assumed in every kitchen (salt, pepper, water). Staples never
            count as "missing" in pantry matching.
"""

from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------
# Flags (used by dietary.py)
# ---------------------------------------------------------------------
ANIMAL = 'animal'                 # animal flesh or animal-derived (not dairy/egg/honey): meat, fish, broth, gelatin, lard
MAMMAL = 'mammal'                 # red meat: beef, pork, lamb, veal, venison (+ their broths, lard, gelatin)
PORK = 'pork'
POULTRY = 'poultry'
SEAFOOD = 'seafood'               # fish, crustaceans, molluscs
DAIRY = 'dairy'
EGG = 'egg'
HONEY = 'honey'
GELATIN = 'gelatin'
ALCOHOL = 'alcohol'
PROCESSED_MEAT = 'processed_meat'
PROCESSED = 'processed'           # ultra-processed products (condensed soups, instant noodles, process cheese)
GRAIN = 'grain'
REFINED_GRAIN = 'refined_grain'
WHOLE_GRAIN = 'whole_grain'
LEGUME = 'legume'
ADDED_SUGAR = 'added_sugar'
REFINED_SUGAR = 'refined_sugar'   # cane sugar, corn syrup (paleo allows honey/maple, not these)
SEED_OIL = 'seed_oil'
HIGH_FODMAP = 'high_fodmap'       # Monash University high-FODMAP foods at normal serving sizes
HIGH_PURINE = 'high_purine'       # gout triggers
GERD_TRIGGER = 'gerd_trigger'     # common reflux triggers: tomato, citrus, chili, chocolate, mint, alcohol
SPICY = 'spicy'
STARCHY_VEG = 'starchy_veg'       # potatoes, sweet potatoes, corn: carbs on the plate, not keto

# Allergen ids (see allergens.py). 'eggs', 'nuts', 'peanuts' match frontend/types/index.ts
DAI, EGG_A, FISH, SHELL, MOLL = 'dairy', 'eggs', 'fish', 'shellfish', 'mollusc'
TREE, PEANUT, WHEAT, GLUTEN, SOY = 'nuts', 'peanuts', 'wheat', 'gluten', 'soy'
SESAME, MUSTARD, CELERY, LUPIN, SULPH = 'sesame', 'mustard', 'celery', 'lupin', 'sulphites'
CORN, COCO, NIGHT, AGAL = 'corn', 'coconut', 'nightshade', 'alpha_gal'

WG = (WHEAT, GLUTEN)


@dataclass(frozen=True)
class Ingredient:
    id: str
    name: str
    category: str
    aliases: tuple
    n: tuple
    density: Optional[float] = None
    each: Optional[float] = None
    parent: Optional[str] = None
    allergens: tuple = ()
    may: tuple = ()
    flags: tuple = ()
    staple: bool = False
    cooked: Optional[tuple] = None


def _i(id, name, category, aliases, n, **kw) -> Ingredient:
    flags = set(kw.pop('flags', ()))
    allergens = set(kw.pop('allergens', ()))
    # Any mammal product triggers alpha-gal and counts as animal.
    if MAMMAL in flags:
        flags.add(ANIMAL)
        allergens.add(AGAL)
    if PORK in flags:
        flags.add(MAMMAL)
        flags.add(ANIMAL)
        allergens.add(AGAL)
    if POULTRY in flags or SEAFOOD in flags or GELATIN in flags:
        flags.add(ANIMAL)
    if DAI in allergens:
        flags.add(DAIRY)
    if EGG_A in allergens:
        flags.add(EGG)
    if WHEAT in allergens:
        allergens.add(GLUTEN)
    may = tuple(sorted(set(kw.pop('may', ())) - allergens))
    return Ingredient(id, name, category, tuple(aliases), n,
                      flags=tuple(sorted(flags)), allergens=tuple(sorted(allergens)), may=may, **kw)


# n = (kcal, protein, carbs, fat, sat_fat, fiber, sugar, sodium_mg, cholesterol_mg) per 100 g
CATALOG: tuple = (
    # =================================================================
    # POULTRY
    # =================================================================
    _i('chicken', 'Chicken', 'proteins',
       ['chicken', 'chicken meat', 'chicken piece', 'fryer', 'broiler', 'fryer chicken', 'cut up chicken',
        'cooked chicken', 'diced chicken', 'rotisserie chicken', 'chicken tender', 'chicken strip', 'chicken tenderloin'],
       (150, 20, 0, 7, 2.0, 0, 0, 80, 90), each=1200, density=0.6, flags=[POULTRY]),
    _i('chicken_breast', 'Chicken breast', 'proteins',
       ['chicken breast', 'boneless chicken breast', 'skinless chicken breast', 'chicken breast half',
        'boned chicken breast', 'chicken cutlet', 'boneless skinless chicken breast'],
       (120, 22.5, 0, 2.6, 0.6, 0, 0, 45, 73), each=200, parent='chicken', flags=[POULTRY]),
    _i('chicken_thigh', 'Chicken thigh', 'proteins',
       ['chicken thigh', 'boneless chicken thigh', 'chicken leg quarter', 'chicken leg'],
       (150, 18, 0, 8, 2.3, 0, 0, 85, 95), each=110, parent='chicken', flags=[POULTRY]),
    _i('chicken_drumstick', 'Chicken drumstick', 'proteins', ['chicken drumstick', 'drumstick'],
       (160, 18.5, 0, 9, 2.5, 0, 0, 90, 95), each=100, parent='chicken', flags=[POULTRY]),
    _i('chicken_wing', 'Chicken wing', 'proteins', ['chicken wing', 'wing', 'wingette'],
       (191, 17.5, 0, 12.8, 3.6, 0, 0, 73, 111), each=35, parent='chicken', flags=[POULTRY]),
    _i('ground_chicken', 'Ground chicken', 'proteins', ['ground chicken'],
       (143, 17.4, 0, 8.1, 2.3, 0, 0, 60, 86), parent='chicken', flags=[POULTRY]),
    _i('chicken_sausage', 'Chicken sausage', 'proteins', ['chicken sausage', 'smoked chicken sausage'],
       (170, 15, 3, 10, 3, 0, 1.5, 580, 70), each=85, parent='chicken', flags=[POULTRY, PROCESSED_MEAT]),
    _i('turkey', 'Turkey', 'proteins', ['turkey', 'turkey breast', 'cooked turkey', 'turkey meat', 'turkey cutlet'],
       (114, 23.7, 0, 1.5, 0.4, 0, 0, 55, 60), flags=[POULTRY]),
    _i('ground_turkey', 'Ground turkey', 'proteins', ['ground turkey', 'lean ground turkey'],
       (150, 19, 0, 8, 2.2, 0, 0, 70, 75), parent='turkey', flags=[POULTRY]),
    _i('turkey_bacon', 'Turkey bacon', 'proteins', ['turkey bacon'],
       (226, 16, 3, 16, 4.6, 0, 1, 1900, 70), each=14, parent='turkey', flags=[POULTRY, PROCESSED_MEAT]),

    # =================================================================
    # RED MEAT (mammal) — also triggers alpha-gal automatically
    # =================================================================
    _i('beef', 'Beef', 'proteins', ['beef', 'stew beef', 'beef stew meat', 'stew meat', 'beef cube', 'cooked beef', 'roast beef'],
       (200, 19, 0, 13, 5.3, 0, 0, 60, 70), flags=[MAMMAL]),
    _i('ground_beef', 'Ground beef', 'proteins',
       ['ground beef', 'hamburger', 'hamburger meat', 'ground chuck', 'ground round', 'hamburg', 'lean ground beef',
        'ground sirloin', 'minced beef', 'ground meat', 'lean ground meat', 'hamburger meat'],
       (254, 17.2, 0, 20, 7.6, 0, 0, 66, 71), parent='beef', flags=[MAMMAL]),
    _i('beef_steak', 'Beef steak', 'proteins',
       ['steak', 'sirloin', 'sirloin steak', 'round steak', 'flank steak', 'skirt steak', 'ribeye', 'rib eye',
        'strip steak', 'beef tenderloin', 'tenderloin steak', 'cube steak', 'top round', 'chuck steak', 'filet mignon'],
       (160, 21, 0, 8, 3.2, 0, 0, 55, 65), each=225, parent='beef', flags=[MAMMAL]),
    _i('beef_roast', 'Beef roast', 'proteins',
       ['chuck roast', 'pot roast', 'rump roast', 'beef roast', 'brisket', 'beef brisket', 'arm roast', 'eye of round'],
       (215, 19, 0, 15, 6, 0, 0, 65, 72), parent='beef', flags=[MAMMAL]),
    _i('pork', 'Pork', 'proteins', ['pork', 'pork loin', 'pork tenderloin', 'pork roast', 'pork shoulder', 'pork butt',
                                     'boston butt', 'pork cube', 'pork rib', 'spare rib', 'rib', 'country style rib'],
       (200, 19, 0, 13, 4.6, 0, 0, 58, 70), flags=[PORK]),
    _i('pork_chop', 'Pork chop', 'proteins', ['pork chop', 'loin chop'],
       (170, 21, 0, 9, 3, 0, 0, 55, 70), each=180, parent='pork', flags=[PORK]),
    _i('ground_pork', 'Ground pork', 'proteins', ['ground pork'],
       (263, 16.9, 0, 21, 7.9, 0, 0, 56, 72), parent='pork', flags=[PORK]),
    _i('bacon', 'Bacon', 'proteins', ['bacon', 'bacon slice', 'bacon strip', 'bacon bit', 'salt pork', 'pancetta'],
       (458, 11.6, 0.7, 45, 14.9, 0, 0, 833, 66), each=28, parent='pork', flags=[PORK, PROCESSED_MEAT]),
    _i('ham', 'Ham', 'proteins', ['ham', 'cooked ham', 'ham hock', 'ham bone', 'prosciutto', 'deli ham'],
       (145, 21, 1.5, 5.5, 1.8, 0, 1, 1200, 50), density=0.6, parent='pork', flags=[PORK, PROCESSED_MEAT]),
    _i('pork_sausage', 'Pork sausage', 'proteins',
       ['sausage', 'pork sausage', 'italian sausage', 'breakfast sausage', 'bulk sausage', 'smoked sausage',
        'kielbasa', 'bratwurst', 'andouille', 'link sausage', 'polish sausage', 'chorizo'],
       (320, 14, 2, 28, 9.5, 0, 1, 780, 72), each=75, parent='pork', flags=[PORK, PROCESSED_MEAT]),
    _i('hot_dog', 'Hot dog', 'proteins', ['hot dog', 'frankfurter', 'frank', 'wiener', 'weiner'],
       (290, 10, 4, 26, 10, 0, 2, 1090, 50), each=45, flags=[MAMMAL, PROCESSED_MEAT]),
    _i('pepperoni', 'Pepperoni', 'proteins', ['pepperoni', 'salami'],
       (504, 19, 1, 46, 17, 0, 0, 1580, 97), flags=[PORK, PROCESSED_MEAT]),
    _i('lamb', 'Lamb', 'proteins', ['lamb', 'ground lamb', 'lamb chop', 'leg of lamb', 'lamb shoulder', 'mutton'],
       (282, 16.6, 0, 23.4, 10.2, 0, 0, 59, 73), flags=[MAMMAL]),
    _i('veal', 'Veal', 'proteins', ['veal', 'veal cutlet', 'ground veal'],
       (144, 19.4, 0, 6.8, 2.9, 0, 0, 82, 82), flags=[MAMMAL]),
    _i('venison', 'Venison', 'proteins', ['venison', 'deer meat', 'elk', 'bison', 'ground venison', 'ground bison'],
       (120, 23, 0, 2.4, 1, 0, 0, 51, 85), flags=[MAMMAL]),
    _i('liver', 'Liver', 'proteins', ['liver', 'chicken liver', 'beef liver', 'calf liver'],
       (135, 20.4, 3.9, 3.6, 1.2, 0, 0, 69, 345), flags=[ANIMAL, HIGH_PURINE],
       allergens=[AGAL]),  # beef/calf liver; chicken liver is lower risk but grouped conservatively

    # =================================================================
    # FISH & SHELLFISH
    # =================================================================
    _i('fish', 'White fish', 'proteins',
       ['fish', 'fish fillet', 'white fish', 'cod', 'tilapia', 'haddock', 'halibut', 'flounder', 'sole', 'pollock',
        'catfish', 'orange roughy', 'snapper', 'perch', 'whitefish', 'grouper', 'mahi mahi', 'bass'],
       (90, 19, 0, 1.2, 0.3, 0, 0, 60, 45), each=170, allergens=[FISH], flags=[SEAFOOD]),
    _i('salmon', 'Salmon', 'proteins', ['salmon', 'salmon fillet', 'salmon steak', 'canned salmon', 'smoked salmon', 'lox'],
       (208, 20, 0, 13.4, 3.1, 0, 0, 59, 55), each=170, parent='fish', allergens=[FISH], flags=[SEAFOOD]),
    _i('tuna', 'Tuna', 'proteins', ['tuna', 'tuna fish', 'canned tuna', 'albacore', 'tuna steak', 'chunk light tuna'],
       (116, 25.5, 0, 0.8, 0.2, 0, 0, 338, 42), parent='fish', allergens=[FISH], flags=[SEAFOOD]),
    _i('trout', 'Trout', 'proteins', ['trout', 'mackerel', 'herring'],
       (150, 20.5, 0, 6.6, 1.5, 0, 0, 52, 58), parent='fish', allergens=[FISH], flags=[SEAFOOD, HIGH_PURINE]),
    _i('anchovy', 'Anchovy', 'proteins', ['anchovy', 'anchovy fillet', 'anchovy paste'],
       (210, 28.9, 0, 9.7, 2.2, 0, 0, 3668, 85), each=4, parent='fish', allergens=[FISH], flags=[SEAFOOD, HIGH_PURINE]),
    _i('sardine', 'Sardine', 'proteins', ['sardine'],
       (208, 24.6, 0, 11.5, 1.5, 0, 0, 307, 142), parent='fish', allergens=[FISH], flags=[SEAFOOD, HIGH_PURINE]),
    _i('shrimp', 'Shrimp', 'proteins', ['shrimp', 'prawn', 'jumbo shrimp', 'cooked shrimp', 'salad shrimp', 'crawfish', 'crayfish'],
       (85, 20.1, 0.2, 0.5, 0.1, 0, 0, 119, 161), each=12, allergens=[SHELL], flags=[SEAFOOD]),
    _i('crab', 'Crab', 'proteins', ['crab', 'crabmeat', 'crab meat', 'lump crab', 'imitation crab', 'surimi'],
       (87, 18, 0, 1.1, 0.2, 0, 0, 293, 97), allergens=[SHELL], may=[FISH, WHEAT, EGG_A], flags=[SEAFOOD]),
    _i('lobster', 'Lobster', 'proteins', ['lobster', 'lobster tail', 'langostino'],
       (77, 16.5, 0, 0.8, 0.2, 0, 0, 296, 127), each=140, allergens=[SHELL], flags=[SEAFOOD]),
    _i('scallop', 'Scallop', 'proteins', ['scallop', 'bay scallop', 'sea scallop'],
       (69, 12, 3.2, 0.5, 0.1, 0, 0, 392, 24), each=30, allergens=[MOLL], flags=[SEAFOOD, HIGH_PURINE]),
    _i('clam', 'Clam', 'proteins', ['clam', 'minced clam', 'clam juice', 'quahog'],
       (86, 14.7, 3.6, 1, 0.1, 0, 0, 601, 30), allergens=[MOLL], flags=[SEAFOOD]),
    _i('mussel', 'Mussel', 'proteins', ['mussel'],
       (86, 11.9, 3.7, 2.2, 0.4, 0, 0, 286, 28), each=15, allergens=[MOLL], flags=[SEAFOOD, HIGH_PURINE]),
    _i('oyster', 'Oyster', 'proteins', ['oyster'],
       (81, 9.5, 4.9, 2.3, 0.5, 0, 0, 106, 50), each=25, allergens=[MOLL], flags=[SEAFOOD]),
    _i('squid', 'Squid', 'proteins', ['squid', 'calamari', 'octopus'],
       (92, 15.6, 3.1, 1.4, 0.4, 0, 0, 44, 233), allergens=[MOLL], flags=[SEAFOOD]),

    # =================================================================
    # EGGS, SOY, LEGUMES
    # =================================================================
    _i('egg', 'Egg', 'proteins', ['egg', 'large egg', 'whole egg', 'egg yolk', 'yolk', 'hard boiled egg', 'beaten egg'],
       (143, 12.6, 0.7, 9.5, 3.1, 0, 0.4, 142, 372), each=50, allergens=[EGG_A]),
    _i('egg_white', 'Egg white', 'proteins', ['egg white', 'white of egg', 'liquid egg white', 'egg substitute', 'egg beater'],
       (52, 10.9, 0.7, 0.2, 0, 0, 0.7, 166, 0), each=33, density=1.03, parent='egg', allergens=[EGG_A]),
    _i('tofu', 'Tofu', 'proteins', ['tofu', 'firm tofu', 'extra firm tofu', 'silken tofu', 'bean curd'],
       (144, 17.3, 2.8, 8.7, 1.3, 2.3, 0.6, 14, 0), each=400, allergens=[SOY], flags=[LEGUME]),
    _i('tempeh', 'Tempeh', 'proteins', ['tempeh'],
       (192, 20.3, 7.6, 10.8, 2.2, 0, 0, 9, 0), each=225, allergens=[SOY], flags=[LEGUME]),
    _i('edamame', 'Edamame', 'produce', ['edamame', 'soybean', 'soy bean'],
       (121, 11.9, 8.9, 5.2, 0.6, 5.2, 2.2, 6, 0), density=0.6, allergens=[SOY], flags=[LEGUME]),
    _i('black_beans', 'Black beans', 'proteins', ['black bean', 'turtle bean'],
       (132, 8.9, 23.7, 0.5, 0.1, 8.7, 0.3, 240, 0), density=0.72, each=425, allergens=[],
       flags=[LEGUME, HIGH_FODMAP], cooked=(2.4, 0.72)),
    _i('kidney_beans', 'Kidney beans', 'proteins', ['kidney bean', 'red kidney bean', 'red bean', 'chili bean'],
       (127, 8.7, 22.8, 0.5, 0.1, 7.4, 0.3, 250, 0), density=0.72, flags=[LEGUME, HIGH_FODMAP]),
    _i('pinto_beans', 'Pinto beans', 'proteins', ['pinto bean', 'pork and bean', 'baked bean', 'navy bean', 'great northern bean',
                                                   'butter bean', 'lima bean', 'bean'],
       (143, 9, 26, 0.7, 0.1, 9, 0.3, 240, 0), density=0.72, flags=[LEGUME, HIGH_FODMAP]),
    _i('white_beans', 'White beans', 'proteins', ['white bean', 'cannellini', 'cannellini bean'],
       (139, 9.7, 25, 0.4, 0.1, 6.3, 0.3, 240, 0), density=0.72, parent='pinto_beans', flags=[LEGUME, HIGH_FODMAP]),
    _i('refried_beans', 'Refried beans', 'proteins', ['refried bean'],
       (94, 5.5, 15, 1.2, 0.4, 5, 0.4, 390, 0), density=1.0, flags=[LEGUME, HIGH_FODMAP]),
    _i('chickpeas', 'Chickpeas', 'proteins', ['chickpea', 'garbanzo', 'garbanzo bean', 'chick pea'],
       (164, 8.9, 27.4, 2.6, 0.3, 7.6, 4.8, 240, 0), density=0.68, flags=[LEGUME, HIGH_FODMAP]),
    _i('lentils', 'Lentils', 'proteins', ['lentil', 'red lentil', 'green lentil', 'brown lentil', 'split pea'],
       (352, 24.6, 63, 1.1, 0.2, 10.7, 2, 6, 0), density=0.8, flags=[LEGUME, HIGH_FODMAP], cooked=(2.5, 0.84)),
    _i('hummus', 'Hummus', 'condiments', ['hummus', 'houmous'],
       (166, 7.9, 14.3, 9.6, 1.4, 6, 0.3, 379, 0), density=1.0, allergens=[SESAME], flags=[LEGUME, HIGH_FODMAP]),
    _i('peanut_butter', 'Peanut butter', 'pantry', ['peanut butter', 'creamy peanut butter', 'crunchy peanut butter'],
       (588, 25, 20, 50, 10, 6, 9, 430, 0), density=1.08, allergens=[PEANUT], flags=[LEGUME]),
    _i('peanuts', 'Peanuts', 'nuts_seeds', ['peanut', 'dry roasted peanut', 'salted peanut'],
       (567, 25.8, 16, 49, 6.3, 8.5, 4, 18, 0), density=0.6, allergens=[PEANUT], flags=[LEGUME]),
    _i('sunflower_butter', 'Sunflower seed butter', 'pantry', ['sunflower seed butter', 'sunbutter', 'sunflower butter'],
       (617, 17.3, 23, 55, 4.8, 5.7, 10, 330, 0), density=1.08),

    # =================================================================
    # DAIRY
    # =================================================================
    _i('milk', 'Milk', 'dairy', ['milk', 'whole milk', 'sweet milk', '2% milk', 'lowfat milk', 'low fat milk', 'scalded milk',
                                  'sour milk', 'powdered milk', 'dry milk'],
       (61, 3.2, 4.8, 3.3, 1.9, 0, 5.1, 43, 10), density=1.03, allergens=[DAI], flags=[HIGH_FODMAP]),
    _i('skim_milk', 'Skim milk', 'dairy', ['skim milk', 'nonfat milk', 'fat free milk'],
       (34, 3.4, 5, 0.1, 0.1, 0, 5, 42, 2), density=1.03, parent='milk', allergens=[DAI], flags=[HIGH_FODMAP]),
    _i('buttermilk', 'Buttermilk', 'dairy', ['buttermilk'],
       (40, 3.3, 4.8, 0.9, 0.5, 0, 4.8, 105, 4), density=1.03, allergens=[DAI], flags=[HIGH_FODMAP]),
    _i('heavy_cream', 'Heavy cream', 'dairy', ['heavy cream', 'whipping cream', 'heavy whipping cream', 'cream',
                                               'double cream', 'light cream'],
       (340, 2.8, 2.7, 36, 23, 0, 2.9, 27, 113), density=1.0, allergens=[DAI]),
    _i('half_and_half', 'Half-and-half', 'dairy', ['half and half', 'half & half', 'coffee creamer', 'creamer'],
       (131, 3.1, 4.3, 11.5, 7.2, 0, 4.1, 61, 35), density=1.02, parent='heavy_cream', allergens=[DAI]),
    _i('whipped_topping', 'Whipped topping', 'dairy', ['whipped topping', 'cool whip', 'whipped cream', 'dream whip'],
       (318, 1.3, 23, 25, 21, 0, 23, 30, 0), density=0.3, allergens=[DAI], may=[SOY, COCO],
       flags=[ADDED_SUGAR, PROCESSED]),
    _i('sour_cream', 'Sour cream', 'dairy', ['sour cream', 'dairy sour cream', 'light sour cream', 'creme fraiche'],
       (198, 2.4, 4.6, 19.4, 10.1, 0, 3.4, 31, 59), density=1.0, allergens=[DAI]),
    _i('cream_cheese', 'Cream cheese', 'dairy', ['cream cheese', 'philadelphia cream cheese', 'neufchatel', 'mascarpone'],
       (342, 6, 5.5, 34, 19, 0, 3.8, 321, 110), density=1.0, each=227, allergens=[DAI]),
    _i('butter', 'Butter', 'dairy', ['butter', 'unsalted butter', 'salted butter', 'melted butter', 'sweet butter', 'ghee'],
       (717, 0.9, 0.1, 81, 51, 0, 0.1, 576, 215), density=0.911, each=113, allergens=[DAI]),
    _i('margarine', 'Margarine', 'dairy', ['margarine', 'oleo', 'spread', 'buttery spread', 'vegetable spread', 'parkay'],
       (717, 0.2, 0.7, 80, 15, 0, 0, 700, 0), density=0.911, each=113, may=[DAI, SOY], flags=[SEED_OIL, PROCESSED]),
    _i('yogurt', 'Yogurt', 'dairy', ['yogurt', 'plain yogurt', 'yoghurt', 'vanilla yogurt'],
       (61, 3.5, 4.7, 3.3, 2.1, 0, 4.7, 46, 13), density=1.03, allergens=[DAI], flags=[HIGH_FODMAP]),
    _i('greek_yogurt', 'Greek yogurt', 'dairy', ['greek yogurt', 'plain greek yogurt', 'nonfat greek yogurt', 'strained yogurt'],
       (59, 10.2, 3.6, 0.4, 0.1, 0, 3.2, 36, 5), density=1.05, parent='yogurt', allergens=[DAI]),
    _i('cheddar', 'Cheddar cheese', 'dairy', ['cheddar', 'cheddar cheese', 'sharp cheddar', 'mild cheddar', 'cheese',
                                              'longhorn cheese', 'colby', 'colby jack', 'mexican cheese', 'taco cheese',
                                              'mexican blend cheese', 'shredded cheese'],
       (403, 24.9, 1.3, 33, 21, 0, 0.5, 621, 105), density=0.47, each=28, allergens=[DAI]),
    _i('mozzarella', 'Mozzarella', 'dairy', ['mozzarella', 'mozzarella cheese', 'part skim mozzarella', 'string cheese', 'provolone'],
       (300, 22, 2.2, 22, 13, 0, 1, 627, 79), density=0.47, each=28, allergens=[DAI]),
    _i('parmesan', 'Parmesan', 'dairy', ['parmesan', 'parmesan cheese', 'parmigiano', 'parmigiano reggiano', 'romano',
                                         'romano cheese', 'pecorino', 'asiago'],
       (431, 38, 4.1, 29, 19, 0, 0.9, 1529, 88), density=0.4, allergens=[DAI]),
    _i('monterey_jack', 'Monterey Jack', 'dairy', ['monterey jack', 'jack cheese', 'pepper jack', 'pepper jack cheese',
                                                   'muenster', 'havarti', 'gouda', 'fontina'],
       (373, 24.5, 0.7, 30, 19, 0, 0.5, 536, 89), density=0.47, allergens=[DAI]),
    _i('swiss_cheese', 'Swiss cheese', 'dairy', ['swiss', 'swiss cheese', 'gruyere', 'emmental', 'jarlsberg'],
       (380, 27, 1.4, 28, 18, 0, 0.2, 192, 93), density=0.47, each=28, allergens=[DAI]),
    _i('feta', 'Feta', 'dairy', ['feta', 'feta cheese', 'cotija', 'queso fresco'],
       (264, 14.2, 4.1, 21.3, 15, 0, 4.1, 917, 89), density=0.6, allergens=[DAI]),
    _i('goat_cheese', 'Goat cheese', 'dairy', ['goat cheese', 'chevre'],
       (364, 21.6, 0.1, 29.8, 20.6, 0, 0.1, 515, 79), density=0.6, allergens=[DAI]),
    _i('blue_cheese', 'Blue cheese', 'dairy', ['blue cheese', 'bleu cheese', 'gorgonzola', 'roquefort'],
       (353, 21.4, 2.3, 28.7, 18.7, 0, 0.5, 1395, 75), density=0.5, allergens=[DAI]),
    _i('ricotta', 'Ricotta', 'dairy', ['ricotta', 'ricotta cheese'],
       (174, 11.3, 3, 13, 8.3, 0, 0.3, 84, 51), density=1.03, allergens=[DAI], flags=[HIGH_FODMAP]),
    _i('cottage_cheese', 'Cottage cheese', 'dairy', ['cottage cheese', 'small curd cottage cheese'],
       (98, 11.1, 3.4, 4.3, 1.7, 0, 2.7, 364, 17), density=0.95, allergens=[DAI], flags=[HIGH_FODMAP]),
    _i('process_cheese', 'Process cheese', 'dairy', ['american cheese', 'velveeta', 'process cheese', 'processed cheese',
                                                     'cheese spread', 'cheez whiz', 'cheese sauce', 'nacho cheese'],
       (366, 18, 4.8, 31, 18, 0, 2.3, 1671, 100), density=0.9, each=21, allergens=[DAI], flags=[PROCESSED]),
    _i('ice_cream', 'Ice cream', 'dairy', ['ice cream', 'vanilla ice cream', 'frozen yogurt', 'sherbet', 'ice milk'],
       (207, 3.5, 23.6, 11, 6.8, 0.7, 21, 80, 44), density=0.55, allergens=[DAI], may=[EGG_A, TREE, PEANUT],
       flags=[ADDED_SUGAR, REFINED_SUGAR, HIGH_FODMAP]),
    _i('evaporated_milk', 'Evaporated milk', 'dairy', ['evaporated milk', 'evaporated skim milk', 'pet milk', 'carnation milk'],
       (134, 6.8, 10, 7.6, 4.6, 0, 10, 106, 29), density=1.07, each=354, parent='milk', allergens=[DAI], flags=[HIGH_FODMAP]),
    _i('condensed_milk', 'Sweetened condensed milk', 'dairy', ['sweetened condensed milk', 'condensed milk', 'eagle brand milk',
                                                                'eagle brand'],
       (321, 7.9, 54.4, 8.7, 5.5, 0, 54.4, 127, 34), density=1.3, each=397, allergens=[DAI],
       flags=[ADDED_SUGAR, REFINED_SUGAR, HIGH_FODMAP]),

    # =================================================================
    # PLANT MILKS
    # =================================================================
    _i('almond_milk', 'Almond milk', 'dairy', ['almond milk', 'unsweetened almond milk'],
       (15, 0.6, 0.3, 1.2, 0.1, 0.2, 0, 72, 0), density=1.03, allergens=[TREE]),
    _i('soy_milk', 'Soy milk', 'dairy', ['soy milk', 'soymilk'],
       (54, 3.3, 6.3, 1.8, 0.2, 0.6, 4, 51, 0), density=1.03, allergens=[SOY], flags=[LEGUME]),
    _i('oat_milk', 'Oat milk', 'dairy', ['oat milk'],
       (48, 0.8, 7, 2.3, 0.2, 0.8, 3.3, 42, 0), density=1.03, may=[GLUTEN], flags=[GRAIN]),
    _i('coconut_milk', 'Coconut milk', 'pantry', ['coconut milk', 'coconut cream', 'lite coconut milk', 'cream of coconut'],
       (230, 2.3, 5.5, 23.8, 21.1, 2.2, 3.3, 15, 0), density=1.0, each=400, allergens=[COCO]),

    # =================================================================
    # GRAINS, BREADS, PASTA
    # =================================================================
    _i('flour', 'All-purpose flour', 'grains', ['flour', 'all purpose flour', 'plain flour', 'white flour', 'unbleached flour',
                                                'bread flour', 'cake flour', 'self rising flour', 'enriched flour', 'sifted flour'],
       (364, 10.3, 76.3, 1, 0.2, 2.7, 0.3, 2, 0), density=0.53, allergens=WG, flags=[GRAIN, REFINED_GRAIN, HIGH_FODMAP]),
    _i('whole_wheat_flour', 'Whole wheat flour', 'grains', ['whole wheat flour', 'wheat flour', 'graham flour', 'whole grain flour'],
       (340, 13.2, 72, 2.5, 0.4, 10.7, 0.4, 2, 0), density=0.51, parent='flour', allergens=WG,
       flags=[GRAIN, WHOLE_GRAIN, HIGH_FODMAP]),
    _i('almond_flour', 'Almond flour', 'grains', ['almond flour', 'almond meal', 'ground almond'],
       (571, 21.4, 21.4, 50, 3.6, 10.7, 3.6, 0, 0), density=0.4, allergens=[TREE]),
    _i('baking_mix', 'Baking mix', 'grains', ['bisquick', 'baking mix', 'biscuit mix', 'pancake mix', 'jiffy mix',
                                              'corn muffin mix', 'jiffy corn muffin mix'],
       (428, 8, 67, 14, 3.5, 2, 7, 1200, 0), density=0.5, allergens=WG, may=[DAI, SOY, EGG_A, CORN],
       flags=[GRAIN, REFINED_GRAIN, PROCESSED, HIGH_FODMAP]),
    _i('cake_mix', 'Cake mix', 'baking', ['cake mix', 'yellow cake mix', 'white cake mix', 'devil food cake mix',
                                          'chocolate cake mix', 'spice cake mix', 'lemon cake mix', 'brownie mix',
                                          'box cake mix', 'duncan hines cake mix', 'betty crocker cake mix'],
       (420, 4, 78, 10, 2.5, 1.3, 45, 650, 0), density=0.5, each=432, allergens=WG, may=[DAI, EGG_A, SOY, CORN],
       flags=[GRAIN, REFINED_GRAIN, ADDED_SUGAR, REFINED_SUGAR, PROCESSED, HIGH_FODMAP]),
    _i('frosting', 'Frosting', 'sweeteners', ['frosting', 'icing', 'canned frosting', 'cream cheese frosting',
                                              'chocolate frosting', 'vanilla frosting', 'glaze'],
       (397, 0, 63, 17, 5, 0, 58, 180, 0), density=1.2, each=453, may=[DAI, SOY, CORN],
       flags=[ADDED_SUGAR, REFINED_SUGAR, PROCESSED, SEED_OIL]),
    _i('cornstarch', 'Cornstarch', 'pantry', ['cornstarch', 'corn starch', 'cornflour'],
       (381, 0.3, 91, 0.1, 0, 0.9, 0, 9, 0), density=0.54, allergens=[CORN], flags=[GRAIN]),
    _i('potato_starch', 'Potato starch', 'pantry', ['potato starch', 'katakuriko', 'tapioca starch', 'tapioca',
                                                    'arrowroot', 'arrowroot powder', 'tapioca flour'],
       (333, 0.1, 83, 0, 0, 0, 0, 55, 0), density=0.6, may=[NIGHT]),
    _i('cornmeal', 'Cornmeal', 'grains', ['cornmeal', 'corn meal', 'yellow cornmeal', 'polenta', 'grits', 'stone ground grits', 'masa', 'masa harina',
                                          'masa flour'],
       (362, 8.1, 76.9, 3.6, 0.5, 7.3, 0.6, 35, 0), density=0.6, allergens=[CORN], flags=[GRAIN, WHOLE_GRAIN]),
    _i('rice', 'White rice', 'grains', ['rice', 'white rice', 'long grain rice', 'long grain white rice', 'instant rice',
                                        'minute rice', 'jasmine rice', 'basmati rice', 'arborio rice', 'short grain rice',
                                        'converted rice', 'uncooked rice', 'cooked rice', 'sushi rice', 'rice pilaf'],
       (365, 7.1, 80, 0.7, 0.2, 1.3, 0.1, 5, 0), density=0.78, flags=[GRAIN, REFINED_GRAIN], cooked=(2.8, 0.67)),
    _i('brown_rice', 'Brown rice', 'grains', ['brown rice', 'wild rice', 'long grain brown rice', 'cooked brown rice'],
       (370, 7.9, 77, 2.9, 0.6, 3.5, 0.9, 7, 0), density=0.8, parent='rice', flags=[GRAIN, WHOLE_GRAIN], cooked=(2.6, 0.8)),
    _i('wheat_germ', 'Wheat germ', 'grains', ['wheat germ', 'toasted wheat germ', 'wheat bran', 'oat bran', 'bran'],
       (360, 23, 52, 9.7, 1.7, 13, 0, 12, 0), density=0.5, allergens=WG, flags=[GRAIN, WHOLE_GRAIN]),
    _i('quinoa', 'Quinoa', 'grains', ['quinoa'],
       (368, 14.1, 64.2, 6.1, 0.7, 7, 0, 5, 0), density=0.72, flags=[GRAIN, WHOLE_GRAIN], cooked=(2.7, 0.78)),
    _i('oats', 'Rolled oats', 'grains', ['oat', 'oatmeal', 'rolled oat', 'quick oat', 'quick cooking oat', 'old fashioned oat',
                                         'steel cut oat'],
       (379, 13.2, 67.7, 6.5, 1.1, 10.1, 1, 6, 0), density=0.36, may=[GLUTEN], flags=[GRAIN, WHOLE_GRAIN]),
    _i('barley', 'Barley', 'grains', ['barley', 'pearl barley', 'pearled barley'],
       (352, 9.9, 77.7, 1.2, 0.2, 15.6, 0.8, 9, 0), density=0.8, allergens=[GLUTEN], flags=[GRAIN, WHOLE_GRAIN],
       cooked=(3.0, 0.66)),
    _i('couscous', 'Couscous', 'grains', ['couscous', 'bulgur', 'bulgur wheat', 'farro', 'orzo'],
       (376, 12.8, 77.4, 0.6, 0.1, 5, 0, 10, 0), density=0.73, allergens=WG, flags=[GRAIN, REFINED_GRAIN, HIGH_FODMAP],
       cooked=(2.5, 0.66)),
    _i('pasta', 'Pasta', 'grains', ['pasta', 'noodle', 'macaroni', 'elbow macaroni', 'spaghetti', 'penne', 'rigatoni', 'ziti',
                                    'linguine', 'fettuccine', 'fettuccini', 'rotini', 'bow tie pasta', 'farfalle', 'vermicelli',
                                    'angel hair', 'angel hair pasta', 'shell pasta', 'pasta shell', 'shell macaroni',
                                    'lasagna noodle', 'lasagne', 'manicotti', 'jumbo shell', 'tortellini', 'ravioli',
                                    'spaghetti noodle', 'thin spaghetti', 'fusilli', 'cooked pasta'],
       (371, 13, 75, 1.5, 0.3, 3.2, 2.7, 6, 0), density=0.44, allergens=WG, may=[EGG_A],
       flags=[GRAIN, REFINED_GRAIN, HIGH_FODMAP], cooked=(2.3, 0.58)),
    _i('egg_noodles', 'Egg noodles', 'grains', ['egg noodle', 'wide egg noodle', 'kluski'],
       (384, 14, 71, 4.4, 1.2, 3.3, 1.9, 21, 79), density=0.33, parent='pasta', allergens=WG + (EGG_A,),
       flags=[GRAIN, REFINED_GRAIN, HIGH_FODMAP], cooked=(2.5, 0.66)),
    _i('whole_wheat_pasta', 'Whole wheat pasta', 'grains', ['whole wheat pasta', 'whole wheat spaghetti', 'whole grain pasta',
                                                            'whole wheat penne'],
       (352, 14.6, 71, 2.9, 0.5, 9.2, 3.2, 8, 0), density=0.44, parent='pasta', allergens=WG,
       flags=[GRAIN, WHOLE_GRAIN, HIGH_FODMAP], cooked=(2.3, 0.58)),
    _i('chickpea_pasta', 'Chickpea pasta', 'grains', ['chickpea pasta', 'lentil pasta', 'bean pasta'],
       (350, 20, 57, 6, 0.9, 8, 4, 60, 0), density=0.44, parent='pasta', flags=[LEGUME, HIGH_FODMAP], cooked=(2.3, 0.58)),
    _i('rice_noodles', 'Rice noodles', 'grains', ['rice noodle', 'rice stick', 'pad thai noodle', 'rice vermicelli',
                                                  'glass noodle', 'cellophane noodle'],
       (364, 6, 80, 0.6, 0.2, 1.6, 0.1, 182, 0), density=0.4, flags=[GRAIN, REFINED_GRAIN], cooked=(2.4, 0.6)),
    _i('ramen_noodles', 'Instant ramen noodles', 'grains', ['ramen', 'ramen noodle', 'instant ramen', 'top ramen',
                                                            'oriental noodle', 'chow mein noodle', 'lo mein noodle'],
       (440, 10, 63, 17, 7.6, 2.3, 1.5, 1160, 0), each=85, parent='pasta', allergens=WG, may=[SOY, EGG_A, SESAME],
       flags=[GRAIN, REFINED_GRAIN, PROCESSED, HIGH_FODMAP]),
    _i('bread', 'White bread', 'grains', ['bread', 'white bread', 'sandwich bread', 'french bread', 'italian bread', 'loaf',
                                          'bread slice', 'baguette', 'sourdough', 'sourdough bread', 'roll', 'dinner roll',
                                          'crouton', 'bread cube', 'stuffing', 'stuffing mix', 'stove top stuffing',
                                          'english muffin', 'bagel', 'croissant', 'biscuit', 'texas toast', 'hard roll', 'sub roll',
                                          'hoagie roll'],
       (266, 8.9, 49, 3.3, 0.7, 2.7, 5.7, 490, 0), density=0.25, each=28, allergens=WG, may=[DAI, EGG_A, SOY, SESAME],
       flags=[GRAIN, REFINED_GRAIN, HIGH_FODMAP]),
    _i('whole_wheat_bread', 'Whole wheat bread', 'grains', ['whole wheat bread', 'wheat bread', 'whole grain bread',
                                                            'multigrain bread', 'rye bread', 'pumpernickel'],
       (252, 12.4, 43, 3.5, 0.7, 6, 4.4, 450, 0), density=0.25, each=32, parent='bread', allergens=WG,
       may=[DAI, EGG_A, SOY, SESAME], flags=[GRAIN, WHOLE_GRAIN, HIGH_FODMAP]),
    _i('bun', 'Bun', 'grains', ['bun', 'hamburger bun', 'hot dog bun', 'burger bun', 'sandwich bun', 'kaiser roll', 'brioche bun',
                                'slider bun'],
       (279, 9.7, 49.4, 4, 1, 2.3, 6.3, 500, 0), each=52, parent='bread', allergens=WG, may=[DAI, EGG_A, SOY, SESAME],
       flags=[GRAIN, REFINED_GRAIN, HIGH_FODMAP]),
    _i('pita', 'Pita', 'grains', ['pita', 'pita bread', 'naan', 'flatbread', 'pocket bread'],
       (275, 9.1, 55.7, 1.2, 0.2, 2.2, 1.3, 536, 0), each=60, parent='bread', allergens=WG, may=[DAI, SESAME],
       flags=[GRAIN, REFINED_GRAIN, HIGH_FODMAP]),
    _i('bread_crumbs', 'Bread crumbs', 'grains', ['bread crumb', 'breadcrumb', 'dry bread crumb', 'italian bread crumb',
                                                  'seasoned bread crumb', 'panko', 'panko bread crumb', 'cracker crumb',
                                                  'fresh bread crumb', 'soft bread crumb'],
       (395, 13.4, 72, 5.3, 1.2, 4.5, 6.2, 732, 0), density=0.45, allergens=WG, may=[DAI, EGG_A, SOY, SESAME],
       flags=[GRAIN, REFINED_GRAIN, HIGH_FODMAP]),
    _i('crackers', 'Crackers', 'grains', ['cracker', 'saltine', 'saltine cracker', 'ritz', 'ritz cracker', 'butter cracker',
                                          'club cracker', 'oyster cracker', 'soda cracker', 'townhouse cracker'],
       (460, 7.5, 68, 17, 3, 2.5, 6, 900, 0), density=0.35, each=3, allergens=WG, may=[DAI, SOY, SESAME],
       flags=[GRAIN, REFINED_GRAIN, PROCESSED]),
    _i('graham_crackers', 'Graham crackers', 'grains', ['graham cracker', 'graham cracker crumb', 'graham crumb', 'vanilla wafer',
                                                        'nilla wafer', 'cookie crumb', 'oreo', 'chocolate wafer'],
       (430, 6.7, 77, 10, 1.5, 3.4, 24, 400, 0), density=0.45, each=7, allergens=WG, may=[DAI, SOY, EGG_A],
       flags=[GRAIN, REFINED_GRAIN, ADDED_SUGAR, REFINED_SUGAR, PROCESSED, HONEY]),
    _i('pie_crust', 'Pie crust', 'grains', ['pie crust', 'pie shell', 'pastry shell', 'unbaked pie shell', 'baked pie shell',
                                            'pastry', 'puff pastry', 'phyllo', 'phyllo dough', 'crescent roll',
                                            'refrigerated crescent roll', 'biscuit dough', 'refrigerated biscuit',
                                            'pizza crust', 'pizza dough', 'dough'],
       (460, 5.6, 48, 28, 10, 1.5, 3, 450, 0), each=220, allergens=WG, may=[DAI, SOY, EGG_A],
       flags=[GRAIN, REFINED_GRAIN, PROCESSED]),
    _i('flour_tortilla', 'Flour tortilla', 'grains', ['flour tortilla', 'tortilla', 'wrap', 'burrito size tortilla',
                                                      'soft taco shell'],
       (304, 8.1, 50, 7.7, 2.9, 3.5, 2.8, 610, 0), each=45, allergens=WG, may=[SOY],
       flags=[GRAIN, REFINED_GRAIN, HIGH_FODMAP]),
    _i('corn_tortilla', 'Corn tortilla', 'grains', ['corn tortilla', 'taco shell', 'hard taco shell', 'tostada shell',
                                                    'tostada'],
       (218, 5.7, 44.6, 2.8, 0.4, 6.3, 0.9, 45, 0), each=26, allergens=[CORN], flags=[GRAIN, WHOLE_GRAIN]),
    _i('tortilla_chips', 'Tortilla chips', 'grains', ['tortilla chip', 'corn chip', 'frito', 'dorito', 'nacho chip'],
       (489, 6.4, 65, 23, 3, 5, 1.3, 300, 0), density=0.12, allergens=[CORN], flags=[GRAIN, PROCESSED, SEED_OIL]),
    _i('potato_chips', 'Potato chips', 'produce', ['potato chip', 'crushed potato chip', 'chip'],
       (536, 7, 53, 34, 3.4, 4.4, 0.3, 525, 0), density=0.1, allergens=[NIGHT], flags=[STARCHY_VEG, PROCESSED, SEED_OIL]),
    _i('cereal', 'Breakfast cereal', 'grains', ['corn flake', 'cornflake', 'rice krispie', 'crisp rice cereal', 'cheerio',
                                                'chex', 'rice chex', 'corn chex', 'bran flake', 'cereal', 'rice biscuit',
                                                'shredded rice biscuit', 'shredded wheat', 'shredded wheat biscuit',
                                                'granola', 'wheaties', 'special k', 'rice cereal', 'bran cereal'],
       (380, 7, 84, 1.5, 0.3, 3, 10, 700, 0), density=0.12, may=[CORN, WHEAT, GLUTEN],
       flags=[GRAIN, REFINED_GRAIN, ADDED_SUGAR, PROCESSED]),

    # =================================================================
    # VEGETABLES
    # =================================================================
    _i('onion', 'Onion', 'produce', ['onion', 'yellow onion', 'white onion', 'red onion', 'sweet onion', 'vidalia onion',
                                     'spanish onion', 'purple onion', 'pearl onion', 'minced onion', 'dried onion',
                                     'dehydrated onion', 'instant minced onion', 'onion flake'],
       (40, 1.1, 9.3, 0.1, 0, 1.7, 4.2, 4, 0), density=0.68, each=110, flags=[HIGH_FODMAP]),
    _i('green_onion', 'Green onion', 'produce', ['green onion', 'scallion', 'spring onion', 'chive', 'green onion top',
                                                 'onion top'],
       (32, 1.8, 7.3, 0.2, 0, 2.6, 2.3, 16, 0), density=0.42, each=15, parent='onion'),
    _i('shallot', 'Shallot', 'produce', ['shallot', 'leek'],
       (72, 2.5, 16.8, 0.1, 0, 3.2, 7.9, 12, 0), density=0.68, each=40, parent='onion', flags=[HIGH_FODMAP]),
    _i('garlic', 'Garlic', 'produce', ['garlic', 'garlic clove', 'clove garlic', 'minced garlic', 'garlic bud',
                                       'chopped garlic', 'bulb garlic', 'head garlic', 'jarred garlic'],
       (149, 6.4, 33, 0.5, 0.1, 2.1, 1, 17, 0), density=0.58, each=3, flags=[HIGH_FODMAP]),
    _i('tomato', 'Tomato', 'produce', ['tomato', 'fresh tomato', 'diced tomato', 'chopped tomato', 'stewed tomato',
                                       'crushed tomato', 'whole tomato', 'peeled tomato', 'plum tomato', 'roma tomato',
                                       'beefsteak tomato', 'canned tomato', 'tomato wedge', 'rotel', 'ro tel', 'ro-tel',
                                       'tomato with green chile', 'tomato and green chile', 'italian tomato',
                                       'petite diced tomato', 'fire roasted tomato', 'heirloom tomato', 'vine ripe tomato'],
       (18, 0.9, 3.9, 0.2, 0, 1.2, 2.6, 5, 0), density=0.76, each=123, allergens=[NIGHT], flags=[GERD_TRIGGER]),
    _i('cherry_tomato', 'Cherry tomato', 'produce', ['cherry tomato', 'grape tomato'],
       (18, 0.9, 3.9, 0.2, 0, 1.2, 2.6, 5, 0), density=0.6, each=17, parent='tomato', allergens=[NIGHT], flags=[GERD_TRIGGER]),
    _i('sun_dried_tomato', 'Sun-dried tomato', 'produce', ['sun dried tomato', 'sundried tomato', 'dried tomato'],
       (258, 14.1, 55.8, 3, 0.4, 12.3, 37.6, 247, 0), density=0.45, allergens=[NIGHT], may=[SULPH], flags=[GERD_TRIGGER]),
    _i('tomato_paste', 'Tomato paste', 'condiments', ['tomato paste'],
       (82, 4.3, 18.9, 0.5, 0.1, 4.1, 12.2, 100, 0), density=1.1, each=170, allergens=[NIGHT], flags=[GERD_TRIGGER]),
    _i('tomato_sauce', 'Tomato sauce', 'condiments', ['tomato sauce', 'tomato puree', 'passata', 'hunt tomato sauce'],
       (24, 1.2, 5.3, 0.3, 0, 1.5, 3.6, 474, 0), density=1.03, each=227, allergens=[NIGHT], flags=[GERD_TRIGGER]),
    _i('pasta_sauce', 'Pasta sauce', 'condiments', ['spaghetti sauce', 'marinara', 'marinara sauce', 'pasta sauce',
                                                    'pizza sauce', 'prego', 'ragu', 'meatless spaghetti sauce'],
       (50, 1.4, 8, 1.5, 0.2, 1.8, 5.5, 440, 0), density=1.05, each=680, allergens=[NIGHT],
       flags=[GERD_TRIGGER, ADDED_SUGAR, HIGH_FODMAP]),
    _i('salsa', 'Salsa', 'condiments', ['salsa', 'picante sauce', 'pico de gallo', 'chunky salsa', 'salsa verde',
                                        'enchilada sauce', 'taco sauce', 'green enchilada sauce', 'red enchilada sauce'],
       (36, 1.5, 7, 0.2, 0, 1.9, 4, 600, 0), density=1.05, each=454, allergens=[NIGHT],
       flags=[GERD_TRIGGER, SPICY, HIGH_FODMAP]),
    _i('ketchup', 'Ketchup', 'condiments', ['ketchup', 'catsup', 'chili sauce', 'cocktail sauce'],
       (101, 1, 27, 0.1, 0, 0.3, 22.8, 907, 0), density=1.15, allergens=[NIGHT],
       flags=[GERD_TRIGGER, ADDED_SUGAR, REFINED_SUGAR, HIGH_FODMAP]),
    _i('bell_pepper', 'Bell pepper', 'produce', ['bell pepper', 'green pepper', 'red pepper', 'yellow pepper', 'orange pepper',
                                                 'sweet pepper', 'green bell pepper', 'red bell pepper', 'pimento', 'pimiento',
                                                 'roasted red pepper', 'mixed pepper', 'pepper strip'],
       (26, 1, 6, 0.3, 0, 2.1, 4.2, 4, 0), density=0.62, each=120, allergens=[NIGHT]),
    _i('chili_pepper', 'Chili pepper', 'produce', ['jalapeno', 'jalapeno pepper', 'serrano', 'serrano pepper',
                                                   'habanero', 'chili pepper', 'chile pepper', 'hot pepper', 'green chile',
                                                   'green chili', 'diced green chile', 'chopped green chile', 'chile',
                                                   'thai chili',
                                                   'chipotle', 'chipotle pepper', 'chipotle in adobo', 'banana pepper',
                                                   'pepperoncini', 'cherry pepper'],
       (29, 0.9, 6.5, 0.4, 0, 2.8, 4.1, 3, 0), density=0.55, each=14, allergens=[NIGHT], flags=[SPICY, GERD_TRIGGER]),
    _i('tomatillo', 'Tomatillo', 'produce', ['tomatillo', 'husk tomato'],
       (32, 1, 5.8, 1, 0.1, 1.9, 3.9, 1, 0), density=0.6, each=34, allergens=[NIGHT]),
    _i('hominy', 'Hominy', 'produce', ['hominy', 'canned hominy', 'white hominy', 'yellow hominy', 'posole'],
       (72, 1.5, 14.3, 0.9, 0.1, 2.5, 0, 210, 0), density=0.68, each=425, allergens=[CORN], flags=[STARCHY_VEG]),
    _i('poblano', 'Poblano pepper', 'produce', ['poblano', 'poblano pepper', 'anaheim pepper', 'anaheim chile',
                                                'pasilla pepper'],
       (20, 0.9, 4.6, 0.2, 0, 1.7, 2.4, 3, 0), density=0.55, each=120, parent='chili_pepper', allergens=[NIGHT]),
    _i('potato', 'Potato', 'produce', ['potato', 'russet potato', 'baking potato', 'red potato', 'new potato',
                                       'yukon gold potato', 'white potato', 'gold potato', 'fingerling potato',
                                       'idaho potato', 'hash brown', 'hash brown potato', 'frozen hash brown', 'tater tot',
                                       'french fry', 'mashed potato', 'instant potato', 'potato flake', 'baby potato'],
       (77, 2, 17.5, 0.1, 0, 2.2, 0.8, 6, 0), density=0.64, each=213, allergens=[NIGHT], flags=[STARCHY_VEG]),
    _i('sweet_potato', 'Sweet potato', 'produce', ['sweet potato', 'yam', 'canned yam'],
       (86, 1.6, 20, 0.1, 0, 3, 4.2, 55, 0), density=0.64, each=130, flags=[STARCHY_VEG]),
    _i('carrot', 'Carrot', 'produce', ['carrot', 'baby carrot', 'shredded carrot', 'grated carrot', 'carrot stick'],
       (41, 0.9, 9.6, 0.2, 0, 2.8, 4.7, 69, 0), density=0.54, each=61),
    _i('celery', 'Celery', 'produce', ['celery', 'celery stalk', 'celery rib', 'rib celery', 'stalk celery', 'celery heart',
                                       'celeriac'],
       (14, 0.7, 3, 0.2, 0, 1.6, 1.3, 80, 0), density=0.5, each=40, allergens=[CELERY]),
    _i('broccoli', 'Broccoli', 'produce', ['broccoli', 'broccoli floret', 'broccoli crown', 'chopped broccoli', 'broccolini'],
       (34, 2.8, 6.6, 0.4, 0, 2.6, 1.7, 33, 0), density=0.38, each=300),
    _i('cauliflower', 'Cauliflower', 'produce', ['cauliflower', 'cauliflower floret', 'cauliflower rice', 'riced cauliflower'],
       (25, 1.9, 5, 0.3, 0.1, 2, 1.9, 30, 0), density=0.45, each=575, flags=[HIGH_FODMAP]),
    _i('spinach', 'Spinach', 'produce', ['spinach', 'baby spinach', 'fresh spinach', 'frozen spinach', 'chopped spinach',
                                         'spinach leaf'],
       (23, 2.9, 3.6, 0.4, 0.1, 2.2, 0.4, 79, 0), density=0.13),
    _i('kale', 'Kale', 'produce', ['kale', 'collard', 'collard green', 'swiss chard', 'chard', 'mustard green', 'turnip green',
                                   'green', 'bok choy', 'baby bok choy'],
       (35, 2.9, 4.4, 1.5, 0.2, 4.1, 1, 53, 0), density=0.1, each=200),
    _i('lettuce', 'Lettuce', 'produce', ['lettuce', 'romaine', 'romaine lettuce', 'iceberg lettuce', 'iceberg', 'leaf lettuce',
                                         'mixed green', 'salad green', 'spring mix', 'arugula', 'butter lettuce',
                                         'shredded lettuce', 'head lettuce', 'watercress', 'endive', 'radicchio',
                                         'frisee', 'escarole', 'mesclun'],
       (15, 1.4, 2.9, 0.2, 0, 1.3, 0.8, 28, 0), density=0.2, each=600),
    _i('cabbage', 'Cabbage', 'produce', ['cabbage', 'green cabbage', 'red cabbage', 'napa cabbage', 'coleslaw mix',
                                         'shredded cabbage', 'sauerkraut', 'slaw mix'],
       (25, 1.3, 5.8, 0.1, 0, 2.5, 3.2, 18, 0), density=0.3, each=900),
    _i('cucumber', 'Cucumber', 'produce', ['cucumber', 'english cucumber', 'pickling cucumber'],
       (15, 0.7, 3.6, 0.1, 0, 0.5, 1.7, 2, 0), density=0.55, each=300),
    _i('pickle', 'Pickle', 'condiments', ['pickle', 'dill pickle', 'sweet pickle', 'pickle relish', 'relish', 'sweet relish',
                                          'gherkin', 'dill relish'],
       (20, 0.5, 4, 0.2, 0, 1, 2, 1200, 0), density=0.9, each=35, may=[SULPH, MUSTARD]),
    _i('zucchini', 'Zucchini', 'produce', ['zucchini', 'courgette', 'summer squash', 'yellow squash', 'zucchini noodle',
                                           'zoodle', 'squash'],
       (17, 1.2, 3.1, 0.3, 0.1, 1, 2.5, 8, 0), density=0.53, each=196),
    _i('winter_squash', 'Winter squash', 'produce', ['butternut squash', 'acorn squash', 'spaghetti squash', 'pumpkin',
                                                     'pumpkin puree', 'canned pumpkin', 'solid pack pumpkin'],
       (40, 1, 10, 0.1, 0, 2.5, 3, 4, 0), density=0.9, each=1000),
    _i('mushroom', 'Mushroom', 'produce', ['mushroom', 'button mushroom', 'white mushroom', 'cremini', 'baby bella',
                                           'portobello', 'portabella', 'shiitake', 'sliced mushroom', 'mushroom cap',
                                           'fresh mushroom', 'canned mushroom', 'mushroom stem and piece'],
       (22, 3.1, 3.3, 0.3, 0, 1, 2, 5, 0), density=0.3, each=18, flags=[HIGH_FODMAP]),
    _i('green_beans', 'Green beans', 'produce', ['green bean', 'string bean', 'snap bean', 'french cut green bean',
                                                 'wax bean', 'haricot vert'],
       (31, 1.8, 7, 0.2, 0, 2.7, 3.3, 6, 0), density=0.46, each=400),
    _i('peas', 'Peas', 'produce', ['pea', 'green pea', 'sweet pea', 'frozen pea', 'english pea', 'snow pea', 'sugar snap pea',
                                   'snap pea', 'peas and carrot', 'mixed vegetable', 'frozen mixed vegetable',
                                   'vegetable', 'stir fry vegetable', 'frozen vegetable'],
       (81, 5.4, 14.5, 0.4, 0.1, 5.1, 5.7, 5, 0), density=0.6, flags=[LEGUME, HIGH_FODMAP]),
    _i('corn', 'Corn', 'produce', ['corn', 'whole kernel corn', 'sweet corn', 'corn kernel', 'frozen corn', 'creamed corn',
                                   'cream style corn', 'corn on the cob', 'ear corn', 'niblet', 'shoepeg corn'],
       (86, 3.3, 19, 1.4, 0.3, 2, 6.3, 15, 0), density=0.64, each=90, allergens=[CORN], flags=[STARCHY_VEG, HIGH_FODMAP]),
    _i('artichoke', 'Artichoke', 'produce', ['artichoke', 'artichoke heart', 'marinated artichoke heart',
                                             'canned artichoke heart'],
       (47, 3.3, 10.5, 0.2, 0, 5.4, 1, 94, 0), density=0.7, each=120),
    _i('fennel', 'Fennel', 'produce', ['fennel', 'fennel bulb', 'fresh fennel', 'fennel frond'],
       (31, 1.2, 7.3, 0.2, 0, 3.1, 3.9, 52, 0), density=0.4, each=230, flags=[HIGH_FODMAP]),
    _i('rhubarb', 'Rhubarb', 'produce', ['rhubarb', 'fresh rhubarb', 'chopped rhubarb'],
       (21, 0.9, 4.5, 0.2, 0, 1.8, 1.1, 4, 0), density=0.5, each=50),
    _i('asparagus', 'Asparagus', 'produce', ['asparagus', 'asparagus spear', 'asparagus tip'],
       (20, 2.2, 3.9, 0.1, 0, 2.1, 1.9, 2, 0), density=0.54, each=16, flags=[HIGH_FODMAP]),
    _i('eggplant', 'Eggplant', 'produce', ['eggplant', 'aubergine'],
       (25, 1, 5.9, 0.2, 0, 3, 3.5, 2, 0), density=0.35, each=458, allergens=[NIGHT]),
    _i('avocado', 'Avocado', 'produce', ['avocado', 'haas avocado', 'hass avocado', 'guacamole'],
       (160, 2, 8.5, 14.7, 2.1, 6.7, 0.7, 7, 0), density=0.95, each=150, flags=[HIGH_FODMAP]),
    _i('olives', 'Olives', 'condiments', ['olive', 'black olive', 'ripe olive', 'kalamata olive', 'green olive',
                                          'stuffed olive', 'sliced olive', 'pimento stuffed olive'],
       (116, 0.8, 6, 10.9, 1.4, 3.2, 0, 735, 0), density=0.6, each=4),
    _i('beet', 'Beet', 'produce', ['beet', 'beetroot', 'turnip', 'parsnip', 'radish', 'rutabaga'],
       (43, 1.6, 9.6, 0.2, 0, 2.8, 6.8, 78, 0), density=0.6, each=82),
    _i('bean_sprouts', 'Bean sprouts', 'produce', ['bean sprout', 'mung bean sprout', 'sprout', 'alfalfa sprout',
                                                   'water chestnut', 'bamboo shoot'],
       (30, 3, 5.9, 0.2, 0, 1.8, 4.1, 6, 0), density=0.5),

    # =================================================================
    # FRUIT
    # =================================================================
    _i('lemon', 'Lemon', 'produce', ['lemon', 'lemon zest', 'lemon rind', 'grated lemon peel', 'lemon peel', 'lemon slice',
                                     'lemon wedge'],
       (29, 1.1, 9.3, 0.3, 0, 2.8, 2.5, 2, 0), density=0.6, each=58, flags=[GERD_TRIGGER]),
    _i('lemon_juice', 'Lemon juice', 'produce', ['lemon juice', 'fresh lemon juice', 'realemon'],
       (22, 0.4, 6.9, 0.2, 0, 0.3, 2.5, 1, 0), density=1.03, each=48, parent='lemon', may=[SULPH], flags=[GERD_TRIGGER]),
    _i('lime', 'Lime', 'produce', ['lime', 'lime zest', 'lime wedge', 'key lime', 'grated lime peel'],
       (30, 0.7, 10.5, 0.2, 0, 2.8, 1.7, 2, 0), density=0.6, each=67, flags=[GERD_TRIGGER]),
    _i('lime_juice', 'Lime juice', 'produce', ['lime juice', 'fresh lime juice', 'key lime juice'],
       (25, 0.4, 8.4, 0.1, 0, 0.4, 1.7, 2, 0), density=1.03, each=30, parent='lime', flags=[GERD_TRIGGER]),
    _i('orange', 'Orange', 'produce', ['orange', 'navel orange', 'mandarin orange', 'mandarin', 'tangerine', 'clementine',
                                       'orange zest', 'orange peel', 'grapefruit'],
       (47, 0.9, 11.8, 0.1, 0, 2.4, 9.4, 0, 0), density=0.7, each=131, flags=[GERD_TRIGGER]),
    _i('orange_juice', 'Orange juice', 'beverages', ['orange juice', 'frozen orange juice concentrate', 'orange juice concentrate',
                                                     'oj'],
       (45, 0.7, 10.4, 0.2, 0, 0.2, 8.4, 1, 0), density=1.04, parent='orange', flags=[GERD_TRIGGER]),
    _i('apple', 'Apple', 'produce', ['apple', 'granny smith apple', 'tart apple', 'cooking apple', 'red delicious apple',
                                     'gala apple', 'honeycrisp apple', 'applesauce', 'apple sauce', 'unsweetened applesauce'],
       (52, 0.3, 13.8, 0.2, 0, 2.4, 10.4, 1, 0), density=0.55, each=182, flags=[HIGH_FODMAP]),
    _i('apple_juice', 'Apple juice', 'beverages', ['apple juice', 'apple cider', 'cider'],
       (46, 0.1, 11.3, 0.1, 0, 0.2, 9.6, 4, 0), density=1.04, parent='apple', flags=[HIGH_FODMAP]),
    _i('banana', 'Banana', 'produce', ['banana', 'ripe banana', 'mashed banana', 'overripe banana'],
       (89, 1.1, 22.8, 0.3, 0.1, 2.6, 12.2, 1, 0), density=0.95, each=118),
    _i('pineapple', 'Pineapple', 'produce', ['pineapple', 'crushed pineapple', 'pineapple chunk', 'pineapple tidbit',
                                             'pineapple ring', 'pineapple juice', 'pineapple slice'],
       (50, 0.5, 13.1, 0.1, 0, 1.4, 9.9, 1, 0), density=0.85, each=565),
    _i('berries', 'Berries', 'produce', ['berry', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'mixed berry',
                                         'cranberry', 'fresh cranberry', 'cherry', 'maraschino cherry', 'sweet cherry',
                                         'cherry pie filling', 'grape', 'kiwi', 'mango', 'peach', 'pear', 'plum',
                                         'nectarine', 'apricot', 'watermelon', 'cantaloupe', 'melon', 'fruit cocktail',
                                         'fruit'],
       (50, 0.7, 12.5, 0.3, 0, 2.2, 8.5, 1, 0), density=0.6, each=150),
    _i('raisins', 'Raisins', 'produce', ['raisin', 'golden raisin', 'dried cranberry', 'craisin', 'dried cherry',
                                         'dried apricot', 'date', 'prune', 'dried fruit', 'currant', 'fig'],
       (299, 3.1, 79, 0.5, 0.1, 3.7, 59, 11, 0), density=0.6, may=[SULPH], flags=[HIGH_FODMAP]),

    # =================================================================
    # FRESH HERBS
    # =================================================================
    _i('cilantro', 'Cilantro', 'produce', ['cilantro', 'fresh cilantro', 'coriander leaf', 'chinese parsley'],
       (23, 2.1, 3.7, 0.5, 0, 2.8, 0.9, 46, 0), density=0.07, each=50),
    _i('parsley', 'Parsley', 'produce', ['parsley', 'fresh parsley', 'flat leaf parsley', 'italian parsley', 'parsley flake',
                                         'dried parsley', 'curly parsley'],
       (36, 3, 6.3, 0.8, 0.1, 3.3, 0.9, 56, 0), density=0.1, each=60),
    _i('basil', 'Basil', 'spices', ['basil', 'fresh basil', 'basil leaf', 'dried basil', 'sweet basil', 'thai basil'],
       (23, 3.2, 2.7, 0.6, 0, 1.6, 0.3, 4, 0), density=0.1, each=0.5),
    _i('mint', 'Mint', 'produce', ['mint', 'fresh mint', 'mint leaf', 'spearmint', 'peppermint'],
       (70, 3.8, 14.9, 0.9, 0.2, 8, 0, 31, 0), density=0.1, each=0.5, flags=[GERD_TRIGGER]),
    _i('ginger', 'Ginger', 'produce', ['ginger', 'fresh ginger', 'ginger root', 'gingerroot', 'grated ginger',
                                       'minced ginger', 'crystallized ginger'],
       (80, 1.8, 17.8, 0.8, 0.2, 2, 1.7, 13, 0), density=0.4, each=15),

    # =================================================================
    # NUTS & SEEDS
    # =================================================================
    _i('nuts', 'Mixed nuts', 'nuts_seeds', ['nut', 'chopped nut', 'mixed nut', 'nutmeat', 'nut meat', 'macadamia', 'macadamia nut',
                                           'hazelnut', 'filbert', 'brazil nut'],
       (607, 20, 21, 54, 8.5, 7, 4.2, 3, 0), density=0.5, allergens=[TREE]),
    _i('almonds', 'Almonds', 'nuts_seeds', ['almond', 'sliced almond', 'slivered almond', 'blanched almond', 'toasted almond',
                                            'almond butter'],
       (579, 21.2, 21.6, 49.9, 3.8, 12.5, 4.4, 1, 0), density=0.6, parent='nuts', allergens=[TREE]),
    _i('walnuts', 'Walnuts', 'nuts_seeds', ['walnut', 'black walnut', 'english walnut', 'walnut piece', 'walnut half'],
       (654, 15.2, 13.7, 65.2, 6.1, 6.7, 2.6, 2, 0), density=0.49, parent='nuts', allergens=[TREE]),
    _i('pecans', 'Pecans', 'nuts_seeds', ['pecan', 'pecan half', 'pecan piece', 'chopped pecan'],
       (691, 9.2, 13.9, 72, 6.2, 9.6, 4, 0, 0), density=0.46, parent='nuts', allergens=[TREE]),
    _i('cashews', 'Cashews', 'nuts_seeds', ['cashew', 'cashew nut', 'raw cashew'],
       (553, 18.2, 30.2, 43.9, 7.8, 3.3, 5.9, 12, 0), density=0.58, parent='nuts', allergens=[TREE], flags=[HIGH_FODMAP]),
    _i('pistachios', 'Pistachios', 'nuts_seeds', ['pistachio'],
       (562, 20.2, 27.2, 45.3, 5.9, 10.6, 7.7, 1, 0), density=0.53, parent='nuts', allergens=[TREE], flags=[HIGH_FODMAP]),
    _i('pine_nuts', 'Pine nuts', 'nuts_seeds', ['pine nut', 'pignoli', 'pinon'],
       (673, 13.7, 13.1, 68.4, 4.9, 3.7, 3.6, 2, 0), density=0.57, parent='nuts', allergens=[TREE]),
    _i('pesto', 'Pesto', 'condiments', ['pesto', 'basil pesto', 'prepared pesto'],
       (450, 6, 6, 45, 8, 1.5, 1, 700, 10), density=1.0, allergens=[TREE, DAI], flags=[HIGH_FODMAP]),
    _i('sesame_seeds', 'Sesame seeds', 'nuts_seeds', ['sesame seed', 'toasted sesame seed', 'benne seed'],
       (573, 17.7, 23.4, 49.7, 7, 11.8, 0.3, 11, 0), density=0.6, allergens=[SESAME]),
    _i('tahini', 'Tahini', 'condiments', ['tahini', 'sesame paste', 'tahina'],
       (595, 17, 21.2, 53.8, 7.5, 9.3, 0.5, 115, 0), density=1.0, allergens=[SESAME]),
    _i('seeds', 'Seeds', 'nuts_seeds', ['sunflower seed', 'pumpkin seed', 'pepita', 'chia seed', 'flaxseed', 'flax seed',
                                        'ground flaxseed', 'flax meal', 'hemp seed', 'poppy seed'],
       (534, 20, 28, 45, 4.5, 20, 1.5, 15, 0), density=0.55),
    _i('coconut', 'Coconut', 'nuts_seeds', ['coconut', 'shredded coconut', 'flaked coconut', 'coconut flake',
                                            'angel flake coconut', 'sweetened coconut', 'desiccated coconut',
                                            'unsweetened coconut'],
       (456, 3.1, 51.9, 27.8, 24.7, 4.5, 45.6, 262, 0), density=0.35, allergens=[COCO], flags=[ADDED_SUGAR]),

    # =================================================================
    # OILS & FATS
    # =================================================================
    _i('olive_oil', 'Olive oil', 'oils', ['olive oil', 'extra virgin olive oil', 'evoo', 'light olive oil'],
       (884, 0, 0, 100, 13.8, 0, 0, 2, 0), density=0.92),
    _i('vegetable_oil', 'Vegetable oil', 'oils', ['oil', 'vegetable oil', 'canola oil', 'salad oil', 'cooking oil',
                                                  'wesson oil', 'safflower oil', 'sunflower oil', 'grapeseed oil',
                                                  'peanut oil', 'frying oil', 'oil for frying', 'crisco oil'],
       (884, 0, 0, 100, 7.4, 0, 0, 0, 0), density=0.92, flags=[SEED_OIL]),
    _i('corn_oil', 'Corn oil', 'oils', ['corn oil', 'mazola'],
       (884, 0, 0, 100, 13, 0, 0, 0, 0), density=0.92, parent='vegetable_oil', may=[CORN], flags=[SEED_OIL]),
    _i('coconut_oil', 'Coconut oil', 'oils', ['coconut oil'],
       (862, 0, 0, 100, 82.5, 0, 0, 0, 0), density=0.92, allergens=[COCO]),
    _i('sesame_oil', 'Sesame oil', 'oils', ['sesame oil', 'toasted sesame oil', 'dark sesame oil'],
       (884, 0, 0, 100, 14.2, 0, 0, 0, 0), density=0.92, allergens=[SESAME]),
    _i('shortening', 'Shortening', 'oils', ['shortening', 'crisco', 'vegetable shortening', 'solid shortening',
                                            'butter flavored crisco'],
       (884, 0, 0, 100, 25, 0, 0, 0, 0), density=0.82, each=113, may=[SOY], flags=[SEED_OIL, PROCESSED]),
    _i('lard', 'Lard', 'oils', ['lard', 'bacon drippings', 'bacon grease', 'bacon fat', 'beef tallow', 'drippings'],
       (902, 0, 0, 100, 39, 0, 0, 0, 95), density=0.92, flags=[PORK]),
    _i('cooking_spray', 'Cooking spray', 'oils', ['cooking spray', 'nonstick cooking spray', 'nonstick spray', 'pam',
                                                  'vegetable cooking spray', 'vegetable spray'],
       (0, 0, 0, 0, 0, 0, 0, 0, 0), staple=True),

    # =================================================================
    # SWEETENERS & BAKING
    # =================================================================
    _i('sugar', 'Sugar', 'sweeteners', ['sugar', 'white sugar', 'granulated sugar', 'cane sugar', 'superfine sugar',
                                        'caster sugar', 'raw sugar', 'turbinado sugar', 'sugar substitute'],
       (387, 0, 100, 0, 0, 0, 100, 1, 0), density=0.85, flags=[ADDED_SUGAR, REFINED_SUGAR]),
    _i('brown_sugar', 'Brown sugar', 'sweeteners', ['brown sugar', 'light brown sugar', 'dark brown sugar',
                                                    'packed brown sugar', 'firmly packed brown sugar'],
       (380, 0.1, 98, 0, 0, 0, 97, 28, 0), density=0.93, parent='sugar', flags=[ADDED_SUGAR, REFINED_SUGAR]),
    _i('powdered_sugar', 'Powdered sugar', 'sweeteners', ['powdered sugar', 'confectioners sugar', 'icing sugar',
                                                          'confectioner sugar', '10x sugar', 'xxxx sugar'],
       (389, 0, 99.8, 0, 0, 0, 97.8, 2, 0), density=0.5, parent='sugar', may=[CORN], flags=[ADDED_SUGAR, REFINED_SUGAR]),
    _i('honey', 'Honey', 'sweeteners', ['honey', 'raw honey', 'clover honey'],
       (304, 0.3, 82.4, 0, 0, 0.2, 82.1, 4, 0), density=1.42, flags=[HONEY, ADDED_SUGAR, HIGH_FODMAP]),
    _i('maple_syrup', 'Maple syrup', 'sweeteners', ['maple syrup', 'pure maple syrup', 'pancake syrup', 'syrup',
                                                    'agave', 'agave nectar'],
       (260, 0, 67, 0.1, 0, 0, 60, 12, 0), density=1.32, flags=[ADDED_SUGAR]),
    _i('corn_syrup', 'Corn syrup', 'sweeteners', ['corn syrup', 'light corn syrup', 'dark corn syrup', 'karo',
                                                  'karo syrup', 'high fructose corn syrup'],
       (286, 0, 77.6, 0, 0, 0, 77.6, 62, 0), density=1.38, allergens=[CORN],
       flags=[ADDED_SUGAR, REFINED_SUGAR, PROCESSED, HIGH_FODMAP]),
    _i('molasses', 'Molasses', 'sweeteners', ['molasses', 'blackstrap molasses', 'sorghum'],
       (290, 0, 74.7, 0.1, 0, 0, 74.7, 37, 0), density=1.4, may=[SULPH], flags=[ADDED_SUGAR]),
    _i('chocolate', 'Chocolate', 'sweeteners', ['chocolate', 'chocolate chip', 'semisweet chocolate chip',
                                                'semi sweet chocolate chip', 'semisweet chocolate', 'milk chocolate',
                                                'bittersweet chocolate', 'dark chocolate', 'unsweetened chocolate',
                                                'baking chocolate', 'white chocolate', 'chocolate square', 'chocolate bar',
                                                'mini chocolate chip', 'butterscotch chip', 'butterscotch morsel',
                                                'peanut butter chip', 'peanut butter morsel', 'chocolate morsel',
                                                'candy bar', 'm and m', 'chocolate candy'],
       (479, 4.2, 63.9, 30, 17.8, 5.9, 54.5, 11, 0), density=0.72, may=[DAI, SOY, TREE, PEANUT],
       flags=[ADDED_SUGAR, REFINED_SUGAR, GERD_TRIGGER]),
    _i('caramel', 'Caramels', 'sweeteners', ['caramel', 'caramels', 'kraft caramel', 'caramel candy', 'toffee',
                                             'toffee bit', 'heath bit', 'caramel bit', 'caramel sauce', 'dulce de leche'],
       (382, 4.6, 77, 8.1, 6.5, 0, 65, 245, 7), density=0.8, each=10, allergens=[DAI], may=[SOY, CORN],
       flags=[ADDED_SUGAR, REFINED_SUGAR, PROCESSED]),
    _i('cake', 'Cake', 'baking', ['angel food cake', 'pound cake', 'sponge cake', 'ladyfinger', 'lady finger',
                                  'yellow cake', 'white cake', 'chocolate cake', 'cake cube'],
       (258, 5.9, 58, 0.8, 0.1, 1.5, 36, 626, 0), density=0.3, each=300, allergens=WG + (EGG_A,), may=[DAI, SOY],
       flags=[GRAIN, REFINED_GRAIN, ADDED_SUGAR, REFINED_SUGAR, PROCESSED]),
    _i('drink_mix', 'Drink mix', 'beverages', ['tang', 'kool aid', 'kool-aid', 'drink mix', 'lemonade mix',
                                               'powdered drink mix', 'instant tea', 'iced tea mix', 'crystal light'],
       (390, 0, 97, 0, 0, 0, 90, 50, 0), density=0.9, each=20, may=[CORN],
       flags=[ADDED_SUGAR, REFINED_SUGAR, PROCESSED]),
    _i('cocoa', 'Cocoa powder', 'baking', ['cocoa', 'cocoa powder', 'unsweetened cocoa', 'baking cocoa', 'dutch process cocoa'],
       (228, 19.6, 57.9, 13.7, 8.1, 37, 1.8, 21, 0), density=0.36, flags=[GERD_TRIGGER]),
    _i('marshmallow', 'Marshmallows', 'sweeteners', ['marshmallow', 'mini marshmallow', 'miniature marshmallow',
                                                     'marshmallow creme', 'marshmallow fluff', 'marshmallow cream'],
       (318, 1.8, 81, 0.2, 0, 0.1, 57.6, 80, 0), density=0.2, each=7, may=[CORN],
       flags=[GELATIN, ADDED_SUGAR, REFINED_SUGAR, PROCESSED], allergens=[AGAL]),
    _i('gelatin', 'Gelatin', 'baking', ['gelatin', 'unflavored gelatin', 'knox gelatin', 'jello', 'jell o', 'jell-o',
                                        'flavored gelatin', 'gelatin dessert', 'strawberry jello', 'lemon jello',
                                        'lime jello'],
       (335, 7.8, 90, 0, 0, 0, 86, 466, 0), density=0.8, each=85, flags=[GELATIN, ADDED_SUGAR, REFINED_SUGAR, PROCESSED],
       allergens=[AGAL]),
    _i('pudding_mix', 'Instant pudding mix', 'baking', ['instant pudding', 'pudding mix', 'instant pudding mix',
                                                        'vanilla pudding', 'chocolate pudding', 'jello pudding'],
       (376, 0.5, 91, 0.5, 0.3, 1, 78, 1500, 0), each=96, may=[DAI, CORN], flags=[ADDED_SUGAR, REFINED_SUGAR, PROCESSED]),
    _i('vanilla', 'Vanilla extract', 'baking', ['vanilla', 'vanilla extract', 'pure vanilla', 'imitation vanilla',
                                                'vanilla flavoring', 'lemon extract', 'maple flavoring', 'rum extract',
                                                'peppermint extract'],
       (288, 0.1, 12.7, 0.1, 0, 0, 12.7, 9, 0), density=0.88),
    _i('almond_extract', 'Almond extract', 'baking', ['almond extract', 'almond flavoring'],
       (288, 0, 12.7, 0, 0, 0, 12.7, 9, 0), density=0.88, may=[TREE]),
    _i('baking_powder', 'Baking powder', 'baking', ['baking powder', 'double acting baking powder'],
       (53, 0, 27.7, 0, 0, 0.2, 0, 10600, 0), density=0.9, may=[CORN], staple=True),
    _i('baking_soda', 'Baking soda', 'baking', ['baking soda', 'soda', 'bicarbonate of soda', 'bicarbonate soda'],
       (0, 0, 0, 0, 0, 0, 0, 27360, 0), density=0.92, staple=True),
    _i('yeast', 'Yeast', 'baking', ['yeast', 'active dry yeast', 'dry yeast', 'instant yeast', 'rapid rise yeast',
                                    'yeast cake', 'quick rise yeast'],
       (325, 40, 41, 7.6, 1, 27, 0, 51, 0), density=0.6, each=7),
    _i('nutritional_yeast', 'Nutritional yeast', 'pantry', ['nutritional yeast', 'nooch'],
       (390, 50, 36, 4, 0.5, 20, 0, 50, 0), density=0.25),
    _i('food_coloring', 'Food coloring', 'baking', ['food coloring', 'food color', 'red food coloring', 'green food coloring',
                                                    'sprinkle', 'jimmies'],
       (0, 0, 0, 0, 0, 0, 0, 0, 0), density=1.0, staple=True),

    # =================================================================
    # SALT, PEPPER, WATER (staples)
    # =================================================================
    _i('salt', 'Salt', 'spices', ['salt', 'kosher salt', 'sea salt', 'table salt', 'salt and pepper', 'seasoned salt',
                                  'season salt', 'lawry', 'lawry seasoned salt', 'onion salt', 'celery salt', 'coarse salt',
                                  'iodized salt', 'pickling salt', 'rock salt', 'flaky salt'],
       (0, 0, 0, 0, 0, 0, 0, 38758, 0), density=1.2, staple=True),
    _i('black_pepper', 'Black pepper', 'spices', ['pepper', 'black pepper', 'ground pepper', 'ground black pepper',
                                                  'white pepper', 'cracked pepper', 'peppercorn', 'fresh ground pepper',
                                                  'lemon pepper', 'coarse ground pepper', 'freshly ground black pepper'],
       (251, 10.4, 64, 3.3, 1.4, 25.3, 0.6, 20, 0), density=0.46, staple=True),
    _i('water', 'Water', 'beverages', ['water', 'hot water', 'cold water', 'boiling water', 'warm water', 'ice water', 'ice',
                                       'ice cube', 'lukewarm water', 'tap water'],
       (0, 0, 0, 0, 0, 0, 0, 0, 0), density=1.0, staple=True),

    # =================================================================
    # DRIED SPICES & SEASONING BLENDS
    # =================================================================
    _i('garlic_powder', 'Garlic powder', 'spices', ['garlic powder', 'granulated garlic', 'garlic salt', 'dried garlic'],
       (331, 16.6, 72.7, 0.7, 0.2, 9, 2.4, 60, 0), density=0.52, parent='garlic', flags=[HIGH_FODMAP]),
    _i('onion_powder', 'Onion powder', 'spices', ['onion powder', 'granulated onion'],
       (341, 10.4, 79, 1, 0.2, 15.2, 6.6, 73, 0), density=0.5, parent='onion', flags=[HIGH_FODMAP]),
    _i('onion_soup_mix', 'Onion soup mix', 'spices', ['onion soup mix', 'dry onion soup mix', 'lipton onion soup mix',
                                                      'onion soup', 'french onion soup', 'dry onion soup'],
       (293, 7.5, 60, 1.5, 0.5, 5, 10, 13000, 0), density=0.5, each=28, may=[WHEAT, GLUTEN, SOY, CELERY, CORN, DAI],
       flags=[PROCESSED, HIGH_FODMAP]),
    _i('chili_powder', 'Chili powder', 'spices', ['chili powder', 'chile powder', 'ancho chili powder', 'chili seasoning'],
       (282, 13.5, 50, 14.3, 2.5, 34.8, 7.2, 1010, 0), density=0.5, allergens=[NIGHT], flags=[SPICY, GERD_TRIGGER]),
    _i('cayenne', 'Cayenne pepper', 'spices', ['cayenne', 'cayenne pepper', 'red pepper flake', 'crushed red pepper',
                                               'crushed red pepper flake', 'ground red pepper', 'chili flake',
                                               'chipotle powder'],
       (318, 12, 56.6, 17.3, 3.3, 27.2, 10.3, 30, 0), density=0.45, allergens=[NIGHT], flags=[SPICY, GERD_TRIGGER]),
    _i('paprika', 'Paprika', 'spices', ['paprika', 'smoked paprika', 'sweet paprika', 'hungarian paprika'],
       (282, 14.1, 54, 12.9, 2.1, 34.9, 10.3, 68, 0), density=0.46, allergens=[NIGHT]),
    _i('hot_sauce', 'Hot sauce', 'condiments', ['hot sauce', 'tabasco', 'tabasco sauce', 'hot pepper sauce', 'louisiana hot sauce',
                                                'frank red hot', 'red hot sauce', 'buffalo sauce', 'wing sauce', 'sriracha',
                                                'chili garlic sauce', 'sambal'],
       (12, 0.5, 1.8, 0.4, 0, 0.3, 1.3, 2643, 0), density=1.0, allergens=[NIGHT], flags=[SPICY, GERD_TRIGGER]),
    _i('cumin', 'Cumin', 'spices', ['cumin', 'ground cumin', 'cumin seed'],
       (375, 17.8, 44, 22, 1.5, 10.5, 2.3, 168, 0), density=0.4),
    _i('oregano', 'Oregano', 'spices', ['oregano', 'dried oregano', 'oregano leaf', 'marjoram'],
       (265, 9, 69, 4.3, 1.6, 42.5, 4.1, 25, 0), density=0.2),
    _i('italian_seasoning', 'Italian seasoning', 'spices', ['italian seasoning', 'herbes de provence', 'mixed herb',
                                                            'dried herb', 'poultry seasoning', 'herb'],
       (265, 9, 64, 4, 1.5, 38, 3, 40, 0), density=0.2),
    _i('thyme', 'Thyme', 'spices', ['thyme', 'dried thyme', 'fresh thyme', 'thyme leaf', 'rosemary', 'fresh rosemary',
                                    'dried rosemary', 'sage', 'rubbed sage', 'ground sage', 'fresh sage', 'tarragon', 'dill',
                                    'dill weed', 'fresh dill', 'dried dill', 'savory', 'bay leaf', 'bay leave'],
       (276, 9.1, 63.9, 7.4, 2.7, 37, 1.7, 55, 0), density=0.2, each=0.2),
    _i('cinnamon', 'Cinnamon', 'spices', ['cinnamon', 'ground cinnamon', 'cinnamon stick', 'pumpkin pie spice',
                                          'apple pie spice'],
       (247, 4, 80.6, 1.2, 0.3, 53, 2.2, 10, 0), density=0.52, each=3),
    _i('baking_spices', 'Warm spices', 'spices', ['nutmeg', 'ground nutmeg', 'cloves', 'ground clove', 'whole clove', 'allspice',
                                                  'ground allspice', 'ground ginger', 'cardamom', 'mace', 'anise',
                                                  'star anise', 'fennel seed', 'caraway seed', 'coriander', 'ground coriander',
                                                  'turmeric', 'celery seed', 'saffron', 'saffron thread', 'sumac',
                                                  'za atar', 'five spice powder', 'chinese five spice'],
       (400, 7, 60, 20, 5, 25, 3, 30, 0), density=0.45, may=[CELERY]),
    _i('curry_powder', 'Curry powder', 'spices', ['curry powder', 'curry', 'garam masala', 'tandoori masala',
                                                  'madras curry powder'],
       (325, 14.3, 55.8, 14, 2.2, 53.2, 2.8, 52, 0), density=0.4, may=[MUSTARD, CELERY],
       flags=[SPICY, GERD_TRIGGER]),
    # Thai curry pastes commonly contain shrimp paste and fish sauce.
    _i('curry_paste', 'Curry paste', 'condiments', ['curry paste', 'red curry paste', 'green curry paste',
                                                    'yellow curry paste', 'massaman curry paste', 'panang curry paste'],
       (120, 2.5, 15, 5, 0.5, 5, 5, 3000, 0), density=1.1, may=[SHELL, FISH, MUSTARD, CELERY],
       flags=[SPICY, GERD_TRIGGER]),
    _i('mustard_seed', 'Mustard powder', 'spices', ['dry mustard', 'mustard powder', 'ground mustard', 'mustard seed',
                                                    'dry mustard powder'],
       (508, 26, 28, 36, 2, 12, 6.8, 13, 0), density=0.4, allergens=[MUSTARD]),
    _i('taco_seasoning', 'Taco seasoning', 'spices', ['taco seasoning', 'taco seasoning mix', 'fajita seasoning',
                                                      'cajun seasoning', 'creole seasoning', 'old bay', 'old bay seasoning',
                                                      'blackening seasoning', 'jerk seasoning', 'steak seasoning',
                                                      'mrs dash', 'adobo seasoning', 'greek seasoning', 'bbq rub', 'dry rub'],
       (320, 6, 55, 7, 1, 12, 8, 7500, 0), density=0.5, each=28, allergens=[NIGHT], may=[WHEAT, GLUTEN, CORN, CELERY, MUSTARD],
       flags=[SPICY]),
    _i('ranch_mix', 'Ranch seasoning mix', 'spices', ['ranch dressing mix', 'ranch mix', 'ranch seasoning',
                                                      'hidden valley ranch', 'dry ranch dressing mix',
                                                      'italian dressing mix', 'good seasons italian dressing mix'],
       (300, 7, 58, 3, 1, 1, 6, 11000, 10), density=0.5, each=28, allergens=[DAI], may=[EGG_A, SOY, MUSTARD],
       flags=[PROCESSED, HIGH_FODMAP]),
    _i('bouillon', 'Bouillon', 'pantry', ['bouillon', 'bouillon cube', 'chicken bouillon', 'beef bouillon',
                                          'chicken bouillon granule', 'beef bouillon granule', 'bouillon granule',
                                          'better than bouillon', 'soup base', 'chicken base', 'beef base'],
       (238, 17, 17, 14, 3.5, 0, 10, 24000, 10), density=0.9, each=4, may=[WHEAT, GLUTEN, SOY, CELERY, DAI, CORN],
       flags=[POULTRY, MAMMAL, PROCESSED, HIGH_FODMAP]),  # chicken OR beef — can't tell which, so assume both

    # =================================================================
    # BROTHS & CANNED SOUPS
    # =================================================================
    _i('chicken_broth', 'Chicken broth', 'pantry', ['chicken broth', 'chicken stock', 'low sodium chicken broth',
                                                    'fat free chicken broth', 'canned chicken broth', 'broth', 'stock',
                                                    'chicken consomme'],
       (7, 0.6, 0.4, 0.2, 0.1, 0, 0.2, 340, 0), density=1.0, each=411, may=[CELERY], flags=[POULTRY, HIGH_FODMAP]),
    _i('beef_broth', 'Beef broth', 'pantry', ['beef broth', 'beef stock', 'beef consomme', 'consomme', 'au jus'],
       (6, 1.1, 0.1, 0.2, 0.1, 0, 0, 300, 0), density=1.0, each=411, may=[CELERY], flags=[MAMMAL, HIGH_FODMAP]),
    _i('vegetable_broth', 'Vegetable broth', 'pantry', ['vegetable broth', 'vegetable stock', 'veggie broth',
                                                        'vegetable bouillon'],
       (6, 0.2, 1.2, 0, 0, 0, 0.5, 300, 0), density=1.0, each=411, may=[CELERY], flags=[HIGH_FODMAP]),
    _i('cream_soup', 'Condensed cream soup', 'pantry',
       ['cream of mushroom soup', 'cream of chicken soup', 'cream of celery soup', 'cream of potato soup',
        'condensed cream of mushroom soup', 'condensed cream of chicken soup', 'cream of mushroom', 'cream of chicken',
        'cream of celery', 'golden mushroom soup', 'cheddar cheese soup', 'nacho cheese soup', 'condensed soup',
        'mushroom soup', 'chicken soup', 'tomato soup', 'condensed tomato soup', 'vegetable soup', 'chicken noodle soup'],
       (80, 1.6, 8.5, 4.7, 1.4, 0.4, 1, 700, 3), density=1.05, each=298, allergens=WG + (DAI,),
       may=[SOY, CELERY, EGG_A], flags=[PROCESSED, POULTRY, HIGH_FODMAP]),  # grouped with cream of chicken: assume chicken

    # =================================================================
    # SAUCES & CONDIMENTS
    # =================================================================
    _i('capers', 'Capers', 'condiments', ['caper', 'capers', 'capote caper', 'nonpareil caper'],
       (23, 2.4, 4.9, 0.9, 0.2, 3.2, 0.4, 2348, 0), density=0.6, may=[SULPH]),
    _i('horseradish', 'Horseradish', 'condiments', ['horseradish', 'prepared horseradish', 'horseradish sauce',
                                                    'wasabi'],
       (48, 1.2, 11.3, 0.7, 0.1, 3.3, 8, 420, 0), density=1.0, may=[MUSTARD, SULPH, EGG_A]),
    _i('liquid_smoke', 'Liquid smoke', 'condiments', ['liquid smoke', 'hickory liquid smoke'],
       (12, 0, 3, 0, 0, 0, 0, 20, 0), density=1.0),
    _i('msg', 'MSG seasoning', 'spices', ['accent', 'accent seasoning', 'msg', 'monosodium glutamate',
                                          'accent flavor enhancer'],
       (0, 0, 0, 0, 0, 0, 0, 12280, 0), density=0.9),
    _i('soy_sauce', 'Soy sauce', 'condiments', ['soy sauce', 'soya sauce', 'shoyu', 'kikkoman', 'dark soy sauce',
                                                'light soy sauce'],
       (53, 8.1, 4.9, 0.6, 0.1, 0.8, 0.4, 5493, 0), density=1.15, allergens=[SOY, WHEAT, GLUTEN], flags=[LEGUME]),
    _i('low_sodium_soy_sauce', 'Low-sodium soy sauce', 'condiments', ['low sodium soy sauce', 'reduced sodium soy sauce',
                                                                      'lite soy sauce', 'less sodium soy sauce'],
       (53, 8.1, 4.9, 0.6, 0.1, 0.8, 0.4, 3333, 0), density=1.15, parent='soy_sauce', allergens=[SOY, WHEAT, GLUTEN],
       flags=[LEGUME]),
    _i('tamari', 'Tamari', 'condiments', ['tamari', 'gluten free soy sauce', 'wheat free tamari', 'miso', 'miso paste',
                                          'white miso'],
       (60, 10.5, 5.6, 0.1, 0, 0.8, 1.7, 5586, 0), density=1.15, allergens=[SOY], may=[GLUTEN, WHEAT], flags=[LEGUME]),
    _i('coconut_aminos', 'Coconut aminos', 'condiments', ['coconut aminos', 'coconut amino'],
       (60, 0, 13, 0, 0, 0, 13, 1800, 0), density=1.1, allergens=[COCO]),
    _i('teriyaki_sauce', 'Teriyaki sauce', 'condiments', ['teriyaki sauce', 'teriyaki marinade', 'teriyaki',
                                                          'stir fry sauce', 'sweet and sour sauce', 'duck sauce',
                                                          'plum sauce', 'sweet chili sauce'],
       (89, 5.9, 15.6, 0, 0, 0.1, 14.2, 3833, 0), density=1.15, allergens=[SOY, WHEAT, GLUTEN],
       flags=[ADDED_SUGAR, REFINED_SUGAR]),
    _i('hoisin', 'Hoisin sauce', 'condiments', ['hoisin', 'hoisin sauce', 'black bean sauce', 'bean paste'],
       (220, 3.3, 44, 3.4, 0.6, 2.8, 27, 1615, 0), density=1.2, allergens=[SOY, WHEAT, GLUTEN], may=[SESAME],
       flags=[ADDED_SUGAR, LEGUME, HIGH_FODMAP]),
    _i('oyster_sauce', 'Oyster sauce', 'condiments', ['oyster sauce'],
       (51, 1.4, 11, 0.3, 0, 0.3, 0, 2733, 0), density=1.2, allergens=[MOLL], may=[WHEAT, GLUTEN, SOY], flags=[SEAFOOD]),
    _i('fish_sauce', 'Fish sauce', 'condiments', ['fish sauce', 'nam pla', 'nuoc mam'],
       (35, 5, 3.6, 0, 0, 0, 3.6, 7851, 0), density=1.2, allergens=[FISH], may=[SHELL], flags=[SEAFOOD]),
    _i('worcestershire', 'Worcestershire sauce', 'condiments', ['worcestershire', 'worcestershire sauce', 'worchestershire',
                                                                'worcestershire sauce', 'a1', 'a 1 sauce', 'steak sauce'],
       (78, 0, 19.5, 0, 0, 0, 10, 980, 0), density=1.1, allergens=[FISH], may=[GLUTEN, WHEAT, SULPH],
       flags=[SEAFOOD, ADDED_SUGAR]),
    _i('mustard', 'Mustard', 'condiments', ['mustard', 'yellow mustard', 'prepared mustard', 'dijon', 'dijon mustard',
                                            'spicy brown mustard', 'brown mustard', 'stone ground mustard',
                                            'whole grain mustard', 'honey mustard', 'french mustard', 'grey poupon'],
       (60, 3.7, 5.8, 3.3, 0.2, 4, 0.9, 1104, 0), density=1.05, allergens=[MUSTARD], may=[SULPH]),
    _i('mayonnaise', 'Mayonnaise', 'condiments', ['mayonnaise', 'mayo', 'miracle whip', 'salad dressing', 'hellmann',
                                                  'light mayonnaise', 'real mayonnaise', 'aioli', 'tartar sauce'],
       (680, 1, 0.6, 75, 11.7, 0, 0.6, 635, 42), density=0.91, allergens=[EGG_A], may=[MUSTARD], flags=[SEED_OIL]),
    _i('bbq_sauce', 'Barbecue sauce', 'condiments', ['barbecue sauce', 'bbq sauce', 'barbeque sauce', 'bar b q sauce',
                                                     'hickory barbecue sauce', 'honey barbecue sauce'],
       (172, 0.8, 40.8, 0.6, 0.1, 0.9, 33, 1027, 0), density=1.1, allergens=[NIGHT], may=[MUSTARD, FISH, CORN],
       flags=[ADDED_SUGAR, REFINED_SUGAR, GERD_TRIGGER, HIGH_FODMAP]),
    _i('ranch_dressing', 'Ranch dressing', 'condiments', ['ranch dressing', 'ranch', 'blue cheese dressing',
                                                          'caesar dressing', 'thousand island dressing',
                                                          'creamy italian dressing', 'french dressing',
                                                          'catalina dressing'],
       (430, 1.3, 6, 44, 7, 0, 4.7, 900, 26), density=1.0, allergens=[EGG_A, DAI], may=[FISH, MUSTARD, SOY],
       flags=[SEED_OIL, PROCESSED]),
    _i('vinaigrette', 'Vinaigrette', 'condiments', ['italian dressing', 'vinaigrette', 'balsamic vinaigrette',
                                                    'oil and vinegar dressing', 'greek dressing', 'zesty italian dressing'],
       (240, 0.4, 10, 21, 3.3, 0, 8, 1000, 0), density=1.0, may=[SULPH, MUSTARD], flags=[SEED_OIL]),
    _i('vinegar', 'Vinegar', 'condiments', ['vinegar', 'white vinegar', 'distilled vinegar', 'cider vinegar',
                                            'apple cider vinegar', 'rice vinegar', 'rice wine vinegar', 'seasoned rice vinegar',
                                            'tarragon vinegar'],
       (21, 0, 0.9, 0, 0, 0, 0.4, 5, 0), density=1.01, may=[SULPH]),
    _i('malt_vinegar', 'Malt vinegar', 'condiments', ['malt vinegar'],   # made from barley
       (54, 0, 5.4, 0, 0, 0, 0.4, 20, 0), density=1.01, parent='vinegar', allergens=[GLUTEN]),
    _i('wine_vinegar', 'Wine vinegar', 'condiments', ['red wine vinegar', 'white wine vinegar', 'balsamic vinegar', 'balsamic',
                                                      'sherry vinegar', 'champagne vinegar', 'balsamic glaze'],
       (40, 0.3, 8, 0, 0, 0, 7, 15, 0), density=1.05, parent='vinegar', allergens=[SULPH]),
    _i('jam', 'Jam', 'sweeteners', ['jam', 'jelly', 'preserve', 'grape jelly', 'apricot preserve', 'strawberry jam',
                                    'orange marmalade', 'marmalade', 'currant jelly', 'pepper jelly', 'fruit spread',
                                    'pie filling', 'apple pie filling'],
       (278, 0.4, 69, 0.1, 0, 1, 48.5, 32, 0), density=1.33, may=[SULPH], flags=[ADDED_SUGAR, REFINED_SUGAR]),

    # =================================================================
    # ALCOHOL
    # =================================================================
    _i('wine', 'Wine', 'beverages', ['wine', 'white wine', 'red wine', 'dry white wine', 'dry red wine', 'cooking wine',
                                     'sherry', 'dry sherry', 'cooking sherry', 'marsala', 'marsala wine', 'port',
                                     'vermouth', 'champagne', 'sake', 'mirin', 'rice wine', 'burgundy', 'chablis'],
       (83, 0.1, 2.6, 0, 0, 0, 0.8, 5, 0), density=0.99, allergens=[SULPH], flags=[ALCOHOL, GERD_TRIGGER]),
    _i('beer', 'Beer', 'beverages', ['beer', 'ale', 'lager', 'stout', 'dark beer', 'light beer'],
       (43, 0.5, 3.6, 0, 0, 0, 0, 4, 0), density=1.01, each=355, allergens=[GLUTEN], may=[WHEAT],
       flags=[ALCOHOL, HIGH_PURINE, GERD_TRIGGER, GRAIN]),
    _i('liquor', 'Liquor', 'beverages', ['rum', 'vodka', 'bourbon', 'whiskey', 'whisky', 'brandy', 'tequila', 'gin',
                                         'cognac', 'liqueur', 'amaretto', 'kahlua', 'grand marnier', 'triple sec',
                                         'creme de menthe', 'schnapps', 'dark rum', 'light rum', 'irish cream'],
       (231, 0, 0, 0, 0, 0, 0, 1, 0), density=0.95, may=[TREE, DAI], flags=[ALCOHOL, GERD_TRIGGER]),
    _i('coffee', 'Coffee', 'beverages', ['coffee', 'brewed coffee', 'strong coffee', 'instant coffee', 'espresso',
                                         'espresso powder', 'instant coffee granule', 'tea', 'brewed tea', 'tea bag'],
       (2, 0.3, 0, 0, 0, 0, 0, 2, 0), density=1.0, each=240, flags=[GERD_TRIGGER]),
    _i('soda_pop', 'Soft drink', 'beverages', ['cola', 'coca cola', 'coke', 'ginger ale', 'lemon lime soda', 'sprite',
                                         '7 up', 'root beer', 'dr pepper', 'club soda', 'carbonated beverage',
                                         'lemonade', 'fruit juice', 'cranberry juice', 'grape juice'],
       (41, 0, 10.6, 0, 0, 0, 9, 4, 0), density=1.04, each=355, flags=[ADDED_SUGAR, REFINED_SUGAR, GERD_TRIGGER]),
)

CATALOG_BY_ID = {ing.id: ing for ing in CATALOG}


def validate_catalog() -> list:
    """Sanity checks run by the import script and tests. Returns a list of problems."""
    from .allergens import ALLERGEN_BY_ID
    problems = []
    seen_ids = set()
    for ing in CATALOG:
        if ing.id in seen_ids:
            problems.append(f'duplicate id {ing.id}')
        seen_ids.add(ing.id)
        if len(ing.n) != 9:
            problems.append(f'{ing.id}: nutrition needs 9 values')
        if ing.parent and ing.parent not in CATALOG_BY_ID:
            problems.append(f'{ing.id}: unknown parent {ing.parent}')
        for a in ing.allergens + ing.may:
            if a not in ALLERGEN_BY_ID:
                problems.append(f'{ing.id}: unknown allergen {a!r}')
    return problems
