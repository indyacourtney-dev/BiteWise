"""
backend/database/cleaning/nutrition.py

Counts macros for a recipe from its parsed ingredient lines.

  grams per line  = quantity x unit, converted with the ingredient's
                    density (cups -> grams) or per-item weight (2 eggs)
  recipe totals   = sum of (nutrition per 100 g x grams / 100)
  per serving     = totals / servings

HONESTY RULES
-------------
* Kaggle recipes rarely say how many they serve. If the directions say
  "serves 6" or "makes 2 dozen", that is used. Otherwise servings are
  estimated as one ~500 kcal portion each and `servings_estimated` is
  set, so the app can say "per portion" instead of "per serving".
* `coverage` is the share of (non-staple, non-optional) ingredient lines
  whose weight could be worked out. Nutrition-based health tags are only
  assigned when coverage >= MIN_COVERAGE_FOR_TAGS (see dietary.py), so a
  recipe with half its ingredients unknown is never labelled "low-sodium".
* All numbers are estimates from USDA averages, good for comparing and
  filtering recipes, not for medical dosing (e.g. insulin).
"""

import re
from dataclasses import dataclass, field
from typing import Optional

from .catalog import CATALOG_BY_ID, ADDED_SUGAR
from .normalize import ParsedLine, UNITS

