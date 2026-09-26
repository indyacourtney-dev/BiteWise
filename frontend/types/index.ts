
// 'random' was Surprise Me (removed); kept so older saved history still loads.
export type GameMode = 'pantry' | 'weekly' | 'thisorthat' | 'decide' | 'random';

/** Which meal the user is deciding on. A recipe can suit several. */
export type MealType = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'dessert';
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

  /** Meals this recipe suits. Missing = ['dinner'] (see utils/meals.ts getMealTypes). */
  mealTypes?: MealType[];

  // Set on recipes loaded from Supabase (lib/recipesApi.ts). Curated
  // recipes in constants/recipes.ts can leave these out.
  /** Allergens commonly hidden in an ingredient (bread may contain eggs). Treat like `allergens`. */
  mayContain?: Allergen[];
  /** false = an ingredient wasn't recognised, so the allergen list may be incomplete. */
  allergensVerified?: boolean;
  /** Set by the database (recipes.contains_alcohol). Hidden from under-21s. */
  containsAlcohol?: boolean;
  /** true = the source didn't say how many it serves; nutrition is per ~500 kcal portion. */
  servingsEstimated?: boolean;
  source?: 'bitewise' | 'kaggle' | 'community';
  sourceUrl?: string;
  /** How many BiteWise users saved it (Supabase favorites). */
  favoriteCount?: number;
  /** Community (home) recipes: who shared it. */
  authorId?: string;
  authorName?: string;
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
  | 'paleo'        // no grains, legumes, dairy, or refined sugar
  // Added by the recipe database (backend/database/cleaning/dietary.py,
  // which has the exact rules). Allergen-free tags are only given when
  // every ingredient was recognised.
  | 'nut-free' | 'peanut-free' | 'egg-free' | 'fish-free' | 'shellfish-free' | 'mollusc-free'
  | 'wheat-free' | 'soy-free' | 'sesame-free' | 'mustard-free' | 'celery-free' | 'lupin-free'
  | 'sulphite-free' | 'corn-free' | 'coconut-free' | 'nightshade-free' | 'alpha-gal-safe'
  | 'no-red-meat' | 'no-pork' | 'no-processed-meat' | 'alcohol-free' | 'low-fodmap'
  | 'gout-friendly' | 'gerd-friendly'
  | 'diabetic-friendly'      // high blood sugar
  | 'hypoglycemia-friendly'  // low blood sugar
  | 'heart-healthy' | 'low-cholesterol'
  | 'healthy-fats'           // low cholesterol: filling, mostly unsaturated fat
  | 'low-sodium' | 'low-fat' | 'low-calorie' | 'high-fiber' | 'low-sugar';

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
  | 'corn'
  // Added by the recipe database. 'gluten' already covers wheat, so the
  // onboarding "Gluten / wheat" option stays correct.
  | 'wheat'
  | 'mollusc'      // clams, mussels, oysters, scallops, squid
  | 'celery'
  | 'lupin'
  | 'sulphites'
  | 'nightshade'   // tomato, potato, peppers, eggplant
  | 'alpha_gal';   // mammal meat (tick-bite allergy)

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
   * user likes and nudges This or That and Decide for me. Never a hard
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

  // Typed by the user in Profile, for things the lists above don't cover.
  // Matched against recipe names and ingredient names (utils/customFoods.ts).
  /** Allergies not in the allergen list, e.g. "kiwi", "cinnamon". Hard filter. */
  customAllergies: string[];
  /** Foods they never want suggested, e.g. "mushrooms". Hard filter. */
  customAvoid: string[];
  /** Foods they love, e.g. "garlic". Boosts suggestions. */
  customLoves: string[];

  /**
   * Age safeguard: true only when the locked birthday says 21+. Worked out
   * by AppContext from the birthday; never saved or edited directly.
   * Missing = false, so alcohol stays hidden until the age is known.
   */
  allowAlcohol?: boolean;
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
  /** 0 = out (kept so it can go on the grocery list). */
  quantity: number;
  unit: string;
  category: PantryCategoryId;
  icon: string;
  addedAt: number;
  // Added with the grocery list. Optional so pantries saved earlier still load.
  /** When the current stock was bought; freshness counts from here. Defaults to addedAt. */
  stockedAt?: number;
  /** Quantity when last stocked up; "running low" is measured against it. */
  stockedQty?: number;
  /** "Running low" at or below this. Missing = automatic (a quarter of stockedQty). */
  lowAt?: number;
  /** Last change (ms), used to sync between devices. */
  updatedAt?: number;
}

// ============================================
// MEAL PLAN (Plan my week)
// ============================================

export type PlanSlot = 'breakfast' | 'lunch' | 'dinner';

export interface PlannedMeal {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  slot: PlanSlot;
  recipeId: string;
  /** Copied in so the plan shows even before the recipe loads. */
  name: string;
  emoji: string;
  /** Prep + cook minutes, for the plan's day summary. Optional: older plans don't have it. */
  minutes?: number;
  cooked: boolean;
  addedAt: number;
}

// ============================================
// GROCERY LIST
// ============================================

/** Why something is on the list. */
export type GrocerySource = 'manual' | 'low-stock' | 'recipe';

export interface GroceryItem {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  unit: string;
  /** Pantry section it goes into once bought. */
  category: PantryCategoryId;
  /** Store section, for sorting the list the way you walk the store. */
  aisle: string;
  checked: boolean;
  source: GrocerySource;
  /** e.g. the recipe it's for. */
  note?: string;
  addedAt: number;
  updatedAt: number;
}

// ============================================
// SAVED / HISTORY
// ============================================

export interface SavedRecipe {
  recipeId: string;
  savedAt: number;
}

/** App settings (Settings → Accessibility). Saved per account on the device. */
export interface AppSettings {
  /** Text size for reading screens (recipes, chat, Decide for me). 1 = default. */
  textScale: 1 | 1.15 | 1.3 | 1.5;
  /** Heavier text in reading screens. */
  boldText: boolean;
  /** Turn off animations. 'system' follows the phone's Reduce Motion setting. */
  reduceMotion: 'system' | 'on' | 'off';
  /** Small vibrations when you save a favorite or pick a meal. */
  haptics: boolean;
  /** Speed for "Read aloud" on recipes. 1 = normal. */
  speechRate: 0.75 | 1 | 1.25;
}

export interface QuizRun {
  id: string;
  mode: GameMode;
  /** Which meal they were deciding on. Missing on runs saved before meal types existed. */
  mealType?: MealType;
  /** The recipe they locked in, if they chose one ("Let's make this"). */
  chosenRecipeId?: string;
  vibe: Vibe | null;
  tags: string[];
  topRecipeIds: string[];
  completedAt: number;
}