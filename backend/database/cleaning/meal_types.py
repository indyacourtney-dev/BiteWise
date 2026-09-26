"""
backend/database/cleaning/meal_types.py

Sorts a recipe into the meals it suits: breakfast, brunch, lunch, dinner,
dessert. A recipe can fit several (soup is lunch AND dinner; pancakes are
breakfast AND brunch). Things that aren't a meal on their own — drinks,
sauces, dips, dressings, jams, spice rubs, plain side dishes — get an
empty list and are not suggested.

Rules look at the title first (it's the most reliable signal in this
dataset), then at the ingredients: a savory recipe with a real protein is
a main (dinner), and a sugar-heavy recipe with no meat is a dessert.
Tune the keyword lists below; tests are in tests/test_pipeline.py.
"""

import re

MEAL_TYPES = ('breakfast', 'brunch', 'lunch', 'dinner', 'dessert')


def _words(*phrases: str) -> re.Pattern:
    """Whole-word match that also accepts simple plurals ('pancake' -> 'pancakes')."""
    alts = '|'.join(re.escape(p).replace(r'\ ', r'[\s-]+') for p in phrases)
    return re.compile(rf"\b(?:{alts})(?:e?s)?\b", re.IGNORECASE)


# ---------- not a meal ----------
NOT_A_MEAL = _words(
    'punch', 'cocktail', 'lemonade', 'limeade', 'tea', 'cider', 'eggnog', 'liqueur', 'margarita', 'sangria',
    'daiquiri', 'mimosa', 'martini', 'wine cooler', 'hot chocolate', 'cocoa mix', 'sauce', 'dressing', 'marinade',
    'rub', 'seasoning', 'seasoning mix', 'gravy', 'dip', 'salsa', 'relish', 'chutney', 'jam', 'jelly', 'preserve',
    'marmalade', 'syrup', 'frosting', 'icing', 'glaze', 'pickle', 'spread', 'stock', 'broth', 'vinaigrette',
    'butter', 'mayonnaise', 'pesto', 'play dough', 'playdough', 'bird seed', 'dog treat', 'dog biscuit',
)
# Titles that contain a NOT_A_MEAL word but are meals ("Chicken with Mushroom Sauce").
MEAL_DESPITE_SAUCE = _words(
    'chicken', 'beef', 'pork', 'steak', 'shrimp', 'salmon', 'fish', 'pasta', 'spaghetti', 'meatball', 'noodle',
    'turkey', 'lamb', 'ham', 'sausage', 'tofu', 'with', 'peanut butter cookie', 'butter cookie', 'butter cake',
    'buttermilk', 'butterscotch', 'apple butter', 'butternut',
)

# ---------- dessert ----------
DESSERT = _words(
    'cake', 'cupcake', 'cookie', 'brownie', 'blondie', 'bar', 'square', 'pie', 'cobbler', 'crisp', 'crumble',
    'pudding', 'fudge', 'candy', 'truffle', 'toffee', 'brittle', 'cheesecake', 'tart', 'mousse', 'ice cream',
    'sherbet', 'sorbet', 'gelato', 'custard', 'flan', 'trifle', 'torte', 'meringue', 'macaroon', 'eclair',
    'cream puff', 'dessert', 'delight', 'dream', 'fluff', 'bonbon', 'praline', 'shortbread', 'snickerdoodle',
    'baklava', 'cannoli', 'tiramisu', 'strudel', 'dumpling', 'bread pudding', 'banana split', 'sundae',
    'popsicle', 'lollipop', 'caramel', 'marshmallow', 'rice krispie', 'haystack', 'divinity', 'no bake',
    'pound cake', 'shortcake', 'angel food', 'whoopie', 'biscotti', 'gingerbread', 'turnover', 'sweet roll',
)
# Savory dishes whose names contain dessert words.
SAVORY_EXCEPTIONS = _words(
    'pot pie', 'shepherd pie', "shepherd's pie", 'cottage pie', 'meat pie', 'pizza pie', 'tamale pie', 'taco pie',
    'chicken pie', 'pork pie', 'fish pie', 'crab cake', 'fish cake', 'salmon cake', 'potato cake', 'rice cake',
    'corn cake', 'crab bar', 'corn pudding', 'yorkshire pudding', 'bread pudding savory', 'onion tart',
    'tomato tart', 'savory', 'cheese crisp', 'pita crisp', 'chicken dumpling', 'dumpling soup', 'pork dumpling',
    'potato crisp', 'salad bar', 'granola bar', 'breakfast bar', 'protein bar', 'energy bar', 'quiche',
)

