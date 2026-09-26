// constants/pantryData.ts
//
// Data for the Pantry tab:
//   AVAILABLE_UNITS     the unit picker
//   STORAGE_TIPS        one storage tip per subcategory (getStorageTip)
//   QUICK_ADDS          one-tap chips at the top of the pantry
//   SUGGESTION_LIBRARY  suggestions while typing an item, with details
//
// Every item has: icon, section (pantryCategory), subcategory, where to keep
// it (storage) and a typical shelf life. Many also have allergens and other
// names people search by (aliases).
//
// Items matched to the USDA FoodData Central Foundation Foods list (April
// 2026) carry `fdcId` and, where USDA measured them, `nutrition` per 100 g
// and a household `portion`. More: https://fdc.nal.usda.gov/food-details/<fdcId>
// USDA names were rewritten as shopping names; restaurant dishes, cooked
// duplicates and dried/frozen liquid eggs were left out. Drinks, candy and
// most seasonings, sweets and breads aren't in the USDA list.
//
// Shelf life and allergens are GUIDES, not labels:
//   * shelfLifeDays = typical days fresh or unopened, stored as `storage` says.
//     Opened jars, cut produce and leftovers keep for less time.
//   * allergens = what the item typically contains, using the recipe
//     database's allergen ids. Brands and recipes vary, so always check the
//     package. An empty list doesn't guarantee the item is allergen-free.
//
// Salt, pepper and water are assumed to be in every kitchen, so they never
// count as missing - that's why they aren't quick adds.

import type { PantryCategoryId } from '../types';
import { foodWords } from '../utils/customFoods';

export type PantryStorage = 'counter' | 'pantry' | 'fridge' | 'freezer';

/** Allergen ids used by the recipe database (lib API / allergens.py). */
export type PantryAllergen =
  | 'dairy' | 'eggs' | 'fish' | 'shellfish' | 'mollusc' | 'nuts'
  | 'peanuts' | 'wheat' | 'gluten' | 'soy' | 'sesame';

/** USDA values per 100 g. Grams unless noted; sodium, cholesterol, potassium, calcium, iron, vitamin C in mg. */
export interface PantryNutrition {
  calories?: number;
  /** true when USDA had no energy value and calories were worked out from protein, carbs and fat. */
  caloriesEstimated?: boolean;
  protein?: number;
  carbs?: number;
  fat?: number;
  saturatedFat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  cholesterol?: number;
  potassium?: number;
  calcium?: number;
  iron?: number;
  vitaminC?: number;
}

export interface PantryLibraryItem {
  icon: string;
  name: string;
  /** Grouping for this file only. */
  category: string;
  unit: string;
  /** Section it goes in on the Pantry tab. */
  pantryCategory: PantryCategoryId;
  /** Finer grouping, e.g. 'Leafy Greens', 'Deli Meats', 'Gummy & Chewy Candy'. Key into STORAGE_TIPS. */
  subcategory: string;
  /** Where to keep it. */
  storage: PantryStorage;
  /** Typical days fresh or unopened in that storage. A guide, not a use-by date. */
  shelfLifeDays: number;
  /** What it typically contains. Always check the label. */
  allergens?: PantryAllergen[];
  /** Other names people type, e.g. 'scallions' for Green Onions. */
  aliases?: string[];
  /** USDA FoodData Central id. */
  fdcId?: number;
  /** A common household measure and its weight, from USDA. */
  portion?: { label: string; grams: number };
  /** Per 100 g, from USDA. */
  nutrition?: PantryNutrition;
}


export const AVAILABLE_UNITS = [
  'Items',
  'Cups',
  'Tbsp',
  'Tsp',
  'Oz',
  'Fl Oz',
  'Lbs',
  'Grams',
  'Kg',
  'Ml',
  'Liters',
  'Pints',
  'Quarts',
  'Gallons',
  'Servings',
  'Slices',
  'Sticks',
  'Packages',
  'Packets',
  'Bags',
  'Boxes',
  'Cans',
  'Jars',
  'Bottles',
  'Cartons',
  'Containers',
  'Bunches',
  'Heads',
  'Cloves',
  'Loaves',
  'Dozen',
];

export const STORAGE_TIPS: Record<string, string> = {
  'Leafy Greens': 'Keep dry in the crisper wrapped in a paper towel; wash just before using.',
  'Fresh Herbs': 'Stand stems in a glass of water, or wrap in a damp paper towel and refrigerate.',
  'Onions & Garlic': 'Keep whole bulbs somewhere cool, dark and dry, away from potatoes. Refrigerate once cut.',
  'Green Onions & Leeks': 'Refrigerate in a bag; trim the roots just before using.',
  'Root Vegetables': 'Cut off any leafy tops, then refrigerate in a bag.',
  'Potatoes': 'Keep in a cool, dark place, not the fridge, and away from onions.',
  'Cruciferous Vegetables': 'Refrigerate unwashed in a loose bag.',
  'Peppers & Chiles': 'Refrigerate whole and unwashed in the crisper.',
  'Tomatoes': 'Keep on the counter, stem side down; refrigerate only once cut or very ripe.',
  'Squash & Cucumbers': 'Refrigerate whole; cucumbers and summer squash go soft quickly.',
  'Winter Squash': 'Whole squash keeps for weeks somewhere cool and dry; refrigerate once cut.',
  'Mushrooms': 'Keep in a paper bag in the fridge; brush clean instead of soaking.',
  'Fresh Vegetables': 'Refrigerate unwashed and use within a few days for best flavor.',
  'Berries': 'Don\'t wash until eating, and remove any moldy berries right away.',
  'Citrus': 'Lasts about a week on the counter and several weeks in the fridge.',
  'Apples & Pears': 'Apples keep longest in the fridge; ripen pears on the counter, then refrigerate.',
  'Stone Fruit': 'Ripen on the counter, then refrigerate for a few more days.',
  'Bananas & Plantains': 'Keep on the counter; bananas ripen faster next to other fruit.',
  'Tropical Fruit': 'Ripen on the counter, then refrigerate; refrigerate once cut.',
  'Melons': 'Keep whole melons on the counter; refrigerate cut melon covered, for 3 to 4 days.',
  'Grapes & Cherries': 'Refrigerate unwashed in a bag that lets air through.',
  'Avocados': 'Ripen on the counter; refrigerate ripe avocados to slow them down.',
  'Poultry': 'Keep on the bottom shelf in its package; freeze if not cooking within 1 to 2 days.',
  'Ground Meat': 'Cook or freeze within 1 to 2 days.',
  'Beef': 'Cook within 3 to 5 days, or freeze.',
  'Pork': 'Cook within 3 to 5 days, or freeze.',
  'Lamb & Game': 'Cook within 3 to 5 days, or freeze.',
  'Bacon & Sausage': 'Keep sealed in the fridge; once opened, use within about a week.',
  'Fresh Sausage': 'Raw sausage: cook or freeze within 1 to 2 days.',
  'Deli Meats': 'Once opened, use within 3 to 5 days.',
  'Cured Meats': 'Keep wrapped in the fridge; dry-cured meats last for weeks.',
  'Fish': 'Cook within 1 to 2 days or freeze; keep it on ice in the coldest part of the fridge.',
  'Shellfish': 'Cook within 1 to 2 days or freeze.',
  'Canned Seafood': 'Keep in the pantry; refrigerate leftovers in a sealed container.',
  'Canned Beans': 'Keep in the pantry; rinse to cut sodium. Refrigerate leftovers.',
  'Plant Proteins': 'Keep sealed in the fridge; cover opened tofu with fresh water daily.',
  'Milk': 'Keep on a shelf at the back of the fridge, not in the door.',
  'Plant Milk': 'Shelf-stable cartons keep in the pantry until opened; then refrigerate and use within 7 to 10 days.',
  'Cream': 'Keep cold and sealed; use within about a week of opening.',
  'Eggs': 'Keep in the carton on a fridge shelf, not in the door.',
  'Butter': 'Refrigerate; freeze extra sticks for up to a year.',
  'Hard Cheese': 'Wrap in wax or parchment paper, then loosely in plastic.',
  'Cheese': 'Wrap tightly after opening; cut off small spots of mold on firm cheese.',
  'Soft Cheese': 'Keep sealed; throw out soft cheese if any mold appears.',
  'Yogurt & Sour Cream': 'Keep sealed; always use a clean spoon.',
  'Dips & Spreads': 'Keep sealed and use within about a week of opening.',
  'Refrigerated Dough': 'Keep cold until using; don\'t eat it raw.',
  'Sliced Bread': 'Keep at room temperature and freeze what you won\'t use in time; the fridge makes bread go stale faster.',
  'Artisan Bread': 'Best within a day or two; store cut side down, or slice and freeze.',
  'Rolls & Buns': 'Keep sealed at room temperature; freeze extras.',
  'Tortillas & Flatbreads': 'Refrigerate after opening to keep them longer.',
  'Breakfast Breads & Pastries': 'Keep in a sealed container; freeze to keep longer.',
  'Rice': 'Airtight container in a cool, dry place. Brown and wild rice go rancid sooner.',
  'Pasta & Noodles': 'Keep dry and sealed in the pantry.',
  'Whole Grains': 'Airtight container in a cool, dry place.',
  'Flour & Meal': 'Airtight container; whole-grain and nut flours keep longer in the fridge or freezer.',
  'Oats & Cereal': 'Keep sealed so it stays crisp.',
  'Snacks & Crackers': 'Reseal after opening so they stay crisp.',
  'Canned Tomatoes': 'Keep in the pantry; refrigerate leftovers in a glass or plastic container.',
  'Canned Vegetables': 'Keep in the pantry; refrigerate leftovers.',
  'Soups & Broth': 'Refrigerate after opening and use within 4 to 5 days.',
  'Nut & Seed Butters': 'Keep in the pantry; natural nut butters keep better in the fridge.',
  'Nuts & Seeds': 'Airtight container; the fridge or freezer stops them going rancid.',
  'Dried Fruit': 'Keep sealed in a cool, dry place.',
  'Dried Beans & Lentils': 'Keep dry and sealed; older beans take longer to cook.',
  'Jams & Fruit Spreads': 'Refrigerate after opening.',
  'Baking Staples': 'Keep dry and sealed.',
  'Sugar & Sweeteners': 'Keep sealed and dry; if honey crystallizes, warm the jar in hot water.',
  'Leaveners': 'Keep dry; baking powder and yeast lose strength over time, so check the date.',
  'Chocolate & Chips': 'Keep cool and dry; white streaks (bloom) are harmless.',
  'Baking Mixes': 'Keep sealed and dry.',
  'Toppings & Syrups': 'Refrigerate sauces after opening.',
  'Desserts & Treats': 'Keep covered; refrigerate anything with cream, custard or fruit filling.',
  'Chocolate Candy': 'Keep cool and dry; white streaks (bloom) are harmless.',
  'Gummy & Chewy Candy': 'Keep sealed so it doesn\'t harden or get sticky.',
  'Hard Candy & Mints': 'Keep sealed and dry; humidity makes it sticky.',
  'Specialty Candy': 'Keep sealed in a cool, dry place.',
  'Oils': 'Keep away from heat and light; oil goes rancid with heat and light.',
  'Asian Sauces': 'Keep in the pantry; refrigerating after opening keeps the flavor longer.',
  'Vinegar': 'Keeps almost indefinitely in the pantry.',
  'Ketchup & Mustard': 'Refrigerate after opening.',
  'Mayo & Dressings': 'Refrigerate after opening.',
  'Hot Sauce': 'Refrigerate after opening to keep the color and flavor.',
  'Pasta Sauce & Pesto': 'Refrigerate after opening and use within about a week.',
  'Salsa & Dips': 'Refrigerate after opening and use within about a week.',
  'Pickled & Jarred': 'Refrigerate after opening, keeping them covered in their brine.',
  'Pastes': 'Refrigerate after opening.',
  'Salt': 'Salt doesn\'t go bad; keep it dry.',
  'Ground Spices': 'Keep sealed away from the stove; ground spices lose flavor after 2 to 3 years.',
  'Whole Spices': 'Keep sealed; whole spices stay fresh longer than ground ones.',
  'Dried Herbs': 'Keep sealed and away from heat; replace when they stop smelling strong.',
  'Seasoning Blends': 'Keep sealed away from heat and moisture.',
  'Flavor Boosters': 'Keep sealed; refrigerate jars after opening.',
  'Frozen Vegetables': 'Keep at 0°F (-18°C); cook straight from frozen.',
  'Frozen Fruit': 'Keep at 0°F (-18°C); use frozen in smoothies or baking.',
  'Frozen Potatoes & Sides': 'Keep at 0°F (-18°C); cook from frozen.',
  'Frozen Seafood': 'Thaw overnight in the fridge or under cold running water.',
  'Frozen Desserts': 'Keep at the back of the freezer and close the lid tightly.',
  'Juice': 'Refrigerate after opening and use within 7 to 10 days.',
  'Coffee': 'Keep airtight, away from light, heat and moisture.',
  'Tea & Hot Drinks': 'Keep sealed and dry, away from strong smells.',
  'Water & Soda': 'Keep somewhere cool, out of direct sunlight.',
  'Other Drinks': 'Refrigerate after opening.',
  'Wine & Beer': 'Keep somewhere cool and dark; store corked wine on its side.',
  'Spirits': 'Keeps for years sealed; store upright somewhere cool.',
  'Cooking Wine & Sake': 'Refrigerate after opening.',
};

export const QUICK_ADDS: (PantryLibraryItem & { id: string })[] = [
  {
    id: 'q1', icon: '🥛', name: 'Milk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Milk', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['dairy'],
    fdcId: 746782,
    portion: { label: '1 cup', grams: 249.0 },
    nutrition: { calories: 60, protein: 3.3, carbs: 4.6, fat: 3.2, saturatedFat: 1.9, sugar: 4.8, sodium: 38, cholesterol: 12, potassium: 150, calcium: 123, iron: 0.0 },
  },
  {
    id: 'q2', icon: '🥚', name: 'Eggs', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Eggs', storage: 'fridge', shelfLifeDays: 35,
    allergens: ['eggs'],
    fdcId: 748967,
    portion: { label: '1 egg (whole without shell)', grams: 50.3 },
    nutrition: { calories: 148, protein: 12.4, carbs: 1.0, fat: 10.0, saturatedFat: 3.2, fiber: 0.0, sugar: 0.2, sodium: 129, cholesterol: 411, potassium: 132, calcium: 48, iron: 1.7 },
  },
  {
    id: 'q3', icon: '🧈', name: 'Butter', category: 'Dairy / Refrigerated', unit: 'Sticks', pantryCategory: 'dairy',
    subcategory: 'Butter', storage: 'fridge', shelfLifeDays: 60,
    allergens: ['dairy'],
    fdcId: 790508,
    nutrition: { fat: 82.2, saturatedFat: 45.6, sugar: 0.6, sodium: 524, cholesterol: 235, potassium: 23, calcium: 21, iron: 0.1 },
  },
  {
    id: 'q4', icon: '🍗', name: 'Chicken Breast', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Poultry', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2646170,
    nutrition: { calories: 112, protein: 22.5, carbs: 0.0, fat: 1.9, saturatedFat: 0.3, sodium: 66, cholesterol: 73, potassium: 330, calcium: 4, iron: 0.4 },
  },
  {
    id: 'q5', icon: '🧅', name: 'Onions', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Onions & Garlic', storage: 'pantry', shelfLifeDays: 30,
    fdcId: 790646,
    portion: { label: '1 Onion (Edible)', grams: 143.0 },
    nutrition: { calories: 38, protein: 0.8, carbs: 8.6, fat: 0.1, fiber: 1.9, sugar: 5.8, sodium: 1, potassium: 182, calcium: 15, iron: 0.3, vitaminC: 8.2 },
  },
  {
    id: 'q6', icon: '🧄', name: 'Garlic', category: 'Produce', unit: 'Cloves', pantryCategory: 'produce',
    subcategory: 'Onions & Garlic', storage: 'pantry', shelfLifeDays: 30,
    aliases: ['garlic bulb'],
    fdcId: 1104647,
    nutrition: { calories: 143, protein: 6.6, carbs: 28.2, fat: 0.4, fiber: 2.7, vitaminC: 10.0 },
  },
  {
    id: 'q7', icon: '🍚', name: 'Rice', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Rice', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    id: 'q8', icon: '🍝', name: 'Pasta', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['wheat', 'gluten'],
  },
  {
    id: 'q9', icon: '🫒', name: 'Olive Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 748608,
    portion: { label: '100 milliliter', grams: 90.7 },
    nutrition: { saturatedFat: 15.4 },
  },
  {
    id: 'q10', icon: '🍞', name: 'Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
    fdcId: 2758993,
    nutrition: { sodium: 420, potassium: 115, calcium: 288, iron: 4.1 },
  },
  {
    id: 'q11', icon: '🍅', name: 'Tomatoes', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Tomatoes', storage: 'counter', shelfLifeDays: 5,
  },
  {
    id: 'q12', icon: '🧀', name: 'Cheddar Cheese', category: 'Dairy / Refrigerated', unit: 'Bags', pantryCategory: 'dairy',
    subcategory: 'Cheese', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['dairy'],
    fdcId: 328637,
    portion: { label: '1 slice', grams: 17.0 },
    nutrition: { calories: 408, protein: 23.3, carbs: 2.4, fat: 34.0, saturatedFat: 19.2, sugar: 0.3, sodium: 654, cholesterol: 100, potassium: 77, calcium: 707, iron: 0.2 },
  },
];

