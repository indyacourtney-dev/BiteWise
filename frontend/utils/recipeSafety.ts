// utils/recipeSafety.ts — is this recipe safe to recommend to this person?
//
// The one gate every recommendation goes through. Every suggestion screen
// calls it via utils/matching.ts passesDietaryFilter, and any NEW recipe
// source (AI-generated, imported, shared) must go through
// screenRecipesForUser() below before anything is shown.
//
// WHAT COUNTS AS WHAT
// -------------------
//   STRICT RESTRICTIONS (safety): the allergies the user picked (plus the
//     ones they imply, e.g. shellfish → molluscs), allergies they typed in,
//     diet RULES (vegetarian, vegan, pescatarian, gluten-free, dairy-free,
//     halal, kosher-style, no red meat) and the age rule for alcohol.
//   STRICT PREFERENCE: "foods to avoid" typed in Profile. Never suggested,
//     but reported as a preference, not a safety problem.
//   SOFT PREFERENCES (never checked here): eating goals (heart-healthy,
//     keto…), foods they enjoy or would rather skip, cuisines, spice,
//     difficulty. Those only change ranking (utils/decide.ts, diets.ts).
//
// THE THREE RESULTS
// -----------------
//   'safe'      nothing conflicts and nothing is unknown.
//   'review'    we can't confirm it's safe: an unrecognised ingredient, a
//               "may contain", a vague ingredient like "broth" for a
//               vegetarian, missing data, or the check itself failed.
//   'rejected'  a confirmed conflict: it contains something they avoid.
// Only 'safe' recipes are recommended. 'review' is never treated as safe.
//
// TWO LAYERS
// ----------
// 1. The recipe's own labels: allergens, mayContain, allergensVerified,
//    dietary tags. For database recipes these come from the ingredient
//    catalog (backend/database/cleaning); curated ones are hand-checked.
// 2. The ingredient names themselves, scanned with the word lists below.
//    Labels can be wrong (a hand-typed recipe, or one written by an AI that
//    simply claims "vegan"), so a recipe tagged vegan that lists honey is
//    rejected even though its tags say otherwise. The lists follow
//    backend/database/cleaning/allergens.py and catalog.py flags.
//
// FAIL CLOSED: validateRecipe never throws. If anything goes wrong while
// checking, the result is 'review', so a broken recipe is never shown as safe.

import { findCustomConflicts, foodWords } from './customFoods';
import { dietRules } from './diets';
import { nameMentionsAlcohol, recipeHasAlcohol } from './alcohol';
import type { Allergen, DietaryTag, Recipe, UserPreferences } from '../types';

export type SafetyStatus = 'safe' | 'review' | 'rejected';

export type SafetyIssueKind =
  | 'age'             // alcohol, and they're under 21 or the age is unknown
  | 'allergen'        // contains something they're allergic to
  | 'may-contain'     // might contain it (hidden source, vague ingredient)
  | 'unverified'      // an ingredient wasn't recognised, so allergens are unknown
  | 'custom-allergy'  // mentions an allergy they typed in
  | 'diet'            // breaks a diet rule, or we can't confirm it fits
  | 'avoid'           // a food they said never to suggest (preference)
  | 'missing-info'    // the recipe is missing data needed to check it
  | 'error';          // the check failed

export interface SafetyIssue {
  kind: SafetyIssueKind;
  /** What this issue alone would make the recipe. */
  status: Exclude<SafetyStatus, 'safe'>;
  /** Plain-language reason, e.g. "Contains dairy (butter)". */
  message: string;
  allergen?: Allergen;
  diet?: DietaryTag;
  /** The ingredient line that caused it, when there is one. */
  ingredient?: string;
}

export interface RecipeValidation {
  status: SafetyStatus;
  /** Every problem found, rejections first. Empty when safe. */
  issues: SafetyIssue[];
  /** The main reason, for one-line display. null when safe. */
  reason: string | null;
}

export type SafetyPrefs = Pick<
  UserPreferences,
  'dietary' | 'avoidAllergens' | 'customAllergies' | 'customAvoid' | 'allowAlcohol'
>;

// ============================================
// ALLERGENS THE USER PICKED, AND WHAT THEY IMPLY
// ============================================

/**
 * The recipe database tags clams, mussels, squid etc. as 'mollusc'
 * separately from 'shellfish', so without this a "Shellfish" allergy let
 * 400+ mollusc recipes through. Wheat is already tagged 'gluten' by the
 * pipeline; it's listed so a hand-entered recipe tagged only 'wheat' is
 * caught too.
 */
