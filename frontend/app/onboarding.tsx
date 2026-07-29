// app/onboarding.tsx
//
// First-launch setup. Four quick steps:
//   1. Welcome + name
//   2. "What do you enjoy?" — taste chips that map to recipe tags
//   3. Dietary needs & allergies (hard filters)
//   4. All set
//
// Only shows once: completing it flips `hasOnboarded` in AppContext,
// which persists to AsyncStorage. The gate in app/_layout.tsx redirects
// here on first launch and never again after.
//
// Design choice: tastes are MULTI-select and completely skippable. This
// step tunes recommendations (tie-breaks + Surprise Me weighting); it
// never locks anything out. Allergies, by contrast, are hard exclusions
// downstream in the matching engine — which is exactly why both live in
// setup: one personalizes, the other protects.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import type { Allergen, DietaryTag } from '../types';

// ============================================
// TASTE OPTIONS — each maps to recipe tags
// ============================================
// Keep tag strings aligned with constants/recipes.ts. A chip can carry
// several tags so one honest answer ("I love tacos") lights up every
// handheld recipe, not just ones literally tagged "taco".

interface TasteOption {
  id: string;
  label: string;
  emoji: string;
  tags: string[];
}

const TASTE_OPTIONS: TasteOption[] = [
  // Proteins
  { id: 'chicken', label: 'Chicken', emoji: '🍗', tags: ['chicken', 'poultry'] },
  { id: 'beef', label: 'Beef & steak', emoji: '🥩', tags: ['beef', 'red-meat'] },
  { id: 'seafood', label: 'Fish & seafood', emoji: '🐟', tags: ['fish', 'seafood'] },
  { id: 'plant', label: 'Plant-based', emoji: '🫘', tags: ['beans', 'tofu', 'plant-based', 'vegetarian'] },

  // Formats
  { id: 'pasta', label: 'Pasta & noodles', emoji: '🍝', tags: ['pasta', 'noodles'] },
  { id: 'rice', label: 'Rice bowls', emoji: '🍚', tags: ['rice', 'grain', 'bowl'] },
  { id: 'handheld', label: 'Tacos & sandwiches', emoji: '🌮', tags: ['handheld', 'tortilla', 'bread', 'sandwich'] },
  { id: 'salad', label: 'Salads & fresh', emoji: '🥗', tags: ['salad', 'fresh', 'raw', 'light'] },
  { id: 'potato', label: 'Potatoes', emoji: '🥔', tags: ['potato', 'root-veg'] },
  { id: 'soup', label: 'Stews & curries', emoji: '🍲', tags: ['simmered', 'saucy', 'slow-cooked'] },

  // Cooking styles
  { id: 'grilled', label: 'Grilled & smoky', emoji: '🔥', tags: ['grilled', 'charred'] },
  { id: 'crispy', label: 'Crispy & fried', emoji: '🍤', tags: ['fried', 'crispy'] },
  { id: 'cheesy', label: 'Cheesy & creamy', emoji: '🧀', tags: ['cheesy', 'creamy', 'rich'] },

  // Flavor directions
  { id: 'comfort', label: 'Comfort classics', emoji: '🏠', tags: ['comfort', 'classic'] },
  { id: 'spicy', label: 'Spicy food', emoji: '🌶️', tags: ['spicy'] },
  { id: 'sweet', label: 'Sweet & glazed', emoji: '🍯', tags: ['sweet', 'saucy'] },
  { id: 'tangy', label: 'Bright & tangy', emoji: '🍋', tags: ['tangy', 'acidic'] },
  { id: 'global', label: 'Global flavors', emoji: '🌍', tags: ['global', 'adventurous'] },

  // Lifestyle
  { id: 'quick', label: 'Quick & easy', emoji: '⚡', tags: ['quick', 'easy', 'weeknight'] },
  { id: 'hearty', label: 'Big hearty portions', emoji: '💪', tags: ['hearty', 'portion-large'] },
];

