// utils/cuisine.ts
//
// Which cuisines a recipe belongs to, worked out from its name, ingredients
// and tags. The imported recipe database (121k recipes) carries no cuisine
// tags at all, so until now "Cuisines you love" from onboarding changed
// nothing. This gives Decide for me, Plan my week and the result ranking a
// cuisine signal for every recipe, curated or imported.
//
// Deliberately simple: word lists per cuisine, a hit on the NAME counts
// more than a hit on an ingredient, and a recipe needs enough evidence
// before a cuisine is attached (soy sauce alone doesn't make a dish Chinese;
// soy sauce + ginger + sesame does). Ids match CUISINE_OPTIONS in
// constants/preferenceOptions.ts.

import type { Recipe } from '../types';

export type CuisineId =
  | 'american' | 'italian' | 'mexican' | 'chinese' | 'japanese' | 'thai' | 'indian'
  | 'mediterranean' | 'middle-eastern' | 'korean' | 'caribbean' | 'soul';

interface CuisineRule {
  id: CuisineId;
  /** Words in the recipe name that settle it on their own. */
  name: RegExp;
  /** Ingredient / tag words that add evidence (need two, or one + a weak name hit). */
  ingredients: RegExp;
  /** Weaker name words that need one ingredient hit as well. */
  hint?: RegExp;
}

