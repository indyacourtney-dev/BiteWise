// utils/aiRecipes.ts — turn what the generate-recipes Edge Function returned
// into BiteWise Recipe objects.
//
// The AI's answer follows a JSON schema, but nothing here assumes it did:
// every field is checked, and a recipe without a name, ingredients or steps
// is dropped with a reason instead of crashing a screen.
//
// Labels: dietary, mayContain and allergensVerified come ONLY from the
// ingredient catalog check the server ran. Allergens are the catalog's plus
// any the AI admitted to (never fewer). What the AI claimed is kept in
// recipe.ai as unverified. The safety check (utils/recipeSafety.ts) then
// decides what can be shown.

import type { Allergen, DietaryTag, Difficulty, Ingredient, MealType, PantryCategoryId, Recipe, Vibe } from '../types';

const MEALS: MealType[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'dessert'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const VIBES: Vibe[] = ['spicy', 'savory', 'sweet'];
const CATEGORIES: PantryCategoryId[] = ['proteins', 'produce', 'dairy', 'grains', 'pantry', 'other'];
const ALLERGENS: Allergen[] = [
  'nuts', 'peanuts', 'shellfish', 'fish', 'eggs', 'dairy', 'soy', 'gluten', 'sesame', 'mustard', 'coconut',
  'corn', 'wheat', 'mollusc', 'celery', 'lupin', 'sulphites', 'nightshade', 'alpha_gal',
];

export interface WireLabels {
  status: 'checked' | 'unavailable';
  allKnown?: boolean;
  allergens?: unknown;
  mayContain?: unknown;
  dietary?: unknown;
  unmatched?: unknown;
}

export interface NormalizeContext {
  mealType: MealType;
  servings: number;
  model: string;
  now?: number;
  /** Position in the batch, for a unique id. */
  index?: number;
}

export type NormalizeResult = { ok: true; recipe: Recipe } | { ok: false; reason: string };

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const strings = (v: unknown, max = 30, len = 80) =>
  Array.isArray(v) ? v.map(x => text(x, len)).filter(Boolean).slice(0, max) : [];
const pick = <T extends string>(list: readonly T[], v: unknown): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;
const num = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v)) : null;

/** Short stable hash, so the same recipe gets the same id. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Plate shares as whole percents adding up to 100, or all zero if unusable. */
function normalizePlate(v: unknown): Recipe['plate'] {
  const p = isObj(v) ? v : {};
  const raw = [p.produce, p.protein, p.carbs, p.healthyFats].map(x => num(x, 1000) ?? 0);
  const total = raw.reduce((a, b) => a + b, 0);
  if (total <= 0) return { produce: 0, protein: 0, carbs: 0, healthyFats: 0 };
  const [produce, protein, carbs] = raw.map(x => Math.round((x / total) * 100));
  return { produce, protein, carbs, healthyFats: Math.max(0, 100 - produce - protein - carbs) };
}

export function normalizeGeneratedRecipe(raw: unknown, labels: WireLabels | null | undefined, ctx: NormalizeContext): NormalizeResult {
  try {
    if (!isObj(raw)) return { ok: false, reason: 'The AI sent an empty recipe' };
    const name = text(raw.name, 80);
    if (!name) return { ok: false, reason: 'A recipe had no name' };

    const ingredients: Ingredient[] = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
      .filter(isObj)
      .map(i => ({
        name: text(i.name, 80),
        amount: text(i.quantity ?? i.amount, 40),
        category: pick(CATEGORIES, i.category) ?? 'other',
        ...(i.optional === true ? { optional: true } : {}),
      }))
      .filter(i => i.name)
      .slice(0, 40);
    if (ingredients.length === 0) return { ok: false, reason: `“${name}” had no ingredients` };

    const instructions = strings(raw.instructions, 30, 500);
    if (instructions.length === 0) return { ok: false, reason: `“${name}” had no steps` };

    const prep = num(raw.prepMinutes, 600);
    const cook = num(raw.cookMinutes, 1440);
    const n = isObj(raw.nutritionPerServing) ? raw.nutritionPerServing : {};
    const calories = num(n.calories, 5000);
    const servings = num(raw.servings, 50);

    const checked = labels?.status === 'checked';
    const claimedAllergens = strings(raw.claimedAllergens).filter(a => ALLERGENS.includes(a as Allergen));
    const catalogAllergens = checked ? strings(labels!.allergens).filter(a => ALLERGENS.includes(a as Allergen)) : [];
    const mealTypes = strings(raw.mealTypes).map(m => pick(MEALS, m)).filter((m): m is MealType => !!m);

    const recipe: Recipe = {
      id: `ai-${hash(name + '|' + ingredients.map(i => i.name).join(','))}${ctx.index ?? 0}`,
      name,
      description: text(raw.description, 300) || undefined,
      emoji: text(raw.emoji, 8) || '🍽️',
      tags: Array.from(new Set([...strings(raw.tags, 12, 30).map(t => t.toLowerCase()), ...(text(raw.cuisine, 30) ? [text(raw.cuisine, 30).toLowerCase()] : []), 'ai-generated'])),
      vibe: pick(VIBES, raw.vibe) ?? 'savory',
      plate: normalizePlate(raw.plate),
      nutrition: {
        calories: calories ?? 0,
        protein: num(n.protein, 500) ?? 0,
        carbs: num(n.carbs, 1000) ?? 0,
        totalFat: num(n.totalFat, 500) ?? 0,
        healthyFat: num(n.healthyFat, 500) ?? 0,
      },
      prepMinutes: prep ?? 0,
      cookMinutes: cook ?? 0,
      servings: servings && servings > 0 ? servings : ctx.servings,
      servingsEstimated: !(servings && servings > 0),
      difficulty: pick(DIFFICULTIES, raw.difficulty) ?? 'medium',
      ingredients,
      instructions,
      // Checked labels only. Without a catalog check: no diet tags, allergens unverified.
      dietary: checked ? (strings(labels!.dietary, 60) as DietaryTag[]) : [],
      allergens: Array.from(new Set([...catalogAllergens, ...claimedAllergens])) as Allergen[],
      mayContain: checked ? (strings(labels!.mayContain).filter(a => ALLERGENS.includes(a as Allergen)) as Allergen[]) : [],
      allergensVerified: checked && labels!.allKnown === true,
      containsAlcohol: raw.containsAlcohol === true,
      mealTypes: mealTypes.length ? Array.from(new Set([ctx.mealType, ...mealTypes])) : [ctx.mealType],
      kind: 'food',
      source: 'ai',
      ai: {
        claimedDietary: strings(raw.claimedDietary),
        claimedAllergens,
        labelsChecked: checked,
        unmatchedIngredients: checked ? strings(labels!.unmatched, 40) : [],
        timesKnown: prep !== null && cook !== null,
        nutritionKnown: calories !== null && calories > 0,
        model: text(ctx.model, 60),
        generatedAt: ctx.now ?? Date.now(),
      },
    };
    return { ok: true, recipe };
  } catch {
    return { ok: false, reason: 'A recipe couldn’t be read' };
  }
}
