"""
backend/database/cleaning/normalize.py

Turns one raw ingredient line from the dataset into a structured,
standardised ingredient:

    "1 (14.5 oz.) can diced tomatoes, drained"
        -> quantity 1, unit 'can', size 411 g,
           ingredient_id 'tomato', form 'canned', preparation 'diced, drained'

    "2 fresh tomatoes, chopped"   -> ingredient_id 'tomato', form 'fresh', prep 'chopped'
    "juice of 1 lemon"            -> ingredient_id 'lemon_juice', quantity 1

HOW MATCHING WORKS
------------------
1. Pull off the quantity, any package size "(15 oz.)", and the unit.
2. Split off prep notes after the first comma and alternatives after "or".
3. Lower-case, split hyphens, and singularise every word.
4. Look for the LONGEST run of words that is a known alias in the
   catalog. Longest wins, so "chicken broth" beats "chicken" and
   "sour cream" beats "cream". On a tie, the right-most match wins,
   because English puts the head noun last ("chicken tomato soup").
5. Leftover descriptive words become form (fresh, canned, frozen...)
   or preparation (diced, minced...).

If nothing matches, ingredient_id is None and the raw text is kept.
The import script writes those to a report so the catalog can be
extended. Unknown lines also block allergen-free tags (see allergens.py).
"""

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

from .catalog import CATALOG, CATALOG_BY_ID

# =====================================================================
# WORD HELPERS
# =====================================================================

_NO_SINGULAR = {
    'asparagus', 'hummus', 'couscous', 'molasses', 'swiss', 'citrus', 'grits', 'oats', 'bass', 'glass', 'grass',
    'lettuce', 'cheese', 'mayonnaise', 'series', 'watercress', 'swiss', 'hibiscus', 'octopus', 'schnapps',
    'lemongrass', 'molasse', 'jus', 'bitters', 'harissa', 'always', 'gas', 'less', 'plus', 'this', 'its', 'ss',
    'brussels', 'cress', 'tamaris', 'hass', 'haas',
}
_IRREGULAR = {
    'leaves': 'leaf', 'loaves': 'loaf', 'halves': 'half', 'knives': 'knife', 'potatoes': 'potato',
    'tomatoes': 'tomato', 'mangoes': 'mango', 'avocados': 'avocado', 'anchovies': 'anchovy', 'cherries': 'cherry',
    'berries': 'berry', 'radishes': 'radish', 'dishes': 'dish', 'peaches': 'peach', 'sandwiches': 'sandwich',
    'boxes': 'box', 'squashes': 'squash', 'radicchio': 'radicchio', 'chiles': 'chile', 'chilies': 'chili',
    'chillies': 'chili', 'cookies': 'cookie', 'wieners': 'wiener', 'pastries': 'pastry',
}


def singularize(word: str) -> str:
    if word in _IRREGULAR:
        return _IRREGULAR[word]
    if word in _NO_SINGULAR or len(word) <= 3:
        return word
    if word.endswith('ies'):
        return word[:-3] + 'y'
    if word.endswith(('ches', 'shes', 'xes', 'sses', 'zes')):
        return word[:-2]
    if word.endswith('oes'):
        return word[:-2]
    if word.endswith('s') and not word.endswith(('ss', 'us', 'is')):
        return word[:-1]
    return word


_WORD_RE = re.compile(r"[a-z0-9]+(?:'[a-z]+)?")

# Common abbreviations in the dataset ("1 tsp. baking pwdr").
_ABBREVIATIONS = {'pwdr': 'powder', 'pwd': 'powder', 'powd': 'powder', 'choc': 'chocolate', 'bkg': 'baking'}


def strip_accents(text: str) -> str:
    """'jalapeño' -> 'jalapeno', 'sautéed' -> 'sauteed'."""
    return ''.join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))


def tokenize(text: str) -> list:
    text = strip_accents(text).lower().replace('&', ' and ').replace('-', ' ')
    text = text.replace("'s", '').replace("’s", '')
    return [singularize(_ABBREVIATIONS.get(w, w)) for w in _WORD_RE.findall(text)]