# ---------- breakfast / brunch ----------
BREAKFAST = _words(
    'pancake', 'flapjack', 'waffle', 'french toast', 'crepe', 'omelet', 'omelette', 'scrambled egg',
    'scrambled', 'fried egg', 'poached egg', 'boiled egg', 'egg bake', 'egg cup', 'egg muffin', 'breakfast',
    'granola', 'oatmeal', 'overnight oat', 'porridge', 'cereal', 'muffin', 'scone', 'biscuits and gravy',
    'biscuit and gravy', 'bagel', 'coffee cake', 'cinnamon roll', 'cinnamon bun', 'sticky bun', 'danish',
    'smoothie', 'yogurt parfait', 'parfait', 'grits', 'hash brown', 'home fries', 'hash', 'shakshuka',
    'huevos rancheros', 'chilaquiles', 'doughnut', 'donut', 'breakfast burrito', 'sausage gravy', 'eggs',
    'quick bread', 'banana bread', 'zucchini bread', 'pumpkin bread', 'breakfast casserole', 'dutch baby',
    'monkey bread', 'kolache', 'toast',
)
BRUNCH_ONLY = _words(
    'quiche', 'frittata', 'strata', 'benedict', 'brunch', 'eggs florentine', 'crab cake', 'smoked salmon',
    'lox', 'mimosa', 'bellini', 'blintz', 'souffle',
)
# Breakfast items that are really dessert-ish too.
BREAKFAST_AND_DESSERT = _words('coffee cake', 'cinnamon roll', 'doughnut', 'donut', 'danish', 'sticky bun', 'monkey bread')

# ---------- lunch ----------
LUNCH = _words(
    'sandwich', 'wrap', 'sub', 'hoagie', 'panini', 'burger', 'slider', 'salad', 'soup', 'chowder', 'bisque',
    'gazpacho', 'quesadilla', 'burrito', 'pita', 'bowl', 'melt', 'grilled cheese', 'club', 'sloppy joe',
    'hot dog', 'pizza', 'calzone', 'taco', 'lunch', 'croissant', 'po boy', "po' boy", 'gyro', 'falafel',
    'lettuce wrap', 'spring roll', 'sushi', 'poke', 'nachos', 'bento', 'pasty', 'empanada', 'chili',
    'noodle salad', 'pasta salad', 'tuna salad', 'chicken salad', 'egg salad', 'quiche',
)
# Lunch items that are also a normal dinner.
LUNCH_AND_DINNER = _words(
    'soup', 'chowder', 'bisque', 'chili', 'burger', 'taco', 'pizza', 'burrito', 'bowl', 'calzone', 'sloppy joe',
    'quesadilla', 'gyro', 'sushi', 'empanada', 'stew',
)

