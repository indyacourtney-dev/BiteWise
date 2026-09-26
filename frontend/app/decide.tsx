// app/decide.tsx — "Decide for me"
//
// The fastest path from "I don't know what to eat" to cooking:
//   1. What are we eating?        (breakfast / brunch / lunch / dinner / dessert,
//                                  pre-selected from the clock)
//   2. What are you in the mood for? (one tap; "Anything" is the default)
//   3. ONE pick, with the reasons we chose it, and a big "Let's make this".
//
// Indecision guard-rails:
//   * one recipe at a time, never a wall of options
//   * "Not feeling it" shows the next best pick
//   * after 3 skips we stop the carousel and offer a final 3 to choose from
//   * the choice is recorded (history) so next time the ranking learns what
//     the user picks for each meal and doesn't repeat recent meals

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import MealTypePicker from '@/components/MealTypePicker';
import FavoriteButton from '@/components/FavoriteButton';
import RecipeListCard from '@/components/RecipeListCard';
import { COLORS } from '@/constants/Colors';
import { formatTime, getTotalTime } from '@/constants/recipes';
import { useApp } from '@/context/AppContext';
import { useRecipeLibrary } from '@/hooks/useRecipeLibrary';
import { useAccessibility } from '@/hooks/useAccessibility';
import { CRAVINGS, CRAVINGS_FOR_MEAL, rankForDecision, type Craving, type Decision } from '@/utils/decide';
import { MEAL_INFO } from '@/utils/meals';

const SKIPS_BEFORE_FINAL_THREE = 3;