# =====================================================================
# ALIAS INDEX
# =====================================================================

MAX_ALIAS_WORDS = 6


def _build_alias_index():
    index, collisions = {}, []
    for ing in CATALOG:
        names = set(ing.aliases) | {ing.name.lower(), ing.id.replace('_', ' ')}
        for alias in names:
            key = ' '.join(tokenize(alias))
            if not key:
                continue
            if key in index and index[key] != ing.id:
                collisions.append((key, index[key], ing.id))
                continue  # first definition wins
            index[key] = ing.id
    return index, collisions


ALIAS_INDEX, ALIAS_COLLISIONS = _build_alias_index()


def match_ingredient(tokens: list):
    """Longest (then right-most) alias match. Returns (ingredient_id, start, end) or (None, -1, -1)."""
    for n in range(min(MAX_ALIAS_WORDS, len(tokens)), 0, -1):
        for start in range(len(tokens) - n, -1, -1):
            key = ' '.join(tokens[start:start + n])
            if key in ALIAS_INDEX:
                return ALIAS_INDEX[key], start, start + n
    return None, -1, -1


# =====================================================================
# QUANTITIES & UNITS
# =====================================================================

_UNICODE_FRACTIONS = {
    '½': ' 1/2', '⅓': ' 1/3', '⅔': ' 2/3', '¼': ' 1/4', '¾': ' 3/4', '⅕': ' 1/5', '⅖': ' 2/5', '⅗': ' 3/5',
    '⅘': ' 4/5', '⅙': ' 1/6', '⅚': ' 5/6', '⅛': ' 1/8', '⅜': ' 3/8', '⅝': ' 5/8', '⅞': ' 7/8', '⁄': '/',
}
_WORD_NUMBERS = {
    'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8,
    'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12, 'dozen': 12, 'half': 0.5, 'couple': 2, 'few': 3,
}

_NUM = r'(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?|\.\d+)'
_QTY_RE = re.compile(rf'^\s*(?:about|approx\.?|approximately|scant|heaping|generous|rounded|level)?\s*'
                     rf'({_NUM})(?:\s*(?:-|to|or)\s*({_NUM}))?\s*')
_WORD_QTY_RE = re.compile(r'^\s*(' + '|'.join(sorted(_WORD_NUMBERS, key=len, reverse=True)) + r')\s+(?:of\s+)?')
_SIZE_RE = re.compile(rf'\(\s*(?:about\s*)?({_NUM})\s*(?:-|to)?\s*({_NUM})?\s*'
                      r'(oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|litre|fl\.?\s*oz|qt|quart|pint|pt)'
                      r'\.?[^)]*\)')

