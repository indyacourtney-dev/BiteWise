// app/(tabs)/thisorthat.tsx
//
// Flow: Mode → 9 questions → Vibe → your meal.
//
// WHAT CHANGED
// ------------
// The 9 questions used to be hardcoded in this file, in a fixed order,
// with fixed option order. Every single playthrough was identical. They
// now come from data/quizQuestions.ts, which holds 18 questions across
// 18 different decisions and draws a fresh mix each round with the
// options shuffled.
//
// Answers are recorded as { dimension, tags } rather than one flat tag
// soup, because the matching engine now scores "how many of your actual
// decisions does this recipe satisfy" — see utils/matching.ts.

import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import RecipeDetail from '@/components/RecipeDetail';
import { COLORS } from '@/constants/Colors';
import {
  RECIPES,
  formatTime,
  getTotalTime,
  DIFFICULTY_LABELS,
} from '../constants/recipes';
import {
  scoreAndFilterRecipes,
  getNearMisses,
  type UserSelection,
} from '../utils/matching';
import {
  buildRound,
  pickVibePrompt,
  CATEGORY_LABELS,
  TOTAL_QUESTIONS,
  VIBE_OPTIONS,
  type QuizQuestion,
  type QuizOption,
} from '../data/quizQuestions';
import { useApp } from '../context/AppContext';
import type { GameMode, Vibe, ScoredRecipe } from '../types';

type Screen = 'mode' | 'quiz' | 'vibe' | 'result';