export const SUGGESTION_LIBRARY: PantryLibraryItem[] = [

  // ============ PRODUCE ============
  {
    icon: '🧅', name: 'Onions', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Onions & Garlic', storage: 'pantry', shelfLifeDays: 30,
    fdcId: 790646,
    portion: { label: '1 Onion (Edible)', grams: 143.0 },
    nutrition: { calories: 38, protein: 0.8, carbs: 8.6, fat: 0.1, fiber: 1.9, sugar: 5.8, sodium: 1, potassium: 182, calcium: 15, iron: 0.3, vitaminC: 8.2 },
  },
  {
    icon: '🧅', name: 'Red Onion', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Onions & Garlic', storage: 'pantry', shelfLifeDays: 30,
    fdcId: 790577,
    portion: { label: '1 Onion (Edible)', grams: 197.0 },
    nutrition: { calories: 44, protein: 0.9, carbs: 9.9, fat: 0.1, fiber: 2.2, sugar: 5.8, sodium: 1, potassium: 197, calcium: 17, iron: 0.2, vitaminC: 8.1 },
  },
  {
    icon: '🧅', name: 'Sweet Onion', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Onions & Garlic', storage: 'pantry', shelfLifeDays: 30,
  },
  {
    icon: '🧅', name: 'Shallots', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Onions & Garlic', storage: 'pantry', shelfLifeDays: 30,
    fdcId: 2727586,
    nutrition: { protein: 1.4, fiber: 2.2, sugar: 4.4, sodium: 4, potassium: 252, calcium: 26, iron: 0.3 },
  },
  {
    icon: '🧄', name: 'Garlic', category: 'Produce', unit: 'Cloves', pantryCategory: 'produce',
    subcategory: 'Onions & Garlic', storage: 'pantry', shelfLifeDays: 30,
    aliases: ['garlic bulb'],
    fdcId: 1104647,
    nutrition: { calories: 143, protein: 6.6, carbs: 28.2, fat: 0.4, fiber: 2.7, vitaminC: 10.0 },
  },
  {
    icon: '🍅', name: 'Tomatoes', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Tomatoes', storage: 'counter', shelfLifeDays: 5,
  },
  {
    icon: '🍅', name: 'Cherry Tomatoes', category: 'Produce', unit: 'Cups', pantryCategory: 'produce',
    subcategory: 'Tomatoes', storage: 'counter', shelfLifeDays: 5,
  },
  {
    icon: '🥬', name: 'Lettuce', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
  },
  {
    icon: '🥬', name: 'Romaine Lettuce', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 746769,
    portion: { label: '1 bunch', grams: 581.0 },
    nutrition: { calories: 17, protein: 1.2, carbs: 3.2, fat: 0.3, fiber: 1.8, sugar: 1.2, potassium: 253, calcium: 35, iron: 0.9, vitaminC: 4.6 },
  },
  {
    icon: '🥬', name: 'Spinach', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 1999633,
    nutrition: { calories: 22, protein: 2.9, carbs: 2.6, fat: 0.6, fiber: 1.6, sodium: 107, potassium: 460, calcium: 67, iron: 1.1, vitaminC: 30.3 },
  },
  {
    icon: '🥬', name: 'Kale', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 323505,
    portion: { label: '1 cup (pieces of ~1")', grams: 20.6 },
    nutrition: { calories: 35, protein: 2.9, carbs: 4.4, fat: 1.5, fiber: 4.1, sugar: 0.8, sodium: 53, potassium: 348, calcium: 254, iron: 1.6, vitaminC: 93.4 },
  },
  {
    icon: '🥬', name: 'Cabbage', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Cruciferous Vegetables', storage: 'fridge', shelfLifeDays: 30,
    fdcId: 2346407,
    nutrition: { calories: 28, protein: 1.0, carbs: 6.4, fat: 0.2, sodium: 16, potassium: 207, calcium: 42, iron: 0.1, vitaminC: 40.3 },
  },
  {
    icon: '🥬', name: 'Bok Choy', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    aliases: ['pak choi'],
    fdcId: 2685572,
    nutrition: { calories: 17, protein: 1.0, carbs: 3.5, fat: 0.2, fiber: 1.3, sodium: 14, potassium: 228, calcium: 62, iron: 0.4, vitaminC: 30.3 },
  },
  {
    icon: '🥦', name: 'Broccoli', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Cruciferous Vegetables', storage: 'fridge', shelfLifeDays: 7,
    fdcId: 747447,
    portion: { label: '1 cup (chopped)', grams: 76.0 },
    nutrition: { calories: 31, protein: 2.6, carbs: 6.3, fat: 0.3, saturatedFat: 0.0, fiber: 2.4, sugar: 1.4, sodium: 36, potassium: 303, calcium: 46, iron: 0.7, vitaminC: 91.3 },
  },
  {
    icon: '🥦', name: 'Cauliflower', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Cruciferous Vegetables', storage: 'fridge', shelfLifeDays: 7,
    fdcId: 2685573,
    nutrition: { calories: 23, protein: 1.6, carbs: 4.7, fat: 0.2, fiber: 1.9, sodium: 20, potassium: 274, calcium: 20, iron: 0.3, vitaminC: 67.1 },
  },
  {
    icon: '🥕', name: 'Carrots', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Root Vegetables', storage: 'fridge', shelfLifeDays: 21,
    fdcId: 2258586,
    nutrition: { calories: 45, protein: 0.9, carbs: 10.3, fat: 0.4, fiber: 3.1, sodium: 87, potassium: 280, calcium: 30, iron: 0.2 },
  },
  {
    icon: '🫑', name: 'Bell Peppers', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Peppers & Chiles', storage: 'fridge', shelfLifeDays: 10,
    aliases: ['capsicum', 'sweet peppers'],
  },
  {
    icon: '🌶️', name: 'Jalapeños', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Peppers & Chiles', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2747661,
    nutrition: { calories: 24, protein: 0.6, carbs: 5.1, fat: 0.1, fiber: 1.7, sugar: 2.7, sodium: 0, potassium: 167, calcium: 10, iron: 0.0, vitaminC: 89.9 },
  },
  {
    icon: '🌶️', name: 'Poblano Peppers', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Peppers & Chiles', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2747662,
    nutrition: { calories: 28, protein: 1.4, carbs: 5.1, fat: 0.2, fiber: 2.1, sugar: 2.7, sodium: 0, potassium: 192, calcium: 8, iron: 0.1, vitaminC: 128.4 },
  },
  {
    icon: '🥒', name: 'Cucumber', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Squash & Cucumbers', storage: 'fridge', shelfLifeDays: 7,
    fdcId: 2346406,
    nutrition: { calories: 14, protein: 0.6, carbs: 3.0, fat: 0.2, sodium: 2, potassium: 170, calcium: 16, iron: 0.0 },
  },
  {
    icon: '🥒', name: 'Zucchini', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Squash & Cucumbers', storage: 'fridge', shelfLifeDays: 7,
    aliases: ['courgette'],
    fdcId: 2685568,
    nutrition: { calories: 16, protein: 1.0, carbs: 3.3, fat: 0.2, fiber: 0.8, sodium: 0, potassium: 226, calcium: 21, iron: 0.2, vitaminC: 15.0 },
  },
  {
    icon: '🎃', name: 'Butternut Squash', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Winter Squash', storage: 'pantry', shelfLifeDays: 60,
    fdcId: 2685570,
    nutrition: { calories: 42, protein: 1.1, carbs: 10.5, fat: 0.2, fiber: 2.0, sodium: 0, potassium: 329, calcium: 22, iron: 0.2, vitaminC: 7.6 },
  },
  {
    icon: '🍄', name: 'Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 1999629,
    nutrition: { calories: 25, protein: 2.9, carbs: 4.1, fat: 0.4, fiber: 1.7, sodium: 6, potassium: 373, calcium: 5, iron: 0.2 },
  },
  {
    icon: '🥔', name: 'Potatoes', category: 'Produce', unit: 'Lbs', pantryCategory: 'produce',
    subcategory: 'Potatoes', storage: 'pantry', shelfLifeDays: 21,
    fdcId: 2346401,
    nutrition: { calories: 81, protein: 2.3, carbs: 17.8, fat: 0.4, sugar: 0.5, sodium: 3, potassium: 450, calcium: 8, iron: 0.4, vitaminC: 10.9 },
  },
  {
    icon: '🍠', name: 'Sweet Potatoes', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Potatoes', storage: 'pantry', shelfLifeDays: 21,
    aliases: ['yams'],
    fdcId: 2346404,
    nutrition: { calories: 77, protein: 1.6, carbs: 17.3, fat: 0.4, sugar: 6.1, sodium: 0, potassium: 486, calcium: 22, iron: 0.4, vitaminC: 14.8 },
  },
  {
    icon: '🌽', name: 'Corn', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Fresh Vegetables', storage: 'fridge', shelfLifeDays: 3,
    fdcId: 2710826,
    nutrition: { calories: 73, protein: 2.8, carbs: 14.7, fat: 1.6, fiber: 2.4, sugar: 7.4, sodium: 0, potassium: 237, calcium: 1, iron: 0.4 },
  },
  {
    icon: '🫛', name: 'Green Beans', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Fresh Vegetables', storage: 'fridge', shelfLifeDays: 5,
    aliases: ['string beans', 'snap beans'],
    fdcId: 2346400,
    nutrition: { calories: 34, protein: 2.0, carbs: 7.4, fat: 0.3, fiber: 3.0, sugar: 2.3, sodium: 0, potassium: 290, calcium: 40, iron: 0.7 },
  },
  {
    icon: '🌱', name: 'Asparagus', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Fresh Vegetables', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2710823,
    nutrition: { calories: 24, protein: 1.4, carbs: 5.1, fat: 0.2, fiber: 1.9, sodium: 2, potassium: 278, calcium: 21, iron: 0.4, vitaminC: 9.2 },
  },
  {
    icon: '🍆', name: 'Eggplant', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Fresh Vegetables', storage: 'fridge', shelfLifeDays: 5,
    aliases: ['aubergine'],
    fdcId: 2685577,
    nutrition: { calories: 22, protein: 0.9, carbs: 5.4, fat: 0.1, fiber: 2.4, sugar: 2.4, sodium: 0, potassium: 222, calcium: 11, iron: 0.0, vitaminC: 0.8 },
  },
  {
    icon: '🥑', name: 'Avocado', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Avocados', storage: 'counter', shelfLifeDays: 4,
    fdcId: 2710824,
    nutrition: { calories: 206, protein: 1.8, carbs: 8.3, fat: 20.3, sodium: 0, potassium: 576, calcium: 14, iron: 0.6, vitaminC: 0.0 },
  },
  {
    icon: '🌿', name: 'Celery', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Fresh Vegetables', storage: 'fridge', shelfLifeDays: 14,
    fdcId: 2346405,
    nutrition: { calories: 15, protein: 0.5, carbs: 3.3, fat: 0.2, sodium: 97, potassium: 265, calcium: 46, iron: 0.0 },
  },
  {
    icon: '🌿', name: 'Green Onions', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Green Onions & Leeks', storage: 'fridge', shelfLifeDays: 10,
    aliases: ['scallions', 'spring onions'],
    fdcId: 2727585,
    nutrition: { protein: 0.7, fiber: 2.3, sugar: 2.6, sodium: 10, potassium: 232, calcium: 59, iron: 1.0 },
  },
  {
    icon: '🌿', name: 'Cilantro', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Fresh Herbs', storage: 'fridge', shelfLifeDays: 7,
    aliases: ['fresh coriander'],
  },
  {
    icon: '🌿', name: 'Parsley', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Fresh Herbs', storage: 'fridge', shelfLifeDays: 7,
  },
  {
    icon: '🌿', name: 'Basil', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Fresh Herbs', storage: 'fridge', shelfLifeDays: 7,
  },
  {
    icon: '🌿', name: 'Mint', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Fresh Herbs', storage: 'fridge', shelfLifeDays: 7,
  },
  {
    icon: '🌿', name: 'Dill', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Fresh Herbs', storage: 'fridge', shelfLifeDays: 7,
  },
  {
    icon: '🫚', name: 'Ginger', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Fresh Vegetables', storage: 'fridge', shelfLifeDays: 21,
  },
  {
    icon: '🍋', name: 'Lemons', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Citrus', storage: 'fridge', shelfLifeDays: 21,
  },
  {
    icon: '🍋', name: 'Limes', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Citrus', storage: 'fridge', shelfLifeDays: 21,
  },
  {
    icon: '🍎', name: 'Apples', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Apples & Pears', storage: 'fridge', shelfLifeDays: 30,
    fdcId: 1750339,
    nutrition: { calories: 56, protein: 0.2, carbs: 14.8, fat: 0.2, fiber: 2.0, sugar: 12.2, sodium: 0, potassium: 95, calcium: 5, iron: 0.0 },
  },
  {
    icon: '🍌', name: 'Bananas', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Bananas & Plantains', storage: 'counter', shelfLifeDays: 5,
    fdcId: 1105314,
    portion: { label: '1 Banana (Peeled)', grams: 115.0 },
    nutrition: { calories: 97, protein: 0.7, carbs: 23.0, fat: 0.3, fiber: 1.7, sugar: 15.8, sodium: 0, potassium: 326, calcium: 5, iron: 0.0, vitaminC: 12.3 },
  },
  {
    icon: '🍓', name: 'Strawberries', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Berries', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2346409,
    nutrition: { calories: 33, protein: 0.6, carbs: 8.0, fat: 0.2, sugar: 4.9, sodium: 0, potassium: 161, calcium: 17, iron: 0.3, vitaminC: 59.6 },
  },
  {
    icon: '🫐', name: 'Blueberries', category: 'Produce', unit: 'Cups', pantryCategory: 'produce',
    subcategory: 'Berries', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2346411,
    nutrition: { calories: 57, protein: 0.7, carbs: 14.6, fat: 0.3, sugar: 9.4, sodium: 0, potassium: 86, calcium: 12, iron: 0.3, vitaminC: 8.1 },
  },
  {
    icon: '🫐', name: 'Raspberries', category: 'Produce', unit: 'Cups', pantryCategory: 'produce',
    subcategory: 'Berries', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2346410,
    nutrition: { calories: 51, protein: 1.0, carbs: 12.9, fat: 0.2, sugar: 2.7, sodium: 0, potassium: 156, calcium: 16, iron: 0.5, vitaminC: 23.0 },
  },
  {
    icon: '🍇', name: 'Grapes', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Grapes & Cherries', storage: 'fridge', shelfLifeDays: 7,
  },
  {
    icon: '🍊', name: 'Oranges', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Citrus', storage: 'fridge', shelfLifeDays: 21,
    fdcId: 746771,
    portion: { label: '1 cup (sections no membranes)', grams: 165.0 },
    nutrition: { calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, fiber: 2.0, sugar: 8.6, sodium: 9, potassium: 166, calcium: 43, iron: 0.3, vitaminC: 59.1 },
  },
  {
    icon: '🍍', name: 'Pineapple', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Tropical Fruit', storage: 'counter', shelfLifeDays: 5,
    fdcId: 2346398,
    nutrition: { calories: 54, protein: 0.5, carbs: 14.1, fat: 0.2, fiber: 0.9, sugar: 11.4, sodium: 0, potassium: 137, calcium: 12, iron: 0.1, vitaminC: 58.6 },
  },
  {
    icon: '🥭', name: 'Mango', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Tropical Fruit', storage: 'counter', shelfLifeDays: 5,
    fdcId: 2710833,
    nutrition: { calories: 62, protein: 0.6, carbs: 15.3, fat: 0.6, fiber: 1.8, sugar: 10.7, sodium: 0, potassium: 165, calcium: 12, iron: 0.0, vitaminC: 25.5 },
  },
  {
    icon: '🍑', name: 'Peaches', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Stone Fruit', storage: 'counter', shelfLifeDays: 4,
    fdcId: 325430,
    portion: { label: '1 cup (slices with skin)', grams: 154.0 },
    nutrition: { calories: 42, protein: 0.9, carbs: 10.1, fat: 0.3, fiber: 1.5, sugar: 8.4, sodium: 13, potassium: 122, calcium: 4, iron: 0.3, vitaminC: 4.1 },
  },
  {
    icon: '🍐', name: 'Pears', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Apples & Pears', storage: 'counter', shelfLifeDays: 5,
    fdcId: 746773,
    portion: { label: '1 cup (slices)', grams: 140.0 },
    nutrition: { calories: 57, protein: 0.4, carbs: 15.1, fat: 0.2, fiber: 3.1, sugar: 9.7, sodium: 7, potassium: 87, calcium: 8, iron: 0.2, vitaminC: 4.4 },
  },
  {
    icon: '🍎', name: 'Fuji Apples', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Apples & Pears', storage: 'fridge', shelfLifeDays: 30,
    fdcId: 1750340,
    nutrition: { calories: 58, protein: 0.1, carbs: 15.7, fat: 0.2, fiber: 2.1, sugar: 13.3, sodium: 1, potassium: 104, calcium: 6, iron: 0.0 },
  },
  {
    icon: '🍎', name: 'Gala Apples', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Apples & Pears', storage: 'fridge', shelfLifeDays: 30,
    fdcId: 1750341,
    nutrition: { calories: 55, protein: 0.1, carbs: 14.8, fat: 0.1, fiber: 2.1, sugar: 11.8, sodium: 0, potassium: 106, calcium: 7, iron: 0.1 },
  },
  {
    icon: '🍏', name: 'Granny Smith Apples', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Apples & Pears', storage: 'fridge', shelfLifeDays: 30,
    fdcId: 1750342,
    nutrition: { calories: 53, protein: 0.3, carbs: 14.1, fat: 0.1, fiber: 2.5, sugar: 10.7, sodium: 0, potassium: 116, calcium: 5, iron: 0.1 },
  },
  {
    icon: '🍎', name: 'Honeycrisp Apples', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Apples & Pears', storage: 'fridge', shelfLifeDays: 30,
    fdcId: 1750343,
    nutrition: { calories: 54, protein: 0.1, carbs: 14.7, fat: 0.1, fiber: 1.7, sugar: 12.4, sodium: 0, potassium: 98, calcium: 4, iron: 0.0 },
  },
  {
    icon: '🍑', name: 'Apricots', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Stone Fruit', storage: 'counter', shelfLifeDays: 4,
    fdcId: 2710815,
    nutrition: { calories: 43, protein: 1.0, carbs: 10.2, fat: 0.4, fiber: 1.5, sugar: 6.2, sodium: 0, potassium: 231, calcium: 12, iron: 0.2, vitaminC: 3.1 },
  },
  {
    icon: '🫐', name: 'Blackberries', category: 'Produce', unit: 'Containers', pantryCategory: 'produce',
    subcategory: 'Berries', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2727581,
    nutrition: { protein: 1.5, fiber: 5.3, sugar: 6.5, sodium: 2, potassium: 167, calcium: 15, iron: 0.2, vitaminC: 15.4 },
  },
  {
    icon: '🍒', name: 'Cherries', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Grapes & Cherries', storage: 'fridge', shelfLifeDays: 7,
    fdcId: 2346399,
    nutrition: { calories: 63, protein: 1.0, carbs: 16.2, fat: 0.2, sugar: 13.9, sodium: 0, potassium: 230, calcium: 12, iron: 0.1, vitaminC: 10.4 },
  },
  {
    icon: '🍊', name: 'Grapefruit', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Citrus', storage: 'fridge', shelfLifeDays: 21,
    fdcId: 2758977,
    nutrition: { fiber: 0.7, sugar: 8.0, sodium: 0, potassium: 156, calcium: 21, iron: 0.0, vitaminC: 38.0 },
  },
  {
    icon: '🍇', name: 'Green Grapes', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Grapes & Cherries', storage: 'fridge', shelfLifeDays: 7,
    fdcId: 2346413,
    nutrition: { calories: 72, protein: 0.9, carbs: 18.6, fat: 0.2, sugar: 16.1, sodium: 3, potassium: 218, calcium: 10, iron: 0.2, vitaminC: 3.0 },
  },
  {
    icon: '🍇', name: 'Red Grapes', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Grapes & Cherries', storage: 'fridge', shelfLifeDays: 7,
    fdcId: 2346412,
    nutrition: { calories: 77, protein: 0.9, carbs: 20.2, fat: 0.2, sugar: 17.3, sodium: 7, potassium: 229, calcium: 10, iron: 0.2, vitaminC: 3.3 },
  },
  {
    icon: '🥝', name: 'Kiwi', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Tropical Fruit', storage: 'counter', shelfLifeDays: 5,
    aliases: ['kiwifruit'],
    fdcId: 2710831,
    nutrition: { calories: 58, protein: 1.0, carbs: 13.8, fat: 0.6, fiber: 2.1, sugar: 8.6, sodium: 2, potassium: 302, calcium: 24, iron: 0.0, vitaminC: 58.8 },
  },
  {
    icon: '🍊', name: 'Mandarins', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Citrus', storage: 'fridge', shelfLifeDays: 21,
    aliases: ['clementines', 'tangerines', 'cuties'],
    fdcId: 2710832,
    nutrition: { calories: 56, protein: 1.0, carbs: 13.4, fat: 0.5, fiber: 1.3, sugar: 9.1, sodium: 0, potassium: 167, calcium: 44, iron: 0.0, vitaminC: 21.2 },
  },
  {
    icon: '🥭', name: 'Ataulfo Mango', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Tropical Fruit', storage: 'counter', shelfLifeDays: 5,
    fdcId: 2710834,
    nutrition: { calories: 71, protein: 0.7, carbs: 17.4, fat: 0.7, fiber: 1.3, sugar: 11.1, sodium: 0, potassium: 204, calcium: 10, iron: 0.0, vitaminC: 168.1 },
  },
  {
    icon: '🍈', name: 'Cantaloupe', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Melons', storage: 'counter', shelfLifeDays: 7,
    aliases: ['muskmelon', 'rockmelon'],
    fdcId: 746770,
    portion: { label: '1 cup (cubes)', grams: 160.0 },
    nutrition: { calories: 34, protein: 0.8, carbs: 8.2, fat: 0.2, fiber: 0.8, sugar: 7.9, sodium: 30, potassium: 157, calcium: 9, iron: 0.4, vitaminC: 10.9 },
  },
  {
    icon: '🍈', name: 'Honeydew', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Melons', storage: 'counter', shelfLifeDays: 7,
    fdcId: 2710816,
    nutrition: { calories: 33, protein: 0.5, carbs: 8.1, fat: 0.2, sugar: 7.0, sodium: 21, potassium: 209, calcium: 7, iron: 0.0, vitaminC: 15.7 },
  },
  {
    icon: '🍑', name: 'Nectarines', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Stone Fruit', storage: 'counter', shelfLifeDays: 4,
    fdcId: 327357,
    portion: { label: '1 cup ( slices)', grams: 143.0 },
    nutrition: { calories: 39, protein: 1.1, carbs: 9.2, fat: 0.3, saturatedFat: 0.0, fiber: 1.5, sugar: 7.9, sodium: 13, potassium: 131, calcium: 2, iron: 0.3, vitaminC: 2.9 },
  },
  {
    icon: '🥭', name: 'Pawpaw', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Tropical Fruit', storage: 'counter', shelfLifeDays: 5,
    fdcId: 2727577,
    nutrition: { protein: 1.2, fiber: 3.3, sugar: 14.1, sodium: 0, potassium: 221, calcium: 10, iron: 0.1, vitaminC: 27.6 },
  },
  {
    icon: '🍐', name: 'Anjou Pears', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Apples & Pears', storage: 'counter', shelfLifeDays: 5,
    fdcId: 2710836,
    nutrition: { calories: 57, protein: 0.3, carbs: 14.8, fat: 0.4, fiber: 2.6, sugar: 7.8, sodium: 0, potassium: 122, calcium: 10, iron: 0.0, vitaminC: 5.5 },
  },
  {
    icon: '🍌', name: 'Plantains', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Bananas & Plantains', storage: 'counter', shelfLifeDays: 5,
    fdcId: 2710817,
    nutrition: { calories: 123, protein: 1.2, carbs: 31.0, fat: 0.9, fiber: 2.1, sugar: 14.2, sodium: 0, potassium: 396, calcium: 4, iron: 0.3, vitaminC: 20.1 },
  },
  {
    icon: '🟣', name: 'Plums', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Stone Fruit', storage: 'counter', shelfLifeDays: 4,
    fdcId: 2710837,
    nutrition: { calories: 53, protein: 0.6, carbs: 13.5, fat: 0.3, fiber: 1.3, sugar: 8.0, sodium: 0, potassium: 186, calcium: 4, iron: 0.0, vitaminC: 1.8 },
  },
  {
    icon: '🌿', name: 'Rhubarb', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Fresh Vegetables', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2758975,
    nutrition: { fiber: 1.4, sugar: 0.6, sodium: 0, potassium: 265, calcium: 33, iron: 0.0, vitaminC: 6.9 },
  },
  {
    icon: '🍉', name: 'Watermelon', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Melons', storage: 'counter', shelfLifeDays: 7,
    fdcId: 2747675,
    nutrition: { protein: 0.9, sugar: 7.2, sodium: 0, potassium: 117, calcium: 8, iron: 0.0, vitaminC: 6.5 },
  },
  {
    icon: '🥬', name: 'Arugula', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    aliases: ['rocket'],
    fdcId: 2710822,
    nutrition: { calories: 26, protein: 1.6, carbs: 5.4, fat: 0.3, fiber: 2.3, sodium: 87, potassium: 407, calcium: 204, iron: 1.4, vitaminC: 101.4 },
  },
  {
    icon: '🥬', name: 'Beet Greens', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2747653,
    nutrition: { calories: 26, protein: 1.6, carbs: 4.7, fat: 0.1, fiber: 2.6, sugar: 0.9, sodium: 280, potassium: 369, calcium: 73, iron: 3.2, vitaminC: 8.6 },
  },
  {
    icon: '🟣', name: 'Beets', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Root Vegetables', storage: 'fridge', shelfLifeDays: 21,
    aliases: ['beetroot'],
    fdcId: 2685576,
    nutrition: { calories: 41, protein: 1.7, carbs: 8.8, fat: 0.3, fiber: 3.1, sugar: 5.1, sodium: 112, potassium: 342, calcium: 14, iron: 0.4, vitaminC: 4.6 },
  },
  {
    icon: '🥬', name: 'Brussels Sprouts', category: 'Produce', unit: 'Lbs', pantryCategory: 'produce',
    subcategory: 'Cruciferous Vegetables', storage: 'fridge', shelfLifeDays: 7,
    fdcId: 2685575,
    nutrition: { calories: 49, protein: 4.0, carbs: 9.6, fat: 0.6, fiber: 4.8, sodium: 26, potassium: 477, calcium: 39, iron: 0.7, vitaminC: 142.9 },
  },
  {
    icon: '🥬', name: 'Napa Cabbage', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    aliases: ['chinese cabbage'],
    fdcId: 2727583,
    nutrition: { protein: 1.1, fiber: 1.2, sugar: 2.8, sodium: 13, potassium: 235, calcium: 35, iron: 0.3 },
  },
  {
    icon: '🥬', name: 'Red Cabbage', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Cruciferous Vegetables', storage: 'fridge', shelfLifeDays: 30,
    fdcId: 2346408,
    nutrition: { calories: 30, protein: 1.2, carbs: 6.8, fat: 0.2, sodium: 12, potassium: 269, calcium: 31, iron: 0.0, vitaminC: 53.9 },
  },
  {
    icon: '🥕', name: 'Baby Carrots', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Root Vegetables', storage: 'fridge', shelfLifeDays: 21,
    fdcId: 2258587,
    nutrition: { calories: 38, protein: 0.8, carbs: 9.1, fat: 0.1, fiber: 2.7, sodium: 63, potassium: 237, calcium: 42, iron: 0.1 },
  },
  {
    icon: '🥬', name: 'Collard Greens', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    aliases: ['collards'],
    fdcId: 2685574,
    nutrition: { calories: 39, protein: 3.0, carbs: 7.0, fat: 0.8, fiber: 3.8, sodium: 18, potassium: 410, calcium: 276, iron: 0.8, vitaminC: 89.4 },
  },
  {
    icon: '🌿', name: 'Fennel', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Fresh Vegetables', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2747655,
    nutrition: { calories: 27, protein: 0.9, carbs: 5.5, fat: 0.1, fiber: 2.0, sugar: 3.2, sodium: 49, potassium: 332, calcium: 41, iron: 0.0, vitaminC: 14.7 },
  },
  {
    icon: '🌿', name: 'Leeks', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Green Onions & Leeks', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2727584,
    nutrition: { protein: 1.5, fiber: 3.0, sugar: 3.1, sodium: 18, potassium: 319, calcium: 51, iron: 0.8 },
  },
  {
    icon: '🥬', name: 'Iceberg Lettuce', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2346388,
    nutrition: { calories: 14, protein: 0.7, carbs: 3.4, fat: 0.1, sodium: 16, potassium: 139, calcium: 14, iron: 0.0 },
  },
  {
    icon: '🥬', name: 'Green Leaf Lettuce', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2346391,
    nutrition: { calories: 18, protein: 1.1, carbs: 4.1, fat: 0.2, sodium: 29, potassium: 277, calcium: 40, iron: 0.3, vitaminC: 15.2 },
  },
  {
    icon: '🥬', name: 'Red Leaf Lettuce', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2346390,
    nutrition: { calories: 15, protein: 0.9, carbs: 3.3, fat: 0.1, sodium: 25, potassium: 321, calcium: 43, iron: 0.4, vitaminC: 9.3 },
  },
  {
    icon: '🍄', name: 'Beech Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2003603,
    nutrition: { calories: 33, protein: 2.2, carbs: 6.8, fat: 0.4, fiber: 3.1, sodium: 1, potassium: 376, calcium: 0, iron: 0.7 },
  },
  {
    icon: '🍄', name: 'Cremini Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    aliases: ['crimini mushrooms', 'baby bella mushrooms', 'brown mushrooms'],
    fdcId: 2003601,
    nutrition: { calories: 24, protein: 3.1, carbs: 4.0, fat: 0.2, fiber: 1.8, sodium: 5, potassium: 380, calcium: 4, iron: 0.3 },
  },
  {
    icon: '🍄', name: 'Enoki Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2003600,
    nutrition: { calories: 37, protein: 2.4, carbs: 8.1, fat: 0.2, fiber: 2.9, sodium: 0, potassium: 402, calcium: 1, iron: 1.3 },
  },
  {
    icon: '🍄', name: 'King Oyster Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2003599,
    nutrition: { calories: 38, protein: 2.4, carbs: 8.5, fat: 0.3, fiber: 3.0, sodium: 1, potassium: 294, calcium: 0, iron: 0.3 },
  },
  {
    icon: '🍄', name: 'Lion\'s Mane Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 1999626,
    nutrition: { calories: 35, protein: 2.5, carbs: 7.6, fat: 0.3, fiber: 4.4, sodium: 0, potassium: 443, calcium: 0, iron: 0.7 },
  },
  {
    icon: '🍄', name: 'Maitake Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2003602,
    nutrition: { calories: 31, protein: 2.2, carbs: 6.6, fat: 0.3, fiber: 3.1, sodium: 0, potassium: 260, calcium: 0, iron: 0.2 },
  },
  {
    icon: '🍄', name: 'Oyster Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 1999627,
    nutrition: { calories: 33, protein: 2.9, carbs: 6.9, fat: 0.2, fiber: 2.9, sodium: 1, potassium: 282, calcium: 0, iron: 0.7 },
  },
  {
    icon: '🍄', name: 'Pioppini Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2003604,
    nutrition: { calories: 31, protein: 3.5, carbs: 5.8, fat: 0.2, fiber: 2.8, sodium: 0, potassium: 392, calcium: 0, iron: 0.5 },
  },
  {
    icon: '🍄', name: 'Portobello Mushrooms', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    aliases: ['portabella mushrooms'],
    fdcId: 2003598,
    nutrition: { calories: 26, protein: 2.8, carbs: 4.7, fat: 0.3, fiber: 1.9, sodium: 5, potassium: 349, calcium: 3, iron: 0.1 },
  },
  {
    icon: '🍄', name: 'Shiitake Mushrooms', category: 'Produce', unit: 'Oz', pantryCategory: 'produce',
    subcategory: 'Mushrooms', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 1999628,
    nutrition: { calories: 36, protein: 2.4, carbs: 8.2, fat: 0.2, fiber: 4.2, sodium: 1, potassium: 243, calcium: 1, iron: 0.1 },
  },
  {
    icon: '🧅', name: 'White Onion', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Onions & Garlic', storage: 'pantry', shelfLifeDays: 30,
    fdcId: 1104962,
    nutrition: { calories: 35, protein: 0.9, carbs: 7.7, fat: 0.1, fiber: 1.2, sugar: 5.8, sodium: 2, potassium: 141, calcium: 21, iron: 0.1 },
  },
  {
    icon: '🥕', name: 'Parsnips', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Root Vegetables', storage: 'fridge', shelfLifeDays: 21,
    fdcId: 2747659,
    nutrition: { calories: 87, protein: 1.3, carbs: 19.3, fat: 0.5, fiber: 5.4, sugar: 10.5, sodium: 0, potassium: 493, calcium: 44, iron: 0.5, vitaminC: 11.8 },
  },
  {
    icon: '🌶️', name: 'Banana Peppers', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Peppers & Chiles', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2747660,
    nutrition: { calories: 24, protein: 0.7, carbs: 5.0, fat: 0.1, fiber: 1.8, sugar: 2.7, sodium: 0, potassium: 177, calcium: 10, iron: 0.2, vitaminC: 112.1 },
  },
  {
    icon: '🫑', name: 'Green Bell Pepper', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Peppers & Chiles', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2258588,
    nutrition: { calories: 20, protein: 0.7, carbs: 4.8, fat: 0.1, fiber: 0.9, sodium: 0, potassium: 163, calcium: 7, iron: 0.2, vitaminC: 99.5 },
  },
  {
    icon: '🫑', name: 'Orange Bell Pepper', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Peppers & Chiles', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2258591,
    nutrition: { calories: 27, protein: 0.9, carbs: 6.7, fat: 0.2, fiber: 1.0, sodium: 0, potassium: 201, calcium: 5, iron: 0.4, vitaminC: 158.3 },
  },
  {
    icon: '🫑', name: 'Red Bell Pepper', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Peppers & Chiles', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2258590,
    nutrition: { calories: 27, protein: 0.9, carbs: 6.7, fat: 0.1, fiber: 1.2, sodium: 0, potassium: 213, calcium: 6, iron: 0.4, vitaminC: 141.7 },
  },
  {
    icon: '🫑', name: 'Yellow Bell Pepper', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Peppers & Chiles', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2258589,
    nutrition: { calories: 27, protein: 0.8, carbs: 6.6, fat: 0.1, fiber: 1.1, sodium: 0, potassium: 197, calcium: 7, iron: 0.4, vitaminC: 138.8 },
  },
  {
    icon: '🌶️', name: 'Serrano Peppers', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Peppers & Chiles', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2747663,
    nutrition: { calories: 29, protein: 0.9, carbs: 6.1, fat: 0.1, fiber: 2.5, sugar: 2.5, sodium: 0, potassium: 224, calcium: 13, iron: 0.1, vitaminC: 94.6 },
  },
  {
    icon: '🥔', name: 'Yukon Gold Potatoes', category: 'Produce', unit: 'Lbs', pantryCategory: 'produce',
    subcategory: 'Potatoes', storage: 'pantry', shelfLifeDays: 21,
    fdcId: 2346403,
    nutrition: { calories: 72, protein: 1.8, carbs: 16.0, fat: 0.3, sugar: 0.6, sodium: 2, potassium: 446, calcium: 6, iron: 0.4, vitaminC: 23.3 },
  },
  {
    icon: '🥔', name: 'Red Potatoes', category: 'Produce', unit: 'Lbs', pantryCategory: 'produce',
    subcategory: 'Potatoes', storage: 'pantry', shelfLifeDays: 21,
    fdcId: 2346402,
    nutrition: { calories: 73, protein: 2.1, carbs: 16.3, fat: 0.2, sugar: 0.7, sodium: 3, potassium: 472, calcium: 5, iron: 0.4, vitaminC: 21.3 },
  },
  {
    icon: '🥬', name: 'Radicchio', category: 'Produce', unit: 'Heads', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2747664,
    nutrition: { calories: 26, protein: 1.3, carbs: 5.0, fat: 0.1, fiber: 2.1, sugar: 2.2, sodium: 8, potassium: 335, calcium: 31, iron: 0.4, vitaminC: 6.2 },
  },
  {
    icon: '🔴', name: 'Radishes', category: 'Produce', unit: 'Bunches', pantryCategory: 'produce',
    subcategory: 'Root Vegetables', storage: 'fridge', shelfLifeDays: 21,
    fdcId: 2747665,
    nutrition: { calories: 20, protein: 0.7, carbs: 4.1, fat: 0.1, fiber: 1.3, sugar: 2.6, sodium: 51, potassium: 198, calcium: 22, iron: 0.0, vitaminC: 17.8 },
  },
  {
    icon: '🟡', name: 'Rutabaga', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Root Vegetables', storage: 'fridge', shelfLifeDays: 21,
    fdcId: 2727580,
    nutrition: { protein: 0.9, fiber: 2.9, sugar: 6.0, sodium: 5, potassium: 267, calcium: 42, iron: 0.1 },
  },
  {
    icon: '🥬', name: 'Baby Spinach', category: 'Produce', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Leafy Greens', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 1999632,
    nutrition: { calories: 21, protein: 2.9, carbs: 2.4, fat: 0.6, fiber: 1.6, sodium: 111, potassium: 582, calcium: 68, iron: 1.3, vitaminC: 26.5 },
  },
  {
    icon: '🎃', name: 'Pie Pumpkin', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Winter Squash', storage: 'pantry', shelfLifeDays: 60,
    fdcId: 2727578,
    nutrition: { protein: 0.9, fiber: 2.3, sugar: 4.1, sodium: 0, potassium: 472, calcium: 16, iron: 0.1, vitaminC: 10.1 },
  },
  {
    icon: '🎃', name: 'Spaghetti Squash', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Winter Squash', storage: 'pantry', shelfLifeDays: 60,
    fdcId: 2727579,
    nutrition: { protein: 0.8, fiber: 1.4, sugar: 4.0, sodium: 0, potassium: 267, calcium: 17, iron: 0.0, vitaminC: 5.6 },
  },
  {
    icon: '🟡', name: 'Yellow Squash', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Squash & Cucumbers', storage: 'fridge', shelfLifeDays: 7,
    fdcId: 2685569,
    nutrition: { calories: 19, protein: 0.9, carbs: 4.4, fat: 0.1, fiber: 1.0, sodium: 0, potassium: 220, calcium: 23, iron: 0.1, vitaminC: 17.0 },
  },
  {
    icon: '🎃', name: 'Acorn Squash', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Winter Squash', storage: 'pantry', shelfLifeDays: 60,
    fdcId: 2685571,
    nutrition: { calories: 42, protein: 1.2, carbs: 10.5, fat: 0.2, fiber: 2.6, sodium: 0, potassium: 332, calcium: 25, iron: 0.3, vitaminC: 7.0 },
  },
  {
    icon: '🍅', name: 'Tomatillos', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Fresh Vegetables', storage: 'fridge', shelfLifeDays: 14,
    fdcId: 2727582,
    nutrition: { protein: 1.1, fiber: 1.7, sugar: 2.9, sodium: 0, potassium: 239, calcium: 7, iron: 0.2, vitaminC: 2.2 },
  },
  {
    icon: '🍅', name: 'Roma Tomatoes', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Tomatoes', storage: 'counter', shelfLifeDays: 5,
    fdcId: 1999634,
    nutrition: { calories: 19, protein: 0.7, carbs: 3.8, fat: 0.4, fiber: 1.0, sodium: 0, potassium: 193, calcium: 10, iron: 0.1, vitaminC: 17.8 },
  },
  {
    icon: '🍅', name: 'Grape Tomatoes', category: 'Produce', unit: 'Cups', pantryCategory: 'produce',
    subcategory: 'Tomatoes', storage: 'counter', shelfLifeDays: 5,
    fdcId: 321360,
    portion: { label: '5 tomatoes', grams: 49.7 },
    nutrition: { calories: 27, protein: 0.8, carbs: 5.5, fat: 0.6, fiber: 2.1, sodium: 6, potassium: 260, calcium: 11, iron: 0.3, vitaminC: 27.2 },
  },
  {
    icon: '🟣', name: 'Turnips', category: 'Produce', unit: 'Items', pantryCategory: 'produce',
    subcategory: 'Root Vegetables', storage: 'fridge', shelfLifeDays: 21,
    fdcId: 2747674,
    nutrition: { calories: 34, protein: 1.0, carbs: 7.3, fat: 0.1, fiber: 1.9, sugar: 5.1, sodium: 13, potassium: 262, calcium: 33, iron: 0.0, vitaminC: 26.8 },
  },

  // ============ PROTEINS ============
  {
    icon: '🍗', name: 'Chicken Breast', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Poultry', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2646170,
    nutrition: { calories: 112, protein: 22.5, carbs: 0.0, fat: 1.9, saturatedFat: 0.3, sodium: 66, cholesterol: 73, potassium: 330, calcium: 4, iron: 0.4 },
  },
  {
    icon: '🍗', name: 'Chicken Thighs', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Poultry', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2727567,
    nutrition: { calories: 193, protein: 17.1, carbs: -0.2, fat: 13.3, sodium: 64, cholesterol: 96, potassium: 246, calcium: 6, iron: 0.6 },
  },
  {
    icon: '🍗', name: 'Chicken Wings', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Poultry', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2727568,
    nutrition: { calories: 173, protein: 18.4, carbs: -0.5, fat: 10.6, sodium: 84, cholesterol: 99, potassium: 194, calcium: 14, iron: 0.5 },
  },
  {
    icon: '🍗', name: 'Chicken Drumsticks', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Poultry', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2727566,
    nutrition: { calories: 130, protein: 18.4, carbs: -0.5, fat: 5.9, sodium: 91, cholesterol: 95, potassium: 244, calcium: 8, iron: 0.7 },
  },
  {
    icon: '🍗', name: 'Rotisserie Chicken', category: 'Proteins', unit: 'Items', pantryCategory: 'proteins',
    subcategory: 'Poultry', storage: 'fridge', shelfLifeDays: 4,
    aliases: ['roast chicken'],
  },
  {
    icon: '🍗', name: 'Ground Chicken', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Ground Meat', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2514746,
    nutrition: { calories: 138, protein: 17.9, carbs: 0.0, fat: 7.2, saturatedFat: 1.6, sodium: 63, cholesterol: 82, potassium: 302, calcium: 6, iron: 0.6 },
  },
  {
    icon: '🦃', name: 'Ground Turkey', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Ground Meat', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2514747,
    nutrition: { calories: 158, protein: 17.3, carbs: 0.0, fat: 9.6, saturatedFat: 2.3, sodium: 80, cholesterol: 82, potassium: 246, calcium: 24, iron: 1.1 },
  },
  {
    icon: '🦃', name: 'Turkey Breast', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Poultry', storage: 'fridge', shelfLifeDays: 2,
  },
  {
    icon: '🦃', name: 'Turkey Bacon', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Bacon & Sausage', storage: 'fridge', shelfLifeDays: 14,
  },
  {
    icon: '🥩', name: 'Ground Beef', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Ground Meat', storage: 'fridge', shelfLifeDays: 2,
    aliases: ['hamburger meat', 'minced beef'],
    fdcId: 2514744,
    nutrition: { calories: 248, protein: 17.5, carbs: 0.0, fat: 19.4, saturatedFat: 6.8, sodium: 55, cholesterol: 68, potassium: 273, calcium: 7, iron: 2.0 },
  },
  {
    icon: '🥩', name: 'Steak', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
  },
  {
    icon: '🥩', name: 'Stew Beef', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
  },
  {
    icon: '🥩', name: 'Chuck Roast', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    aliases: ['pot roast'],
    fdcId: 2646174,
    nutrition: { calories: 237, protein: 18.4, carbs: 0.0, fat: 17.8, saturatedFat: 6.3, sodium: 48, cholesterol: 67, potassium: 281, calcium: 5, iron: 2.1 },
  },
  {
    icon: '🍖', name: 'Pork Chops', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Pork', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2727575,
    nutrition: { calories: 145, protein: 22.8, carbs: -0.6, fat: 5.5, sodium: 39, cholesterol: 57, potassium: 366, calcium: 4, iron: 0.4 },
  },
  {
    icon: '🍖', name: 'Pork Tenderloin', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Pork', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2646169,
    nutrition: { calories: 125, protein: 21.6, carbs: 0.0, fat: 3.9, saturatedFat: 0.9, sodium: 41, cholesterol: 60, potassium: 397, calcium: 5, iron: 0.9 },
  },
  {
    icon: '🍖', name: 'Ground Pork', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Ground Meat', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2514745,
    nutrition: { calories: 233, protein: 17.8, carbs: 0.0, fat: 17.5, saturatedFat: 6.3, sodium: 54, cholesterol: 71, potassium: 318, calcium: 6, iron: 0.8 },
  },
  {
    icon: '🍖', name: 'Ham', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Deli Meats', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 746952,
    portion: { label: '1 slice', grams: 16.2 },
    nutrition: { calories: 121, protein: 19.6, carbs: 2.4, fat: 3.7, saturatedFat: 1.2, sugar: 2.2, sodium: 1030, potassium: 484, calcium: 6, iron: 0.9 },
  },
  {
    icon: '🥓', name: 'Bacon', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Bacon & Sausage', storage: 'fridge', shelfLifeDays: 14,
    fdcId: 749420,
    portion: { label: '1 slice', grams: 6.3 },
    nutrition: { calories: 500, protein: 40.9, carbs: 2.1, fat: 36.5, saturatedFat: 12.6, sugar: 3.1, sodium: 1830, potassium: 557, calcium: 13, iron: 1.3 },
  },
  {
    icon: '🌭', name: 'Sausage', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fresh Sausage', storage: 'fridge', shelfLifeDays: 2,
  },
  {
    icon: '🌭', name: 'Breakfast Sausage', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Bacon & Sausage', storage: 'fridge', shelfLifeDays: 14,
    fdcId: 746779,
    portion: { label: '1 link', grams: 18.6 },
    nutrition: { calories: 328, protein: 13.3, carbs: 3.4, fat: 28.7, saturatedFat: 11.3, sugar: 1.0, sodium: 866, cholesterol: 61, potassium: 263, calcium: 35, iron: 1.6, vitaminC: 19.2 },
  },
  {
    icon: '🌭', name: 'Hot Dogs', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Bacon & Sausage', storage: 'fridge', shelfLifeDays: 14,
    aliases: ['frankfurters', 'wieners'],
    fdcId: 323121,
    portion: { label: '1 piece', grams: 48.6 },
    nutrition: { calories: 314, protein: 11.7, carbs: 2.9, fat: 28.0, saturatedFat: 11.4, sugar: 1.3, sodium: 872, potassium: 343, calcium: 15, iron: 1.1 },
  },
  {
    icon: '🍕', name: 'Pepperoni', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Cured Meats', storage: 'fridge', shelfLifeDays: 30,
    fdcId: 2759006,
    nutrition: { saturatedFat: 15.8 },
  },
  {
    icon: '🍖', name: 'Lamb', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Lamb & Game', storage: 'fridge', shelfLifeDays: 4,
  },
  {
    icon: '🐟', name: 'Salmon', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 2684441,
    nutrition: { calories: 203, protein: 20.3, carbs: 0.0, fat: 13.1, saturatedFat: 2.3, sodium: 49, cholesterol: 62, potassium: 378, calcium: 9, iron: 0.3 },
  },
  {
    icon: '🐟', name: 'Tilapia', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 2684442,
    nutrition: { calories: 100, protein: 19.0, carbs: 0.0, fat: 2.5, saturatedFat: 0.6, sodium: 94, cholesterol: 48, potassium: 342, calcium: 9, iron: 0.0 },
  },
  {
    icon: '🐟', name: 'Cod', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 2747654,
    nutrition: { calories: 61, protein: 14.2, carbs: 0.5, fat: 0.2, sodium: 354, potassium: 192, calcium: 9, iron: 0.0 },
  },
  {
    icon: '🐟', name: 'Canned Tuna', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Seafood', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['fish'], aliases: ['tuna fish'],
    fdcId: 334194,
    portion: { label: '1 can (drained solids)', grams: 107.0 },
    nutrition: { calories: 90, protein: 19.0, carbs: 0.1, fat: 0.9, saturatedFat: 0.2, sugar: 0.0, sodium: 219, cholesterol: 36, potassium: 176, calcium: 18, iron: 1.7 },
  },
  {
    icon: '🍤', name: 'Shrimp', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Shellfish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['shellfish'], aliases: ['prawns'],
    fdcId: 2684443,
    nutrition: { calories: 76, protein: 15.6, carbs: 0.5, fat: 0.8, sodium: 475, cholesterol: 136, potassium: 146, calcium: 65, iron: 0.5 },
  },
  {
    icon: '🦀', name: 'Crab Meat', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Seafood', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['shellfish'],
    fdcId: 2684446,
    nutrition: { calories: 86, protein: 18.6, carbs: 0.0, fat: 0.8, sodium: 331, cholesterol: 114, potassium: 235, calcium: 111, iron: 0.6 },
  },
  {
    icon: '🥚', name: 'Egg Whites', category: 'Proteins', unit: 'Cartons', pantryCategory: 'proteins',
    subcategory: 'Eggs', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['eggs'], aliases: ['liquid egg whites'],
    fdcId: 747997,
    portion: { label: '1 egg (white)', grams: 34.0 },
    nutrition: { calories: 55, protein: 10.7, carbs: 2.4, fat: 0.0 },
  },
  {
    icon: '🧊', name: 'Tofu', category: 'Proteins', unit: 'Items', pantryCategory: 'proteins',
    subcategory: 'Plant Proteins', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['soy'],
  },
  {
    icon: '🧊', name: 'Tempeh', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Plant Proteins', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['soy'],
  },
  {
    icon: '🫘', name: 'Black Beans', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2644285,
    nutrition: { calories: 115, protein: 6.9, carbs: 19.8, fat: 1.3, sodium: 218, potassium: 253, calcium: 43, iron: 1.7 },
  },
  {
    icon: '🫘', name: 'Pinto Beans', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2644292,
    nutrition: { calories: 114, protein: 6.7, carbs: 19.6, fat: 1.3, sodium: 202, potassium: 210, calcium: 55, iron: 1.3 },
  },
  {
    icon: '🫘', name: 'Kidney Beans', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2644289,
    nutrition: { calories: 123, protein: 7.8, carbs: 21.0, fat: 1.3, sodium: 172, potassium: 227, calcium: 57, iron: 1.4 },
  },
  {
    icon: '🫘', name: 'White Beans', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🫘', name: 'Refried Beans', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2758984,
    nutrition: { saturatedFat: 0.6, fiber: 3.9 },
  },
  {
    icon: '🫘', name: 'Chickpeas', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    aliases: ['garbanzo beans'],
    fdcId: 2644288,
    nutrition: { calories: 133, protein: 7.0, carbs: 20.3, fat: 3.1, sodium: 202, potassium: 137, calcium: 40, iron: 1.0 },
  },
  {
    icon: '🫘', name: 'Lentils', category: 'Proteins', unit: 'Bags', pantryCategory: 'proteins',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2644283,
    nutrition: { calories: 351, protein: 23.6, carbs: 62.2, fat: 1.9, sodium: 0, potassium: 949, calcium: 62, iron: 7.2 },
  },
  {
    icon: '🥩', name: 'Flank Steak', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2646175,
    nutrition: { calories: 170, protein: 20.1, carbs: 0.0, fat: 9.4, saturatedFat: 3.6, sodium: 51, cholesterol: 58, potassium: 332, calcium: 4, iron: 1.8 },
  },
  {
    icon: '🥩', name: 'Lean Ground Beef', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Ground Meat', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2514743,
    nutrition: { calories: 190, protein: 18.2, carbs: 0.0, fat: 12.8, saturatedFat: 5.1, sodium: 62, cholesterol: 66, potassium: 281, calcium: 7, iron: 2.1 },
  },
  {
    icon: '🥩', name: 'Top Loin Steak', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 746759,
    portion: { label: '1 steak (raw)', grams: 284.0 },
    nutrition: { calories: 155, protein: 22.8, carbs: 0.0, fat: 6.4, saturatedFat: 2.6, sodium: 45, cholesterol: 58, potassium: 282, calcium: 15, iron: 1.9 },
  },
  {
    icon: '🥩', name: 'Ribeye Steak', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2646172,
    nutrition: { calories: 260, protein: 18.7, carbs: 0.0, fat: 20.0, saturatedFat: 8.0, sodium: 43, cholesterol: 63, potassium: 288, calcium: 4, iron: 1.6 },
  },
  {
    icon: '🥩', name: 'Eye of Round Roast', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 746760,
    portion: { label: '1 roast (raw)', grams: 690.0 },
    nutrition: { calories: 122, protein: 23.4, carbs: 0.0, fat: 2.5, saturatedFat: 1.0, sodium: 50, cholesterol: 62, potassium: 312, calcium: 13, iron: 1.4 },
  },
  {
    icon: '🥩', name: 'Top Round Roast', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    aliases: ['london broil'],
    fdcId: 2646173,
    nutrition: { calories: 146, protein: 21.5, carbs: 0.9, fat: 5.7, saturatedFat: 1.7, sodium: 46, cholesterol: 59, potassium: 352, calcium: 4, iron: 1.9 },
  },
  {
    icon: '🥩', name: 'NY Strip Steak', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    aliases: ['new york strip', 'strip steak'],
    fdcId: 2727572,
    nutrition: { calories: 196, protein: 21.3, carbs: 0.2, fat: 11.5, sodium: 43, cholesterol: 58, potassium: 323, calcium: 5, iron: 1.6 },
  },
  {
    icon: '🥩', name: 'Porterhouse Steak', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 746762,
    portion: { label: '1 steak (raw)', grams: 525.0 },
    nutrition: { calories: 145, protein: 22.7, carbs: 0.0, fat: 5.3, saturatedFat: 2.1, sodium: 43, cholesterol: 57, potassium: 266, calcium: 19, iron: 2.3 },
  },
  {
    icon: '🥩', name: 'T-Bone Steak', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 746763,
    portion: { label: '1 steak (cooked)', grams: 360.0 },
    nutrition: { calories: 219, protein: 27.3, carbs: 0.0, fat: 11.4, saturatedFat: 4.7, sodium: 67, cholesterol: 80, potassium: 283, calcium: 19, iron: 3.5 },
  },
  {
    icon: '🥩', name: 'Sirloin Steak', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2727574,
    nutrition: { calories: 146, protein: 22.0, carbs: 0.2, fat: 5.7, sodium: 43, cholesterol: 60, potassium: 349, calcium: 4, iron: 2.2 },
  },
  {
    icon: '🥩', name: 'Beef Tenderloin', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Beef', storage: 'fridge', shelfLifeDays: 4,
    aliases: ['filet mignon'],
    fdcId: 2727573,
    nutrition: { calories: 149, protein: 21.1, carbs: 0.2, fat: 6.5, sodium: 45, cholesterol: 64, potassium: 345, calcium: 4, iron: 2.5 },
  },
  {
    icon: '🐟', name: 'Pollock', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'], aliases: ['alaska pollock'],
    fdcId: 2768188,
    nutrition: { calories: 78, protein: 17.3, carbs: 0.1, fat: 1.0, saturatedFat: 0.2, fiber: 0.0, sodium: 115, cholesterol: 60, potassium: 353, calcium: 40, iron: 0.2 },
  },
  {
    icon: '🐟', name: 'Anchovies', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Seafood', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['fish'],
    fdcId: 2747652,
    nutrition: { calories: 206, protein: 26.9, carbs: 2.4, fat: 9.9, sodium: 5403, potassium: 298, calcium: 240, iron: 2.7 },
  },
  {
    icon: '🐟', name: 'Catfish', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 2684445,
    nutrition: { calories: 134, protein: 16.5, carbs: 0.0, fat: 7.3, saturatedFat: 1.6, sodium: 61, cholesterol: 66, potassium: 292, calcium: 8, iron: 0.0 },
  },
  {
    icon: '🐟', name: 'Haddock', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 333374,
    portion: { label: '1 fillet', grams: 176.0 },
    nutrition: { calories: 74, protein: 16.3, carbs: 0.0, fat: 0.5, saturatedFat: 0.1, sodium: 213, cholesterol: 54, potassium: 286, calcium: 11, iron: 0.2 },
  },
  {
    icon: '🐟', name: 'Sockeye Salmon', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 2684440,
    nutrition: { calories: 136, protein: 22.3, carbs: 0.0, fat: 4.9, saturatedFat: 0.7, sodium: 53, cholesterol: 59, potassium: 330, calcium: 15, iron: 0.4 },
  },
  {
    icon: '🐟', name: 'Halibut', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 2747656,
    nutrition: { calories: 81, protein: 19.1, carbs: -0.1, fat: 0.6, sodium: 108, potassium: 430, calcium: 4, iron: 0.0 },
  },
  {
    icon: '🦞', name: 'Lobster Tails', category: 'Proteins', unit: 'Items', pantryCategory: 'proteins',
    subcategory: 'Shellfish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['shellfish'],
    fdcId: 2747657,
    nutrition: { calories: 59, protein: 13.0, carbs: 0.9, fat: 0.4, sodium: 509, potassium: 213, calcium: 72, iron: 0.2 },
  },
  {
    icon: '🐟', name: 'Mahi Mahi', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 2747658,
    nutrition: { calories: 84, protein: 19.8, carbs: 0.3, fat: 0.4, sodium: 52, potassium: 408, calcium: 6, iron: 0.1 },
  },
  {
    icon: '🦪', name: 'Bay Scallops', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Shellfish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['mollusc'],
    fdcId: 2747666,
    nutrition: { calories: 78, protein: 16.4, carbs: 2.3, fat: 0.4, sodium: 252, potassium: 292, calcium: 14, iron: 0.2 },
  },
  {
    icon: '🦪', name: 'Sea Scallops', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Shellfish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['mollusc'],
    fdcId: 2747667,
    nutrition: { calories: 66, protein: 13.5, carbs: 2.0, fat: 0.5, sodium: 313, potassium: 245, calcium: 11, iron: 0.2 },
  },
  {
    icon: '🐟', name: 'Chilean Sea Bass', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'], aliases: ['patagonian toothfish'],
    fdcId: 2747668,
    nutrition: { calories: 209, protein: 14.9, carbs: 0.1, fat: 16.6, sodium: 109, potassium: 236, calcium: 7, iron: 0.0 },
  },
  {
    icon: '🐟', name: 'Snapper', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 2747669,
    nutrition: { calories: 90, protein: 20.7, carbs: 0.4, fat: 0.6, sodium: 93, potassium: 349, calcium: 14, iron: 0.2 },
  },
  {
    icon: '🦀', name: 'Snow Crab Legs', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Shellfish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['shellfish'],
    fdcId: 2747670,
    nutrition: { calories: 69, protein: 15.5, carbs: 1.1, fat: 0.3, sodium: 728, potassium: 193, calcium: 98, iron: 0.3 },
  },
  {
    icon: '🦑', name: 'Calamari', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Shellfish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['mollusc'], aliases: ['squid'],
    fdcId: 2747671,
    nutrition: { calories: 44, protein: 8.8, carbs: 0.9, fat: 0.6, sodium: 272, potassium: 9, calcium: 11, iron: 0.0 },
  },
  {
    icon: '🐟', name: 'Swordfish', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'],
    fdcId: 2747672,
    nutrition: { calories: 152, protein: 19.2, carbs: 0.4, fat: 8.1, sodium: 57, potassium: 414, calcium: 4, iron: 0.1 },
  },
  {
    icon: '🐟', name: 'Ahi Tuna', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fish', storage: 'fridge', shelfLifeDays: 2,
    allergens: ['fish'], aliases: ['yellowfin tuna'],
    fdcId: 2747673,
    nutrition: { calories: 102, protein: 24.7, carbs: -0.1, fat: 0.4, sodium: 94, potassium: 420, calcium: 3, iron: 0.6 },
  },
  {
    icon: '🥩', name: 'Ground Bison', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Ground Meat', storage: 'fridge', shelfLifeDays: 2,
    aliases: ['buffalo meat'],
    fdcId: 2727571,
    nutrition: { calories: 164, protein: 19.9, carbs: -0.1, fat: 8.9, sodium: 56, cholesterol: 65, potassium: 301, calcium: 7, iron: 2.2 },
  },
  {
    icon: '🍖', name: 'Ground Lamb', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Ground Meat', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2727570,
    nutrition: { calories: 242, protein: 17.5, carbs: -0.3, fat: 18.6, sodium: 53, cholesterol: 75, potassium: 272, calcium: 7, iron: 1.6 },
  },
  {
    icon: '🫘', name: 'Cannellini Beans', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    aliases: ['white kidney beans'],
    fdcId: 2644287,
    nutrition: { calories: 112, protein: 7.4, carbs: 18.8, fat: 1.2, sodium: 164, potassium: 203, calcium: 69, iron: 1.4 },
  },
  {
    icon: '🫘', name: 'Great Northern Beans', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2644294,
    nutrition: { calories: 114, protein: 7.0, carbs: 19.3, fat: 1.3, sodium: 223, potassium: 213, calcium: 67, iron: 1.4 },
  },
  {
    icon: '🫘', name: 'Navy Beans', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    aliases: ['haricot beans'],
    fdcId: 2644286,
    nutrition: { calories: 116, protein: 6.6, carbs: 20.0, fat: 1.4, sodium: 190, potassium: 184, calcium: 64, iron: 1.6 },
  },
  {
    icon: '🫘', name: 'Black-Eyed Peas', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    aliases: ['cowpeas'],
    fdcId: 2644293,
    nutrition: { calories: 113, protein: 6.9, carbs: 19.2, fat: 1.3, sodium: 227, potassium: 138, calcium: 28, iron: 1.1 },
  },
  {
    icon: '🫘', name: 'Vegetarian Refried Beans', category: 'Proteins', unit: 'Cans', pantryCategory: 'proteins',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2758985,
    nutrition: { saturatedFat: 0.2, fiber: 3.9, sodium: 281, potassium: 337, calcium: 31, iron: 1.5 },
  },
  {
    icon: '🥓', name: 'Pork Belly', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Pork', storage: 'fridge', shelfLifeDays: 4,
    aliases: ['side pork'],
    fdcId: 2727576,
    nutrition: { calories: 385, protein: 15.2, carbs: -0.7, fat: 35.8, sodium: 50, cholesterol: 67, potassium: 208, calcium: 4, iron: 0.4 },
  },
  {
    icon: '🍖', name: 'Pork Loin', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Pork', storage: 'fridge', shelfLifeDays: 4,
    fdcId: 2646168,
    nutrition: { calories: 174, protein: 21.1, carbs: 0.0, fat: 9.5, saturatedFat: 3.3, sodium: 40, cholesterol: 56, potassium: 361, calcium: 4, iron: 0.5 },
  },
  {
    icon: '🍗', name: 'Bone-In Chicken Breast', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Poultry', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2727569,
    nutrition: { calories: 133, protein: 21.4, carbs: -0.4, fat: 4.8, sodium: 48, cholesterol: 75, potassium: 332, calcium: 7, iron: 0.4 },
  },
  {
    icon: '🍗', name: 'Boneless Chicken Thighs', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Poultry', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 2646171,
    nutrition: { calories: 149, protein: 18.6, carbs: 0.0, fat: 7.9, saturatedFat: 1.7, sodium: 62, cholesterol: 92, potassium: 272, calcium: 6, iron: 0.6 },
  },
  {
    icon: '🥪', name: 'Bologna', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Deli Meats', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2758991,
    nutrition: { saturatedFat: 9.2 },
  },
  {
    icon: '🥪', name: 'Deli Ham', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Deli Meats', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 332397,
    portion: { label: '1 slice', grams: 13.5 },
    nutrition: { calories: 106, protein: 16.7, carbs: 0.3, fat: 3.7, saturatedFat: 1.1, sodium: 1040, potassium: 425, calcium: 5, iron: 0.6 },
  },
  {
    icon: '🥪', name: 'Deli Chicken', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Deli Meats', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2759004,
    nutrition: { saturatedFat: 0.7, sugar: 1.1 },
  },
  {
    icon: '🥪', name: 'Black Forest Ham', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Deli Meats', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2759002,
    nutrition: { saturatedFat: 1.5 },
  },
  {
    icon: '🥪', name: 'Deli Roast Beef', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Deli Meats', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2759003,
    nutrition: { saturatedFat: 1.8 },
  },
  {
    icon: '🥪', name: 'Deli Turkey', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Deli Meats', storage: 'fridge', shelfLifeDays: 5,
    fdcId: 2759001,
    nutrition: { saturatedFat: 1.0, sugar: 1.0 },
  },
  {
    icon: '🥪', name: 'Salami', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Cured Meats', storage: 'fridge', shelfLifeDays: 30,
    fdcId: 2759005,
    nutrition: { saturatedFat: 13.0 },
  },
  {
    icon: '🌭', name: 'Italian Sausage', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fresh Sausage', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 746780,
    portion: { label: '1 link (medium)', grams: 86.6 },
    nutrition: { calories: 322, protein: 18.2, carbs: 2.1, fat: 26.2, saturatedFat: 9.2, sugar: 1.5, sodium: 766, cholesterol: 80, potassium: 310, calcium: 12, iron: 1.3 },
  },
  {
    icon: '🌭', name: 'Chorizo', category: 'Proteins', unit: 'Lbs', pantryCategory: 'proteins',
    subcategory: 'Fresh Sausage', storage: 'fridge', shelfLifeDays: 2,
    fdcId: 746781,
    portion: { label: '1 link (medium)', grams: 80.4 },
    nutrition: { calories: 346, protein: 19.3, carbs: 2.6, fat: 28.1, saturatedFat: 9.4, sodium: 983, cholesterol: 107, potassium: 435, calcium: 37, iron: 2.3 },
  },
  {
    icon: '🌭', name: 'Turkey Sausage', category: 'Proteins', unit: 'Packages', pantryCategory: 'proteins',
    subcategory: 'Bacon & Sausage', storage: 'fridge', shelfLifeDays: 14,
    fdcId: 746783,
    portion: { label: '1 link', grams: 27.9 },
    nutrition: { calories: 169, protein: 16.7, carbs: 0.9, fat: 10.4, saturatedFat: 2.5, sodium: 599, cholesterol: 78, potassium: 310, calcium: 32, iron: 1.2 },
  },

  // ============ DAIRY / REFRIGERATED ============
  {
    icon: '🥛', name: 'Milk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Milk', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['dairy'],
    fdcId: 746782,
    portion: { label: '1 cup', grams: 249.0 },
    nutrition: { calories: 60, protein: 3.3, carbs: 4.6, fat: 3.2, saturatedFat: 1.9, sugar: 4.8, sodium: 38, cholesterol: 12, potassium: 150, calcium: 123, iron: 0.0 },
  },
  {
    icon: '🥛', name: 'Skim Milk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Milk', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['dairy'],
    fdcId: 746776,
    portion: { label: '1 cup', grams: 246.0 },
    nutrition: { calories: 34, protein: 3.4, carbs: 4.9, fat: 0.1, saturatedFat: 0.0, sugar: 5.0, sodium: 41, cholesterol: 3, potassium: 167, calcium: 132, iron: 0.0 },
  },
  {
    icon: '🥛', name: 'Almond Milk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Plant Milk', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['nuts'],
    fdcId: 2257045,
    nutrition: { calories: 19, protein: 0.7, carbs: 0.7, fat: 1.6, fiber: 0.0, sodium: 59, potassium: 49, calcium: 158, iron: 0.1 },
  },
  {
    icon: '🥛', name: 'Oat Milk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Plant Milk', storage: 'fridge', shelfLifeDays: 7,
    fdcId: 2257046,
    nutrition: { calories: 48, protein: 0.8, carbs: 5.1, fat: 2.7, fiber: 0.0, sugar: 2.3, sodium: 42, potassium: 148, calcium: 148, iron: 0.3 },
  },
  {
    icon: '🥛', name: 'Soy Milk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Plant Milk', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['soy'],
    fdcId: 2257044,
    nutrition: { calories: 41, protein: 2.8, carbs: 3.0, fat: 2.0, fiber: 0.0, sodium: 39, potassium: 118, calcium: 155, iron: 0.4 },
  },
  {
    icon: '🥛', name: 'Heavy Cream', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Cream', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['dairy'], aliases: ['heavy whipping cream', 'whipping cream'],
    fdcId: 2346386,
    nutrition: { calories: 336, protein: 2.0, carbs: 3.8, fat: 35.6, saturatedFat: 20.4, sodium: 21, cholesterol: 103, potassium: 97, calcium: 61, iron: 0.0 },
  },
  {
    icon: '🥛', name: 'Half and Half', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Cream', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['dairy'], aliases: ['half & half'],
  },
  {
    icon: '🥛', name: 'Buttermilk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Milk', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['dairy'], aliases: ['cultured buttermilk'],
    fdcId: 2259792,
    nutrition: { calories: 43, protein: 3.5, carbs: 4.8, fat: 1.1, saturatedFat: 0.6, sodium: 92, cholesterol: 5, potassium: 158, calcium: 120, iron: 0.0 },
  },
  {
    icon: '🥚', name: 'Eggs', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Eggs', storage: 'fridge', shelfLifeDays: 35,
    allergens: ['eggs'],
    fdcId: 748967,
    portion: { label: '1 egg (whole without shell)', grams: 50.3 },
    nutrition: { calories: 148, protein: 12.4, carbs: 1.0, fat: 10.0, saturatedFat: 3.2, fiber: 0.0, sugar: 0.2, sodium: 129, cholesterol: 411, potassium: 132, calcium: 48, iron: 1.7 },
  },
  {
    icon: '🧈', name: 'Butter', category: 'Dairy / Refrigerated', unit: 'Sticks', pantryCategory: 'dairy',
    subcategory: 'Butter', storage: 'fridge', shelfLifeDays: 60,
    allergens: ['dairy'],
    fdcId: 790508,
    nutrition: { fat: 82.2, saturatedFat: 45.6, sugar: 0.6, sodium: 524, cholesterol: 235, potassium: 23, calcium: 21, iron: 0.1 },
  },
  {
    icon: '🧀', name: 'Cheddar Cheese', category: 'Dairy / Refrigerated', unit: 'Bags', pantryCategory: 'dairy',
    subcategory: 'Cheese', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['dairy'],
    fdcId: 328637,
    portion: { label: '1 slice', grams: 17.0 },
    nutrition: { calories: 408, protein: 23.3, carbs: 2.4, fat: 34.0, saturatedFat: 19.2, sugar: 0.3, sodium: 654, cholesterol: 100, potassium: 77, calcium: 707, iron: 0.2 },
  },
  {
    icon: '🧀', name: 'Mozzarella', category: 'Dairy / Refrigerated', unit: 'Bags', pantryCategory: 'dairy',
    subcategory: 'Cheese', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['dairy'],
    fdcId: 329370,
    portion: { label: '1 cup', grams: 86.2 },
    nutrition: { calories: 298, protein: 23.7, carbs: 4.4, fat: 20.4, saturatedFat: 11.7, sugar: 1.8, sodium: 699, cholesterol: 65, potassium: 116, calcium: 693, iron: 0.2 },
  },
  {
    icon: '🧀', name: 'Parmesan', category: 'Dairy / Refrigerated', unit: 'Oz', pantryCategory: 'dairy',
    subcategory: 'Hard Cheese', storage: 'fridge', shelfLifeDays: 60,
    allergens: ['dairy'],
    fdcId: 325036,
    portion: { label: '1 tablespoon', grams: 7.6 },
    nutrition: { calories: 421, protein: 29.6, carbs: 12.4, fat: 28.0, saturatedFat: 15.5, sugar: 0.1, sodium: 1750, cholesterol: 87, potassium: 184, calcium: 884, iron: 0.5 },
  },
  {
    icon: '🧀', name: 'Monterey Jack', category: 'Dairy / Refrigerated', unit: 'Bags', pantryCategory: 'dairy',
    subcategory: 'Cheese', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['dairy'],
    fdcId: 2647438,
    nutrition: { calories: 391, protein: 22.6, carbs: 1.9, fat: 32.6, saturatedFat: 19.2, sodium: 662, cholesterol: 100, potassium: 83, calcium: 715, iron: 0.0 },
  },
  {
    icon: '🧀', name: 'Swiss Cheese', category: 'Dairy / Refrigerated', unit: 'Slices', pantryCategory: 'dairy',
    subcategory: 'Cheese', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['dairy'],
    fdcId: 746767,
    portion: { label: '1 slice (regular)', grams: 21.9 },
    nutrition: { calories: 393, protein: 27.0, carbs: 1.4, fat: 31.0, saturatedFat: 18.2, sugar: 0.0, sodium: 185, cholesterol: 93, potassium: 71, calcium: 890, iron: 0.1 },
  },
  {
    icon: '🧀', name: 'American Cheese', category: 'Dairy / Refrigerated', unit: 'Slices', pantryCategory: 'dairy',
    subcategory: 'Cheese', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['dairy'],
    fdcId: 747429,
    portion: { label: '1 slice', grams: 16.0 },
    nutrition: { calories: 375, protein: 17.5, carbs: 6.3, fat: 31.1, saturatedFat: 17.7, sugar: 3.8, sodium: 1600, potassium: 173, calcium: 508, iron: 0.2 },
  },
  {
    icon: '🧀', name: 'Provolone', category: 'Dairy / Refrigerated', unit: 'Slices', pantryCategory: 'dairy',
    subcategory: 'Cheese', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['dairy'],
    fdcId: 2647440,
    nutrition: { calories: 357, protein: 23.5, carbs: 2.5, fat: 28.1, saturatedFat: 16.2, sodium: 601, cholesterol: 85, potassium: 95, calcium: 749, iron: 0.0 },
  },
  {
    icon: '🧀', name: 'Feta Cheese', category: 'Dairy / Refrigerated', unit: 'Oz', pantryCategory: 'dairy',
    subcategory: 'Soft Cheese', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['dairy'],
    fdcId: 2259796,
    nutrition: { calories: 273, protein: 19.7, carbs: 5.6, fat: 19.1, saturatedFat: 11.2, sugar: 1.6, sodium: 1034, cholesterol: 58, potassium: 105, calcium: 371, iron: 0.1 },
  },
  {
    icon: '🧀', name: 'Goat Cheese', category: 'Dairy / Refrigerated', unit: 'Oz', pantryCategory: 'dairy',
    subcategory: 'Soft Cheese', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['dairy'],
  },
  {
    icon: '🧀', name: 'Ricotta', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Soft Cheese', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['dairy'],
    fdcId: 746766,
    portion: { label: '0.2 cup', grams: 64.6 },
    nutrition: { calories: 157, protein: 7.8, carbs: 6.9, fat: 11.0, saturatedFat: 7.0, sodium: 105, cholesterol: 48, potassium: 230, calcium: 224, iron: 0.1 },
  },
  {
    icon: '🧀', name: 'Cottage Cheese', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Soft Cheese', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['dairy'],
    fdcId: 328841,
    portion: { label: '1 cup', grams: 220.0 },
    nutrition: { calories: 84, protein: 11.0, carbs: 4.3, fat: 2.3, saturatedFat: 1.3, sugar: 4.1, sodium: 321, cholesterol: 12, potassium: 120, calcium: 103, iron: 0.1 },
  },
  {
    icon: '🧀', name: 'Cream Cheese', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Soft Cheese', storage: 'fridge', shelfLifeDays: 21,
    allergens: ['dairy'],
    fdcId: 2346385,
    nutrition: { calories: 337, protein: 5.8, carbs: 4.6, fat: 33.5, saturatedFat: 19.7, sodium: 368, cholesterol: 101, potassium: 125, calcium: 97, iron: 0.0 },
  },
  {
    icon: '🥣', name: 'Greek Yogurt', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Yogurt & Sour Cream', storage: 'fridge', shelfLifeDays: 14,
    allergens: ['dairy'], aliases: ['strained yogurt'],
    fdcId: 330137,
    portion: { label: '1 container', grams: 156.0 },
    nutrition: { calories: 61, protein: 10.3, carbs: 3.6, fat: 0.4, saturatedFat: 0.1, sugar: 3.3, sodium: 36, cholesterol: 5, potassium: 141, calcium: 111, iron: 0.1 },
  },
  {
    icon: '🥣', name: 'Yogurt', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Yogurt & Sour Cream', storage: 'fridge', shelfLifeDays: 14,
    allergens: ['dairy'],
    fdcId: 2647437,
    nutrition: { calories: 50, protein: 4.2, carbs: 8.1, fat: 0.1, sodium: 51, cholesterol: 3, potassium: 210, calcium: 167, iron: 0.0 },
  },
  {
    icon: '🍦', name: 'Sour Cream', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Yogurt & Sour Cream', storage: 'fridge', shelfLifeDays: 14,
    allergens: ['dairy'], aliases: ['crema'],
    fdcId: 2346387,
    nutrition: { calories: 193, protein: 3.1, carbs: 5.6, fat: 18.0, saturatedFat: 10.7, sodium: 50, cholesterol: 53, potassium: 154, calcium: 107, iron: 0.0 },
  },
  {
    icon: '🍨', name: 'Whipped Cream', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Cream', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['dairy'],
  },
  {
    icon: '🥟', name: 'Hummus', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Dips & Spreads', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['sesame'],
    fdcId: 321358,
    portion: { label: '2 tablespoon', grams: 33.9 },
    nutrition: { calories: 229, protein: 7.3, carbs: 14.9, fat: 17.1, saturatedFat: 2.2, fiber: 5.4, sugar: 0.3, sodium: 438, potassium: 289, calcium: 41, iron: 2.4, vitaminC: 0.0 },
  },
  {
    icon: '🍕', name: 'Pizza Dough', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Refrigerated Dough', storage: 'fridge', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🥐', name: 'Crescent Rolls', category: 'Dairy / Refrigerated', unit: 'Cans', pantryCategory: 'dairy',
    subcategory: 'Refrigerated Dough', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['wheat', 'gluten', 'dairy', 'soy'],
  },
  {
    icon: '🥧', name: 'Pie Crust', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Refrigerated Dough', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🧈', name: 'Unsalted Butter', category: 'Dairy / Refrigerated', unit: 'Sticks', pantryCategory: 'dairy',
    subcategory: 'Butter', storage: 'fridge', shelfLifeDays: 60,
    allergens: ['dairy'],
    fdcId: 789828,
    nutrition: { fat: 81.5, sodium: 10, cholesterol: 234, potassium: 19, calcium: 14, iron: 0.0 },
  },
  {
    icon: '🧀', name: 'Cotija Cheese', category: 'Dairy / Refrigerated', unit: 'Oz', pantryCategory: 'dairy',
    subcategory: 'Hard Cheese', storage: 'fridge', shelfLifeDays: 60,
    allergens: ['dairy'], aliases: ['queso cotija'],
    fdcId: 2647443,
    nutrition: { calories: 352, protein: 23.8, carbs: 2.7, fat: 27.2, saturatedFat: 15.9, sodium: 1625, cholesterol: 89, potassium: 117, calcium: 700, iron: 0.0 },
  },
  {
    icon: '🧀', name: 'Queso Seco', category: 'Dairy / Refrigerated', unit: 'Oz', pantryCategory: 'dairy',
    subcategory: 'Hard Cheese', storage: 'fridge', shelfLifeDays: 60,
    allergens: ['dairy'],
    fdcId: 746765,
    portion: { label: '1 cup (grated)', grams: 97.3 },
    nutrition: { calories: 326, protein: 24.5, carbs: 2.1, fat: 24.3, saturatedFat: 13.7, sugar: 0.4, sodium: 1810, cholesterol: 78, potassium: 116, calcium: 661, iron: 0.2 },
  },
  {
    icon: '🧀', name: 'Oaxaca Cheese', category: 'Dairy / Refrigerated', unit: 'Oz', pantryCategory: 'dairy',
    subcategory: 'Cheese', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['dairy'],
    fdcId: 2647441,
    nutrition: { calories: 298, protein: 22.1, carbs: 2.4, fat: 22.1, saturatedFat: 12.7, sodium: 734, cholesterol: 66, potassium: 81, calcium: 532, iron: 0.0 },
  },
  {
    icon: '🧀', name: 'Queso Fresco', category: 'Dairy / Refrigerated', unit: 'Oz', pantryCategory: 'dairy',
    subcategory: 'Soft Cheese', storage: 'fridge', shelfLifeDays: 10,
    allergens: ['dairy'],
    fdcId: 2647442,
    nutrition: { calories: 297, protein: 18.9, carbs: 3.0, fat: 23.4, saturatedFat: 13.9, sodium: 626, cholesterol: 76, potassium: 126, calcium: 602, iron: 0.0 },
  },
  {
    icon: '🥚', name: 'Egg Yolks', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Eggs', storage: 'fridge', shelfLifeDays: 3,
    allergens: ['eggs'],
    fdcId: 748236,
    portion: { label: '1 egg (yolk)', grams: 17.0 },
    nutrition: { calories: 334, protein: 16.2, carbs: 1.0, fat: 28.8 },
  },
  {
    icon: '🥛', name: '1% Milk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Milk', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['dairy'],
    fdcId: 746772,
    portion: { label: '1 cup', grams: 246.0 },
    nutrition: { calories: 43, protein: 3.4, carbs: 5.2, fat: 0.9, saturatedFat: 0.6, sugar: 5.0, sodium: 39, cholesterol: 5, potassium: 159, calcium: 126, iron: 0.0 },
  },
  {
    icon: '🥛', name: '2% Milk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Milk', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['dairy'],
    fdcId: 746778,
    portion: { label: '1 cup', grams: 245.0 },
    nutrition: { calories: 50, protein: 3.4, carbs: 4.9, fat: 1.9, saturatedFat: 1.1, sugar: 4.9, sodium: 39, cholesterol: 8, potassium: 159, calcium: 126, iron: 0.0 },
  },
  {
    icon: '🥣', name: 'Strawberry Greek Yogurt', category: 'Dairy / Refrigerated', unit: 'Items', pantryCategory: 'dairy',
    subcategory: 'Yogurt & Sour Cream', storage: 'fridge', shelfLifeDays: 14,
    allergens: ['dairy'],
    fdcId: 330415,
    portion: { label: '1 container (5.3 oz)', grams: 150.0 },
    nutrition: { calories: 83, protein: 8.1, carbs: 12.2, fat: 0.1, saturatedFat: 0.1, fiber: 0.6, sugar: 11.5, sodium: 32, cholesterol: 4, potassium: 133, calcium: 97, iron: 0.1, vitaminC: 0.2 },
  },
  {
    icon: '🥛', name: 'Chocolate Milk', category: 'Dairy / Refrigerated', unit: 'Cartons', pantryCategory: 'dairy',
    subcategory: 'Milk', storage: 'fridge', shelfLifeDays: 7,
    allergens: ['dairy'],
  },

  // ============ BREAD & BAKERY ============
  {
    icon: '🍞', name: 'Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
    fdcId: 2758993,
    nutrition: { sodium: 420, potassium: 115, calcium: 288, iron: 4.1 },
  },
  {
    icon: '🍞', name: 'Whole Wheat Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
    fdcId: 2758994,
    nutrition: { sodium: 408, potassium: 203, calcium: 132, iron: 2.8 },
  },
  {
    icon: '🍔', name: 'Hamburger Buns', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Rolls & Buns', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🌭', name: 'Hot Dog Buns', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Rolls & Buns', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🥯', name: 'Bagels', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🧇', name: 'English Muffins', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🥐', name: 'Croissants', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten', 'dairy'],
  },
  {
    icon: '🫓', name: 'Pita Bread', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 14,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🫓', name: 'Flour Tortillas', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 14,
    allergens: ['wheat', 'gluten'],
    fdcId: 2758996,
    nutrition: { sodium: 730, potassium: 136, calcium: 138, iron: 3.4 },
  },
  {
    icon: '🌮', name: 'Corn Tortillas', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 14,
    fdcId: 2758997,
    nutrition: { sodium: 35, potassium: 168, calcium: 35, iron: 0.8 },
  },
  {
    icon: '🌮', name: 'Taco Shells', category: 'Bread & Bakery', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 180,
  },
  {
    icon: '🍞', name: 'Multigrain Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
    fdcId: 2758995,
    nutrition: { sodium: 400, potassium: 198, calcium: 106, iron: 2.4 },
  },
  {
    icon: '🥖', name: 'French Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🥖', name: 'Baguette', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Sourdough Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Rye Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Pumpernickel', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Italian Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Ciabatta', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Focaccia', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Brioche', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🍞', name: 'Challah', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten', 'eggs'],
  },
  {
    icon: '🍞', name: 'Potato Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Texas Toast', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten', 'dairy'],
  },
  {
    icon: '🍞', name: 'Cinnamon Raisin Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Banana Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🍞', name: 'Gluten-Free Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
  },
  {
    icon: '🍞', name: 'Keto Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
    allergens: ['eggs', 'nuts'],
  },
  {
    icon: '🍞', name: 'Sprouted Grain Bread', category: 'Bread & Bakery', unit: 'Loaves', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🌽', name: 'Cornbread', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 3,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🫓', name: 'Naan', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 14,
    allergens: ['wheat', 'gluten', 'dairy'],
  },
  {
    icon: '🫓', name: 'Flatbread', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 14,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🫓', name: 'Lavash', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 14,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🫓', name: 'Arepas', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 14,
    aliases: ['arepa flour cakes'],
  },
  {
    icon: '🫓', name: 'Roti', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 14,
    allergens: ['wheat', 'gluten'], aliases: ['chapati'],
  },
  {
    icon: '🍞', name: 'Dinner Rolls', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Rolls & Buns', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten', 'dairy'],
  },
  {
    icon: '🍞', name: 'Sub Rolls', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Rolls & Buns', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'], aliases: ['hoagie rolls'],
  },
  {
    icon: '🍞', name: 'Kaiser Rolls', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Rolls & Buns', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'], aliases: ['hard rolls'],
  },
  {
    icon: '🍞', name: 'Hawaiian Rolls', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Rolls & Buns', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🍔', name: 'Brioche Buns', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Rolls & Buns', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🍞', name: 'Slider Buns', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Rolls & Buns', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🥯', name: 'Everything Bagels', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🥐', name: 'Biscuits', category: 'Bread & Bakery', unit: 'Cans', pantryCategory: 'grains',
    subcategory: 'Refrigerated Dough', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['wheat', 'gluten', 'dairy'],
  },
  {
    icon: '🧁', name: 'Muffins', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🍞', name: 'Scones', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🥨', name: 'Soft Pretzels', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'counter', shelfLifeDays: 2,
    allergens: ['wheat', 'gluten'], aliases: ['pretzels'],
  },
  {
    icon: '🥐', name: 'Danish', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🥐', name: 'Cinnamon Rolls', category: 'Bread & Bakery', unit: 'Cans', pantryCategory: 'grains',
    subcategory: 'Refrigerated Dough', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🍞', name: 'Garlic Bread', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Artisan Bread', storage: 'fridge', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten', 'dairy'],
  },
  {
    icon: '🍞', name: 'Wraps', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Tortillas & Flatbreads', storage: 'pantry', shelfLifeDays: 14,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Breadsticks', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Sliced Bread', storage: 'counter', shelfLifeDays: 5,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Crumpets', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Pan Dulce', category: 'Bread & Bakery', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Breakfast Breads & Pastries', storage: 'counter', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'], aliases: ['conchas', 'mexican sweet bread'],
  },
  {
    icon: '🍞', name: 'Bao Buns', category: 'Bread & Bakery', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Rolls & Buns', storage: 'freezer', shelfLifeDays: 90,
    allergens: ['wheat', 'gluten'], aliases: ['steamed buns'],
  },

  // ============ PANTRY / DRY GOODS ============
  {
    icon: '🍚', name: 'White Rice', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Rice', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2512381,
    nutrition: { calories: 370, protein: 7.0, carbs: 80.3, fat: 1.0, fiber: 0.1, sodium: 0, potassium: 82, calcium: 4, iron: 0.1 },
  },
  {
    icon: '🍚', name: 'Brown Rice', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Rice', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2512380,
    nutrition: { calories: 368, protein: 7.3, carbs: 76.7, fat: 3.3, fiber: 3.0, sodium: 0, potassium: 250, calcium: 8, iron: 1.2 },
  },
  {
    icon: '🍚', name: 'Jasmine Rice', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Rice', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌾', name: 'Quinoa', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🌾', name: 'Couscous', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍝', name: 'Pasta', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍝', name: 'Spaghetti', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['wheat', 'gluten'],
    fdcId: 2758998,
    nutrition: { sodium: 2, potassium: 237, calcium: 18, iron: 3.9 },
  },
  {
    icon: '🍝', name: 'Penne', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍝', name: 'Macaroni', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍝', name: 'Lasagna Noodles', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍝', name: 'Egg Noodles', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['wheat', 'gluten', 'eggs'],
  },
  {
    icon: '🍜', name: 'Rice Noodles', category: 'Pantry / Dry Goods', unit: 'Packages', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍜', name: 'Ramen Noodles', category: 'Pantry / Dry Goods', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['wheat', 'gluten', 'soy'],
  },
  {
    icon: '🥖', name: 'Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'], aliases: ['all-purpose flour', 'ap flour'],
    fdcId: 789890,
    nutrition: { calories: 366, protein: 10.9, carbs: 77.3, fat: 1.5, sodium: 2, potassium: 136, calcium: 19, iron: 5.6 },
  },
  {
    icon: '🥖', name: 'Whole Wheat Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
    fdcId: 790085,
    nutrition: { calories: 370, protein: 15.1, carbs: 71.2, fat: 2.7, fiber: 10.6, sodium: 3, potassium: 376, calcium: 38, iron: 3.9 },
  },
  {
    icon: '🌽', name: 'Cornmeal', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🌽', name: 'Cornstarch', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    aliases: ['corn starch', 'cornflour'],
  },
  {
    icon: '🍞', name: 'Breadcrumbs', category: 'Pantry / Dry Goods', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Snacks & Crackers', storage: 'pantry', shelfLifeDays: 120,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍞', name: 'Panko', category: 'Pantry / Dry Goods', unit: 'Items', pantryCategory: 'grains',
    subcategory: 'Snacks & Crackers', storage: 'pantry', shelfLifeDays: 120,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍘', name: 'Crackers', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Snacks & Crackers', storage: 'pantry', shelfLifeDays: 120,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🌽', name: 'Tortilla Chips', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Snacks & Crackers', storage: 'pantry', shelfLifeDays: 120,
  },
  {
    icon: '🥣', name: 'Oats', category: 'Pantry / Dry Goods', unit: 'Containers', pantryCategory: 'grains',
    subcategory: 'Oats & Cereal', storage: 'pantry', shelfLifeDays: 180,
    aliases: ['rolled oats', 'old fashioned oats'],
    fdcId: 2346396,
    nutrition: { calories: 379, protein: 13.5, carbs: 68.7, fat: 5.9, sodium: 1, potassium: 350, calcium: 46, iron: 4.3 },
  },
  {
    icon: '🥣', name: 'Granola', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Oats & Cereal', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
  },
  {
    icon: '🥣', name: 'Cereal', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Oats & Cereal', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🥞', name: 'Pancake Mix', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Baking Mixes', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🥫', name: 'Canned Tomatoes', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Tomatoes', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2685578,
    nutrition: { calories: 19, protein: 0.9, carbs: 4.3, fat: 0.2, fiber: 0.9, sugar: 2.6, sodium: 112, potassium: 203, calcium: 20, iron: 0.9, vitaminC: 7.7 },
  },
  {
    icon: '🥫', name: 'Tomato Paste', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Tomatoes', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2685580,
    nutrition: { calories: 89, protein: 4.2, carbs: 20.2, fat: 0.7, fiber: 4.7, sugar: 11.7, sodium: 61, potassium: 972, calcium: 37, iron: 3.2, vitaminC: 18.4 },
  },
  {
    icon: '🥫', name: 'Tomato Sauce', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Tomatoes', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2685579,
    nutrition: { calories: 29, protein: 1.4, carbs: 6.3, fat: 0.4, fiber: 1.6, sugar: 3.5, sodium: 417, potassium: 356, calcium: 17, iron: 1.1, vitaminC: 9.2 },
  },
  {
    icon: '🥫', name: 'Coconut Milk', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Vegetables', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🥫', name: 'Cream of Mushroom Soup', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Soups & Broth', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy', 'wheat', 'gluten'],
  },
  {
    icon: '🍲', name: 'Chicken Broth', category: 'Pantry / Dry Goods', unit: 'Cartons', pantryCategory: 'pantry',
    subcategory: 'Soups & Broth', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍲', name: 'Beef Broth', category: 'Pantry / Dry Goods', unit: 'Cartons', pantryCategory: 'pantry',
    subcategory: 'Soups & Broth', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍲', name: 'Vegetable Broth', category: 'Pantry / Dry Goods', unit: 'Cartons', pantryCategory: 'pantry',
    subcategory: 'Soups & Broth', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🥜', name: 'Peanut Butter', category: 'Pantry / Dry Goods', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Nut & Seed Butters', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['peanuts'],
    fdcId: 2758989,
    nutrition: { saturatedFat: 10.0, fiber: 5.2 },
  },
  {
    icon: '🍓', name: 'Jam', category: 'Pantry / Dry Goods', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Jams & Fruit Spreads', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🌰', name: 'Almonds', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
    fdcId: 2346393,
    nutrition: { calories: 584, protein: 21.5, carbs: 20.0, fat: 51.1, saturatedFat: 3.8, fiber: 10.8, sodium: 0, potassium: 733, calcium: 254, iron: 3.7 },
  },
  {
    icon: '🌰', name: 'Walnuts', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
    fdcId: 2346394,
    nutrition: { calories: 679, protein: 14.6, carbs: 10.9, fat: 69.7, saturatedFat: 6.1, fiber: 5.2, sodium: 0, potassium: 424, calcium: 88, iron: 2.2 },
  },
  {
    icon: '🌰', name: 'Pecans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
    fdcId: 2346395,
    nutrition: { calories: 700, protein: 10.0, carbs: 12.7, fat: 73.3, saturatedFat: 6.5, fiber: 5.8, sodium: 0, potassium: 360, calcium: 55, iron: 2.4 },
  },
  {
    icon: '🌰', name: 'Cashews', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
    fdcId: 2515374,
    nutrition: { calories: 533, protein: 17.4, carbs: 36.3, fat: 38.9, fiber: 4.1, sodium: 5, potassium: 638, calcium: 42, iron: 6.0 },
  },
  {
    icon: '🥜', name: 'Peanuts', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['peanuts'],
    fdcId: 2515376,
    nutrition: { calories: 551, protein: 23.2, carbs: 26.5, fat: 43.3, fiber: 8.0, sodium: 1, potassium: 636, calcium: 49, iron: 1.6 },
  },
  {
    icon: '🌻', name: 'Sunflower Seeds', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 325524,
    portion: { label: '1 cup', grams: 127.0 },
    nutrition: { calories: 612, protein: 21.0, carbs: 17.1, fat: 56.1, saturatedFat: 5.4, fiber: 10.3, sugar: 3.1, sodium: 532, potassium: 689, calcium: 78, iron: 5.2, vitaminC: 0.0 },
  },
  {
    icon: '⚪', name: 'Sesame Seeds', category: 'Pantry / Dry Goods', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['sesame'],
  },
  {
    icon: '🍇', name: 'Raisins', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Dried Fruit', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2758980,
    nutrition: { fiber: 3.7, sugar: 66.0, sodium: 13, potassium: 936, calcium: 51, iron: 1.8, vitaminC: 0.0 },
  },
  {
    icon: '🍒', name: 'Dried Cranberries', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Fruit', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2758976,
    nutrition: { fiber: 4.4, sugar: 69.3, sodium: 5, potassium: 64, calcium: 9, iron: 0.1, vitaminC: 0.0 },
  },
  {
    icon: '🌾', name: 'Buckwheat', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2512378,
    nutrition: { calories: 332, protein: 11.1, carbs: 71.1, fat: 3.0, fiber: 4.0, sodium: 0, potassium: 414, calcium: 14, iron: 2.4 },
  },
  {
    icon: '🌾', name: 'Bulgur', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'], aliases: ['bulgur wheat', 'cracked wheat'],
    fdcId: 2710820,
    nutrition: { calories: 349, protein: 11.8, carbs: 75.9, fat: 2.4, fiber: 11.7, sodium: 2, potassium: 358, calcium: 34, iron: 2.6 },
  },
  {
    icon: '⚫', name: 'Chia Seeds', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2710819,
    nutrition: { calories: 490, protein: 17.0, carbs: 38.3, fat: 32.9, sodium: 0, potassium: 642, calcium: 595, iron: 6.0 },
  },
  {
    icon: '🌽', name: 'Masa Harina', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    aliases: ['corn masa flour'],
    fdcId: 2710835,
    nutrition: { calories: 366, protein: 7.6, carbs: 76.7, fat: 4.3, fiber: 7.0, sodium: 3, potassium: 277, calcium: 112, iron: 1.7 },
  },
  {
    icon: '🌾', name: 'Einkorn', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
    fdcId: 2710827,
    nutrition: { calories: 346, protein: 15.1, carbs: 68.7, fat: 3.8, fiber: 8.9, sodium: 0, potassium: 432, calcium: 41, iron: 3.7 },
  },
  {
    icon: '🌾', name: 'Farro', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
    fdcId: 2710828,
    nutrition: { calories: 344, protein: 12.6, carbs: 72.1, fat: 3.1, fiber: 7.3, sodium: 1, potassium: 385, calcium: 26, iron: 3.2 },
  },
  {
    icon: '🥖', name: '00 Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
    fdcId: 2003586,
    nutrition: { calories: 366, protein: 11.4, carbs: 74.4, fat: 1.5, fiber: 2.7, sodium: 0, potassium: 136, calcium: 19, iron: 1.0 },
  },
  {
    icon: '🥖', name: 'Amaranth Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2512371,
    nutrition: { calories: 378, protein: 13.2, carbs: 68.8, fat: 6.2, fiber: 7.2, sodium: 0, potassium: 396, calcium: 135, iron: 7.6 },
  },
  {
    icon: '🥖', name: 'Barley Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['gluten'],
    fdcId: 2512376,
    nutrition: { calories: 357, protein: 8.7, carbs: 77.4, fat: 2.5, fiber: 12.8, sodium: 20, potassium: 367, calcium: 36, iron: 3.3 },
  },
  {
    icon: '🥖', name: 'Bread Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
    fdcId: 790146,
    nutrition: { calories: 363, protein: 14.3, carbs: 72.8, fat: 1.6, sodium: 3, potassium: 127, calcium: 19, iron: 5.5 },
  },
  {
    icon: '🥖', name: 'Buckwheat Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2512374,
    nutrition: { calories: 334, protein: 8.9, carbs: 75.0, fat: 2.5, fiber: 10.3, sodium: 0, potassium: 378, calcium: 31, iron: 3.8 },
  },
  {
    icon: '🌽', name: 'Corn Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 790276,
    nutrition: { calories: 364, protein: 6.2, carbs: 80.8, fat: 1.7, fiber: 4.3, sugar: 1.0, sodium: 0, potassium: 144, calcium: 0, iron: 4.4 },
  },
  {
    icon: '🥖', name: 'Oat Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2261421,
    nutrition: { calories: 386, protein: 13.2, carbs: 69.9, fat: 6.3, fiber: 10.5, sodium: 4, potassium: 373, calcium: 43, iron: 4.0 },
  },
  {
    icon: '🥖', name: 'Pastry Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
    fdcId: 1104913,
    nutrition: { calories: 358, protein: 8.8, carbs: 77.2, fat: 1.6, sodium: 1, potassium: 142, calcium: 17, iron: 0.9 },
  },
  {
    icon: '🥖', name: 'Quinoa Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2512372,
    nutrition: { calories: 378, protein: 11.9, carbs: 69.5, fat: 6.6, fiber: 6.3, sodium: 6, potassium: 551, calcium: 38, iron: 4.5 },
  },
  {
    icon: '🥖', name: 'Brown Rice Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 1104812,
    nutrition: { calories: 365, protein: 7.2, carbs: 75.5, fat: 3.9, sodium: 1, potassium: 265, calcium: 10, iron: 1.5 },
  },
  {
    icon: '🥖', name: 'Glutinous Rice Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    aliases: ['sweet rice flour', 'mochiko'],
    fdcId: 1104867,
    nutrition: { calories: 358, protein: 6.7, carbs: 80.1, fat: 1.2, sodium: 6, potassium: 80, calcium: 10, iron: 0.3 },
  },
  {
    icon: '🥖', name: 'Rice Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 790214,
    nutrition: { calories: 359, protein: 6.9, carbs: 79.8, fat: 1.3, fiber: 0.5, sodium: 5, potassium: 75, calcium: 6, iron: 0.2 },
  },
  {
    icon: '🥖', name: 'Rye Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['gluten'],
    fdcId: 2512375,
    nutrition: { calories: 351, protein: 8.4, carbs: 77.2, fat: 1.9, fiber: 13.7, sodium: 0, potassium: 434, calcium: 32, iron: 2.5 },
  },
  {
    icon: '🥖', name: 'Semolina', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'], aliases: ['durum flour'],
    fdcId: 2003588,
    nutrition: { calories: 365, protein: 11.7, carbs: 73.8, fat: 1.6, fiber: 3.2, sodium: 0, potassium: 174, calcium: 17, iron: 1.5 },
  },
  {
    icon: '🥖', name: 'Sorghum Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2512373,
    nutrition: { calories: 364, protein: 8.3, carbs: 77.4, fat: 3.6, fiber: 6.0, sodium: 0, potassium: 335, calcium: 11, iron: 3.7 },
  },
  {
    icon: '🥖', name: 'Spelt Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
    fdcId: 2003587,
    nutrition: { calories: 341, protein: 14.5, carbs: 70.7, fat: 2.5, fiber: 9.3, sodium: 0, potassium: 350, calcium: 30, iron: 3.8 },
  },
  {
    icon: '🌾', name: 'Fonio', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2710829,
    nutrition: { calories: 377, protein: 7.2, carbs: 81.3, fat: 1.7, fiber: 2.2, sodium: 3, potassium: 44, calcium: 12, iron: 2.7 },
  },
  {
    icon: '🌾', name: 'Khorasan Wheat', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
    fdcId: 2710830,
    nutrition: { calories: 348, protein: 14.8, carbs: 71.8, fat: 2.8, fiber: 10.5, sodium: 4, potassium: 450, calcium: 24, iron: 3.9 },
  },
  {
    icon: '🌾', name: 'Millet', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2512379,
    nutrition: { calories: 381, protein: 10.0, carbs: 74.4, fat: 4.2, fiber: 2.6, sodium: 0, potassium: 214, calcium: 9, iron: 2.5 },
  },
  {
    icon: '🥣', name: 'Steel Cut Oats', category: 'Pantry / Dry Goods', unit: 'Containers', pantryCategory: 'grains',
    subcategory: 'Oats & Cereal', storage: 'pantry', shelfLifeDays: 180,
    aliases: ['irish oats'],
    fdcId: 2346397,
    nutrition: { calories: 379, protein: 12.5, carbs: 69.8, fat: 5.8, sodium: 0, potassium: 376, calcium: 51, iron: 3.8 },
  },
  {
    icon: '🍝', name: 'Whole Wheat Spaghetti', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'grains',
    subcategory: 'Pasta & Noodles', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['wheat', 'gluten'],
    fdcId: 2759000,
    nutrition: { sodium: 5, potassium: 427, calcium: 28, iron: 4.5 },
  },
  {
    icon: '🍚', name: 'Black Rice', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Rice', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2710825,
    nutrition: { calories: 361, protein: 7.6, carbs: 77.2, fat: 3.4, fiber: 4.2, sodium: 0, potassium: 256, calcium: 14, iron: 1.1 },
  },
  {
    icon: '🍚', name: 'Red Rice', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Rice', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2710838,
    nutrition: { calories: 360, protein: 8.6, carbs: 76.2, fat: 3.4, fiber: 4.2, sodium: 0, potassium: 245, calcium: 9, iron: 1.2 },
  },
  {
    icon: '🌾', name: 'Sorghum', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Whole Grains', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2710841,
    nutrition: { calories: 338, protein: 10.2, carbs: 74.9, fat: 3.3, fiber: 3.9, sodium: 0, potassium: 274, calcium: 7, iron: 2.0 },
  },
  {
    icon: '🍚', name: 'Wild Rice', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Rice', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2710821,
    nutrition: { calories: 359, protein: 12.8, carbs: 75.7, fat: 1.7, fiber: 4.3, sodium: 1, potassium: 299, calcium: 8, iron: 1.5 },
  },
  {
    icon: '🥖', name: 'Cassava Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2512377,
    nutrition: { calories: 359, protein: 0.9, carbs: 87.3, fat: 0.5, fiber: 4.8, sodium: 13, potassium: 198, calcium: 75, iron: 4.0 },
  },
  {
    icon: '🥖', name: 'Potato Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2261422,
    nutrition: { calories: 353, protein: 8.1, carbs: 79.9, fat: 1.0, fiber: 5.4, sodium: 48, potassium: 1269, calcium: 44, iron: 12.0 },
  },
  {
    icon: '🥖', name: 'Soy Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['soy'],
    fdcId: 1104705,
    nutrition: { calories: 366, protein: 51.1, carbs: 32.9, fat: 3.3, sodium: 2, potassium: 2480, calcium: 338, iron: 7.3 },
  },
  {
    icon: '🥖', name: 'Almond Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['nuts'],
    fdcId: 2261420,
    nutrition: { calories: 578, protein: 26.2, carbs: 16.2, fat: 50.2, fiber: 9.3, sodium: 1, potassium: 667, calcium: 232, iron: 3.2 },
  },
  {
    icon: '🥖', name: 'Chestnut Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['nuts'],
    fdcId: 2515377,
    nutrition: { calories: 385, protein: 5.3, carbs: 80.5, fat: 4.6, saturatedFat: 0.7, fiber: 8.7, sodium: 0, potassium: 1032, calcium: 56, iron: 1.6, vitaminC: 4.0 },
  },
  {
    icon: '🥖', name: 'Coconut Flour', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'grains',
    subcategory: 'Flour & Meal', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2515382,
    nutrition: { calories: 424, protein: 16.1, carbs: 58.9, fat: 15.3, saturatedFat: 14.0, fiber: 34.2, sodium: 47, potassium: 2088, calcium: 36, iron: 8.0 },
  },
  {
    icon: '🍎', name: 'Applesauce', category: 'Pantry / Dry Goods', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Jams & Fruit Spreads', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2346414,
    nutrition: { calories: 46, protein: 0.3, carbs: 12.3, fat: 0.2, sugar: 9.7, sodium: 1, potassium: 108, calcium: 4, iron: 0.0, vitaminC: 43.7 },
  },
  {
    icon: '🟤', name: 'Dried Figs', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Fruit', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 746768,
    portion: { label: '1 cup', grams: 149.0 },
    nutrition: { calories: 249, protein: 3.3, carbs: 63.9, fat: 0.9, fiber: 9.8, sugar: 47.9, sodium: 10, potassium: 680, calcium: 162, iron: 2.0, vitaminC: 1.2 },
  },
  {
    icon: '🟣', name: 'Prunes', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Fruit', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2758978,
    nutrition: { fiber: 6.3, sugar: 31.4, sodium: 1, potassium: 788, calcium: 44, iron: 0.7, vitaminC: 0.0 },
  },
  {
    icon: '🍇', name: 'Golden Raisins', category: 'Pantry / Dry Goods', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Dried Fruit', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2758979,
    nutrition: { fiber: 3.0, sugar: 68.7, sodium: 13, potassium: 869, calcium: 59, iron: 2.3, vitaminC: 2.6 },
  },
  {
    icon: '🫘', name: 'Baked Beans', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2758982,
    nutrition: { saturatedFat: 0.2, fiber: 3.5, sugar: 8.8 },
  },
  {
    icon: '🫘', name: 'Vegetarian Baked Beans', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Beans', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2758983,
    nutrition: { saturatedFat: 0.1, fiber: 4.2, sugar: 8.2 },
  },
  {
    icon: '🫘', name: 'Dry Black Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747444,
  },
  {
    icon: '🫘', name: 'Dry Carioca Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747436,
  },
  {
    icon: '🫘', name: 'Dry Cranberry Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747437,
  },
  {
    icon: '🫘', name: 'Dry Kidney Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747440,
  },
  {
    icon: '🫘', name: 'Dry Flor de Mayo Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747432,
  },
  {
    icon: '🫘', name: 'Dry Great Northern Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747446,
  },
  {
    icon: '🫘', name: 'Dry Navy Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747441,
  },
  {
    icon: '🫘', name: 'Dry Pink Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747439,
  },
  {
    icon: '🫘', name: 'Dry Pinto Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747445,
  },
  {
    icon: '🫘', name: 'Dry Small Red Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747443,
  },
  {
    icon: '🫘', name: 'Dry Small White Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 747442,
  },
  {
    icon: '🫘', name: 'Dry Cannellini Beans', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2644281,
    nutrition: { calories: 337, protein: 21.6, carbs: 59.8, fat: 2.2, sodium: 0, potassium: 1424, calcium: 143, iron: 6.7 },
  },
  {
    icon: '🫘', name: 'Dry Black-Eyed Peas', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2644284,
    nutrition: { calories: 346, protein: 21.2, carbs: 61.8, fat: 2.4, sodium: 3, potassium: 1243, calcium: 71, iron: 5.9 },
  },
  {
    icon: '🫘', name: 'Dry Chickpeas', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Dried Beans & Lentils', storage: 'pantry', shelfLifeDays: 730,
    aliases: ['dried garbanzo beans'],
    fdcId: 2644282,
    nutrition: { calories: 372, protein: 21.3, carbs: 60.4, fat: 6.3, sodium: 9, potassium: 1074, calcium: 111, iron: 5.1 },
  },
  {
    icon: '🌰', name: 'Almond Butter', category: 'Pantry / Dry Goods', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Nut & Seed Butters', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['nuts'],
    fdcId: 2262074,
    nutrition: { calories: 603, protein: 20.8, carbs: 21.2, fat: 53.0, saturatedFat: 4.3, fiber: 9.7, sodium: 1, potassium: 745, calcium: 264, iron: 4.1 },
  },
  {
    icon: '🟤', name: 'Ground Flaxseed', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    aliases: ['flax meal', 'flaxseed meal'],
    fdcId: 2262075,
    nutrition: { calories: 514, protein: 18.0, carbs: 34.4, fat: 37.3, saturatedFat: 3.3, fiber: 23.1, sodium: 37, potassium: 793, calcium: 230, iron: 5.8 },
  },
  {
    icon: '🌰', name: 'Roasted Almonds', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
    fdcId: 323294,
    portion: { label: '1 cup (whole)', grams: 135.0 },
    nutrition: { calories: 620, protein: 20.4, carbs: 16.2, fat: 57.8, saturatedFat: 4.6, fiber: 11.0, sugar: 4.2, sodium: 256, potassium: 684, calcium: 273, iron: 3.2, vitaminC: 0.0 },
  },
  {
    icon: '🌰', name: 'Brazil Nuts', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
    fdcId: 2515373,
    nutrition: { calories: 621, protein: 15.0, carbs: 21.6, fat: 57.4, fiber: 6.0, sodium: 0, potassium: 592, calcium: 168, iron: 2.5 },
  },
  {
    icon: '🌰', name: 'Hazelnuts', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'], aliases: ['filberts'],
    fdcId: 2515375,
    nutrition: { calories: 602, protein: 13.5, carbs: 26.5, fat: 53.5, fiber: 8.4, sodium: 0, potassium: 636, calcium: 135, iron: 3.5 },
  },
  {
    icon: '🌰', name: 'Macadamia Nuts', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
    fdcId: 2515378,
    nutrition: { calories: 669, protein: 7.8, carbs: 24.1, fat: 64.9, fiber: 7.6, sodium: 0, potassium: 373, calcium: 53, iron: 1.9 },
  },
  {
    icon: '🌰', name: 'Pine Nuts', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'], aliases: ['pignoli'],
    fdcId: 2346392,
    nutrition: { calories: 643, protein: 15.7, carbs: 18.6, fat: 61.3, fiber: 3.9, sodium: 0, potassium: 655, calcium: 9, iron: 5.4 },
  },
  {
    icon: '🌰', name: 'Pistachios', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
    fdcId: 2515379,
    nutrition: { calories: 561, protein: 20.5, carbs: 27.7, fat: 45.0, fiber: 7.0, sodium: 0, potassium: 947, calcium: 117, iron: 3.5 },
  },
  {
    icon: '🎃', name: 'Pumpkin Seeds', category: 'Pantry / Dry Goods', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Nuts & Seeds', storage: 'pantry', shelfLifeDays: 180,
    aliases: ['pepitas'],
    fdcId: 2515380,
    nutrition: { calories: 515, protein: 29.9, carbs: 18.7, fat: 40.0, fiber: 5.1, sodium: 0, potassium: 691, calcium: 37, iron: 8.4 },
  },
  {
    icon: '🫛', name: 'Canned Green Beans', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Vegetables', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 321611,
    portion: { label: '1 cup (drained)', grams: 129.0 },
    nutrition: { calories: 21, protein: 1.0, carbs: 4.1, fat: 0.4, sugar: 1.3, sodium: 282, potassium: 97, calcium: 36, iron: 0.8 },
  },
  {
    icon: '🫛', name: 'Canned Peas', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Vegetables', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2644291,
    nutrition: { calories: 78, protein: 4.7, carbs: 12.7, fat: 1.2, sodium: 207, potassium: 109, calcium: 28, iron: 1.1 },
  },
  {
    icon: '🥫', name: 'Tomato Puree', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Tomatoes', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2685582,
    nutrition: { calories: 35, protein: 1.6, carbs: 8.0, fat: 0.3, fiber: 2.0, sugar: 4.3, sodium: 29, potassium: 416, calcium: 18, iron: 1.2, vitaminC: 10.4 },
  },
  {
    icon: '🥫', name: 'Diced Tomatoes', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Tomatoes', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 333281,
    portion: { label: '1 cup', grams: 245.0 },
    nutrition: { calories: 18, protein: 0.8, carbs: 3.3, fat: 0.5, sugar: 3.0, sodium: 125, potassium: 198, calcium: 30, iron: 0.6 },
  },
  {
    icon: '🥫', name: 'Crushed Tomatoes', category: 'Pantry / Dry Goods', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Canned Tomatoes', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 2685581,
    nutrition: { calories: 32, protein: 1.4, carbs: 7.1, fat: 0.4, fiber: 1.9, sugar: 3.7, sodium: 140, potassium: 346, calcium: 19, iron: 2.3, vitaminC: 9.1 },
  },

  // ============ BAKING & SWEETS ============
  {
    icon: '🍬', name: 'Sugar', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 746784,
    portion: { label: '1 teaspoon', grams: 4.0 },
    nutrition: { calories: 385, protein: 0.0, carbs: 99.6, fat: 0.3, sugar: 99.8, sodium: 1, potassium: 2, calcium: 1, iron: 0.1 },
  },
  {
    icon: '🟤', name: 'Brown Sugar', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍬', name: 'Powdered Sugar', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
    aliases: ['confectioners\' sugar', 'confectioners sugar', 'icing sugar'],
  },
  {
    icon: '🍯', name: 'Honey', category: 'Baking & Sweets', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍁', name: 'Maple Syrup', category: 'Baking & Sweets', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🧁', name: 'Baking Powder', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Leaveners', storage: 'pantry', shelfLifeDays: 180,
  },
  {
    icon: '🧁', name: 'Baking Soda', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Leaveners', storage: 'pantry', shelfLifeDays: 540,
    aliases: ['bicarbonate of soda', 'sodium bicarbonate'],
  },
  {
    icon: '🍞', name: 'Yeast', category: 'Baking & Sweets', unit: 'Packets', pantryCategory: 'pantry',
    subcategory: 'Leaveners', storage: 'pantry', shelfLifeDays: 120,
  },
  {
    icon: '🤎', name: 'Vanilla Extract', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Baking Staples', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🍫', name: 'Cocoa Powder', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Baking Staples', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🍪', name: 'Chocolate Chips', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Chocolate & Chips', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy', 'soy'], aliases: ['semi-sweet chocolate chips', 'semisweet chocolate chips'],
  },
  {
    icon: '🍫', name: 'Dark Chocolate', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Chocolate & Chips', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy', 'soy'],
  },
  {
    icon: '🍫', name: 'Cake Mix', category: 'Baking & Sweets', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Baking Mixes', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🧁', name: 'Frosting', category: 'Baking & Sweets', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Toppings & Syrups', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy', 'soy'],
  },
  {
    icon: '🍮', name: 'Instant Pudding', category: 'Baking & Sweets', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Baking Mixes', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy'],
  },
  {
    icon: '🍡', name: 'Marshmallows', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Baking Staples', storage: 'pantry', shelfLifeDays: 180,
  },
  {
    icon: '🍪', name: 'Graham Crackers', category: 'Baking & Sweets', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Baking Staples', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🥥', name: 'Shredded Coconut', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Baking Staples', storage: 'pantry', shelfLifeDays: 180,
  },
  {
    icon: '🥫', name: 'Sweetened Condensed Milk', category: 'Baking & Sweets', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Baking Staples', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['dairy'],
    fdcId: 2758990,
    nutrition: { saturatedFat: 4.8, sugar: 54.1 },
  },
  {
    icon: '🥫', name: 'Evaporated Milk', category: 'Baking & Sweets', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Baking Staples', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['dairy'],
  },
  {
    icon: '🍬', name: 'Caramels', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'pantry', shelfLifeDays: 60,
    allergens: ['dairy'],
  },
  {
    icon: '🍮', name: 'Gelatin', category: 'Baking & Sweets', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Baking Mixes', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍪', name: 'Oatmeal Raisin Cookies', category: 'Baking & Sweets', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'pantry', shelfLifeDays: 60,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
    fdcId: 333008,
    portion: { label: '1 cookie', grams: 27.0 },
    nutrition: { calories: 430, protein: 5.8, carbs: 69.6, fat: 14.3, saturatedFat: 4.8, fiber: 3.3, sugar: 34.8, sodium: 314, potassium: 245, calcium: 29, iron: 2.3 },
  },
  {
    icon: '🍫', name: 'Milk Chocolate', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Chocolate & Chips', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy', 'soy'],
  },
  {
    icon: '🍫', name: 'White Chocolate Chips', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Chocolate & Chips', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy', 'soy'],
  },
  {
    icon: '🍫', name: 'Butterscotch Chips', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Chocolate & Chips', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy', 'soy'],
  },
  {
    icon: '🍭', name: 'Sprinkles', category: 'Baking & Sweets', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Toppings & Syrups', storage: 'pantry', shelfLifeDays: 365,
    aliases: ['jimmies', 'nonpareils'],
  },
  {
    icon: '🍬', name: 'Corn Syrup', category: 'Baking & Sweets', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍫', name: 'Chocolate Syrup', category: 'Baking & Sweets', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Toppings & Syrups', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍮', name: 'Caramel Sauce', category: 'Baking & Sweets', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Toppings & Syrups', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy'],
  },
  {
    icon: '🍯', name: 'Molasses', category: 'Baking & Sweets', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍯', name: 'Agave Nectar', category: 'Baking & Sweets', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍬', name: 'Stevia', category: 'Baking & Sweets', unit: 'Packets', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍬', name: 'Coconut Sugar', category: 'Baking & Sweets', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Sugar & Sweeteners', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌰', name: 'Nutella', category: 'Baking & Sweets', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Nut & Seed Butters', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['nuts', 'dairy', 'soy'],
  },
  {
    icon: '🍪', name: 'Cookie Dough', category: 'Baking & Sweets', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Refrigerated Dough', storage: 'fridge', shelfLifeDays: 30,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🍪', name: 'Brownie Mix', category: 'Baking & Sweets', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Baking Mixes', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍪', name: 'Cookies', category: 'Baking & Sweets', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'pantry', shelfLifeDays: 60,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'], aliases: ['biscuits (uk)'],
  },
  {
    icon: '🍪', name: 'Sandwich Cookies', category: 'Baking & Sweets', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'pantry', shelfLifeDays: 60,
    allergens: ['wheat', 'gluten', 'soy'],
  },
  {
    icon: '🍩', name: 'Donuts', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'counter', shelfLifeDays: 2,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs', 'soy'],
  },
  {
    icon: '🧁', name: 'Cupcakes', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'fridge', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🍰', name: 'Cake', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'fridge', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten', 'dairy', 'eggs'],
  },
  {
    icon: '🥧', name: 'Pie', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'fridge', shelfLifeDays: 4,
    allergens: ['wheat', 'gluten', 'dairy'],
  },
  {
    icon: '🍦', name: 'Frozen Yogurt', category: 'Baking & Sweets', unit: 'Containers', pantryCategory: 'pantry',
    subcategory: 'Frozen Desserts', storage: 'freezer', shelfLifeDays: 60,
    allergens: ['dairy'],
  },
  {
    icon: '🍡', name: 'Mochi', category: 'Baking & Sweets', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Frozen Desserts', storage: 'freezer', shelfLifeDays: 60,
  },
  {
    icon: '🍮', name: 'Flan', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'fridge', shelfLifeDays: 4,
    allergens: ['dairy', 'eggs'],
  },
  {
    icon: '🍫', name: 'Fudge', category: 'Baking & Sweets', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Desserts & Treats', storage: 'pantry', shelfLifeDays: 60,
    allergens: ['dairy'],
  },

  // ============ CANDY ============
  {
    icon: '🍫', name: 'Chocolate Bars', category: 'Candy', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Chocolate Candy', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['dairy', 'soy'],
  },
  {
    icon: '🍫', name: 'Dark Chocolate Bars', category: 'Candy', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Chocolate Candy', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['dairy', 'soy'],
  },
  {
    icon: '🍫', name: 'Peanut Butter Cups', category: 'Candy', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Chocolate Candy', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['peanuts', 'dairy', 'soy'], aliases: ['peanut butter chocolate cups'],
  },
  {
    icon: '🍫', name: 'Candy-Coated Chocolates', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Chocolate Candy', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['dairy', 'soy'], aliases: ['chocolate candies'],
  },
  {
    icon: '🍫', name: 'Chocolate Truffles', category: 'Candy', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Chocolate Candy', storage: 'pantry', shelfLifeDays: 60,
    allergens: ['dairy', 'soy'],
  },
  {
    icon: '🍫', name: 'Chocolate Covered Pretzels', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Chocolate Candy', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['wheat', 'gluten', 'dairy', 'soy'],
  },
  {
    icon: '🍫', name: 'Chocolate Covered Almonds', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Chocolate Candy', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['nuts', 'dairy', 'soy'],
  },
  {
    icon: '🍫', name: 'Toffee', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Specialty Candy', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['dairy'],
  },
  {
    icon: '🐻', name: 'Gummy Bears', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Gummy & Chewy Candy', storage: 'pantry', shelfLifeDays: 365,
    aliases: ['gummies'],
  },
  {
    icon: '🪱', name: 'Gummy Worms', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Gummy & Chewy Candy', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍬', name: 'Sour Gummies', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Gummy & Chewy Candy', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍬', name: 'Fruit Chews', category: 'Candy', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Gummy & Chewy Candy', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍬', name: 'Jelly Beans', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Gummy & Chewy Candy', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍬', name: 'Licorice', category: 'Candy', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Gummy & Chewy Candy', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['wheat', 'gluten'],
  },
  {
    icon: '🍬', name: 'Sour Candy', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Gummy & Chewy Candy', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍬', name: 'Hard Candy', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Hard Candy & Mints', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍭', name: 'Lollipops', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Hard Candy & Mints', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍬', name: 'Peppermints', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Hard Candy & Mints', storage: 'pantry', shelfLifeDays: 730,
    aliases: ['breath mints'],
  },
  {
    icon: '🍬', name: 'Butterscotch Candy', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Hard Candy & Mints', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['dairy'],
  },
  {
    icon: '🍬', name: 'Caramel Candy', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Gummy & Chewy Candy', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy'],
  },
  {
    icon: '🍬', name: 'Taffy', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Gummy & Chewy Candy', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy', 'soy'], aliases: ['salt water taffy'],
  },
  {
    icon: '🍬', name: 'Candy Corn', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Specialty Candy', storage: 'pantry', shelfLifeDays: 180,
  },
  {
    icon: '🍭', name: 'Cotton Candy', category: 'Candy', unit: 'Containers', pantryCategory: 'pantry',
    subcategory: 'Specialty Candy', storage: 'pantry', shelfLifeDays: 180,
    aliases: ['candy floss'],
  },
  {
    icon: '🍬', name: 'Rock Candy', category: 'Candy', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Hard Candy & Mints', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍬', name: 'Candy Canes', category: 'Candy', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Hard Candy & Mints', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍬', name: 'Gum', category: 'Candy', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Hard Candy & Mints', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍬', name: 'Malted Milk Balls', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Chocolate Candy', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['dairy', 'wheat', 'gluten', 'soy'],
  },
  {
    icon: '🍬', name: 'Nougat', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Specialty Candy', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['eggs'],
  },
  {
    icon: '🍬', name: 'Brittle', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Specialty Candy', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['peanuts'],
  },
  {
    icon: '🍬', name: 'Marzipan', category: 'Candy', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Specialty Candy', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['nuts'],
  },
  {
    icon: '🍬', name: 'Halva', category: 'Candy', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Specialty Candy', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['sesame'],
  },
  {
    icon: '🍬', name: 'Tamarind Candy', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Specialty Candy', storage: 'pantry', shelfLifeDays: 180,
  },
  {
    icon: '🌶️', name: 'Chili Mango Candy', category: 'Candy', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Specialty Candy', storage: 'pantry', shelfLifeDays: 180,
  },

  // ============ CONDIMENTS & SAUCES ============
  {
    icon: '🫒', name: 'Olive Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 748608,
    portion: { label: '100 milliliter', grams: 90.7 },
    nutrition: { saturatedFat: 15.4 },
  },
  {
    icon: '🛢️', name: 'Vegetable Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 748366,
    portion: { label: '100 milliliter', grams: 91.3 },
    nutrition: { saturatedFat: 14.9 },
  },
  {
    icon: '🥥', name: 'Coconut Oil', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 730,
    fdcId: 330458,
    portion: { label: '1 tablespoon (liquid oil)', grams: 11.6 },
    nutrition: { calories: 833, protein: 0.0, carbs: 0.8, fat: 99.1, saturatedFat: 82.5, sodium: 0, potassium: 0, calcium: 1, iron: 0.1 },
  },
  {
    icon: '🫙', name: 'Sesame Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['sesame'],
  },
  {
    icon: '🍶', name: 'Soy Sauce', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Asian Sauces', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['soy', 'wheat', 'gluten'],
  },
  {
    icon: '🍶', name: 'Low Sodium Soy Sauce', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Asian Sauces', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['soy', 'wheat', 'gluten'],
  },
  {
    icon: '🍶', name: 'Teriyaki Sauce', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Asian Sauces', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['soy', 'wheat', 'gluten'],
  },
  {
    icon: '🍶', name: 'Hoisin Sauce', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Asian Sauces', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['soy'],
  },
  {
    icon: '🐟', name: 'Fish Sauce', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Asian Sauces', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['fish'],
  },
  {
    icon: '🍶', name: 'Worcestershire Sauce', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Asian Sauces', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['fish'],
  },
  {
    icon: '🧴', name: 'Vinegar', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Vinegar', storage: 'pantry', shelfLifeDays: 1825,
  },
  {
    icon: '🧴', name: 'Apple Cider Vinegar', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Vinegar', storage: 'pantry', shelfLifeDays: 1825,
  },
  {
    icon: '🧴', name: 'Rice Vinegar', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Vinegar', storage: 'pantry', shelfLifeDays: 1825,
  },
  {
    icon: '🧴', name: 'Red Wine Vinegar', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Vinegar', storage: 'pantry', shelfLifeDays: 1825,
  },
  {
    icon: '🧴', name: 'Balsamic Vinegar', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Vinegar', storage: 'pantry', shelfLifeDays: 1825,
  },
  {
    icon: '🍅', name: 'Ketchup', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Ketchup & Mustard', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 747693,
    nutrition: { calories: 117, protein: 1.1, carbs: 26.8, fat: 0.6, sugar: 21.8, sodium: 949, potassium: 249, calcium: 14, iron: 0.4 },
  },
  {
    icon: '🌭', name: 'Mustard', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Ketchup & Mustard', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 326698,
    portion: { label: '1 teaspoon', grams: 6.0 },
    nutrition: { calories: 61, protein: 4.2, carbs: 5.3, fat: 3.4, saturatedFat: 0.3, fiber: 4.3, sugar: 1.4, sodium: 1100, potassium: 150, calcium: 63, iron: 1.6, vitaminC: 0.4 },
  },
  {
    icon: '🌭', name: 'Dijon Mustard', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Ketchup & Mustard', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🥪', name: 'Mayonnaise', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Mayo & Dressings', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['eggs'],
    fdcId: 2758986,
    nutrition: { saturatedFat: 11.3 },
  },
  {
    icon: '🌶️', name: 'Hot Sauce', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Hot Sauce', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌶️', name: 'Sriracha', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Hot Sauce', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍝', name: 'Marinara Sauce', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Pasta Sauce & Pesto', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 332282,
    portion: { label: '1 serving (1/2 cup)', grams: 135.0 },
    nutrition: { calories: 45, protein: 1.4, carbs: 8.1, fat: 1.5, saturatedFat: 0.2, fiber: 1.8, sugar: 5.5, sodium: 419, potassium: 319, calcium: 27, iron: 0.8 },
  },
  {
    icon: '🌿', name: 'Pesto', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Pasta Sauce & Pesto', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['dairy', 'nuts'],
  },
  {
    icon: '🥗', name: 'Ranch Dressing', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Mayo & Dressings', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['dairy', 'eggs'],
    fdcId: 2758988,
    nutrition: { saturatedFat: 7.1 },
  },
  {
    icon: '🥗', name: 'Italian Dressing', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Mayo & Dressings', storage: 'pantry', shelfLifeDays: 180,
    fdcId: 2758987,
    nutrition: { saturatedFat: 3.6 },
  },
  {
    icon: '🍖', name: 'BBQ Sauce', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Ketchup & Mustard', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🥫', name: 'Salsa', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Salsa & Dips', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 746777,
    portion: { label: '2 tablespoon', grams: 35.7 },
    nutrition: { calories: 29, protein: 1.4, carbs: 6.7, fat: 0.2, fiber: 1.8, sugar: 3.8, sodium: 656, potassium: 258, calcium: 28, iron: 0.4 },
  },
  {
    icon: '🫙', name: 'Tahini', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Pastes', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['sesame'], aliases: ['sesame paste'],
    fdcId: 2262073,
    nutrition: { calories: 648, protein: 19.7, carbs: 14.2, fat: 62.4, saturatedFat: 9.0, fiber: 8.4, sodium: 64, potassium: 408, calcium: 116, iron: 7.0 },
  },
  {
    icon: '🫒', name: 'Olives', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Pickled & Jarred', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 332791,
    portion: { label: '1 olive', grams: 3.2 },
    nutrition: { calories: 130, protein: 1.1, carbs: 5.0, fat: 12.9, saturatedFat: 2.3, fiber: 4.0, sugar: 0.0, sodium: 1620, potassium: 43, calcium: 121, iron: 0.3, vitaminC: 0.0 },
  },
  {
    icon: '🥒', name: 'Pickles', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Pickled & Jarred', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 324653,
    portion: { label: '1 spear', grams: 40.4 },
    nutrition: { calories: 12, protein: 0.5, carbs: 2.0, fat: 0.4, fiber: 1.0, sugar: 1.3, sodium: 808, potassium: 112, calcium: 54, iron: 0.2, vitaminC: 2.1 },
  },
  {
    icon: '🫙', name: 'Capers', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Pickled & Jarred', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🌶️', name: 'Curry Paste', category: 'Condiments & Sauces', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Pastes', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['shellfish'],
  },
  {
    icon: '🛢️', name: 'Canola Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 748278,
    portion: { label: '100 milliliter', grams: 90.9 },
    nutrition: { saturatedFat: 6.6 },
  },
  {
    icon: '🛢️', name: 'Corn Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 748323,
    portion: { label: '100 milliliter', grams: 91.3 },
    nutrition: { saturatedFat: 13.4 },
  },
  {
    icon: '🫒', name: 'Light Olive Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 1750351,
    nutrition: { saturatedFat: 15.8 },
  },
  {
    icon: '🛢️', name: 'Peanut Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 180,
    allergens: ['peanuts'],
    fdcId: 1750348,
    nutrition: { saturatedFat: 16.2 },
  },
  {
    icon: '🛢️', name: 'Safflower Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 1750350,
    nutrition: { saturatedFat: 7.7 },
  },
  {
    icon: '🛢️', name: 'Sunflower Oil', category: 'Condiments & Sauces', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Oils', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 1750349,
    nutrition: { saturatedFat: 9.0 },
  },

  // ============ SPICES & SEASONINGS ============
  {
    icon: '🧂', name: 'Salt', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Salt', storage: 'pantry', shelfLifeDays: 1825,
    fdcId: 746775,
    portion: { label: '1 teaspoon', grams: 6.1 },
    nutrition: { calories: 0, sodium: 38700, potassium: 2, calcium: 50, iron: 0.0 },
  },
  {
    icon: '⚫', name: 'Black Pepper', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🧄', name: 'Garlic Powder', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🧅', name: 'Onion Powder', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🌶️', name: 'Paprika', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🌶️', name: 'Smoked Paprika', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🌶️', name: 'Chili Powder', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🌶️', name: 'Cayenne Pepper', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🌶️', name: 'Red Pepper Flakes', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
    aliases: ['crushed red pepper', 'chili flakes'],
  },
  {
    icon: '🟡', name: 'Cumin', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🟠', name: 'Turmeric', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🍂', name: 'Oregano', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Thyme', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌿', name: 'Rosemary', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍃', name: 'Basil Leaves', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Italian Seasoning', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🟤', name: 'Cinnamon', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🟤', name: 'Nutmeg', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🫚', name: 'Ground Ginger', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🍛', name: 'Curry Powder', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍛', name: 'Garam Masala', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌮', name: 'Taco Seasoning', category: 'Spices & Seasonings', unit: 'Packets', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌶️', name: 'Cajun Seasoning', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍃', name: 'Bay Leaves', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🧂', name: 'Kosher Salt', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Salt', storage: 'pantry', shelfLifeDays: 1825,
    aliases: ['coarse salt'],
  },
  {
    icon: '🧂', name: 'Sea Salt', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Salt', storage: 'pantry', shelfLifeDays: 1825,
  },
  {
    icon: '🧂', name: 'Garlic Salt', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Salt', storage: 'pantry', shelfLifeDays: 1825,
  },
  {
    icon: '🧂', name: 'Seasoned Salt', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Salt', storage: 'pantry', shelfLifeDays: 1825,
  },
  {
    icon: '🧂', name: 'Celery Salt', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Salt', storage: 'pantry', shelfLifeDays: 1825,
  },
  {
    icon: '⚫', name: 'Peppercorns', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Whole Spices', storage: 'pantry', shelfLifeDays: 1460,
  },
  {
    icon: '⚪', name: 'White Pepper', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🍋', name: 'Lemon Pepper', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌶️', name: 'Chipotle Powder', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🌶️', name: 'Ancho Chili Powder', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🌶️', name: 'Jerk Seasoning', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌶️', name: 'Old Bay Seasoning', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌶️', name: 'Creole Seasoning', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌶️', name: 'Everything Bagel Seasoning', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['sesame'],
  },
  {
    icon: '🍂', name: 'Adobo Seasoning', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Sazón', category: 'Spices & Seasonings', unit: 'Packets', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Ranch Seasoning', category: 'Spices & Seasonings', unit: 'Packets', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Poultry Seasoning', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Steak Seasoning', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'BBQ Rub', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Herbes de Provence', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Za\'atar', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['sesame'],
  },
  {
    icon: '🍂', name: 'Sage', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Marjoram', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍂', name: 'Tarragon', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌿', name: 'Dried Dill', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌿', name: 'Dried Parsley', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌿', name: 'Dried Chives', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🟢', name: 'Cilantro Leaves', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Dried Herbs', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🟤', name: 'Allspice', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🟤', name: 'Ground Cloves', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🟤', name: 'Cardamom', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🟤', name: 'Pumpkin Pie Spice', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🟤', name: 'Apple Pie Spice', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '⭐', name: 'Star Anise', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Whole Spices', storage: 'pantry', shelfLifeDays: 1460,
  },
  {
    icon: '🟤', name: 'Coriander', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
    aliases: ['ground coriander'],
  },
  {
    icon: '🟡', name: 'Mustard Powder', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🟡', name: 'Mustard Seeds', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Whole Spices', storage: 'pantry', shelfLifeDays: 1460,
  },
  {
    icon: '🟤', name: 'Fennel Seeds', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Whole Spices', storage: 'pantry', shelfLifeDays: 1460,
  },
  {
    icon: '🟤', name: 'Caraway Seeds', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Whole Spices', storage: 'pantry', shelfLifeDays: 1460,
  },
  {
    icon: '🟤', name: 'Celery Seed', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Whole Spices', storage: 'pantry', shelfLifeDays: 1460,
  },
  {
    icon: '🔴', name: 'Sumac', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Ground Spices', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🌶️', name: 'Five Spice Powder', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍛', name: 'Tandoori Masala', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌶️', name: 'Berbere', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🌶️', name: 'Harissa Powder', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Seasoning Blends', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🟡', name: 'Saffron', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Whole Spices', storage: 'pantry', shelfLifeDays: 1460,
  },
  {
    icon: '🌿', name: 'Vanilla Bean', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Whole Spices', storage: 'pantry', shelfLifeDays: 1460,
  },
  {
    icon: '🍄', name: 'MSG', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Flavor Boosters', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🧄', name: 'Minced Garlic', category: 'Spices & Seasonings', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Flavor Boosters', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🧅', name: 'Dried Minced Onion', category: 'Spices & Seasonings', unit: 'Items', pantryCategory: 'pantry',
    subcategory: 'Flavor Boosters', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍗', name: 'Bouillon Cubes', category: 'Spices & Seasonings', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Flavor Boosters', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🧀', name: 'Nutritional Yeast', category: 'Spices & Seasonings', unit: 'Containers', pantryCategory: 'pantry',
    subcategory: 'Flavor Boosters', storage: 'pantry', shelfLifeDays: 730,
  },

  // ============ FROZEN ============
  {
    icon: '🥦', name: 'Frozen Broccoli', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Vegetables', storage: 'freezer', shelfLifeDays: 240,
  },
  {
    icon: '🫛', name: 'Frozen Peas', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Vegetables', storage: 'freezer', shelfLifeDays: 240,
  },
  {
    icon: '🌽', name: 'Frozen Corn', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Vegetables', storage: 'freezer', shelfLifeDays: 240,
  },
  {
    icon: '🥬', name: 'Frozen Spinach', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Vegetables', storage: 'freezer', shelfLifeDays: 240,
  },
  {
    icon: '🥕', name: 'Frozen Mixed Vegetables', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Vegetables', storage: 'freezer', shelfLifeDays: 240,
  },
  {
    icon: '🫘', name: 'Edamame', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Vegetables', storage: 'freezer', shelfLifeDays: 240,
    allergens: ['soy'],
    fdcId: 2758981,
    nutrition: { saturatedFat: 1.2, fiber: 6.2, sugar: 2.1, sodium: 15, potassium: 520, calcium: 73, iron: 2.3, vitaminC: 11.4 },
  },
  {
    icon: '🍓', name: 'Frozen Berries', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Fruit', storage: 'freezer', shelfLifeDays: 240,
  },
  {
    icon: '🍟', name: 'Frozen French Fries', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Potatoes & Sides', storage: 'freezer', shelfLifeDays: 240,
    aliases: ['frozen chips', 'french fries'],
  },
  {
    icon: '🥔', name: 'Frozen Hash Browns', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Potatoes & Sides', storage: 'freezer', shelfLifeDays: 240,
  },
  {
    icon: '🍤', name: 'Frozen Shrimp', category: 'Frozen', unit: 'Bags', pantryCategory: 'proteins',
    subcategory: 'Frozen Seafood', storage: 'freezer', shelfLifeDays: 180,
    allergens: ['shellfish'],
  },
  {
    icon: '🍦', name: 'Ice Cream', category: 'Frozen', unit: 'Containers', pantryCategory: 'dairy',
    subcategory: 'Frozen Desserts', storage: 'freezer', shelfLifeDays: 60,
    allergens: ['dairy'],
  },
  {
    icon: '🥕', name: 'Frozen Carrots', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Vegetables', storage: 'freezer', shelfLifeDays: 240,
    fdcId: 746764,
    nutrition: { calories: 37, protein: 0.8, carbs: 7.9, fat: 0.5, saturatedFat: 0.0, fiber: 3.2, sugar: 4.2, sodium: 66, potassium: 210, calcium: 33, iron: 0.4, vitaminC: 2.2 },
  },
  {
    icon: '🥬', name: 'Frozen Kale', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Vegetables', storage: 'freezer', shelfLifeDays: 240,
    fdcId: 326196,
    portion: { label: '1 cup (cooked)', grams: 118.0 },
    nutrition: { calories: 36, protein: 2.9, carbs: 5.3, fat: 1.2, sugar: 1.1, sodium: 16, potassium: 144, calcium: 150, iron: 0.8, vitaminC: 17.8 },
  },
  {
    icon: '🧅', name: 'Frozen Onion Rings', category: 'Frozen', unit: 'Bags', pantryCategory: 'produce',
    subcategory: 'Frozen Potatoes & Sides', storage: 'freezer', shelfLifeDays: 240,
    allergens: ['wheat', 'gluten'],
    fdcId: 324317,
    portion: { label: '1 piece', grams: 20.2 },
    nutrition: { calories: 288, protein: 4.5, carbs: 36.3, fat: 14.4, saturatedFat: 2.1, fiber: 2.4, sugar: 4.5, sodium: 374, potassium: 135, calcium: 28, iron: 1.1, vitaminC: 1.6 },
  },

  // ============ DRINKS ============
  {
    icon: '🧃', name: 'Apple Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2003590,
    nutrition: { calories: 47, protein: 0.1, carbs: 11.4, fat: 0.3, sugar: 10.3, sodium: 5, potassium: 96, calcium: 7, iron: 0.0, vitaminC: 51.2 },
  },
  {
    icon: '🧃', name: 'Cranberry Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2003594,
    nutrition: { calories: 31, protein: 0.0, carbs: 7.3, fat: 0.3, sugar: 3.4, sodium: 6, potassium: 71, calcium: 7, iron: 0.1, vitaminC: 0.0 },
  },
  {
    icon: '🧃', name: 'Grape Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2003592,
    nutrition: { calories: 65, protein: 0.3, carbs: 15.6, fat: 0.3, sugar: 14.0, sodium: 4, potassium: 50, calcium: 10, iron: 0.0, vitaminC: 45.6 },
  },
  {
    icon: '🧃', name: 'White Grape Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2003593,
    nutrition: { calories: 65, protein: 0.1, carbs: 15.8, fat: 0.3, sugar: 14.4, sodium: 7, potassium: 49, calcium: 7, iron: 0.1, vitaminC: 55.2 },
  },
  {
    icon: '🧃', name: 'Grapefruit Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2003595,
    nutrition: { calories: 40, protein: 0.6, carbs: 9.1, fat: 0.3, sugar: 7.1, sodium: 1, potassium: 128, calcium: 9, iron: 0.0, vitaminC: 24.1 },
  },
  {
    icon: '🧃', name: 'Pomegranate Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2727588,
    nutrition: { protein: 0.0, sugar: 13.3, sodium: 4, potassium: 166, calcium: 11, iron: 0.0, vitaminC: 0.0 },
  },
  {
    icon: '🧃', name: 'Prune Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2727587,
    nutrition: { protein: 0.4, sugar: 14.8, sodium: 10, potassium: 216, calcium: 16, iron: 0.4, vitaminC: 0.0 },
  },
  {
    icon: '🧃', name: 'Tart Cherry Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2727589,
    nutrition: { protein: 0.1, sugar: 10.9, sodium: 1, potassium: 170, calcium: 16, iron: 0.2, vitaminC: 0.0 },
  },
  {
    icon: '🧃', name: 'Orange Juice', category: 'Drinks', unit: 'Cartons', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'fridge', shelfLifeDays: 10,
    fdcId: 2003591,
    nutrition: { calories: 46, protein: 0.7, carbs: 10.3, fat: 0.3, sugar: 8.3, sodium: 5, potassium: 180, calcium: 13, iron: 0.1, vitaminC: 26.9 },
  },
  {
    icon: '🧃', name: 'Tomato Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    fdcId: 2003596,
    nutrition: { calories: 20, protein: 0.9, carbs: 4.3, fat: 0.3, sugar: 2.6, sodium: 236, potassium: 198, calcium: 10, iron: 0.3, vitaminC: 49.8 },
  },
  {
    icon: '☕', name: 'Ground Coffee', category: 'Drinks', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Coffee', storage: 'pantry', shelfLifeDays: 180,
    aliases: ['coffee grounds', 'coffee'],
  },
  {
    icon: '☕', name: 'Coffee Beans', category: 'Drinks', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Coffee', storage: 'pantry', shelfLifeDays: 180,
  },
  {
    icon: '☕', name: 'Instant Coffee', category: 'Drinks', unit: 'Jars', pantryCategory: 'pantry',
    subcategory: 'Coffee', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '☕', name: 'Coffee Pods', category: 'Drinks', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Coffee', storage: 'pantry', shelfLifeDays: 180,
    aliases: ['coffee capsules'],
  },
  {
    icon: '☕', name: 'Cold Brew Coffee', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Coffee', storage: 'fridge', shelfLifeDays: 14,
  },
  {
    icon: '☕', name: 'Espresso', category: 'Drinks', unit: 'Bags', pantryCategory: 'pantry',
    subcategory: 'Coffee', storage: 'pantry', shelfLifeDays: 180,
    aliases: ['espresso beans'],
  },
  {
    icon: '🍵', name: 'Black Tea', category: 'Drinks', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Tea & Hot Drinks', storage: 'pantry', shelfLifeDays: 730,
    aliases: ['tea bags'],
  },
  {
    icon: '🍵', name: 'Green Tea', category: 'Drinks', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Tea & Hot Drinks', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🫖', name: 'Herbal Tea', category: 'Drinks', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Tea & Hot Drinks', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍵', name: 'Chai Tea', category: 'Drinks', unit: 'Boxes', pantryCategory: 'pantry',
    subcategory: 'Tea & Hot Drinks', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍵', name: 'Matcha Powder', category: 'Drinks', unit: 'Containers', pantryCategory: 'pantry',
    subcategory: 'Tea & Hot Drinks', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🧋', name: 'Iced Tea', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Tea & Hot Drinks', storage: 'pantry', shelfLifeDays: 270,
  },
  {
    icon: '🧋', name: 'Sweet Tea', category: 'Drinks', unit: 'Gallons', pantryCategory: 'pantry',
    subcategory: 'Tea & Hot Drinks', storage: 'fridge', shelfLifeDays: 7,
  },
  {
    icon: '🍫', name: 'Hot Chocolate Mix', category: 'Drinks', unit: 'Packets', pantryCategory: 'pantry',
    subcategory: 'Tea & Hot Drinks', storage: 'pantry', shelfLifeDays: 730,
    allergens: ['dairy'],
  },
  {
    icon: '🍋', name: 'Lemonade', category: 'Drinks', unit: 'Cartons', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'fridge', shelfLifeDays: 10,
  },
  {
    icon: '🍋', name: 'Lemon Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍋', name: 'Lime Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🧃', name: 'Pineapple Juice', category: 'Drinks', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🧃', name: 'Mango Juice', category: 'Drinks', unit: 'Cartons', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🧃', name: 'Fruit Punch', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🥕', name: 'Carrot Juice', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'fridge', shelfLifeDays: 10,
  },
  {
    icon: '🥥', name: 'Coconut Water', category: 'Drinks', unit: 'Cartons', pantryCategory: 'pantry',
    subcategory: 'Juice', storage: 'pantry', shelfLifeDays: 365,
    aliases: ['coconut juice'],
  },
  {
    icon: '💧', name: 'Bottled Water', category: 'Drinks', unit: 'Packages', pantryCategory: 'pantry',
    subcategory: 'Water & Soda', storage: 'pantry', shelfLifeDays: 270,
  },
  {
    icon: '🫧', name: 'Sparkling Water', category: 'Drinks', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Water & Soda', storage: 'pantry', shelfLifeDays: 270,
    aliases: ['seltzer'],
  },
  {
    icon: '🫧', name: 'Club Soda', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Water & Soda', storage: 'pantry', shelfLifeDays: 270,
    aliases: ['soda water'],
  },
  {
    icon: '🫧', name: 'Tonic Water', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Water & Soda', storage: 'pantry', shelfLifeDays: 270,
    aliases: ['tonic'],
  },
  {
    icon: '🥤', name: 'Cola', category: 'Drinks', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Water & Soda', storage: 'pantry', shelfLifeDays: 270,
    aliases: ['soda', 'pop'],
  },
  {
    icon: '🥤', name: 'Diet Cola', category: 'Drinks', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Water & Soda', storage: 'pantry', shelfLifeDays: 270,
  },
  {
    icon: '🥤', name: 'Lemon-Lime Soda', category: 'Drinks', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Water & Soda', storage: 'pantry', shelfLifeDays: 270,
    aliases: ['lemon lime soda'],
  },
  {
    icon: '🥤', name: 'Ginger Ale', category: 'Drinks', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Water & Soda', storage: 'pantry', shelfLifeDays: 270,
  },
  {
    icon: '🥤', name: 'Root Beer', category: 'Drinks', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Water & Soda', storage: 'pantry', shelfLifeDays: 270,
  },
  {
    icon: '🧉', name: 'Kombucha', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Other Drinks', storage: 'fridge', shelfLifeDays: 60,
  },
  {
    icon: '🥤', name: 'Sports Drink', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Other Drinks', storage: 'pantry', shelfLifeDays: 270,
    aliases: ['electrolyte drink'],
  },
  {
    icon: '⚡', name: 'Energy Drink', category: 'Drinks', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Other Drinks', storage: 'pantry', shelfLifeDays: 270,
    aliases: ['energy drinks'],
  },
  {
    icon: '🥤', name: 'Protein Shake', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Other Drinks', storage: 'pantry', shelfLifeDays: 270,
    allergens: ['dairy'],
  },
  {
    icon: '🍓', name: 'Smoothie', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Other Drinks', storage: 'fridge', shelfLifeDays: 7,
  },
  {
    icon: '🍷', name: 'Red Wine', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Wine & Beer', storage: 'pantry', shelfLifeDays: 1095,
  },
  {
    icon: '🥂', name: 'White Wine', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Wine & Beer', storage: 'pantry', shelfLifeDays: 365,
  },
  {
    icon: '🍾', name: 'Sparkling Wine', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Wine & Beer', storage: 'pantry', shelfLifeDays: 365,
    aliases: ['champagne', 'prosecco'],
  },
  {
    icon: '🍷', name: 'Cooking Sherry', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Cooking Wine & Sake', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍶', name: 'Mirin', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Cooking Wine & Sake', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍶', name: 'Sake', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Cooking Wine & Sake', storage: 'pantry', shelfLifeDays: 730,
  },
  {
    icon: '🍺', name: 'Beer', category: 'Drinks', unit: 'Cans', pantryCategory: 'pantry',
    subcategory: 'Wine & Beer', storage: 'pantry', shelfLifeDays: 365,
    allergens: ['gluten'], aliases: ['lager', 'ale'],
  },
  {
    icon: '🥃', name: 'Bourbon', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Spirits', storage: 'pantry', shelfLifeDays: 3650,
  },
  {
    icon: '🥃', name: 'Rum', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Spirits', storage: 'pantry', shelfLifeDays: 3650,
  },
  {
    icon: '🍸', name: 'Vodka', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Spirits', storage: 'pantry', shelfLifeDays: 3650,
  },
  {
    icon: '🥃', name: 'Brandy', category: 'Drinks', unit: 'Bottles', pantryCategory: 'pantry',
    subcategory: 'Spirits', storage: 'pantry', shelfLifeDays: 3650,
  },
];

