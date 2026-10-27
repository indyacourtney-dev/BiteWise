import type { Ingredient, Recipe } from '../types';

export interface GuidedStep {
  instruction: string;
  cue?: string;
  explanation?: string;
  durationMinutes?: number;
  ingredients?: Ingredient[];
}

export interface GuidedTip {
  title: string;
  detail: string;
}

const PREP_ONLY = /\b(chop|dice|mince|slice|julienne|cut|whisk|measure|rinse|wash|season|mix|grate|peel|crack|pat .* dry|take .* out of (?:the )?fridge)\b/i;
const COOKING_ACTION = /\b(boil|simmer|bake|roast|grill|fry|sear|steam|cook|heat|toast|drain|serve|rest|stir-fry|saute|sauté)\b/i;

function isPrepOnly(instruction: string): boolean {
  return PREP_ONLY.test(instruction) && !COOKING_ACTION.test(instruction);
}

function isLongRunning(instruction: string): boolean {
  if (/\b(?:bring .* to a boil|boil .* water|boil .* pasta|start (?:the )?rice)\b/i.test(instruction)) return true;
  const duration = instruction.match(/\b(\d+)(?:\s*[-–]\s*\d+)?\s*(?:minutes?|mins?)\b/i);
  return !!duration && Number(duration[1]) >= 8 && COOKING_ACTION.test(instruction);
}

function durationOf(instruction: string): number | undefined {
  const match = instruction.match(/\b(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:minutes?|mins?)\b/i);
  if (!match) return undefined;
  return match[2]
    ? Math.round((Number(match[1]) + Number(match[2])) / 2)
    : Number(match[1]);
}

function explanationOf(instruction: string): string | undefined {
  if (/\bpat .+ dry\b/i.test(instruction)) {
    return 'Press the food with a clean paper towel until the surface is no longer wet. Discard the towel and wash your hands. A dry surface browns better.';
  }
  if (/\bsear\b/i.test(instruction)) {
    return 'Brown the food in a hot pan with a little oil. Leave space between pieces so they brown instead of steaming.';
  }
  if (/\bal dente\b/i.test(instruction)) {
    return 'Cook until tender but still slightly firm when you bite it. Taste a piece near the end of the cooking time.';
  }
  if (/\bjulienne\b/i.test(instruction)) {
    return 'Cut the ingredient into thin, even matchstick-sized strips.';
  }
  if (/\btranslucent\b/i.test(instruction)) {
    return 'Cook gently until the ingredient looks soft and slightly see-through, without browning.';
  }
  if (/\bfold in\b/i.test(instruction)) {
    return 'Add the ingredient and gently turn the mixture over it until combined, instead of stirring hard.';
  }
  if (/\bsimmer\b/i.test(instruction)) {
    return 'Keep the liquid just below a full boil, with small gentle bubbles.';
  }
  return undefined;
}

