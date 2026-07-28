// app/(tabs)/thisorthat.tsx
//
// Flow: Mode → 9 questions → Vibe → YOUR CRAFTED MEAL
// An exit button is present on every screen and always returns Home.

import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View as RNView,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import PlateVisualization from '../../components/PlateVisualization';
import { RECIPES, formatTime, getTotalTime, DIFFICULTY_LABELS } from '../../constants/recipes';
import { scoreAndFilterRecipes, getNearMisses } from '../../utils/matching';
import { useApp } from '../../context/AppContext';
import type { GameMode, Category, Vibe, Option, CategoryData, ScoredRecipe } from '../../types';

type Screen = 'mode' | 'quiz' | 'vibe' | 'result';

// =====================================================
// QUESTIONS
// =====================================================

const CATEGORY_QUESTIONS: Record<Category, CategoryData> = {
  protein: {
    name: 'Protein',
    questions: [
      {
        id: 'p1',
        question: 'What protein sounds best?',
        options: [
          { id: 'p1a', label: 'Chicken', emoji: '🍗', tags: ['chicken', 'lean', 'poultry'] },
          { id: 'p1b', label: 'Beef', emoji: '🥩', tags: ['beef', 'hearty', 'red-meat'] },
          { id: 'p1c', label: 'Fish', emoji: '🐟', tags: ['fish', 'seafood', 'light'] },
        ],
      },
      {
        id: 'p2',
        question: 'How should it be cooked?',
        options: [
          { id: 'p2a', label: 'Grilled', emoji: '🔥', tags: ['grilled', 'smoky'] },
          { id: 'p2b', label: 'Pan-fried', emoji: '🍳', tags: ['fried', 'crispy'] },
          { id: 'p2c', label: 'Baked', emoji: '🍖', tags: ['baked', 'roasted'] },
        ],
      },
      {
        id: 'p3',
        question: 'How much protein?',
        options: [
          { id: 'p3a', label: 'Light', emoji: '🥢', tags: ['light', 'portion-small'] },
          { id: 'p3b', label: 'Regular', emoji: '🍽️', tags: ['balanced', 'portion-medium'] },
          { id: 'p3c', label: 'Hearty', emoji: '🍴', tags: ['hearty', 'portion-large'] },
        ],
      },
    ],
  },
  carb: {
    name: 'Carbs',
    questions: [
      {
        id: 'c1',
        question: 'Pick your carb',
        options: [
          { id: 'c1a', label: 'Rice', emoji: '🍚', tags: ['rice', 'grain'] },
          { id: 'c1b', label: 'Pasta', emoji: '🍝', tags: ['pasta', 'noodles'] },
          { id: 'c1c', label: 'Grains', emoji: '🌾', tags: ['quinoa', 'grain'] },
        ],
      },
      {
        id: 'c2',
        question: 'Light or rich?',
        options: [
          { id: 'c2a', label: 'Light & fresh', emoji: '🥗', tags: ['light', 'fresh'] },
          { id: 'c2b', label: 'Balanced', emoji: '⚖️', tags: ['balanced'] },
          { id: 'c2c', label: 'Rich & creamy', emoji: '🍨', tags: ['rich', 'creamy'] },
        ],
      },
      {
        id: 'c3',
        question: 'How much carb?',
        options: [
          { id: 'c3a', label: 'Low-carb', emoji: '📉', tags: ['low-carb'] },
          { id: 'c3b', label: 'Normal', emoji: '📊', tags: ['grain', 'balanced'] },
          { id: 'c3c', label: 'Extra', emoji: '📈', tags: ['high-carb'] },
        ],
      },
    ],
  },
  greens: {
    name: 'Greens',
    questions: [
      {
        id: 'g1',
        question: 'What vegetables?',
        options: [
          { id: 'g1a', label: 'Leafy greens', emoji: '🥬', tags: ['greens', 'leafy'] },
          { id: 'g1b', label: 'Roasted veg', emoji: '🥦', tags: ['roasted', 'veggies-large'] },
          { id: 'g1c', label: 'Fresh salad', emoji: '🥗', tags: ['salad', 'fresh', 'raw'] },
        ],
      },
      {
        id: 'g2',
        question: 'How should they be prepared?',
        options: [
          { id: 'g2a', label: 'Raw & crisp', emoji: '🌱', tags: ['raw', 'fresh'] },
          { id: 'g2b', label: 'Lightly cooked', emoji: '🥕', tags: ['light'] },
          { id: 'g2c', label: 'Well roasted', emoji: '🍠', tags: ['roasted'] },
        ],
      },
      {
        id: 'g3',
        question: 'How many vegetables?',
        options: [
          { id: 'g3a', label: 'Small side', emoji: '🤏', tags: ['portion-small'] },
          { id: 'g3b', label: 'Balanced', emoji: '👌', tags: ['balanced'] },
          { id: 'g3c', label: 'Load me up', emoji: '💪', tags: ['veggies-large', 'greens'] },
        ],
      },
    ],
  },
};