// Look up a pantry item by name or alias, ignoring case and plurals
// ("tomato" finds "Tomatoes", "scallions" finds "Green Onions"), so typed
// items get the right icon, section and details too. Real names win over
// aliases. Returns undefined for names not in the lists.
const byKey = new Map<string, PantryLibraryItem>();
const all = [...QUICK_ADDS, ...SUGGESTION_LIBRARY];
all.forEach(item => {
  const key = foodWords(item.name).join(' ');
  if (!byKey.has(key)) byKey.set(key, item);
});
all.forEach(item =>
  item.aliases?.forEach(alias => {
    const key = foodWords(alias).join(' ');
    if (!byKey.has(key)) byKey.set(key, item);
  })
);

export function findPantryLibraryItem(name: string): PantryLibraryItem | undefined {
  return byKey.get(foodWords(name).join(' '));
}

/** Storage tip for an item, e.g. "Keep in a paper bag in the fridge..." */
export function getStorageTip(item: Pick<PantryLibraryItem, 'subcategory'>): string | undefined {
  return STORAGE_TIPS[item.subcategory];
}

/** Rough "best by" date for something added today: now + shelfLifeDays. */
export function estimateBestBy(item: Pick<PantryLibraryItem, 'shelfLifeDays'>, from: Date = new Date()): Date {
  return new Date(from.getTime() + item.shelfLifeDays * 24 * 60 * 60 * 1000);
}

/** Nutrition for a given weight (default: the USDA portion, else 100 g). */
export function nutritionFor(item: PantryLibraryItem, grams?: number): PantryNutrition | undefined {
  if (!item.nutrition) return undefined;
  const g = grams ?? item.portion?.grams ?? 100;
  const out: PantryNutrition = {};
  for (const [key, value] of Object.entries(item.nutrition) as [keyof PantryNutrition, number | boolean][]) {
    if (typeof value === 'boolean') (out as Record<string, unknown>)[key] = value;
    else (out as Record<string, number>)[key] = Math.round((value * g) / 100 * 10) / 10;
  }
  return out;
}