const RULES: CuisineRule[] = [
  {
    id: 'italian',
    name: /\b(italian|lasagn[ae]|risotto|gnocchi|carbonara|bolognese|marinara|alfredo|parmigiana|parmesan|pizza|calzone|focaccia|bruschetta|minestrone|tiramisu|panna cotta|cannoli|pesto|caprese|osso buco|piccata|cacciatore|primavera|fettuccin[ei]|linguine|penne|rigatoni|ravioli|tortellini|ziti|orzo|polenta|ciabatta|antipasto|frittata|panini|biscotti|cannellini|arancini|saltimbocca)\b/i,
    ingredients: /\b(parmesan|parmigiano|pecorino|mozzarella|ricotta|mascarpone|prosciutto|pancetta|basil|oregano|balsamic|spaghetti|penne|marinara|pesto|italian seasoning|italian sausage|gorgonzola|arborio|polenta|cannellini|pine nuts|sun-?dried tomato)/i,
    // Pasta is everyday American cooking too ("Cheeseburger Pasta"): it
    // only counts with an Italian ingredient alongside.
    hint: /\b(pasta|spaghetti|noodles?|macaroni)\b/i,
  },
  {
    id: 'mexican',
    name: /\b(mexican|tacos?|burritos?|enchiladas?|quesadillas?|fajitas?|nachos|tostadas?|tamales?|salsa|guacamole|chilaquiles|carnitas|barbacoa|pozole|elote|churros?|horchata|flautas?|taquitos|mole|al pastor|birria|queso|tex-?mex|chimichangas?|huevos rancheros|pico de gallo|sopes?|empanadas?|margarita)\b/i,
    ingredients: /\b(tortillas?|salsa|jalape[nñ]os?|cilantro|cumin|chipotle|adobo|queso|cotija|poblano|chili powder|taco seasoning|refried beans|black beans|lime|avocado|masa|tomatillos?|chorizo|ancho|serrano|enchilada sauce)/i,
    hint: /\b(chili|chile|bowl|rice bowl)\b/i,
  },
  {
    id: 'chinese',
    name: /\b(chinese|szechuan|sichuan|cantonese|hunan|kung pao|general tso|lo mein|chow mein|chow fun|fried rice|egg rolls?|spring rolls?|wontons?|dumplings?|dim sum|char siu|mapo|hoisin|sweet and sour|orange chicken|sesame chicken|mongolian beef|peking|mu shu|moo shu|egg drop|hot and sour|bao|congee|potstickers?|dan dan|stir-?fry|stir fry)\b/i,
    ingredients: /\b(soy sauce|hoisin|oyster sauce|five-?spice|szechuan|sichuan|shaoxing|rice wine|bok choy|water chestnuts|sesame oil|ginger|scallions?|green onions?|rice vinegar|chili garlic|black bean sauce|wonton|dumpling|bean sprouts|snow peas|chinese)/i,
  },
  {
    id: 'japanese',
    name: /\b(japanese|sushi|ramen|teriyaki|tempura|miso|udon|soba|yakitori|tonkatsu|katsu|donburi|gyoza|okonomiyaki|onigiri|edamame|bento|sashimi|poke|matcha|mochi|yakisoba|karaage|tamagoyaki|shoyu|dashi|nabe|sukiyaki|shabu|takoyaki|hibachi|wasabi)\b/i,
    ingredients: /\b(miso|mirin|dashi|nori|wasabi|sake|panko|teriyaki|ponzu|shiitake|edamame|sushi rice|soba|udon|bonito|togarashi|furikake|japanese|kewpie|tonkatsu sauce|matcha)/i,
    hint: /\b(bowl|rice bowl|noodle)\b/i,
  },
  {
    id: 'thai',
    name: /\b(thai|pad thai|pad see ew|tom yum|tom kha|massaman|panang|satay|larb|som tam|khao|basil chicken|drunken noodles|green curry|red curry|yellow curry|mango sticky rice|thai curry|pad kra pao)\b/i,
    ingredients: /\b(fish sauce|lemongrass|galangal|thai basil|kaffir lime|lime leaves|thai chil(i|e)s?|red curry paste|green curry paste|curry paste|coconut milk|tamarind|palm sugar|rice noodles|peanut sauce|sriracha|thai)/i,
    hint: /\b(curry|noodles?|peanut)\b/i,
  },
  {
    id: 'indian',
    name: /\b(indian|curry|tikka|masala|tandoori|biryani|korma|vindaloo|saag|paneer|dal|daal|dahl|naan|samosas?|pakoras?|chana|aloo|gobi|raita|chutney|kofta|butter chicken|rogan josh|dosa|idli|lassi|kheer|gulab|jalfrezi|bhaji|bhuna|paratha|roti|chapati|pulao|pilau|kulfi|madras|keema)\b/i,
    ingredients: /\b(garam masala|turmeric|cumin|coriander|cardamom|curry powder|curry leaves|fenugreek|ghee|paneer|naan|basmati|tandoori|tikka|garam|chana|lentils?|mustard seeds|asafoetida|chaat|yogurt|cilantro|green chil(i|e)|ginger garlic paste|indian)/i,
  },
  {
    id: 'mediterranean',
    name: /\b(mediterranean|greek|hummus|falafel|tzatziki|gyros?|souvlaki|spanakopita|moussaka|dolmas?|tabbouleh|tabouli|baba ghanoush|pita|baklava|feta|halloumi|orzo|couscous|tagine|shawarma|fattoush|labneh|spanish|paella|gazpacho|tapas|niçoise|nicoise|ratatouille|provençal|provencal|bouillabaisse|tapenade|aioli|romesco|tortilla española|patatas bravas)\b/i,
    ingredients: /\b(feta|kalamata|olives?|olive oil|tahini|chickpeas?|garbanzo|pita|halloumi|tzatziki|hummus|za'?atar|sumac|couscous|bulgur|greek yogurt|oregano|lemon|artichoke|capers?|saffron|manchego|chorizo|pimentón|smoked paprika|harissa|preserved lemon|mediterranean|greek)/i,
    hint: /\b(salad|bowl|grilled|roasted)\b/i,
  },
  {
    id: 'middle-eastern',
    name: /\b(middle eastern|lebanese|turkish|persian|israeli|moroccan|egyptian|syrian|shawarma|shakshuka|kebabs?|kabobs?|kofta|koftas?|kibbeh|fattoush|mujadara|tahdig|hummus|falafel|baklava|labneh|za'?atar|harissa|tagine|muhammara|fatteh|manakish|dukkah|halva|halvah|ful|pilaf|lavash|sumac|baharat|doner|köfte|börek|pide|lahmacun|ghormeh|joojeh|koobideh)\b/i,
    ingredients: /\b(tahini|sumac|za'?atar|pomegranate molasses|rose ?water|baharat|harissa|ras el hanout|preserved lemon|labneh|bulgur|freekeh|dates?|pistachios?|saffron|cardamom|turmeric|chickpeas?|lamb|aleppo|urfa|dried apricots|orange blossom|halloumi|pita|lavash)/i,
    hint: /\b(lamb|chickpea|eggplant|aubergine|yogurt)\b/i,
  },
  {
    id: 'korean',
    name: /\b(korean|kimchi|bulgogi|bibimbap|japchae|tteokbokki|galbi|kalbi|gochujang|kimbap|gimbap|bibim|jjigae|sundubu|samgyeopsal|dakgalbi|jjajang|banchan|doenjang|korean fried|k-?bbq|pajeon|hotteok|bingsu|yangnyeom|kalguksu|naengmyeon|ssam|jeon)\b/i,
    ingredients: /\b(gochujang|gochugaru|kimchi|doenjang|korean chili|sesame oil|sesame seeds|soy sauce|rice vinegar|scallions?|napa cabbage|perilla|korean pear|asian pear|mirin|ginger|garlic|korean)/i,
  },
  {
    id: 'caribbean',
    name: /\b(caribbean|jamaican|jerk|cuban|puerto rican|dominican|haitian|trinidad|bahamian|plantains?|mofongo|ropa vieja|picadillo|tostones|maduros|curry goat|oxtail|callaloo|ackee|festival|bammy|escovitch|pelau|roti|doubles|sofrito|mojo|arroz con pollo|arroz con gandules|pernil|griot|conch|rum cake|coquito|jerk chicken|rice and peas|pastelón|cou-?cou|bake and shark)\b/i,
    ingredients: /\b(plantains?|allspice|pimento|scotch bonnet|habanero|jerk seasoning|coconut milk|thyme|lime|rum|brown sugar|sofrito|adobo|sazón|gandules|pigeon peas|yuca|cassava|callaloo|ackee|saltfish|salt fish|oxtail|goat|mango|tamarind|ginger|nutmeg|caribbean|jamaican|cuban)/i,
    hint: /\b(rice and beans|rice & beans|beans and rice|coconut rice|curry)\b/i,
  },
  {
    id: 'soul',
    name: /\b(southern|soul food|cajun|creole|louisiana|gumbo|jambalaya|étouffée|etouffee|grits|collard greens?|collards|black-?eyed peas|corn ?bread|hush ?puppies|fried chicken|chicken and waffles|chicken & waffles|chicken-?fried|smothered|catfish|po'? ?boys?|biscuits and gravy|biscuits & gravy|red beans and rice|dirty rice|hoppin'? john|sweet potato pie|pecan pie|peach cobbler|banana pudding|pimento cheese|shrimp and grits|shrimp & grits|boudin|muffuletta|beignets?|hoecakes?|chitlins|neckbones?|ham hocks?|okra|succotash|pralines?|buttermilk fried|country fried|bbq|barbecue|pulled pork|brisket|ribs|mac and cheese|mac & cheese|macaroni and cheese|chess pie|hummingbird cake|chow-?chow|tomato pie|chicken fried steak|fried green tomatoes|boiled peanuts|pot likker|low ?country boil)\b/i,
    ingredients: /\b(collard greens?|collards|okra|grits|corn ?meal|buttermilk|black-?eyed peas|ham hocks?|bacon grease|lard|cajun seasoning|creole seasoning|old bay|andouille|sweet potatoes?|pecans?|molasses|hot sauce|smoked turkey|smoked sausage|turnip greens|mustard greens|catfish|crawfish|filé|file powder|liquid smoke|bbq sauce|barbecue sauce|cornbread|pimento cheese|southern|cajun|creole)/i,
    hint: /\b(fried|smothered|slow-?cooked|casserole|cobbler|gravy|biscuits?)\b/i,
  },
  {
    id: 'american',
    name: /\b(american|burgers?|cheeseburgers?|hot ?dogs?|sliders?|meat ?loa(f|ves)|pot roast|mac and cheese|mac & cheese|macaroni and cheese|grilled cheese|club sandwich|blt|cobb salad|caesar salad|clam chowder|chowder|chili|sloppy joes?|tater tots?|buffalo wings|buffalo chicken|wings|philly cheesesteak|cheesesteak|reuben|pancakes?|waffles?|french toast|hash browns|home fries|apple pie|brownies?|chocolate chip cookies?|cookies?|cupcakes?|cheesecake|s'?mores|milkshake|corn dogs?|coleslaw|potato salad|deviled eggs|casserole|tuna melt|patty melt|pigs in a blanket|thanksgiving|stuffing|green bean casserole|pumpkin pie|banana bread|corn ?bread|bbq|barbecue|ranch|loaded|tex-?mex|fries|onion rings|snickerdoodles?|whoopie pies?|monkey bread|cobbler|pot pie|shepherd'?s pie|meatballs?)\b/i,
    ingredients: /\b(cheddar|american cheese|velveeta|ranch|ketchup|mustard|mayonnaise|mayo|pickles?|relish|bacon|ground beef|hamburger|hot dog|cream of mushroom|cream of chicken|cream cheese|cool whip|jell-?o|graham crackers?|marshmallows?|peanut butter|chocolate chips|brown sugar|buttermilk|maple syrup|bbq sauce|barbecue sauce|ritz|bisquick|canned|condensed)/i,
    hint: /\b(baked|roasted|grilled|dip|bake|bars?|cake|pie)\b/i,
  },
];

const cache = new Map<string, CuisineId[]>();

/** Lower-case text of everything we read for a cuisine. */
function textOf(recipe: Pick<Recipe, 'name' | 'ingredients' | 'tags'>) {
  return {
    name: recipe.name.toLowerCase(),
    ings: recipe.ingredients.map(i => i.name.toLowerCase()).join(' | '),
    tags: recipe.tags.map(t => t.toLowerCase()).join(' '),
  };
}

function countMatches(re: RegExp, text: string): number {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = g.exec(text)) !== null) {
    seen.add(m[0].toLowerCase());
    if (m.index === g.lastIndex) g.lastIndex++;
  }
  return seen.size;
}

/**
 * Cuisines this recipe plausibly belongs to (0–3), strongest first. A
 * recipe tagged with a cuisine id already (curated recipes) keeps it.
 */
export function inferCuisines(recipe: Pick<Recipe, 'id' | 'name' | 'ingredients' | 'tags'>): CuisineId[] {
  const cached = cache.get(recipe.id);
  if (cached) return cached;

  const { name, ings, tags } = textOf(recipe);
  const scored: { id: CuisineId; score: number }[] = [];
  for (const rule of RULES) {
    let score = 0;
    if (tags.split(' ').includes(rule.id)) score += 10;          // explicitly tagged
    score += 3 * countMatches(rule.name, name);                  // a defining word in the name
    const ingHits = countMatches(rule.ingredients, ings);
    score += ingHits;                                            // supporting ingredients
    if (rule.hint && rule.hint.test(name) && ingHits > 0) score += 1;
    if (score >= 3) scored.push({ id: rule.id, score });
  }
  // "American" is the broadest list; only keep it when nothing more specific fits.
  const specific = scored.filter(s => s.id !== 'american');
  const picked = (specific.length > 0 ? specific : scored)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.id);
  cache.set(recipe.id, picked);
  return picked;
}

/** For tests. */
export function resetCuisineCache() {
  cache.clear();
}

/** "Middle Eastern" / "middle-eastern" / "Southern / Soul" → the option id. */
export function normalizeCuisine(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.includes('soul') || v.includes('southern')) return 'soul';
  return v.replace(/\s*\/\s*/g, '-').replace(/\s+/g, '-');
}

/** The user's favourite cuisines this recipe matches. */
export function cuisineMatches(recipe: Recipe, favorites: string[]): CuisineId[] {
  if (favorites.length === 0) return [];
  const wanted = new Set(favorites.map(normalizeCuisine));
  return inferCuisines(recipe).filter(c => wanted.has(c));
}

export const CUISINE_LABELS: Record<CuisineId, string> = {
  american: 'American', italian: 'Italian', mexican: 'Mexican', chinese: 'Chinese', japanese: 'Japanese',
  thai: 'Thai', indian: 'Indian', mediterranean: 'Mediterranean', 'middle-eastern': 'Middle Eastern',
  korean: 'Korean', caribbean: 'Caribbean', soul: 'Southern / Soul',
};
