
export type GameMode = 'pantry' | 'weekly';
export type Category = 'protein' | 'carb' | 'greens';
export type Vibe = 'spicy' | 'savory' | 'sweet';

export interface Option {
  id: string;
  label: string;
  emoji: string;
  tags: string[];
}

export interface Question {
  id: string;
  question: string;
  options: Option[];
}

export interface CategoryData {
  name: string;
  questions: Question[];
}

// ============================================
// RECIPES
// ============================================

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface PlateComposition {
  produce: number;
  protein: number;
  carbs: number;
  healthyFats: number;
}

export interface Ingredient {
  name: string;
  amount: string;      // "2 cups", "1 lb"
  category: PantryCategoryId;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  tags: string[];
  vibe: Vibe;
  plate: PlateComposition;

  // Recipe details
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  instructions: string[];

  // Dietary flags — used for filtering
  dietary: DietaryTag[];
  allergens: Allergen[];
}

// Recipe with a computed score attached (results screen only)
export interface ScoredRecipe extends Recipe {
  matchScore: number;
  isBalanced: boolean;
  suggestion?: string;
}

// ============================================
// DIETARY PREFERENCES
// ============================================

export type DietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'gluten-free'
  | 'dairy-free'
  | 'low-carb'
  | 'high-protein';

export type Allergen =
  | 'nuts'
  | 'peanuts'
  | 'shellfish'
  | 'fish'
  | 'eggs'
  | 'dairy'
  | 'soy'
  | 'gluten'
  | 'sesame';

export interface UserPreferences {
  name: string;
  dietary: DietaryTag[];
  avoidAllergens: Allergen[];
  maxCookMinutes: number | null;   // null = no limit
  preferredDifficulty: Difficulty | null;
  householdSize: number;
  /**
   * Recipe tags collected during onboarding ("what do you enjoy?").
   * Used as a soft signal: breaks quiz-result ties toward foods the
   * user likes and weights the Surprise Me randomizer. Never a hard
   * filter — that's what dietary/allergens are for.
   */
  favoriteTags: string[];
}

// ============================================
// PANTRY
// ============================================

export type PantryCategoryId =
  | 'proteins'
  | 'produce'
  | 'dairy'
  | 'grains'
  | 'pantry'
  | 'other';

export interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategoryId;
  icon: string;
  addedAt: number;
}

// ============================================
// SAVED / HISTORY
// ============================================

export interface SavedRecipe {
  recipeId: string;
  savedAt: number;
}

export interface QuizRun {
  id: string;
  mode: GameMode;
  vibe: Vibe | null;
  tags: string[];
  topRecipeIds: string[];
  completedAt: number;
}