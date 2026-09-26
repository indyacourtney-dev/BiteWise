// utils/thisOrThat.ts — the This or That engine.
//
// The game learns what you're craving by asking you to choose between two
// dishes. Each choice is read through the same questions as the quiz
// (data/quizQuestions.ts): protein type and prep, carb type and richness,
// veggie type and prep... plus flavor (spicy / savory / sweet).
//
// HOW IT CHOOSES THE NEXT PAIR (adaptive, one question per round)
// ---------------------------------------------------------------
// For every question the game keeps a score per answer ("chicken 1.2,
// beef -1.2, fish 0, plant-based 0"), turned into probabilities. How UNSURE
// it is about a question is the entropy of those probabilities (1 = no idea,
// 0 = certain). Each round TARGETS one main question: protein type, carb
// type, veggie type or flavor, whichever it's least sure about. It then
// picks two dishes that differ on that question but, as far as possible,
// agree on the other main questions it's also unsure about. A tap then
// clearly answers one thing ("fish over chicken"), just like the quiz,
// but with photos. After the first round both dishes are also chosen from
// your likely favourites, so later rounds compare real contenders.
//
// HOW A TAP UPDATES IT (a pairwise-preference / Bradley-Terry model)
// -------------------------------------------------------------------
// Each dish's appeal U = sum of the scores of its answers. The chance you
// pick A over B is modelled as sigmoid(U(A) - U(B)). After a tap, every
// question where the two dishes differ moves toward the picked answer by
//     step x importance x (1 - chance we'd have predicted that pick)
// so a surprising pick teaches a lot, and a pick we already expected
// teaches little (no double counting). "Neither" lowers both dishes'
// answers a little.
// Your onboarding loves/dislikes and recent This or That picks start the
// scores slightly off zero, so the game begins from what it knows about you.
//
// WHEN IT STOPS
// -------------
// After at least MIN_ROUNDS, as soon as it's confident about the three main
// questions (confidence >= STOP_CONFIDENCE), or after MAX_ROUNDS. You can
// also stop yourself after the first round.
//
// THE RESULT
// ----------
// Every eligible recipe (hard filters first: allergies, diets, custom
// avoids) is scored by how likely each of its answers is under what the
// game learned, weighted like above. The % shown is the share of learned
// preferences it satisfies, so "80%" means the same thing as in the quiz.

import { QUESTION_BANK, VIBE_OPTIONS, CATEGORY_ORDER, type QuizCategory } from '../data/quizQuestions';
import {
  passesDietaryFilter,
  favoriteOverlap,
  dislikeOverlap,
  isPlateBalanced,
  getPlateSuggestion,
} from './matching';
import type { QuizRun, Recipe, ScoredRecipe, UserPreferences, Vibe } from '../types';

export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 7;
export const STOP_CONFIDENCE = 0.45;

const LEARNING_RATE = 1.6;
const NEITHER_PENALTY = 0.5;
const CANDIDATES_PER_ROUND = 40;
/** Variety: cost of showing a photo again in the same game / a recipe from a recent game. */
const PHOTO_REPEAT_COST = 1.5;
const RECENT_RECIPE_COST = 0.6;
/** How much a confounding difference (another unsure main question) costs a pair. */
const CONFOUND_COST = 0.7;

// =====================================================
// DIMENSIONS
// =====================================================

export interface DimOption {
  id: string;
  label: string;
  emoji: string;
  tags: string[];
}

export interface Dimension {
  id: string;
  category: QuizCategory | 'flavor';
  /** How much this question matters to the result. */
  importance: number;
  options: DimOption[];
}

const CORE = new Set(['protein-type', 'carb-type', 'veg-type']);

export const DIMENSIONS: Dimension[] = [
  ...QUESTION_BANK.map(q => ({
    id: q.dimension as string,
    category: q.category,
    // Main questions decide the meal; the rest (prep, richness...) fine-tune it.
    // Protein matters most, then carb and veggie type.
    importance: q.dimension === 'protein-type' ? 3.5 : CORE.has(q.dimension) ? 3 : 0.5,
    options: q.options.map(o => ({ id: o.id, label: o.label, emoji: o.emoji, tags: o.tags })),
  })),
  {
    id: 'vibe',
    category: 'flavor' as const,
    importance: 1.5,
    options: VIBE_OPTIONS.map(v => ({ id: `vibe-${v.key}`, label: v.label, emoji: v.emoji, tags: [v.key] })),
  },
];

