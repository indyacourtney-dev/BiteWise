// constants/preferenceOptions.ts
//
// The choices users make about food, shared by onboarding (first run) and
// the Profile screen (change them any time), so both always offer the same
// options. Taste options map to recipe tags; see TASTE_OPTIONS.

import type { Allergen, DietaryTag, Difficulty } from '../types';

export interface TasteOption {
  id: string;
  label: string;
  emoji: string;
  tags: string[];
}

export const TASTE_OPTIONS: TasteOption[] = [
  // Proteins
  { id: 'chicken', label: 'Chicken', emoji: '🍗', tags: ['chicken', 'poultry'] },
  { id: 'beef', label: 'Beef & steak', emoji: '🥩', tags: ['beef', 'red-meat'] },
  { id: 'seafood', label: 'Fish & seafood', emoji: '🐟', tags: ['fish', 'seafood'] },
  { id: 'plant', label: 'Plant-based', emoji: '🫘', tags: ['beans', 'tofu', 'plant-based', 'vegetarian'] },

  // Formats
  { id: 'pasta', label: 'Pasta & noodles', emoji: '🍝', tags: ['pasta', 'noodles'] },
  { id: 'rice', label: 'Rice bowls', emoji: '🍚', tags: ['rice', 'grain', 'bowl'] },
  { id: 'handheld', label: 'Tacos & sandwiches', emoji: '🌮', tags: ['handheld', 'tortilla', 'bread', 'sandwich'] },
  { id: 'salad', label: 'Salads & fresh', emoji: '🥗', tags: ['salad', 'fresh', 'raw', 'light'] },
  { id: 'potato', label: 'Potatoes', emoji: '🥔', tags: ['potato', 'root-veg'] },
  { id: 'soup', label: 'Stews & curries', emoji: '🍲', tags: ['simmered', 'saucy', 'slow-cooked'] },

  // Cooking styles
  { id: 'grilled', label: 'Grilled & smoky', emoji: '🔥', tags: ['grilled', 'charred'] },
  { id: 'crispy', label: 'Crispy & fried', emoji: '🍤', tags: ['fried', 'crispy'] },
  { id: 'cheesy', label: 'Cheesy & creamy', emoji: '🧀', tags: ['cheesy', 'creamy', 'rich'] },

  // Flavor directions
  { id: 'comfort', label: 'Comfort classics', emoji: '🏠', tags: ['comfort', 'classic'] },
  { id: 'spicy', label: 'Spicy food', emoji: '🌶️', tags: ['spicy'] },
  { id: 'sweet', label: 'Sweet & glazed', emoji: '🍯', tags: ['sweet', 'saucy'] },
  { id: 'tangy', label: 'Bright & tangy', emoji: '🍋', tags: ['tangy', 'acidic'] },
  { id: 'global', label: 'Global flavors', emoji: '🌍', tags: ['global', 'adventurous'] },

  // Lifestyle
  { id: 'quick', label: 'Quick & easy', emoji: '⚡', tags: ['quick', 'easy', 'weeknight'] },
  { id: 'hearty', label: 'Big hearty portions', emoji: '💪', tags: ['hearty', 'portion-large'] },
];

export const DIETARY_OPTIONS: { key: DietaryTag; label: string; emoji: string; hint?: string }[] = [
  { key: 'vegetarian', label: 'Vegetarian', emoji: '🥕', hint: 'No meat or fish' },
  { key: 'vegan', label: 'Vegan', emoji: '🌱', hint: 'No animal products' },
  { key: 'pescatarian', label: 'Pescatarian', emoji: '🐟', hint: 'Fish yes, meat no' },
  { key: 'gluten-free', label: 'Gluten-free', emoji: '🌾' },
  { key: 'dairy-free', label: 'Dairy-free', emoji: '🥛' },
  { key: 'high-protein', label: 'High-protein', emoji: '💪' },
  { key: 'low-carb', label: 'Low-carb', emoji: '📉' },
  { key: 'halal', label: 'Halal', emoji: '☪️' },
  { key: 'kosher-style', label: 'Kosher-style', emoji: '✡️' },
  { key: 'keto', label: 'Keto', emoji: '🥑' },
  { key: 'paleo', label: 'Paleo', emoji: '🦴' },
];

export const ALLERGEN_OPTIONS: { key: Allergen; label: string; emoji: string }[] = [
  { key: 'peanuts', label: 'Peanuts', emoji: '🥜' },
  { key: 'nuts', label: 'Tree nuts', emoji: '🌰' },
  { key: 'shellfish', label: 'Shellfish', emoji: '🦐' },
  { key: 'fish', label: 'Fish', emoji: '🐟' },
  { key: 'eggs', label: 'Eggs', emoji: '🥚' },
  { key: 'dairy', label: 'Dairy', emoji: '🥛' },
  { key: 'soy', label: 'Soy', emoji: '🫛' },
  { key: 'gluten', label: 'Gluten / wheat', emoji: '🌾' },
  { key: 'sesame', label: 'Sesame', emoji: '🫓' },
  { key: 'mustard', label: 'Mustard', emoji: '🟡' },
  { key: 'coconut', label: 'Coconut', emoji: '🥥' },
  { key: 'corn', label: 'Corn', emoji: '🌽' },
];

