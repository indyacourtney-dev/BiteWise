export type ChefTopic = {
  id: string;
  question: string;
  answer: string;
  route?: string;
  action?: string;
  screens?: string[];
};

export const CHEF_TOPICS: ChefTopic[] = [
  { id: 'plan', question: 'How do I plan my week?', answer: 'Open Plan, choose a day and meal slot, then add a recipe. You can also use Fill Empty to get started faster.', route: '/plan', action: 'Open planner', screens: ['plan', 'planWeek'] },
  { id: 'preset', question: 'How do I save or load a preset?', answer: 'In Plan, fill out your week and tap Save Preset. Give it a name. To reuse it, navigate to your target week and tap Load Preset.', route: '/plan', action: 'Open planner', screens: ['plan', 'planWeek'] },
  { id: 'pantry', question: 'How do I use my pantry?', answer: 'Add the ingredients you have to your pantry. BiteWise can use those ingredients to help you find meals you can make.', route: '/pantry', action: 'Open pantry', screens: ['pantry', 'cookWithPantry'] },
  { id: 'favorites', question: 'Where do liked recipes go?', answer: 'Tap the heart on a recipe to add it to your favorites. Tap the heart again to remove it. You can find saved recipes in your Favorites area.', screens: ['thisorthat', 'recipe', 'favorites'] },
  { id: 'thisorthat', question: 'How does This or That work?', answer: 'Pick the dish you would rather eat each round, or choose Neither. BiteWise learns from your choices and suggests a matching recipe. The heart saves a recipe without choosing it.', route: '/thisorthat', action: 'Play This or That', screens: ['thisorthat'] },
  { id: 'suggestions', question: 'How do I get meal suggestions?', answer: 'Try This or That to discover a meal based on your preferences, or Cook With Pantry to find meals using ingredients you already have.', route: '/cookWithPantry', action: 'Cook with pantry', screens: ['decide', 'cookWithPantry'] },
  { id: 'grocery', question: 'How does the grocery list work?', answer: 'Use the grocery list to track ingredients you need for meals. From the planner, you can also look for ingredients missing from your planned recipes.', screens: ['plan', 'grocery'] },
];

export function chefTopicsForScreen(screen: string): ChefTopic[] {
  return [...CHEF_TOPICS].sort((a, b) => Number(!!b.screens?.includes(screen)) - Number(!!a.screens?.includes(screen)));
}