const IMPLIED_ALLERGENS: Partial<Record<Allergen, Allergen[]>> = {
  shellfish: ['mollusc'],
  gluten: ['wheat'],
};

export function expandAllergens(avoid: Allergen[] | null | undefined): Allergen[] {
  const list = avoid ?? [];
  const out = new Set<Allergen>(list);
  for (const a of list) IMPLIED_ALLERGENS[a]?.forEach(x => out.add(x));
  return Array.from(out);
}

/**
 * Age safeguard on its own, for screens that show a recipe without the
 * other filters (a shared link, chat, Community, favorites).
 */
export function ageAllowsRecipe(recipe: Recipe, prefs: Pick<UserPreferences, 'allowAlcohol'>): boolean {
  return prefs.allowAlcohol === true || !recipeHasAlcohol(recipe);
}

const ALLERGEN_LABEL: Record<Allergen, string> = {
  nuts: 'tree nuts', peanuts: 'peanuts', shellfish: 'shellfish', fish: 'fish', eggs: 'eggs',
  dairy: 'dairy', soy: 'soy', gluten: 'gluten', sesame: 'sesame', mustard: 'mustard',
  coconut: 'coconut', corn: 'corn', wheat: 'wheat', mollusc: 'molluscs', celery: 'celery',
  lupin: 'lupin', sulphites: 'sulphites', nightshade: 'nightshades', alpha_gal: 'red meat (alpha-gal)',
};
export const allergenLabel = (a: Allergen) => ALLERGEN_LABEL[a] ?? String(a).replace(/_/g, '-');

const DIET_LABEL: Partial<Record<DietaryTag, string>> = {
  vegetarian: 'vegetarian', vegan: 'vegan', pescatarian: 'pescatarian', 'gluten-free': 'gluten-free',
  'dairy-free': 'dairy-free', halal: 'halal', 'kosher-style': 'kosher-style', 'no-red-meat': 'free of red meat',
};
const dietLabel = (d: DietaryTag) => DIET_LABEL[d] ?? d.replace(/-/g, ' ');

// ============================================
// INGREDIENT WORD LISTS
// ============================================
//
// A marker is an allergen id or one of these diet flags (same meaning as
// the flags in backend/database/cleaning/catalog.py):
type Flag = 'mammal' | 'pork' | 'poultry' | 'meat' | 'honey' | 'gelatin' | 'alcohol';
type Marker = Allergen | Flag;

interface Term {
  /** Words to find, matched as whole words, plurals ignored ("anchovies" = "anchovy"). */
  words: string[];
  /** What the ingredient contains. */
  contains?: Marker[];
  /** What it commonly hides: a 'review', not a rejection. */
  may?: Marker[];
  /** Longer phrases where the word means something else ("peanut butter" isn't dairy). */
  unless?: string[];
}

const NUT_BUTTERS = ['peanut butter', 'almond butter', 'cashew butter', 'nut butter', 'sunflower butter',
  'sunflower seed butter', 'seed butter', 'cocoa butter', 'shea butter', 'apple butter', 'pumpkin butter',
  'butter bean', 'butter lettuce', 'butterhead lettuce', 'soy butter', 'vegan butter', 'plant butter'];
const PLANT_MILKS = ['almond milk', 'oat milk', 'soy milk', 'soymilk', 'rice milk', 'coconut milk', 'cashew milk',
  'hemp milk', 'pea milk', 'macadamia milk', 'flax milk', 'plant milk', 'milk thistle'];
const NON_WHEAT_FLOURS = ['rice flour', 'almond flour', 'coconut flour', 'corn flour', 'cornflour', 'chickpea flour',
  'gram flour', 'tapioca flour', 'potato flour', 'cassava flour', 'buckwheat flour', 'sorghum flour',
  'millet flour', 'quinoa flour', 'arrowroot flour', 'banana flour', 'teff flour', 'amaranth flour', 'masa flour',
  'besan flour', 'lupin flour', 'peanut flour', 'hazelnut flour', 'oat flour'];

