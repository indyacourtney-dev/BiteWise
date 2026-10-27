// components/RecipeDetail.tsx
//
// The full recipe view. The This or That result, Plan my week and the
// recipe page all render this, so a recipe looks identical no matter how
// the user arrived at it. Add a field here once and every screen picks it up.

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import PlateVisualization from './PlateVisualization';
import { COLORS } from '../constants/Colors';
import { formatTime, getTotalTime, DIFFICULTY_LABELS } from '../constants/recipes';
import { MEAL_INFO, getMealTypes } from '../utils/meals';
import { findCustomConflicts } from '../utils/customFoods';
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
  /**
   * When provided, renders a "See full recipe" button under the plate
   * breakdown that opens this meal on its own screen. Used on the quiz
   * result, where people expect a button rather than a long scroll.
   * Omitted on the recipe screen itself — it's already the full recipe.
   */
  onOpenRecipe?: () => void;
}

export default function RecipeDetail({
  recipe,
  matchScore,
  suggestion,
  note,
  onOpenRecipe,
}: Props) {
  // Safety net for recipes opened directly (a chat card, an old favorite):
  // say clearly if it conflicts with the user's allergies or foods to avoid.
  const { preferences } = useApp();
  const a11y = useAccessibility();
  const [guidedVisible, setGuidedVisible] = useState(false);
  const guidedSteps = useMemo(() => buildGuidedSteps(recipe.instructions, recipe.ingredients), [recipe.instructions, recipe.ingredients]);
  const readRecipeAloud = () => {
    const utterances = buildRecipeReadAloudParts(recipe);
    if (__DEV__) {
      console.debug('[BiteWise Read Aloud] ingredient fields', getReadAloudIngredientFields(recipe.ingredients));
      console.debug('[BiteWise Read Aloud] exact utterance queue', utterances);
    }
    a11y.speak(utterances);
  };
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

  return (
    <View>
      {allergyWarnings.length > 0 ? (
        <View style={styles.warnBox} accessibilityRole="alert">
          <Text style={styles.warnTitle}>⚠️ Not safe for your allergies</Text>
          {allergyWarnings.map(w => <Text key={w} style={styles.warnText}>• {w}</Text>)}
        </View>
      ) : null}
      {custom.avoid.length > 0 ? (
        <View style={styles.noteBox}>
          <FontAwesome name="info-circle" size={14} color="#D46B08" />
          <Text style={styles.noteText}>Has {custom.avoid.join(', ')}, which you said you'd rather avoid.</Text>
        </View>
      ) : null}
      {note ? (
        <View style={styles.noteBox}>
          <FontAwesome name="info-circle" size={14} color="#D46B08" />
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}

      {/* HERO */}
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>{recipe.emoji}</Text>
        <Text style={styles.heroName}>{recipe.name}</Text>
        {typeof matchScore === 'number' ? (
          <View style={styles.matchPill}>
            <Text style={styles.matchPillText}>{matchScore}% match</Text>
          </View>
        ) : null}
        <Text style={styles.heroMeals}>
          {getMealTypes(recipe).map(m => `${MEAL_INFO[m].emoji} ${MEAL_INFO[m].label}`).join('   ')}
        </Text>
        {recipe.source === 'community' ? (
          <Text style={styles.heroCredit}>
            🏠 Home recipe{recipe.authorName ? ` shared by ${recipe.authorName}` : ''}
          </Text>
        ) : null}
        {(recipe.favoriteCount ?? 0) > 0 ? (
          <Text style={styles.heroCredit}>
            ❤️ Saved by {recipe.favoriteCount} BiteWise cook{recipe.favoriteCount === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      {/* AT A GLANCE */}
      <View style={styles.statsRow}>
        <Stat icon="clock-o" label="Total" value={formatTime(getTotalTime(recipe))} />
        <Stat icon="signal" label="Level" value={DIFFICULTY_LABELS[recipe.difficulty]} />
        <Stat icon="users" label="Serves" value={`${recipe.servings}`} />
      </View>

      <View style={styles.timeSplit}>
        <Text style={styles.timeSplitText}>
          {recipe.prepMinutes} min prep · {recipe.cookMinutes} min cook
        </Text>
      </View>

      {/* PLATE BALANCE + MACROS */}
      <Text style={styles.sectionTitle}>Plate balance</Text>
      {recipe.nutrition.calories > 0 ? (
        <PlateVisualization plate={recipe.plate} nutrition={recipe.nutrition} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.allergenLine}>
            Nutrition isn't calculated for home recipes shared by the community yet.
          </Text>
        </View>
      )}
      {suggestion ? (
        <View style={[styles.card, styles.tipCard]}>
          <View style={styles.tipBox}>
            <FontAwesome name="lightbulb-o" size={14} color="#D46B08" />
            <Text style={styles.tipText}>{suggestion}</Text>
          </View>
        </View>
      ) : null}

      {/* JUMP TO FULL RECIPE */}
      {onOpenRecipe ? (
        <TouchableOpacity
          style={styles.openRecipeBtn}
          onPress={onOpenRecipe}
          activeOpacity={0.85}
        >
          <FontAwesome name="book" size={15} color={COLORS.darkNavy} />
          <View style={styles.flex1}>
            <Text style={styles.openRecipeTitle}>See the full recipe</Text>
            <Text style={styles.openRecipeSub}>
              {recipe.ingredients.length} ingredients · {recipe.instructions.length} steps
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={13} color={COLORS.darkGold} />
        </TouchableOpacity>
      ) : null}

      {/* INGREDIENTS */}
      <Text style={styles.sectionTitle}>
        Ingredients <Text style={styles.sectionCount}>({recipe.ingredients.length})</Text>
      </Text>
      <View style={styles.card}>
        {recipe.ingredients.map((ing, i) => (
          <View
            key={`${ing.name}-${i}`}
            style={[styles.ingRow, i === recipe.ingredients.length - 1 && styles.noBorder]}
          >
            <View style={styles.bullet} />
            <Text style={[styles.ingName, a11y.text(14, '600')]}>
              {ing.name}
              {ing.optional ? <Text style={styles.optional}> · optional</Text> : null}
            </Text>
            <Text style={[styles.ingAmount, a11y.text(13)]}>{ing.amount}</Text>
          </View>
        ))}
      </View>

      {/* STEPS — with Read aloud (Settings → Accessibility sets the speed) */}
      <View style={styles.stepsHeader}>
        <Text style={[styles.sectionTitle, styles.stepsTitle]}>How to make it</Text>
        <TouchableOpacity
          style={[styles.readAloud, a11y.speaking && styles.readAloudOn]}
          onPress={() =>
            a11y.speaking
              ? a11y.stop()
              : readRecipeAloud()
          }
          accessibilityRole="button"
          accessibilityLabel={a11y.speaking ? 'Stop reading the recipe aloud' : 'Read the recipe aloud'}
        >
          <FontAwesome name={a11y.speaking ? 'stop' : 'volume-up'} size={14} color={COLORS.darkNavy} />
          <Text style={styles.readAloudText}>{a11y.speaking ? 'Stop' : 'Read aloud'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        {recipe.instructions.map((step, i) => (
          <View
            key={i}
            style={[styles.stepRow, i === recipe.instructions.length - 1 && styles.noBorder]}
          >
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepText, a11y.text(14)]}>{step}</Text>
          </View>
        ))}
      </View>
      <View style={styles.guidedButtonRow}>
        <TouchableOpacity
          style={styles.guidedButton}
          onPress={() => setGuidedVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Start guided cooking for ${recipe.name}`}
        >
          <FontAwesome name="play" size={13} color={COLORS.cardWhite} />
          <Text style={styles.guidedButtonText}>Start guided cooking</Text>
        </TouchableOpacity>
      </View>
      <GuidedCookingModal
        visible={guidedVisible}
        recipeName={recipe.name}
        recipeIngredients={recipe.ingredients}
        steps={guidedSteps}
        onClose={() => setGuidedVisible(false)}
      />

      {/* DIETARY */}
      {(() => {
        const chips = CHIP_TAGS.filter(t => (recipe.dietary as string[]).includes(t));
        const mayContain = recipe.mayContain ?? [];
        const risky = new Set<string>([...recipe.allergens, ...mayContain]);
        const freeFrom = recipe.allergensVerified === false
          ? []
          : FREE_FROM_CHECK
              .filter(([id]) => !risky.has(id))
              // gluten-free / dairy-free already show as chips
              .filter(([id]) => !(id === 'gluten' && chips.includes('gluten-free')) && !(id === 'dairy' && chips.includes('dairy-free')))
              .map(([, label]) => label);
        if (!chips.length && !freeFrom.length && !recipe.allergens.length && !mayContain.length) return null;
        return (
          <>
            <Text style={styles.sectionTitle}>Good to know</Text>
            <View style={styles.card}>
              {chips.length > 0 && (
                <View style={styles.chipRow}>
                  {chips.map(tag => (
                    <View key={tag} style={styles.chip}>
                      <Text style={styles.chipText}>{TAG_LABELS[tag] ?? tag.replace(/-/g, ' ')}</Text>
                    </View>
                  ))}
                </View>
              )}
              {recipe.allergens.length > 0 && (
                <Text style={styles.allergenLine}>Contains: {recipe.allergens.join(', ').replace(/_/g, '-')}</Text>
              )}
              {mayContain.length > 0 && (
                <Text style={styles.allergenLine}>
                  May contain: {mayContain.join(', ').replace(/_/g, '-')} (check labels)
                </Text>
              )}
              {freeFrom.length > 0 && (
                <Text style={styles.allergenLine}>Free from: {freeFrom.join(', ')}</Text>
              )}
              {recipe.allergensVerified === false && (
                <Text style={styles.allergenLine}>
                  Some ingredients weren't recognised, so this allergen list may be incomplete.
                </Text>
              )}
            </View>
          </>
        );
      })()}
    </View>
  );
}

function GuidedCookingModal({
  visible,
  recipeName,
  recipeIngredients,
  steps,
  onClose,
}: {
  visible: boolean;
  recipeName: string;
  recipeIngredients: Recipe['ingredients'];
  steps: ReturnType<typeof buildGuidedSteps>;
  onClose: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tipsVisible, setTipsVisible] = useState(false);
  const a11y = useAccessibility();
  const step = steps[currentStep];
  const tips = step ? getGuidedStepTips(step.instruction, recipeName, recipeIngredients) : [];

  useEffect(() => {
    if (visible) setCurrentStep(0);
  }, [visible, recipeName]);

  useEffect(() => {
    if (!visible || tipsVisible) a11y.stop();
  }, [a11y.stop, currentStep, tipsVisible, visible]);

  if (!step) return null;
  const lastStep = currentStep === steps.length - 1;

  return (
    <Modal
      visible={visible}
      animationType={a11y.reduceMotion ? 'fade' : 'slide'}
      onRequestClose={() => tipsVisible ? setTipsVisible(false) : onClose()}
    >
      <SafeAreaView style={styles.guideSafeArea}>
        {tipsVisible ? (
          <GuidedStepTipsPage
            recipeName={recipeName}
            instruction={step.instruction}
            tips={tips}
            onBack={() => setTipsVisible(false)}
          />
        ) : (
          <>
            <View style={styles.guideHeader}>
              <TouchableOpacity
                style={styles.guideClose}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close guided cooking"
              >
                <FontAwesome name="times" size={18} color={COLORS.darkNavy} />
              </TouchableOpacity>
              <Text style={styles.guideEyebrow}>GUIDED COOKING</Text>
              <View style={styles.guideCloseSpacer} />
            </View>

            <View style={styles.guideContent}>
              <Text style={styles.guideMainRecipeName}>{recipeName}</Text>
              <View style={styles.guideMainTitleDivider} />
              <View style={styles.guideStepHeader}>
                <Text style={styles.guideStepCount}>Step {currentStep + 1} of {steps.length}</Text>
                <View style={styles.guideStepTools}>
                  <TouchableOpacity
                    style={[styles.guideReadButton, a11y.speaking && styles.guideReadButtonOn]}
                    onPress={() => a11y.speaking ? a11y.stop() : a11y.speak([
                      `Step ${currentStep + 1}. ${step.instruction}`,
                      ...(step.explanation ? [`What this means. ${step.explanation}`] : []),
                      ...(step.ingredients?.length ? [`Measurements. ${step.ingredients.map(formatGuidedIngredientName).join(', ')}`] : []),
                      ...(step.cue ? [`Tip. ${step.cue}`] : []),
                    ])}
                    accessibilityRole="button"
                    accessibilityLabel={a11y.speaking ? 'Stop reading this step' : 'Read this step aloud'}
                  >
                    <FontAwesome name={a11y.speaking ? 'stop' : 'volume-up'} size={15} color={COLORS.darkNavy} />
                    <Text style={styles.guideReadButtonText}>{a11y.speaking ? 'Stop' : 'Read aloud'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.guideTipsButton}
                    onPress={() => setTipsVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Helpful tips for step ${currentStep + 1}`}
                  >
                    <FontAwesome name="lightbulb-o" size={18} color={COLORS.darkGold} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.guideProgressTrack}>
                <View style={[styles.guideProgressFill, { width: `${((currentStep + 1) / steps.length) * 100}%` }]} />
              </View>

              <ScrollView
                style={styles.guideStepBody}
                contentContainerStyle={styles.guideStepBodyContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.guideStepNumber}>
                  <Text style={styles.guideStepNumberText}>{currentStep + 1}</Text>
                </View>
                {step.durationMinutes ? (
                  <Text style={styles.guideDuration}>About {step.durationMinutes} minutes</Text>
                ) : null}
                <Text style={styles.guideInstruction}>{step.instruction}</Text>
                {step.explanation ? (
                  <View style={styles.guideExplanation}>
                    <FontAwesome name="info-circle" size={16} color={COLORS.darkGold} />
                    <View style={styles.guideExplanationContent}>
                      <Text style={styles.guideExplanationTitle}>What this means</Text>
                      <Text style={styles.guideExplanationText}>{step.explanation}</Text>
                    </View>
                  </View>
                ) : null}
                {step.ingredients?.length ? (
                  <View style={styles.guideMeasurements}>
                    <Text style={styles.guideMeasurementsTitle}>Measurements</Text>
                    <View style={styles.guideMeasurementsList}>
                      {step.ingredients.map(ingredient => (
                        <View key={`${ingredient.name}-${ingredient.amount}`} style={styles.guideMeasurementRow}>
                          <Text style={styles.guideMeasurementAmount}>{ingredient.amount?.trim() || 'Not listed'}</Text>
                          <Text style={styles.guideMeasurementName}>{formatGuidedIngredientName(ingredient)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
                {step.cue ? (
                  <View style={styles.guideCue}>
                    <FontAwesome name="lightbulb-o" size={16} color={COLORS.darkGold} />
                    <Text style={styles.guideCueText}>{step.cue}</Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>

            <View style={styles.guideFooter}>
              <TouchableOpacity
                style={[styles.guideBackButton, currentStep === 0 && styles.guideDisabled]}
                onPress={() => setCurrentStep(index => Math.max(0, index - 1))}
                disabled={currentStep === 0}
                accessibilityRole="button"
                accessibilityLabel="Previous cooking step"
              >
                <FontAwesome name="chevron-left" size={13} color={COLORS.darkNavy} />
                <Text style={styles.guideBackText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.guideNextButton}
                onPress={() => lastStep ? onClose() : setCurrentStep(index => index + 1)}
                accessibilityRole="button"
                accessibilityLabel={lastStep ? 'Finish cooking' : 'Next cooking step'}
              >
                <Text style={styles.guideNextText}>{lastStep ? 'Finish' : 'Next step'}</Text>
                <FontAwesome name={lastStep ? 'check' : 'chevron-right'} size={13} color={COLORS.cardWhite} />
              </TouchableOpacity>
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
    <View style={styles.guideTipsPage}>
      <View style={styles.guideHeader}>
        <TouchableOpacity
          style={styles.guideClose}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to cooking step"
        >
          <FontAwesome name="arrow-left" size={16} color={COLORS.darkNavy} />
        </TouchableOpacity>
        <Text style={styles.guideEyebrow}>STEP TIPS</Text>
        <View style={styles.guideCloseSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.guideTipsContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.guideTipsRecipeName}>{recipeName}</Text>
        <View style={styles.guideTipsDivider} />
        <Text style={styles.guideTipsInstruction}>{instruction}</Text>
        {tips.map((tip, index) => (
          <View key={`${tip.title}-${index}`} style={styles.guideTipCard}>
            <Text style={styles.guideTipNumber}>TIP {index + 1}</Text>
            <Text style={styles.guideTipTitle}>{tip.title}</Text>
            <Text style={styles.guideTipDetail}>{tip.detail}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <FontAwesome name={icon} size={15} color={COLORS.darkGold} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },

  openRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.lightYellow,
    borderWidth: 1,
    borderColor: COLORS.goldYellow,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 14,
  },
  openRecipeTitle: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  openRecipeSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7E6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noteText: { flex: 1, fontSize: 13, color: '#8C5A0B', lineHeight: 18 },

  hero: { alignItems: 'center', paddingVertical: 8, marginBottom: 16 },
  warnBox: {
    backgroundColor: '#FDECEA',
    borderColor: COLORS.redAccent,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 4,
  },
  warnTitle: { fontSize: 15, fontWeight: '700', color: COLORS.redAccent, marginBottom: 2 },
  warnText: { fontSize: 14, color: COLORS.textDark },
  heroMeals: { marginTop: 10, fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  heroCredit: { marginTop: 4, fontSize: 13, color: COLORS.darkGold, fontWeight: '600' },
  heroEmoji: { fontSize: 64, marginBottom: 8 },
  heroName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.darkNavy,
    textAlign: 'center',
    lineHeight: 31,
  },
  matchPill: {
    marginTop: 10,
    backgroundColor: COLORS.lightYellow,
    borderWidth: 1,
    borderColor: COLORS.goldYellow,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  matchPillText: { fontSize: 13, fontWeight: '700', color: COLORS.darkGold },

  statsRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.cardWhite,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statValue: { marginTop: 6, fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  statLabel: { marginTop: 2, fontSize: 11, color: COLORS.textMuted },

  timeSplit: { alignItems: 'center', marginTop: 10 },
  timeSplitText: { fontSize: 12, color: COLORS.textMuted },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.darkNavy,
    marginTop: 26,
    marginBottom: 10,
  },
  sectionCount: { fontSize: 13, fontWeight: '400', color: COLORS.textMuted },

  card: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.goldYellow,
    marginRight: 12,
  },
  ingName: { flex: 1, fontSize: 14, color: COLORS.darkNavy, textTransform: 'capitalize' },
  optional: { fontSize: 12, color: COLORS.textMuted, textTransform: 'none' },
  ingAmount: { fontSize: 13, color: COLORS.textMuted, marginLeft: 10 },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.lightYellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  stepNumText: { fontSize: 12, fontWeight: '700', color: COLORS.darkGold },
  stepText: { flex: 1, fontSize: 14, color: COLORS.darkNavy, lineHeight: 21 },
  stepsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepsTitle: { flex: 1 },
  readAloud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.lightYellow,
    borderWidth: 1,
    borderColor: COLORS.goldYellow,
  },
  readAloudOn: { backgroundColor: COLORS.goldYellow },
  readAloudText: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },
  guidedButtonRow: { alignItems: 'flex-end', marginTop: 12 },
  guidedButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.darkNavy,
  },
  guidedButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.cardWhite },

  guideSafeArea: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'space-between' },
  guideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  guideClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
  },
  guideEyebrow: { fontSize: 12, fontWeight: '800', color: COLORS.darkGold },
  guideCloseSpacer: { width: 40, height: 40 },
  guideContent: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 20 },
  guideRecipeName: { fontSize: 18, fontWeight: '700', color: COLORS.darkNavy },
  guideMainRecipeName: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 25, lineHeight: 32, color: COLORS.darkNavy },
  guideMainTitleDivider: { height: 1, backgroundColor: COLORS.borderLight, marginTop: 12 },
  guideStepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  guideStepCount: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  guideStepTools: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guideReadButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
  },
  guideReadButtonOn: { backgroundColor: COLORS.lightYellow, borderColor: '#DCCB72' },
  guideReadButtonText: { fontSize: 12, fontWeight: '700', color: COLORS.darkNavy },
  guideTipsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCCB72',
    backgroundColor: COLORS.lightYellow,
  },
  guideProgressTrack: { height: 5, overflow: 'hidden', marginTop: 10, borderRadius: 3, backgroundColor: COLORS.borderLight },
  guideProgressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.darkGold },
  guideStepBody: { flex: 1 },
  guideStepBodyContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 32 },
  guideStepNumber: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderRadius: 22,
    backgroundColor: COLORS.lightYellow,
  },
  guideStepNumberText: { fontSize: 18, fontWeight: '800', color: COLORS.darkGold },
  guideDuration: { marginBottom: 12, fontSize: 13, fontWeight: '700', color: COLORS.darkGold },
  guideInstruction: { fontSize: 25, lineHeight: 36, fontWeight: '700', color: COLORS.darkNavy },
  guideExplanation: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: COLORS.lightYellow },
  guideExplanationContent: { flex: 1 },
  guideExplanationTitle: { fontSize: 13, fontWeight: '800', color: COLORS.darkGold },
  guideExplanationText: { marginTop: 4, fontSize: 14, lineHeight: 21, color: COLORS.darkNavy },
  guideMeasurements: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.cardWhite },
  guideMeasurementsTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.darkGold,
    marginBottom: 8,
  },
  guideMeasurementsList: { gap: 6 },
  guideMeasurementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guideMeasurementAmount: { width: 82, fontSize: 14, lineHeight: 20, fontWeight: '800', color: COLORS.darkNavy },
  guideMeasurementName: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.darkNavy },
  guideCue: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 22, padding: 14, borderRadius: 12, backgroundColor: COLORS.lightYellow },
  guideCueText: { flex: 1, fontSize: 14, lineHeight: 21, color: COLORS.darkNavy },
  guideFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  guideBackButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
  },
  guideDisabled: { opacity: 0.45 },
  guideBackText: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  guideNextButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 260,
    borderRadius: 12,
    backgroundColor: COLORS.darkNavy,
  },
  guideNextText: { fontSize: 14, fontWeight: '700', color: COLORS.cardWhite },
  guideTipsPage: { flex: 1, backgroundColor: COLORS.background },
  guideTipsContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 28 },
  guideTipsRecipeName: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 25, lineHeight: 32, color: COLORS.darkNavy, marginTop: 14, marginBottom: 12 },
  guideTipsDivider: { height: 1, backgroundColor: COLORS.borderLight, marginBottom: 18 },
  guideTipsInstruction: { marginTop: 10, marginBottom: 22, fontSize: 18, lineHeight: 27, fontWeight: '700', color: COLORS.darkNavy },
  guideTipCard: { marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#DCCB72', backgroundColor: COLORS.lightYellow },
  guideTipNumber: { fontSize: 11, fontWeight: '800', color: COLORS.darkGold },
  guideTipTitle: { marginTop: 5, fontSize: 16, fontWeight: '800', color: COLORS.darkNavy },
  guideTipDetail: { marginTop: 6, fontSize: 14, lineHeight: 21, color: COLORS.darkNavy },

  noBorder: { borderBottomWidth: 0 },

  tipCard: { marginTop: 10 },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7E6',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  tipText: { flex: 1, fontSize: 13, color: '#8C5A0B', lineHeight: 18 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#F1F6FD',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.darkNavy,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  allergenLine: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.redAccent,
    textTransform: 'capitalize',
  },
});
