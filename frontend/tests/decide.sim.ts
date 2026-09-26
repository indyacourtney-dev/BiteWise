// Run: npx tsx tests/decide.sim.ts
// Someone uses "Decide for me" for dinner every day for 3 weeks. 60% of the
// time they take the first pick, otherwise they skip once and take the next.
// Compares the old ranking (top score + a tiny shuffle) with the variety layer.

import { RECIPES } from '../constants/recipes';
import { rankForDecision, type DecideContext } from '../utils/decide';
import { addExposures, dishFamily, type Exposure } from '../utils/variety';
import { suitsMeal } from '../utils/meals';
import type { QuizRun, UserPreferences } from '../types';

const DAY = 86_400_000;
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
Math.random = rnd; // the old ranking uses Math.random; seed it for a fair comparison

const prefs: UserPreferences = {
  name: 'Sim', dietary: [], avoidAllergens: [], maxCookMinutes: null, preferredDifficulty: null, householdSize: 2,
  favoriteTags: ['chicken', 'rice', 'spicy'], dislikedTags: [], spiceTolerance: 'hot', cuisines: ['Mexican'],
  customAllergies: [], customAvoid: [], customLoves: [], allowAlcohol: true,
};
const pool = RECIPES.filter(r => suitsMeal(r, 'dinner'));

function run(variety: boolean, days = 21, players = 60) {
  let distinct = 0, repeatsWithinWeek = 0, maxSame = 0, sameFamilySkip = 0, skips = 0, pctl = 0, picks = 0;
  for (let p = 0; p < players; p++) {
    let history: QuizRun[] = [];
    let exposure: Exposure[] = [];
    const chosen: string[] = [];
    const start = Date.UTC(2026, 8, 1);
    for (let d = 0; d < days; d++) {
      const now = start + d * DAY + 18 * 3600_000;
      const ctx: DecideContext = { mealType: 'dinner', craving: 'anything', preferences: prefs, pantry: [], favorites: [], history, exposure, now, random: rnd, variety };
      const ranked = rankForDecision(pool, ctx);
      const skip = rnd() >= 0.6;
      const pick = ranked[skip ? 1 : 0];
      if (skip) { skips++; if (dishFamily(ranked[0].recipe) === dishFamily(pick.recipe)) sameFamilySkip++; }
      // Quality: where the pick sits in a plain best-first ranking (no variety, no memory).
      const plain = rankForDecision(pool, { ...ctx, history: [], exposure: [], variety: false }).map(x => x.recipe.id);
      pctl += plain.indexOf(pick.recipe.id) / plain.length; picks++;
      if (chosen.slice(-6).includes(pick.recipe.id)) repeatsWithinWeek++;
      chosen.push(pick.recipe.id);
      history = [{ id: `${d}`, mode: 'decide', mealType: 'dinner', vibe: null, tags: pick.recipe.tags, topRecipeIds: [pick.recipe.id], chosenRecipeId: pick.recipe.id, completedAt: now } as QuizRun, ...history];
      exposure = addExposures(exposure, [
        ...(skip ? [{ id: ranked[0].recipe.id, at: now }] : []),
        { id: pick.recipe.id, at: now, chosen: true },
      ]);
    }
    distinct += new Set(chosen).size;
    const counts = new Map<string, number>(); chosen.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
    maxSame += Math.max(...counts.values());
  }
  return {
    'different dinners in 3 weeks': (distinct / players).toFixed(1) + ' of 21',
    'same dinner again within a week': (100 * repeatsWithinWeek / (players * days)).toFixed(0) + '%',
    'most times one dinner came up': (maxSame / players).toFixed(1),
    'after a skip, same kind of dish': (100 * sameFamilySkip / Math.max(1, skips)).toFixed(0) + '%',
    'picks from your best-matching': 'top ' + (100 * pctl / picks).toFixed(0) + '% on average',
  };
}

console.log('OLD', run(false));
console.log('NEW', run(true));
