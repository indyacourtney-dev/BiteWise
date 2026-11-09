// backend/supabase/functions/generate-recipes/generation.ts
//
// The pure half of AI recipe generation: clean up what the app sent, build
// the prompt and the output schema, and read Claude's answer. No network,
// no Deno globals, so it's unit-tested in generation.test.ts.
//
// The vocabularies below (meal types, diet tags, allergens, pantry
// categories) are the same ids as frontend/types/index.ts.

export const MEAL_TYPES = ['breakfast', 'brunch', 'lunch', 'dinner', 'dessert'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const VIBES = ['spicy', 'savory', 'sweet'] as const;
export const CATEGORIES = ['proteins', 'produce', 'dairy', 'grains', 'pantry', 'other'] as const;
export const ALLERGENS = [
  'nuts', 'peanuts', 'shellfish', 'fish', 'eggs', 'dairy', 'soy', 'gluten', 'sesame', 'mustard', 'coconut',
  'corn', 'wheat', 'mollusc', 'celery', 'lupin', 'sulphites', 'nightshade', 'alpha_gal',
] as const;
/** Diet rules (hard) and eating goals (soft) the app knows. */
export const DIET_RULES = ['vegetarian', 'vegan', 'pescatarian', 'gluten-free', 'dairy-free', 'halal', 'kosher-style', 'no-red-meat'] as const;
export const DIET_TAGS = [
  ...DIET_RULES, 'low-carb', 'high-protein', 'keto', 'paleo', 'diabetic-friendly', 'hypoglycemia-friendly',
  'heart-healthy', 'low-cholesterol', 'healthy-fats', 'low-sodium', 'low-fat', 'low-calorie', 'high-fiber',
  'low-sugar', 'low-fodmap', 'gout-friendly', 'gerd-friendly',
] as const;

export const MAX_RECIPES = 3;
const MAX_INGREDIENTS = 40;
const MAX_TEXT = 60;
const MAX_NOTE = 200;

type MealType = (typeof MEAL_TYPES)[number];

export interface GenerationRequest {
  ingredients: string[];
  mealType: MealType;
  servings: number;
  count: number;
  /** true = only use these plus basic staples; false = may add a few extras. */
  pantryOnly: boolean;
  /** Free text from the user ("something cozy"), short. */
  note: string;
  preferences: {
    dietRules: string[];
    eatingGoals: string[];
    avoidAllergens: string[];
    customAllergies: string[];
    customAvoid: string[];
    dislikes: string[];
    loves: string[];
    cuisines: string[];
    spiceTolerance: 'mild' | 'medium' | 'hot' | null;
    maxTotalMinutes: number | null;
    difficulty: 'easy' | 'medium' | 'hard' | null;
    allowAlcohol: boolean;
  };
}

export class RequestError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Strings only, trimmed, control characters removed, de-duplicated, capped. */
function textList(v: unknown, max: number, len = MAX_TEXT): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const t = x.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, len);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;

const intIn = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null;

/** Same as frontend/utils/recipeSafety.ts: shellfish also means molluscs, gluten also means wheat. */
function withImplied(avoid: string[]): string[] {
  const out = new Set(avoid);
  if (out.has('shellfish')) out.add('mollusc');
  if (out.has('gluten')) out.add('wheat');
  return [...out];
}