const TERMS: Term[] = [
  // ---- dairy ----
  { words: ['milk', 'butter', 'buttermilk', 'cream', 'cheese', 'yogurt', 'yoghurt', 'whey', 'casein', 'ghee',
      'kefir', 'paneer', 'ricotta', 'mozzarella', 'parmesan', 'parmigiano', 'cheddar', 'feta', 'brie', 'gouda',
      'mascarpone', 'custard', 'half and half', 'creme fraiche', 'queso', 'alfredo', 'ice cream', 'gelato',
      'condensed milk', 'evaporated milk', 'sour cream', 'cream cheese', 'cottage cheese', 'milk chocolate',
      'goat cheese', 'pecorino', 'gruyere', 'provolone', 'halloumi', 'burrata', 'ranch', 'tzatziki', 'raita',
      'labneh', 'skyr', 'quark'],
    contains: ['dairy'],
    unless: [...NUT_BUTTERS, ...PLANT_MILKS, 'coconut cream', 'cream of tartar', 'coconut yogurt',
      'soy yogurt', 'almond yogurt', 'oat yogurt', 'cashew cream', 'cashew cheese', 'nutritional yeast'] },
  { words: ['margarine', 'oleo', 'chocolate', 'bread', 'brioche', 'naan'], may: ['dairy'],
    unless: ['milk chocolate', 'chocolate milk'] },

  // ---- eggs ----
  { words: ['egg', 'mayonnaise', 'mayo', 'meringue', 'aioli', 'egg noodle', 'egg white', 'egg yolk', 'hollandaise',
      'brioche', 'challah', 'custard', 'eggnog'],
    contains: ['eggs'],
    unless: ['eggplant', 'flax egg', 'chia egg', 'egg replacer', 'egg substitute', 'vegan mayo', 'vegan mayonnaise'] },
  { words: ['pasta', 'noodle', 'bread', 'bun', 'roll', 'cake', 'cookie', 'pancake mix', 'waffle'], may: ['eggs'],
    unless: ['rice noodle', 'glass noodle', 'rice paper', 'cinnamon roll'] },

  // ---- fish / shellfish / molluscs ----
  { words: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'anchovy', 'sardine', 'halibut', 'trout', 'mackerel',
      'haddock', 'snapper', 'mahi mahi', 'swordfish', 'catfish', 'bass', 'herring', 'pollock', 'flounder', 'sole',
      'grouper', 'perch', 'carp', 'eel', 'caviar', 'roe', 'fish sauce', 'worcestershire', 'caesar', 'bonito',
      'dashi', 'lox'],
    contains: ['fish', 'meat'],
    unless: ['fish pepper', 'goldfish', 'swedish fish', 'sole proprietor'] },
  { words: ['shrimp', 'prawn', 'crab', 'crabmeat', 'lobster', 'crawfish', 'crayfish', 'langoustine', 'shrimp paste'],
    contains: ['shellfish', 'meat'], unless: ['crab apple'] },
  { words: ['clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari', 'octopus', 'escargot', 'snail', 'oyster sauce', 'abalone', 'cockle'],
    contains: ['mollusc', 'meat'], unless: ['oyster mushroom', 'oyster cracker', 'scallion'] },
  { words: ['curry paste', 'thai curry paste'], may: ['shellfish', 'fish'] },

  // ---- nuts / peanuts / seeds ----
  { words: ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'brazil nut',
      'chestnut', 'praline', 'marzipan', 'nutella', 'pesto', 'frangipane', 'gianduja', 'nut', 'mixed nut', 'nut butter'],
    contains: ['nuts'], unless: ['water chestnut', 'butternut', 'doughnut', 'donut', 'coconut', 'nutmeg', 'peanut'] },
  { words: ['peanut', 'groundnut', 'satay'], contains: ['peanuts'] },
  { words: ['sesame', 'tahini', 'hummus', 'halva', 'halvah', 'furikake', 'za atar', 'zaatar'], contains: ['sesame'] },

  // ---- grains ----
  { words: ['flour', 'bread', 'breadcrumb', 'panko', 'pasta', 'spaghetti', 'macaroni', 'penne', 'linguine',
      'fettuccine', 'lasagna', 'orzo', 'ravioli', 'tortellini', 'gnocchi', 'noodle', 'ramen', 'udon', 'couscous',
      'bulgur', 'farro', 'semolina', 'seitan', 'wheat', 'spelt', 'cracker', 'biscuit', 'pita', 'naan', 'bagel',
      'croissant', 'crouton', 'baguette', 'brioche', 'challah', 'bun', 'roll', 'pie crust', 'pastry', 'phyllo',
      'filo', 'puff pastry', 'wonton', 'dumpling wrapper', 'flour tortilla', 'cake', 'cookie', 'muffin',
      'pancake', 'waffle', 'cornbread', 'flatbread', 'sourdough', 'graham cracker', 'soy sauce', 'teriyaki',
      'hoisin', 'bisquick', 'stuffing', 'tempura', 'roux'],
    contains: ['gluten', 'wheat'],
    unless: [...NON_WHEAT_FLOURS, 'rice noodle', 'glass noodle', 'cellophane noodle', 'shirataki noodle',
      'kelp noodle', 'zucchini noodle', 'rice paper', 'corn tortilla', 'cinnamon roll', 'egg roll wrapper',
      'buckwheat', 'tamari', 'rice cracker', 'rice cake', 'spring roll', 'cauliflower rice', 'cauliflower crust'] },
  { words: ['barley', 'rye', 'malt', 'beer', 'oat', 'oatmeal', 'triticale', 'pumpernickel', 'malt vinegar'],
    contains: ['gluten'], unless: ['oat milk'] },
  { words: ['oat milk'], may: ['gluten'] },
  { words: ['soba', 'soba noodle'], may: ['gluten', 'wheat'] },

  // ---- soy / mustard / celery / lupin / corn / coconut ----
  { words: ['soy', 'soya', 'soybean', 'tofu', 'tempeh', 'miso', 'edamame', 'tamari', 'teriyaki', 'hoisin',
      'soy sauce', 'soymilk', 'natto', 'tvp', 'textured vegetable protein'], contains: ['soy'] },
  { words: ['mustard', 'dijon', 'mustard seed', 'mustard green'], contains: ['mustard'] },
  { words: ['curry powder'], may: ['mustard', 'celery'] },
  { words: ['celery', 'celeriac', 'celery seed', 'celery salt'], contains: ['celery'] },
  { words: ['broth', 'stock', 'bouillon', 'consomme'], may: ['celery'] },
  { words: ['lupin', 'lupine', 'lupini'], contains: ['lupin'] },
  { words: ['corn', 'maize', 'cornmeal', 'cornstarch', 'cornflour', 'corn flour', 'polenta', 'grits', 'hominy',
      'masa', 'popcorn', 'corn syrup', 'corn tortilla', 'tortilla chip', 'cornbread', 'elote'],
    contains: ['corn'], unless: ['peppercorn', 'corned beef', 'acorn squash'] },
  { words: ['baking powder'], may: ['corn'] },
  { words: ['coconut', 'coconut milk', 'coconut oil', 'coconut cream', 'coconut aminos', 'coconut flour'], contains: ['coconut'] },

  // ---- sulphites / nightshades ----
  { words: ['wine', 'raisin', 'dried apricot', 'balsamic', 'wine vinegar', 'sulfite', 'sulphite', 'dried fruit'], contains: ['sulphites'] },
  { words: ['tomato', 'potato', 'bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'orange pepper',
      'chili', 'chile', 'chilli', 'jalapeno', 'serrano', 'habanero', 'poblano', 'chipotle', 'cayenne', 'paprika',
      'eggplant', 'aubergine', 'tomatillo', 'goji', 'salsa', 'ketchup', 'marinara', 'pimento', 'pimiento',
      'sriracha', 'hot sauce', 'harissa', 'gochujang', 'red pepper flake', 'pepper flake', 'chili powder',
      'banana pepper', 'pepperoncini', 'roasted pepper', 'sweet pepper', 'mini pepper', 'pepper jack'],
    contains: ['nightshade'], unless: ['sweet potato'] },
  { words: ['pepper'], may: ['nightshade'],
    unless: ['black pepper', 'white pepper', 'pink pepper', 'sichuan pepper', 'szechuan pepper', 'lemon pepper',
      'pepper to taste', 'salt and pepper', 'ground pepper', 'cracked pepper', 'pepper corn'] },

  // ---- meat ----
  { words: ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'lard', 'chorizo', 'pepperoni', 'salami',
      'guanciale', 'pork rind', 'chicharron', 'spam', 'speck', 'mortadella', 'capicola', 'andouille', 'bratwurst',
      'kielbasa', 'pork belly', 'baby back rib'],
    contains: ['pork', 'mammal', 'meat', 'alpha_gal'], unless: ['turkey bacon', 'turkey ham', 'turkey pepperoni', 'beef bacon'] },
  { words: ['beef', 'steak', 'veal', 'lamb', 'mutton', 'goat', 'venison', 'bison', 'brisket', 'hamburger', 'oxtail',
      'short rib', 'corned beef', 'pastrami', 'sirloin', 'ribeye', 'tenderloin', 'chuck', 'flank', 'filet mignon',
      'meatloaf', 'bone marrow', 'tallow', 'suet', 'rabbit', 'elk', 'boar', 'roast beef', 'beef broth', 'beef stock'],
    contains: ['mammal', 'meat', 'alpha_gal'], unless: ['goat cheese', 'goat milk', 'pork tenderloin'] },
  { words: ['chicken', 'turkey', 'duck', 'goose', 'quail', 'hen', 'pheasant', 'poultry', 'chicken broth', 'chicken stock'],
    contains: ['poultry', 'meat'] },
  // Meat of unknown kind: certainly not vegetarian, maybe not halal / no-red-meat.
  { words: ['meat', 'sausage', 'meatball', 'hot dog', 'frank', 'frankfurter', 'jerky', 'deli meat', 'lunch meat',
      'cold cut', 'rib', 'gravy', 'drippings', 'demi glace', 'liver', 'giblet', 'bone broth', 'schmaltz'],
    contains: ['meat'], may: ['mammal', 'pork'] },
  { words: ['gelatin', 'gelatine', 'jello', 'jell o', 'marshmallow', 'gummy'], contains: ['gelatin'], may: ['pork', 'mammal'] },
  { words: ['honey'], contains: ['honey'], unless: ['honeydew', 'honeycrisp'] },
  // Broth/stock that doesn't say what it's made of.
  { words: ['broth', 'stock', 'bouillon', 'consomme'], may: ['meat'] },
];

