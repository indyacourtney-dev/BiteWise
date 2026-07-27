// constants/itemIcons.ts
// Solves the "what icon do I show for an item I've never seen?" problem.
// Tries a specific match first, then falls back to a category icon,
// then a generic one. No pantry item is ever iconless.

import type { PantryCategoryId } from '../types';

// ============================================
// SPECIFIC MATCHES
// ============================================

const SPECIFIC_ICONS: Record<string, string> = {
  // Proteins
  chicken: '🍗', beef: '🥩', steak: '🥩', pork: '🥓', bacon: '🥓',
  fish: '🐟', salmon: '🐟', tuna: '🐟', shrimp: '🍤', turkey: '🦃',
  egg: '🥚', eggs: '🥚', tofu: '🧊', beans: '🫘', lentils: '🫘',

  // Produce
  tomato: '🍅', lettuce: '🥬', spinach: '🥬', kale: '🥬',
  broccoli: '🥦', carrot: '🥕', onion: '🧅', garlic: '🧄',
  pepper: '🫑', cucumber: '🥒', corn: '🌽', potato: '🥔',
  'sweet potato': '🍠', mushroom: '🍄', avocado: '🥑',
  apple: '🍎', banana: '🍌', lemon: '🍋', lime: '🍋',
  orange: '🍊', strawberry: '🍓', grape: '🍇',

  // Dairy
  milk: '🥛', cheese: '🧀', butter: '🧈', yogurt: '🥣', cream: '🥛',

  // Grains
  rice: '🍚', pasta: '🍝', noodles: '🍜', bread: '🍞',
  quinoa: '🌾', oats: '🥣', flour: '🌾', tortilla: '🫓',

  // Pantry
  oil: '🫒', 'olive oil': '🫒', salt: '🧂', sugar: '🍬',
  honey: '🍯', vinegar: '🫙', 'soy sauce': '🍶',
  nuts: '🥜', peanut: '🥜', almond: '🌰',
};

// ============================================
// CATEGORY FALLBACKS
// ============================================

const CATEGORY_ICONS: Record<PantryCategoryId, string> = {
  proteins: '🍖',
  produce: '🥬',
  dairy: '🥛',
  grains: '🌾',
  pantry: '🥫',
  other: '🍽️',
};

// ============================================
// CATEGORY KEYWORD RULES
// ============================================

const CATEGORY_KEYWORDS: Record<PantryCategoryId, string[]> = {
  proteins: [
    'chicken', 'beef', 'steak', 'pork', 'bacon', 'ham', 'fish', 'salmon',
    'tuna', 'shrimp', 'turkey', 'egg', 'tofu', 'bean', 'lentil', 'meat',
    'sausage', 'protein',
  ],
  produce: [
    'tomato', 'lettuce', 'spinach', 'kale', 'broccoli', 'carrot', 'onion',
    'garlic', 'pepper', 'cucumber', 'corn', 'potato', 'mushroom', 'avocado',
    'apple', 'banana', 'lemon', 'lime', 'orange', 'berry', 'grape', 'fruit',
    'veggie', 'vegetable', 'greens', 'salad', 'celery', 'zucchini',
  ],
  dairy: [
    'milk', 'cheese', 'butter', 'yogurt', 'cream', 'dairy', 'mozzarella',
    'cheddar', 'parmesan',
  ],
  grains: [
    'rice', 'pasta', 'noodle', 'bread', 'quinoa', 'oat', 'flour', 'tortilla',
    'cereal', 'grain', 'barley', 'couscous', 'bagel',
  ],
  pantry: [
    'oil', 'salt', 'sugar', 'honey', 'vinegar', 'sauce', 'spice', 'nut',
    'peanut', 'almond', 'seed', 'stock', 'broth', 'canned', 'syrup',
  ],
  other: [],
};

// ============================================
// PUBLIC API
// ============================================

/** Best-guess category from an item name. Falls back to 'other'. */
export function guessCategory(itemName: string): PantryCategoryId {
  const name = itemName.toLowerCase().trim();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => name.includes(kw))) {
      return category as PantryCategoryId;
    }
  }
  return 'other';
}