# unit -> (kind, factor). kind: 'g' weight, 'ml' volume, or a count kind.
UNITS = {
    # weight
    'g': ('g', 1), 'gram': ('g', 1), 'grams': ('g', 1), 'gm': ('g', 1), 'kg': ('g', 1000), 'kilogram': ('g', 1000),
    'oz': ('g', 28.35), 'ounce': ('g', 28.35), 'ounces': ('g', 28.35),
    'lb': ('g', 453.6), 'lbs': ('g', 453.6), 'pound': ('g', 453.6), 'pounds': ('g', 453.6), '#': ('g', 453.6),
    # volume
    'ml': ('ml', 1), 'milliliter': ('ml', 1), 'millilitre': ('ml', 1), 'l': ('ml', 1000), 'liter': ('ml', 1000),
    'litre': ('ml', 1000), 'cup': ('ml', 240), 'cups': ('ml', 240), 'c': ('ml', 240),
    'tbsp': ('ml', 15), 'tbs': ('ml', 15), 'tbl': ('ml', 15), 'tbls': ('ml', 15), 'tablespoon': ('ml', 15),
    'tablespoons': ('ml', 15), 'tb': ('ml', 15), 'tsp': ('ml', 5), 'teaspoon': ('ml', 5), 'teaspoons': ('ml', 5),
    'ts': ('ml', 5), 'pint': ('ml', 473), 'pints': ('ml', 473), 'pt': ('ml', 473), 'quart': ('ml', 946),
    'quarts': ('ml', 946), 'qt': ('ml', 946), 'gallon': ('ml', 3785), 'gal': ('ml', 3785),
    'fl oz': ('ml', 29.6), 'fluid ounce': ('ml', 29.6), 'jigger': ('ml', 44), 'shot': ('ml', 44),
    'dash': ('ml', 0.6), 'dashes': ('ml', 0.6), 'pinch': ('ml', 0.3), 'pinches': ('ml', 0.3), 'smidgen': ('ml', 0.2),
    'drop': ('ml', 0.05), 'drops': ('ml', 0.05), 'splash': ('ml', 5),
    # containers (size comes from "(15 oz.)" when present)
    'can': ('container', 425), 'cans': ('container', 425), 'jar': ('container', 450), 'jars': ('container', 450),
    'package': ('container', None), 'packages': ('container', None), 'pkg': ('container', None),
    'pkgs': ('container', None), 'pk': ('container', None), 'box': ('container', None), 'boxes': ('container', None),
    'bag': ('container', None), 'bags': ('container', None), 'carton': ('container', None), 'bottle': ('container', None),
    'container': ('container', None), 'tub': ('container', None), 'envelope': ('container', 28),
    'envelopes': ('container', 28), 'packet': ('container', 28), 'packets': ('container', 28), 'pouch': ('container', None),
    'tube': ('container', None), 'loaf': ('container', 450), 'loaves': ('container', 450),
    # counted things
    'stick': ('stick', None), 'sticks': ('stick', None), 'clove': ('each', 1), 'cloves': ('each', 1),
    'slice': ('slice', None), 'slices': ('slice', None), 'piece': ('each', 1), 'pieces': ('each', 1),
    'whole': ('each', 1), 'large': ('each', 1.25), 'lg': ('each', 1.25), 'medium': ('each', 1), 'med': ('each', 1),
    'small': ('each', 0.7), 'sm': ('each', 0.7), 'head': ('each', 1), 'heads': ('each', 1), 'ear': ('each', 1),
    'ears': ('each', 1), 'stalk': ('each', 1), 'stalks': ('each', 1), 'rib': ('each', 1), 'ribs': ('each', 1),
    'fillet': ('each', 1), 'fillets': ('each', 1), 'bunch': ('bunch', None), 'bunches': ('bunch', None),
    'sprig': ('sprig', None), 'sprigs': ('sprig', None), 'handful': ('ml', 30), 'handfuls': ('ml', 30),
    'strip': ('slice', None), 'strips': ('slice', None), 'link': ('each', 1), 'links': ('each', 1),
    'square': ('each', 1), 'squares': ('each', 1), 'leaf': ('sprig', None), 'leaves': ('sprig', None),
    'bulb': ('each', 1),
}
# longest first so "fl oz" beats "fl", "tablespoons" beats "tablespoon"
_UNIT_RE = re.compile(r'^\s*(' + '|'.join(re.escape(u) for u in sorted(UNITS, key=len, reverse=True)) + r')\.?(?=\s|$|,)',
                      re.IGNORECASE)

SPICE_UNITS = {'tsp', 'teaspoon', 'teaspoons', 'ts', 'tbsp', 'tbs', 'tbl', 'tbls', 'tablespoon', 'tablespoons', 'tb',
               'dash', 'dashes', 'pinch', 'pinches', 'smidgen'}

# =====================================================================
# DESCRIPTORS
# =====================================================================