/** Words on a line that say the product is a substitute, so the usual allergen isn't there. */
const QUALIFIERS: { re: RegExp; clears: Marker[] }[] = [
  { re: /\b(vegan|plant[- ]?based)\b/, clears: ['dairy', 'eggs', 'honey', 'gelatin', 'meat', 'mammal', 'pork', 'poultry', 'alpha_gal'] },
  { re: /\b(vegetarian|meatless|meat[- ]?free|veggie|imitation)\b/, clears: ['meat', 'mammal', 'pork', 'poultry', 'alpha_gal', 'gelatin'] },
  { re: /\b(vegetable|mushroom|veg)\s+(broth|stock|bouillon)\b/, clears: ['meat', 'mammal', 'pork', 'poultry', 'alpha_gal'] },
  { re: /\b(dairy[- ]?free|non[- ]?dairy|lactose[- ]?free milk substitute)\b/, clears: ['dairy'] },
  { re: /\b(egg[- ]?free|eggless)\b/, clears: ['eggs'] },
  { re: /\bgluten[- ]?free\b/, clears: ['gluten', 'wheat'] },
  { re: /\b(wheat[- ]?free)\b/, clears: ['wheat'] },
  { re: /\b(nut[- ]?free)\b/, clears: ['nuts'] },
  { re: /\b(soy[- ]?free)\b/, clears: ['soy'] },
  { re: /\b(gelatin[- ]?free|agar)\b/, clears: ['gelatin'] },
  { re: /\b(turkey|chicken|beef)\s+(bacon|ham|pepperoni|sausage|salami)\b/, clears: ['pork'] },
  { re: /\b(chicken|turkey|fish|salmon|shrimp|seafood)\s+(broth|stock|bouillon|sausage|meatball|gravy|hot dog|frank)\b/, clears: ['mammal', 'pork', 'alpha_gal'] },
];

