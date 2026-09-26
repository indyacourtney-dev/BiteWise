"""
backend/database/cleaning/dietary.py

Assigns dietary tags to every recipe. Three families:

1. ALLERGEN-FREE   'nut-free', 'gluten-free', 'dairy-free', ... one per
                   allergen in allergens.py.
2. DIETS           vegan, vegetarian, pescatarian, no-red-meat, no-pork,
                   alcohol-free, halal, kosher-style, paleo,
                   low-FODMAP, gout-friendly, GERD-friendly, no-processed-meat.
3. HEALTH / MACROS diabetic-friendly (high blood sugar),
                   hypoglycemia-friendly (low blood sugar), heart-healthy,
                   low-cholesterol (for high cholesterol), healthy-fats
                   (for low cholesterol), low-sodium, keto, low-carb,
                   high-protein, low-fat, low-calorie, high-fiber, low-sugar.

SAFETY RULES
------------
* Families 1 and 2 are "absence" claims ("contains no X"). They are only
  assigned when EVERY ingredient line in the recipe was recognised. One
  unknown line, and the recipe gets none of them.
* Family 3 needs the macro estimate to be trustworthy, so it is only
  assigned when at least MIN_COVERAGE_FOR_TAGS of the ingredient weights
  were worked out.
* These are meal-planning filters, not medical advice. Thresholds are
  in THRESHOLDS below with their sources so they're easy to review
  with a dietitian and change in one place.
"""

import re
from dataclasses import dataclass

from .allergens import ALLERGENS
from .catalog import (
    ADDED_SUGAR, ALCOHOL, ANIMAL, DAIRY, EGG, GELATIN, STARCHY_VEG, GERD_TRIGGER, GRAIN, HIGH_FODMAP, HIGH_PURINE, HONEY, LEGUME, MAMMAL,
    PORK, POULTRY, PROCESSED, PROCESSED_MEAT, REFINED_SUGAR, SEED_OIL, SPICY,
)
from .nutrition import RecipeNutrition

MIN_COVERAGE_FOR_TAGS = 0.8

# Per-serving limits unless noted. Sources are guidance these are loosely based on.
THRESHOLDS = {
    # High blood sugar / diabetes — ADA plate method (~45 g carbs per meal for many adults),
    # WHO added-sugar guidance, AHA saturated-fat guidance.
    'diabetic': dict(max_net_carbs=45, max_added_sugar=6, min_fiber=3, max_sat_fat=6),
    # Low blood sugar / reactive hypoglycemia — steady complex carbs WITH protein, little added sugar.
    # (Treating an active low needs fast sugar per the user's doctor; this is for everyday meals.)
    'hypoglycemia': dict(min_carbs=30, max_carbs=60, min_fiber=3, min_protein=12, max_added_sugar=10),
    # Heart-healthy — loosely based on AHA Heart-Check meal limits.
    'heart': dict(max_sat_fat=3.5, max_cholesterol=90, max_sodium=600),
    # High cholesterol — limit dietary cholesterol and saturated fat.
    'low_cholesterol': dict(max_cholesterol=100, max_sat_fat=5),
    # Low cholesterol (hypocholesterolemia) is usually managed medically; for meals we favour
    # enough calories and mostly-unsaturated fats rather than restricting anything.
    'healthy_fats': dict(min_fat=15, min_unsat_share=0.7, max_sat_fat=7, min_kcal=350),
    # FDA "low sodium" meal definition: <= 140 mg per 100 g.
    'low_sodium': dict(max_sodium_per_100g=140),
    'keto': dict(max_net_carbs=10, min_fat_pct=55),
    'low_carb': dict(max_net_carbs=20),
    'high_protein': dict(min_protein=25),
    # FDA "low fat" meal: <= 3 g fat per 100 g and <= 30% of calories from fat.
    'low_fat': dict(max_fat_per_100g=3, max_fat_pct=30),
    # FDA "low calorie" meal: <= 120 kcal per 100 g.
    'low_calorie': dict(max_kcal_per_100g=120),
    # FDA "high fiber": >= 20% Daily Value (5.6 g) per serving.
    'high_fiber': dict(min_fiber=6),
    'low_sugar': dict(max_sugar=5),
    # Gout: no high-purine foods and a modest red-meat portion.
    'gout': dict(max_red_meat_g=115),
    # GERD / acid reflux: no common triggers, not fried, not very fatty.
    'gerd': dict(max_fat=20),
}


@dataclass(frozen=True)
class TagDef:
    id: str
    label: str
    kind: str            # 'allergen_free' | 'diet' | 'religious' | 'health'
    description: str