FORM_WORDS = {
    'fresh': 'fresh', 'freshly': 'fresh', 'frozen': 'frozen', 'thawed': 'frozen', 'canned': 'canned', 'can': 'canned',
    'tinned': 'canned', 'jarred': 'jarred', 'dried': 'dried', 'dry': 'dried', 'dehydrated': 'dried', 'cooked': 'cooked',
    'leftover': 'cooked', 'raw': 'raw', 'uncooked': 'raw', 'smoked': 'smoked', 'roasted': 'roasted',
    'toasted': 'toasted', 'instant': 'instant', 'condensed': 'condensed', 'low': 'reduced', 'reduced': 'reduced',
    'lite': 'reduced', 'light': 'reduced', 'nonfat': 'reduced', 'lowfat': 'reduced', 'unsalted': 'unsalted',
    'unsweetened': 'unsweetened', 'sweetened': 'sweetened', 'boneless': 'boneless', 'skinless': 'skinless',
    'organic': 'organic', 'lean': 'lean', 'extra': None, 'ripe': 'ripe', 'bottled': 'bottled', 'homemade': 'homemade',
}
PREP_WORDS = {
    'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'crushed', 'cubed', 'julienned', 'peeled',
    'seeded', 'halved', 'quartered', 'mashed', 'melted', 'softened', 'beaten', 'drained', 'rinsed', 'divided',
    'packed', 'sifted', 'trimmed', 'deveined', 'zested', 'juiced', 'torn', 'crumbled', 'cut', 'split', 'pitted',
    'cored', 'stemmed', 'shelled', 'separated', 'whipped', 'scalded', 'cubed', 'ground', 'pureed', 'puree',
    'blanched', 'steamed', 'boiled', 'hard', 'boiled', 'room', 'temperature', 'chilled', 'warm', 'cold', 'hot',
    'finely', 'coarsely', 'thinly', 'roughly', 'lightly', 'firmly', 'loosely', 'well',
}
OPTIONAL_RE = re.compile(r'\b(optional|to taste|for garnish|for serving|for topping|to serve|if desired|as needed|'
                         r'for dusting|for frying)\b')
_JUICE_RE = re.compile(rf'^\s*(?:the\s+)?(juice|zest|grated rind|rind|peel)\s+(?:of|from)\s+({_NUM}|an?|one|two|three|four|half)?'
                       r'\s*(?:large|medium|small)?\s*(lemon|lime|orange)e?s?\b')


# Lines that aren't ingredients: section headers ("For the filling:",
# "Topping:"), separators ("_____", "-----"), and empty lines.
_HEADER_RE = re.compile(r'^\s*(for\s+(the\s+)?)?[a-z][a-z\s&/()-]{0,40}:\s*$', re.IGNORECASE)


def is_non_ingredient(line: str) -> bool:
    """True for section headers and separators, which shouldn't count as unknown ingredients."""
    text = (line or '').strip()
    if not re.search(r'[A-Za-z0-9]', text):
        return True                      # "_____", "-----", "***", ""
    if _HEADER_RE.match(text) and len(text.split()) <= 6:
        return True                      # "For the filling:", "Crust:", "Sauce (optional):"
    return False


@dataclass
class ParsedLine:
    raw: str
    quantity: Optional[float] = None
    unit: Optional[str] = None           # normalised unit key from UNITS
    size_g: Optional[float] = None       # "(15 oz.)" package size, per container
    ingredient_id: Optional[str] = None
    matched_alias: Optional[str] = None
    form: list = field(default_factory=list)
    preparation: list = field(default_factory=list)
    optional: bool = False
    name_text: str = ''                  # cleaned name portion (for the unmatched report)
    alt_ids: list = field(default_factory=list)   # other "or" choices ("butter or margarine" -> margarine)


def _to_number(text: str) -> float:
    # Any whitespace between parts: "1 1/2", "1\t1/2", "1  1/2"
    text = ' '.join(text.split())
    if ' ' in text:                      # "1 1/2"
        whole, frac = text.split(None, 1)
        return float(whole) + _to_number(frac)
    if '/' in text:
        num, den = text.split('/', 1)
        return float(num) / float(den) if float(den) else 0.0
    return float(text)


