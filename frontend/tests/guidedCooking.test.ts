import { RECIPES } from '../constants/recipes';
import {
  buildGuidedSteps,
  buildRecipeReadAloudParts,
  formatGuidedIngredient,
  formatIngredientsForSpeech,
  getGuidedStepTips,
  getReadAloudIngredientFields,
} from '../utils/guidedCooking';
import { speakSequentially } from '../utils/speechQueue';

describe('Guided cooking steps', () => {
  test('starts a pasta boil first and moves independent prep into the wait', () => {
    const steps = buildGuidedSteps([
      'Boil the pasta in heavily salted water until just shy of al dente.',
      'While it cooks, crisp the chopped bacon in a cold pan brought up to medium heat.',
      'Whisk the eggs and parmesan together with black pepper.',
      'Reserve 1 cup pasta water, then drain the pasta.',
      'Toss the hot pasta into the bacon pan and add the egg mixture off-heat.',
    ]);

    expect(steps.map(step => step.instruction)).toEqual([
      'Boil the pasta in heavily salted water until just shy of al dente.',
      'Whisk the eggs and parmesan together with black pepper.',
      'While it cooks, crisp the chopped bacon in a cold pan brought up to medium heat.',
      'Reserve 1 cup pasta water, then drain the pasta.',
      'Toss the hot pasta into the bacon pan and add the egg mixture off-heat.',
    ]);
    expect(steps[0].cue).toContain('longer cooking task');
    expect(steps[1].cue).toContain('while the first cooking task is underway');
  });

  test('moves prep tasks into a long rice simmer without reordering cooking tasks', () => {
    const steps = buildGuidedSteps([
      'Rinse the brown rice and simmer in water for 25 minutes, covered.',
      'Pat the chicken dry, then season both sides with salt and pepper.',
      'Cut the broccoli into florets.',
      'Heat a grill pan over medium-high with olive oil.',
      'Grill the chicken 6 minutes per side.',
      'Steam the broccoli 5 minutes.',
    ]);

    expect(steps.map(step => step.instruction)).toEqual([
      'Rinse the brown rice and simmer in water for 25 minutes, covered.',
      'Pat the chicken dry, then season both sides with salt and pepper.',
      'Cut the broccoli into florets.',
      'Heat a grill pan over medium-high with olive oil.',
      'Grill the chicken 6 minutes per side.',
      'Steam the broccoli 5 minutes.',
    ]);
    expect(steps[0].durationMinutes).toBe(25);
  });

  test('estimates missing rice times from rice type and preserves explicit times', () => {
    expect(buildGuidedSteps(
      ['Start the rice.'],
      [{ name: 'jasmine rice', amount: '1 cup', category: 'grains' }],
    )[0].durationMinutes).toBe(18);
    expect(buildGuidedSteps(
      ['Start the rice.'],
      [{ name: 'brown rice', amount: '1 cup', category: 'grains' }],
    )[0].durationMinutes).toBe(35);
    expect(buildGuidedSteps(
      ['Cook the rice for 15 minutes.'],
      [{ name: 'jasmine rice', amount: '1 cup', category: 'grains' }],
    )[0].durationMinutes).toBe(15);
    expect(buildGuidedSteps(['Start the rice.'])[0].durationMinutes).toBeUndefined();
  });

  test('prioritizes package directions and does not estimate instant rice timing', () => {
    const instantRice = [{ name: 'instant rice', amount: '1 cup', category: 'grains' as const }];
    expect(buildGuidedSteps(['Start the rice.'], instantRice)[0].durationMinutes).toBeUndefined();
    expect(buildGuidedSteps(['Cook rice according to package directions for 5 minutes.'], instantRice)[0].durationMinutes).toBe(5);

    const tips = getGuidedStepTips('Cook the instant rice according to package directions.', 'Rice Bowl', instantRice);
    expect(tips[0].title).toBe('Follow the package directions');
    expect(tips[0].detail).toContain('follow those directions over a general estimate');
  });

  test('keeps all instructions in their original order when no clear long task exists', () => {
    const instructions = ['Chop the herbs.', 'Mix with lemon juice.', 'Serve immediately.'];
    expect(buildGuidedSteps(instructions).map(step => step.instruction)).toEqual(instructions);
  });

  test('explains patting dry in plain language', () => {
    const [step] = buildGuidedSteps(['Pat the chicken very dry, season, and sear in a hot pan.']);
    expect(step.explanation).toContain('clean paper towel');
  });

  test('egg recipes use egg-safe instructions instead of patting eggs dry', () => {
    const eggRecipes = ['r92', 'r105', 'r124', 'r126'].map(id => RECIPES.find(recipe => recipe.id === id));
    expect(eggRecipes.every(Boolean)).toBe(true);
    for (const recipe of eggRecipes) {
      expect(recipe?.instructions.join(' ').toLowerCase()).not.toContain('pat the eggs');
      expect(recipe?.instructions.join(' ').toLowerCase()).toContain('crack the eggs');
    }
  });

  test('puts produce prep first and shows the recipe measurements used in each step', () => {
    const ingredients = [
      { name: 'eggs', amount: '8', category: 'proteins' as const },
      { name: 'naan or flatbread', amount: '4', category: 'grains' as const },
      { name: 'tomato', amount: '3', category: 'produce' as const },
      { name: 'cucumber', amount: '1', category: 'produce' as const },
      { name: 'red onion', amount: '1/2', category: 'produce' as const },
      { name: 'basil pesto', amount: '3/4 cup', category: 'pantry' as const },
    ];
    const steps = buildGuidedSteps([
      'Warm the naan in a hot dry pan until soft.',
      'Heat a lightly oiled skillet. Add the tomatoes and cook until blistered; move them to a plate.',
      'Crack the eggs into the skillet and cook until the whites are set.',
      'Dice the cucumber and onion, then season lightly with salt.',
      'Spread the pesto over the flatbread and top with the eggs, tomatoes, cucumber, and onion.',
    ], ingredients);

    expect(steps[0].instruction).toContain('Dice the cucumber and onion');
    expect(steps[0].ingredients?.map(formatGuidedIngredient)).toEqual([
      '1 cucumber',
      '1/2 red onion',
    ]);
    expect(steps.find(step => step.instruction.includes('Add the tomatoes'))?.ingredients?.map(formatGuidedIngredient)).toEqual([
      '3 tomatoes',
    ]);
    expect(steps.find(step => step.instruction.includes('Spread the pesto'))?.ingredients?.map(formatGuidedIngredient)).toEqual([
      '3/4 cup basil pesto',
    ]);
  });

  test('does not repeat a measurement already written in the instruction', () => {
    const steps = buildGuidedSteps(
      ['Add 3 tablespoons of olive oil to the pan and heat it.'],
      [{ name: 'olive oil', amount: '3 tbsp', category: 'pantry' }],
    );
    expect(steps[0].ingredients).toEqual([]);
  });

  test('marks a missing source quantity instead of showing a blank measurement', () => {
    expect(formatGuidedIngredient({ name: 'salt', amount: '', category: 'pantry' })).toBe('Amount not listed salt');
  });

  test('Read Aloud ingredient text includes amounts and units without guessing missing amounts', () => {
    expect(formatIngredientsForSpeech([
      { name: 'all-purpose flour', amount: '2 cups', category: 'grains' },
      { name: 'salt', amount: '1/2 tsp', category: 'pantry' },
      { name: 'baby potatoes', amount: '1.5 lbs', category: 'produce' },
      { name: 'eggs', amount: '3', category: 'proteins' },
      { name: 'vanilla extract', amount: '', category: 'pantry' },
    ])).toEqual([
      'Use 2 cups of all-purpose flour.',
      'Use one half teaspoon of salt.',
      'Use 1 and a half pounds of baby potatoes.',
      'Use 3 eggs.',
      'Amount not listed for vanilla extract.',
    ]);
  });

  test('queues actual baby-potato recipe ingredients with their runtime quantities', () => {
    const recipe = RECIPES.find(item => item.id === 'r92');
    expect(recipe).toBeDefined();
    if (!recipe) return;

    const potatoFields = getReadAloudIngredientFields(recipe.ingredients).find(field => field.name === 'baby potatoes');
    const oilFields = getReadAloudIngredientFields(recipe.ingredients).find(field => field.name === 'olive oil');
    expect(potatoFields).toMatchObject({ amount: '1.5', unit: 'lbs', name: 'baby potatoes' });
    expect(oilFields).toMatchObject({ amount: '3', unit: 'tbsp', name: 'olive oil' });

    const parts = buildRecipeReadAloudParts(recipe);
    expect(parts).toContain('Use 1 and a half pounds of baby potatoes.');
    expect(parts).toContain('Use 3 tablespoons of olive oil.');

    const started: { text: string; callbacks: { onDone: () => void; onStopped: () => void; onError: () => void } }[] = [];
    let finished = false;
    speakSequentially(parts, (text, callbacks) => started.push({ text, callbacks }), () => { finished = true; });
    expect(started).toHaveLength(1);
    expect(started[0].text).toBe(recipe.name);
    started[0].callbacks.onDone();
    expect(started).toHaveLength(2);
    expect(started[1].text).toBe('Ingredients.');
    started[1].callbacks.onDone();
    expect(started[2].text).toBe('Use 8 eggs.');
    started[2].callbacks.onDone();
    expect(started[3].text).toBe('Use 1 and a half pounds of baby potatoes.');
    expect(started).toHaveLength(4);
    for (let index = 3; index < parts.length; index++) {
      expect(started).toHaveLength(index + 1);
      expect(started[index].text).toBe(parts[index]);
      started[index].callbacks.onDone();
    }
    expect(started).toHaveLength(parts.length);
    expect(finished).toBe(true);
  });

  test('gives steak searing tips for timing, well-done signs, and safe temperature', () => {
    const tips = getGuidedStepTips(
      'Sear the steak 3–4 minutes per side for medium-rare.',
      'Skillet Steak',
    );
    expect(tips.map(tip => tip.title)).toEqual(['About the cook time', 'For well-done steak', 'Food safety']);
    expect(tips[0].detail).toContain('no dependable extra number of minutes');
    expect(tips[1].detail).toContain('160°F');
    expect(tips[1].detail).toContain('no pink center');
    expect(tips[2].detail).toContain('3-minute rest');
  });

  test('gives rice tips for a rice step inside a steak recipe', () => {
    const tips = getGuidedStepTips(
      'Cook the brown rice covered for 25 minutes.',
      'Steak and Rice Dinner',
      [
        { name: 'steak', amount: '1 lb', category: 'proteins' },
        { name: 'brown rice', amount: '1 cup', category: 'grains' },
      ],
    );
    expect(tips.map(tip => tip.title)).toEqual(['Follow the package directions', 'Keep it covered', 'Let it rest']);
    expect(tips.some(tip => tip.detail.includes('well-done'))).toBe(false);
  });

  test('gives poultry-specific temperature guidance on chicken cooking steps', () => {
    const tips = getGuidedStepTips('Sear the chicken until cooked through.', 'Chicken Bowl');
    expect(tips[0].detail).toContain('165°F');
  });

  test('offers optional seasonings based on the recipe and preserves personal taste', () => {
    const tips = getGuidedStepTips(
      'Season the chicken with salt and pepper.',
      'Garlic Herb Chicken',
      [
        { name: 'salt', amount: '1 tsp', category: 'pantry' },
        { name: 'black pepper', amount: '1/2 tsp', category: 'pantry' },
        { name: 'thyme', amount: '1 tsp', category: 'produce' },
      ],
    );
    expect(tips[0].title).toBe('Season to your taste');
    expect(tips[0].detail).toContain('1 tsp salt');
    expect(tips[1].detail).toContain('thyme');
    expect(tips[1].detail).toContain('optional');
    expect(tips[2].detail).toContain('Do not taste raw meat');
  });
});