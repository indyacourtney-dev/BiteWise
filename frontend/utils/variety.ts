// utils/variety.ts — keeps recommendations from repeating.
//
// Used by Decide for me (utils/decide.ts) and the This or That result
// (utils/thisOrThat.ts). Three pieces:
//
// 1. MEMORY (recencyPenalty)
//    Every recipe the app SHOWS as a pick is logged (AppContext
//    recipeExposure), not only the ones you chose. The penalty fades by
//    half every HALF_LIFE_DAYS, so a favourite comes back after a few days
//    instead of every night:
//        shown and skipped  SHOWN_WEIGHT  x 0.5^(days / 3)
//        chosen (you made it) CHOSEN_WEIGHT x 0.5^(days / 3)
//
// 2. WEIGHTED DRAW (drawOrder)
//    Instead of always taking the top score, recipes are drawn in turn with
//    probability ∝ exp(score / temperature) (Gumbel-top-k sampling). A clearly
//    better match still wins most of the time; near-ties rotate.
//
// 3. DIFFERENT NEXT PICK (similarity)
//    While drawing, each recipe loses points for being the same kind of dish
//    (tacos, pasta, bowl...) or the same main protein as ones already drawn,
//    so "Not feeling it" moves on to something actually different.

import { profileOf } from './thisOrThat';
import type { Recipe } from '../types';

export interface Exposure {
  id: string;
  /** ms since epoch */
  at: number;
  chosen?: boolean;
}

export const HALF_LIFE_DAYS = 3;
export const SHOWN_WEIGHT = 18;
export const CHOSEN_WEIGHT = 30;
export const MAX_EXPOSURES = 300;

const DAY = 86_400_000;

/** Points to subtract for having seen this recipe recently. */
export function recencyPenalty(id: string, log: Exposure[], now = Date.now()): number {
  let p = 0;
  for (const e of log) {
    if (e.id !== id) continue;
    const days = Math.max(0, (now - e.at) / DAY);
    p += (e.chosen ? CHOSEN_WEIGHT : SHOWN_WEIGHT) * Math.pow(0.5, days / HALF_LIFE_DAYS);
  }
  return Math.min(p, CHOSEN_WEIGHT * 1.5);
}

/** Newest first, capped. */
export function addExposures(log: Exposure[], entries: Exposure[]): Exposure[] {
  return [...entries, ...log].slice(0, MAX_EXPOSURES);
}

// ---------- dish families ----------

const FAMILIES: [string, RegExp][] = [
  ['tacos', /\btacos?\b|\bquesadilla|\bnachos\b/i],
  ['burrito', /\bburrito|\bfajita/i],
  ['pasta', /\bpasta\b|\bspaghetti|\bpenne|\bmac(aroni)?\b|\blasagn|\bfettuccin|\blinguin|\brigatoni|\bcarbonara|\bziti/i],
  ['noodles', /\bnoodle|\bpad thai|\blo mein|\bramen|\budon|\bsoba/i],
  ['curry', /\bcurry|\btikka|\bmasala|\bkorma/i],
  ['stir-fry', /\bstir[- ]?fry|\bfried rice/i],
  ['soup', /\bsoup|\bstew|\bchili\b|\bchowder|\bbisque/i],
  ['salad', /\bsalad\b/i],
  ['sandwich', /\bsandwich|\bpanini|\bsub\b|\bmelt\b|\bsliders?\b/i],
  ['burger', /\bburgers?\b/i],
  ['wrap', /\bwraps?\b|\bflatbread|\bpita\b|\bgyro/i],
  ['pizza', /\bpizza|\bcalzone/i],
  ['eggs', /\bomelet|\bfrittata|\bscramble|\beggs?\b|\bshakshuka/i],
  ['pancakes', /\bpancake|\bwaffle|\bfrench toast|\bcrepe/i],
  ['oats', /\boat(meal|s)?\b|\bgranola|\bporridge|\bparfait|\bsmoothie/i],
  ['skillet', /\bskillet|\bsheet[- ]pan|\bhash\b/i],
  ['bowl', /\bbowls?\b/i],
  ['baked', /\bcake|\bcookie|\bbrownie|\bpie\b|\bmuffin|\bcrisp\b|\bcobbler|\bbars?\b/i],
];

/** "tacos", "pasta", "bowl"... or "plate" for a plated main. */
export function dishFamily(recipe: Pick<Recipe, 'name'>): string {
  for (const [family, re] of FAMILIES) if (re.test(recipe.name)) return family;
  return 'plate';
}

/** Main protein answer from the quiz questions ('protein-chicken', ...) or null. */
function proteinOf(recipe: Recipe): string | null {
  try {
    return profileOf(recipe)['protein-type'] ?? null;
  } catch {
    return null;
  }
}

export const SAME_FAMILY_COST = 9;
export const SAME_PROTEIN_COST = 6;

function similarityCost(recipe: Recipe, drawn: Recipe[]): number {
  if (drawn.length === 0) return 0;
  const fam = dishFamily(recipe);
  const prot = proteinOf(recipe);
  let cost = 0;
  for (const d of drawn) {
    // The pick right before counts fully, older ones half.
    const w = d === drawn[drawn.length - 1] ? 1 : 0.5;
    if (dishFamily(d) === fam && fam !== 'plate') cost += SAME_FAMILY_COST * w;
    if (prot && proteinOf(d) === prot) cost += SAME_PROTEIN_COST * w;
  }
  return cost;
}

// ---------- weighted draw ----------

/** Standard Gumbel noise: -log(-log(U)). */
function gumbel(rand: () => number): number {
  const u = Math.min(1 - 1e-12, Math.max(1e-12, rand()));
  return -Math.log(-Math.log(u));
}

/**
 * Orders items for showing one at a time. The first `diverseCount` are drawn
 * with the similarity cost (that's what someone skipping through sees); the
 * rest follow by noisy score.
 */
export function drawOrder<T>(
  items: T[],
  score: (t: T) => number,
  recipeOf: (t: T) => Recipe,
  opts: { temperature?: number; diverseCount?: number; random?: () => number } = {},
): T[] {
  const T = opts.temperature ?? 5;
  const rand = opts.random ?? Math.random;
  const k = Math.min(opts.diverseCount ?? 8, items.length);
  // One noise draw per item, so the order is a proper weighted sample.
  const noisy = items.map(item => ({ item, key: score(item) + T * gumbel(rand) }));
  const out: T[] = [];
  const drawn: Recipe[] = [];
  const left = [...noisy];
  for (let i = 0; i < k; i++) {
    let best = 0;
    let bestKey = -Infinity;
    left.forEach((c, j) => {
      const key = c.key - similarityCost(recipeOf(c.item), drawn);
      if (key > bestKey) {
        bestKey = key;
        best = j;
      }
    });
    const [chosen] = left.splice(best, 1);
    out.push(chosen.item);
    drawn.push(recipeOf(chosen.item));
  }
  left.sort((a, b) => b.key - a.key);
  return [...out, ...left.map(c => c.item)];
}