const DIETARY_OPTIONS: { key: DietaryTag; label: string; emoji: string }[] = [
  { key: 'vegetarian', label: 'Vegetarian', emoji: '🥕' },
  { key: 'vegan', label: 'Vegan', emoji: '🌱' },
  { key: 'pescatarian', label: 'Pescatarian', emoji: '🐟' },
  { key: 'gluten-free', label: 'Gluten-free', emoji: '🌾' },
  { key: 'dairy-free', label: 'Dairy-free', emoji: '🥛' },
  { key: 'high-protein', label: 'High-protein', emoji: '💪' },
];

const ALLERGEN_OPTIONS: { key: Allergen; label: string }[] = [
  { key: 'nuts', label: 'Tree nuts' },
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'shellfish', label: 'Shellfish' },
  { key: 'fish', label: 'Fish' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'soy', label: 'Soy' },
  { key: 'gluten', label: 'Gluten' },
  { key: 'sesame', label: 'Sesame' },
];

const TOTAL_STEPS = 4;

// ============================================
// SCREEN
// ============================================

export default function OnboardingScreen() {
  const router = useRouter();
  const { updatePreferences, completeOnboarding, preferences } = useApp();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(preferences.name ?? '');
  const [tastes, setTastes] = useState<Set<string>>(new Set());
  const [dietary, setDietary] = useState<Set<DietaryTag>>(new Set(preferences.dietary));
  const [allergens, setAllergens] = useState<Set<Allergen>>(new Set(preferences.avoidAllergens));

  const toggle = <T,>(set: Set<T>, value: T, update: (s: Set<T>) => void) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    update(next);
  };

  const favoriteTags = useMemo(
    () =>
      Array.from(
        new Set(
          TASTE_OPTIONS.filter(t => tastes.has(t.id)).flatMap(t => t.tags)
        )
      ),
    [tastes]
  );

  const finish = () => {
    updatePreferences({
      name: name.trim(),
      favoriteTags,
      dietary: Array.from(dietary),
      avoidAllergens: Array.from(allergens),
    });
    completeOnboarding();
    router.replace('/');
  };

  const next = () => (step < TOTAL_STEPS - 1 ? setStep(step + 1) : finish());
  const back = () => step > 0 && setStep(step - 1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* PROGRESS DOTS */}
        <View style={styles.header}>
          {step > 0 ? (
            <TouchableOpacity onPress={back} style={styles.backBtn} activeOpacity={0.7}>
              <FontAwesome name="chevron-left" size={15} color={COLORS.darkNavy} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={styles.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ============ STEP 1 — WELCOME + NAME ============ */}
          {step === 0 && (
            <View>
              <Text style={styles.brand}>BiteWise</Text>
              <Text style={styles.h1}>Let's set you up 👋</Text>
              <Text style={styles.sub}>
                Thirty seconds of questions so every recommendation actually fits you.
                You can change all of this later.
              </Text>

              <Text style={styles.fieldLabel}>What should we call you?</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your first name"
                placeholderTextColor={COLORS.inactiveGray}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={next}
              />
            </View>
          )}

          {/* ============ STEP 2 — TASTES ============ */}
          {step === 1 && (
            <View>
              <Text style={styles.h1}>What do you enjoy{name.trim() ? `, ${name.trim()}` : ''}?</Text>
              <Text style={styles.sub}>
                Pick as many as you like. We'll lean your recommendations toward these —
                nothing gets hidden.
              </Text>

              <View style={styles.chipGrid}>
                {TASTE_OPTIONS.map(opt => {
                  const on = tastes.has(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.tasteChip, on && styles.tasteChipOn]}
                      activeOpacity={0.8}
                      onPress={() => toggle(tastes, opt.id, setTastes)}
                    >
                      <Text style={styles.tasteEmoji}>{opt.emoji}</Text>
                      <Text style={[styles.tasteLabel, on && styles.tasteLabelOn]}>
                        {opt.label}
                      </Text>
                      {on && (
                        <View style={styles.check}>
                          <FontAwesome name="check" size={9} color={COLORS.cardWhite} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ============ STEP 3 — DIETARY + ALLERGIES ============ */}
          {step === 2 && (
            <View>
              <Text style={styles.h1}>Any dietary needs?</Text>
              <Text style={styles.sub}>
                These are strict — we'll never show a recipe that breaks them.
              </Text>

              <Text style={styles.fieldLabel}>I eat…</Text>
              <View style={styles.chipGrid}>
                {DIETARY_OPTIONS.map(opt => {
                  const on = dietary.has(opt.key);
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.smallChip, on && styles.smallChipOn]}
                      activeOpacity={0.8}
                      onPress={() => toggle(dietary, opt.key, setDietary)}
                    >
                      <Text style={styles.smallChipEmoji}>{opt.emoji}</Text>
                      <Text style={[styles.smallChipText, on && styles.smallChipTextOn]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 28 }]}>Allergies to avoid</Text>
              <View style={styles.chipGrid}>
                {ALLERGEN_OPTIONS.map(opt => {
                  const on = allergens.has(opt.key);
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.smallChip, on && styles.allergenChipOn]}
                      activeOpacity={0.8}
                      onPress={() => toggle(allergens, opt.key, setAllergens)}
                    >
                      <Text style={[styles.smallChipText, on && styles.allergenChipTextOn]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ============ STEP 4 — DONE ============ */}
          {step === 3 && (
            <View style={styles.doneWrap}>
              <Text style={styles.doneEmoji}>🎉</Text>
              <Text style={styles.h1Center}>
                You're all set{name.trim() ? `, ${name.trim()}` : ''}!
              </Text>
              <Text style={styles.subCenter}>
                {tastes.size > 0
                  ? `We'll tune your picks toward the ${tastes.size} taste${
                      tastes.size === 1 ? '' : 's'
                    } you chose.`
                  : "You skipped tastes — no problem, the quiz will figure you out."}
                {'\n\n'}
                Play "This or That" when you can't decide, or hit Surprise Me to
                get a meal instantly.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* FOOTER */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={next} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>
              {step === 0 && 'Get started'}
              {step === 1 && (tastes.size > 0 ? `Continue (${tastes.size} picked)` : 'Continue')}
              {step === 2 && 'Continue'}
              {step === 3 && "Let's eat"}
            </Text>
            <FontAwesome name="arrow-right" size={14} color={COLORS.cardWhite} />
          </TouchableOpacity>

          {(step === 1 || step === 2) && (
            <TouchableOpacity style={styles.skipBtn} onPress={next} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderLight,
  },
  dotActive: { backgroundColor: COLORS.goldYellow, width: 22 },

  scroll: { paddingHorizontal: 24, paddingBottom: 24, flexGrow: 1 },

  brand: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.darkGold,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.darkNavy,
    marginTop: 10,
    lineHeight: 36,
  },
  h1Center: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.darkNavy,
    textAlign: 'center',
    lineHeight: 36,
  },
  sub: { fontSize: 15, color: COLORS.textMuted, marginTop: 10, lineHeight: 22, marginBottom: 24 },
  subCenter: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginTop: 14,
    lineHeight: 23,
    textAlign: 'center',
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkNavy,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: COLORS.darkNavy,
  },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  tasteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tasteChipOn: {
    backgroundColor: COLORS.lightYellow,
    borderColor: COLORS.goldYellow,
  },
  tasteEmoji: { fontSize: 16 },
  tasteLabel: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  tasteLabelOn: { color: COLORS.darkGold },
  check: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.darkGold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  smallChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  smallChipOn: { backgroundColor: COLORS.lightYellow, borderColor: COLORS.goldYellow },
  smallChipEmoji: { fontSize: 14 },
  smallChipText: { fontSize: 13, fontWeight: '600', color: COLORS.darkNavy },
  smallChipTextOn: { color: COLORS.darkGold },

  allergenChipOn: { backgroundColor: '#FDECEA', borderColor: COLORS.redAccent },
  allergenChipTextOn: { color: COLORS.redAccent },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  doneEmoji: { fontSize: 60, marginBottom: 16 },

  footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 17,
  },
  primaryBtnText: { color: COLORS.cardWhite, fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
});
