// backend/scripts/kaggle/transform.ts
//
// Turns one row of the Kaggle CSV into a RecipeRow, or null if the row
// isn't a meal BiteWise should recommend.
//
// Kaggle gives us: title, ingredients, directions, link, source, NER, site.
// It does NOT give us nutrition, plate composition, times, or servings.
// Everything below is either parsed from the text or left null — nothing
// is made up to look precise.

import { createHash } from 'crypto';
import type { Ingredient, PantryCategoryId, Recipe } from '../../../frontend/types';
import type { RecipeRow } from '../../../frontend/lib/recipeRow';
import {
  ALLERGEN_KEYWORDS,
  ANIMAL_PRODUCT_KEYWORDS,
  CATEGORY_KEYWORDS,
  COOKED_KEYWORDS,
  FLAVOR_RULES,
  FORMAT_RULES,
  KeywordRule,
  MEAT_KEYWORDS,
  METHOD_RULES,
  PROTEIN_RULES,
  SKIP_TITLE_KEYWORDS,
  SPICY_KEYWORDS,
  STARCH_RULES,
  SWEET_KEYWORDS,
} from './tagRules';

export interface KaggleRow {
  title: string;
  ingredients: string; // stringified list: '["1 c. flour", ...]'
  directions: string;  // stringified list
  link: string;
  source: string;
  NER: string;         // stringified list of clean ingredient names
  site: string;
}

// ============================================
// TEXT HELPERS
// ============================================

const regexCache = new Map<string, RegExp>();

function keywordRegex(keyword: string): RegExp {
  let re = regexCache.get(keyword);
  if (!re) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Allow simple plurals so 'tortilla' also matches 'tortillas'.
    re = new RegExp(`\\b${escaped}(?:e?s)?\\b`, 'i');
    regexCache.set(keyword, re);
  }
  return re;
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some(k => keywordRegex(k).test(text));
}

function applyRules(text: string, rules: KeywordRule[], into: Set<string>): void {
  for (const rule of rules) {
    if (hasAny(text, rule.keywords)) rule.tags.forEach(t => into.add(t));
  }
}

/** Kaggle stores lists as JSON-ish strings. Parse, falling back to a split. */
export function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).map(s => s.trim()).filter(Boolean) : [];
  } catch {
    return raw
      .replace(/^\[|\]$/g, '')
      .split(/",\s*"/)
      .map(s => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }
}

// ============================================
// INGREDIENTS
// ============================================

// "1 1/2 c. brown sugar" -> amount "1 1/2 c.", name "brown sugar"
const AMOUNT_RE =
  /^\s*((?:\d+\s+)?\d+(?:[\/.]\d+)?(?:\s*-\s*\d+(?:[\/.]\d+)?)?\s*(?:\([^)]*\)\s*)?(?:c\.?|cups?|tbsp\.?|tablespoons?|tsp\.?|teaspoons?|lbs?\.?|pounds?|oz\.?|ounces?|pkg\.?|packages?|cans?|cloves?|qt\.?|pt\.?|slices?|stalks?|jars?|bunch(?:es)?|large|medium|small)?\.?)\s+(.+)$/i;

function categorize(name: string): PantryCategoryId {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (hasAny(name, keywords)) return category;
  }
  return 'pantry';
}

function parseIngredient(line: string): Ingredient {
  const match = line.match(AMOUNT_RE);
  const amount = match ? match[1].trim() : '';
  const name = (match ? match[2] : line).trim().toLowerCase();
  return {
    name,
    amount,
    category: categorize(name),
    ...(/\boptional\b/i.test(line) ? { optional: true } : {}),
  };
}

// ============================================
// TIME & DIFFICULTY (estimates)
// ============================================

/** Adds up every "N minutes" / "N hours" mentioned in the directions. */
function estimateCookMinutes(directions: string[]): number {
  let total = 0;
  const re = /(\d+)\s*(?:to\s*\d+\s*)?(minutes?|mins?|hours?|hrs?)\b/gi;
  for (const step of directions) {
    for (const m of step.matchAll(re)) {
      const n = parseInt(m[1], 10);
      total += /^h/i.test(m[2]) ? n * 60 : n;
    }
  }
  if (total === 0) return 20; // no times mentioned
  return Math.min(total, 240);
}

function estimatePrepMinutes(ingredientCount: number): number {
  return Math.max(10, Math.min(30, 5 + ingredientCount * 2));
}

function estimateDifficulty(steps: number, totalMinutes: number): Recipe['difficulty'] {
  if (steps <= 5 && totalMinutes <= 45) return 'easy';
  if (steps >= 10 || totalMinutes > 120) return 'hard';
  return 'medium';
}

// ============================================
// EMOJI & VIBE
// ============================================

function pickEmoji(tags: Set<string>, title: string): string {
  if (/\btaco|burrito|enchilada|quesadilla/i.test(title)) return '🌮';
  if (/\bsoup|stew|chili|chowder|gumbo/i.test(title)) return '🍲';
  if (/\bburger\b/i.test(title)) return '🍔';
  if (/\bsandwich|wrap|sub\b/i.test(title)) return '🥪';
  if (/\bsalad\b/i.test(title)) return '🥗';
  if (tags.has('pasta')) return '🍝';
  if (tags.has('noodles')) return '🍜';
  if (tags.has('seafood')) return /shrimp|prawn/i.test(title) ? '🍤' : '🐟';
  if (tags.has('beef')) return '🥩';
  if (tags.has('chicken')) return '🍗';
  if (tags.has('tofu') || tags.has('beans')) return '🥙';
  if (tags.has('rice')) return '🍛';
  return '🍽️';
}

