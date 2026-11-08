// utils/focus.ts — nutrition focuses, read off a recipe's ingredients.
//
// A focus is something a person wants more of in their food — fiber, a
// rainbow of produce, lean protein, healthy fats, fermented foods. The
// recipe database has calories and macros but no fiber, vitamins or
// cultures, so each focus is judged from the ingredient list with plain
// keyword families (and the macros where they help). It's a nudge with a
// reason, never a verdict: "High in fiber: lentils, oats" / "Add a spoon of
// chia or berries for fiber".
//
// Also here: the ingredient signals the goal-based scoring in utils/goals.ts
// needs (complex carbs, whole grains, processed / salty, added sugar).

import type { Recipe } from '../types';

export type FocusId = 'fiber' | 'rainbow' | 'leanProtein' | 'healthyFats' | 'fermented';

export const FOCUS_IDS: FocusId[] = ['fiber', 'rainbow', 'leanProtein', 'healthyFats', 'fermented'];

export const FOCUS_INFO: Record<FocusId, { label: string; emoji: string; goal: string; how: string }> = {
  fiber: {
    label: 'More fiber', emoji: '🌾',
    goal: 'Better digestion, lower cholesterol, a healthier gut.',
    how: 'Chia, flax, lentils, beans, berries and oats in everyday meals — aiming for 25–38 g a day.',
  },
  rainbow: {
    label: 'Eat the rainbow', emoji: '🌈',
    goal: 'More vitamins, minerals and antioxidants; a stronger immune system.',
    how: 'At least three different colors of fruit or veg in every main meal.',
  },
  leanProtein: {
    label: 'Lean protein', emoji: '🍗',
    goal: 'Hit protein targets while keeping saturated fat in check.',
    how: 'Skinless chicken, turkey, fish, tofu, egg whites and low-fat Greek yogurt over fattier cuts.',
  },
  healthyFats: {
    label: 'Healthy fats', emoji: '🥑',
    goal: 'Hormones, joints and brain all run on good fats.',
    how: 'Avocado, walnuts, almonds, oily fish and extra-virgin olive oil instead of processed oils and trans fats.',
  },
  fermented: {
    label: 'Fermented foods', emoji: '🫙',
    goal: 'Less bloating, better absorption, a stronger gut.',
    how: 'One serving a day of live-culture food: kefir, kimchi, sauerkraut, miso, yogurt.',
  },
};

export interface FocusCheck {
  id: FocusId;
  /** 0..1 — how well the recipe serves this focus as written. */
  score: number;
  /** ≥ 0.75: counts as a hit. */
  hit: boolean;
  /** Ingredients that earned it, for the reason line. */
  evidence: string[];
  /** Short line when it's a hit. */
  reason: string;
  /** What to add or swap when it isn't. */
  addTip: string;
}

// ---- keyword families ---------------------------------------------------

const FIBER_RICH = [
  'chia', 'flax', 'lentil', 'black bean', 'kidney bean', 'pinto bean', 'white bean', 'cannellini', 'navy bean', 'beans',
  'chickpea', 'garbanzo', 'edamame', 'split pea', 'blueberr', 'raspberr', 'strawberr', 'blackberr', 'oat', 'barley', 'quinoa',
  'bulgur', 'farro', 'brown rice', 'whole wheat', 'whole-wheat', 'whole grain', 'wholegrain', 'bran', 'pear', 'apple', 'broccoli',
  'brussels', 'artichoke', 'sweet potato', 'avocado', 'almond', 'pea', 'cabbage', 'carrot', 'spinach', 'kale',
];

