// app/decide.tsx — "Pick for me"
//
// The fastest path from "I don't know what to eat" to cooking: one card at
// a time, with the reasons it was chosen and how much of it you already
// have. The craving chips stay on screen so you can change your mind
// without starting over; "Not tonight" moves to the next best; after three
// skips we lay out the best three left so the carousel can't go on forever.
//
// Ranking, skipping and history live in hooks/useDecision.ts (shared with
// Home's pick). Foods you said you'd rather skip are suggested less, not
// never — see utils/decide.ts.

import React, { useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import RecipeListCard from '@/components/RecipeListCard';
import { Card, Chip, Display, IconButton, Pill, PrimaryButton, RecipeTile, ScreenHeader, SecondaryButton, SectionLabel, ui } from '@/components/ui';
import { COLORS } from '@/constants/Colors';
import { DIFFICULTY_LABELS, formatTime, getTotalTime } from '@/constants/recipes';
import { getRecipeImage, hasRecipePhoto } from '@/constants/recipeImages';
import { useApp } from '@/context/AppContext';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useDecision } from '@/hooks/useDecision';
import { CRAVINGS, CRAVINGS_FOR_MEAL, type Craving, type Decision } from '@/utils/decide';
import { MEAL_INFO, MEAL_TYPES } from '@/utils/meals';
import { getPlateSuggestion } from '@/utils/matching';

const SKIPS_BEFORE_FINAL_THREE = 3;

