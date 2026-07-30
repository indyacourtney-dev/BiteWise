// data/quizQuestions.ts
//
// The "This or That" question bank.
//
// HOW THIS WORKS
// --------------
// Every question belongs to a CATEGORY (protein / carb / greens) and covers
// exactly one DIMENSION (e.g. "protein-type", "carb-richness"). A dimension is
// a single decision the user is making.
//
// A round draws 3 questions per category, each from a different dimension, and
// shuffles the option order. So the user gets 9 questions covering 9 different
// decisions, but a different mix of questions and a different option order
// every single time they play.
//
// The `tags` on each option are what the matching engine scores recipes
// against. Keep them lowercase and keep them consistent with constants/recipes.ts.

import type { Vibe } from '../types';

// ============================================
// TYPES
// ============================================

export type QuizCategory = 'protein' | 'carb' | 'greens';

export type Dimension =
  // protein
  | 'protein-type'
  | 'protein-prep'
  | 'protein-texture'
  | 'protein-amount'
  | 'protein-effort'
  | 'protein-style'
  // carb
  | 'carb-type'
  | 'carb-richness'
  | 'carb-amount'
  | 'carb-form'
  | 'carb-temp'
  | 'carb-grain'
  // greens
  | 'veg-type'
  | 'veg-prep'
  | 'veg-amount'
  | 'veg-color'
  | 'veg-role'
  | 'veg-finish';

export interface QuizOption {
  id: string;
  label: string;
  emoji: string;
  /** One short line so the user knows exactly what they're picking. */
  hint: string;
  tags: string[];
}

export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  dimension: Dimension;
  /** Short, concrete, answerable in under two seconds. */
  question: string;
  /** Optional clarifier shown under the question. */
  helper?: string;
  options: QuizOption[];
}

export const CATEGORY_LABELS: Record<QuizCategory, string> = {
  protein: 'Protein',
  carb: 'Carbs',
  greens: 'Veggies',
};

export const CATEGORY_ORDER: QuizCategory[] = ['protein', 'carb', 'greens'];

/** Questions asked per category, per round. */
export const QUESTIONS_PER_CATEGORY = 3;
export const TOTAL_QUESTIONS = CATEGORY_ORDER.length * QUESTIONS_PER_CATEGORY;

// ============================================
// THE BANK
// ============================================