interface LineScan {
  name: string;
  contains: Set<Marker>;
  may: Set<Marker>;
  /** The word that triggered each marker, for messages ("butter"). */
  why: Map<Marker, string>;
}

interface Phrase { words: string[]; term: number }

const UNLESS: string[][][] = TERMS.map(t => (t.unless ?? []).map(w => foodWords(w)).filter(w => w.length > 0));

/** Every phrase, looked up by its first word, so a line is scanned in one pass. */
const BY_FIRST_WORD = new Map<string, Phrase[]>();
TERMS.forEach((t, term) => {
  for (const w of t.words) {
    const words = foodWords(w);
    if (words.length === 0) continue;
    const list = BY_FIRST_WORD.get(words[0]) ?? [];
    list.push({ words, term });
    BY_FIRST_WORD.set(words[0], list);
  }
});

const startsAt = (tokens: string[], i: number, phrase: string[]) =>
  i + phrase.length <= tokens.length && phrase.every((w, j) => tokens[i + j] === w);

/** Is the phrase at tokens[start…] inside one of the term's "unless" phrases ("peanut butter")? */
function excused(tokens: string[], start: number, len: number, unless: string[][]): boolean {
  return unless.some(u => {
    for (let s = Math.max(0, start - u.length + 1); s <= start + len - 1; s++) {
      if (s <= start && s + u.length >= start + len && startsAt(tokens, s, u)) return true;
    }
    return false;
  });
}