def _size_to_grams(num: str, unit: str) -> float:
    unit = unit.lower().replace('.', '').replace(' ', '')
    grams_per = {'oz': 28.35, 'ounce': 28.35, 'ounces': 28.35, 'lb': 453.6, 'lbs': 453.6, 'pound': 453.6,
                 'pounds': 453.6, 'g': 1, 'gram': 1, 'grams': 1, 'kg': 1000, 'ml': 1, 'l': 1000, 'liter': 1000,
                 'litre': 1000, 'floz': 29.6, 'qt': 946, 'quart': 946, 'pint': 473, 'pt': 473}
    return _to_number(num) * grams_per.get(unit, 28.35)


def parse_line(raw: str) -> ParsedLine:
    line = ParsedLine(raw=raw)
    text = raw.strip()
    for uni, rep in _UNICODE_FRACTIONS.items():
        text = text.replace(uni, rep)
    # Capital-T "T." means tablespoon, lower-case "t." teaspoon, in older recipes.
    text = re.sub(r'(?<=[\d\s])T\.?(?=\s)', ' tbsp ', text, count=1)
    text = re.sub(r'(?<=[\d\s])t\.?(?=\s)', ' tsp ', text, count=1)
    text = text.lower().strip()

    if OPTIONAL_RE.search(text):
        line.optional = True
        text = OPTIONAL_RE.sub(' ', text)

    # "juice of 2 lemons" -> "2 lemon juice"
    m = _JUICE_RE.match(text)
    if m:
        what, qty, fruit = m.group(1), m.group(2) or '1', m.group(3)
        qty = str(_WORD_NUMBERS.get(qty, qty))
        text = f'{qty} {fruit} {"juice" if what == "juice" else "zest"}' + text[m.end():]

    # ---------- quantity ----------
    m = _QTY_RE.match(text)
    if m:
        low = _to_number(m.group(1))
        high = _to_number(m.group(2)) if m.group(2) else None
        line.quantity = (low + high) / 2 if high else low
        text = text[m.end():]
    else:
        m = _WORD_QTY_RE.match(text)
        if m and m.group(1) not in ('few',) and not text.startswith(('half and half', 'half & half')):
            line.quantity = float(_WORD_NUMBERS[m.group(1)])
            text = text[m.end():]

    # ---------- package size "(15 oz.)" anywhere in the line ----------
    m = _SIZE_RE.search(text)
    if m:
        low = _size_to_grams(m.group(1), m.group(3))
        high = _size_to_grams(m.group(2), m.group(3)) if m.group(2) else None
        line.size_g = (low + high) / 2 if high else low
        text = (text[:m.start()] + ' ' + text[m.end():]).strip()

    # ---------- unit ----------
    m = _UNIT_RE.match(text)
    if m:
        unit = m.group(1).lower()
        # "1 large egg": large/medium/small is a size, the unit is the item itself
        line.unit = unit if unit not in ('c',) else 'cup'
        text = text[m.end():]
        # "2 cans (15 oz each)" — size may follow the unit
        m2 = _SIZE_RE.search(text)
        if m2 and line.size_g is None:
            line.size_g = _size_to_grams(m2.group(1), m2.group(3))
            text = (text[:m2.start()] + ' ' + text[m2.end():]).strip()
        # "1 lb. 2 oz." and similar trailing second amounts are ignored
    text = re.sub(r'^\s*(?:of|\.)\s+', '', text)

    # ---------- split prep and alternatives ----------
    text = re.sub(r'\([^)]*\)', ' ', text)            # remaining parentheticals are notes
    head, _, tail = text.partition(',')
    # "butter or margarine" -> try "butter" first, then "margarine".
    alternatives = [a for a in re.split(r'\s+or\s+|\s*/\s*', head) if a.strip()] or [head]
    head = alternatives[0]
    if tail:
        line.preparation.extend(p.strip() for p in re.split(r'[,;]', tail) if p.strip())
    line.name_text = head.strip()

    # ---------- match ----------
    tokens = tokenize(head)
    ing_id, start, end = match_ingredient(tokens)
    for alt in alternatives[1:]:
        if ing_id:
            break
        for candidate in _alt_candidates(head, alt):
            tokens = tokenize(candidate)
            ing_id, start, end = match_ingredient(tokens)
            if ing_id:
                break
    if ing_id is None and tail:
        # "salt, pepper" / "chicken, cut up" — try the text after the comma too
        tokens2 = tokenize(tail)
        ing_id, s2, e2 = match_ingredient(tokens2)
        if ing_id:
            tokens, start, end = tokens2, s2, e2
            line.preparation = []
    if ing_id:
        # The cook might pick any alternative, so remember them for allergen checks.
        for alt in alternatives[1:]:
            for candidate in _alt_candidates(head, alt):
                alt_id, _, _ = match_ingredient(tokenize(candidate))
                if alt_id and alt_id != ing_id:
                    if alt_id not in line.alt_ids:
                        line.alt_ids.append(alt_id)
                    break
        line.matched_alias = ' '.join(tokens[start:end])
        line.ingredient_id = _disambiguate(ing_id, line)
        # Descriptors can sit outside the alias ("2 large ripe tomatoes") or
        # inside it ("fresh tomato" and "diced tomato" are aliases themselves).
        for i, w in enumerate(tokens):
            if start <= i < end and w == 'ground':
                continue  # part of the product name: ground beef, ground cumin
            if w in FORM_WORDS and FORM_WORDS[w] and FORM_WORDS[w] not in line.form:
                line.form.append(FORM_WORDS[w])
            elif w in PREP_WORDS and w not in line.preparation:
                line.preparation.append(w)

    # the container itself tells us the form
    if line.unit in ('can', 'cans') and 'canned' not in line.form:
        line.form.append('canned')
    if line.unit in ('jar', 'jars') and 'jarred' not in line.form:
        line.form.append('jarred')
    if line.matched_alias and 'cooked' in line.matched_alias.split() and 'cooked' not in line.form:
        line.form.append('cooked')
    return line


