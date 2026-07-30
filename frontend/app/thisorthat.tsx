// app/thisorthat.tsx — the "This or That" picture game.
//
// HOW IT WORKS
// ------------
// The old screen here was a 9-question text quiz with a mode picker
// ("Cook from my pantry" / "Plan for the week"). Those flows moved out:
// pantry cooking lives on the Pantry tab (→ cookWithPantry) and the
// question quiz is now its own "Plan for the Week" screen (app/planWeek.tsx).
//
// This screen is now a fast visual game:
//   1. Show TWO recipe photos. Tap the one you'd rather eat.
//   2. Repeat — at most 3 rounds (early exit allowed after round 1).
//   3. Recommend the meal that best matches the picks.
//
// HOW SCORING WORKS (v2 — structured, not tag soup)
// -------------------------------------------------
// v1 poured every tag from every picked recipe into one weighted pile.
// That produced matches nobody could explain. Now each tap is read
// through the SAME dimensions the question quiz uses (data/quizQuestions.ts):
// protein type & prep, carb/starch type & richness, veggie type & prep,
// and so on. For each dimension, we ask: which option does the PICKED
// card represent, and which does the REJECTED card represent? If they
// differ, the tap was a real decision on that dimension and the picked
// side gets a vote — if both cards were, say, chicken, the tap taught us
// nothing about protein and no vote is cast. The winning option per
// dimension becomes an inferred preference, and the whole library is
// scored with the exact engine the quiz uses (utils/matching.ts):
// "how many of the user's inferred preferences does this recipe satisfy."
// The result screen shows those inferred preferences as chips, so the
// recommendation is legible: 🍗 Chicken · 🍚 Rice or grains · 🥦 Roasted.
//
// Pairs are drawn fresh each game from recipes that pass the user's
// dietary/allergen filters, and each pair is built to CONTRAST — above
// all on protein type — so every tap carries signal.

import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Text,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import RecipeDetail from '@/components/RecipeDetail';
import { COLORS } from '@/constants/Colors';
import {
  RECIPES,
  formatTime,
  getTotalTime,
  DIFFICULTY_LABELS,
} from '@/constants/recipes';
import { getRecipeImage, getFallbackRecipeImage } from '@/constants/recipeImages';
import {
  passesDietaryFilter,
  scoreAndFilterRecipes,
  getNearMisses,
  type UserSelection,
} from '@/utils/matching';
import {
  QUESTION_BANK,
  CATEGORY_ORDER,
  type QuizQuestion,
  type QuizOption,
} from '@/data/quizQuestions';
import { useApp } from '@/context/AppContext';
import type { Recipe, ScoredRecipe, Vibe } from '@/types';

const MAX_ROUNDS = 3;

// =====================================================
// READING A RECIPE THROUGH THE QUIZ DIMENSIONS
// =====================================================

/**
 * Which option of a quiz question a recipe "answers" with — the option
 * whose tags it carries the most of. Null if the question doesn't apply
 * to this recipe at all (a cold salad has no protein-prep answer).
 */
function optionFor(recipe: Recipe, question: QuizQuestion): QuizOption | null {
  const tagSet = new Set([...recipe.tags, recipe.vibe].map(t => t.toLowerCase()));
  let best: QuizOption | null = null;
  let bestHits = 0;
  for (const opt of question.options) {
    const hits = opt.tags.filter(t => tagSet.has(t.toLowerCase())).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = opt;
    }
  }
  return best;
}

/** The protein-type question — pairs should contrast on this above all. */
const PROTEIN_QUESTION = QUESTION_BANK.find(q => q.dimension === 'protein-type')!;

// =====================================================
// PAIR BUILDING
// =====================================================

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tagOverlap(a: Recipe, b: Recipe): number {
  const setA = new Set(a.tags);
  return b.tags.filter(t => setA.has(t)).length;
}

/**
 * How BAD a pairing is. Sharing a protein type dominates — a chicken
 * bowl vs. chicken pasta teaches us nothing about protein, which is the
 * decision that matters most. Also penalize sharing the same photo, so
 * the user never compares two identical-looking cards.
 */
