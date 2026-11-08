// components/RecipeDetail.tsx
//
// The full recipe view. The This or That result and the recipe page both
// render this, so a recipe looks identical no matter how the user arrived
// at it. Add a field here once and every screen picks it up.
//
// Redesign notes:
//   * ingredients are checked against the pantry (have / missing) and the
//     missing ones go to the grocery list in one tap
//   * a servings stepper scales the amounts (utils/servings.ts)
//   * guided cooking is a dark, one-step-per-screen mode with a timer
//   * the recipe page's fixed bottom bar opens guided cooking through
//     `openCookingSignal` (bump the number to open)

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import PlateVisualization from './PlateVisualization';
import RecipeReviews from './RecipeReviews';
import { Card, Display, Pill, PrimaryButton, RecipeTile, SecondaryButton, SectionLabel } from './ui';
import { COLORS } from '../constants/Colors';
import { formatTime, getTotalTime, DIFFICULTY_LABELS } from '../constants/recipes';
import { getRecipeImage, hasRecipePhoto } from '../constants/recipeImages';
import { MEAL_INFO, getMealTypes } from '../utils/meals';
import { findCustomConflicts } from '../utils/customFoods';
import { getPantryCoverage, pantryHas } from '../utils/matching';
import { scaleAmount } from '../utils/servings';
import { ageOn } from '../utils/age';
import { FOCUS_INFO, GOAL_LABELS, focusFit, goalFit, goalForMeal, isCompleteGoals } from '../utils/goals';
import { useApp } from '../context/AppContext';
import { useAccessibility } from '../hooks/useAccessibility';
import {
  buildGuidedSteps,
  buildRecipeReadAloudParts,
  formatGuidedIngredientName,
  getGuidedStepTips,
  getReadAloudIngredientFields,
} from '../utils/guidedCooking';
import type { Recipe } from '../types';

// Tags shown as chips. Allergen-free tags ('nut-free', ...) are summarised
// on one "Free from" line instead, so a recipe doesn't show 30 chips.
const CHIP_TAGS = [
  'vegan', 'vegetarian', 'pescatarian', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'low-carb', 'high-protein',
  'halal', 'kosher-style', 'diabetic-friendly', 'hypoglycemia-friendly', 'heart-healthy', 'low-cholesterol',
  'healthy-fats', 'low-sodium', 'low-fat', 'low-calorie', 'high-fiber', 'low-sugar', 'no-red-meat', 'low-fodmap',
  'gout-friendly', 'gerd-friendly',
];
const TAG_LABELS: Record<string, string> = {
  'diabetic-friendly': 'blood-sugar friendly',
  'hypoglycemia-friendly': 'steady energy',
  'gerd-friendly': 'reflux-friendly',
};
// "Free from" is worked out from the allergen lists (the single source of truth),
// for the most common allergens. Only shown when the list is verified.
const FREE_FROM_CHECK: [string, string][] = [
  ['dairy', 'dairy'], ['eggs', 'eggs'], ['gluten', 'gluten'], ['soy', 'soy'], ['nuts', 'tree nuts'],
  ['peanuts', 'peanuts'], ['fish', 'fish'], ['shellfish', 'shellfish'], ['sesame', 'sesame'],
];

interface Props {
  recipe: Recipe;
  /** Shown as a "% match" pill. Omit for the randomizer. */
  matchScore?: number;
  /** Plate-balance tip from the matching engine. */
  suggestion?: string;
  /** Optional line above the hero, e.g. the near-miss notice. */
  note?: string;
  /** Scroll the containing screen to a y offset within its ScrollView. */
  onJumpToReviews?: (y: number) => void;
  /**
   * When provided, renders a "See full recipe" button under the plate
   * breakdown that opens this meal on its own screen. Used on the quiz
   * result, where people expect a button rather than a long scroll.
   */
  onOpenRecipe?: () => void;
  /** Bump this number to open guided cooking from outside (the fixed bar). */
  openCookingSignal?: number;
  /** Hide the inline "Start guided cooking" button (the page has its own bar). */
  hideInlineCookButton?: boolean;
}

