// Run: npx tsx tests/ageSafeguard.test.ts
import { ageOn, isOfDrinkingAge, parseBirthDate } from '../utils/age';
import { libraryItemIsAlcohol, nameMentionsAlcohol, recipeHasAlcohol, textMentionsAlcohol } from '../utils/alcohol';
import { passesDietaryFilter } from '../utils/matching';
import { RECIPES } from '../constants/recipes';
import { SUGGESTION_LIBRARY } from '../constants/pantryData';
import type { Recipe, UserPreferences } from '../types';

let passed = 0;
const eq = (actual: unknown, expected: unknown, what: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  passed++;
};

// ---- Age
eq(ageOn('2005-09-25', '2026-09-25'), 21, 'turns 21 on the birthday');
eq(ageOn('2005-09-26', '2026-09-25'), 20, 'one day short');
eq(isOfDrinkingAge('2005-09-26', '2026-09-25'), false, 'one day short of 21');
eq(isOfDrinkingAge('2005-09-25', '2026-09-25'), true, '21 today');
eq(ageOn('2004-02-29', '2025-02-28'), 20, 'leap-day birthday: not yet on Feb 28');
eq(ageOn('2004-02-29', '2025-03-01'), 21, 'leap-day birthday: counts on Mar 1');
eq(isOfDrinkingAge(null), false, 'unknown birthday fails closed');
eq(isOfDrinkingAge(undefined), false, 'unknown birthday fails closed (undefined)');

// ---- Birthday input
eq(parseBirthDate('3', '4', '2004', '2026-09-25'), { ok: true, iso: '2004-03-04' }, 'valid date');
eq(parseBirthDate('2', '30', '2004', '2026-09-25').ok, false, 'Feb 30 rejected');
eq(parseBirthDate('2', '29', '2003', '2026-09-25').ok, false, 'Feb 29 in a non-leap year rejected');
eq(parseBirthDate('13', '1', '2004', '2026-09-25').ok, false, 'month 13 rejected');
eq(parseBirthDate('1', '1', '2030', '2026-09-25').ok, false, 'future date rejected');
eq(parseBirthDate('1', '1', '04', '2026-09-25').ok, false, '2-digit year rejected');
eq(parseBirthDate('', '1', '2004', '2026-09-25').ok, false, 'empty month rejected');

// ---- Alcohol words
for (const t of ['red wine', 'Dry White Wine', 'beer', 'dark rum', 'bourbon', 'mirin', 'Shaoxing wine', 'cooking sherry', 'vodka', 'gin', 'sake', 'Guinness stout', 'triple sec', 'brandy', 'hard cider', 'Angostura bitters'])
  eq(nameMentionsAlcohol(t), true, `"${t}" is alcohol`);
for (const t of ['red wine vinegar', 'apple cider vinegar', 'rice wine vinegar', 'sherry vinegar', 'ginger ale', 'root beer', 'ginger beer', 'vanilla extract', 'rum extract', 'apple cider', 'ginger', 'drumsticks', 'crumbs', 'kale', 'portobello mushrooms', 'original recipe', 'non-alcoholic beer', 'virgin mojito', 'Beer-Can Chicken'])
  eq(nameMentionsAlcohol(t), false, `"${t}" is not alcohol`);
eq(textMentionsAlcohol('For the sake of time, use leftover rice.'), false, '"for the sake of" in instructions');
eq(textMentionsAlcohol('Deglaze the pan with the wine.'), true, 'wine in instructions');

// ---- Recipes
const base: Recipe = { ...RECIPES[0], id: 't1', name: 'Test', tags: [], ingredients: [{ name: 'chicken breast' }] as any };
eq(recipeHasAlcohol({ ...base, ingredients: [{ name: 'chicken' }, { name: 'white wine' }] as any }), true, 'wine ingredient');
eq(recipeHasAlcohol({ ...base, name: 'Classic Margarita' }), true, 'cocktail name');
eq(recipeHasAlcohol({ ...base, containsAlcohol: true } as any), true, 'database flag wins');
eq(RECIPES.filter(recipeHasAlcohol).map(r => r.name), [], 'no curated recipe is flagged (vinegars are fine)');

// ---- The filter everything goes through
const prefs = (allowAlcohol?: boolean): UserPreferences => ({
  name: '', dietary: [], avoidAllergens: [], maxCookMinutes: null, preferredDifficulty: null, householdSize: 2,
  favoriteTags: [], dislikedTags: [], spiceTolerance: null, cuisines: [], customAllergies: [], customAvoid: [], customLoves: [],
  ...(allowAlcohol === undefined ? {} : { allowAlcohol }),
});
const boozy = { ...base, ingredients: [{ name: 'beef' }, { name: 'red wine' }] as any };
eq(passesDietaryFilter(boozy, prefs(true)), true, '21+ sees alcohol recipes');
eq(passesDietaryFilter(boozy, prefs(false)), false, 'under 21 does not');
eq(passesDietaryFilter(boozy, prefs()), false, 'birthday unknown: hidden');
eq(passesDietaryFilter(base, prefs(false)), true, 'under 21 still sees normal recipes');

// ---- Pantry library
const flagged = SUGGESTION_LIBRARY.filter(libraryItemIsAlcohol).map(i => i.name).sort();
eq(flagged, ['Beer', 'Bourbon', 'Brandy', 'Cooking Sherry', 'Mirin', 'Red Wine', 'Rum', 'Sake', 'Sparkling Wine', 'Vodka', 'White Wine'], 'pantry items hidden from under-21s');

console.log(`ageSafeguard: all ${passed} checks passed`);