const COLOR_FAMILIES: Record<string, string[]> = {
  red: ['tomato', 'red pepper', 'red bell', 'strawberr', 'raspberr', 'cherr', 'watermelon', 'beet', 'radish', 'red onion', 'pomegranate', 'red cabbage', 'red chili', 'red chile', 'cranberr'],
  orange: ['carrot', 'sweet potato', 'orange', 'pumpkin', 'butternut', 'apricot', 'mango', 'cantaloupe', 'orange pepper', 'peach', 'papaya', 'persimmon'],
  yellow: ['corn', 'yellow pepper', 'yellow squash', 'summer squash', 'banana', 'pineapple', 'lemon', 'golden beet', 'yellow bell'],
  green: ['spinach', 'kale', 'broccoli', 'lettuce', 'arugula', 'rocket', 'zucchini', 'courgette', 'cucumber', 'green bean', 'peas', 'asparagus', 'avocado', 'lime', 'green onion', 'scallion', 'cilantro', 'coriander', 'parsley', 'basil', 'celery', 'brussels', 'bok choy', 'edamame', 'kiwi', 'green pepper', 'green bell', 'chard', 'collard', 'mint', 'leek', 'green cabbage', 'snap pea', 'snow pea', 'okra', 'artichoke', 'watercress'],
  purple: ['blueberr', 'blackberr', 'eggplant', 'aubergine', 'purple cabbage', 'grape', 'plum', 'fig', 'purple', 'red cabbage', 'acai'],
  white: ['onion', 'garlic', 'cauliflower', 'mushroom', 'potato', 'turnip', 'parsnip', 'ginger', 'jicama', 'daikon', 'shallot', 'fennel'],
};

const LEAN_PROTEIN = [
  'chicken breast', 'skinless chicken', 'turkey', 'tofu', 'egg white', 'greek yogurt', 'cottage cheese', 'cod', 'tilapia', 'halibut',
  'haddock', 'white fish', 'shrimp', 'prawn', 'tuna', 'salmon', 'trout', 'scallop', 'lentil', 'chickpea', 'black bean', 'white bean',
  'kidney bean', 'tempeh', 'edamame', 'lean ground', 'extra lean', 'sirloin', 'pork tenderloin', 'pork loin', 'venison', 'bison', 'seitan',
];
const FATTY_PROTEIN = [
  'bacon', 'sausage', 'pork belly', 'spare rib', 'ribs', 'chorizo', 'salami', 'pepperoni', 'ham hock', 'brisket', 'hot dog',
  'frankfurter', 'lamb shoulder', 'chicken wing', 'chicken thigh', 'skin-on', 'prosciutto', 'pancetta', 'ground pork', 'short rib',
  'pastrami', 'bologna', 'spam', 'duck',
];
const ANY_PROTEIN = [...LEAN_PROTEIN, ...FATTY_PROTEIN, 'chicken', 'beef', 'pork', 'lamb', 'fish', 'egg', 'bean', 'yogurt', 'cheese', 'steak'];

const GOOD_FATS = [
  'avocado', 'walnut', 'almond', 'pecan', 'pistachio', 'cashew', 'hazelnut', 'peanut', 'chia', 'flax', 'hemp', 'olive oil',
  'extra virgin', 'extra-virgin', 'salmon', 'sardine', 'mackerel', 'trout', 'anchov', 'tahini', 'sesame', 'nut butter', 'almond butter',
  'peanut butter', 'olives', 'pumpkin seed', 'pepita', 'sunflower seed', 'avocado oil',
];
const POOR_FATS = ['shortening', 'margarine', 'lard', 'vegetable oil', 'canola', 'corn oil', 'palm oil', 'heavy cream', 'bacon', 'deep fry', 'fried'];

const FERMENTED = [
  'kefir', 'kimchi', 'sauerkraut', 'miso', 'tempeh', 'kombucha', 'yogurt', 'yoghurt', 'sourdough', 'natto', 'gochujang',
  'fermented', 'labneh', 'skyr', 'buttermilk', 'pickled', 'kvass', 'doenjang', 'lassi',
];