function pairPenalty(a: Recipe, b: Recipe): number {
  const sameProtein =
    optionFor(a, PROTEIN_QUESTION)?.id === optionFor(b, PROTEIN_QUESTION)?.id;
  const sameImage =
    JSON.stringify(getRecipeImage(a)) === JSON.stringify(getRecipeImage(b));
  return (sameProtein ? 1000 : 0) + (sameImage ? 100 : 0) + tagOverlap(a, b);
}

/**
 * Draw MAX_ROUNDS pairs of recipes that (a) pass the user's filters and
 * (b) contrast with each other — different proteins first, different
 * looks second — so choosing between them actually says something.
 */
function buildPairs(eligible: Recipe[]): [Recipe, Recipe][] {
  const pool = shuffle(eligible);
  const pairs: [Recipe, Recipe][] = [];

  while (pairs.length < MAX_ROUNDS && pool.length >= 2) {
    const first = pool.shift()!;
    // Scan a window of candidates and take the most contrasting one.
    const window = pool.slice(0, 40);
    let bestIdx = 0;
    let bestScore = Infinity;
    window.forEach((cand, i) => {
      const score = pairPenalty(first, cand);
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    const second = pool.splice(bestIdx, 1)[0];
    pairs.push([first, second]);
  }

  return pairs;
}

// =====================================================
// SCORING — turn 1–3 picks into inferred preferences
// =====================================================

/** One inferred preference, kept human-readable for the result screen. */
export interface InferredPreference {
  dimension: string;
  category: (typeof CATEGORY_ORDER)[number];
  label: string;
  emoji: string;
  tags: string[];
  votes: number;
}

interface GameResult {
  top: ScoredRecipe | null;
  alternates: ScoredRecipe[];
  inferred: InferredPreference[];
  vibe: Vibe | null;
}

/**
 * Walk every quiz dimension (protein type/prep, carb type/richness,
 * veggie type/prep, …). For each round, if the picked and rejected cards
 * "answer" the dimension differently, the picked card's answer earns a
 * vote — that tap was a real decision on that axis. If both cards agree
 * (two chicken dishes), the tap says nothing about that axis and no vote
 * is cast. Winning options become the user's inferred preferences.
 */
function inferPreferences(picked: Recipe[], rejected: Recipe[]): InferredPreference[] {
  // dimension -> optionId -> { option, question, votes }
  const votes = new Map<string, Map<string, { q: QuizQuestion; opt: QuizOption; n: number }>>();

  const cast = (q: QuizQuestion, opt: QuizOption) => {
    const dim = votes.get(q.dimension) ?? new Map();
    const cur = dim.get(opt.id) ?? { q, opt, n: 0 };
    cur.n += 1;
    dim.set(opt.id, cur);
    votes.set(q.dimension, dim);
  };

  const run = (requireContrast: boolean) => {
    votes.clear();
    picked.forEach((p, i) => {
      const r = rejected[i];
      for (const q of QUESTION_BANK) {
        const po = optionFor(p, q);
        if (!po) continue;
        if (requireContrast && r) {
          const ro = optionFor(r, q);
          if (ro && ro.id === po.id) continue; // both cards agreed — no signal
        }
        cast(q, po);
      }
    });
  };

  // Prefer contrast-only signal; if the pairs happened to agree on
  // everything, fall back to reading the picks directly.
  run(true);
  if (votes.size === 0) run(false);

  const inferred: InferredPreference[] = [];
  votes.forEach((byOption, dimension) => {
    const winner = [...byOption.values()].sort((a, b) => b.n - a.n)[0];
    inferred.push({
      dimension,
      category: winner.q.category,
      label: winner.opt.label,
      emoji: winner.opt.emoji,
      tags: winner.opt.tags,
      votes: winner.n,
    });
  });

  // Protein first, then carbs, then veggies; strongest signals first.
  inferred.sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      b.votes - a.votes
  );
  return inferred;
}

/**
 * Score the library against the inferred preferences using the SAME
 * engine as the question quiz, so a 78% here means the same thing it
 * means there: this recipe satisfies 78% of what your picks told us
 * about your protein, starch, and veggie mood.
 */
function computeResult(
  picked: Recipe[],
  rejected: Recipe[],
  eligible: Recipe[],
  preferences: Parameters<typeof scoreAndFilterRecipes>[1]['preferences']
): GameResult {
  if (picked.length === 0) return { top: null, alternates: [], inferred: [], vibe: null };

  const inferred = inferPreferences(picked, rejected);

  // Weighted scoring: the HEADLINE decisions — protein type, carb/starch
  // type, veggie type — count 3x, and every dimension is scaled by how
  // consistently the user voted for it across rounds. Picking chicken
  // three times should matter far more than one round's plating detail.
  // (calculateMatchScore treats each selection entry as one point of the
  // denominator, so repeating an entry IS the weighting.)
  const CORE_DIMENSIONS = new Set(['protein-type', 'carb-type', 'veg-type']);
  const selections: UserSelection[] = inferred.flatMap(p => {
    const weight = p.votes * (CORE_DIMENSIONS.has(p.dimension) ? 3 : 1);
    return Array<UserSelection>(weight).fill({
      dimension: p.dimension,
      tags: p.tags,
    });
  });

  // Dominant vibe among picks — one more soft signal, like in the quiz.
  const vibeCounts = new Map<Vibe, number>();
  picked.forEach(r => vibeCounts.set(r.vibe, (vibeCounts.get(r.vibe) ?? 0) + 1));
  const vibe = [...vibeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Recommend something NEW — never a card they just saw.
  const shownIds = new Set([...picked, ...rejected].map(r => r.id));
  const pool = eligible.filter(r => !shownIds.has(r.id));

  const opts = { selections, vibe, preferences, requirePantryMatch: false };
  let matches = scoreAndFilterRecipes(pool, opts);
  if (matches.length === 0) matches = getNearMisses(pool, opts, 4);

  return {
    top: matches[0] ?? null,
    alternates: matches.slice(1, 4),
    inferred,
    vibe,
  };
}

// =====================================================
// SCREEN
// =====================================================

export default function ThisOrThatScreen() {
  const router = useRouter();
  const { preferences, toggleFavorite, isFavorite, recordQuizRun } = useApp();

  const insets = useSafeAreaInsets();
  const scrollPad = { paddingBottom: insets.bottom + 32 };

  const eligible = useMemo(
    () => RECIPES.filter(r => passesDietaryFilter(r, preferences)),
    [preferences]
  );

  const [pairs, setPairs] = useState<[Recipe, Recipe][]>(() => buildPairs(eligible));
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<Recipe[]>([]);
  const [rejected, setRejected] = useState<Recipe[]>([]);
  const [finished, setFinished] = useState(false);
  // Track photos that failed to load so we can swap in the bundled fallback.
  const [broken, setBroken] = useState<Record<string, true>>({});

  const exitToHome = () => router.replace('/');

  const reset = useCallback(() => {
    setPairs(buildPairs(eligible));
    setRound(0);
    setPicked([]);
    setRejected([]);
    setFinished(false);
  }, [eligible]);

  const choose = (chosen: Recipe, other: Recipe) => {
    const nextPicked = [...picked, chosen];
    const nextRejected = [...rejected, other];
    setPicked(nextPicked);
    setRejected(nextRejected);
    if (round + 1 >= pairs.length) {
      setFinished(true);
    } else {
      setRound(round + 1);
    }
  };

  const imageFor = (r: Recipe) =>
    broken[r.id] ? getFallbackRecipeImage() : getRecipeImage(r);

  // ---------------------------------------------------
  // Not enough recipes to even play (extreme filters)
  // ---------------------------------------------------
  if (pairs.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header onExit={exitToHome} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyTitle}>Not enough meals to play</Text>
          <Text style={styles.emptyText}>
            Your dietary filters are narrowing the recipe library too far to
            build match-ups. Loosen them in your preferences and try again.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={exitToHome} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------
  // GAME — two photos, pick one
  // ---------------------------------------------------
  if (!finished) {
    const [left, right] = pairs[round];

    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header
          onExit={exitToHome}
          center={
            <View style={styles.dotsRow}>
              {pairs.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < round && styles.dotDone,
                    i === round && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          }
          right={
            <Text style={styles.counter}>
              {round + 1}/{pairs.length}
            </Text>
          }
        />

        <ScrollView contentContainerStyle={[styles.pad, scrollPad]} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>This or That?</Text>
          <Text style={styles.sub}>Tap the one you'd rather eat right now.</Text>

          {[left, right].map((r, i) => (
            <React.Fragment key={r.id}>
              {i === 1 && (
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.orLine} />
                </View>
              )}
              <TouchableOpacity
                style={styles.photoCard}
                activeOpacity={0.85}
                onPress={() => choose(r, i === 0 ? right : left)}
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
                  <Text style={styles.photoName} numberOfLines={2}>
                    {r.name}
                  </Text>
                  <Text style={styles.photoMeta}>
                    {formatTime(getTotalTime(r))} · {DIFFICULTY_LABELS[r.difficulty]}
                  </Text>
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}

          {/* Early exit — "3 times at most", not "3 times exactly". */}
          {picked.length > 0 && (
            <TouchableOpacity style={styles.skip} onPress={() => setFinished(true)} activeOpacity={0.7}>
              <Text style={styles.skipText}>I've seen enough — show my match</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------
  // RESULT — the meal their picks point to
  // ---------------------------------------------------
  const { top: meal, alternates, inferred, vibe } = computeResult(
    picked,
    rejected,
    eligible,
    preferences
  );

  if (!meal) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header onExit={exitToHome} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyTitle}>Nothing matched</Text>
          <Text style={styles.emptyText}>
            We couldn't find another meal like your picks. Play again for a
            fresh set of match-ups.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Play again</Text>
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
        center={<Text style={styles.headerTitle}>Your match</Text>}
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
        {/* What they picked, as a receipt of the game */}
        <View style={styles.picksRow}>
          <Text style={styles.picksLabel}>You picked:</Text>
          <Text style={styles.picksEmoji}>{picked.map(p => p.emoji).join('  ')}</Text>
        </View>

        {/* The preferences we read from those picks — this is what the
            match score is measured against, so the result is explainable. */}
        {inferred.length > 0 && (
          <View style={styles.inferredWrap}>
            <Text style={styles.inferredLabel}>Your picks point to:</Text>
            <View style={styles.chipsRow}>
              {inferred.slice(0, 6).map(p => (
                <View key={p.dimension} style={styles.chip}>
                  <Text style={styles.chipEmoji}>{p.emoji}</Text>
                  <Text style={styles.chipText}>{p.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <RecipeDetail
          recipe={meal}
          matchScore={meal.matchScore}
          suggestion={meal.suggestion}
          note={`Matches ${meal.matchScore}% of the protein, carb, and veggie preferences your picks pointed to.`}
        />

        {alternates.length > 0 && (
          <>
            <View style={styles.altHeader}>
              <Text style={styles.altHeading}>Also matches your picks</Text>
              <Text style={styles.altSubheading}>Tap any one to see its full recipe.</Text>
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
                </View>
                <FontAwesome name="chevron-right" size={14} color={COLORS.borderLight} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            recordQuizRun({
              mode: 'thisorthat',
              vibe,
              tags: picked.flatMap(p => p.tags),
              topRecipeIds: [meal.id, ...alternates.map(a => a.id)].slice(0, 3),
            });
            reset();
          }}
          activeOpacity={0.9}
        >
          <FontAwesome name="refresh" size={15} color={COLORS.cardWhite} />
          <Text style={styles.primaryBtnText}>Play again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={exitToHome} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>Done — back to home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// HEADER
// =====================================================

function Header({
  onExit,
  center,
  right,
}: {
  onExit: () => void;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
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

  dotsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderLight,
  },
  dotDone: { backgroundColor: COLORS.darkGold },
  dotActive: { backgroundColor: COLORS.goldYellow, width: 22 },
  counter: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  pad: { paddingHorizontal: 20, paddingBottom: 48 },
  resultPad: { paddingHorizontal: 20, paddingBottom: 56 },

  h1: { fontSize: 26, fontWeight: '700', color: COLORS.darkNavy, marginTop: 4 },
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

  skip: { alignItems: 'center', paddingVertical: 18, marginTop: 6 },
  skipText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },

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
});