function ingredientVariants(name: string): string[] {
  const parenthetical = [...name.matchAll(/\(([^)]+)\)/g)].flatMap(match => match[1].split(/,|\bor\b|\//i));
  const main = name.replace(/\([^)]*\)/g, ' ');
  const phrases = [main, ...parenthetical].flatMap(part => part.split(/\bor\b|\//i));
  const variants = new Set<string>();
  for (const phrase of phrases) {
    const normalized = phrase.toLowerCase().replace(/\b(fresh|dried|ground|chopped|minced|diced|baby|boneless|skinless)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    variants.add(normalized);
    const words = normalized.split(' ');
    if (words.length > 1) variants.add(words.slice(-1)[0]);
    if (normalized === 'eggs') variants.add('egg');
  }
  return [...variants].sort((a, b) => b.length - a.length);
}

function ingredientAppears(instruction: string, name: string): boolean {
  const text = instruction.toLowerCase();
  return ingredientVariants(name).some(variant => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const lastWord = variant.split(' ').at(-1) ?? variant;
    const plural = /(?:s|x|z|ch|sh|o)$/.test(lastWord) ? '(?:es)?' : 's?';
    return new RegExp(`\\b${escaped}${plural}\\b`, 'i').test(text);
  });
}

function makeGuidedStep(instruction: string, cue?: string): GuidedStep {
  return {
    instruction,
    cue,
    explanation: explanationOf(instruction),
    durationMinutes: durationOf(instruction),
  };
}

function estimatedDuration(instruction: string, ingredients: Ingredient[]): number | undefined {
  if (!/\brice\b/i.test(instruction) || !/\b(start|cook|simmer|boil|steam)\b/i.test(instruction)) return undefined;
  if (/\b(package|box|instant|minute|quick[- ]cook|ready rice)\b/i.test(instruction)) return undefined;
  const rice = ingredients.find(ingredient => /\brice\b/i.test(ingredient.name));
  if (!rice) return undefined;
  if (/\b(instant|minute|quick[- ]cook|ready)\b/i.test(rice.name)) return undefined;
  if (/\b(wild|brown)\b/i.test(rice.name)) return 35;
  if (/\b(jasmine|white|basmati|sushi|short[- ]grain)\b/i.test(rice.name)) return 18;
  return 20;
}

function hasMeasurementInInstruction(instruction: string, ingredient: Ingredient): boolean {
  const units = '(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|cans?|cloves?|slices?|pieces?)';
  const quantity = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)';
  return ingredientVariants(ingredient.name).some(variant => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`\\b${quantity}\\s*(?:${units}\\s+(?:of\\s+)?)?${escaped}\\b`, 'i').test(instruction);
  });
}

function addFirstUseMeasurements(steps: GuidedStep[], ingredients: Ingredient[]): GuidedStep[] {
  const shown = new Set<string>();
  return steps.map(step => {
    const matched = ingredients.filter(ingredient => {
      const key = ingredient.name.trim().toLowerCase();
      if (shown.has(key) || !ingredientAppears(step.instruction, ingredient.name)) return false;
      if (hasMeasurementInInstruction(step.instruction, ingredient)) {
        shown.add(key);
        return false;
      }
      shown.add(key);
      return true;
    });
    return {
      ...step,
      durationMinutes: step.durationMinutes ?? estimatedDuration(step.instruction, ingredients),
      ingredients: matched,
    };
  });
}

export function formatGuidedIngredient(ingredient: Ingredient): string {
  return `${ingredient.amount?.trim() || 'Amount not listed'} ${formatGuidedIngredientName(ingredient)}`;
}

export function formatIngredientsForSpeech(ingredients: Ingredient[]): string[] {
  return ingredients.map(ingredient => {
    const amount = ingredient.amount?.trim();
    const name = ingredient.name.trim();
    if (!amount) return `Amount not listed for ${name}.`;
    const spokenAmount = expandAmountForSpeech(amount);
    const hasUnit = /\b(?:cups?|c\.?|tbsp\.?|tablespoons?|tsp\.?|teaspoons?|lbs?\.?|pounds?|oz\.?|ounces?|grams?|g|kg|ml|liters?|cans?|heads?|cloves?|pieces?|slices?|bunch(?:es)?)\b/i.test(spokenAmount);
    return `Use ${spokenAmount}${hasUnit ? ' of ' : ' '}${name}.`;
  });
}

export function getReadAloudIngredientFields(ingredients: Ingredient[]) {
  return ingredients.map(ingredient => {
    const rawAmount = ingredient.amount?.trim() ?? '';
    const match = rawAmount.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)?\s*(.*)$/);
    return {
      amount: match?.[1]?.trim() || rawAmount,
      unit: match?.[2]?.trim() || null,
      name: ingredient.name,
      rawAmount,
    };
  });
}

export function buildRecipeReadAloudParts(recipe: Pick<Recipe, 'name' | 'ingredients' | 'instructions'>): string[] {
  return [
    recipe.name,
    'Ingredients.',
    ...formatIngredientsForSpeech(recipe.ingredients),
    ...recipe.instructions.map((instruction, index) => `Step ${index + 1}. ${instruction}`),
  ];
}