/** Turn the app's JSON body into a clean request, or throw RequestError. */
export function parseRequest(body: unknown): GenerationRequest {
  if (!isObj(body)) throw new RequestError('Send a JSON object');
  const mealType = oneOf(MEAL_TYPES, body.mealType);
  if (!mealType) throw new RequestError(`mealType must be one of ${MEAL_TYPES.join(', ')}`);
  const ingredients = textList(body.ingredients, MAX_INGREDIENTS);
  const p = isObj(body.preferences) ? body.preferences : {};
  const dietary = textList(p.dietary, 30).filter(t => (DIET_TAGS as readonly string[]).includes(t));
  return {
    ingredients,
    mealType,
    servings: intIn(body.servings, 1, 12) ?? 2,
    count: intIn(body.count, 1, MAX_RECIPES) ?? MAX_RECIPES,
    pantryOnly: body.pantryOnly === true,
    note: typeof body.note === 'string' ? body.note.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_NOTE) : '',
    preferences: {
      dietRules: dietary.filter(t => (DIET_RULES as readonly string[]).includes(t)),
      eatingGoals: dietary.filter(t => !(DIET_RULES as readonly string[]).includes(t)),
      avoidAllergens: withImplied(textList(p.avoidAllergens, 30).filter(a => (ALLERGENS as readonly string[]).includes(a))),
      customAllergies: textList(p.customAllergies, 20),
      customAvoid: textList(p.customAvoid, 20),
      dislikes: textList(p.dislikedTags, 20),
      loves: [...textList(p.favoriteTags, 20), ...textList(p.customLoves, 10)].slice(0, 25),
      cuisines: textList(p.cuisines, 10),
      spiceTolerance: oneOf(['mild', 'medium', 'hot'] as const, p.spiceTolerance),
      maxTotalMinutes: intIn(p.maxCookMinutes, 5, 600),
      difficulty: oneOf(DIFFICULTIES, p.preferredDifficulty),
      allowAlcohol: p.allowAlcohol === true,
    },
  };
}

// ============================================
// PROMPT
// ============================================

export const SYSTEM_PROMPT = `You write home-cooking recipes for BiteWise, a meal-planning app. Each request gives the ingredients a person has, the meal they're planning, how many people they're feeding, and their food restrictions and preferences.

Restrictions are about safety. A recipe must never contain an allergen the person avoids, including hidden sources (soy sauce has soy and wheat, Worcestershire sauce has fish, pesto has tree nuts, most broths have celery). It must fully follow every diet rule given. It must not contain any food listed under "allergies they typed" or "never suggest". If you can't write a safe recipe for the request, return fewer recipes, or none, rather than bending a rule.

Preferences are softer: lean toward cuisines and foods they love, away from foods they'd rather skip, and match their spice level, time limit and skill level where you can.

Write ingredient names the way a grocery list would: one plain, common ingredient per line ("chicken thighs", "canned black beans", "low-sodium soy sauce"), with the amount in the quantity field, not in the name. Don't write "X or Y" or brand names in a name. Basic staples (salt, black pepper, cooking oil, water) may always be used.

Steps should be clear enough for a beginner: one action per step, with heat levels and times, and no step numbers.

Be honest in claimedAllergens and claimedDietary, because the app checks them against its own ingredient list: list every allergen the recipe contains, and only the diets it truly fits. Give realistic times; use null when you can't estimate one. Nutrition is a per-serving estimate. plate is the rough share of the plate (percent) taken by produce, protein, carbs and healthy fats, adding up to 100.`;

const list = (xs: string[], none = 'none') => (xs.length ? xs.join(', ') : none);

/** The user turn: the request as plain labelled lines. */
export function buildUserPrompt(r: GenerationRequest): string {
  const p = r.preferences;
  const lines = [
    `Write ${r.count} different ${r.mealType} recipe${r.count === 1 ? '' : 's'} for ${r.servings} ${r.servings === 1 ? 'person' : 'people'}.`,
    '',
    `Ingredients they have: ${list(r.ingredients, 'not given, so suggest everyday ingredients')}`,
    r.pantryOnly
      ? 'Use only those ingredients plus basic staples.'
      : 'Build mainly on those ingredients; adding a few common ones is fine.',
    '',
    'RESTRICTIONS (must follow):',
    `- Allergies: ${list(p.avoidAllergens)}`,
    `- Allergies they typed: ${list(p.customAllergies)}`,
    `- Diet rules: ${list(p.dietRules)}`,
    `- Never suggest: ${list(p.customAvoid)}`,
    `- Alcohol: ${p.allowAlcohol ? 'allowed' : 'not allowed, not even for cooking'}`,
    '',
    'PREFERENCES (favor these):',
    `- Eating goals: ${list(p.eatingGoals)}`,
    `- Foods and styles they love: ${list(p.loves)}`,
    `- Rather skip: ${list(p.dislikes)}`,
    `- Cuisines: ${list(p.cuisines, 'any')}`,
    `- Spice level: ${p.spiceTolerance ?? 'any'}`,
    `- Total time limit: ${p.maxTotalMinutes ? `${p.maxTotalMinutes} minutes` : 'none'}`,
    `- Skill level: ${p.difficulty ?? 'any'}`,
  ];
  if (r.note) lines.push('', `What they're in the mood for (their words): ${r.note}`);
  return lines.join('\n');
}