export const QUESTION_BANK: QuizQuestion[] = [
  // =========================================================
  // PROTEIN
  // =========================================================
  {
    id: 'p-type',
    category: 'protein',
    dimension: 'protein-type',
    question: 'What protein are you in the mood for?',
    helper: 'The main thing on the plate.',
    options: [
      { id: 'p-type-a', label: 'Chicken', emoji: '🍗', hint: 'Breast, thigh, or wings', tags: ['chicken', 'poultry'] },
      { id: 'p-type-b', label: 'Beef', emoji: '🥩', hint: 'Steak, ground beef, or braised', tags: ['beef', 'red-meat'] },
      { id: 'p-type-c', label: 'Fish or seafood', emoji: '🐟', hint: 'Salmon, shrimp, white fish', tags: ['fish', 'seafood'] },
      { id: 'p-type-d', label: 'Plant-based', emoji: '🫘', hint: 'Beans, tofu, lentils, eggs', tags: ['beans', 'tofu', 'plant-based', 'vegetarian'] },
    ],
  },
  {
    id: 'p-prep',
    category: 'protein',
    dimension: 'protein-prep',
    question: 'How should it be cooked?',
    helper: 'This changes the flavor more than anything else.',
    options: [
      { id: 'p-prep-a', label: 'Grilled', emoji: '🔥', hint: 'Charred, smoky, a little dry-heat', tags: ['grilled', 'charred'] },
      { id: 'p-prep-b', label: 'Pan-fried', emoji: '🍳', hint: 'Golden crust, cooks fast', tags: ['fried', 'crispy'] },
      { id: 'p-prep-c', label: 'Baked or roasted', emoji: '🍖', hint: 'Hands-off, oven does the work', tags: ['baked', 'roasted'] },
      { id: 'p-prep-d', label: 'Simmered in sauce', emoji: '🍲', hint: 'Curry, stew, braise — saucy', tags: ['simmered', 'saucy'] },
    ],
  },
  {
    id: 'p-texture',
    category: 'protein',
    dimension: 'protein-texture',
    question: 'Crispy or tender?',
    options: [
      { id: 'p-texture-a', label: 'Crispy edges', emoji: '🥨', hint: 'Crunch when you bite it', tags: ['crispy', 'fried'] },
      { id: 'p-texture-b', label: 'Tender and juicy', emoji: '💧', hint: 'Soft, moist, easy to cut', tags: ['tender', 'juicy'] },
      { id: 'p-texture-c', label: 'Falls apart', emoji: '🫕', hint: 'Slow-cooked, shreds with a fork', tags: ['slow-cooked', 'tender'] },
    ],
  },
  {
    id: 'p-amount',
    category: 'protein',
    dimension: 'protein-amount',
    question: 'How much protein do you actually want?',
    helper: 'Be honest — a big portion of chicken is a different meal than a little.',
    options: [
      { id: 'p-amount-a', label: 'Just a little', emoji: '🥢', hint: 'Protein plays a supporting role', tags: ['portion-small', 'light'] },
      { id: 'p-amount-b', label: 'A normal serving', emoji: '🍽️', hint: 'About a palm-sized portion', tags: ['portion-medium', 'balanced'] },
      { id: 'p-amount-c', label: 'Load it up', emoji: '💪', hint: 'Protein is the whole point', tags: ['portion-large', 'hearty'] },
    ],
  },
  {
    id: 'p-effort',
    category: 'protein',
    dimension: 'protein-effort',
    question: 'How much time do you have to cook?',
    options: [
      { id: 'p-effort-a', label: 'Under 20 minutes', emoji: '⚡', hint: 'Get in, get out', tags: ['quick', 'easy'] },
      { id: 'p-effort-b', label: 'A normal weeknight', emoji: '🕕', hint: '30 to 45 minutes is fine', tags: ['weeknight', 'balanced'] },
      { id: 'p-effort-c', label: "I've got time", emoji: '🕰️', hint: 'Happy to let something simmer', tags: ['slow-cooked', 'project'] },
    ],
  },
  {
    id: 'p-style',
    category: 'protein',
    dimension: 'protein-style',
    question: 'Something familiar or something different?',
    options: [
      { id: 'p-style-a', label: 'A comfort classic', emoji: '🏠', hint: 'You already know you like it', tags: ['comfort', 'classic'] },
      { id: 'p-style-b', label: 'Something different', emoji: '🌍', hint: 'New flavors, worth the risk', tags: ['global', 'adventurous'] },
    ],
  },

  // =========================================================
  // CARBS
  // =========================================================
  {
    id: 'c-type',
    category: 'carb',
    dimension: 'carb-type',
    question: 'Pick your carb',
    helper: 'What do you want soaking up the sauce?',
    options: [
      { id: 'c-type-a', label: 'Rice or grains', emoji: '🍚', hint: 'Rice, quinoa, couscous', tags: ['rice', 'grain', 'quinoa'] },
      { id: 'c-type-b', label: 'Pasta or noodles', emoji: '🍝', hint: 'Spaghetti, ramen, lo mein', tags: ['pasta', 'noodles'] },
      { id: 'c-type-c', label: 'Bread or tortillas', emoji: '🥖', hint: 'Buns, wraps, pita, toast', tags: ['bread', 'tortilla', 'bun'] },
      { id: 'c-type-d', label: 'Potatoes', emoji: '🥔', hint: 'Roasted, mashed, or fries', tags: ['potato'] },
    ],
  },
  {
    id: 'c-richness',
    category: 'carb',
    dimension: 'carb-richness',
    question: 'Light or rich?',
    helper: 'How heavy do you want to feel after?',
    options: [
      { id: 'c-rich-a', label: 'Light and fresh', emoji: '🥗', hint: 'Lemon, herbs, nothing heavy', tags: ['light', 'fresh'] },
      { id: 'c-rich-b', label: 'Somewhere in between', emoji: '⚖️', hint: 'Satisfying but not a food coma', tags: ['balanced'] },
      { id: 'c-rich-c', label: 'Rich and creamy', emoji: '🧈', hint: 'Butter, cheese, cream', tags: ['rich', 'creamy'] },
    ],
  },
  {
    id: 'c-amount',
    category: 'carb',
    dimension: 'carb-amount',
    question: 'How much of the plate should be carbs?',
    options: [
      { id: 'c-amount-a', label: 'Keep it low', emoji: '📉', hint: 'Skip or barely any', tags: ['low-carb', 'light'] },
      { id: 'c-amount-b', label: 'A normal amount', emoji: '📊', hint: 'About a quarter of the plate', tags: ['balanced', 'grain'] },
      { id: 'c-amount-c', label: 'Extra, please', emoji: '📈', hint: 'Carbs are the comfort part', tags: ['high-carb', 'comfort'] },
    ],
  },
  {
    id: 'c-form',
    category: 'carb',
    dimension: 'carb-form',
    question: 'How do you want to eat it?',
    helper: 'Sounds small — it really changes what you get.',
    options: [
      { id: 'c-form-a', label: 'With my hands', emoji: '🌯', hint: 'Sandwich, taco, wrap, burger', tags: ['handheld', 'sandwich', 'bread'] },
      { id: 'c-form-b', label: 'In a bowl', emoji: '🥣', hint: 'Everything mixed together', tags: ['bowl', 'mixed-in'] },
      { id: 'c-form-c', label: 'Plated, with a fork', emoji: '🍽️', hint: 'Protein here, sides there', tags: ['plated', 'side'] },
    ],
  },
  {
    id: 'c-temp',
    category: 'carb',
    dimension: 'carb-temp',
    question: 'Warm and cozy, or cool and crisp?',
    options: [
      { id: 'c-temp-a', label: 'Warm and cozy', emoji: '♨️', hint: 'Straight out of the pan', tags: ['warm', 'comfort'] },
      { id: 'c-temp-b', label: 'Cool and crisp', emoji: '🧊', hint: 'Salads, cold bowls, wraps', tags: ['cold', 'fresh', 'salad'] },
    ],
  },
  {
    id: 'c-grain',
    category: 'carb',
    dimension: 'carb-grain',
    question: 'Whole grain, or whatever cooks fastest?',
    options: [
      { id: 'c-grain-a', label: 'Whole grain', emoji: '🌾', hint: 'Brown rice, whole wheat, quinoa', tags: ['whole-grain', 'grain'] },
      { id: 'c-grain-b', label: "Whatever's fastest", emoji: '⏱️', hint: 'White rice, regular pasta', tags: ['quick', 'easy'] },
    ],
  },

  // =========================================================
  // GREENS
  // =========================================================
  {
    id: 'v-type',
    category: 'greens',
    dimension: 'veg-type',
    question: 'What kind of vegetables?',
    options: [
      { id: 'v-type-a', label: 'Leafy greens', emoji: '🥬', hint: 'Spinach, kale, arugula', tags: ['greens', 'leafy'] },
      { id: 'v-type-b', label: 'Roasted vegetables', emoji: '🥦', hint: 'Broccoli, carrots, squash', tags: ['roasted', 'veggies-large'] },
      { id: 'v-type-c', label: 'A fresh salad', emoji: '🥗', hint: 'Raw, crunchy, cold', tags: ['salad', 'fresh', 'raw'] },
      { id: 'v-type-d', label: 'Honestly, not much', emoji: '🤷', hint: 'A garnish is plenty', tags: ['minimal-veg', 'comfort'] },
    ],
  },
  {
    id: 'v-prep',
    category: 'greens',
    dimension: 'veg-prep',
    question: 'How should the veggies be cooked?',
    options: [
      { id: 'v-prep-a', label: 'Raw and crisp', emoji: '🌱', hint: 'Straight off the cutting board', tags: ['raw', 'fresh'] },
      { id: 'v-prep-b', label: 'Lightly cooked', emoji: '🥕', hint: 'Steamed or sautéed, still bright', tags: ['steamed', 'light'] },
      { id: 'v-prep-c', label: 'Well roasted', emoji: '🍠', hint: 'Browned edges, deeper flavor', tags: ['roasted', 'charred'] },
    ],
  },
  {
    id: 'v-amount',
    category: 'greens',
    dimension: 'veg-amount',
    question: 'How many vegetables?',
    helper: 'Half the plate is the healthy-plate target, but tonight is tonight.',
    options: [
      { id: 'v-amount-a', label: 'A small side', emoji: '🤏', hint: 'Just enough to count', tags: ['portion-small', 'side'] },
      { id: 'v-amount-b', label: 'About half the plate', emoji: '👌', hint: 'The balanced option', tags: ['balanced'] },
      { id: 'v-amount-c', label: 'Load me up', emoji: '🥬', hint: 'Veggies are the main event', tags: ['veggies-large', 'greens'] },
    ],
  },
  {
    id: 'v-color',
    category: 'greens',
    dimension: 'veg-color',
    question: 'What should be on the plate?',
    options: [
      { id: 'v-color-a', label: 'Green things', emoji: '🥒', hint: 'Broccoli, green beans, spinach', tags: ['greens', 'leafy'] },
      { id: 'v-color-b', label: 'A colorful mix', emoji: '🌈', hint: 'Peppers, tomatoes, corn', tags: ['colorful', 'peppers', 'veggies-large'] },
      { id: 'v-color-c', label: 'Root vegetables', emoji: '🥕', hint: 'Carrots, sweet potato, squash', tags: ['root-veg', 'roasted'] },
    ],
  },
  {
    id: 'v-role',
    category: 'greens',
    dimension: 'veg-role',
    question: 'Veggies mixed in, or on the side?',
    options: [
      { id: 'v-role-a', label: 'Mixed into the dish', emoji: '🥘', hint: 'One pan, everything together', tags: ['mixed-in', 'bowl'] },
      { id: 'v-role-b', label: 'On the side', emoji: '🍽️', hint: 'Kept separate on the plate', tags: ['side', 'plated'] },
    ],
  },
  {
    id: 'v-finish',
    category: 'greens',
    dimension: 'veg-finish',
    question: 'How should they be finished?',
    options: [
      { id: 'v-finish-a', label: 'Bright and tangy', emoji: '🍋', hint: 'Lemon, vinegar, a dressing', tags: ['tangy', 'acidic', 'fresh'] },
      { id: 'v-finish-b', label: 'Just oil and salt', emoji: '🫒', hint: 'Simple, lets the veg taste like veg', tags: ['simple', 'olive-oil'] },
      { id: 'v-finish-c', label: 'Cheesy or saucy', emoji: '🧀', hint: 'Parmesan, butter, a glaze', tags: ['cheesy', 'saucy', 'rich'] },
    ],
  },
];