const CORE_DIMS = DIMENSIONS.filter(d => CORE.has(d.id));
/** Questions a round can target: the main three plus flavor. */
const TARGET_DIMS = DIMENSIONS.filter(d => CORE.has(d.id) || d.id === 'vibe');

// =====================================================
// READING A RECIPE
// =====================================================

/** recipe id -> dimension id -> option id (null = the question doesn't apply). */
const profileCache = new Map<string, Record<string, string | null>>();

/** Which answer a recipe gives to each question: the option whose tags it carries most. */
export function profileOf(recipe: Recipe): Record<string, string | null> {
  const cached = profileCache.get(recipe.id);
  if (cached) return cached;
  const tags = new Set([...recipe.tags, recipe.vibe].map(t => t.toLowerCase()));
  const profile: Record<string, string | null> = {};
  for (const dim of DIMENSIONS) {
    let best: string | null = null;
    let bestHits = 0;
    for (const opt of dim.options) {
      const hits = opt.tags.filter(t => tags.has(t.toLowerCase())).length;
      if (hits > bestHits) {
        bestHits = hits;
        best = opt.id;
      }
    }
    profile[dim.id] = best;
  }
  profileCache.set(recipe.id, profile);
  return profile;
}

// =====================================================
// BELIEFS
// =====================================================

export interface Beliefs {
  /** dimension id -> option id -> score */
  scores: Record<string, Record<string, number>>;
  /** dimension id -> number of taps that actually decided it */
  evidence: Record<string, number>;
}

export interface Prior {
  favoriteTags?: string[];
  dislikedTags?: string[];
  /** Tags from recent This or That runs. */
  historyTags?: string[];
}

export function createBeliefs(prior: Prior = {}): Beliefs {
  const favs = new Set((prior.favoriteTags ?? []).map(t => t.toLowerCase()));
  const dislikes = new Set((prior.dislikedTags ?? []).map(t => t.toLowerCase()));
  const history = new Map<string, number>();
  (prior.historyTags ?? []).forEach(t => history.set(t.toLowerCase(), (history.get(t.toLowerCase()) ?? 0) + 1));

  const scores: Beliefs['scores'] = {};
  for (const dim of DIMENSIONS) {
    scores[dim.id] = {};
    for (const opt of dim.options) {
      const t = opt.tags.map(x => x.toLowerCase());
      const fav = t.filter(x => favs.has(x)).length;
      const bad = t.filter(x => dislikes.has(x)).length;
      const seen = Math.min(3, t.reduce((n, x) => n + (history.get(x) ?? 0), 0));
      // Small on purpose: tonight's taps should outweigh what you usually like.
      scores[dim.id][opt.id] = 0.3 * Math.min(fav, 2) - 0.5 * Math.min(bad, 2) + 0.12 * seen;
    }
  }
  return { scores, evidence: {} };
}

/** Recent This or That picks, as tags for the prior. */
export function historyTagsFrom(history: QuizRun[], limit = 5): string[] {
  return history
    .filter(r => r.mode === 'thisorthat')
    .slice(0, limit)
    .flatMap(r => r.tags);
}