// ============================================
// OUTPUT SCHEMA (structured outputs: every object closed, every field required)
// ============================================

const str = { type: 'string' };
const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const enumOf = (values: readonly string[]) => ({ type: 'string', enum: [...values] });
const obj = (properties: Record<string, unknown>) => ({
  type: 'object', additionalProperties: false, properties, required: Object.keys(properties),
});

export const RECIPE_SCHEMA = obj({
  name: str,
  description: str,
  emoji: str,
  mealTypes: { type: 'array', items: enumOf(MEAL_TYPES) },
  servings: { type: 'integer' },
  prepMinutes: nullable({ type: 'integer' }),
  cookMinutes: nullable({ type: 'integer' }),
  difficulty: enumOf(DIFFICULTIES),
  vibe: enumOf(VIBES),
  cuisine: nullable(str),
  tags: { type: 'array', items: str },
  ingredients: {
    type: 'array',
    items: obj({ name: str, quantity: str, category: enumOf(CATEGORIES), optional: { type: 'boolean' } }),
  },
  instructions: { type: 'array', items: str },
  nutritionPerServing: obj({
    calories: nullable({ type: 'number' }),
    protein: nullable({ type: 'number' }),
    carbs: nullable({ type: 'number' }),
    totalFat: nullable({ type: 'number' }),
    healthyFat: nullable({ type: 'number' }),
  }),
  plate: obj({ produce: { type: 'integer' }, protein: { type: 'integer' }, carbs: { type: 'integer' }, healthyFats: { type: 'integer' } }),
  claimedDietary: { type: 'array', items: enumOf(DIET_TAGS) },
  claimedAllergens: { type: 'array', items: enumOf(ALLERGENS) },
  containsAlcohol: { type: 'boolean' },
});

export const OUTPUT_SCHEMA = obj({ recipes: { type: 'array', items: RECIPE_SCHEMA } });

// ============================================
// READING THE ANSWER
// ============================================

export type FailureCode = 'refused' | 'incomplete' | 'malformed';

export class GenerationError extends Error {
  constructor(public code: FailureCode, message: string) {
    super(message);
  }
}

interface ContentLike { type: string; text?: string }

/**
 * The recipes from Claude's reply, as plain objects. Field-level checks
 * happen in the app (frontend/utils/aiRecipes.ts); here we only make sure
 * the reply is usable at all.
 */
export function readRecipes(stopReason: string | null, content: ContentLike[]): Record<string, unknown>[] {
  if (stopReason === 'refusal') {
    throw new GenerationError('refused', 'The AI declined this request. Try different ingredients or wording.');
  }
  if (stopReason === 'max_tokens') {
    throw new GenerationError('incomplete', 'The AI ran out of room before finishing. Try asking for fewer recipes.');
  }
  const text = content.filter(b => b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GenerationError('malformed', 'The AI sent back something that wasn’t a recipe.');
  }
  if (!isObj(parsed) || !Array.isArray(parsed.recipes)) {
    throw new GenerationError('malformed', 'The AI sent back something that wasn’t a recipe.');
  }
  return parsed.recipes.filter(isObj).slice(0, MAX_RECIPES);
}

/** Ingredient names from one generated recipe, for the catalog check. */
export function ingredientNames(recipe: Record<string, unknown>): string[] {
  if (!Array.isArray(recipe.ingredients)) return [];
  return recipe.ingredients
    .map(i => (isObj(i) && typeof i.name === 'string' ? i.name.trim() : ''))
    .filter(Boolean);
}