export const CUISINE_OPTIONS: { id: string; label: string; emoji: string }[] = [
  { id: 'american', label: 'American', emoji: '🍔' },
  { id: 'italian', label: 'Italian', emoji: '🍕' },
  { id: 'mexican', label: 'Mexican', emoji: '🌮' },
  { id: 'chinese', label: 'Chinese', emoji: '🥡' },
  { id: 'japanese', label: 'Japanese', emoji: '🍣' },
  { id: 'thai', label: 'Thai', emoji: '🍜' },
  { id: 'indian', label: 'Indian', emoji: '🍛' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
  { id: 'middle-eastern', label: 'Middle Eastern', emoji: '🧆' },
  { id: 'korean', label: 'Korean', emoji: '🍲' },
  { id: 'caribbean', label: 'Caribbean', emoji: '🏝️' },
  { id: 'soul', label: 'Southern / Soul', emoji: '🍗' },
];

export const SPICE_OPTIONS: { key: 'mild' | 'medium' | 'hot'; label: string; emoji: string; hint: string }[] = [
  { key: 'mild', label: 'Mild', emoji: '😌', hint: 'Keep it gentle' },
  { key: 'medium', label: 'Medium', emoji: '🌶️', hint: 'Some kick is good' },
  { key: 'hot', label: 'Hot', emoji: '🔥', hint: 'Bring the heat' },
];

export const SKILL_OPTIONS: { key: Difficulty; label: string; emoji: string; hint: string }[] = [
  { key: 'easy', label: 'Beginner', emoji: '🥄', hint: 'Simple steps, few pans' },
  { key: 'medium', label: 'Comfortable', emoji: '🍳', hint: 'Happy to follow a real recipe' },
  { key: 'hard', label: 'Confident', emoji: '👨‍🍳', hint: 'Bring on the technique' },
];

export const TIME_OPTIONS: { key: number | null; label: string }[] = [
  { key: 15, label: '15 min' },
  { key: 30, label: '30 min' },
  { key: 45, label: '45 min' },
  { key: null, label: 'No limit' },
];

export const HOUSEHOLD_OPTIONS: { key: number; label: string }[] = [
  { key: 1, label: 'Just me' },
  { key: 2, label: '2 people' },
  { key: 4, label: '3–4' },
  { key: 6, label: '5+' },
];

// Health goals (Profile screen). Recipes carry these tags when their measured
// macros fit (backend/database/cleaning/dietary.py has the exact rules).
export const HEALTH_OPTIONS: { key: DietaryTag; label: string; emoji: string; hint: string }[] = [
  { key: 'diabetic-friendly', label: 'Blood-sugar friendly', emoji: '🩸', hint: 'For high blood sugar' },
  { key: 'hypoglycemia-friendly', label: 'Steady energy', emoji: '⚖️', hint: 'For low blood sugar' },
  { key: 'heart-healthy', label: 'Heart-healthy', emoji: '❤️', hint: 'Less saturated fat & sodium' },
  { key: 'low-cholesterol', label: 'Low-cholesterol', emoji: '🫀', hint: 'For high cholesterol' },
  { key: 'low-sodium', label: 'Low-sodium', emoji: '🧂', hint: 'For blood pressure' },
  { key: 'high-fiber', label: 'High-fiber', emoji: '🌾', hint: '6 g+ per serving' },
  { key: 'low-calorie', label: 'Lighter meals', emoji: '🪶', hint: 'Lower calorie' },
  { key: 'no-red-meat', label: 'No red meat', emoji: '🚫', hint: 'Poultry & fish are fine' },
  { key: 'low-fodmap', label: 'Low-FODMAP', emoji: '🫄', hint: 'For IBS' },
  { key: 'gerd-friendly', label: 'Reflux-friendly', emoji: '🔥', hint: 'Fewer reflux triggers' },
];

// Less common allergies the database also tracks (Profile screen).
export const MORE_ALLERGEN_OPTIONS: { key: Allergen; label: string; emoji: string }[] = [
  { key: 'mollusc', label: 'Molluscs', emoji: '🦪' },
  { key: 'celery', label: 'Celery', emoji: '🥬' },
  { key: 'sulphites', label: 'Sulphites', emoji: '🍷' },
  { key: 'nightshade', label: 'Nightshades', emoji: '🍅' },
  { key: 'lupin', label: 'Lupin', emoji: '🌼' },
  { key: 'alpha_gal', label: 'Alpha-gal (red meat)', emoji: '🥩' },
];

/** Recipe tags for a set of taste option ids. */
export function tagsForTasteIds(ids: Iterable<string>): string[] {
  const chosen = new Set(ids);
  const tags = new Set<string>();
  TASTE_OPTIONS.filter(o => chosen.has(o.id)).forEach(o => o.tags.forEach(t => tags.add(t)));
  return Array.from(tags);
}

/** Which taste options a saved tag list came from (an option counts when all its tags are there). */
export function tasteIdsForTags(tags: string[]): string[] {
  const have = new Set(tags);
  return TASTE_OPTIONS.filter(o => o.tags.every(t => have.has(t))).map(o => o.id);
}