export function scanIngredientLine(name: string): LineScan {
  const lower = ` ${name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()} `;
  const tokens = foodWords(lower);
  const cleared = new Set<Marker>();
  for (const q of QUALIFIERS) if (q.re.test(lower)) q.clears.forEach(m => cleared.add(m));

  const scan: LineScan = { name, contains: new Set(), may: new Set(), why: new Map() };
  const add = (set: Set<Marker>, m: Marker, word: string) => {
    if (cleared.has(m)) return;
    set.add(m);
    if (!scan.why.has(m)) scan.why.set(m, word);
  };
  for (let i = 0; i < tokens.length; i++) {
    for (const { words, term } of BY_FIRST_WORD.get(tokens[i]) ?? []) {
      if (!startsAt(tokens, i, words) || excused(tokens, i, words.length, UNLESS[term])) continue;
      const word = words.join(' ');
      TERMS[term].contains?.forEach(m => add(scan.contains, m, word));
      TERMS[term].may?.forEach(m => add(scan.may, m, word));
    }
  }
  // "contains" outranks "may" (chicken broth: definitely poultry, so meat is certain).
  scan.contains.forEach(m => scan.may.delete(m));
  // Alcohol uses the same word list as the age safeguard (utils/alcohol.ts).
  if (nameMentionsAlcohol(name)) {
    scan.contains.add('alcohol');
    scan.why.set('alcohol', 'alcohol');
  }
  return scan;
}

// Scans don't depend on who's asking, so each ingredient list is scanned once.
const scanCache = new WeakMap<object, LineScan[]>();
function scanIngredients(ingredients: Recipe['ingredients']): LineScan[] {
  let scans = scanCache.get(ingredients);
  if (!scans) {
    scans = ingredients.map(i => scanIngredientLine(typeof i?.name === 'string' ? i.name : ''));
    scanCache.set(ingredients, scans);
  }
  return scans;
}

// ============================================
// DIET RULES IN INGREDIENT TERMS
// ============================================
// Same rules as backend/database/cleaning/dietary.py ingredient_tags.

const SEAFOOD: Marker[] = ['fish', 'shellfish', 'mollusc'];
const ALL_MEAT: Marker[] = ['meat', 'mammal', 'pork', 'poultry', ...SEAFOOD, 'gelatin'];

const DIET_FORBIDS: Partial<Record<DietaryTag, Marker[]>> = {
  vegan: [...ALL_MEAT, 'dairy', 'eggs', 'honey'],
  vegetarian: ALL_MEAT,
  pescatarian: ['mammal', 'pork', 'poultry', 'gelatin'],
  'no-red-meat': ['mammal', 'pork'],
  halal: ['pork', 'gelatin', 'alcohol', 'shellfish', 'mollusc'],
  'kosher-style': ['pork', 'gelatin', 'shellfish', 'mollusc'],
  'gluten-free': ['gluten', 'wheat'],
  'dairy-free': ['dairy'],
};

/** Pescatarians eat fish, so meat of unknown kind is only a "maybe" for them. */
const PESCATARIAN_MAYBE: Marker[] = ['meat'];

const MARKER_LABEL: Partial<Record<Marker, string>> = {
  meat: 'meat or fish', mammal: 'red meat', pork: 'pork', poultry: 'poultry', honey: 'honey',
  gelatin: 'gelatin', alcohol: 'alcohol',
};
const markerLabel = (m: Marker) => MARKER_LABEL[m] ?? allergenLabel(m as Allergen);

// ============================================
// VALIDATION
// ============================================

function hasStrictRestrictions(prefs: SafetyPrefs): boolean {
  return (prefs.avoidAllergens ?? []).length > 0
    || (prefs.customAllergies ?? []).length > 0
    || dietRules(prefs).length > 0;
}