def _alt_candidates(first: str, alt: str) -> list:
    """Ways to read the second half of "X or Y" when words are shared:
    "flank or skirt steak" -> "skirt steak" / "flank steak";
    "curry powder or paste" -> "curry paste"."""
    first_words, alt_words = tokenize(first), tokenize(alt)
    return [
        alt,
        ' '.join(first_words + alt_words[1:]),       # flank + steak
        ' '.join(first_words[:-1] + alt_words),      # curry + paste
    ]


def _disambiguate(ing_id: str, line: ParsedLine) -> str:
    """Fix aliases whose meaning depends on the amount."""
    alias = line.matched_alias or ''
    # "1/2 tsp. red pepper" is cayenne; "1 red pepper, chopped" is a bell pepper.
    if ing_id == 'bell_pepper' and alias == 'red pepper' and line.unit in SPICE_UNITS:
        return 'cayenne'
    # "2 peppers, diced" is bell pepper; "1/2 tsp. pepper" is black pepper.
    if ing_id == 'black_pepper' and alias == 'pepper' and line.quantity and line.unit not in SPICE_UNITS \
            and line.unit not in ('g', 'oz') and (line.unit is None or UNITS.get(line.unit, ('',))[0] == 'each'):
        return 'bell_pepper'
    # "1 tsp. soda" is baking soda; "1 can soda" is a soft drink.
    if ing_id == 'baking_soda' and alias == 'soda' and line.unit in ('can', 'cans', 'bottle', 'cup', 'cups', 'l', 'liter'):
        return 'soda_pop'
    return ing_id


def standardize_name(text: str) -> Optional[str]:
    """Map free text (e.g. a pantry entry typed by a user) to a canonical ingredient id."""
    parsed = parse_line(text)
    if parsed.ingredient_id:
        return parsed.ingredient_id
    ing_id, _, _ = match_ingredient(tokenize(text))
    return ing_id