export function probabilities(beliefs: Beliefs, dim: Dimension): Record<string, number> {
  const s = beliefs.scores[dim.id];
  const max = Math.max(...dim.options.map(o => s[o.id]));
  const exps = dim.options.map(o => Math.exp(s[o.id] - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  dim.options.forEach((o, i) => (out[o.id] = exps[i] / sum));
  return out;
}

/** 1 = no idea, 0 = certain (normalized entropy). */
export function uncertainty(beliefs: Beliefs, dim: Dimension): number {
  const p = Object.values(probabilities(beliefs, dim));
  const h = -p.reduce((acc, x) => acc + (x > 0 ? x * Math.log(x) : 0), 0);
  return h / Math.log(p.length);
}

/** 0..1: how sure the game is about protein, carb and veggie type. */
export function confidence(beliefs: Beliefs): number {
  const u = CORE_DIMS.reduce((acc, d) => acc + uncertainty(beliefs, d), 0) / CORE_DIMS.length;
  return Math.max(0, Math.min(1, 1 - u));
}

export type Choice = 'left' | 'right' | 'neither';

/** A dish's appeal under current beliefs: sum of its answers' scores. */
function appeal(beliefs: Beliefs, recipe: Recipe): number {
  const profile = profileOf(recipe);
  let u = 0;
  for (const dim of DIMENSIONS) {
    const opt = profile[dim.id];
    if (opt) u += beliefs.scores[dim.id][opt];
  }
  return u;
}

/** Read one tap. Returns new beliefs (doesn't mutate). */
export function applyChoice(beliefs: Beliefs, left: Recipe, right: Recipe, choice: Choice): Beliefs {
  const scores: Beliefs['scores'] = {};
  for (const k of Object.keys(beliefs.scores)) scores[k] = { ...beliefs.scores[k] };
  const evidence = { ...beliefs.evidence };
  const L = profileOf(left);
  const R = profileOf(right);

  if (choice === 'neither') {
    for (const dim of DIMENSIONS) {
      const lo = L[dim.id];
      const ro = R[dim.id];
      if (lo) scores[dim.id][lo] -= NEITHER_PENALTY * Math.min(1, dim.importance);
      if (ro && ro !== lo) scores[dim.id][ro] -= NEITHER_PENALTY * Math.min(1, dim.importance);
    }
    return { scores, evidence };
  }

  const picked = choice === 'left' ? left : right;
  const rejected = choice === 'left' ? right : left;
  const P = choice === 'left' ? L : R;
  const Q = choice === 'left' ? R : L;
  // How surprised we are by this pick: 1 - predicted chance of it.
  const surprise = 1 - 1 / (1 + Math.exp(-(appeal(beliefs, picked) - appeal(beliefs, rejected))));

  for (const dim of DIMENSIONS) {
    const po = P[dim.id];
    const ro = Q[dim.id];
    if (!po || !ro || po === ro) continue; // same answer (or n/a): the tap said nothing here
    const step = LEARNING_RATE * dim.importance / 3 * (0.35 + surprise);
    scores[dim.id][po] += step;
    scores[dim.id][ro] -= step;
    evidence[dim.id] = (evidence[dim.id] ?? 0) + 1;
  }
  return { scores, evidence };
}

// =====================================================
// FIT: how well a recipe matches what we've learned
// =====================================================

/**
 * Weighted sum of how likely each of the recipe's answers is, above chance.
 * `fineTuneWeight` scales the non-main questions (prep, richness...): full
 * weight while choosing pairs, reduced when ranking the final result so a
 * lucky guess about plating can't outvote protein.
 */
export function fitScore(beliefs: Beliefs, recipe: Recipe, fineTuneWeight = 1): number {
  const profile = profileOf(recipe);
  let total = 0;
  for (const dim of DIMENSIONS) {
    const opt = profile[dim.id];
    if (!opt) continue;
    const p = probabilities(beliefs, dim)[opt];
    const w = TARGET_DIMS.includes(dim) ? 1 : fineTuneWeight;
    total += w * dim.importance * (p - 1 / dim.options.length);
  }
  return total;
}

// =====================================================
// NEXT PAIR
// =====================================================

export interface PairOptions {
  /** Same key = same photo. Pairs with one photo twice, and photos already
   *  shown earlier in this game, are avoided so the game never looks repetitive. */
  imageKey?: (r: Recipe) => string;
  /** Recipes shown in the player's last few games; used less often. */
  recentIds?: Set<string>;
  random?: () => number;
  round: number;
}

let lastTarget: string | null = null;
/** The main question the most recent nextPair() round is testing (e.g. 'protein-type'). */
export function lastPairTarget(): string | null {
  return lastTarget;
}

export function nextPair(
  pool: Recipe[],
  beliefs: Beliefs,
  shownIds: Set<string>,
  opts: PairOptions,
): [Recipe, Recipe] | null {
  const rand = opts.random ?? Math.random;
  const fresh = pool.filter(r => !shownIds.has(r.id));
  if (fresh.length < 2) return null;

  // VARIETY: photos already on screen this game, and recipes from recent
  // games, are pushed down (not banned, so a small pool still works).
  const seenPhotos = new Set(
    opts.imageKey ? pool.filter(r => shownIds.has(r.id)).map(opts.imageKey) : [],
  );
  const staleness = (r: Recipe) =>
    (opts.imageKey && seenPhotos.has(opts.imageKey(r)) ? PHOTO_REPEAT_COST : 0) +
    (opts.recentIds?.has(r.id) ? RECENT_RECIPE_COST : 0);

  // Shortlist: the likeliest dishes so far, with a little randomness so
  // two games never play out the same way.
  const ranked = fresh
    .map(r => ({ r, fit: fitScore(beliefs, r), jitter: rand() * 0.6 - staleness(r) }))
    .sort((a, b) => b.fit + b.jitter - (a.fit + a.jitter));
  const shortlist = ranked.slice(0, CANDIDATES_PER_ROUND);

  const fits = shortlist.map(c => c.fit);
  const lo = Math.min(...fits);
  const hi = Math.max(...fits);
  const norm = (f: number) => (hi - lo < 1e-9 ? 0.5 : (f - lo) / (hi - lo));

  const unsure = new Map(DIMENSIONS.map(d => [d.id, uncertainty(beliefs, d)]));
  const probs = new Map(TARGET_DIMS.map(d => [d.id, probabilities(beliefs, d)]));
  const plausibilityWeight = opts.round === 0 ? 0 : 2;

  let best: [Recipe, Recipe] | null = null;
  let bestTarget: string | null = null;
  let bestUtility = -Infinity;
  for (let i = 0; i < shortlist.length; i++) {
    for (let j = i + 1; j < shortlist.length; j++) {
      const a = shortlist[i].r;
      const b = shortlist[j].r;
      const pa = profileOf(a);
      const pb = profileOf(b);
      const differs = (d: Dimension) => !!pa[d.id] && !!pb[d.id] && pa[d.id] !== pb[d.id];

      // Value of the question this pair would answer, minus the other
      // unsure main questions it would muddle.
      let targetValue = 0;
      let target: string | null = null;
      let muddle = 0;
      for (const d of TARGET_DIMS) {
        if (!differs(d)) continue;
        // Pairs that include the likeliest answers are worth more: after
        // "chicken over beef", chicken vs. fish beats beef vs. fish.
        const p = probs.get(d.id)!;
        const mass = (p[pa[d.id]!] + p[pb[d.id]!]) * d.options.length / 2;
        const v = d.importance * (unsure.get(d.id) ?? 0) * mass;
        muddle += v;
        if (v > targetValue) {
          targetValue = v;
          target = d.id;
        }
      }
      muddle -= targetValue;
      if (!target) continue;
      let fineTune = 0;
      for (const d of DIMENSIONS) if (!TARGET_DIMS.includes(d) && differs(d)) fineTune += d.importance * (unsure.get(d.id) ?? 0);

      const plausible = (norm(shortlist[i].fit) + norm(shortlist[j].fit)) / 2;
      const samePhoto = opts.imageKey && opts.imageKey(a) === opts.imageKey(b) ? 3 : 0;
      const utility =
        targetValue - CONFOUND_COST * muddle + 0.1 * fineTune + plausibilityWeight * plausible
        - samePhoto - staleness(a) - staleness(b) + rand() * 0.05;
      if (utility > bestUtility) {
        bestUtility = utility;
        bestTarget = target;
        best = rand() < 0.5 ? [a, b] : [b, a];
      }
    }
  }
  lastTarget = bestTarget;
  return best;
}

export function shouldStop(beliefs: Beliefs, roundsPlayed: number): boolean {
  if (roundsPlayed >= MAX_ROUNDS) return true;
  return roundsPlayed >= MIN_ROUNDS && confidence(beliefs) >= STOP_CONFIDENCE;
}

// =====================================================
// WHAT WE LEARNED
// =====================================================

export interface InferredPreference {
  dimension: string;
  category: QuizCategory | 'flavor';
  optionId: string;
  label: string;
  emoji: string;
  tags: string[];
  /** 0..1 */
  strength: number;
  importance: number;
}

const CATEGORY_RANK: Record<string, number> = Object.fromEntries(
  [...CATEGORY_ORDER, 'flavor'].map((c, i) => [c, i]),
);

/** The answers the game is fairly sure about, main questions first. */
export function inferPreferences(beliefs: Beliefs): InferredPreference[] {
  const out: InferredPreference[] = [];
  for (const dim of DIMENSIONS) {
    if (!beliefs.evidence[dim.id]) continue; // only what your taps actually decided
    const p = probabilities(beliefs, dim);
    const [optId, strength] = Object.entries(p).sort((a, b) => b[1] - a[1])[0];
    if (strength < Math.max(0.4, 1.5 / dim.options.length)) continue;
    const opt = dim.options.find(o => o.id === optId)!;
    out.push({
      dimension: dim.id, category: dim.category, optionId: opt.id, label: opt.label,
      emoji: opt.emoji, tags: opt.tags, strength, importance: dim.importance,
    });
  }
  return out.sort(
    (a, b) =>
      CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] ||
      b.importance - a.importance ||
      b.strength - a.strength,
  );
}

/** Most likely flavor, if the taps pointed anywhere. */
export function inferredVibe(beliefs: Beliefs): Vibe | null {
  const pref = inferPreferences(beliefs).find(p => p.dimension === 'vibe');
  return pref ? (pref.optionId.replace('vibe-', '') as Vibe) : null;
}

// =====================================================
// RESULT
// =====================================================

export interface ThisOrThatMatch extends ScoredRecipe {
  /** Which learned preferences this recipe satisfies (dimension ids). */
  matched: string[];
}

export function rankResults(
  pool: Recipe[],
  beliefs: Beliefs,
  preferences: UserPreferences,
  excludeIds: Set<string>,
  limit = 4,
  opts: {
    /** Points (in fit units) to subtract, e.g. for being recommended recently. */
    penalty?: (r: Recipe) => number;
    random?: () => number;
  } = {},
): ThisOrThatMatch[] {
  const rand = opts.random ?? Math.random;
  const inferred = inferPreferences(beliefs);
  const weightTotal = inferred.reduce((a, p) => a + p.importance, 0);
  const favs = preferences.favoriteTags ?? [];
  const dislikes = preferences.dislikedTags ?? [];

  const scored = pool
    .filter(r => !excludeIds.has(r.id) && passesDietaryFilter(r, preferences))
    .map(r => {
      const profile = profileOf(r);
      const matched = inferred.filter(p => profile[p.dimension] === p.optionId);
      const satisfied = matched.reduce((a, p) => a + p.importance, 0);
      return {
        recipe: r,
        fit: fitScore(beliefs, r, 0.3),
        percent: weightTotal > 0 ? Math.round((satisfied / weightTotal) * 100) : 0,
        matched: matched.map(p => p.dimension),
        taste: favoriteOverlap(r, favs) - dislikeOverlap(r, dislikes),
        // Many dishes tie on fit (same protein, carb and veggies). Without
        // this, ties always went the same way and the same dish kept winning.
        rank: fitScore(beliefs, r, 0.3) + 0.08 * (favoriteOverlap(r, favs) - dislikeOverlap(r, dislikes))
          - (opts.penalty?.(r) ?? 0) + rand() * 0.25,
      };
    })
    .sort((a, b) => b.rank - a.rank);

  return scored.slice(0, limit).map(s => ({
    ...s.recipe,
    matchScore: s.percent,
    isBalanced: isPlateBalanced(s.recipe.plate),
    suggestion: getPlateSuggestion(s.recipe.plate),
    matched: s.matched,
  }));
}