function validateUnsafe(recipe: Recipe, prefs: SafetyPrefs): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  const avoid = expandAllergens(prefs.avoidAllergens);
  const customAllergies = prefs.customAllergies ?? [];
  const rules = dietRules(prefs);
  const hasAllergy = avoid.length > 0 || customAllergies.length > 0;
  const strict = hasStrictRestrictions(prefs);

  if (!recipe || typeof recipe !== 'object') {
    return [{ kind: 'missing-info', status: 'review', message: 'Recipe data is missing' }];
  }

  // ---- age ----
  if (!ageAllowsRecipe(recipe, prefs)) {
    issues.push({ kind: 'age', status: 'rejected', message: 'Made with alcohol' });
  }

  // ---- is there enough to check? ----
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : null;
  const ingredientsUsable = !!ingredients && ingredients.length > 0;
  if (strict && !ingredientsUsable) {
    issues.push({ kind: 'missing-info', status: 'review', message: 'No ingredient list, so we can’t check it' });
  }
  if (strict && ingredients?.some(i => !i || typeof i.name !== 'string' || !i.name.trim())) {
    issues.push({ kind: 'missing-info', status: 'review', message: 'An ingredient has no name, so we can’t check it' });
  }
  const listedAllergens = Array.isArray(recipe.allergens) ? recipe.allergens : null;
  const listedMay = Array.isArray(recipe.mayContain) ? recipe.mayContain : [];
  const listedDiet = Array.isArray(recipe.dietary) ? recipe.dietary : null;
  if (hasAllergy && !listedAllergens) {
    issues.push({ kind: 'missing-info', status: 'review', message: 'Allergens aren’t listed for this recipe' });
  }
  if (rules.length > 0 && !listedDiet) {
    issues.push({ kind: 'missing-info', status: 'review', message: 'Diet labels are missing for this recipe' });
  }

  const scans = ingredientsUsable ? scanIngredients(ingredients!) : [];

  const firstLine = (m: Marker, which: 'contains' | 'may') => scans.find(s => s[which].has(m));

  // ---- allergies the user picked ----
  const reported = new Set<Allergen>();
  for (const a of avoid) {
    // Gluten already covers wheat; one line is enough.
    if (a === 'wheat' && reported.has('gluten')) continue;
    if (listedAllergens?.includes(a)) {
      const line = firstLine(a, 'contains') ?? firstLine(a, 'may');
      issues.push({
        kind: 'allergen', status: 'rejected', allergen: a, ingredient: line?.name,
        message: `Contains ${allergenLabel(a)}${line ? ` (${line.name})` : ''}`,
      });
      reported.add(a);
      continue;
    }
    // Not on the label, but an ingredient plainly names it: the label is wrong.
    const line = firstLine(a, 'contains');
    if (line) {
      issues.push({
        kind: 'allergen', status: 'rejected', allergen: a, ingredient: line.name,
        message: `Contains ${allergenLabel(a)} (${line.name})`,
      });
      reported.add(a);
      continue;
    }
    if (listedMay.includes(a)) {
      issues.push({ kind: 'may-contain', status: 'review', allergen: a, message: `May contain ${allergenLabel(a)}` });
      reported.add(a);
      continue;
    }
    const maybe = firstLine(a, 'may');
    if (maybe) {
      issues.push({
        kind: 'may-contain', status: 'review', allergen: a, ingredient: maybe.name,
        message: `May contain ${allergenLabel(a)} (${maybe.name}) — check the label`,
      });
      reported.add(a);
    }
  }
  if (hasAllergy && recipe.allergensVerified === false) {
    issues.push({
      kind: 'unverified', status: 'review',
      message: 'Some ingredients weren’t recognised, so we can’t confirm it’s safe for your allergies',
    });
  }

  // ---- allergies the user typed in ----
  if (customAllergies.length > 0 || (prefs.customAvoid ?? []).length > 0) {
    const conflicts = findCustomConflicts(
      { ...recipe, ingredients: ingredientsUsable ? ingredients!.filter(i => i && typeof i.name === 'string') : [] } as Recipe,
      prefs,
    );
    conflicts.allergies.forEach(a =>
      issues.push({ kind: 'custom-allergy', status: 'rejected', message: `Mentions ${a}, which you’re allergic to` }));
    conflicts.avoid.forEach(a =>
      issues.push({ kind: 'avoid', status: 'rejected', message: `Has ${a}, which you asked us not to suggest` }));
  }

  // ---- diet rules ----
  for (const diet of rules) {
    const forbids = DIET_FORBIDS[diet] ?? [];
    const conflict = forbids.map(m => ({ m, line: firstLine(m, 'contains') })).find(x => x.line);
    if (conflict) {
      issues.push({
        kind: 'diet', status: 'rejected', diet, ingredient: conflict.line!.name,
        message: `Not ${dietLabel(diet)}: has ${markerLabel(conflict.m)} (${conflict.line!.name})`,
      });
      continue;
    }
    // Kosher-style: meat and dairy in one dish.
    if (diet === 'kosher-style') {
      const meat = firstLine('mammal', 'contains') ?? firstLine('poultry', 'contains');
      const dairy = firstLine('dairy', 'contains');
      if (meat && dairy) {
        issues.push({ kind: 'diet', status: 'rejected', diet, message: `Not kosher-style: meat (${meat.name}) with dairy (${dairy.name})` });
        continue;
      }
    }
    if (!listedDiet) continue; // already flagged as missing-info
    if (!listedDiet.includes(diet)) {
      // Without the tag, either it doesn't fit, or (unrecognised ingredient)
      // the database couldn't tell. The second isn't a confirmed conflict.
      issues.push(recipe.allergensVerified === false
        ? { kind: 'diet', status: 'review', diet, message: `Can’t confirm it’s ${dietLabel(diet)}: some ingredients weren’t recognised` }
        : { kind: 'diet', status: 'rejected', diet, message: `Not ${dietLabel(diet)}` });
      continue;
    }
    // Tagged as fitting, but an ingredient is vague ("broth" for a vegetarian).
    const vague = [...forbids, ...(diet === 'pescatarian' ? PESCATARIAN_MAYBE : [])]
      .map(m => ({ m, line: firstLine(m, 'may') })).find(x => x.line);
    if (vague) {
      issues.push({
        kind: 'diet', status: 'review', diet, ingredient: vague.line!.name,
        message: `Check it’s ${dietLabel(diet)}: “${vague.line!.name}” could contain ${markerLabel(vague.m)}`,
      });
    }
  }

  return issues;
}

