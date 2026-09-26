// backend/scripts/kaggle/tagRules.ts
//
// Keyword rules that translate raw Kaggle recipe text into the BiteWise
// tag vocabulary (see frontend/data/quizQuestions.ts).
//
// HOW THE RULES WORK
// ------------------
// Each rule is a list of keywords plus the tags it earns. A keyword
// matches on word boundaries, so 'ham' will not match 'shallot'.
// Rules are deliberately conservative: a missing tag only costs a recipe
// a point in the matcher, but a wrong tag sends the user a bad match.
//
// To tune the importer, edit these tables — not transform.ts.

import type { PantryCategoryId } from '../../../frontend/types';

export interface KeywordRule {
  keywords: string[];
  tags: string[];
}

// ---------- Protein (matched against ingredient names) ----------
export const PROTEIN_RULES: KeywordRule[] = [
  { keywords: ['chicken', 'turkey', 'hen'], tags: ['chicken', 'poultry'] },
  { keywords: ['beef', 'steak', 'sirloin', 'brisket', 'chuck', 'ground round', 'veal'], tags: ['beef', 'red-meat'] },
  { keywords: ['pork', 'bacon', 'ham', 'sausage', 'chorizo', 'prosciutto', 'lamb'], tags: ['red-meat'] },
  { keywords: ['salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'fish', 'trout', 'catfish', 'mahi'], tags: ['fish', 'seafood'] },
  { keywords: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster'], tags: ['fish', 'seafood'] },
  { keywords: ['tofu', 'tempeh', 'seitan'], tags: ['tofu', 'plant-based'] },
  { keywords: ['black beans', 'kidney beans', 'pinto beans', 'chickpeas', 'garbanzo', 'lentils', 'cannellini'], tags: ['beans', 'plant-based'] },
];

// ---------- Cooking method (matched against directions) ----------
export const METHOD_RULES: KeywordRule[] = [
  { keywords: ['grill', 'grilled', 'broil', 'broiled', 'char', 'charred'], tags: ['grilled', 'charred'] },
  { keywords: ['bake', 'baked', 'oven'], tags: ['baked'] },
  { keywords: ['roast', 'roasted'], tags: ['roasted'] },
  { keywords: ['fry', 'fried', 'sear', 'saute', 'sauté', 'brown', 'stir-fry'], tags: ['fried'] },
  { keywords: ['deep fry', 'deep-fry', 'crispy', 'crisp', 'breaded', 'panko'], tags: ['crispy'] },
  { keywords: ['simmer', 'braise', 'stew', 'poach'], tags: ['simmered'] },
  { keywords: ['slow cooker', 'crock pot', 'crockpot', 'crock-pot'], tags: ['slow-cooked', 'tender'] },
  { keywords: ['steam', 'steamed'], tags: ['steamed'] },
];

// Any of these in the directions means the dish is served warm, even if
// no specific method rule above matched ("warm the beans in a skillet").
export const COOKED_KEYWORDS = ['cook', 'heat', 'warm', 'boil', 'skillet', 'pan', 'microwave', 'toast'];

// ---------- Starch / base (matched against ingredient names) ----------
export const STARCH_RULES: KeywordRule[] = [
  { keywords: ['brown rice', 'wild rice'], tags: ['rice', 'grain', 'whole-grain'] },
  { keywords: ['rice'], tags: ['rice', 'grain'] },
  { keywords: ['quinoa', 'farro', 'barley', 'bulgur'], tags: ['quinoa', 'grain', 'whole-grain'] },
  { keywords: ['spaghetti', 'penne', 'pasta', 'macaroni', 'linguine', 'fettuccine', 'rigatoni', 'lasagna'], tags: ['pasta', 'noodles', 'high-carb'] },
  { keywords: ['noodles', 'ramen', 'udon', 'soba'], tags: ['noodles', 'high-carb'] },
  { keywords: ['potato', 'potatoes', 'sweet potato', 'yams'], tags: ['potato', 'root-veg'] },
  { keywords: ['tortilla', 'tortillas', 'taco shells'], tags: ['tortilla', 'bread', 'handheld'] },
  { keywords: ['bun', 'buns', 'rolls', 'bread', 'pita', 'naan'], tags: ['bread'] },
];

// ---------- Produce & flavor (matched against ingredient names) ----------
export const FLAVOR_RULES: KeywordRule[] = [
  { keywords: ['spinach', 'kale', 'lettuce', 'arugula', 'collard', 'chard', 'mixed greens'], tags: ['greens', 'leafy'] },
  { keywords: ['broccoli', 'green beans', 'asparagus', 'zucchini', 'peas', 'brussels'], tags: ['greens'] },
  { keywords: ['carrot', 'carrots', 'beet', 'parsnip', 'turnip'], tags: ['root-veg'] },
  { keywords: ['bell pepper', 'green pepper', 'red pepper', 'peppers'], tags: ['peppers', 'colorful'] },
  { keywords: ['cheese', 'cheddar', 'parmesan', 'mozzarella', 'feta', 'jack'], tags: ['cheesy'] },
  { keywords: ['heavy cream', 'whipping cream', 'cream cheese', 'sour cream', 'half-and-half', 'coconut milk'], tags: ['creamy', 'rich'] },
  { keywords: ['lemon', 'lime', 'vinegar'], tags: ['tangy', 'acidic'] },
  { keywords: ['olive oil'], tags: ['olive-oil'] },
  { keywords: ['soy sauce', 'curry', 'fish sauce', 'garam masala', 'gochujang', 'miso', 'sriracha', 'salsa', 'cumin', 'harissa'], tags: ['global', 'adventurous'] },
];

// ---------- Dish format (matched against the title) ----------
export const FORMAT_RULES: KeywordRule[] = [
  { keywords: ['soup', 'stew', 'chili', 'bowl', 'curry', 'gumbo', 'chowder'], tags: ['bowl', 'saucy'] },
  { keywords: ['sandwich', 'burger', 'wrap', 'taco', 'tacos', 'burrito', 'sub', 'sliders'], tags: ['handheld', 'sandwich'] },
  { keywords: ['salad'], tags: ['salad', 'fresh'] },
  { keywords: ['casserole', 'bake', 'pot pie', 'meatloaf', 'lasagna'], tags: ['comfort', 'classic', 'hearty'] },
  { keywords: ['stir fry', 'stir-fry', 'skillet'], tags: ['mixed-in'] },
];

// ---------- Vibe (matched against all ingredients) ----------
export const SPICY_KEYWORDS = ['jalapeno', 'jalapeño', 'cayenne', 'chili', 'chile', 'chipotle', 'hot sauce', 'sriracha', 'red pepper flakes', 'habanero', 'serrano'];
export const SWEET_KEYWORDS = ['honey', 'maple', 'brown sugar', 'teriyaki', 'bbq sauce', 'barbecue sauce', 'pineapple', 'molasses'];

// ---------- Allergens (matched against ingredient names) ----------
// Keys are the allergen strings used in frontend/constants/recipes.ts.
export const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten:    ['cream of', 'condensed soup', 'flour', 'bread', 'breadcrumbs', 'crumbs', 'pasta', 'spaghetti', 'noodles', 'macaroni', 'tortilla', 'bun', 'buns', 'rolls', 'soy sauce', 'barley', 'couscous', 'crackers', 'biscuit', 'panko', 'wheat', 'beer'],
  dairy:     ['milk', 'butter', 'cheese', 'cream', 'yogurt', 'buttermilk', 'cheddar', 'parmesan', 'mozzarella', 'feta', 'ricotta', 'ghee'],
  eggs:      ['egg', 'eggs', 'mayonnaise', 'mayo'],
  fish:      ['salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'fish', 'anchovy', 'anchovies', 'trout', 'fish sauce'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster'],
  soy:       ['soy', 'tofu', 'edamame', 'miso', 'tempeh', 'teriyaki'],
  nuts:      ['almond', 'almonds', 'walnut', 'walnuts', 'pecan', 'pecans', 'cashew', 'cashews', 'pistachio', 'hazelnut', 'pesto'],
  peanuts:   ['peanut', 'peanuts', 'peanut butter'],
  sesame:    ['sesame', 'tahini'],
  corn:      ['corn', 'cornstarch', 'cornmeal', 'corn tortilla', 'polenta', 'grits', 'hominy'],
  coconut:   ['coconut'],
  mustard:   ['mustard', 'dijon'],
};

// Ingredients that rule out vegetarian / pescatarian.
export const MEAT_KEYWORDS = ['chicken', 'turkey', 'beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'lamb', 'veal', 'chorizo', 'prosciutto', 'pepperoni', 'broth', 'stock', 'gelatin'];
// On top of meat, these rule out vegan.
export const ANIMAL_PRODUCT_KEYWORDS = ['egg', 'eggs', 'honey', 'mayonnaise', 'mayo'];

// ---------- Ingredient categories (for the shopping list) ----------
export const CATEGORY_KEYWORDS: [PantryCategoryId, string[]][] = [
  ['proteins', ['chicken', 'turkey', 'beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'salmon', 'tuna', 'fish', 'shrimp', 'tofu', 'beans', 'lentils', 'chickpeas', 'egg', 'eggs']],
  ['dairy',    ['milk', 'butter', 'cheese', 'cream', 'yogurt', 'buttermilk', 'cheddar', 'parmesan', 'mozzarella']],
  ['grains',   ['rice', 'pasta', 'spaghetti', 'noodles', 'bread', 'tortilla', 'flour', 'oats', 'quinoa', 'buns', 'macaroni']],
  ['produce',  ['onion', 'garlic', 'tomato', 'pepper', 'carrot', 'celery', 'potato', 'lettuce', 'spinach', 'broccoli', 'lemon', 'lime', 'cilantro', 'parsley', 'zucchini', 'mushroom', 'apple', 'cucumber', 'ginger', 'basil', 'jalapeno', 'jalapeño', 'avocado', 'cabbage', 'kale']],
];

// ---------- Filters: which Kaggle rows are worth importing ----------
// BiteWise recommends meals, so desserts and drinks are skipped by title.
// Condiments, dips, and dressings mostly fall out on their own because
// transform.ts also requires a recognizable protein.
export const SKIP_TITLE_KEYWORDS = [
  'cake', 'cookie', 'cookies', 'brownie', 'brownies', 'frosting', 'icing', 'fudge', 'candy',
  'muffin', 'muffins', 'cupcake', 'cheesecake', 'pudding', 'punch', 'cocktail', 'smoothie',
  'lemonade', 'jam', 'jelly', 'cobbler', 'dip', 'marinade', 'rub',
];