export default function RecipeDetail({
  recipe,
  matchScore,
  suggestion,
  note,
  onOpenRecipe,
  onJumpToReviews,
  openCookingSignal,
  hideInlineCookButton = false,
}: Props) {
  const { preferences, pantry, addGroceryItem, grocery, mealType: currentMeal, birthDate } = useApp();
  const a11y = useAccessibility();
  const [guidedVisible, setGuidedVisible] = useState(false);
  const [reviewPrompt, setReviewPrompt] = useState(false);
  const [servings, setServings] = useState(Math.max(1, recipe.servings || preferences.householdSize));
  const [added, setAdded] = useState(0);
  const [reviewSummary, setReviewSummary] = useState<{
    averageRating: number | null;
    totalReviews: number;
    loading: boolean;
  }>({ averageRating: null, totalReviews: 0, loading: true });

  useEffect(() => {
    setServings(Math.max(1, recipe.servings || preferences.householdSize));
    setAdded(0);
  }, [recipe.id, recipe.servings, preferences.householdSize]);

  useEffect(() => {
    if (openCookingSignal) setGuidedVisible(true);
  }, [openCookingSignal]);

  const detailOffset = useRef(0);
  const reviewsOffset = useRef<number | null>(null);
  const reviewsNode = useRef<View>(null);
  const handleReviewSummary = useCallback((summary: typeof reviewSummary) => {
    setReviewSummary(summary);
  }, []);
  const handleReviewsLayout = useCallback((y: number) => {
    reviewsOffset.current = y;
  }, []);
  const jumpToReviews = () => {
    // Web: the page (not the ScrollView node) is often what scrolls, and
    // onLayout there only fires on size changes, so measured offsets go
    // stale. Ask the browser to bring the section into view instead.
    if (Platform.OS === 'web') {
      const node = reviewsNode.current as unknown as { scrollIntoView?: (o: ScrollIntoViewOptions) => void } | null;
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: a11y.reduceMotion ? 'auto' : 'smooth', block: 'start' });
        return;
      }
    }
    if (reviewsOffset.current !== null) {
      onJumpToReviews?.(detailOffset.current + reviewsOffset.current);
    }
  };

  const guidedSteps = useMemo(() => buildGuidedSteps(recipe.instructions, recipe.ingredients), [recipe.instructions, recipe.ingredients]);
  const readRecipeAloud = () => {
    const utterances = buildRecipeReadAloudParts(recipe);
    if (__DEV__) {
      console.debug('[BiteWise Read Aloud] ingredient fields', getReadAloudIngredientFields(recipe.ingredients));
      console.debug('[BiteWise Read Aloud] exact utterance queue', utterances);
    }
    a11y.speak(utterances);
  };

  // Safety net for recipes opened directly (a chat card, an old favorite):
  // say clearly if it conflicts with the user's allergies or foods to avoid.
  const custom = findCustomConflicts(recipe, preferences);
  const contains = recipe.allergens.filter(a => preferences.avoidAllergens.includes(a));
  const mayContain = (recipe.mayContain ?? []).filter(a => preferences.avoidAllergens.includes(a));
  const hasAnyAllergy = preferences.avoidAllergens.length > 0 || (preferences.customAllergies ?? []).length > 0;
  const allergyWarnings = [
    ...contains.map(a => `Contains ${a.replace(/_/g, '-')}`),
    ...mayContain.map(a => `May contain ${a.replace(/_/g, '-')}`),
    ...custom.allergies.map(a => `Mentions ${a}`),
    ...(hasAnyAllergy && recipe.allergensVerified === false
      ? ["Some ingredients weren't recognised, so we can't confirm it's safe"] : []),
  ];
  const safeForAllergies = hasAnyAllergy && allergyWarnings.length === 0;

  // Pantry check per ingredient.
  const coverage = useMemo(() => getPantryCoverage(recipe, pantry), [recipe, pantry]);
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1;
  const isDrink = recipe.kind === 'drink';
  const goalView = (() => {
    if (!isCompleteGoals(preferences.goals) || recipe.nutrition.calories <= 0) return null;
    const meals = getMealTypes(recipe);
    const meal = meals.includes(currentMeal) ? currentMeal : (meals[0] ?? 'dinner');
    if (meal === 'dessert') return null;
    const g = goalForMeal(preferences.goals, birthDate ? ageOn(birthDate) : null, meal);
    if (!g) return null;
    return { ...g, fit: goalFit(recipe, g.kind, g.target), focus: focusFit(recipe, g.focuses), mealLabel: MEAL_INFO[meal].label.toLowerCase() };
  })();
  const onList = useMemo(() => new Set(grocery.map(g => g.name.toLowerCase())), [grocery]);
  const missingRequired = recipe.ingredients.filter(i => !i.optional && !pantryHas(pantry, i.name));
  const missingNotListed = missingRequired.filter(i => !onList.has(i.name.toLowerCase()));

  const addMissing = () => {
    let n = 0;
    for (const ing of missingNotListed) {
      if (addGroceryItem(ing.name, { source: 'recipe', note: `for ${recipe.name}` })) n++;
    }
    setAdded(n);
    if (n > 0) a11y.haptic('success');
  };

  const dietChips = CHIP_TAGS.filter(t => (recipe.dietary as string[]).includes(t));

  return (
    <View onLayout={event => { detailOffset.current = event.nativeEvent.layout.y; }}>
      {allergyWarnings.length > 0 ? (
        <View style={styles.warnBox} accessibilityRole="alert">
          <Text style={styles.warnTitle}>Not safe for your allergies</Text>
          {allergyWarnings.map(w => <Text key={w} style={styles.warnText}>• {w}</Text>)}
        </View>
      ) : null}
      {custom.avoid.length > 0 ? (
        <View style={styles.noteBox}>
          <FontAwesome name="info-circle" size={14} color={COLORS.textGold} />
          <Text style={styles.noteText}>Has {custom.avoid.join(', ')}, which you said you'd rather avoid.</Text>
        </View>
      ) : null}
      {note ? (
        <View style={styles.noteBox}>
          <FontAwesome name="info-circle" size={14} color={COLORS.textGold} />
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}

      {/* HERO */}
      <View style={styles.hero}>
        {hasRecipePhoto(recipe) ? (
          <Image source={getRecipeImage(recipe)} style={styles.heroImage} accessibilityIgnoresInvertColors />
        ) : (
          <RecipeTile height={220} emoji={recipe.emoji} radius={22} />
        )}
        {typeof matchScore === 'number' ? (
          <View style={styles.heroTag}><Pill label={`${matchScore}% match`} tone="yellow" /></View>
        ) : null}
      </View>

      {/* TITLE */}
      <View style={styles.titleBlock}>
        <Display size={24}>{recipe.name}</Display>
        <Text style={styles.heroMeals}>
          {isDrink
            ? (recipe.containsAlcohol ? 'Cocktail' : 'Drink')
            : getMealTypes(recipe).map(m => MEAL_INFO[m].label).join(' · ')}
          {recipe.source === 'community' ? ` · Home recipe${recipe.authorName ? ` by ${recipe.authorName}` : ''}` : ''}
        </Text>
        <View style={styles.titleRow}>
          <TouchableOpacity
            style={styles.ratingPill}
            onPress={jumpToReviews}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={
              reviewSummary.averageRating === null
                ? 'Jump to community reviews'
                : `Average rating ${reviewSummary.averageRating.toFixed(1)} out of 5 from ${reviewSummary.totalReviews} reviews. Jump to community reviews.`
            }
          >
            <FontAwesome name={reviewSummary.averageRating !== null ? 'star' : 'star-o'} size={13} color={COLORS.darkGold} />
            <Text style={styles.ratingText}>
              {reviewSummary.loading
                ? 'Loading…'
                : reviewSummary.averageRating === null
                  ? 'Be the first to rate'
                  : `${reviewSummary.averageRating.toFixed(1)} · ${reviewSummary.totalReviews} ${reviewSummary.totalReviews === 1 ? 'review' : 'reviews'}`}
            </Text>
            <FontAwesome name="chevron-down" size={10} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.metaRow}>
            <Meta icon="clock-o" text={formatTime(getTotalTime(recipe))} />
            <Meta icon="signal" text={DIFFICULTY_LABELS[recipe.difficulty]} />
          </View>
        </View>
        <View style={styles.chipRow}>
          {safeForAllergies ? <Pill label="Safe for your allergies" tone="green" icon="shield" /> : null}
          {dietChips.slice(0, safeForAllergies ? 2 : 3).map(tag => (
            <Pill key={tag} label={TAG_LABELS[tag] ?? tag.replace(/-/g, ' ')} tone="blue" />
          ))}
          {(recipe.favoriteCount ?? 0) > 0 ? <Pill label={`Saved by ${recipe.favoriteCount}`} tone="gold" icon="heart" /> : null}
        </View>
        <Text style={styles.timeSplitText}>{recipe.prepMinutes} min prep · {recipe.cookMinutes} min cook</Text>
      </View>

      {/* INGREDIENTS */}
      <Card style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockTitle}>
            Ingredients
            {pantry.length > 0 ? (
              <Text style={styles.blockSub}> · {coverage.have.length} of {coverage.have.length + coverage.missing.length} in your pantry</Text>
            ) : (
              <Text style={styles.blockSub}> · {recipe.ingredients.length}</Text>
            )}
          </Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setServings(s => Math.max(1, s - 1))}
              accessibilityRole="button"
              accessibilityLabel={isDrink ? 'Fewer glasses' : 'Fewer servings'}
            ><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
            <Text style={styles.stepValue}>{servings} {isDrink ? (servings === 1 ? 'glass' : 'glasses') : (servings === 1 ? 'serving' : 'servings')}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setServings(s => Math.min(24, s + 1))}
              accessibilityRole="button"
              accessibilityLabel={isDrink ? 'More glasses' : 'More servings'}
            ><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
          </View>
        </View>
        {recipe.ingredients.map((ing, i) => {
          const have = pantryHas(pantry, ing.name);
          const showStatus = pantry.length > 0 && !ing.optional;
          return (
            <View
              key={`${ing.name}-${i}`}
              style={[styles.ingRow, i === recipe.ingredients.length - 1 && styles.noBorder]}
            >
              {showStatus ? (
                <FontAwesome
                  name={have ? 'check-circle-o' : 'exclamation-circle'}
                  size={17}
                  color={have ? COLORS.green : COLORS.redText}
                  style={{ marginRight: 10 }}
                  accessibilityLabel={have ? 'In your pantry' : 'Missing'}
                />
              ) : (
                <View style={styles.bullet} />
              )}
              <Text style={[styles.ingName, a11y.text(14, '600')]}>
                {ing.name}
                {ing.optional ? <Text style={styles.optional}> · optional</Text> : null}
              </Text>
              <Text style={[styles.ingAmount, a11y.text(13), showStatus && !have && styles.ingMissing]}>
                {scaleAmount(ing.amount, factor) || (showStatus && !have ? 'missing' : '')}
              </Text>
            </View>
          );
        })}
        {pantry.length > 0 && missingRequired.length > 0 ? (
          <View style={styles.addRow}>
            {missingNotListed.length > 0 ? (
              <SecondaryButton
                label={`Add ${missingNotListed.length} missing to grocery`}
                icon="shopping-cart"
                compact
                onPress={addMissing}
                style={{ flex: 1 }}
              />
            ) : (
              <Text style={styles.addedText}>
                {added > 0 ? `Added ${added} to your grocery list` : 'The missing ones are already on your grocery list'}
              </Text>
            )}
          </View>
        ) : null}
      </Card>

      {/* STEPS — with Read aloud (Settings → Accessibility sets the speed and voice) */}
      <View style={styles.stepsHeader}>
        <Text style={styles.sectionTitle}>How to make it <Text style={styles.blockSub}>· {recipe.instructions.length} steps</Text></Text>
        <TouchableOpacity
          style={[styles.readAloud, a11y.speaking && styles.readAloudOn]}
          onPress={() => (a11y.speaking ? a11y.stop() : readRecipeAloud())}
          accessibilityRole="button"
          accessibilityLabel={a11y.speaking ? 'Stop reading the recipe aloud' : 'Read the recipe aloud'}
        >
          <FontAwesome name={a11y.speaking ? 'stop' : 'volume-up'} size={14} color={COLORS.darkNavy} />
          <Text style={styles.readAloudText}>{a11y.speaking ? 'Stop' : 'Read aloud'}</Text>
        </TouchableOpacity>
      </View>
      <Card style={styles.blockTight}>
        {recipe.instructions.map((step, i) => (
          <View key={i} style={[styles.stepRow, i === recipe.instructions.length - 1 && styles.noBorder]}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
            <Text style={[styles.stepText, a11y.text(14)]}>{step}</Text>
          </View>
        ))}
      </Card>
      {!hideInlineCookButton ? (
        <PrimaryButton
          label={isDrink ? 'Make it step by step' : 'Start guided cooking'}
          icon="play"
          onPress={() => setGuidedVisible(true)}
          style={{ marginTop: 12 }}
        />
      ) : null}
      {onOpenRecipe ? (
        <SecondaryButton label="Open the full recipe page" icon="book" onPress={onOpenRecipe} style={{ marginTop: 10 }} />
      ) : null}

      {/* PLATE BALANCE + MACROS (drinks: a per-glass line instead — a drink isn't a plate) */}
      {isDrink ? (
        <>
          <Text style={styles.sectionTitle}>Per glass</Text>
          <Card style={styles.blockPad}>
            {recipe.nutrition.calories > 0 ? (
              <Text style={styles.allergenLine}>
                About {Math.round(recipe.nutrition.calories)} calories · {Math.round(recipe.nutrition.carbs)} g carbs
                {recipe.nutrition.protein > 0 ? ` · ${Math.round(recipe.nutrition.protein)} g protein` : ''}
                . Drinks stay out of your meal picks and week plan.
              </Text>
            ) : (
              <Text style={styles.allergenLine}>Nutrition isn't calculated for this drink yet.</Text>
            )}
          </Card>
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Plate balance</Text>
          {recipe.nutrition.calories > 0 ? (
            <PlateVisualization plate={recipe.plate} nutrition={recipe.nutrition} />
          ) : (
            <Card style={styles.blockPad}>
              <Text style={styles.allergenLine}>Nutrition isn't calculated for home recipes shared by the community yet.</Text>
            </Card>
          )}
        </>
      )}
      {suggestion && !isDrink ? (
        <View style={styles.tipBox}>
          <FontAwesome name="lightbulb-o" size={14} color={COLORS.textGold} />
          <Text style={styles.tipText}>{suggestion}</Text>
        </View>
      ) : null}

      {/* FOR YOUR GOAL — only when a goal is set; one serving against this meal's share */}
      {goalView && !isDrink ? (
        <>
          <Text style={styles.sectionTitle}>For your goal · {GOAL_LABELS[goalView.kind]}</Text>
          <Card style={styles.blockPad}>
            <GoalBar label="Calories" value={Math.round(recipe.nutrition.calories)} target={goalView.target.calories} unit="" meal={goalView.mealLabel} />
            <GoalBar label="Protein" value={Math.round(recipe.nutrition.protein)} target={goalView.target.protein} unit=" g" meal={goalView.mealLabel} />
            {goalView.kind === 'performance' ? (
              <GoalBar label="Carbs" value={Math.round(recipe.nutrition.carbs)} target={goalView.target.carbs} unit=" g" meal={goalView.mealLabel} />
            ) : null}
            {goalView.fit.reason ? (
              <View style={styles.goalLine}>
                <FontAwesome name="check-circle" size={14} color={COLORS.green} />
                <Text style={[styles.goalLineText, { color: COLORS.green }]}>{goalView.fit.reason}</Text>
              </View>
            ) : null}
            {goalView.fit.portion ? (
              <View style={styles.goalLine}>
                <FontAwesome name="lightbulb-o" size={14} color={COLORS.textGold} />
                <Text style={styles.goalLineText}>{goalView.fit.portion}</Text>
              </View>
            ) : null}
            {goalView.focus.checks.length ? (
              <View style={styles.focusList}>
                <Text style={styles.focusTitle}>Your focuses</Text>
                {goalView.focus.checks.map(c => (
                  <View key={c.id} style={styles.focusRow}>
                    <FontAwesome name={c.hit ? 'check-circle' : 'plus-circle'} size={14} color={c.hit ? COLORS.green : COLORS.textGold} style={{ marginTop: 2 }} />
                    <Text style={styles.focusText}>
                      <Text style={{ fontWeight: '700', color: COLORS.darkNavy }}>{FOCUS_INFO[c.id].label}: </Text>
                      {c.hit ? c.reason : c.addTip}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.goalFine}>Per serving. Targets are estimates from your goal, not medical advice.</Text>
          </Card>
        </>
      ) : null}

      {/* GOOD TO KNOW */}
      {(() => {
        const mc = recipe.mayContain ?? [];
        const risky = new Set<string>([...recipe.allergens, ...mc]);
        const freeFrom = recipe.allergensVerified === false
          ? []
          : FREE_FROM_CHECK
              .filter(([id]) => !risky.has(id))
              .filter(([id]) => !(id === 'gluten' && dietChips.includes('gluten-free')) && !(id === 'dairy' && dietChips.includes('dairy-free')))
              .map(([, label]) => label);
        if (!dietChips.length && !freeFrom.length && !recipe.allergens.length && !mc.length) return null;
        return (
          <>
            <Text style={styles.sectionTitle}>Good to know</Text>
            <Card style={styles.blockPad}>
              {dietChips.length > 0 && (
                <View style={styles.chipRow}>
                  {dietChips.map(tag => <Pill key={tag} label={TAG_LABELS[tag] ?? tag.replace(/-/g, ' ')} tone="blue" />)}
                </View>
              )}
              {recipe.allergens.length > 0 && (
                <Text style={styles.allergenLine}>Contains: {recipe.allergens.join(', ').replace(/_/g, '-')}</Text>
              )}
              {mc.length > 0 && (
                <Text style={styles.allergenLine}>May contain: {mc.join(', ').replace(/_/g, '-')} (check labels)</Text>
              )}
              {freeFrom.length > 0 && <Text style={styles.freeLine}>Free from: {freeFrom.join(', ')}</Text>}
              {recipe.allergensVerified === false && (
                <Text style={styles.allergenLine}>Some ingredients weren't recognised, so this allergen list may be incomplete.</Text>
              )}
            </Card>
          </>
        );
      })()}

      <RecipeReviews
        recipeId={recipe.id}
        prompt={reviewPrompt}
        onPromptDismiss={() => setReviewPrompt(false)}
        onSummaryChange={handleReviewSummary}
        onLayout={handleReviewsLayout}
        innerRef={reviewsNode}
      />

      <GuidedCookingModal
        visible={guidedVisible}
        recipeName={recipe.name}
        recipeIngredients={recipe.ingredients}
        steps={guidedSteps}
        servingsFactor={factor}
        onClose={() => setGuidedVisible(false)}
        onFinish={() => {
          setGuidedVisible(false);
          setReviewPrompt(true);
        }}
      />
    </View>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof FontAwesome>['name']; text: string }) {
  return (
    <View style={styles.meta}>
      <FontAwesome name={icon} size={13} color={COLORS.textMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

// ============================================
// GUIDED COOKING — dark, one step per screen
// ============================================

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function GuidedCookingModal({
  visible,
  recipeName,
  recipeIngredients,
  steps,
  servingsFactor,
  onClose,
  onFinish,
}: {
  visible: boolean;
  recipeName: string;
  recipeIngredients: Recipe['ingredients'];
  steps: ReturnType<typeof buildGuidedSteps>;
  servingsFactor: number;
  onClose: () => void;
  onFinish: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tipsVisible, setTipsVisible] = useState(false);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const a11y = useAccessibility();
  const step = steps[currentStep];
  const tips = step ? getGuidedStepTips(step.instruction, recipeName, recipeIngredients) : [];

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setTimerEnd(null);
    }
  }, [visible, recipeName]);

  useEffect(() => {
    if (!visible || tipsVisible) a11y.stop();
    setTimerEnd(null);
  }, [a11y.stop, currentStep, tipsVisible, visible]);

  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timerEnd]);

  if (!step) return null;
  const lastStep = currentStep === steps.length - 1;
  const minutesLeft = steps.slice(currentStep).reduce((n, s) => n + (s.durationMinutes ?? 0), 0);
  const remainingMs = timerEnd ? Math.max(0, timerEnd - now) : null;
  const timerDone = remainingMs === 0;
  if (timerDone && timerEnd) {
    // Fire once: clear the timer so the haptic doesn't repeat every tick.
    setTimeout(() => setTimerEnd(null), 0);
    a11y.haptic('success');
  }

  const readStep = () => a11y.speak([
    `Step ${currentStep + 1}. ${step.instruction}`,
    ...(step.explanation ? [`What this means. ${step.explanation}`] : []),
    ...(step.ingredients?.length ? [`Measurements. ${step.ingredients.map(i => `${scaleAmount(i.amount ?? '', servingsFactor)} ${formatGuidedIngredientName(i)}`).join(', ')}`] : []),
    ...(step.cue ? [`Tip. ${step.cue}`] : []),
  ]);

  return (
    <Modal
      visible={visible}
      animationType={a11y.reduceMotion ? 'fade' : 'slide'}
      onRequestClose={() => (tipsVisible ? setTipsVisible(false) : onClose())}
    >
      <SafeAreaView style={g.safe}>
        {tipsVisible ? (
          <GuidedStepTipsPage
            recipeName={recipeName}
            instruction={step.instruction}
            tips={tips}
            onBack={() => setTipsVisible(false)}
          />
        ) : (
          <>
            <View style={g.header}>
              <TouchableOpacity style={g.roundBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close guided cooking">
                <FontAwesome name="times" size={18} color={COLORS.cardWhite} />
              </TouchableOpacity>
              <View style={g.headerMid}>
                <Text style={g.eyebrow}>Guided cooking</Text>
                <Text style={g.headerSub} numberOfLines={1}>{recipeName}</Text>
              </View>
              <TouchableOpacity style={g.roundBtn} onPress={() => setTipsVisible(true)} accessibilityRole="button" accessibilityLabel={`Helpful tips for step ${currentStep + 1}`}>
                <FontAwesome name="lightbulb-o" size={18} color={COLORS.goldYellow} />
              </TouchableOpacity>
            </View>

            <View style={g.progressWrap}>
              <View style={g.progressLabels}>
                <Text style={g.progressText}>Step {currentStep + 1} of {steps.length}</Text>
                {minutesLeft > 0 ? <Text style={g.progressText}>About {minutesLeft} min left</Text> : null}
              </View>
              <View style={g.track}><View style={[g.fill, { width: `${((currentStep + 1) / steps.length) * 100}%` }]} /></View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={g.body} showsVerticalScrollIndicator={false}>
              <View style={g.stepBadge}><Text style={g.stepBadgeText}>{currentStep + 1}</Text></View>
              <Text style={[g.instruction, a11y.text(26, '600')]}>{step.instruction}</Text>

              {step.explanation ? (
                <View style={g.panel}>
                  <Text style={g.panelTitle}>What this means</Text>
                  <Text style={[g.panelText, a11y.text(14)]}>{step.explanation}</Text>
                </View>
              ) : null}

              {step.ingredients?.length ? (
                <View style={g.panel}>
                  <Text style={g.panelTitle}>For this step</Text>
                  {step.ingredients.map(ingredient => (
                    <View key={`${ingredient.name}-${ingredient.amount}`} style={g.measureRow}>
                      <Text style={[g.measureAmount, a11y.text(15, '800')]}>{scaleAmount(ingredient.amount?.trim() ?? '', servingsFactor) || '—'}</Text>
                      <Text style={[g.measureName, a11y.text(15)]}>{formatGuidedIngredientName(ingredient)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {step.cue ? (
                <View style={g.panel}>
                  <Text style={g.panelTitle}>Tip</Text>
                  <Text style={[g.panelText, a11y.text(14)]}>{step.cue}</Text>
                </View>
              ) : null}

              {step.durationMinutes ? (
                <TouchableOpacity
                  style={[g.timer, remainingMs !== null && g.timerOn]}
                  onPress={() => setTimerEnd(remainingMs !== null ? null : Date.now() + step.durationMinutes! * 60000)}
                  accessibilityRole="button"
                  accessibilityLabel={remainingMs !== null ? 'Cancel timer' : `Start ${step.durationMinutes} minute timer`}
                >
                  <FontAwesome name={remainingMs !== null ? 'stop-circle-o' : 'clock-o'} size={20} color={COLORS.darkNavy} />
                  <Text style={g.timerText}>
                    {remainingMs !== null
                      ? `${pad(Math.floor(remainingMs / 60000))}:${pad(Math.floor((remainingMs % 60000) / 1000))} · tap to cancel`
                      : `Start ${step.durationMinutes}-minute timer`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>

            <View style={g.footer}>
              <View style={g.toolRow}>
                <TouchableOpacity
                  style={[g.tool, a11y.speaking && g.toolOn]}
                  onPress={() => (a11y.speaking ? a11y.stop() : readStep())}
                  accessibilityRole="button"
                  accessibilityLabel={a11y.speaking ? 'Stop reading this step' : 'Read this step aloud'}
                >
                  <FontAwesome name={a11y.speaking ? 'stop' : 'volume-up'} size={14} color={COLORS.cardWhite} />
                  <Text style={g.toolText}>{a11y.speaking ? 'Stop' : 'Read this step'}</Text>
                </TouchableOpacity>
              </View>
              <View style={g.navRow}>
                <TouchableOpacity
                  style={[g.back, currentStep === 0 && g.disabled]}
                  onPress={() => setCurrentStep(i => Math.max(0, i - 1))}
                  disabled={currentStep === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Previous cooking step"
                >
                  <FontAwesome name="chevron-left" size={13} color={COLORS.cardWhite} />
                  <Text style={g.backText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={g.next}
                  onPress={() => (lastStep ? onFinish() : setCurrentStep(i => i + 1))}
                  accessibilityRole="button"
                  accessibilityLabel={lastStep ? 'Finish cooking' : 'Next cooking step'}
                >
                  <Text style={g.nextText}>{lastStep ? 'Finish' : 'Next step'}</Text>
                  <FontAwesome name={lastStep ? 'check' : 'chevron-right'} size={13} color={COLORS.darkNavy} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function GuidedStepTipsPage({
  recipeName,
  instruction,
  tips,
  onBack,
}: {
  recipeName: string;
  instruction: string;
  tips: ReturnType<typeof getGuidedStepTips>;
  onBack: () => void;
}) {
  return (
    <View style={g.tipsPage}>
      <View style={g.header}>
        <TouchableOpacity style={g.roundBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to cooking step">
          <FontAwesome name="arrow-left" size={16} color={COLORS.cardWhite} />
        </TouchableOpacity>
        <View style={g.headerMid}><Text style={g.eyebrow}>Step tips</Text></View>
        <View style={g.roundBtn} />
      </View>
      <ScrollView contentContainerStyle={g.tipsContent} showsVerticalScrollIndicator={false}>
        <Text style={g.tipsRecipe}>{recipeName}</Text>
        <Text style={g.tipsInstruction}>{instruction}</Text>
        {tips.map((tip, index) => (
          <View key={`${tip.title}-${index}`} style={g.tipCard}>
            <Text style={g.tipNumber}>TIP {index + 1}</Text>
            <Text style={g.tipTitle}>{tip.title}</Text>
            <Text style={g.tipDetail}>{tip.detail}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

function GoalBar({ label, value, target, unit, meal }: { label: string; value: number; target: number; unit: string; meal: string }) {
  const ratio = target > 0 ? value / target : 0;
  const over = ratio > 1.15;
  const width = `${Math.min(100, Math.round(ratio * 100))}%` as const;
  return (
    <View style={styles.goalBarWrap} accessibilityLabel={`${label}: ${value}${unit} of about ${target}${unit} for ${meal}`}>
      <View style={styles.goalBarHead}>
        <Text style={styles.goalBarLabel}>{label}</Text>
        <Text style={styles.goalBarNums}>
          <Text style={{ fontWeight: '800', color: over ? COLORS.textGold : COLORS.darkNavy }}>{value}{unit}</Text> of ~{target}{unit} for {meal}
        </Text>
      </View>
      <View style={styles.goalTrack}><View style={[styles.goalFill, { width }, over && { backgroundColor: COLORS.goldYellow }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  goalBarWrap: { gap: 6, marginBottom: 12 },
  goalBarHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  goalBarLabel: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },
  goalBarNums: { fontSize: 12.5, color: COLORS.textMuted },
  goalTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.lightBlueBg, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.green },
  goalLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 2, marginBottom: 6 },
  goalLineText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.textDark },
  goalFine: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 4 },
  focusList: { marginTop: 6, marginBottom: 8, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.background, paddingTop: 12 },
  focusTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: COLORS.textMuted },
  focusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  focusText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.textDark },
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.lightYellow, borderWidth: 1, borderColor: COLORS.yellowBorder,
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  noteText: { flex: 1, fontSize: 13, color: COLORS.textDark, lineHeight: 18 },
  warnBox: {
    backgroundColor: COLORS.redSoft, borderColor: COLORS.redText, borderWidth: 1,
    borderRadius: 14, padding: 14, marginBottom: 14, gap: 4,
  },
  warnTitle: { fontSize: 15, fontWeight: '700', color: COLORS.redText, marginBottom: 2 },
  warnText: { fontSize: 14, color: COLORS.textDark },

  hero: { borderRadius: 22, overflow: 'hidden', marginBottom: 14 },
  heroImage: { width: '100%', height: 220, backgroundColor: COLORS.tileSand },
  heroTag: { position: 'absolute', top: 12, right: 12 },

  titleBlock: { gap: 10 },
  heroMeals: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10,
    borderRadius: 16, backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  ratingText: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeSplitText: { fontSize: 12, color: COLORS.textMuted },

  block: { marginTop: 16, padding: 16 },
  blockTight: { paddingHorizontal: 16, paddingVertical: 4 },
  blockPad: { padding: 16, gap: 8 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6, flexWrap: 'wrap' },
  blockTitle: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  blockSub: { fontSize: 13, fontWeight: '500', color: COLORS.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: 12, padding: 2 },
  stepBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F6FD', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 18, fontWeight: '800', color: COLORS.darkNavy, lineHeight: 20 },
  stepValue: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy, minWidth: 78, textAlign: 'center' },

  ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.goldYellow, marginRight: 12 },
  ingName: { flex: 1, fontSize: 14, color: COLORS.darkNavy, textTransform: 'capitalize' },
  optional: { fontSize: 12, color: COLORS.textMuted, textTransform: 'none', fontWeight: '400' },
  ingAmount: { fontSize: 13, color: COLORS.textMuted, marginLeft: 10 },
  ingMissing: { color: COLORS.redText, fontWeight: '700' },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  addedText: { fontSize: 13, color: COLORS.green, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy, marginTop: 22, marginBottom: 10 },
  stepsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readAloud: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 14, backgroundColor: COLORS.lightYellow, borderWidth: 1, borderColor: COLORS.yellowBorder, marginTop: 12,
  },
  readAloudOn: { backgroundColor: COLORS.goldYellow },
  readAloudText: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.lightYellow, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1 },
  stepNumText: { fontSize: 12, fontWeight: '800', color: COLORS.textGold },
  stepText: { flex: 1, fontSize: 14, color: COLORS.darkNavy, lineHeight: 21 },
  noBorder: { borderBottomWidth: 0 },

  tipBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.lightYellow,
    borderWidth: 1, borderColor: COLORS.yellowBorder, borderRadius: 12, padding: 12, marginTop: 10,
  },
  tipText: { flex: 1, fontSize: 13, color: COLORS.textDark, lineHeight: 18 },
  allergenLine: { fontSize: 12, color: COLORS.redText, textTransform: 'capitalize' },
  freeLine: { fontSize: 12, color: COLORS.green, textTransform: 'capitalize' },
});

const g = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.darkNavy },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  headerMid: { flex: 1, alignItems: 'center', gap: 1 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '700', color: COLORS.goldYellow, letterSpacing: 0.6, textTransform: 'uppercase' },
  headerSub: { fontSize: 13, color: COLORS.navyMuted, fontWeight: '500', maxWidth: 240 },

  progressWrap: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 13, fontWeight: '600', color: COLORS.navyMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.goldYellow },

  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 18, maxWidth: 680, width: '100%', alignSelf: 'center' },
  stepBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.goldYellow, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { fontSize: 20, fontWeight: '800', color: COLORS.darkNavy },
  instruction: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 26, lineHeight: 36, color: COLORS.cardWhite },
  panel: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, gap: 8 },
  panelTitle: { fontSize: 12, fontWeight: '800', color: COLORS.goldYellow, letterSpacing: 0.5, textTransform: 'uppercase' },
  panelText: { fontSize: 14, lineHeight: 21, color: COLORS.cardWhite },
  measureRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  measureAmount: { width: 82, fontSize: 15, fontWeight: '800', color: COLORS.cardWhite },
  measureName: { flex: 1, fontSize: 15, color: COLORS.cardWhite },
  timer: { minHeight: 56, borderRadius: 16, backgroundColor: COLORS.cardWhite, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  timerOn: { backgroundColor: COLORS.goldYellow },
  timerText: { fontSize: 16, fontWeight: '800', color: COLORS.darkNavy },

  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18, gap: 12 },
  toolRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  tool: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', flexDirection: 'row', alignItems: 'center', gap: 7 },
  toolOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  toolText: { fontSize: 13, fontWeight: '700', color: COLORS.cardWhite },
  navRow: { flexDirection: 'row', gap: 10 },
  back: { height: 56, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 15, fontWeight: '700', color: COLORS.cardWhite },
  disabled: { opacity: 0.45 },
  next: { flex: 1, height: 56, borderRadius: 16, backgroundColor: COLORS.goldYellow, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextText: { fontSize: 16, fontWeight: '800', color: COLORS.darkNavy },

  tipsPage: { flex: 1 },
  tipsContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 28, gap: 12 },
  tipsRecipe: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, lineHeight: 30, color: COLORS.cardWhite, marginTop: 10 },
  tipsInstruction: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: COLORS.navyMuted, marginBottom: 6 },
  tipCard: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  tipNumber: { fontSize: 11, fontWeight: '800', color: COLORS.goldYellow },
  tipTitle: { marginTop: 5, fontSize: 16, fontWeight: '800', color: COLORS.cardWhite },
  tipDetail: { marginTop: 6, fontSize: 14, lineHeight: 21, color: COLORS.cardWhite },
});
