
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

/** Per-serving nutrition estimates shown in Plate Balance. */
export interface Nutrition {
  calories: number;
  protein: number;    // g
  carbs: number;      // g
  totalFat: number;   // g
  healthyFat: number; // g — the unsaturated share of totalFat
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
  nutrition: Nutrition;

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
  | 'high-protein'
  // Niche additions. A recipe listing one of these SATISFIES that diet;
  // the filter requires every diet the user selected to be present, so
  // mislabeling a recipe here surfaces it to someone whose diet it
  // violates — annotate conservatively.
  | 'halal'        // no pork or alcohol; shellfish excluded to be safe
  | 'kosher-style' // no pork/shellfish, no meat+dairy in one dish (not certified)
  | 'keto'         // very low carb: no grains, potatoes, beans, or sugars
  | 'paleo';       // no grains, legumes, dairy, or refined sugar

export type Allergen =
  | 'nuts'
  | 'peanuts'
  | 'shellfish'
  | 'fish'
  | 'eggs'
  | 'dairy'
  | 'soy'
  | 'gluten'
  | 'sesame'
  // Niche additions — corn covers cornstarch and corn tortillas.
  | 'mustard'
  | 'coconut'
  | 'corn';

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
  /** Foods the user said they'd rather avoid — soft signal, steers
   *  recommendations away without hard-filtering like allergens do. */
  dislikedTags: string[];
  /** How hot they like it. null = didn't say. */
  spiceTolerance: 'mild' | 'medium' | 'hot' | null;
  /** Cuisines they love (labels, e.g. "Italian"). Soft signal. */
  cuisines: string[];
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