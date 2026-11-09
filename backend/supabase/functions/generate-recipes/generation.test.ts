// Run: npx deno test backend/supabase/functions/generate-recipes/
import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import {
  GenerationError, OUTPUT_SCHEMA, RequestError, buildUserPrompt, ingredientNames, parseRequest, readRecipes,
} from './generation.ts';

Deno.test('parseRequest cleans and caps the input', () => {
  const r = parseRequest({
    mealType: 'dinner', servings: 40, count: 9,
    ingredients: ['  Chicken  ', 'chicken', 7, '', 'rice\n'],
    note: 'cozy\u0007 night',
    preferences: {
      dietary: ['vegan', 'heart-healthy', 'made-up'], avoidAllergens: ['shellfish', 'gluten', 'bogus'],
      customAllergies: ['kiwi'], allowAlcohol: 'yes', maxCookMinutes: 30,
    },
  });
  assertEquals(r.ingredients, ['Chicken', 'rice']);
  assertEquals(r.servings, 12);
  assertEquals(r.count, 3);
  assertEquals(r.note, 'cozy  night');
  assertEquals(r.preferences.dietRules, ['vegan']);
  assertEquals(r.preferences.eatingGoals, ['heart-healthy']);
  assertEquals(r.preferences.avoidAllergens.sort(), ['gluten', 'mollusc', 'shellfish', 'wheat']);
  assertEquals(r.preferences.allowAlcohol, false);   // only literal true allows it
  assertEquals(r.preferences.maxTotalMinutes, 30);
});

Deno.test('parseRequest rejects a missing meal type', () => {
  assertThrows(() => parseRequest({ ingredients: [] }), RequestError);
  assertThrows(() => parseRequest('nope'), RequestError);
});

Deno.test('the prompt separates restrictions from preferences', () => {
  const p = buildUserPrompt(parseRequest({
    mealType: 'lunch', servings: 1, count: 1, ingredients: ['tofu'],
    preferences: { dietary: ['vegan', 'low-sodium'], avoidAllergens: ['peanuts'], customAvoid: ['mushrooms'] },
  }));
  const [restrictions, preferences] = p.split('PREFERENCES');
  assert(restrictions.includes('Allergies: peanuts'));
  assert(restrictions.includes('Diet rules: vegan'));
  assert(restrictions.includes('Never suggest: mushrooms'));
  assert(restrictions.includes('not allowed'));
  assert(preferences.includes('Eating goals: low-sodium'));
  assert(p.startsWith('Write 1 different lunch recipe for 1 person.'));
});

Deno.test('schema: every object is closed and lists all its fields as required', () => {
  const walk = (s: any): void => {
    if (s?.type === 'object') {
      assertEquals(s.additionalProperties, false);
      assertEquals([...s.required].sort(), Object.keys(s.properties).sort());
      Object.values(s.properties).forEach(walk);
    }
    if (s?.items) walk(s.items);
    s?.anyOf?.forEach(walk);
  };
  walk(OUTPUT_SCHEMA);
});

Deno.test('readRecipes handles refusals, truncation and junk', () => {
  const code = (fn: () => unknown) => {
    try { fn(); } catch (e) { return e instanceof GenerationError ? e.code : 'other'; }
    return 'none';
  };
  assertEquals(code(() => readRecipes('refusal', [])), 'refused');
  assertEquals(code(() => readRecipes('max_tokens', [{ type: 'text', text: '{"recipes":[' }])), 'incomplete');
  assertEquals(code(() => readRecipes('end_turn', [{ type: 'text', text: 'Here you go!' }])), 'malformed');
  assertEquals(code(() => readRecipes('end_turn', [{ type: 'text', text: '{"meals":[]}' }])), 'malformed');
  assertEquals(code(() => readRecipes('end_turn', [])), 'malformed');
});

Deno.test('readRecipes keeps only objects, at most three', () => {
  const text = JSON.stringify({ recipes: [{ name: 'a' }, 'b', null, { name: 'c' }, { name: 'd' }, { name: 'e' }] });
  const out = readRecipes('end_turn', [{ type: 'thinking' }, { type: 'text', text }]);
  assertEquals(out.map(r => r.name), ['a', 'c', 'd']);
});

Deno.test('ingredientNames skips bad lines', () => {
  assertEquals(ingredientNames({ ingredients: [{ name: ' rice ' }, { name: 3 }, null, { quantity: '1' }] }), ['rice']);
  assertEquals(ingredientNames({}), []);
});