/**
 * Icon resolution: exact match → substring match → category → generic.
 * Always returns something.
 */
export function getIconForItem(
  itemName: string,
  category?: PantryCategoryId
): string {
  const name = itemName.toLowerCase().trim();

  if (SPECIFIC_ICONS[name]) return SPECIFIC_ICONS[name];

  // Longest key first so "sweet potato" beats "potato"
  const keys = Object.keys(SPECIFIC_ICONS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (name.includes(key)) return SPECIFIC_ICONS[key];
  }

  const resolved = category ?? guessCategory(itemName);
  return CATEGORY_ICONS[resolved] ?? CATEGORY_ICONS.other;
}

export function getCategoryIcon(category: PantryCategoryId): string {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;
}

export const CATEGORY_LABELS: Record<PantryCategoryId, string> = {
  proteins: 'Proteins',
  produce: 'Produce',
  dairy: 'Dairy & Refrigerated',
  grains: 'Grains & Carbs',
  pantry: 'Pantry & Dry Goods',
  other: 'Other',
};

// ============================================
// SIMILAR-ITEM SUGGESTIONS
// ============================================

export interface Suggestion {
  name: string;
  icon: string;
  category: PantryCategoryId;
}

const SUGGESTION_LIBRARY: Suggestion[] = [
  { name: 'Chicken Breast', icon: '🍗', category: 'proteins' },
  { name: 'Chicken Thighs', icon: '🍗', category: 'proteins' },
  { name: 'Ground Beef', icon: '🥩', category: 'proteins' },
  { name: 'Salmon Fillet', icon: '🐟', category: 'proteins' },
  { name: 'Eggs', icon: '🥚', category: 'proteins' },
  { name: 'Black Beans', icon: '🫘', category: 'proteins' },
  { name: 'Tofu', icon: '🧊', category: 'proteins' },
  { name: 'Broccoli', icon: '🥦', category: 'produce' },
  { name: 'Spinach', icon: '🥬', category: 'produce' },
  { name: 'Bell Pepper', icon: '🫑', category: 'produce' },
  { name: 'Tomatoes', icon: '🍅', category: 'produce' },
  { name: 'Onion', icon: '🧅', category: 'produce' },
  { name: 'Garlic', icon: '🧄', category: 'produce' },
  { name: 'Sweet Potato', icon: '🍠', category: 'produce' },
  { name: 'Avocado', icon: '🥑', category: 'produce' },
  { name: 'Milk', icon: '🥛', category: 'dairy' },
  { name: 'Cheddar Cheese', icon: '🧀', category: 'dairy' },
  { name: 'Greek Yogurt', icon: '🥣', category: 'dairy' },
  { name: 'Butter', icon: '🧈', category: 'dairy' },
  { name: 'Brown Rice', icon: '🍚', category: 'grains' },
  { name: 'Quinoa', icon: '🌾', category: 'grains' },
  { name: 'Pasta', icon: '🍝', category: 'grains' },
  { name: 'Whole Wheat Bread', icon: '🍞', category: 'grains' },
  { name: 'Olive Oil', icon: '🫒', category: 'pantry' },
  { name: 'Soy Sauce', icon: '🍶', category: 'pantry' },
  { name: 'Honey', icon: '🍯', category: 'pantry' },
  { name: 'Almonds', icon: '🌰', category: 'pantry' },
];

/**
 * Suggestions shown as the user types, before they commit to adding.
 * Prefix matches rank above substring matches.
 */
export function getSuggestions(query: string, limit = 5): Suggestion[] {
  const q = query.toLowerCase().trim();
  if (q.length < 1) return [];

  const prefix = SUGGESTION_LIBRARY.filter(s =>
    s.name.toLowerCase().startsWith(q)
  );
  const contains = SUGGESTION_LIBRARY.filter(
    s => !s.name.toLowerCase().startsWith(q) && s.name.toLowerCase().includes(q)
  );

  return [...prefix, ...contains].slice(0, limit);
}