export default function DecideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    mealType, setMealType, preferences, pantry, favorites, history, recordQuizRun,
    recipeExposure, noteRecipesShown,
  } = useApp();
  const { recipes, loading } = useRecipeLibrary(mealType, preferences);
  const a11y = useAccessibility();

  const [step, setStep] = useState<'ask' | 'pick'>('ask');
  const [craving, setCraving] = useState<Craving>('anything');
  const [skipped, setSkipped] = useState<string[]>([]);
  const [finalThree, setFinalThree] = useState(false);
  // New draw each time a round starts (see utils/variety.ts).
  const [round, setRound] = useState(0);
  // Snapshot of what was suggested before, taken when a round starts, so
  // noting "shown" below doesn't reshuffle the card you're looking at.
  const exposureAtStart = useRef(recipeExposure);

  // Rank once per question set; skipping walks down this list.
  const ranked: Decision[] = useMemo(
    () =>
      step === 'pick'
        ? rankForDecision(recipes, { mealType, craving, preferences, pantry, favorites, history, exposure: exposureAtStart.current })
        : [],
    // history/favorites intentionally left out: re-ranking while the user is
    // looking at a pick (e.g. after tapping the heart) would swap the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, round, recipes, mealType, craving, preferences, pantry]
  );
  const remaining = ranked.filter(d => !skipped.includes(d.recipe.id));
  const pick = remaining[0];

  const cravings = CRAVINGS_FOR_MEAL[mealType];

  // Remember every pick we show, so the next session suggests something else.
  const shownIds = finalThree ? remaining.slice(0, 3).map(d => d.recipe.id).join(',') : pick?.recipe.id ?? '';
  useEffect(() => {
    if (step === 'pick' && shownIds) noteRecipesShown(shownIds.split(','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, shownIds]);

  const start = (c: Craving = craving) => {
    exposureAtStart.current = recipeExposure;
    setRound(r => r + 1);
    setCraving(c);
    setSkipped([]);
    setFinalThree(false);
    setStep('pick');
  };

  const skip = () => {
    if (!pick) return;
    const next = [...skipped, pick.recipe.id];
    setSkipped(next);
    if (next.length >= SKIPS_BEFORE_FINAL_THREE) setFinalThree(true);
  };

  const lockIn = (d: Decision) => {
    a11y.haptic('success');
    noteRecipesShown([d.recipe.id], true);
    recordQuizRun({
      mode: 'decide',
      mealType,
      chosenRecipeId: d.recipe.id,
      vibe: null,
      tags: d.recipe.tags,
      topRecipeIds: remaining.slice(0, 3).map(x => x.recipe.id),
    });
    router.push(`/recipe/${d.recipe.id}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => (step === 'pick' ? setStep('ask') : router.back())}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={step === 'pick' ? 'Change answers' : 'Go back'}
        >
          <FontAwesome name="chevron-left" size={16} color={COLORS.darkNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Decide for me</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {step === 'ask' ? (
          <>
            <Text style={styles.question}>What are we eating?</Text>
            <MealTypePicker value={mealType} onChange={setMealType} />

            <Text style={[styles.question, { marginTop: 28 }]}>{MEAL_INFO[mealType].prompt}</Text>
            <View style={styles.cravingGrid}>
              {cravings.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.craving, craving === c && styles.cravingActive]}
                  onPress={() => setCraving(c)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cravingEmoji}>{CRAVINGS[c].emoji}</Text>
                  <Text style={[styles.cravingLabel, craving === c && styles.cravingLabelActive]}>
                    {CRAVINGS[c].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => start()} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>Pick my {MEAL_INFO[mealType].label.toLowerCase()}</Text>
              <FontAwesome name="magic" size={16} color={COLORS.darkNavy} />
            </TouchableOpacity>
            <Text style={styles.hint}>
              We'll use your tastes{pantry.length ? ', your pantry' : ''} and what you've enjoyed before.
            </Text>
          </>
        ) : loading && recipes.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.darkNavy} />
            <Text style={styles.hint}>Finding your {MEAL_INFO[mealType].label.toLowerCase()}…</Text>
          </View>
        ) : !pick ? (
          <View style={styles.center}>
            <Text style={styles.bigEmoji}>🤷</Text>
            <Text style={styles.emptyTitle}>Nothing fits every rule</Text>
            <Text style={styles.hint}>
              Your allergies and diets rule out everything we have for {MEAL_INFO[mealType].label.toLowerCase()} right now.
              Try another meal, or check your settings.
            </Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('ask')}>
              <Text style={styles.secondaryBtnText}>Change answers</Text>
            </TouchableOpacity>
          </View>
        ) : finalThree ? (
          <>
            <Text style={styles.question}>Let's settle it — pick one of these three</Text>
            <Text style={styles.hint}>These are the best matches left. Tap one to cook it.</Text>
            <View style={{ marginTop: 14 }}>
              {remaining.slice(0, 3).map(d => (
                <RecipeListCard
                  key={d.recipe.id}
                  recipe={d.recipe}
                  note={d.reasons[0]}
                  onPress={() => lockIn(d)}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.kicker}>
              {MEAL_INFO[mealType].emoji} Your {MEAL_INFO[mealType].label.toLowerCase()} is…
            </Text>
            <View style={styles.pickCard}>
              <View style={styles.pickTop}>
                <Text style={styles.pickEmoji}>{pick.recipe.emoji}</Text>
                <FavoriteButton recipeId={pick.recipe.id} size={22} />
              </View>
              <Text style={[styles.pickName, a11y.text(24, '700')]}>{pick.recipe.name}</Text>
              <Text style={styles.pickMeta}>
                {formatTime(getTotalTime(pick.recipe))}
                {pick.recipe.nutrition.calories > 0 ? ` · ${pick.recipe.nutrition.calories} cal` : ''}
                {` · ${pick.recipe.difficulty}`}
              </Text>

              {pick.reasons.length > 0 ? (
                <View style={styles.reasons}>
                  <Text style={styles.reasonsTitle}>Why this one</Text>
                  {pick.reasons.map(r => (
                    <View key={r} style={styles.reasonRow}>
                      <FontAwesome name="check" size={13} color={COLORS.darkGold} />
                      <Text style={[styles.reasonText, a11y.text(15)]}>{r}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => lockIn(pick)} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>Let's make this</Text>
              <FontAwesome name="arrow-right" size={16} color={COLORS.darkNavy} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={skip} activeOpacity={0.8}>
              <Text style={styles.secondaryBtnText}>
                Not feeling it ({SKIPS_BEFORE_FINAL_THREE - skipped.length} left)
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.darkNavy },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  question: { fontSize: 20, fontWeight: '700', color: COLORS.textDark, marginBottom: 12 },
  hint: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  cravingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  craving: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cravingActive: { backgroundColor: COLORS.lightYellow, borderColor: COLORS.darkGold },
  cravingEmoji: { fontSize: 18 },
  cravingLabel: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  cravingLabelActive: { color: COLORS.textDark },
  primaryBtn: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.goldYellow,
    borderRadius: 16,
    paddingVertical: 16,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.darkNavy },
  secondaryBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textMuted },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  bigEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.darkNavy },
  kicker: { fontSize: 15, fontWeight: '600', color: COLORS.textMuted, marginBottom: 10 },
  pickCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 22,
  },
  pickTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pickEmoji: { fontSize: 64 },
  pickName: { fontSize: 24, fontWeight: '700', color: COLORS.textDark, marginTop: 8 },
  pickMeta: { fontSize: 14, color: COLORS.textMuted, marginTop: 6 },
  reasons: { marginTop: 18, gap: 8 },
  reasonsTitle: { fontSize: 13, fontWeight: '700', color: COLORS.darkGold, textTransform: 'uppercase', letterSpacing: 0.6 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reasonText: { flex: 1, fontSize: 15, color: COLORS.textDark },
});
