// data/thisOrThatData.ts
//
// Question bank for the "This or That" preference game.
// Grouped into categories so a round can be built dynamically
// (protein, carbohydrate, sides — per the 7/24 meeting notes).
//
// Each option carries `tags`, which are the values fed into the
// matching engine to score recipes afterward. Keep tag strings
// lowercase and consistent with however recipes.ts tags its
// ingredients/categories, so scoring lines up.

export type ThisOrThatCategory = 'protein' | 'carbohydrate' | 'sides';

export interface ThisOrThatOption {
  id: string;
  label: string;
  // Optional icon key — wire to your existing pantry icon-mapping
  // table once mismatches there are fixed.
  iconKey?: string;
  tags: string[];
}

export interface ThisOrThatQuestion {
  id: string;
  category: ThisOrThatCategory;
  prompt: string;
  optionA: ThisOrThatOption;
  optionB: ThisOrThatOption;
}

// Fast-food-flavored comparisons, per category.
// 3 questions are drawn from this pool per round (one per category
// by default), with room to expand the pool later.
export const THIS_OR_THAT_QUESTIONS: ThisOrThatQuestion[] = [
  // ---- Protein ----
  {
    id: 'protein-1',
    category: 'protein',
    prompt: 'Crispy chicken or juicy burger?',
    optionA: { id: 'protein-1-a', label: 'Crispy Chicken', tags: ['chicken', 'fried', 'poultry'] },
    optionB: { id: 'protein-1-b', label: 'Burger', tags: ['beef', 'ground-beef', 'red-meat'] },
  },
  {
    id: 'protein-2',
    category: 'protein',
    prompt: 'Tacos or fish sandwich?',
    optionA: { id: 'protein-2-a', label: 'Tacos', tags: ['beef', 'ground-beef', 'handheld'] },
    optionB: { id: 'protein-2-b', label: 'Fish Sandwich', tags: ['fish', 'seafood'] },
  },
  {
    id: 'protein-3',
    category: 'protein',
    prompt: 'Bean & veggie bowl or grilled chicken?',
    optionA: { id: 'protein-3-a', label: 'Bean & Veggie Bowl', tags: ['beans', 'vegetarian', 'plant-based'] },
    optionB: { id: 'protein-3-b', label: 'Grilled Chicken', tags: ['chicken', 'grilled', 'poultry'] },
  },

  // ---- Carbohydrate ----
  {
    id: 'carb-1',
    category: 'carbohydrate',
    prompt: 'Fries or rice?',
    optionA: { id: 'carb-1-a', label: 'Fries', tags: ['potato', 'fried', 'quick'] },
    optionB: { id: 'carb-1-b', label: 'Rice', tags: ['rice', 'grain'] },
  },
  {
    id: 'carb-2',
    category: 'carbohydrate',
    prompt: 'Bun or tortilla?',
    optionA: { id: 'carb-2-a', label: 'Bun', tags: ['bread', 'bun'] },
    optionB: { id: 'carb-2-b', label: 'Tortilla', tags: ['tortilla', 'wrap'] },
  },
  {
    id: 'carb-3',
    category: 'carbohydrate',
    prompt: 'Noodles or mashed potatoes?',
    optionA: { id: 'carb-3-a', label: 'Noodles', tags: ['noodles', 'pasta'] },
    optionB: { id: 'carb-3-b', label: 'Mashed Potatoes', tags: ['potato', 'comfort'] },
  },

  // ---- Sides ----
  {
    id: 'side-1',
    category: 'sides',
    prompt: 'Coleslaw or side salad?',
    optionA: { id: 'side-1-a', label: 'Coleslaw', tags: ['cabbage', 'slaw'] },
    optionB: { id: 'side-1-b', label: 'Side Salad', tags: ['lettuce', 'salad', 'light'] },
  },
  {
    id: 'side-2',
    category: 'sides',
    prompt: 'Mac & cheese or roasted veggies?',
    optionA: { id: 'side-2-a', label: 'Mac & Cheese', tags: ['pasta', 'cheese', 'comfort'] },
    optionB: { id: 'side-2-b', label: 'Roasted Veggies', tags: ['vegetables', 'roasted', 'light'] },
  },
  {
    id: 'side-3',
    category: 'sides',
    prompt: 'Onion rings or fruit cup?',
    optionA: { id: 'side-3-a', label: 'Onion Rings', tags: ['onion', 'fried'] },
    optionB: { id: 'side-3-b', label: 'Fruit Cup', tags: ['fruit', 'light'] },
  },
];

// Helper: build one round (default 3, one per category). Pass a
// count > categories.length to pull extras from the same category pool.
export function buildRound(count: number = 3): ThisOrThatQuestion[] {
  const categories: ThisOrThatCategory[] = ['protein', 'carbohydrate', 'sides'];
  const round: ThisOrThatQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const pool = THIS_OR_THAT_QUESTIONS.filter((q) => q.category === category);
    const unused = pool.filter((q) => !round.find((r) => r.id === q.id));
    const choices = unused.length > 0 ? unused : pool;
    round.push(choices[Math.floor(Math.random() * choices.length)]);
  }

  return round;
}