TAG_DEFS: tuple = tuple(
    TagDef(a.free_tag, f'{a.label}-free' if a.id != 'alpha_gal' else 'Alpha-gal safe', 'allergen_free',
           f'Contains no {a.label.lower()} and no ingredient that commonly hides it. Avoids: {a.avoid}')
    for a in ALLERGENS
) + (
    TagDef('vegan', 'Vegan', 'diet', 'No meat, fish, dairy, eggs, honey, or gelatin.'),
    TagDef('vegetarian', 'Vegetarian', 'diet', 'No meat, poultry, fish, seafood, meat broths, or gelatin.'),
    TagDef('pescatarian', 'Pescatarian', 'diet', 'No meat or poultry; fish and seafood allowed.'),
    TagDef('no-red-meat', 'No red meat', 'diet', 'No beef, pork, lamb, veal, venison, or products made from them.'),
    TagDef('no-pork', 'No pork', 'diet', 'No pork, bacon, ham, lard, pork sausage, or gelatin.'),
    TagDef('no-processed-meat', 'No processed meat', 'diet', 'No bacon, ham, sausage, hot dogs, deli meats.'),
    TagDef('alcohol-free', 'Alcohol-free', 'diet', 'No wine, beer, or spirits (cooking with them does not remove all alcohol).'),
    TagDef('halal', 'Halal-friendly', 'religious',
           'No pork, alcohol, lard, gelatin, or shellfish (excluded to be safe). Meat and poultry must still be '
           'halal-certified — BiteWise cannot verify that.'),
    TagDef('kosher-style', 'Kosher-style', 'religious',
           'No pork or shellfish, and meat/poultry is never combined with dairy. Not a kosher certification.'),
    TagDef('paleo', 'Paleo', 'diet', 'No grains, legumes, dairy, refined sugar, seed oils, or processed foods.'),
    TagDef('low-fodmap', 'Low-FODMAP', 'health',
           'Avoids common high-FODMAP foods (onion, garlic, wheat, beans, lactose, honey, apples). For IBS.'),
    TagDef('gout-friendly', 'Gout-friendly', 'health',
           'No high-purine foods (organ meats, anchovies, sardines, mussels, scallops, beer) and a modest red-meat portion.'),
    TagDef('gerd-friendly', 'Reflux-friendly', 'health',
           'No tomato, citrus, chili, chocolate, mint, coffee, or alcohol; not deep-fried; under 20 g fat per serving.'),
    TagDef('diabetic-friendly', 'Blood-sugar friendly (high)', 'health',
           'For high blood sugar / diabetes: <= 45 g net carbs, <= 6 g added sugar, >= 3 g fiber, <= 6 g saturated fat per serving.'),
    TagDef('hypoglycemia-friendly', 'Blood-sugar steady (low)', 'health',
           'For low blood sugar: 30-60 g carbs with >= 3 g fiber and >= 12 g protein, little added sugar, so energy is released steadily.'),
    TagDef('heart-healthy', 'Heart-healthy', 'health',
           'For high blood pressure / heart health: <= 3.5 g saturated fat, <= 90 mg cholesterol, <= 600 mg sodium, no processed meat.'),
    TagDef('low-cholesterol', 'Low-cholesterol', 'health',
           'For high cholesterol: <= 100 mg dietary cholesterol and <= 5 g saturated fat per serving.'),
    TagDef('healthy-fats', 'Healthy fats', 'health',
           'For low cholesterol: a filling meal (>= 350 kcal) with >= 15 g fat, at least 70% unsaturated, <= 7 g saturated.'),
    TagDef('low-sodium', 'Low-sodium', 'health', 'FDA definition for meals: <= 140 mg sodium per 100 g.'),
    TagDef('keto', 'Keto', 'diet',
           '<= 10 g net carbs per serving, >= 55% of calories from fat, and no grains, potatoes, beans, or sugars.'),
    TagDef('low-carb', 'Low-carb', 'diet', '<= 20 g net carbs per serving.'),
    TagDef('high-protein', 'High-protein', 'diet', '>= 25 g protein per serving.'),
    TagDef('low-fat', 'Low-fat', 'health', 'FDA definition for meals: <= 3 g fat per 100 g and <= 30% of calories from fat.'),
    TagDef('low-calorie', 'Low-calorie', 'health', 'FDA definition for meals: <= 120 kcal per 100 g.'),
    TagDef('high-fiber', 'High-fiber', 'health', '>= 6 g fiber per serving.'),
    TagDef('low-sugar', 'Low-sugar', 'health', '<= 5 g total sugar per serving.'),
)

TAG_BY_ID = {t.id: t for t in TAG_DEFS}

_DEEP_FRY_RE = re.compile(r'\b(deep[- ]?fr(y|ied)|fry in (hot )?(oil|fat|shortening)|french fr(y|ied))\b', re.IGNORECASE)