# ---------- dinner ----------
DINNER = _words(
    'casserole', 'bake', 'roast', 'stew', 'stir fry', 'stir-fry', 'curry', 'pasta', 'spaghetti', 'lasagna',
    'lasagne', 'enchilada', 'fajita', 'meatloaf', 'meat loaf', 'pot pie', 'skillet', 'dinner', 'chop', 'steak',
    'rib', 'brisket', 'pot roast', 'jambalaya', 'gumbo', 'paella', 'risotto', 'stroganoff', 'goulash',
    'parmesan', 'parmigiana', 'marsala', 'piccata', 'teriyaki', 'kabob', 'kebab', 'meatball', 'tetrazzini',
    'alfredo', 'carbonara', 'manicotti', 'ziti', 'cacciatore', 'fricassee', 'tagine', 'biryani', 'pad thai',
    'lo mein', 'chow mein', 'fried rice', 'mac and cheese', 'macaroni and cheese', 'shepherd pie', 'pot pie',
    'dumpling', 'noodle', 'tamale', 'barbecue', 'bbq', 'grilled', 'braised', 'fillet', 'cutlet', 'wings',
    'drumstick', 'thigh', 'breast',
)

PROTEIN_FLAGS = {'mammal', 'poultry', 'seafood'}
PROTEIN_IDS = {'egg', 'egg_white', 'tofu', 'tempeh', 'black_beans', 'kidney_beans', 'pinto_beans', 'white_beans',
               'chickpeas', 'lentils', 'refried_beans', 'chickpea_pasta'}


def classify_meal_types(title: str, ingredient_ids: set, flags: set, added_sugar_share: float) -> list:
    """
    title              recipe title
    ingredient_ids     canonical ingredient ids in the recipe
    flags              union of ingredient flags (catalog.py)
    added_sugar_share  share of calories from added sugar (0..1)
    """
    t = title.lower()
    has_meat = bool(flags & PROTEIN_FLAGS)
    has_protein = has_meat or bool(ingredient_ids & PROTEIN_IDS)
    types = set()

    savory_exception = bool(SAVORY_EXCEPTIONS.search(t))
    dessert_title = bool(DESSERT.search(t)) and not savory_exception
    very_sweet = added_sugar_share >= 0.25 and not has_meat

    # Not a meal: drinks, condiments, dips... unless the title is clearly a dish.
    if NOT_A_MEAL.search(t) and not MEAL_DESPITE_SAUCE.search(t) and not dessert_title \
            and not BREAKFAST.search(t) and not LUNCH.search(t):
        return []

    if BREAKFAST.search(t):
        types |= {'breakfast', 'brunch'}
        if BREAKFAST_AND_DESSERT.search(t):
            types.add('dessert')
    if BRUNCH_ONLY.search(t):
        types.add('brunch')

    # Sweet with no protein and not a breakfast item: a dessert even when called
    # a "salad" (the classic jello / whipped-topping salads).
    if very_sweet and not has_protein and not types:
        types.add('dessert')
        return _ordered(types)

    if dessert_title or (very_sweet and not types and not LUNCH.search(t)):
        # Muffins, sweet breads etc. were caught as breakfast above; they stay breakfast-only
        # unless the title itself says dessert.
        if not types or dessert_title and not BREAKFAST.search(t):
            types.add('dessert')

    if 'dessert' in types and not types & {'breakfast', 'brunch'}:
        return _ordered(types)

    if LUNCH.search(t):
        types.add('lunch')
        if LUNCH_AND_DINNER.search(t) or (has_meat and not re.search(r'\b(sandwich|wrap|salad|sub)\b', t)):
            types.add('dinner')

    # Breakfast dishes ("Breakfast Casserole") stay breakfast unless the title says dinner.
    if 'dinner' in t or (DINNER.search(t) and 'breakfast' not in types):
        types.add('dinner')

    # A savory meat/fish dish only matched as brunch (crab cakes, smoked salmon) is also a main.
    if has_meat and types == {'brunch'}:
        types.add('dinner')

    # No keyword matched: a savory dish with a real protein is a main.
    if not types and has_protein and not very_sweet:
        types.add('dinner')
        if 'egg' in ingredient_ids and not has_meat:
            types |= {'breakfast', 'brunch'}

    return _ordered(types)


def _ordered(types: set) -> list:
    return [m for m in MEAL_TYPES if m in types]
