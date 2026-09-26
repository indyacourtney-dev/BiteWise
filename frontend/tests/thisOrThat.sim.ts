// @ts-nocheck — dev script run with `npx tsx`; uses Node APIs the app tsconfig does not include.
import { RECIPES } from '../constants/recipes';
import { QUESTION_BANK } from '../data/quizQuestions';
import { calculateMatchScore, passesDietaryFilter, type UserSelection } from '../utils/matching';
import * as T from '../utils/thisOrThat';
import type { Recipe, UserPreferences } from '../types';
import { readFileSync } from 'fs';

// Photo of each recipe, read from constants/recipeImages.ts (Node can't load the .jpg it requires).
const IMAGE_SRC = readFileSync(new URL('../constants/recipeImages.ts', import.meta.url), 'utf8');
const PHOTO: Record<string, string> = {};
for (const m of IMAGE_SRC.matchAll(/^\s+(r\d+):\s+(IMG\.\w+|'[^']+')/gm)) PHOTO[m[1]] = m[2];
const imageKey = (r: Recipe) => PHOTO[r.id] ?? r.id;

const prefs: UserPreferences = { name: '', dietary: [], avoidAllergens: [], maxCookMinutes: null, preferredDifficulty: null, householdSize: 2,
  favoriteTags: [], dislikedTags: [], spiceTolerance: null, cuisines: [], customAllergies: [], customAvoid: [], customLoves: [] };
const pool = RECIPES.filter(r => passesDietaryFilter(r, prefs));
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// A hidden player: one wanted answer for protein, carb, veggie type and flavor.
function makePlayer() {
  const pick = (dim: string) => { const d = T.DIMENSIONS.find(x => x.id === dim)!; const o = d.options.filter(o => pool.some(r => T.profileOf(r)[dim] === o.id)); return o[Math.floor(rnd() * o.length)].id; };
  const want: Record<string, string> = { 'protein-type': pick('protein-type'), 'carb-type': pick('carb-type'), 'veg-type': pick('veg-type'), vibe: pick('vibe') };
  const weight: Record<string, number> = { 'protein-type': 3, 'carb-type': 3, 'veg-type': 3, vibe: 1.5 };
  const utility = (r: Recipe) => Object.entries(want).reduce((a, [d, o]) => a + (T.profileOf(r)[d] === o ? weight[d] : 0), 0);
  const choose = (a: Recipe, b: Recipe, neither = true): 'left' | 'right' | 'neither' => (rnd() < 0.1 ? (rnd() < 0.5 ? 'left' : 'right') : utility(a) === utility(b) ? (neither && rnd() < .4 ? 'neither' : rnd() < .5 ? 'left' : 'right') : utility(a) > utility(b) ? 'left' : 'right');
  return { want, utility, choose, max: 10.5 };
}

// ---- OLD: 3 random pre-drawn pairs (protein contrast), vote counting, quiz engine
function oldGame(p: ReturnType<typeof makePlayer>) {
  const PQ = QUESTION_BANK.find(q => q.dimension === 'protein-type')!;
  const prot = (r: Recipe) => T.profileOf(r)['protein-type'];
  const sh = [...pool].sort(() => rnd() - 0.5); const pairs: [Recipe, Recipe][] = [];
  while (pairs.length < 3 && sh.length >= 2) { const a = sh.shift()!; const w = sh.slice(0, 40); let bi = 0, bs = 1e9;
    w.forEach((c, i) => { const s = (prot(a) === prot(c) ? 1000 : 0); if (s < bs) { bs = s; bi = i; } }); pairs.push([a, sh.splice(bi, 1)[0]]); }
  const picked: Recipe[] = [], rejected: Recipe[] = [];
  pairs.forEach(([a, b]) => { const c = p.choose(a, b, false); picked.push(c === 'left' ? a : b); rejected.push(c === 'left' ? b : a); });
  const votes = new Map<string, Map<string, number>>();
  picked.forEach((pk, i) => { for (const q of QUESTION_BANK) { const po = T.profileOf(pk)[q.dimension], ro = T.profileOf(rejected[i])[q.dimension];
    if (!po || po === ro) continue; const m = votes.get(q.dimension) ?? new Map(); m.set(po, (m.get(po) ?? 0) + 1); votes.set(q.dimension, m); } });
  const sel: UserSelection[] = [];
  votes.forEach((m, dim) => { const [opt, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; const tags = QUESTION_BANK.find(q => q.dimension === dim)!.options.find(o => o.id === opt)!.tags;
    const w = n * (['protein-type', 'carb-type', 'veg-type'].includes(dim) ? 3 : 1); for (let k = 0; k < w; k++) sel.push({ dimension: dim, tags }); });
  const shown = new Set([...picked, ...rejected].map(r => r.id));
  const top = pool.filter(r => !shown.has(r.id)).map(r => ({ r, s: calculateMatchScore(sel, [...r.tags, r.vibe]) })).sort((a, b) => b.s - a.s)[0].r;
  return { top, rounds: pairs.length };
}

// ---- NEW: adaptive engine
let recentIds = new Set<string>();
function newGame(p: ReturnType<typeof makePlayer>) {
  let b = T.createBeliefs(); const shown = new Set<string>(); let rounds = 0;
  while (!T.shouldStop(b, rounds)) {
    const pair = T.nextPair(pool, b, shown, { round: rounds, random: rnd, imageKey, recentIds }); if (!pair) break;
    pair.forEach(r => shown.add(r.id)); b = T.applyChoice(b, pair[0], pair[1], p.choose(pair[0], pair[1])); rounds++;
  }
  recentIds = shown; // the next player's game avoids these, like the app does
  return { top: T.rankResults(pool, b, prefs, shown, 1)[0], rounds };
}

const N = 400; const acc = { old: { util: 0, prot: 0, perfect: 0, rounds: 0 }, neu: { util: 0, prot: 0, perfect: 0, rounds: 0 } };
for (let i = 0; i < N; i++) {
  const p = makePlayer();
  const bestPossible = Math.max(...pool.map(p.utility));
  for (const [k, g] of [['old', oldGame(p)], ['neu', newGame(p)]] as const) {
    acc[k].util += p.utility(g.top) / bestPossible; acc[k].prot += +(T.profileOf(g.top)['protein-type'] === p.want['protein-type']);
    acc[k].perfect += +(p.utility(g.top) === bestPossible); acc[k].rounds += g.rounds;
  }
}
for (const [k, a] of Object.entries(acc)) console.log(`${k === 'old' ? 'OLD (random pairs)' : 'NEW (adaptive)   '}  fit vs best possible dish: ${(100 * a.util / N).toFixed(0)}%  | right protein: ${(100 * a.prot / N).toFixed(0)}%  | best possible dish: ${(100 * a.perfect / N).toFixed(0)}%  | avg rounds: ${(a.rounds / N).toFixed(1)}`);