def ingredient_tags(flags: set, contains: set, may_contain: set) -> list:
    """Absence-based tags. Only call when every ingredient line was recognised."""
    tags = []
    risky = contains | may_contain
    for a in ALLERGENS:
        if a.id not in risky:
            tags.append(a.free_tag)

    if not flags & {ANIMAL, DAIRY, EGG, HONEY, GELATIN}:
        tags.append('vegan')
    if not flags & {ANIMAL, GELATIN}:
        tags.append('vegetarian')
    if not flags & {MAMMAL, POULTRY, GELATIN}:
        tags.append('pescatarian')
    if MAMMAL not in flags:
        tags.append('no-red-meat')
    if not flags & {PORK, GELATIN}:
        tags.append('no-pork')
    if PROCESSED_MEAT not in flags:
        tags.append('no-processed-meat')
    if ALCOHOL not in flags:
        tags.append('alcohol-free')
    # Matches frontend/types: "no pork or alcohol; shellfish excluded to be safe".
    if not flags & {PORK, ALCOHOL, GELATIN} and not risky & {'shellfish', 'mollusc'}:
        tags.append('halal')
    meat = bool(flags & {MAMMAL, POULTRY})
    if not flags & {PORK, GELATIN} and not risky & {'shellfish', 'mollusc'} and not (meat and DAIRY in flags):
        tags.append('kosher-style')
    if not flags & {GRAIN, LEGUME, DAIRY, REFINED_SUGAR, SEED_OIL, PROCESSED}:
        tags.append('paleo')
    if HIGH_FODMAP not in flags:
        tags.append('low-fodmap')
    return tags


def nutrition_tags(nut: RecipeNutrition, flags: set, all_known: bool, directions_text: str) -> list:
    """Macro-based tags. Only call when nut.coverage >= MIN_COVERAGE_FOR_TAGS."""
    s = nut.per_serving
    t = THRESHOLDS
    tags = []
    net = nut.net_carbs_g
    fat_pct = nut.pct_kcal('fat_g') or 0
    sodium_100 = nut.per_100g('sodium_mg')
    kcal_100 = nut.per_100g('kcal')
    fat_100 = nut.per_100g('fat_g')

    d = t['diabetic']
    if net <= d['max_net_carbs'] and nut.added_sugar_g <= d['max_added_sugar'] \
            and s['fiber_g'] >= d['min_fiber'] and s['sat_fat_g'] <= d['max_sat_fat']:
        tags.append('diabetic-friendly')

    h = t['hypoglycemia']
    if h['min_carbs'] <= s['carbs_g'] <= h['max_carbs'] and s['fiber_g'] >= h['min_fiber'] \
            and s['protein_g'] >= h['min_protein'] and nut.added_sugar_g <= h['max_added_sugar']:
        tags.append('hypoglycemia-friendly')

    hh = t['heart']
    if s['sat_fat_g'] <= hh['max_sat_fat'] and s['cholesterol_mg'] <= hh['max_cholesterol'] \
            and s['sodium_mg'] <= hh['max_sodium'] and PROCESSED_MEAT not in flags:
        tags.append('heart-healthy')

    lc = t['low_cholesterol']
    if s['cholesterol_mg'] <= lc['max_cholesterol'] and s['sat_fat_g'] <= lc['max_sat_fat']:
        tags.append('low-cholesterol')

    hf = t['healthy_fats']
    if s['fat_g'] >= hf['min_fat'] and s['kcal'] >= hf['min_kcal'] and s['sat_fat_g'] <= hf['max_sat_fat'] \
            and (s['fat_g'] - s['sat_fat_g']) / s['fat_g'] >= hf['min_unsat_share']:
        tags.append('healthy-fats')

    if sodium_100 is not None and sodium_100 <= t['low_sodium']['max_sodium_per_100g']:
        tags.append('low-sodium')
    if net <= t['low_carb']['max_net_carbs']:
        tags.append('low-carb')
    if s['protein_g'] >= t['high_protein']['min_protein']:
        tags.append('high-protein')
    if fat_100 is not None and fat_100 <= t['low_fat']['max_fat_per_100g'] and fat_pct <= t['low_fat']['max_fat_pct']:
        tags.append('low-fat')
    if kcal_100 is not None and kcal_100 <= t['low_calorie']['max_kcal_per_100g']:
        tags.append('low-calorie')
    if s['fiber_g'] >= t['high_fiber']['min_fiber']:
        tags.append('high-fiber')
    if s['sugar_g'] <= t['low_sugar']['max_sugar']:
        tags.append('low-sugar')

    # These combine ingredient absence with macros, so they also need every line recognised.
    if all_known:
        # Keto (matches frontend/types): very low net carbs, mostly fat, AND no grains,
        # potatoes, beans, or sugars at all.
        if net <= t['keto']['max_net_carbs'] and fat_pct >= t['keto']['min_fat_pct'] \
                and not flags & {GRAIN, LEGUME, ADDED_SUGAR, STARCHY_VEG}:
            tags.append('keto')
        if HIGH_PURINE not in flags and ALCOHOL not in flags \
                and nut.flag_grams.get(MAMMAL, 0) <= t['gout']['max_red_meat_g']:
            tags.append('gout-friendly')
        if not flags & {GERD_TRIGGER, SPICY} and s['fat_g'] <= t['gerd']['max_fat'] \
                and not _DEEP_FRY_RE.search(directions_text):
            tags.append('gerd-friendly')
    return tags