function expandAmountForSpeech(amount: string): string {
  const fractions: Record<string, string> = {
    '1/2': 'one half',
    '1/3': 'one third',
    '2/3': 'two thirds',
    '1/4': 'one quarter',
    '3/4': 'three quarters',
    '1/8': 'one eighth',
    '3/8': 'three eighths',
  };
  const source = amount.trim().toLowerCase();
  const singularAmount = (/^1(?:\.0+)?(?:\s|$)/.test(source) && !/^1\s+\d+\//.test(source)) || /^1\/(?:2|3|4|8)(?:\s|$)/.test(source);
  const unit = (singular: string, plural: string) => singularAmount ? singular : plural;
  let value = source;
  value = value.replace(/\b(\d+)\s+(1\/2|1\/3|2\/3|1\/4|3\/4|1\/8|3\/8)\b/g, (_, whole: string, fraction: string) =>
    `${whole} and ${fraction === '1/2' ? 'a half' : fractions[fraction]}`
  );
  value = value.replace(/\b(1\/2|1\/3|2\/3|1\/4|3\/4|1\/8|3\/8)\b/g, fraction => fractions[fraction]);
  value = value.replace(/\b(\d+)\.5\b/g, '$1 and a half');
  return value
    .replace(/\b(?:tbsp|tbs)\.?\b/g, unit('tablespoon', 'tablespoons'))
    .replace(/\btsp\.?\b/g, unit('teaspoon', 'teaspoons'))
    .replace(/\blbs?\.?\b/g, unit('pound', 'pounds'))
    .replace(/\boz\.?\b/g, unit('ounce', 'ounces'))
    .replace(/\bc\.?\b/g, unit('cup', 'cups'))
    .replace(/\bfl oz\b/g, 'fluid ounces')
    .replace(/\bg\b/g, 'grams')
    .replace(/\bkg\b/g, 'kilograms')
    .replace(/\bml\b/g, 'milliliters')
    .replace(/\bl\b/g, 'liters')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatGuidedIngredientName(ingredient: Ingredient): string {
  const ingredientAmount = ingredient.amount?.trim() ?? '';
  const amount = Number(ingredientAmount);
  const name = ingredient.name.trim();
  if (!Number.isFinite(amount) || amount <= 1 || /\band\b/i.test(name) || /\s/.test(ingredientAmount)) return name;
  const [firstAlternative, secondAlternative] = name.split(/\bor\b/i);
  if (secondAlternative) return `${firstAlternative.trim()} or ${pluralizeIngredient(secondAlternative.trim())}`;
  return pluralizeIngredient(name);
}

function pluralizeIngredient(name: string): string {
  const lastWord = name.split(/\s+/).at(-1)!;
  if (/s$/i.test(lastWord)) return name;
  if (/(?:x|z|ch|sh|o)$/i.test(lastWord)) return `${name}es`;
  if (/[^aeiou]y$/i.test(lastWord)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

/**
 * Pulls clearly independent prep steps into the first long cooking wait.
 * Cooking steps are never reordered relative to one another.
 */
export function buildGuidedSteps(instructions: string[], recipeIngredients: Ingredient[] = []): GuidedStep[] {
  const prep = instructions.filter(isPrepOnly);
  const remaining = instructions.filter(instruction => !isPrepOnly(instruction));
  const longStepIndex = remaining.findIndex(isLongRunning);
  if (longStepIndex < 0) {
    return addFirstUseMeasurements([
      ...prep.map(instruction => makeGuidedStep(instruction)),
      ...remaining.map(instruction => makeGuidedStep(instruction)),
    ], recipeIngredients);
  }

  const start = remaining[longStepIndex];
  const otherCookingSteps = remaining.filter((_, index) => index !== longStepIndex);
  return addFirstUseMeasurements([
    makeGuidedStep(start, 'Start this longer cooking task first. Prepare ingredients while it runs.'),
    ...prep.map(instruction => makeGuidedStep(instruction, 'Prepare this while the first cooking task is underway.')),
    ...otherCookingSteps.map(instruction => makeGuidedStep(instruction)),
  ], recipeIngredients);
}

export function getGuidedStepTips(
  instruction: string,
  recipeName: string,
  ingredients: Ingredient[] = [],
): GuidedTip[] {
  const text = instruction.toLowerCase();
  if (/\bseason(?:ing|ed)?\b/i.test(instruction)) {
    const listedSeasonings = ingredients.filter(ingredient =>
      /\b(salt|pepper|paprika|cumin|coriander|chili|chilli|oregano|basil|thyme|rosemary|dill|garlic powder|onion powder|seasoning)\b/i.test(ingredient.name)
    );
    const listedText = listedSeasonings.map(formatGuidedIngredient).join(', ');
    const flavorIdeas = /fish|salmon|shrimp|seafood/i.test(recipeName)
      ? 'Try lemon, dill, garlic, or black pepper with fish and seafood.'
      : /taco|mexican|southwest/i.test(recipeName)
        ? 'Try cumin, chili powder, smoked paprika, or oregano for taco-style flavors.'
        : /pasta|italian/i.test(recipeName)
          ? 'Try garlic, basil, oregano, or black pepper for pasta-style flavors.'
          : /curry|indian/i.test(recipeName)
            ? 'Try cumin, coriander, turmeric, or garam masala for curry-style flavors.'
            : /chicken|poultry/i.test(recipeName)
              ? 'Try garlic, paprika, thyme, or black pepper with chicken.'
              : /steak|beef|pork|turkey/i.test(recipeName)
                ? 'Try black pepper, garlic, rosemary, or smoked paprika with this meat.'
                : 'Try garlic, black pepper, paprika, cumin, or a dried herb that you enjoy.';
    return [
      {
        title: 'Season to your taste',
        detail: listedText
          ? `The recipe lists ${listedText}. Use those amounts as a starting point, then adjust to your preference.`
          : 'No exact seasoning amounts are listed for this step. Add a small amount at a time and adjust to your preference.',
      },
      { title: 'Flavor ideas for this recipe', detail: `${flavorIdeas} These are optional; you do not need to use all of them.` },
      { title: 'Taste safely', detail: 'Taste and adjust after the food is cooked. Do not taste raw meat, poultry, seafood, or their marinades.' },
    ];
  }
  const recipeHasSteak = /\bsteak\b/i.test(recipeName) || ingredients.some(ingredient => /\bsteak\b/i.test(ingredient.name));
  const stepMentionsSteak = /\bsteak\b/i.test(instruction) || ingredients.some(ingredient =>
    /\bsteak\b/i.test(ingredient.name) && ingredientAppears(instruction, ingredient.name)
  );
  const stepMentionsAnotherIngredient = ingredients.some(ingredient =>
    !/\bsteak\b/i.test(ingredient.name) && ingredientAppears(instruction, ingredient.name)
  );
  const isSteakCookingStep = stepMentionsSteak || (recipeHasSteak && !stepMentionsAnotherIngredient);
  if (isSteakCookingStep && /\b(sear|grill|cook|doneness)\b/.test(text)) {
    const tips: GuidedTip[] = [];
    if (/medium[- ]rare/.test(instruction)) {
      tips.push({
        title: 'About the cook time',
        detail: 'The time in this instruction is for medium-rare. Well-done takes longer, but there is no dependable extra number of minutes: thickness, pan heat, and starting temperature all change the timing.',
      });
    } else {
      tips.push({
        title: 'Check doneness',
        detail: 'Minutes per side are only a guide. Steak thickness, pan heat, and starting temperature change how long it takes.',
      });
    }
    tips.push({
      title: 'For well-done steak',
      detail: 'Aim for about 160°F (71°C) or higher in the center. Insert an instant-read thermometer sideways into the thickest part. Well-done steak is usually firm with no pink center, but color alone cannot confirm safety.',
    });
    tips.push({
      title: 'Food safety',
      detail: 'USDA guidance for whole beef steaks is at least 145°F (63°C), followed by a 3-minute rest. Wash the thermometer between uses.',
    });
    return tips;
  }
  if (/\brice\b/.test(text) && /\b(cook|simmer|boil)\b/.test(text)) {
    return [
      { title: 'Follow the package directions', detail: 'Check the rice box or package first. Instant, parboiled, and specialty rice can need different water amounts and cooking times; follow those directions over a general estimate.' },
      { title: 'Keep it covered', detail: 'Once the rice reaches a simmer, turn the heat low and keep the lid on so the steam cooks it evenly.' },
      { title: 'Let it rest', detail: 'When the cooking time is up, turn off the heat and leave the lid on for about 5 minutes, then fluff with a fork.' },
    ];
  }
  if (/\b(chicken|poultry)\b/.test(text) && /\b(cook|grill|sear|bake|roast|fry)\b/.test(text)) {
    const tips: GuidedTip[] = [{
      title: 'Check it is cooked',
      detail: 'Cook poultry to 165°F (74°C) at the thickest part. Use a food thermometer and wash it between uses; color alone is not a reliable check.',
    }];
    if (/\bsear\b/.test(text)) {
      tips.push(
        { title: 'Heat the pan', detail: 'Let the pan get hot before adding the chicken. It should sizzle when it touches the pan.' },
        { title: 'Give it space', detail: 'Cook in batches if needed. Crowding traps steam and stops the chicken from browning.' },
      );
    }
    return tips;
  }
  if (/\bpat .+ dry\b/.test(text)) {
    return [{
      title: 'How to do it',
      detail: 'Press a clean paper towel against the food until the surface is no longer wet. Discard it and wash your hands. A dry surface browns better.',
    }];
  }
  if (/\bsear\b/.test(text)) {
    return [
      { title: 'Heat the pan', detail: 'Let the pan get hot before adding the food. The surface should sizzle when the food touches it.' },
      { title: 'Give it space', detail: 'Cook in batches if needed. Crowding traps steam and stops the food from browning.' },
      { title: 'Let it brown', detail: 'Leave the food undisturbed until it releases easily from the pan, then turn it.' },
    ];
  }
  if (/\bal dente\b|\bpasta\b|\bnoodles?\b/.test(text)) {
    return [
      { title: 'Follow the package directions', detail: 'Use the pasta package cooking time as your starting point; brands and shapes can vary. Taste near the end and stop when it is tender with a slight firmness in the center.' },
      { title: 'Before draining', detail: 'If the recipe asks for cooking water, scoop it out before draining. The starchy water can help the sauce cling.' },
    ];
  }
  if (/\b(chop|dice|mince|slice|julienne|cut)\b/.test(text)) {
    return [
      { title: 'Set up safely', detail: 'Use a stable cutting board. Put a damp towel underneath if the board slides, and keep fingertips curled away from the blade.' },
      { title: 'Keep pieces even', detail: 'Try to cut pieces about the same size so they cook at a similar rate.' },
    ];
  }
  if (/\b(simmer|boil)\b/.test(text)) {
    return [
      { title: 'Watch the bubbles', detail: 'A simmer has small, gentle bubbles. If the liquid boils hard, lower the heat.' },
      { title: 'Keep an eye on it', detail: 'Stir as directed and check the pot periodically so liquid does not boil away.' },
    ];
  }
  return [
    { title: 'Before you continue', detail: 'Gather the measured ingredients listed for this step and keep the pan or pot handle turned inward.' },
    { title: 'Use the recipe cues', detail: 'Timing varies with equipment and ingredient size. Follow the texture, color, and temperature cues in the instruction, not time alone.' },
  ];
}