// ============================================
// VIBE (the final question)
// ============================================

export interface VibeOption {
  key: Vibe;
  emoji: string;
  label: string;
  hint: string;
}

/** Several phrasings so the last question isn't identical every round. */
export const VIBE_PROMPTS: string[] = [
  'Last one — what flavor are you chasing?',
  'Final question: what should it taste like?',
  'One more. Pick a flavor direction.',
];

export const VIBE_OPTIONS: VibeOption[] = [
  { key: 'spicy', emoji: '🌶️', label: 'Spicy', hint: 'Heat, chili, bold seasoning' },
  { key: 'savory', emoji: '🍲', label: 'Savory', hint: 'Garlic, herbs, rich and salty' },
  { key: 'sweet', emoji: '🍯', label: 'Sweet', hint: 'Honey, glaze, teriyaki, fruit' },
];

// ============================================
// DIMENSION → TAG LOOKUP
// ============================================

/**
 * Built automatically from the bank above, so the matching engine never
 * drifts out of sync with the questions. Maps each dimension to every tag
 * any of its options can produce.
 */
export const DIMENSION_TAGS: Record<string, string[]> = QUESTION_BANK.reduce(
  (acc, q) => {
    const tags = new Set(acc[q.dimension] ?? []);
    q.options.forEach(o => o.tags.forEach(t => tags.add(t)));
    acc[q.dimension] = Array.from(tags);
    return acc;
  },
  {} as Record<string, string[]>
);

// ============================================
// ROUND BUILDING
// ============================================

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Builds one round: `QUESTIONS_PER_CATEGORY` questions from each category,
 * in category order, with the options inside each question shuffled.
 *
 * Because every question in a category owns a different dimension, a round
 * can never ask the same decision twice.
 */
export function buildRound(): QuizQuestion[] {
  return CATEGORY_ORDER.flatMap(category => {
    const pool = QUESTION_BANK.filter(q => q.category === category);
    return shuffle(pool)
      .slice(0, QUESTIONS_PER_CATEGORY)
      .map(q => ({ ...q, options: shuffle(q.options) }));
  });
}

/** Random vibe prompt so the last screen varies too. */
export function pickVibePrompt(): string {
  return VIBE_PROMPTS[Math.floor(Math.random() * VIBE_PROMPTS.length)];
}

/**
 * How many distinct question combinations exist. Handy for the report —
 * shows the round really is different each time.
 */
export function countPossibleRounds(): number {
  const choose = (n: number, k: number) => {
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return Math.round(r);
  };
  return CATEGORY_ORDER.reduce((total, category) => {
    const size = QUESTION_BANK.filter(q => q.category === category).length;
    return total * choose(size, QUESTIONS_PER_CATEGORY);
  }, 1);
}
