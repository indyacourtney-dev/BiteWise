// constants/recipeImages.ts
//
// PER-RECIPE photo assignment for the This or That picture game and
// anywhere else a recipe needs an image.
//
// WHY A BAKED MAP INSTEAD OF KEYWORD GUESSING
// -------------------------------------------
// v1 matched keywords against recipe TAGS, which caused mismatches like a
// turkey sandwich showing avocado toast (the tag "toasted" matched the
// "toast" keyword). Every photo below was pulled from Unsplash with its
// actual description verified, and every recipe is assigned explicitly by
// its NAME with the dish type taking priority (tacos look like tacos,
// sandwiches like sandwiches, bowls like bowls).
//
// TO FIX ANY SINGLE PHOTO: find the recipe id in RECIPE_IMAGE_MAP below
// (each line has the recipe name in a comment) and swap its IMG.* value —
// or paste a direct image URL string in its place.

import type { Recipe } from '../types';
import type { ImageSourcePropType } from 'react-native';

const U = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=60`;

/** Verified dish-type photo library (Unsplash, free license). */
const IMG = {
  TACO:      U('photo-1565299585323-38d6b0865b47'), // cooked tacos on a plate
  BURGER:    U('photo-1568901346375-23c9450c58cd'), // burger with lettuce & tomato
  SANDWICH:  U('photo-1553909489-cd47e0907980'),    // stacked club sandwich
  WRAP:      U('photo-1529006557810-274b9b2fc783'), // rolled wrap (shawarma style)
  CURRY:     U('photo-1768179669433-bd9d52949c20'), // chicken curry with rice
  CHILI:     U('photo-1547592180-85f173990554'),    // simmering pot of stew/soup
  FRIEDRICE: U('photo-1512058564366-18510be2db19'), // bowl of fried rice
  NOODLES:   U('photo-1516901121982-4ba280115a36'), // veggie noodles with chopsticks
  PASTA:     U('photo-1473093295043-cdd812d0e601'), // pasta with tomatoes & basil
  EGGS:      U('photo-1518476381266-33596bddffc0'), // fried eggs on a skillet
  SALMON:    U('photo-1467003909585-2f8a72700288'), // herbed salmon/fish fillet
  SHRIMP:    U('photo-1680674774705-90b4904b3a7f'), // shrimp with rice & veggies
  SALAD:     U('photo-1512621776951-a57141f2eefd'), // fresh vegetable salad bowl
  STEAK:     U('photo-1504973960431-1c467e159aa4'), // sliced steak, potatoes, greens
  STIRFRY:   U('photo-1707056503922-91c9ebaf0774'), // skillet of meat & vegetables
  RICEBOWL:  U('photo-1546069901-ba9599a7e63c'),    // chicken & veggie rice bowl
  VEGBOWL:   U('photo-1540189549336-e6e99c3679fe'), // roasted veggie/chickpea bowl
  CHICKEN:   U('photo-1504674900247-0877df9cc836'), // plated chicken with vegetables
  FRIEDCHKN: U('photo-1657271511865-f610b280dca4'), // plate of fried chicken
  ENCHILADA: U('photo-1679605097294-ad339b020c0f'), // enchiladas on a plate
  RAMEN:     U('photo-1569718212165-3a8278d5f624'), // bowl of ramen
  // Added for variety (This or That shows up to 14 cards a game). Each
  // description below is Unsplash's own caption for the photo.
  SALMONBROC: U('photo-1675209705883-7aec595f5aa8'), // black plate topped with salmon and broccoli
  FISHVEG:    U('photo-1519708227418-c8fd9a32b7a2'), // grilled fish, cooked vegetables and fork on plate
  FISHASPAR:  U('photo-1560717845-968823efbee1'),    // fish with onions and asparagus
  FISHPLATE:  U('photo-1580959375944-abd7e991f971'), // white plate topped with a piece of fish
  FISHVEG2:   U('photo-1676300185165-3f543c1fcb72'), // white plate topped with fish and vegetables
  TOFUQUINOA: U('photo-1763000215238-38350d3e41ac'), // bowl of quinoa with tofu and avocado
  RICEVEG:    U('photo-1623428188474-b1d532c5e560'), // blue bowl filled with vegetables and rice
  RICEVEG2:   U('photo-1623428187442-b633f414aedc'), // blue bowl filled with rice and vegetables
  DRESSBOWL:  U('photo-1631311695255-8dde6bf96cb5'), // bowl of vegetables and dressing
  BEEFTACO:   U('photo-1599974579688-8dbdd335c77f'), // three beef tacos with chopped onion and cilantro
  VEGTACO:    U('photo-1545093149-618ce3bcf49d'),    // taco with vegetables
  LIMETACO:   U('photo-1648437595587-e6a8b0cdf1f9'), // wooden plate with three tacos and a lime
  FISHTACO:   U('photo-1504544750208-dc0358e63f7f'), // taco with lemon slices
  MEATSPAG:   U('photo-1673442635965-34f1b36d8944'), // plate of spaghetti with meat and tomato sauce
  REDPASTA:   U('photo-1598866594230-a7c12756260f'), // pasta with red sauce on a round plate
  GREENPASTA: U('photo-1627042633145-b780d842ba45'), // pasta with green leaves on a brown plate
  TOMSPAG:    U('photo-1626844131082-256783844137'), // white plate topped with spaghetti and tomatoes
  PASTABOWL:  U('photo-1551892374-ecf8754cf8b0'),    // pasta in a white ceramic bowl
  SPAGBREAD:  U('photo-1692071097529-320eb2b32292'), // plate of spaghetti with sauce and bread
} as const;

/** Explicit photo for every recipe in constants/recipes.ts, keyed by id. */
const RECIPE_IMAGE_MAP: Record<string, string> = {
  r1:    IMG.CHICKEN   , // Grilled Chicken with Brown Rice & Broccoli
  r2:    IMG.TACO      , // Crispy Beef Tacos
  r3:    IMG.FISHVEG       , // Lemon Herb Salmon with Roasted Vegetables
  r4:    IMG.PASTA     , // Creamy Pasta Carbonara
  r5:    IMG.CURRY     , // Spicy Thai Red Curry with Jasmine Rice
  r6:    IMG.SALAD     , // Vibrant Garden Salad Bowl
  r7:    IMG.STEAK     , // Grilled Steak with Roasted Sweet Potato
  r8:    IMG.CHICKEN   , // Sweet & Sour Chicken with Brown Rice
  r9:    IMG.TOFUQUINOA   , // Roasted Veggie & Quinoa Bowl
  r10:   IMG.SALMON    , // Honey Garlic Salmon Rice Bowl
  r11:   IMG.SANDWICH  , // Crispy Chicken Sandwich with Slaw
  r12:   IMG.STIRFRY   , // Beef & Broccoli Stir-Fry
  r13:   IMG.VEGTACO         , // Black Bean & Sweet Potato Tacos
  r14:   IMG.PASTA     , // Garlic Butter Shrimp Pasta
  r15:   IMG.CHILI     , // Slow-Simmered Beef Chili
  r16:   IMG.CHICKEN   , // Baked Lemon Chicken with Potatoes & Green Beans
  r17:   IMG.RICEVEG2     , // Teriyaki Tofu Rice Bowl
  r18:   IMG.FISHTACO        , // Crispy Baked Fish Tacos
  r19:   IMG.TOMSPAG        , // Creamy Tomato Pasta with Spinach
  r20:   IMG.SALAD     , // Honey Mustard Chicken Salad Bowl
  r21:   IMG.DRESSBOWL    , // Mediterranean Chickpea Bowl
  r22:   IMG.STEAK     , // Steak Burrito Bowl
  r41:   IMG.STEAK     , // Chimichurri Grilled Steak with Roasted Potatoes
  r42:   IMG.RICEBOWL  , // Teriyaki Chicken Rice Bowl
  r43:   IMG.SHRIMP    , // Cajun Shrimp Skillet with Rice
  r44:   IMG.CHICKEN   , // Honey Mustard Baked Chicken with Green Beans & Potatoes
  r45:   IMG.RICEBOWL  , // Buffalo Chicken Rice Bowl
  r46:   IMG.NOODLES   , // Peanut Noodles with Crispy Tofu
  r47:   IMG.FISHASPAR     , // Garlic Butter Salmon with Asparagus
  r48:   IMG.RICEBOWL  , // BBQ Pulled Chicken Bowls with Slaw
  r49:   IMG.NOODLES   , // Sesame-Ginger Beef Noodles
  r50:   IMG.SALAD     , // Lemon Herb Grilled Chicken with Quinoa Salad
  r51:   IMG.FISHTACO        , // Chipotle-Lime Shrimp Tacos
  r52:   IMG.CHICKEN   , // Balsamic-Glazed Chicken with Brussels & Sweet Potato
  r53:   IMG.CURRY     , // Coconut Curry Shrimp with Rice
  r54:   IMG.RICEBOWL  , // Greek Chicken Bowls with Tzatziki
  r55:   IMG.SALMON    , // Maple-Chili Glazed Salmon with Brown Rice
  r56:   IMG.PASTABOWL      , // Cajun Chicken Pasta
  r57:   IMG.MEATSPAG       , // Marinara Braised Meatball-Style Beef with Spaghetti
  r58:   IMG.GREENPASTA     , // Pesto Penne with Blistered Tomatoes & Chicken
  r59:   IMG.RICEVEG       , // Teriyaki Salmon Bowl
  r60:   IMG.STEAK     , // Chimichurri Roasted Cauliflower-Rice Steak Bowl
  r61:   IMG.VEGBOWL   , // Buffalo Cauliflower-Rice Chicken Bowl
  r62:   IMG.FISHTACO        , // Garlic-Lime Grilled Fish Tacos
  r63:   IMG.FISHVEG       , // Honey Mustard Salmon with Roasted Carrots
  r64:   IMG.CURRY     , // Coconut Curry Chickpeas with Kale & Rice
  r65:   IMG.SANDWICH  , // BBQ Turkey Sandwiches with Slaw
  r66:   IMG.STIRFRY   , // Sesame-Ginger Tofu Stir-Fry with Rice
  r67:   IMG.FISHPLATE     , // Lemon Herb Baked Cod with Potatoes
  r68:   IMG.VEGBOWL   , // Chipotle-Lime Black Bean Bowls
  r69:   IMG.STEAK     , // Garlic Butter Steak with Mushroom-less Medley
  r70:   IMG.NOODLES   , // Peanut Chicken Lettuce-Free Noodle Bowl
  r71:   IMG.VEGBOWL   , // Greek Lentil Bowls with Tzatziki
  r72:   IMG.RICEVEG2     , // Maple-Chili Roasted Tofu with Brussels & Rice
  r73:   IMG.FISHVEG2      , // Cajun Blackened Fish with Cauliflower Rice
  r74:   IMG.PASTA     , // Balsamic Chicken Pasta Salad
  r75:   IMG.STIRFRY   , // Teriyaki Beef & Broccoli Skillet
  r76:   IMG.CHICKEN   , // Chimichurri Chicken with Sweet Potatoes
  r77:   IMG.SHRIMP    , // Buffalo Shrimp Rice Bowl
  r78:   IMG.DRESSBOWL    , // Lemon Herb Chickpea Quinoa Bowl
  r79:   IMG.SALMONBROC    , // Sesame-Ginger Salmon with Snap Peas
  r80:   IMG.BURGER    , // Honey Mustard Turkey Burgers
  r81:   IMG.REDPASTA       , // Marinara Chickpea Penne
  r82:   IMG.RICEBOWL  , // Chipotle-Lime Chicken Burrito Bowls
  r83:   IMG.SHRIMP    , // Garlic-Lime Shrimp & Cauliflower Rice
  r84:   IMG.SALMON    , // Pesto Salmon with Roasted Medley
  r85:   IMG.VEGBOWL   , // BBQ Black Bean Sweet Potato Bowls
  r86:   IMG.CURRY     , // Coconut Curry Lentils with Spinach & Rice
  r87:   IMG.STIRFRY   , // Cajun Turkey Rice Skillet
  r88:   IMG.WRAP      , // Balsamic Roasted Vegetable & Chickpea Flatbreads
  r89:   IMG.STEAK     , // Greek Grilled Steak Plates with Tzatziki
  r90:   IMG.RICEBOWL  , // Maple-Chili Chicken Sweet Potato Bowls
  r91:   IMG.RICEVEG      , // Peanut Tofu Rice Bowls
  r92:   IMG.EGGS      , // Lemon Herb Egg & Potato Skillet
  r93:   IMG.RICEVEG2     , // Teriyaki Chickpea Broccoli Bowls
  r94:   IMG.FISHPLATE     , // Chimichurri Fish with Quinoa
  r95:   IMG.SANDWICH  , // Buffalo Tofu Sandwiches with Slaw
  r96:   IMG.CHICKEN   , // Garlic Butter Chicken with Green Beans & Rice
  r97:   IMG.LIMETACO        , // Chipotle-Lime Turkey Taco Night
  r98:   IMG.FRIEDRICE , // Sesame-Ginger Egg Fried-Style Rice Skillet
  r99:   IMG.WRAP      , // Honey Mustard Chicken Wraps
  r100:  IMG.FISHVEG2      , // Marinara Baked Fish with Roasted Potatoes
  r101:  IMG.STIRFRY   , // Cajun Black Bean Rice Skillet
  r102:  IMG.SALAD     , // Balsamic Steak Salad Bowl
  r103:  IMG.CURRY     , // Coconut Curry Chicken with Cauliflower Rice
  r104:  IMG.VEGBOWL   , // Garlic-Lime Chicken Quinoa Bowls
  r105:  IMG.EGGS      , // Pesto Eggs with Blistered Tomatoes on Flatbread
  r106:  IMG.SALMON    , // Greek Salmon with Tzatziki & Quinoa
  r107:  IMG.STIRFRY   , // Teriyaki Turkey Rice Skillet
  r108:  IMG.VEGBOWL   , // Chimichurri Black Bean Bowls
  r109:  IMG.WRAP      , // Buffalo Chicken Flatbread Wraps
  r110:  IMG.SHRIMP    , // Garlic Butter Shrimp & Cauliflower Rice Skillet
  r111:  IMG.SALMON    , // Maple-Chili Salmon Bowls with Kale
  r112:  IMG.STIRFRY   , // Cajun Chicken & Sweet Potato Sheet-Pan Plate
  r113:  IMG.NOODLES   , // Peanut Beef Noodle Skillet
  r114:  IMG.TOFUQUINOA   , // Balsamic Tofu with Roasted Medley & Quinoa
  r115:  IMG.SALAD     , // Honey Mustard Steak Salad
  r116:  IMG.REDPASTA       , // Marinara Turkey Penne Skillet
  r117:  IMG.SALAD     , // Sesame-Ginger Chicken Lettuce-Style Salad Bowl
  r118:  IMG.BEEFTACO        , // Chipotle-Lime Steak Tacos
  r119:  IMG.CURRY     , // Coconut Curry Fish with Rice Noodles
  r120:  IMG.VEGTACO         , // Garlic-Lime Black Bean Tacos
  r121:  IMG.VEGBOWL   , // Pesto Chicken Quinoa Bowls
  r122:  IMG.SALMON    , // BBQ Salmon with Roasted Carrots & Rice
  r123:  IMG.STIRFRY   , // Lemon Herb Turkey Meatball-Style Skillet with Green Beans
  r124:  IMG.EGGS      , // Buffalo Egg Breakfast-for-Dinner Skillet
  r125:  IMG.NOODLES   , // Sesame-Ginger Shrimp Noodle Bowl
  r126:  IMG.EGGS      , // Chimichurri Eggs with Charred Asparagus & Potatoes
  r127:  IMG.WRAP      , // Greek Chickpea Flatbreads
  // ---- Community-inspired additions ----
  r128:  IMG.FRIEDCHKN , // Southern Fried Chicken with Collard Greens & Mac
  r129:  IMG.STIRFRY   , // Smothered Chicken & Gravy with Rice and Green Beans
  r130:  IMG.SHRIMP    , // Creamy Shrimp & Grits
  r131:  IMG.STEAK     , // Sunday Pot Roast with Carrots & Potatoes
  r132:  IMG.SPAGBREAD      , // Chicken Parmesan with Spaghetti
  r133:  IMG.FRIEDRICE , // Chicken & Sausage Jambalaya
  r134:  IMG.CHICKEN   , // Turkey Meatloaf with Mashed Potatoes & Green Beans
  r135:  IMG.NOODLES   , // Chicken Pad Thai
  r136:  IMG.RICEBOWL  , // Beef Bulgogi Rice Bowl
  r137:  IMG.RAMEN     , // Miso Chicken Ramen
  r138:  IMG.STIRFRY   , // Thai Basil Chicken with Jasmine Rice
  r139:  IMG.ENCHILADA , // Chicken Enchiladas Verdes
  r140:  IMG.BEEFTACO        , // Carne Asada Street Tacos
  r141:  IMG.RICEBOWL  , // Chicken Fajita Bowls
  r142:  IMG.CHILI     , // Pozole Verde with Chicken
};

const DEFAULT_IMAGE: ImageSourcePropType = require('../assets/images/default-recipe.jpg');

/**
 * Keyword fallback for recipes added AFTER this map was generated.
 * Dish type first (taco/sandwich/pasta...), then protein, so the picture
 * always matches the headline of the dish.
 */
/** Same recipe, same photo: a stable pick from a list of look-alikes. */
function pick(options: string[], key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length];
}

/**
 * Photo for recipes not in the map above (the database's imported and
 * community recipes), from the dish type in the name. Where there are
 * several photos of a dish type, each recipe gets one of them (fixed per
 * recipe), so a list of 20 tacos doesn't show the same picture 20 times.
 */
function guessByName(name: string, key = name): string | null {
  const n = name.toLowerCase();
  const has = (...ws: string[]) => ws.some(w => n.includes(w));
  const hasEgg = /\begg/.test(n);
  if (has('taco')) {
    if (has('fish', 'shrimp', 'cod', 'tilapia', 'mahi')) return IMG.FISHTACO;
    if (has('bean', 'veggie', 'vegan', 'vegetable', 'sweet potato', 'mushroom', 'cauliflower')) return IMG.VEGTACO;
    if (has('beef', 'steak', 'carne', 'barbacoa', 'birria')) return pick([IMG.BEEFTACO, IMG.TACO], key);
    return pick([IMG.TACO, IMG.LIMETACO, IMG.BEEFTACO], key);
  }
  if (has('burger')) return IMG.BURGER;
  if (has('sandwich')) return IMG.SANDWICH;
  if (has('wrap', 'flatbread')) return hasEgg ? IMG.EGGS : IMG.WRAP;
  if (has('fried chicken')) return IMG.FRIEDCHKN;
  if (has('enchilada')) return IMG.ENCHILADA;
  if (has('ramen')) return IMG.RAMEN;
  if (has('pozole', 'gumbo', 'soup', 'stew')) return IMG.CHILI;
  if (has('curry')) return IMG.CURRY;
  if (has('chili') && !has('maple-chili', 'chipotle')) return IMG.CHILI;
  if (has('noodle', 'pad thai', 'lo mein')) return IMG.NOODLES;
  if (has('pasta', 'penne', 'spaghetti', 'carbonara', 'lasagna', 'linguine', 'fettuccine', 'rigatoni', 'ziti', 'macaroni')) {
    if (has('pesto', 'spinach', 'green')) return IMG.GREENPASTA;
    if (has('meatball', 'bolognese', 'meat sauce', 'ragu', 'sausage')) return IMG.MEATSPAG;
    if (has('marinara', 'tomato', 'arrabbiata', 'red sauce')) return pick([IMG.REDPASTA, IMG.TOMSPAG], key);
    return pick([IMG.PASTA, IMG.PASTABOWL, IMG.SPAGBREAD, IMG.TOMSPAG, IMG.REDPASTA], key);
  }
  if (hasEgg || has('omelet')) return IMG.EGGS;
  if (has('shrimp', 'prawn')) return IMG.SHRIMP;
  if (has('salmon', 'fish', 'cod', 'tilapia', 'tuna', 'halibut', 'trout')) {
    if (has('broccoli')) return IMG.SALMONBROC;
    if (has('asparagus')) return IMG.FISHASPAR;
    return pick([IMG.SALMON, IMG.FISHVEG, IMG.FISHPLATE, IMG.FISHVEG2, IMG.SALMONBROC], key);
  }
  if (has('salad', 'slaw')) return pick([IMG.SALAD, IMG.DRESSBOWL], key);
  if (has('steak', 'beef')) return IMG.STEAK;
  if (has('stir-fry', 'stir fry', 'skillet', 'sheet-pan', 'fried rice')) return IMG.STIRFRY;
  if (has('bowl')) {
    if (has('tofu') && has('quinoa')) return IMG.TOFUQUINOA;
    return has('chickpea', 'black bean', 'lentil', 'quinoa', 'veggie', 'tofu', 'cauliflower')
      ? pick([IMG.VEGBOWL, IMG.RICEVEG, IMG.RICEVEG2, IMG.DRESSBOWL, IMG.TOFUQUINOA], key)
      : pick([IMG.RICEBOWL, IMG.RICEVEG], key);
  }
  if (has('tofu', 'chickpea', 'lentil', 'veggie', 'vegan', 'quinoa')) return pick([IMG.VEGBOWL, IMG.TOFUQUINOA, IMG.RICEVEG2], key);
  if (has('chicken', 'turkey')) return IMG.CHICKEN;
  return null;
}

/** Best photo for a recipe. Always returns something renderable. */
export function getRecipeImage(recipe: Recipe): ImageSourcePropType {
  const mapped = RECIPE_IMAGE_MAP[recipe.id] ?? guessByName(recipe.name, recipe.id);
  return mapped ? { uri: mapped } : DEFAULT_IMAGE;
}

/** true = a real photo of that dish type (not the generic placeholder). */
export function hasRecipePhoto(recipe: Pick<Recipe, 'id' | 'name'>): boolean {
  return Boolean(RECIPE_IMAGE_MAP[recipe.id] ?? guessByName(recipe.name, recipe.id));
}

/** Bundled offline-safe fallback for <Image onError>. */
export function getFallbackRecipeImage(): ImageSourcePropType {
  return DEFAULT_IMAGE;
}