const CATEGORY_ORDER: Category[] = ['protein', 'carb', 'greens'];
const TOTAL_QUESTIONS = 9;

// =====================================================
// EXIT HEADER — on every screen
// =====================================================

function ExitHeader({
  onExit,
  center,
  right,
}: {
  onExit: () => void;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <RNView style={styles.header}>
      <TouchableOpacity onPress={onExit} style={styles.exitBtn} activeOpacity={0.7}>
        <FontAwesome name="times" size={18} color="#2e4053" />
      </TouchableOpacity>
      <RNView style={styles.headerCenter}>{center}</RNView>
      <RNView style={styles.headerRight}>{right}</RNView>
    </RNView>
  );
}

// =====================================================
// MAIN
// =====================================================

export default function ThisOrThatScreen() {
  const router = useRouter();
  const { preferences, pantry, toggleFavorite, isFavorite, recordQuizRun } = useApp();

  const [screen, setScreen] = useState<Screen>('mode');
  const [mode, setMode] = useState<GameMode>('weekly');
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [catIndex, setCatIndex] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [showAlternates, setShowAlternates] = useState(false);

  // Leaves the quiz from anywhere. replace() so exiting doesn't
  // pile quiz screens onto the back stack.
  const exitToHome = () => router.replace('/home');

  const reset = () => {
    setScreen('mode');
    setTags(new Set());
    setVibe(null);
    setCatIndex(0);
    setQIndex(0);
    setShowAlternates(false);
  };

  const advance = () => {
    const questions = CATEGORY_QUESTIONS[CATEGORY_ORDER[catIndex]].questions;
    if (qIndex < questions.length - 1) {
      setQIndex(qIndex + 1);
    } else if (catIndex < CATEGORY_ORDER.length - 1) {
      setCatIndex(catIndex + 1);
      setQIndex(0);
    } else {
      setScreen('vibe');
    }
  };

  const choose = (option: Option) => {
    setTags(prev => {
      const next = new Set(prev);
      option.tags.forEach(t => next.add(t));
      return next;
    });
    advance();
  };

  const chooseVibe = (v: Vibe) => {
    setVibe(v);
    setScreen('result');
  };

  // ===================================================
  // SCREEN 1 — MODE
  // ===================================================

  if (screen === 'mode') {
    return (
      <View style={styles.container}>
        <ExitHeader onExit={exitToHome} />
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.h1}>Let's build your meal</Text>
          <Text style={styles.sub}>Nine quick questions. Skip any you don't care about.</Text>

          <TouchableOpacity
            style={styles.modeCard}
            activeOpacity={0.85}
            onPress={() => {
              setMode('pantry');
              setScreen('quiz');
            }}
          >
            <Text style={styles.modeEmoji}>🥘</Text>
            <RNView style={styles.flex1}>
              <Text style={styles.modeTitle}>Cook from my pantry</Text>
              <Text style={styles.modeDesc}>
                {pantry.length > 0
                  ? `Only meals you can make with your ${pantry.length} ingredients`
                  : 'Add pantry items first for the best results'}
              </Text>
            </RNView>
            <FontAwesome name="chevron-right" size={16} color="#b49221" />
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
            <RNView style={styles.flex1}>
              <Text style={styles.modeTitle}>Plan for the week</Text>
              <Text style={styles.modeDesc}>Shop for it — ignore what's on hand</Text>
            </RNView>
            <FontAwesome name="chevron-right" size={16} color="#b49221" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ===================================================
  // SCREEN 2 — QUESTIONS
  // ===================================================

  if (screen === 'quiz') {
    const category = CATEGORY_ORDER[catIndex];
    const data = CATEGORY_QUESTIONS[category];
    const question = data.questions[qIndex];
    const answered = catIndex * 3 + qIndex;
    const pct = (answered / TOTAL_QUESTIONS) * 100;

    return (
      <View style={styles.container}>
        <ExitHeader
          onExit={exitToHome}
          center={
            <RNView style={styles.progressTrack}>
              <RNView style={[styles.progressFill, { width: `${pct}%` }]} />
            </RNView>
          }
          right={
            <Text style={styles.counter}>
              {answered + 1}/{TOTAL_QUESTIONS}
            </Text>
          }
        />

        <Text style={styles.catBadge}>{data.name}</Text>

        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.question}>{question.question}</Text>
          {question.options.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={styles.optionCard}
              activeOpacity={0.8}
              onPress={() => choose(opt)}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <Text style={styles.optionLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.skip} onPress={advance} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip this one</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ===================================================
  // SCREEN 3 — VIBE
  // ===================================================

  if (screen === 'vibe') {
    const vibes: { key: Vibe; emoji: string; label: string; desc: string }[] = [
      { key: 'spicy', emoji: '🌶️', label: 'Spicy', desc: 'Heat and bold spice' },
      { key: 'savory', emoji: '🍲', label: 'Savory', desc: 'Rich, herby, classic' },
      { key: 'sweet', emoji: '🍯', label: 'Sweet', desc: 'Glazed, honeyed, bright' },
    ];

    return (
      <View style={styles.container}>
        <ExitHeader
          onExit={exitToHome}
          center={
            <RNView style={styles.progressTrack}>
              <RNView style={[styles.progressFill, { width: '100%' }]} />
            </RNView>
          }
          right={<Text style={styles.counter}>Last</Text>}
        />

        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.question}>Last one — what flavor?</Text>
          {vibes.map(v => (
            <TouchableOpacity
              key={v.key}
              style={styles.optionCard}
              activeOpacity={0.8}
              onPress={() => chooseVibe(v.key)}
            >
              <Text style={styles.optionEmoji}>{v.emoji}</Text>
              <Text style={styles.optionLabel}>{v.label}</Text>
              <Text style={styles.optionDesc}>{v.desc}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ===================================================
  // SCREEN 4 — THE CRAFTED MEAL
  // ===================================================

  const opts = {
    userTags: tags,
    vibe,
    preferences,
    pantry,
    requirePantryMatch: mode === 'pantry',
  };

  let matches: ScoredRecipe[] = scoreAndFilterRecipes(RECIPES, opts);
  let usedFallback = false;

  // Never dead-end. If nothing clears the threshold, show the closest thing.
  if (matches.length === 0) {
    matches = getNearMisses(RECIPES, opts, 3);
    usedFallback = true;
  }

  const meal = matches[0];
  const alternates = matches.slice(1);

  if (!meal) {
    return (
      <View style={styles.container}>
        <ExitHeader onExit={exitToHome} />
        <RNView style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyTitle}>Nothing matched</Text>
          <Text style={styles.emptyText}>
            {mode === 'pantry'
              ? 'Try adding a few more pantry items, or switch to week planning.'
              : 'Your dietary filters may be narrowing things too far.'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Start over</Text>
          </TouchableOpacity>
        </RNView>
      </View>
    );
  }

  const saved = isFavorite(meal.id);

  return (
    <View style={styles.container}>
      <ExitHeader
        onExit={exitToHome}
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
              color={saved ? '#FF4D4F' : '#2e4053'}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.resultPad} showsVerticalScrollIndicator={false}>
        {usedFallback && (
          <RNView style={styles.noteBox}>
            <FontAwesome name="info-circle" size={14} color="#D46B08" />
            <Text style={styles.noteText}>
              Nothing hit a full match, so here's the closest fit.
            </Text>
          </RNView>
        )}

        {/* THE MEAL */}
        <RNView style={styles.hero}>
          <Text style={styles.heroEmoji}>{meal.emoji}</Text>
          <Text style={styles.heroName}>{meal.name}</Text>
          <Text style={styles.heroMatch}>{meal.matchScore}% match to what you picked</Text>
        </RNView>

        {/* AT A GLANCE */}
        <RNView style={styles.statsRow}>
          <Stat icon="clock-o" label="Total" value={formatTime(getTotalTime(meal))} />
          <Stat icon="signal" label="Level" value={DIFFICULTY_LABELS[meal.difficulty]} />
          <Stat icon="users" label="Serves" value={`${meal.servings}`} />
        </RNView>

        {/* PLATE */}
        <Text style={styles.sectionTitle}>Plate balance</Text>
        <RNView style={styles.card}>
          <PlateVisualization plate={meal.plate} />
          {meal.suggestion && (
            <RNView style={styles.tipBox}>
              <FontAwesome name="lightbulb-o" size={14} color="#D46B08" />
              <Text style={styles.tipText}>{meal.suggestion}</Text>
            </RNView>
          )}
        </RNView>

        {/* INGREDIENTS */}
        <Text style={styles.sectionTitle}>
          Ingredients <Text style={styles.sectionCount}>({meal.ingredients.length})</Text>
        </Text>
        <RNView style={styles.card}>
          {meal.ingredients.map((ing, i) => (
            <RNView
              key={i}
              style={[styles.ingRow, i === meal.ingredients.length - 1 && styles.noBorder]}
            >
              <RNView style={styles.bullet} />
              <Text style={styles.ingName}>
                {ing.name}
                {ing.optional && <Text style={styles.optional}> · optional</Text>}
              </Text>
              <Text style={styles.ingAmount}>{ing.amount}</Text>
            </RNView>
          ))}
        </RNView>

        {/* STEPS */}
        <Text style={styles.sectionTitle}>How to make it</Text>
        <RNView style={styles.card}>
          {meal.instructions.map((step, i) => (
            <RNView
              key={i}
              style={[styles.stepRow, i === meal.instructions.length - 1 && styles.noBorder]}
            >
              <RNView style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </RNView>
              <Text style={styles.stepText}>{step}</Text>
            </RNView>
          ))}
        </RNView>

        {/* ALTERNATES */}
        {alternates.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.altToggle}
              onPress={() => setShowAlternates(!showAlternates)}
              activeOpacity={0.7}
            >
              <Text style={styles.altToggleText}>
                {showAlternates ? 'Hide' : 'Show'} {alternates.length} other match
                {alternates.length === 1 ? '' : 'es'}
              </Text>
              <FontAwesome
                name={showAlternates ? 'chevron-up' : 'chevron-down'}
                size={12}
                color="#b49221"
              />
            </TouchableOpacity>

            {showAlternates &&
              alternates.map(alt => (
                <RNView key={alt.id} style={styles.altCard}>
                  <Text style={styles.altEmoji}>{alt.emoji}</Text>
                  <RNView style={styles.flex1}>
                    <Text style={styles.altName}>{alt.name}</Text>
                    <Text style={styles.altMeta}>
                      {alt.matchScore}% · {formatTime(getTotalTime(alt))} ·{' '}
                      {DIFFICULTY_LABELS[alt.difficulty]}
                    </Text>
                  </RNView>
                </RNView>
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
              tags: Array.from(tags),
              topRecipeIds: matches.slice(0, 3).map(m => m.id),
            });
            reset();
          }}
          activeOpacity={0.9}
        >
          <FontAwesome name="refresh" size={15} color="#fff" />
          <Text style={styles.primaryBtnText}>Build another meal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={exitToHome} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>Done — back to home</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <RNView style={styles.stat}>
      <FontAwesome name={icon} size={15} color="#b49221" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </RNView>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f6fd' },
  flex1: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 60 },
  resultPad: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 60 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },
  exitBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  headerCenter: { flex: 1, justifyContent: 'center' },
  headerRight: { minWidth: 40, alignItems: 'flex-end' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#2e4053' },
  iconBtn: { padding: 6 },

  progressTrack: {
    height: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#b49221' },
  counter: { fontSize: 12, fontWeight: '700', color: '#2e4053' },

  // Mode
  h1: { fontSize: 28, fontWeight: '700', color: '#2e4053', marginBottom: 6 },
  sub: { fontSize: 14, color: '#666', marginBottom: 24 },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modeEmoji: { fontSize: 36 },
  modeTitle: { fontSize: 15, fontWeight: '700', color: '#2e4053', marginBottom: 3 },
  modeDesc: { fontSize: 12, color: '#666', lineHeight: 16 },

  // Quiz
  catBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b49221',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 24,
    lineHeight: 30,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionEmoji: { fontSize: 38, marginBottom: 8 },
  optionLabel: { fontSize: 16, fontWeight: '700', color: '#2e4053' },
  optionDesc: { fontSize: 12, color: '#999', marginTop: 3 },
  skip: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  skipText: { fontSize: 14, color: '#999', fontWeight: '500' },

  // Result hero
  hero: { alignItems: 'center', paddingVertical: 20 },
  heroEmoji: { fontSize: 64, marginBottom: 10 },
  heroName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2e4053',
    textAlign: 'center',
    lineHeight: 31,
    marginBottom: 6,
  },
  heroMatch: { fontSize: 13, color: '#b49221', fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  stat: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statValue: { fontSize: 14, fontWeight: '700', color: '#2e4053' },
  statLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2e4053',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  sectionCount: { color: '#999', fontWeight: '500' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },

  // Ingredients
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  noBorder: { borderBottomWidth: 0 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#b49221' },
  ingName: { flex: 1, fontSize: 14, color: '#2e4053', textTransform: 'capitalize' },
  optional: { fontSize: 12, color: '#999', textTransform: 'none' },
  ingAmount: { fontSize: 13, color: '#666', fontWeight: '600' },

  // Steps
  stepRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2e4053',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  stepText: { flex: 1, fontSize: 14, color: '#2e4053', lineHeight: 21 },

  // Tips / notes
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7E6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 8,
  },
  tipText: { flex: 1, fontSize: 12, color: '#D46B08', lineHeight: 17 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7E6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  noteText: { flex: 1, fontSize: 12, color: '#D46B08' },

  // Alternates
  altToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  altToggleText: { fontSize: 13, color: '#b49221', fontWeight: '600' },
  altCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  altEmoji: { fontSize: 28 },
  altName: { fontSize: 14, fontWeight: '700', color: '#2e4053', marginBottom: 3 },
  altMeta: { fontSize: 11, color: '#999' },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2e4053',
    paddingVertical: 15,
    borderRadius: 999,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secondaryBtnText: { fontSize: 14, color: '#2e4053', fontWeight: '600' },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: '#2e4053', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
});
