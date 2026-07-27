// data/recipes.ts
//
// Recipe database for scoring/matching with "This or That" game preferences.
// Each recipe has tags that align with the preference tags from thisOrThatData.ts.
// Tags are lowercase for consistency with the scoring engine.

export interface Recipe {
  id: string | number;
  name: string;
  description?: string;
  tags: string[];
  ingredients?: string[];
  instructions?: string[];
  cookTime?: number; // minutes
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  rating?: number; // 0-5
  imageUrl?: string;
}

export const RECIPES: Recipe[] = [
  // PROTEIN: Chicken + Fried
  {
    id: 1,
    name: 'Crispy Fried Chicken Burger',
    description: 'Golden-fried chicken breast on a toasted bun with pickles and sauce',
    tags: ['chicken', 'fried', 'poultry', 'beef', 'ground-beef', 'bread', 'bun', 'quick'],
    cookTime: 15,
    servings: 1,
    difficulty: 'easy',
    rating: 4.5,
    ingredients: ['chicken breast', 'flour', 'oil', 'bun', 'pickles', 'mayo'],
  },

  // PROTEIN: Fish + Seafood
  {
    id: 2,
    name: 'Fish Tacos with Lime Crema',
    description: 'Crispy battered fish with cabbage slaw and lime crema',
    tags: ['fish', 'seafood', 'tortilla', 'wrap', 'handheld', 'quick'],
    cookTime: 20,
    servings: 2,
    difficulty: 'medium',
    rating: 4.8,
    ingredients: ['fish fillet', 'tortillas', 'cabbage', 'lime', 'crema', 'cilantro'],
  },

  // PROTEIN: Beans + Vegetarian
  {
    id: 3,
    name: 'Bean & Veggie Buddha Bowl',
    description: 'Roasted vegetables and black beans over rice with tahini dressing',
    tags: ['beans', 'vegetarian', 'plant-based', 'vegetables', 'roasted', 'light', 'rice', 'grain'],
    cookTime: 25,
    servings: 1,
    difficulty: 'easy',
    rating: 4.6,
    ingredients: ['black beans', 'sweet potato', 'broccoli', 'rice', 'tahini', 'olive oil'],
  },

  // PROTEIN: Chicken + Grilled
  {
    id: 4,
    name: 'Grilled Chicken with Roasted Vegetables',
    description: 'Herb-grilled chicken breast with seasonal roasted vegetables',
    tags: ['chicken', 'grilled', 'poultry', 'vegetables', 'roasted', 'light'],
    cookTime: 30,
    servings: 1,
    difficulty: 'medium',
    rating: 4.4,
    ingredients: ['chicken breast', 'zucchini', 'bell peppers', 'tomatoes', 'herbs', 'olive oil'],
  },

  // PROTEIN: Beef + Tacos
  {
    id: 5,
    name: 'Beef Taco Platter',
    description: 'Seasoned ground beef tacos with all the fixings',
    tags: ['beef', 'ground-beef', 'tortilla', 'wrap', 'handheld', 'onion', 'fried', 'quick'],
    cookTime: 12,
    servings: 2,
    difficulty: 'easy',
    rating: 4.3,
    ingredients: ['ground beef', 'tortillas', 'onion', 'lettuce', 'cheese', 'salsa'],
  },

  // CARBS: Pasta + Comfort
  {
    id: 6,
    name: 'Mac & Cheese Comfort Bowl',
    description: 'Creamy homemade mac and cheese with breadcrumb topping',
    tags: ['pasta', 'cheese', 'comfort', 'noodles', 'bread', 'bun'],
    cookTime: 15,
    servings: 2,
    difficulty: 'easy',
    rating: 4.7,
    ingredients: ['pasta', 'cheddar cheese', 'butter', 'milk', 'breadcrumbs'],
  },

  // CARBS: Rice + Grain
  {
    id: 7,
    name: 'Thai Basil Chicken Fried Rice',
    description: 'Fragrant jasmine rice with chicken, vegetables, and Thai basil',
    tags: ['rice', 'grain', 'chicken', 'poultry', 'vegetables', 'quick'],
    cookTime: 18,
    servings: 2,
    difficulty: 'easy',
    rating: 4.5,
    ingredients: ['jasmine rice', 'chicken', 'egg', 'basil', 'soy sauce', 'vegetables'],
  },

  // CARBS: Potato + Comfort
  {
    id: 8,
    name: 'Loaded Mashed Potatoes',
    description: 'Creamy mashed potatoes with butter, cheese, and bacon',
    tags: ['potato', 'comfort', 'grain'],
    cookTime: 20,
    servings: 4,
    difficulty: 'easy',
    rating: 4.6,
    ingredients: ['potatoes', 'butter', 'milk', 'cheese', 'bacon', 'chives'],
  },

  // SIDES: Coleslaw + Slaw
  {
    id: 9,
    name: 'Crispy Coleslaw',
    description: 'Tangy vinegar-based coleslaw with fresh cabbage',
    tags: ['cabbage', 'slaw', 'light', 'vegetables'],
    cookTime: 10,
    servings: 4,
    difficulty: 'easy',
    rating: 4.2,
    ingredients: ['cabbage', 'vinegar', 'oil', 'carrots', 'sugar', 'salt'],
  },

  // SIDES: Salad + Light
  {
    id: 10,
    name: 'Garden Side Salad',
    description: 'Mixed greens with fresh vegetables and light vinaigrette',
    tags: ['lettuce', 'salad', 'light', 'vegetables'],
    cookTime: 5,
    servings: 2,
    difficulty: 'easy',
    rating: 4.4,
    ingredients: ['lettuce mix', 'tomatoes', 'cucumbers', 'carrots', 'vinaigrette'],
  },

  // SIDES: Vegetables + Roasted
  {
    id: 11,
    name: 'Roasted Vegetable Medley',
    description: 'Seasonal vegetables roasted with garlic and herbs',
    tags: ['vegetables', 'roasted', 'light'],
    cookTime: 25,
    servings: 4,
    difficulty: 'easy',
    rating: 4.5,
    ingredients: ['zucchini', 'bell peppers', 'broccoli', 'garlic', 'olive oil', 'herbs'],
  },

  // SIDES: Onion Rings + Fried
  {
    id: 12,
    name: 'Crispy Onion Rings',
    description: 'Golden-fried onion rings with ranch dipping sauce',
    tags: ['onion', 'fried', 'quick'],
    cookTime: 10,
    servings: 2,
    difficulty: 'easy',
    rating: 4.3,
    ingredients: ['onions', 'flour', 'milk', 'oil', 'salt', 'pepper'],
  },

  // SIDES: Fruit + Light
  {
    id: 13,
    name: 'Mixed Fruit Cup',
    description: 'Fresh seasonal fruits with a touch of honey',
    tags: ['fruit', 'light', 'vegetables'],
    cookTime: 5,
    servings: 1,
    difficulty: 'easy',
    rating: 4.6,
    ingredients: ['watermelon', 'berries', 'pineapple', 'honey'],
  },

  // Combination: Burger + Fries
  {
    id: 14,
    name: 'Classic Cheeseburger & Fries',
    description: 'Juicy beef burger with melted cheese and crispy fries',
    tags: ['beef', 'ground-beef', 'potato', 'fried', 'quick', 'bun', 'bread', 'comfort'],
    cookTime: 15,
    servings: 1,
    difficulty: 'easy',
    rating: 4.7,
    ingredients: ['ground beef', 'cheese', 'potatoes', 'bun', 'lettuce', 'tomato'],
  },

  // Combination: Grilled + Rice
  {
    id: 15,
    name: 'Teriyaki Chicken Bowl',
    description: 'Grilled teriyaki chicken over rice with vegetables',
    tags: ['chicken', 'grilled', 'poultry', 'rice', 'grain', 'vegetables'],
    cookTime: 22,
    servings: 1,
    difficulty: 'medium',
    rating: 4.6,
    ingredients: ['chicken', 'teriyaki sauce', 'rice', 'edamame', 'carrots'],
  },

  // Combination: Fish + Sides
  {
    id: 16,
    name: 'Baked Fish with Side Salad',
    description: 'Herb-baked fish fillet with garden salad',
    tags: ['fish', 'seafood', 'lettuce', 'salad', 'light', 'vegetables'],
    cookTime: 25,
    servings: 1,
    difficulty: 'medium',
    rating: 4.5,
    ingredients: ['fish fillet', 'lemon', 'herbs', 'lettuce', 'vegetables'],
  },

  // Combination: Vegetarian + Comfort
  {
    id: 17,
    name: 'Veggie Pasta Primavera',
    description: 'Fresh seasonal vegetables tossed with pasta and olive oil',
    tags: ['vegetables', 'pasta', 'noodles', 'vegetarian', 'plant-based', 'light'],
    cookTime: 20,
    servings: 2,
    difficulty: 'easy',
    rating: 4.4,
    ingredients: ['pasta', 'zucchini', 'tomatoes', 'basil', 'olive oil', 'garlic'],
  },

  // Combination: Handheld + Quick
  {
    id: 18,
    name: 'Crispy Chicken Wrap',
    description: 'Breaded chicken with veggies wrapped in a soft tortilla',
    tags: ['chicken', 'poultry', 'tortilla', 'wrap', 'handheld', 'quick', 'bread'],
    cookTime: 10,
    servings: 1,
    difficulty: 'easy',
    rating: 4.4,
    ingredients: ['chicken breast', 'tortilla', 'lettuce', 'tomato', 'mayo', 'cheese'],
  },

  // Combination: Beef + Comfort
  {
    id: 19,
    name: 'Beef Meatball Pasta',
    description: 'Tender beef meatballs in marinara sauce over pasta',
    tags: ['beef', 'pasta', 'noodles', 'comfort', 'ground-beef'],
    cookTime: 30,
    servings: 2,
    difficulty: 'medium',
    rating: 4.6,
    ingredients: ['ground beef', 'pasta', 'marinara', 'onion', 'garlic', 'breadcrumbs'],
  },

  // High-rating popular recipe
  {
    id: 20,
    name: 'BBQ Pulled Pork Sandwich',
    description: 'Slow-cooked pulled pork with BBQ sauce on a toasted bun',
    tags: ['beef', 'red-meat', 'bread', 'bun', 'comfort', 'quick', 'handheld'],
    cookTime: 240, // Slow-cooked, but quick to prep/serve
    servings: 4,
    difficulty: 'medium',
    rating: 4.8,
    ingredients: ['pork shoulder', 'BBQ sauce', 'buns', 'onion', 'pickles'],
  },
];

/**
 * SCORING NOTES:
 *
 * The tags in each recipe should overlap with tags in thisOrThatData.ts
 * to enable proper scoring. For example:
 *
 *   Q: "Crispy chicken or juicy burger?"
 *   A: ['chicken', 'fried', 'poultry']
 *   B: ['beef', 'ground-beef', 'red-meat']
 *
 *   Recipe #1 (Crispy Fried Chicken Burger):
 *   tags: ['chicken', 'fried', 'poultry', 'beef', 'ground-beef', 'bread', 'bun']
 *
 *   If user chooses A (chicken), tags = ['chicken', 'fried', 'poultry']
 *   Overlap: 3/7 = 42.9% match (below 70% threshold, not shown)
 *
 * To increase match likelihood, recipes should have tags that align with
 * multiple preference options to catch different user preferences.
 */