const ORDER: Record<SafetyIssue['status'], number> = { rejected: 0, review: 1 };

/**
 * Check one recipe against one person's restrictions. Never throws: if the
 * check fails, the recipe comes back as 'review', never 'safe'.
 */
export function validateRecipe(recipe: Recipe, prefs: SafetyPrefs): RecipeValidation {
  let issues: SafetyIssue[];
  try {
    issues = validateUnsafe(recipe, prefs ?? ({} as SafetyPrefs));
  } catch (e) {
    issues = [{ kind: 'error', status: 'review', message: 'We couldn’t check this recipe, so it isn’t suggested' }];
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[BiteWise safety] validation failed', recipe?.id, e);
  }
  issues.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const status: SafetyStatus = issues.length === 0 ? 'safe' : issues[0].status;
  return { status, issues, reason: issues[0]?.message ?? null };
}

/** Only 'safe' recipes can be recommended. */
export function isSafeToRecommend(recipe: Recipe, prefs: SafetyPrefs): boolean {
  return validateRecipe(recipe, prefs).status === 'safe';
}

export interface ScreenedRecipes {
  /** Passed every check: the only ones a screen may suggest. */
  safe: Recipe[];
  /** Couldn't be confirmed safe. Not suggested; kept for logging / review. */
  review: { recipe: Recipe; validation: RecipeValidation }[];
  /** Confirmed conflicts. Never suggested. */
  rejected: { recipe: Recipe; validation: RecipeValidation }[];
}

/**
 * Sort a batch of recipes from any source into safe / review / rejected.
 * Every new recipe source (AI-generated, imported, shared) must go through
 * this before its recipes reach a recommendation list.
 */
export function screenRecipesForUser(recipes: Recipe[], prefs: SafetyPrefs): ScreenedRecipes {
  const out: ScreenedRecipes = { safe: [], review: [], rejected: [] };
  for (const recipe of Array.isArray(recipes) ? recipes : []) {
    const validation = validateRecipe(recipe, prefs);
    if (validation.status === 'safe') out.safe.push(recipe);
    else out[validation.status].push({ recipe, validation });
  }
  return out;
}