NUTRIENTS = ('kcal', 'protein_g', 'carbs_g', 'fat_g', 'sat_fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'cholesterol_mg')

PORTION_KCAL = 500          # used only when a recipe doesn't state servings
MAX_ESTIMATED_SERVINGS = 12
DEFAULT_PACKAGE_G = 340     # "1 pkg." with no size given (typical 10-16 oz package)
DEFAULT_SLICE_G = 25
DEFAULT_BUNCH_G = 100
MAX_LINE_GRAMS = 6000       # anything bigger is a parsing error, not an ingredient

DEFAULT_DENSITY = {  # g/ml when an ingredient has no density of its own
    'dairy': 1.0, 'beverages': 1.0, 'oils': 0.92, 'condiments': 1.05, 'sweeteners': 1.0, 'spices': 0.5,
    'baking': 0.6, 'grains': 0.6, 'produce': 0.5, 'proteins': 0.7, 'nuts_seeds': 0.55, 'pantry': 0.8,
}


def line_grams(p: ParsedLine) -> Optional[float]:
    """Weight in grams of one parsed line, or None if it can't be worked out."""
    ing = CATALOG_BY_ID.get(p.ingredient_id) if p.ingredient_id else None
    if ing is None:
        return None
    qty = p.quantity
    grams = None

    if p.unit is None:
        if qty is not None and ing.each:
            grams = qty * ing.each
    else:
        kind, factor = UNITS.get(p.unit, (None, None))
        q = qty if qty is not None else 1.0          # "pinch of salt", "dash Tabasco"
        if kind == 'g':
            grams = q * factor
        elif kind == 'ml':
            density = ing.density or DEFAULT_DENSITY.get(ing.category, 0.7)
            if 'cooked' in p.form and ing.cooked:
                density = ing.cooked[1]
            grams = q * factor * density
        elif kind == 'container':
            size = p.size_g or factor or (ing.each if ing.each and ing.each >= 100 else None) or DEFAULT_PACKAGE_G
            grams = q * size
        elif kind == 'stick':
            grams = q * (113 if ing.id in ('butter', 'margarine', 'shortening') else (ing.each or 10))
        elif kind == 'slice':
            grams = q * (ing.each if ing.each and ing.each < 60 else DEFAULT_SLICE_G)
        elif kind == 'each':
            grams = q * factor * ing.each if ing.each else None
        elif kind == 'bunch':
            grams = q * (ing.each if ing.each and ing.each >= 40 else DEFAULT_BUNCH_G)
        elif kind == 'sprig':
            grams = q * 1.0

    if grams is None:
        return None
    # "2 cups cooked rice" -> convert back to the dry weight the nutrition table uses
    if 'cooked' in p.form and ing.cooked:
        grams /= ing.cooked[0]
    if grams <= 0 or grams > MAX_LINE_GRAMS:
        return None
    return round(grams, 1)


# ---------------------------------------------------------------------
# Servings
# ---------------------------------------------------------------------
_SERVES_RE = re.compile(
    r'\b(?:serves|servings?|yields?|makes|feeds|portions?)\s*:?\s*(?:about\s*|approximately\s*|approx\.?\s*)?'
    r'(\d+)(?:\s*(?:-|to)\s*(\d+))?\s*(dozen)?', re.IGNORECASE)


def detect_servings(title: str, directions: list) -> Optional[int]:
    text = ' '.join([title] + list(directions))
    m = _SERVES_RE.search(text)
    if not m:
        return None
    low = int(m.group(1))
    high = int(m.group(2)) if m.group(2) else low
    n = round((low + high) / 2)
    if m.group(3):
        n *= 12
    return n if 1 <= n <= 100 else None


# ---------------------------------------------------------------------
# Recipe nutrition
# ---------------------------------------------------------------------
@dataclass
class RecipeNutrition:
    servings: int
    servings_estimated: bool
    coverage: float                              # 0..1
    total_grams: float
    per_serving: dict = field(default_factory=dict)
    added_sugar_g: float = 0.0                   # per serving
    flag_grams: dict = field(default_factory=dict)   # per serving grams of flagged ingredients

    def per_100g(self, nutrient: str) -> Optional[float]:
        grams_per_serving = self.total_grams / self.servings if self.servings else 0
        if grams_per_serving <= 0:
            return None
        return self.per_serving[nutrient] / grams_per_serving * 100

    def pct_kcal(self, macro: str) -> Optional[float]:
        kcal = self.per_serving['kcal']
        if kcal <= 0:
            return None
        per_gram = {'protein_g': 4, 'carbs_g': 4, 'fat_g': 9, 'sat_fat_g': 9}[macro]
        return self.per_serving[macro] * per_gram / kcal * 100

    @property
    def net_carbs_g(self) -> float:
        return max(0.0, self.per_serving['carbs_g'] - self.per_serving['fiber_g'])


def compute_nutrition(lines: list, grams: list, title: str = '', directions: tuple = (),
                      servings: Optional[int] = None) -> RecipeNutrition:
    """`servings`: pass it when known (curated recipes); otherwise it's detected or estimated."""
    totals = dict.fromkeys(NUTRIENTS, 0.0)
    added_sugar = 0.0
    flag_totals = {}
    total_grams = 0.0
    countable = covered = 0

    for p, g in zip(lines, grams):
        ing = CATALOG_BY_ID.get(p.ingredient_id) if p.ingredient_id else None
        if p.optional:
            continue                             # garnishes don't count toward the meal's macros
        if ing is None or not ing.staple:
            countable += 1
            if g is not None:
                covered += 1
        if ing is None or g is None:
            continue
        total_grams += g
        for key, value in zip(NUTRIENTS, ing.n):
            totals[key] += value * g / 100
        if ADDED_SUGAR in ing.flags:
            added_sugar += ing.n[6] * g / 100
        for flag in ing.flags:
            flag_totals[flag] = flag_totals.get(flag, 0.0) + g

    coverage = covered / countable if countable else 0.0

    stated = servings if servings and servings > 0 else detect_servings(title, directions)
    if stated:
        servings, estimated = stated, False
    elif totals['kcal'] > 0 and coverage >= 0.5:
        servings = max(1, min(MAX_ESTIMATED_SERVINGS, round(totals['kcal'] / PORTION_KCAL)))
        estimated = True
    else:
        servings, estimated = 4, True

    per_serving = {k: round(v / servings, 1) for k, v in totals.items()}
    return RecipeNutrition(
        servings=servings,
        servings_estimated=estimated,
        coverage=round(coverage, 3),
        total_grams=round(total_grams, 1),
        per_serving=per_serving,
        added_sugar_g=round(added_sugar / servings, 1),
        flag_grams={k: round(v / servings, 1) for k, v in flag_totals.items()},
    )