export const COMPLEX_CARBS = [
  'oat', 'brown rice', 'wild rice', 'quinoa', 'sweet potato', 'potato', 'whole wheat', 'whole-wheat', 'whole grain', 'wholegrain',
  'barley', 'farro', 'bulgur', 'buckwheat', 'millet', 'lentil', 'beans', 'chickpea', 'banana', 'corn', 'pasta', 'rice', 'couscous', 'bread',
];
export const WHOLE_GRAINS = ['oat', 'brown rice', 'wild rice', 'quinoa', 'whole wheat', 'whole-wheat', 'whole grain', 'wholegrain', 'barley', 'farro', 'bulgur', 'buckwheat', 'millet', 'rye', 'spelt'];
export const PROCESSED_SALTY = ['bacon', 'sausage', 'ham', 'salami', 'pepperoni', 'hot dog', 'soy sauce', 'bouillon', 'canned soup', 'instant', 'ramen seasoning', 'processed cheese', 'velveeta', 'spam', 'pickle', 'olives', 'anchov', 'fish sauce', 'ketchup'];
export const ADDED_SUGAR = ['sugar', 'brown sugar', 'syrup', 'honey', 'molasses', 'condensed milk', 'frosting', 'icing', 'candy', 'chocolate chips', 'marshmallow', 'jam', 'jelly', 'caramel', 'sweetened'];
export const MOOD_FOODS = ['walnut', 'almond', 'salmon', 'sardine', 'mackerel', 'tuna', 'spinach', 'kale', 'chard', 'broccoli', 'egg', 'oat', 'banana', 'lentil', 'turkey', 'pumpkin seed', 'dark chocolate', 'blueberr'];

// ---- matching -----------------------------------------------------------

function names(recipe: Pick<Recipe, 'ingredients' | 'name' | 'tags'>): string[] {
  return recipe.ingredients.map(i => i.name.toLowerCase());
}

/** Ingredient names that contain any of the keywords (deduped, pretty). */
export function hits(recipe: Pick<Recipe, 'ingredients' | 'name' | 'tags'>, keywords: string[]): string[] {
  const out: string[] = [];
  for (const n of names(recipe)) {
    if (keywords.some(k => n.includes(k)) && !out.includes(n)) out.push(n);
  }
  return out;
}

const pretty = (list: string[], max = 2) => list.slice(0, max).map(s => s.replace(/^(fresh|chopped|diced|sliced|large|small|medium|ripe|cooked|canned|dried|frozen)\s+/g, '')).join(', ');

export function distinctColors(recipe: Pick<Recipe, 'ingredients' | 'name' | 'tags'>): string[] {
  const n = names(recipe);
  return Object.entries(COLOR_FAMILIES)
    .filter(([, kws]) => n.some(x => kws.some(k => x.includes(k))))
    .map(([color]) => color);
}