export default function ThisOrThatScreen() {
  const router = useRouter();
  const { preferences, pantry, toggleFavorite, isFavorite, recordQuizRun } = useApp();

  // The tab bar floats above screen content, so every ScrollView has to
  // pad past it or the last rows sit underneath and can't be reached.
  // This was cutting off the bottom of the results screen.
  const tabBarHeight = useBottomTabBarHeight();
  const scrollPad = { paddingBottom: tabBarHeight + 32 };

  const [screen, setScreen] = useState<Screen>('mode');
  const [mode, setMode] = useState<GameMode>('weekly');
  const [round, setRound] = useState<QuizQuestion[]>(() => buildRound());
  const [vibePrompt, setVibePrompt] = useState<string>(() => pickVibePrompt());
  const [selections, setSelections] = useState<UserSelection[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [vibe, setVibe] = useState<Vibe | null>(null);

  const exitToHome = () => router.replace('/');

  /** Full reset, including drawing a brand new set of questions. */
  const reset = useCallback(() => {
    setRound(buildRound());
    setVibePrompt(pickVibePrompt());
    setSelections([]);
    setQIndex(0);
    setVibe(null);
    setScreen('mode');
  }, []);

  const advance = useCallback(() => {
    setQIndex(i => {
      if (i < round.length - 1) return i + 1;
      setScreen('vibe');
      return i;
    });
  }, [round.length]);

  const choose = (question: QuizQuestion, option: QuizOption) => {
    setSelections(prev => [
      ...prev.filter(s => s.dimension !== question.dimension),
      { dimension: question.dimension, tags: option.tags },
    ]);
    advance();
  };

  /** A skip records nothing, so it can't drag a recipe's score down. */
  const skip = () => advance();

  const goBack = () => {
    if (qIndex === 0) {
      setScreen('mode');
      return;
    }
    const previous = round[qIndex - 1];
    setSelections(prev => prev.filter(s => s.dimension !== previous.dimension));
    setQIndex(qIndex - 1);
  };

  // ===================================================
  // SCREEN 1 — MODE
  // ===================================================

  if (screen === 'mode') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header onExit={exitToHome} />
        <ScrollView contentContainerStyle={[styles.pad, scrollPad]}>
          <Text style={styles.h1}>Let's build your meal</Text>
          <Text style={styles.sub}>
            {TOTAL_QUESTIONS} quick questions, different every time. Skip any you don't
            care about — skipping never counts against your results.
          </Text>

          <TouchableOpacity
            style={styles.modeCard}
            activeOpacity={0.85}
            onPress={() => {
              setMode('pantry');
              setScreen('quiz');
            }}
          >
            <Text style={styles.modeEmoji}>🥘</Text>
            <View style={styles.flex1}>
              <Text style={styles.modeTitle}>Cook from my pantry</Text>
              <Text style={styles.modeDesc}>
                {pantry.length > 0
                  ? `Only meals you can mostly make with your ${pantry.length} ingredient${
                      pantry.length === 1 ? '' : 's'
                    }`
                  : 'Add pantry items first for the best results'}
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={COLORS.darkGold} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeCard}
            activeOpacity={0.85}
            onPress={() => {
              setMode('weekly');
              setScreen('quiz');
            }}
          >
            <Text style={styles.modeEmoji}>📅</Text>
            <View style={styles.flex1}>
              <Text style={styles.modeTitle}>Plan for the week</Text>
              <Text style={styles.modeDesc}>Shop for it — ignore what's on hand</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={COLORS.darkGold} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ===================================================
  // SCREEN 2 — QUESTIONS
  // ===================================================

  if (screen === 'quiz') {
    const question = round[qIndex];
    const pct = (qIndex / TOTAL_QUESTIONS) * 100;

    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header
          onExit={exitToHome}
          onBack={goBack}
          center={
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
          }
          right={
            <Text style={styles.counter}>
              {qIndex + 1}/{TOTAL_QUESTIONS}
            </Text>
          }
        />

        <View style={styles.badgeRow}>
          <Text style={styles.catBadge}>{CATEGORY_LABELS[question.category]}</Text>
        </View>

        <ScrollView contentContainerStyle={[styles.pad, scrollPad]}>
          <Text style={styles.question}>{question.question}</Text>
          {question.helper ? <Text style={styles.helper}>{question.helper}</Text> : null}

          {question.options.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={styles.optionCard}
              activeOpacity={0.8}
              onPress={() => choose(question, opt)}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <View style={styles.flex1}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionHint}>{opt.hint}</Text>
              </View>
              <FontAwesome name="chevron-right" size={13} color={COLORS.borderLight} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.skip} onPress={skip} activeOpacity={0.7}>
            <Text style={styles.skipText}>No preference — skip</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ===================================================
  // SCREEN 3 — VIBE
  // ===================================================

  if (screen === 'vibe') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header
          onExit={exitToHome}
          /* Back from the flavor step re-opens the last question. Choosing
             again replaces that answer (choose() de-dupes by dimension),
             so users can revise without restarting. */
          onBack={() => setScreen('quiz')}
          center={
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '100%' }]} />
            </View>
          }
          right={<Text style={styles.counter}>Last</Text>}
        />

        <ScrollView contentContainerStyle={[styles.pad, scrollPad]}>
          <Text style={styles.question}>{vibePrompt}</Text>

          {VIBE_OPTIONS.map(v => (
            <TouchableOpacity
              key={v.key}
              style={styles.optionCard}
              activeOpacity={0.8}
              onPress={() => {
                setVibe(v.key);
                setScreen('result');
              }}
            >
              <Text style={styles.optionEmoji}>{v.emoji}</Text>
              <View style={styles.flex1}>
                <Text style={styles.optionLabel}>{v.label}</Text>
                <Text style={styles.optionHint}>{v.hint}</Text>
              </View>
              <FontAwesome name="chevron-right" size={13} color={COLORS.borderLight} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.skip}
            onPress={() => {
              setVibe(null);
              setScreen('result');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Surprise me on flavor</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ===================================================
  // SCREEN 4 — THE RESULT
  // ===================================================

  const opts = {
    selections,
    vibe,
    preferences,
    pantry,
    requirePantryMatch: mode === 'pantry',
  };

  let matches: ScoredRecipe[] = scoreAndFilterRecipes(RECIPES, opts);
  let usedFallback = false;

  if (matches.length === 0) {
    matches = getNearMisses(RECIPES, opts, 4);
    usedFallback = true;
  }

  const meal = matches[0];

  // Sometimes only one recipe clears the threshold, which used to leave the
  // user with a single take-it-or-leave-it result. Top the list up with the
  // next-closest meals so there's always something else to look at.
  let alternates = matches.slice(1, 4);
  if (meal && alternates.length < 3) {
    const shown = new Set([meal.id, ...alternates.map(a => a.id)]);
    const topUp = getNearMisses(RECIPES, opts, 8).filter(r => !shown.has(r.id));
    alternates = [...alternates, ...topUp].slice(0, 3);
  }

  if (!meal) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header onExit={exitToHome} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyTitle}>Nothing matched</Text>
          <Text style={styles.emptyText}>
            {selections.length === 0
              ? 'You skipped every question, so there was nothing to match on. Try answering a few.'
              : 'Your dietary filters may be narrowing things too far.'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Start over</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const saved = isFavorite(meal.id);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        onExit={exitToHome}
        /* Back from the result re-opens the flavor step; from there the
           user can walk all the way back through their answers. The
           result recomputes from scratch on return, so edits count. */
        onBack={() => setScreen('vibe')}
        center={<Text style={styles.headerTitle}>Your meal</Text>}
        right={
          <TouchableOpacity
            onPress={() => toggleFavorite(meal.id)}
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <FontAwesome
              name={saved ? 'heart' : 'heart-o'}
              size={18}
              color={saved ? COLORS.redAccent : COLORS.darkNavy}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={[styles.resultPad, scrollPad]} showsVerticalScrollIndicator={false}>
        <RecipeDetail
          recipe={meal}
          matchScore={meal.matchScore}
          suggestion={meal.suggestion}
          note={
            usedFallback
              ? "Nothing was a full match, so here's the closest fit."
              : undefined
          }
          /* The recipe is printed in full below, but a lot of users expect a
             button rather than a scroll. This puts the same content one tap
             away on its own screen, right under the plate breakdown. */
          onOpenRecipe={() => router.push(`/recipe/${meal.id}?match=${meal.matchScore}`)}
        />

        {/* OTHER OPTIONS — always visible, tap to open the full recipe */}
        {alternates.length > 0 && (
          <>
            <View style={styles.altHeader}>
              <Text style={styles.altHeading}>Other options for you</Text>
              <Text style={styles.altSubheading}>
                These also fit what you picked. Tap any one to see its full recipe.
              </Text>
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
                    {alt.matchScore}% match · {formatTime(getTotalTime(alt))} ·{' '}
                    {DIFFICULTY_LABELS[alt.difficulty]}
                  </Text>
                  <Text style={styles.altLink}>View full recipe →</Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={COLORS.borderLight} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* ACTIONS */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            recordQuizRun({
              mode,
              vibe,
              tags: selections.flatMap(s => s.tags),
              topRecipeIds: matches.slice(0, 3).map(m => m.id),
            });
            reset();
          }}
          activeOpacity={0.9}
        >
          <FontAwesome name="refresh" size={15} color={COLORS.cardWhite} />
          <Text style={styles.primaryBtnText}>Build another meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => setScreen('vibe')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryBtnText}>← Change my answers</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={exitToHome} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>Done — back to home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// HEADER — present on every screen
// =====================================================

function Header({
  onExit,
  onBack,
  center,
  right,
}: {
  onExit: () => void;
  onBack?: () => void;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconBtn} activeOpacity={0.7}>
            <FontAwesome name="chevron-left" size={15} color={COLORS.darkNavy} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={onExit} style={styles.iconBtn} activeOpacity={0.7}>
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

  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.goldYellow },
  counter: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  pad: { paddingHorizontal: 20, paddingBottom: 48 },
  resultPad: { paddingHorizontal: 20, paddingBottom: 56 },

  h1: { fontSize: 26, fontWeight: '700', color: COLORS.darkNavy, marginTop: 8 },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 8, marginBottom: 24, lineHeight: 20 },

  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  modeEmoji: { fontSize: 30 },
  modeTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy },
  modeDesc: { fontSize: 13, color: COLORS.textMuted, marginTop: 3, lineHeight: 18 },

  badgeRow: { paddingHorizontal: 20, marginBottom: 4 },
  catBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.darkGold,
    backgroundColor: COLORS.lightYellow,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
  },

  question: {
    fontSize: 23,
    fontWeight: '700',
    color: COLORS.darkNavy,
    marginTop: 14,
    lineHeight: 30,
  },
  helper: { fontSize: 13, color: COLORS.textMuted, marginTop: 8, lineHeight: 19 },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  optionEmoji: { fontSize: 26 },
  optionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.darkNavy },
  optionHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  skip: { alignItems: 'center', paddingVertical: 18, marginTop: 6 },
  skipText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },

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
  altLink: { fontSize: 12, fontWeight: '700', color: COLORS.darkGold, marginTop: 6 },
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
});
