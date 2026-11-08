// tests/drinks.test.ts — the Drinks section is specific and de-duplicated.

import { CURATED_DRINKS } from '../constants/drinks';
import { recipeHasAlcohol } from '../utils/alcohol';
import { DRINK_TYPES, dedupeDrinks, drinkFamily, drinkTypeOf, isCocktail } from '../utils/drinks';
import type { Recipe } from '../types';

const drink = (name: string, over: Partial<Recipe> = {}): Recipe => ({
  ...CURATED_DRINKS[0], id: name.toLowerCase().replace(/\W+/g, '-'), name, tags: ['drink'], ingredients: [], containsAlcohol: undefined, source: 'kaggle', favoriteCount: 0, ...over,
});

describe('curated drinks', () => {
  test('66 drinks, half cocktails, every curated cocktail flagged and no mocktail flagged', () => {
    expect(CURATED_DRINKS).toHaveLength(66);
    const cocktails = CURATED_DRINKS.filter(isCocktail);
    expect(cocktails).toHaveLength(32);
    for (const r of CURATED_DRINKS) {
      expect(recipeHasAlcohol(r)).toBe(isCocktail(r));
    }
  });

  test('every curated drink lands in a named type for its segment', () => {
    for (const r of CURATED_DRINKS) {
      const segment = isCocktail(r) ? 'cocktails' : 'mocktails';
      const ids = DRINK_TYPES[segment].map(t => t.id);
      expect(ids).toContain(drinkTypeOf(r));
    }
  });

  test('types read sensibly', () => {
    const by = Object.fromEntries(CURATED_DRINKS.map(r => [r.id, drinkTypeOf(r)]));
    expect(by['d-margarita']).toBe('tequila');
    expect(by['d-negroni']).toBe('gin');
    expect(by['d-espresso-martini']).toBe('vodka');
    expect(by['d-mojito']).toBe('rum');
    expect(by['d-old-fashioned']).toBe('whiskey');
    expect(by['d-aperol-spritz']).toBe('wine');
    expect(by['d-hot-toddy']).toBe('warm');
    expect(by['d-sangria']).toBe('pitcher');
    expect(by['d-strawberry-banana-smoothie']).toBe('smoothie');
    expect(by['d-cold-brew']).toBe('coffeeTea');
    expect(by['d-lemonade']).toBe('pitcher');          // makes 6
    expect(by['d-mint-lime-sparkler']).toBe('fizz');
    expect(by['d-hot-chocolate']).toBe('warm');
    expect(by['d-orange-carrot-ginger-juice']).toBe('juice');
    expect(by['d-mulled-apple-cider']).toBe('warm');
  });
});

describe('de-duplication', () => {
  test('seven egg nogs become one, cocktail and mocktail versions stay apart', () => {
    const nogs = ['Egg Nog', 'Easy Egg Nog', 'Eggnog', 'Grandma\'s Egg Nog II', 'Classic Eggnog', 'Homemade Egg Nog', 'The Best Egg Nog'].map(n => drink(n));
    const boozy = drink('Spiked Egg Nog', { containsAlcohol: true });
    const out = dedupeDrinks([...nogs, boozy]);
    expect(out.filter(r => !isCocktail(r))).toHaveLength(1);
    expect(out.filter(isCocktail)).toHaveLength(1);
  });

  test('keeps the curated copy over an imported one, then the most saved', () => {
    const a = drink('Banana Smoothie', { favoriteCount: 2 });
    const b = drink('Banana Smoothie II', { favoriteCount: 9 });
    const c = drink('Easy Banana Smoothie', { source: 'bitewise' });
    expect(dedupeDrinks([a, b, c]).map(r => r.id)).toEqual([c.id]);
    expect(dedupeDrinks([a, b]).map(r => r.id)).toEqual([b.id]);
  });

  test('different drinks are not merged', () => {
    expect(drinkFamily('Strawberry Cooler')).not.toBe(drinkFamily('Cranberry Cooler'));
    expect(drinkFamily('Fruit Slush')).not.toBe(drinkFamily('Pineapple Slush'));
    expect(dedupeDrinks([drink('Fresh Lemonade'), drink('Ginger Lemonade')])).toHaveLength(2);
  });
});
