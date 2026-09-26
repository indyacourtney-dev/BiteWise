// app/thisorthat.tsx — the "This or That" photo game.
//
//   1. Two dishes. Tap the one you'd rather eat (or "Neither").
//   2. Each round tests one main question (protein, carb, veggies or
//      flavor), chosen from what the game is still unsure about, so the
//      pairs react to your earlier taps instead of being drawn up front.
//   3. It stops once it's confident (3 to 7 rounds), or when you tap
//      "Show my match", then recommends a NEW dish that fits.
//
// The engine (pair choice, learning, stopping, ranking) lives in
// utils/thisOrThat.ts, with a simulation in tests/thisOrThat.sim.ts.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Text, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import RecipeDetail from '@/components/RecipeDetail';
import { COLORS } from '@/constants/Colors';
import { RECIPES, formatTime, getTotalTime, DIFFICULTY_LABELS } from '@/constants/recipes';
import { getRecipeImage, getFallbackRecipeImage, hasRecipePhoto } from '@/constants/recipeImages';
import { passesDietaryFilter } from '@/utils/matching';
import {
  MAX_ROUNDS,
  applyChoice,
  confidence,
  createBeliefs,
  historyTagsFrom,
  inferPreferences,
  inferredVibe,
  lastPairTarget,
  nextPair,
  profileOf,
  rankResults,
  shouldStop,
  type Beliefs,
  type Choice,
} from '@/utils/thisOrThat';
import { useApp } from '@/context/AppContext';
import { recencyPenalty } from '@/utils/variety';
import { useRecipeLibrary } from '@/hooks/useRecipeLibrary';
import { useAccessibility } from '@/hooks/useAccessibility';
import { QUIZ_MEAL_TYPES, suitsMeal } from '@/utils/meals';
import type { Recipe } from '@/types';

/** What each round is asking, in words. */
const ROUND_FOCUS: Record<string, string> = {
  'protein-type': 'Which protein sounds better?',
  'carb-type': 'Rice, bread, pasta or potatoes?',
  'veg-type': 'What kind of veggies?',
  vibe: 'Which flavor are you after?',
};

const imageKey = (r: Recipe) => JSON.stringify(getRecipeImage(r));

interface Round {
  pair: [Recipe, Recipe];
  focus: string | null;
  choice?: Choice;
}

