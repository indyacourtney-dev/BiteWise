// data/recipes.ts
//
// PLACEHOLDER — if you already have a recipes.ts catalog, don't
// replace it. Just add a `tags` array to each recipe (same idea as
// `matchKeys` used for pantry matching) so scoreRecipes() has
// something to compare against the This or That answers.

export interface Recipe {
  id: string | number;
  name: string;
  tags: string[];
  servings?: number;
  ingredients?: { name: string; amount: string }[];
  steps?: string[];
}

export const RECIPES: Recipe[] = [
  {
    id: 1,
    name: 'Grilled Chicken Rice Bowl',
    tags: ['chicken', 'grilled', 'poultry', 'rice', 'grain', 'vegetables', 'light'],
  },
  {
    id: 2,
    name: 'Crispy Chicken Sandwich',
    tags: ['chicken', 'fried', 'poultry', 'bread', 'bun', 'coleslaw', 'cabbage', 'slaw'],
  },
  {
    id: 3,
    name: 'Beef Tacos',
    tags: ['beef', 'ground-beef', 'handheld', 'tortilla', 'wrap'],
  },
  {
    id: 4,
    name: 'Fish Sandwich & Fries',
    tags: ['fish', 'seafood', 'bread', 'bun', 'potato', 'fried', 'quick'],
  },
  {
    id: 5,
    name: 'Bean & Veggie Burrito Bowl',
    tags: ['beans', 'vegetarian', 'plant-based', 'rice', 'grain', 'vegetables', 'roasted', 'light'],
  },
  {
    id: 6,
    name: 'Homestyle Mac & Cheese with Grilled Chicken',
    tags: ['chicken', 'grilled', 'poultry', 'pasta', 'cheese', 'comfort'],
  },
];