function pickVibe(ingredientText: string): Recipe['vibe'] {
  if (hasAny(ingredientText, SPICY_KEYWORDS)) return 'spicy';
  if (hasAny(ingredientText, SWEET_KEYWORDS)) return 'sweet';
  return 'savory';
}

// ============================================
// MAIN TRANSFORM
// ============================================

/** Stable id from the source link so re-running the import upserts instead of duplicating. */
function kaggleId(row: KaggleRow): string {
  const key = row.link || row.title;
  return 'k' + createHash('sha1').update(key).digest('hex').slice(0, 12);
}

/** "Jewell Ball'S Chicken" -> "Jewell Ball's Chicken" (a Kaggle quirk). */
function cleanTitle(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').replace(/'S\b/g, "'s");
}

export interface TransformOptions {
  /**
   * true (default): only savory meals with a recognisable protein, no
   * desserts or drinks — the original dinner-only behaviour.
   * false: keep everything; the caller decides (pushCleanedRecipes.ts uses
   * the meal-type classifier, so breakfasts and desserts are kept too).
   */
  mealsOnly?: boolean;
}

export function transformKaggleRow(row: KaggleRow, opts: TransformOptions = {}): RecipeRow | null {
  const mealsOnly = opts.mealsOnly ?? true;
  const title = cleanTitle(row.title ?? '');
  if (!title || (mealsOnly && hasAny(title, SKIP_TITLE_KEYWORDS))) return null;

  const rawIngredients = parseList(row.ingredients);
  const directions = parseList(row.directions);
  const ner = parseList(row.NER).map(s => s.toLowerCase());
  if (mealsOnly && (rawIngredients.length < 3 || directions.length < 2)) return null;
  if (rawIngredients.length === 0 || directions.length === 0) return null;

  // NER is the cleanest text to match against; fall back to raw lines.
  const ingredientText = (ner.length ? ner : rawIngredients).join(' | ');
  const directionText = directions.join(' ');

  const tags = new Set<string>();
  applyRules(ingredientText, PROTEIN_RULES, tags);

  // Must be a meal with a recognizable protein.
  const hasProtein = PROTEIN_RULES.some(r => r.tags.some(t => tags.has(t)));
  if (mealsOnly && !hasProtein) return null;

  applyRules(directionText, METHOD_RULES, tags);
  applyRules(ingredientText, STARCH_RULES, tags);
  applyRules(ingredientText, FLAVOR_RULES, tags);
  applyRules(title, FORMAT_RULES, tags);

  const cooked =
    METHOD_RULES.some(r => r.tags.some(t => tags.has(t))) || hasAny(directionText, COOKED_KEYWORDS);
  if (cooked) tags.add('warm');
  else { tags.add('cold'); tags.add('raw'); }

  const prepMinutes = estimatePrepMinutes(rawIngredients.length);
  const cookMinutes = estimateCookMinutes(directions);
  const total = prepMinutes + cookMinutes;
  if (total <= 30) tags.add('quick');
  else if (total <= 50) tags.add('weeknight');
  else if (total >= 90) tags.add('project');

  // ---------- Allergens (best guess — flagged unverified) ----------
  const allergens = Object.entries(ALLERGEN_KEYWORDS)
    .filter(([, keywords]) => hasAny(ingredientText, keywords))
    .map(([allergen]) => allergen);

  // ---------- Dietary ----------
  const hasMeat = hasAny(ingredientText, MEAT_KEYWORDS);
  const hasSeafood = tags.has('seafood');
  const dietary: string[] = [];
  if (!hasMeat) dietary.push('pescatarian');
  if (!hasMeat && !hasSeafood) {
    dietary.push('vegetarian');
    tags.add('vegetarian');
    tags.add('plant-based');
    if (!allergens.includes('dairy') && !hasAny(ingredientText, ANIMAL_PRODUCT_KEYWORDS)) {
      dietary.push('vegan');
    }
  } else {
    tags.delete('plant-based'); // e.g. chili with both beef and beans
  }
  // 'gluten-free' and 'dairy-free' are deliberately NOT guessed here.
  // They're medical claims for some users, and hidden gluten/dairy
  // (canned soups, mixes, broths) is too common in this dataset.

  return {
    id: kaggleId(row),
    name: title,
    emoji: pickEmoji(tags, title),
    tags: [...tags],
    vibe: pickVibe(ingredientText),
    plate: null,
    nutrition: null,
    prep_minutes: prepMinutes,
    cook_minutes: cookMinutes,
    servings: null,
    difficulty: estimateDifficulty(directions.length, total),
    dietary,
    allergens,
    allergens_verified: false,
    ingredients: rawIngredients.map(parseIngredient),
    instructions: directions,
    source: 'kaggle',
    source_url: row.link ? (row.link.startsWith('http') ? row.link : `https://${row.link}`) : null,
  };
}