export default function ThisOrThatScreen() {
  const router = useRouter();
  const {
    preferences, toggleFavorite, isFavorite, recordQuizRun, mealType, history,
    recentGameRecipes, rememberGameRecipes, recipeExposure, noteRecipesShown,
  } = useApp();
  const a11y = useAccessibility();
  const insets = useSafeAreaInsets();
  const scrollPad = { paddingBottom: insets.bottom + 32 };

  // The questions are about protein / carbs / veggies, so the game plays
  // for lunch or dinner (dinner when another meal is selected).
  const quizMeal = QUIZ_MEAL_TYPES.includes(mealType) ? mealType : 'dinner';

  // Curated recipes for this meal (hand-picked photos); the recommendation can
  // come from the whole database for that meal.
  const eligible = useMemo(() => {
    const safe = RECIPES.filter(r => passesDietaryFilter(r, preferences));
    const forMeal = safe.filter(r => suitsMeal(r, quizMeal));
    return forMeal.length >= 6 ? forMeal : safe;
  }, [preferences, quizMeal]);
  const { recipes: mealLibrary } = useRecipeLibrary(quizMeal, preferences);
  const resultPool = mealLibrary.length > 0 ? mealLibrary : eligible;

  // Cards: the curated recipes, plus database recipes (imported and
  // community, already filtered for allergies, diets and age) that have a
  // real photo of their dish type and whose tags answer the game's main
  // questions, so a tap on them teaches the game something.
  const cardPool = useMemo(() => {
    const ids = new Set(eligible.map(r => r.id));
    const extra = mealLibrary.filter(r => {
      if (ids.has(r.id) || !hasRecipePhoto(r)) return false;
      const p = profileOf(r);
      return !!p['protein-type'] && !!(p['carb-type'] || p['veg-type']);
    });
    return [...eligible, ...extra];
  }, [eligible, mealLibrary]);

  // Start from what we already know: onboarding loves/dislikes and recent games.
  const freshBeliefs = () =>
    createBeliefs({
      favoriteTags: preferences.favoriteTags,
      dislikedTags: preferences.dislikedTags,
      historyTags: historyTagsFrom(history),
    });

  // Variety: dishes from the last few games are used less (see utils/thisOrThat.ts).
  const recentIds = useMemo(() => new Set(recentGameRecipes), [recentGameRecipes]);

  const startRound = (beliefs: Beliefs, shown: Set<string>, played: number): Round | null => {
    const pair = nextPair(cardPool, beliefs, shown, { round: played, imageKey, recentIds });
    return pair ? { pair, focus: lastPairTarget() } : null;
  };

  const [beliefs, setBeliefs] = useState<Beliefs>(freshBeliefs);
  const [shown, setShown] = useState<Set<string>>(() => new Set());
  const [rounds, setRounds] = useState<Round[]>([]);
  const [current, setCurrent] = useState<Round | null>(() => startRound(beliefs, new Set(), 0));
  const [finished, setFinished] = useState(false);
  const [broken, setBroken] = useState<Record<string, true>>({});
  const recorded = useRef(false);
  // What was recommended before, as of this game's start (so noting the
  // result below can't swap it). Recently recommended dishes rank a bit lower.
  const exposureAtStart = useRef(recipeExposure);

  const exitToHome = () => router.replace('/');

  const reset = () => {
    const b = freshBeliefs();
    setBeliefs(b);
    setShown(new Set());
    setRounds([]);
    setCurrent(startRound(b, new Set(), 0));
    setFinished(false);
    recorded.current = false;
    exposureAtStart.current = recipeExposure;
  };

  const choose = (choice: Choice) => {
    if (!current) return;
    const [left, right] = current.pair;
    const nextBeliefs = applyChoice(beliefs, left, right, choice);
    const nextShown = new Set(shown).add(left.id).add(right.id);
    const played = [...rounds, { ...current, choice }];
    const picks = played.filter(r => r.choice !== 'neither').length;
    setBeliefs(nextBeliefs);
    setShown(nextShown);
    setRounds(played);
    a11y.haptic('light');
    // Stop when confident, out of rounds or out of pairs. Keep going if
    // every answer so far was "Neither".
    const upcoming = startRound(nextBeliefs, nextShown, played.length);
    if (!upcoming || (picks > 0 && shouldStop(nextBeliefs, played.length))) {
      setFinished(true);
      setCurrent(null);
    } else {
      setCurrent(upcoming);
    }
  };

  const imageFor = (r: Recipe) => (broken[r.id] ? getFallbackRecipeImage() : getRecipeImage(r));
  const picked = rounds.filter(r => r.choice && r.choice !== 'neither').map(r => r.pair[r.choice === 'left' ? 0 : 1]);
  const sureness = confidence(beliefs);

  const inferred = useMemo(() => inferPreferences(beliefs), [beliefs]);
  const results = useMemo(
    () =>
      finished
        ? rankResults(resultPool, beliefs, preferences, shown, 4, {
            penalty: r => recencyPenalty(r.id, exposureAtStart.current) / 12,
          })
        : [],
    [finished, resultPool, beliefs, preferences, shown]
  );
  const meal = results[0] ?? null;

  // Save the game once the result is on screen, so Decide for me and the
  // next game learn from it.
  useEffect(() => {
    if (!finished || !meal || recorded.current) return;
    recorded.current = true;
    rememberGameRecipes([...shown]);
    noteRecipesShown([meal.id]);
    recordQuizRun({
      mode: 'thisorthat',
      mealType: quizMeal,
      vibe: inferredVibe(beliefs),
      tags: inferred.flatMap(p => p.tags),
      topRecipeIds: results.map(r => r.id).slice(0, 3),
    });
  }, [finished, meal, beliefs, inferred, results, quizMeal, recordQuizRun, rememberGameRecipes, noteRecipesShown, shown]);

  // ---------------------------------------------------
  // Not enough recipes to play (very strict filters)
  // ---------------------------------------------------
  if (!finished && !current) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header onExit={exitToHome} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyTitle}>Not enough meals to play</Text>
          <Text style={styles.emptyText}>
            Your diet and allergy settings leave too few dishes to compare. Loosen them in
            Profile, then try again.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={exitToHome} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------
  // GAME
  // ---------------------------------------------------
  if (!finished && current) {
    const [left, right] = current.pair;
    const roundNo = rounds.length + 1;
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header
          onExit={exitToHome}
          center={
            <View style={styles.meterWrap} accessibilityLabel={`We're ${Math.round(sureness * 100)} percent sure of your craving`}>
              <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${Math.max(6, Math.round(sureness * 100))}%` }]} />
              </View>
              <Text style={styles.meterText}>
                {sureness < 0.15 ? 'Learning your craving' : sureness < 0.35 ? 'Getting warmer' : 'Almost there'}
              </Text>
            </View>
          }
          right={<Text style={styles.counter}>{roundNo}/{MAX_ROUNDS}</Text>}
        />

        <ScrollView contentContainerStyle={[styles.pad, scrollPad]} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>This or That?</Text>
          <Text style={styles.sub}>
            {(current.focus && ROUND_FOCUS[current.focus]) ?? 'Tap the one you would rather eat right now.'}
          </Text>

          {[left, right].map((r, i) => (
            <React.Fragment key={r.id}>
              {i === 1 && (
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>
              )}
              <TouchableOpacity
                style={styles.photoCard}
                activeOpacity={0.85}
                onPress={() => choose(i === 0 ? 'left' : 'right')}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${r.name}`}
              >
                <Image
                  source={imageFor(r)}
                  style={styles.photo}
                  resizeMode="cover"
                  onError={() => setBroken(prev => ({ ...prev, [r.id]: true }))}
                />
                <View style={styles.emojiBadge}>
                  <Text style={styles.emojiBadgeText}>{r.emoji}</Text>
                </View>
                <View style={styles.photoInfo}>
                  <Text style={styles.photoName} numberOfLines={2}>{r.name}</Text>
                  <Text style={styles.photoMeta}>
                    {formatTime(getTotalTime(r))}, {DIFFICULTY_LABELS[r.difficulty].toLowerCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.neitherBtn}
              onPress={() => choose('neither')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Neither of these"
            >
              <Text style={styles.neitherText}>Neither</Text>
            </TouchableOpacity>
            {picked.length > 0 && (
              <TouchableOpacity
                style={styles.enoughBtn}
                onPress={() => {
                  setFinished(true);
                  setCurrent(null);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={styles.enoughText}>Show my match</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------
  // RESULT
  // ---------------------------------------------------
  if (!meal) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header onExit={exitToHome} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyTitle}>Nothing else matched</Text>
          <Text style={styles.emptyText}>
            Every dish that fits your settings was already shown. Play again for new match-ups.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Play again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const saved = isFavorite(meal.id);
  const alternates = results.slice(1);
  const matchedSet = new Set(meal.matched);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        onExit={exitToHome}
        center={<Text style={styles.headerTitle}>Your match</Text>}
        right={
          <TouchableOpacity
            onPress={() => toggleFavorite(meal.id)}
            style={styles.iconBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from favorites' : 'Save to favorites'}
          >
            <FontAwesome name={saved ? 'heart' : 'heart-o'} size={18} color={saved ? COLORS.redAccent : COLORS.darkNavy} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={[styles.resultPad, scrollPad]} showsVerticalScrollIndicator={false}>
        <View style={styles.picksRow}>
          <Text style={styles.picksLabel}>
            {rounds.length} round{rounds.length === 1 ? '' : 's'}, you picked
          </Text>
          <Text style={styles.picksEmoji}>{picked.map(p => p.emoji).join('  ')}</Text>
        </View>

        {inferred.length > 0 && (
          <View style={styles.inferredWrap}>
            <Text style={styles.inferredLabel}>What your picks told us</Text>
            <View style={styles.chipsRow}>
              {inferred.slice(0, 6).map(p => {
                const hit = matchedSet.has(p.dimension);
                return (
                  <View key={p.dimension} style={[styles.chip, !hit && styles.chipMiss]}>
                    <Text style={styles.chipEmoji}>{p.emoji}</Text>
                    <Text style={[styles.chipText, !hit && styles.chipTextMiss]}>{p.label}</Text>
                    {hit ? <FontAwesome name="check" size={11} color={COLORS.darkGold} /> : null}
                  </View>
                );
              })}
            </View>
            <Text style={styles.inferredHint}>
              Checked = this dish has it. {sureness >= 0.45 ? 'Your picks were consistent.' : 'A few more rounds would sharpen this.'}
            </Text>
          </View>
        )}

        <RecipeDetail
          recipe={meal}
          matchScore={meal.matchScore}
          suggestion={meal.suggestion}
          note={`Has ${meal.matchScore}% of what your picks pointed to, weighted toward protein, carbs and veggies.`}
        />

        {alternates.length > 0 && (
          <>
            <View style={styles.altHeader}>
              <Text style={styles.altHeading}>Also fits your picks</Text>
              <Text style={styles.altSubheading}>Tap one to see the full recipe.</Text>
            </View>
            {alternates.map(alt => (
              <TouchableOpacity
                key={alt.id}
                style={styles.altCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/recipe/${alt.id}?match=${alt.matchScore}`)}
              >
                <Text style={styles.altEmoji}>{alt.emoji}</Text>
                <View style={styles.flex1}>
                  <Text style={styles.altName}>{alt.name}</Text>
                  <Text style={styles.altMeta}>
                    {alt.matchScore}% match, {formatTime(getTotalTime(alt))}, {DIFFICULTY_LABELS[alt.difficulty].toLowerCase()}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={COLORS.inactiveGray} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.9}>
          <FontAwesome name="refresh" size={15} color={COLORS.cardWhite} />
          <Text style={styles.primaryBtnText}>Play again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={exitToHome} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>Back to home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// HEADER
// =====================================================

function Header({ onExit, center, right }: { onExit: () => void; center?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={onExit} style={styles.iconBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Close">
          <FontAwesome name="times" size={17} color={COLORS.darkNavy} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerCenter}>{center}</View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerLeft: { flexDirection: 'row', gap: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  counter: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  pad: { paddingHorizontal: 20, paddingBottom: 48 },
  resultPad: { paddingHorizontal: 20, paddingBottom: 56 },

  h1: { fontSize: 28, fontFamily: 'PlayfairDisplay_700Bold', color: COLORS.darkNavy, marginTop: 4 },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 6, marginBottom: 16, lineHeight: 20 },

  photoCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  photo: { width: '100%', height: 170, backgroundColor: COLORS.blueSoft },
  emojiBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  emojiBadgeText: { fontSize: 22 },
  photoInfo: { paddingHorizontal: 16, paddingVertical: 12 },
  photoName: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy, lineHeight: 21 },
  photoMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.borderLight },
  orText: { fontSize: 13, fontWeight: '800', color: COLORS.darkGold, letterSpacing: 1 },


  picksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  picksLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  picksEmoji: { fontSize: 20 },

  inferredWrap: { marginBottom: 16 },
  inferredLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.lightYellow,
    borderWidth: 1,
    borderColor: '#EDE28A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.darkNavy },

  altHeader: { marginTop: 30, marginBottom: 12 },
  altHeading: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy },
  altSubheading: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, lineHeight: 18 },
  altCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  altEmoji: { fontSize: 26 },
  altName: { fontSize: 15, fontWeight: '600', color: COLORS.darkNavy },
  altMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  primaryBtnText: { color: COLORS.cardWhite, fontSize: 15, fontWeight: '700' },

  secondaryBtn: { alignItems: 'center', paddingVertical: 16 },
  secondaryBtnText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.darkNavy },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  // Confidence meter (replaces the fixed 3 dots: the game length adapts)
  meterWrap: { alignItems: 'center', gap: 5, width: '100%', maxWidth: 200 },
  meterTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: COLORS.blueSoft, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.goldYellow },
  meterText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  neitherBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  neitherText: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  enoughBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.lightYellow, borderWidth: 1, borderColor: '#EDE28A' },
  enoughText: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  chipMiss: { backgroundColor: COLORS.cardWhite, borderColor: COLORS.borderLight },
  chipTextMiss: { color: COLORS.textMuted },
  inferredHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 10, lineHeight: 17 },
});