export function checkFocus(recipe: Recipe, id: FocusId): FocusCheck {
  switch (id) {
    case 'fiber': {
      const ev = hits(recipe, FIBER_RICH);
      let score = ev.length === 0 ? 0 : ev.length === 1 ? 0.5 : ev.length === 2 ? 0.8 : 1;
      if (recipe.plate.produce >= 40 && score < 1) score = Math.min(1, score + 0.2);
      return {
        id, score, hit: score >= 0.75, evidence: ev,
        reason: ev.length ? `High in fiber: ${pretty(ev)}` : 'A good amount of fiber',
        addTip: 'For fiber: a spoon of chia or flax, beans on the side, or berries after',
      };
    }
    case 'rainbow': {
      const colors = distinctColors(recipe);
      const score = Math.min(1, colors.length / 3);
      const n = colors.length;
      return {
        id, score, hit: n >= 3, evidence: colors,
        reason: `${n >= 5 ? 'Five' : n === 4 ? 'Four' : 'Three'} colors on the plate`,
        addTip: n === 0 ? 'Add a colorful side: a salad, roasted peppers or fruit' : n === 1 ? 'Add two more colors of veg or fruit' : 'One more color of veg or fruit makes it a rainbow',
      };
    }
    case 'leanProtein': {
      const lean = hits(recipe, LEAN_PROTEIN);
      const fatty = hits(recipe, FATTY_PROTEIN);
      const any = hits(recipe, ANY_PROTEIN);
      const fatShare = recipe.nutrition.calories > 0 ? (recipe.nutrition.totalFat * 9) / recipe.nutrition.calories : 0;
      let score: number;
      // A lean source is a lean source; a high fat share with one (oil,
      // avocado, nuts) still counts, just a little less.
      if (lean.length && !fatty.length) score = fatShare <= 0.45 ? 1 : 0.8;
      else if (lean.length && fatty.length) score = 0.4;
      else if (fatty.length) score = 0.1;
      else if (any.length) score = fatShare <= 0.35 ? 0.7 : 0.4;
      else score = 0.3;
      return {
        id, score, hit: score >= 0.75, evidence: lean,
        reason: lean.length ? `Lean protein: ${pretty(lean)}` : 'A lean source of protein',
        addTip: fatty.length
          ? `Swap ${pretty(fatty, 1)} for chicken breast, turkey, tofu or egg whites`
          : 'Add a lean protein: chicken breast, fish, tofu, egg whites or Greek yogurt',
      };
    }
    case 'healthyFats': {
      const good = hits(recipe, GOOD_FATS);
      const poor = hits(recipe, POOR_FATS);
      const ratio = recipe.nutrition.totalFat > 0 ? recipe.nutrition.healthyFat / recipe.nutrition.totalFat : 0;
      let score = good.length === 0 ? (ratio >= 0.5 ? 0.6 : 0.2) : good.length === 1 ? 0.75 : 1;
      if (poor.length) score = Math.max(0, score - 0.4);
      return {
        id, score, hit: score >= 0.75, evidence: good,
        reason: good.length ? `Good fats from ${pretty(good)}` : 'Mostly unsaturated fats',
        addTip: poor.length ? `Use olive or avocado oil instead of ${pretty(poor, 1)}` : 'Finish with olive oil, sliced avocado or a handful of nuts',
      };
    }
    case 'fermented': {
      const ev = hits(recipe, FERMENTED);
      return {
        id, score: ev.length ? 1 : 0, hit: ev.length > 0, evidence: ev,
        reason: ev.length ? `Has a fermented food: ${pretty(ev, 1)}` : 'Includes a fermented food',
        addTip: 'Add a spoon of kimchi or sauerkraut, or a side of yogurt or kefir',
      };
    }
  }
}

export interface FocusFit {
  /** 0..1 — average over the chosen focuses. */
  score: number;
  checks: FocusCheck[];
  /** The best hit's reason, if any. */
  reason: string | null;
  /** The first miss's tip, if any. */
  tip: string | null;
}

export function focusFit(recipe: Recipe, focuses: FocusId[] | undefined | null): FocusFit {
  const ids = (focuses ?? []).filter((f): f is FocusId => FOCUS_IDS.includes(f));
  if (ids.length === 0) return { score: 0, checks: [], reason: null, tip: null };
  const checks = ids.map(id => checkFocus(recipe, id));
  const score = checks.reduce((a, c) => a + c.score, 0) / checks.length;
  const best = [...checks].filter(c => c.hit).sort((a, b) => b.score - a.score)[0];
  const miss = checks.find(c => !c.hit);
  return { score, checks, reason: best ? best.reason : null, tip: miss ? miss.addTip : null };
}

// ---- signals for the goal scorers --------------------------------------

export function hasComplexCarbs(recipe: Recipe): string[] { return hits(recipe, COMPLEX_CARBS); }
export function hasWholeGrains(recipe: Recipe): string[] { return hits(recipe, WHOLE_GRAINS); }
export function processedSalty(recipe: Recipe): string[] { return hits(recipe, PROCESSED_SALTY); }
export function addedSugar(recipe: Recipe): string[] {
  return recipe.vibe === 'sweet' || recipe.tags.includes('dessert') ? ['sweet'] : hits(recipe, ADDED_SUGAR);
}
export function moodFoods(recipe: Recipe): string[] { return hits(recipe, MOOD_FOODS); }