export default function DecideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();
  const { mealType, setMealType, preferences, pantry, toggleFavorite, isFavorite } = useApp();
  const [craving, setCraving] = useState<Craving>('anything');
  const [showMeals, setShowMeals] = useState(false);

  const d = useDecision({ mealType, craving });
  const pick = d.pick;
  const finalThree = d.skipped.length >= SKIPS_BEFORE_FINAL_THREE;
  const cravings = CRAVINGS_FOR_MEAL[mealType];

  const lockIn = (dec: Decision) => {
    a11y.haptic('success');
    const recipe = d.lockIn(dec);
    if (recipe) router.push(`/recipe/${recipe.id}`);
  };

  const dietPill = pick?.recipe.dietary.find(t => ['vegan', 'vegetarian', 'pescatarian', 'gluten-free', 'dairy-free'].includes(t));

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScreenHeader
        kicker="Pick for me"
        title={`${MEAL_INFO[mealType].label} · ${preferences.householdSize === 1 ? 'just you' : `${preferences.householdSize} people`}`}
        right={<IconButton icon="sliders" label="Change meal" tone="plain" onPress={() => setShowMeals(v => !v)} />}
      />

      <ScrollView
        contentContainerStyle={[ui.pad, { paddingBottom: insets.bottom + 24, flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
      >
        {showMeals ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {MEAL_TYPES.map(m => (
              <Chip key={m} label={MEAL_INFO[m].label} small selected={m === mealType} onPress={() => { setMealType(m); setCraving('anything'); }} />
            ))}
          </ScrollView>
        ) : null}

        <Text style={s.question}>What are you in the mood for?</Text>
        <View style={s.cravingWrap}>
          {cravings.map(c => (
            <Chip key={c} label={CRAVINGS[c].label.replace(' — just pick', '')} small selected={craving === c} onPress={() => setCraving(c)} />
          ))}
        </View>

        {d.error ? <Text style={s.error}>Some personalization is unavailable right now. {d.error}</Text> : null}

        {d.loading && !pick ? (
          <Card style={s.card}>
            <RecipeTile height={210} />
            <View style={[s.center, { paddingVertical: 36 }]}>
              <ActivityIndicator color={COLORS.darkNavy} />
              <Text style={s.hint}>Finding your {MEAL_INFO[mealType].label.toLowerCase()}…</Text>
            </View>
          </Card>
        ) : !pick ? (
          <Card style={[s.card, { padding: 22, gap: 10 }]}>
            <Display size={20}>{d.remaining.length === 0 && d.skipped.length > 0 ? 'That’s everything for now' : 'Nothing fits every rule'}</Display>
            <Text style={s.hint}>
              {d.skipped.length > 0
                ? 'You’ve seen every match for this craving. Start again, or try another mood.'
                : `Your allergies and diets rule out everything we have for ${MEAL_INFO[mealType].label.toLowerCase()} right now.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SecondaryButton label="Start again" onPress={d.restart} style={{ flex: 1 }} />
              <SecondaryButton label="Preferences" onPress={() => router.push('/settings/preferences')} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : finalThree ? (
          <View style={{ marginTop: 16 }}>
            <Display size={22}>Let’s settle it</Display>
            <Text style={[s.hint, { textAlign: 'left', marginTop: 6 }]}>These are the best matches left. Tap one to cook it.</Text>
            <View style={{ marginTop: 14 }}>
              {d.remaining.slice(0, 3).map(dec => (
                <RecipeListCard key={dec.recipe.id} recipe={dec.recipe} note={dec.reasons[0]} onPress={() => lockIn(dec)} />
              ))}
            </View>
            <SecondaryButton label="Show me more instead" onPress={d.restart} style={{ marginTop: 6 }} />
          </View>
        ) : (
          <Card style={s.card}>
            <View>
              {hasRecipePhoto(pick.recipe) ? (
                <Image source={getRecipeImage(pick.recipe)} style={s.image} accessibilityIgnoresInvertColors />
              ) : (
                <RecipeTile height={210} emoji={pick.recipe.emoji} tone="clay" />
              )}
              <View style={s.tagRight}>
                <Pill label={`Pick ${d.skipped.length + 1} of ${d.skipped.length + d.remaining.length}`} tone="yellow" />
              </View>
              <View style={s.tagsBottom}>
                <Pill label={formatTime(getTotalTime(pick.recipe))} tone="blue" style={s.lightPill} />
                <Pill label={DIFFICULTY_LABELS[pick.recipe.difficulty]} tone="blue" style={s.lightPill} />
                {dietPill ? <Pill label={dietPill} tone="blue" style={s.lightPill} /> : null}
              </View>
            </View>

            <View style={s.body}>
              <Display size={24}>{pick.recipe.name}</Display>

              {pick.reasons.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <SectionLabel tone="gold">Why this one</SectionLabel>
                  {pick.reasons.map(r => (
                    <View key={r} style={s.reasonRow}>
                      <FontAwesome name="check-circle-o" size={17} color={COLORS.green} style={{ marginTop: 1 }} />
                      <Text style={[s.reasonText, a11y.text(14)]}>{r}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {mealType !== 'dessert' && pick.recipe.nutrition.calories > 0 && getPlateSuggestion(pick.recipe.plate) ? (
                <View style={s.balanceTip}>
                  <FontAwesome name="lightbulb-o" size={14} color={COLORS.textGold} />
                  <Text style={s.balanceTipText}>Round it out: {getPlateSuggestion(pick.recipe.plate)}</Text>
                </View>
              ) : null}

              {pick.pantryPercent !== null && pantry.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <View style={s.barLabelRow}>
                    <Text style={s.barLabel}>Pantry</Text>
                    <Text style={s.barLabel}>{pick.pantryPercent}% of what it needs</Text>
                  </View>
                  <View style={s.barTrack}><View style={[s.barFill, { width: `${pick.pantryPercent}%` }]} /></View>
                </View>
              ) : null}
            </View>

            <View style={s.actions}>
              <PrimaryButton label="Let’s make this" icon="arrow-right" onPress={() => lockIn(pick)} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SecondaryButton label="Not tonight" icon="random" onPress={d.skip} style={{ flex: 1 }} />
                <SecondaryButton
                  label={isFavorite(pick.recipe.id) ? 'Saved' : 'Save for later'}
                  icon={isFavorite(pick.recipe.id) ? 'heart' : 'heart-o'}
                  onPress={() => { a11y.haptic(); toggleFavorite(pick.recipe.id); }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  chipRow: { gap: 8, paddingTop: 6, paddingBottom: 10 },
  question: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginTop: 8, marginBottom: 8 },
  cravingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 12, lineHeight: 17, color: COLORS.redText, marginTop: 10 },

  card: { marginTop: 16, borderRadius: 24 },
  image: { width: '100%', height: 210, backgroundColor: COLORS.tileClay },
  tagRight: { position: 'absolute', top: 12, right: 12 },
  tagsBottom: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 6 },
  lightPill: { backgroundColor: 'rgba(255,255,255,0.94)' },
  body: { padding: 18, paddingBottom: 4, gap: 14 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  reasonText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.textDark },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.lightBlueBg, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.green },
  actions: { padding: 18, paddingTop: 14, gap: 10 },
  balanceTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.lightYellow, borderRadius: 12, padding: 10 },
  balanceTipText: { flex: 1, fontSize: 12, lineHeight: 17, color: COLORS.textDark },

  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  hint: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, textAlign: 'center' },
});
