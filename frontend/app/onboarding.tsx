// app/onboarding.tsx
//
// First-launch setup for each NEW ACCOUNT (storage is per-user now, so
// every fresh account goes through this once). Seven detailed steps:
//
//   0. Name + household size        → greeting, portion context
//   1. Dietary lifestyle            → hard filter in matching
//   2. Allergies & must-avoids      → hard filter, safety-critical
//   3. Cuisines you love            → soft signal
//   4. Foods & flavors you enjoy    → soft signal (favoriteTags)
//   5. Foods you'd rather skip      → soft signal (dislikedTags)
//   6. Spice, skill & time          → tunes recommendations
//
// Soft signals steer quiz tie-breaks and the Surprise Me randomizer.
// Hard filters (diet + allergens) exclude recipes outright.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import type { Allergen, DietaryTag, Difficulty } from '../types';

// ============================================
// OPTIONS
// ============================================
// Taste chips map to recipe tags in constants/recipes.ts. One chip can
// carry several tags so an honest answer lights up every related recipe.

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

const DIETARY_OPTIONS: { key: DietaryTag; label: string; emoji: string; hint?: string }[] = [
  { key: 'vegetarian', label: 'Vegetarian', emoji: '🥕', hint: 'No meat or fish' },
  { key: 'vegan', label: 'Vegan', emoji: '🌱', hint: 'No animal products' },
  { key: 'pescatarian', label: 'Pescatarian', emoji: '🐟', hint: 'Fish yes, meat no' },
  { key: 'gluten-free', label: 'Gluten-free', emoji: '🌾' },
  { key: 'dairy-free', label: 'Dairy-free', emoji: '🥛' },
  { key: 'high-protein', label: 'High-protein', emoji: '💪' },
  { key: 'low-carb', label: 'Low-carb', emoji: '📉' },
  { key: 'halal', label: 'Halal', emoji: '☪️' },
  { key: 'kosher-style', label: 'Kosher-style', emoji: '✡️' },
  { key: 'keto', label: 'Keto', emoji: '🥑' },
  { key: 'paleo', label: 'Paleo', emoji: '🦴' },
];

const ALLERGEN_OPTIONS: { key: Allergen; label: string; emoji: string }[] = [
  { key: 'peanuts', label: 'Peanuts', emoji: '🥜' },
  { key: 'nuts', label: 'Tree nuts', emoji: '🌰' },
  { key: 'shellfish', label: 'Shellfish', emoji: '🦐' },
  { key: 'fish', label: 'Fish', emoji: '🐟' },
  { key: 'eggs', label: 'Eggs', emoji: '🥚' },
  { key: 'dairy', label: 'Dairy', emoji: '🥛' },
  { key: 'soy', label: 'Soy', emoji: '🫛' },
  { key: 'gluten', label: 'Gluten / wheat', emoji: '🌾' },
  { key: 'sesame', label: 'Sesame', emoji: '🫓' },
  { key: 'mustard', label: 'Mustard', emoji: '🟡' },
  { key: 'coconut', label: 'Coconut', emoji: '🥥' },
  { key: 'corn', label: 'Corn', emoji: '🌽' },
];

const CUISINE_OPTIONS: { id: string; label: string; emoji: string }[] = [
  { id: 'american', label: 'American', emoji: '🍔' },
  { id: 'italian', label: 'Italian', emoji: '🍕' },
  { id: 'mexican', label: 'Mexican', emoji: '🌮' },
  { id: 'chinese', label: 'Chinese', emoji: '🥡' },
  { id: 'japanese', label: 'Japanese', emoji: '🍣' },
  { id: 'thai', label: 'Thai', emoji: '🍜' },
  { id: 'indian', label: 'Indian', emoji: '🍛' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
  { id: 'middle-eastern', label: 'Middle Eastern', emoji: '🧆' },
  { id: 'korean', label: 'Korean', emoji: '🍲' },
  { id: 'caribbean', label: 'Caribbean', emoji: '🏝️' },
  { id: 'soul', label: 'Southern / Soul', emoji: '🍗' },
];

const SPICE_OPTIONS: { key: 'mild' | 'medium' | 'hot'; label: string; emoji: string; hint: string }[] = [
  { key: 'mild', label: 'Mild', emoji: '😌', hint: 'Keep it gentle' },
  { key: 'medium', label: 'Medium', emoji: '🌶️', hint: 'Some kick is good' },
  { key: 'hot', label: 'Hot', emoji: '🔥', hint: 'Bring the heat' },
];

const SKILL_OPTIONS: { key: Difficulty; label: string; emoji: string; hint: string }[] = [
  { key: 'easy', label: 'Beginner', emoji: '🥄', hint: 'Simple steps, few pans' },
  { key: 'medium', label: 'Comfortable', emoji: '🍳', hint: 'Happy to follow a real recipe' },
  { key: 'hard', label: 'Confident', emoji: '👨‍🍳', hint: 'Bring on the technique' },
];

const TIME_OPTIONS: { key: number | null; label: string }[] = [
  { key: 15, label: '15 min' },
  { key: 30, label: '30 min' },
  { key: 45, label: '45 min' },
  { key: null, label: 'No limit' },
];

const HOUSEHOLD_OPTIONS: { key: number; label: string }[] = [
  { key: 1, label: 'Just me' },
  { key: 2, label: '2 people' },
  { key: 4, label: '3–4' },
  { key: 6, label: '5+' },
];

const TOTAL_STEPS = 7;

// ============================================
// SCREEN
// ============================================

export default function OnboardingScreen() {
  const router = useRouter();
  const { updatePreferences, completeOnboarding, preferences } = useApp();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(preferences.name ?? '');
  const [household, setHousehold] = useState<number>(preferences.householdSize ?? 2);
  const [dietary, setDietary] = useState<Set<DietaryTag>>(new Set(preferences.dietary));
  const [allergens, setAllergens] = useState<Set<Allergen>>(new Set(preferences.avoidAllergens));
  const [cuisines, setCuisines] = useState<Set<string>>(new Set(preferences.cuisines));
  const [loves, setLoves] = useState<Set<string>>(new Set());
  const [dislikes, setDislikes] = useState<Set<string>>(new Set());
  const [spice, setSpice] = useState<'mild' | 'medium' | 'hot' | null>(preferences.spiceTolerance);
  const [skill, setSkill] = useState<Difficulty | null>(preferences.preferredDifficulty);
  const [maxTime, setMaxTime] = useState<number | null>(preferences.maxCookMinutes);

  const toggle = <T,>(set: Set<T>, setter: (s: Set<T>) => void, v: T) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    setter(next);
  };

  // A food can't be loved and avoided at once — picking on one screen
  // clears it from the other.
  const toggleLove = (id: string) => {
    toggle(loves, setLoves, id);
    if (dislikes.has(id)) toggle(dislikes, setDislikes, id);
  };
  const toggleDislike = (id: string) => {
    toggle(dislikes, setDislikes, id);
    if (loves.has(id)) toggle(loves, setLoves, id);
  };

  const favoriteTags = useMemo(() => {
    const t = new Set<string>();
    TASTE_OPTIONS.filter(o => loves.has(o.id)).forEach(o => o.tags.forEach(x => t.add(x)));
    return Array.from(t);
  }, [loves]);

  const dislikedTags = useMemo(() => {
    const t = new Set<string>();
    TASTE_OPTIONS.filter(o => dislikes.has(o.id)).forEach(o => o.tags.forEach(x => t.add(x)));
    return Array.from(t);
  }, [dislikes]);

  const finish = () => {
    updatePreferences({
      name: name.trim(),
      householdSize: household,
      dietary: Array.from(dietary),
      avoidAllergens: Array.from(allergens),
      cuisines: Array.from(cuisines),
      favoriteTags,
      dislikedTags,
      spiceTolerance: spice,
      preferredDifficulty: skill,
      maxCookMinutes: maxTime,
    });
    completeOnboarding();
    router.replace('/');
  };

  const next = () => (step < TOTAL_STEPS - 1 ? setStep(step + 1) : finish());
  const back = () => step > 0 && setStep(step - 1);

  // Steps where skipping is fine (soft signals). Diet/allergy steps keep
  // a "None apply" feel via just tapping Continue with nothing selected.
  const skippable = step >= 3 && step <= 5;

  const ctaLabel = () => {
    switch (step) {
      case 0: return 'Get started';
      case 1: return dietary.size > 0 ? `Continue (${dietary.size} selected)` : 'No restrictions — continue';
      case 2: return allergens.size > 0 ? `Continue (${allergens.size} selected)` : 'No allergies — continue';
      case 3: return cuisines.size > 0 ? `Continue (${cuisines.size} picked)` : 'Continue';
      case 4: return loves.size > 0 ? `Continue (${loves.size} picked)` : 'Continue';
      case 5: return dislikes.size > 0 ? `Continue (${dislikes.size} to avoid)` : 'Continue';
      case 6: return "Let's eat";
      default: return 'Continue';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* PROGRESS */}
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
          {/* ===== STEP 0 — NAME + HOUSEHOLD ===== */}
          {step === 0 && (
            <View>
              <Text style={styles.brand}>BiteWise</Text>
              <Text style={styles.h1}>Let's set you up 👋</Text>
              <Text style={styles.sub}>
                A minute of questions so every recommendation actually fits you.
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
              />

              <Text style={styles.fieldLabel}>Who are you usually cooking for?</Text>
              <View style={styles.segmentRow}>
                {HOUSEHOLD_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.segment, household === o.key && styles.segmentOn]}
                    onPress={() => setHousehold(o.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, household === o.key && styles.segmentTextOn]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ===== STEP 1 — DIETARY ===== */}
          {step === 1 && (
            <View>
              <Text style={styles.h1}>Any dietary lifestyle?</Text>
              <Text style={styles.sub}>
                We'll only show recipes that fit. Pick all that apply — or none.
              </Text>
              <View style={styles.chipGrid}>
                {DIETARY_OPTIONS.map(o => {
                  const on = dietary.has(o.key);
                  return (
                    <TouchableOpacity
                      key={o.key}
                      style={[styles.smallChip, on && styles.smallChipOn]}
                      onPress={() => toggle(dietary, setDietary, o.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.smallChipEmoji}>{o.emoji}</Text>
                      <View style={styles.chipTextWrap}>
                        <Text style={[styles.smallChipText, on && styles.smallChipTextOn]}>
                          {o.label}
                        </Text>
                        {o.hint ? <Text style={styles.chipHint}>{o.hint}</Text> : null}
                      </View>
                      {on && <FontAwesome name="check" size={12} color={COLORS.cardWhite} style={styles.check} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ===== STEP 2 — ALLERGIES ===== */}
          {step === 2 && (
            <View>
              <Text style={styles.h1}>Allergies or must-avoids? 🚫</Text>
              <Text style={styles.sub}>
                This one matters most — anything you select is completely
                excluded from every recommendation, quiz result, and Surprise Me.
              </Text>
              <View style={styles.chipGrid}>
                {ALLERGEN_OPTIONS.map(o => {
                  const on = allergens.has(o.key);
                  return (
                    <TouchableOpacity
                      key={o.key}
                      style={[styles.smallChip, on && styles.allergenChipOn]}
                      onPress={() => toggle(allergens, setAllergens, o.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.smallChipEmoji}>{o.emoji}</Text>
                      <Text style={[styles.smallChipText, on && styles.allergenChipTextOn]}>
                        {o.label}
                      </Text>
                      {on && <FontAwesome name="ban" size={12} color={COLORS.cardWhite} style={styles.check} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ===== STEP 3 — CUISINES ===== */}
          {step === 3 && (
            <View>
              <Text style={styles.h1}>Cuisines you love 🌍</Text>
              <Text style={styles.sub}>
                Pick your go-tos. We'll lean toward these flavors when it's a
                close call.
              </Text>
              <View style={styles.chipGrid}>
                {CUISINE_OPTIONS.map(o => {
                  const on = cuisines.has(o.id);
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.smallChip, on && styles.smallChipOn]}
                      onPress={() => toggle(cuisines, setCuisines, o.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.smallChipEmoji}>{o.emoji}</Text>
                      <Text style={[styles.smallChipText, on && styles.smallChipTextOn]}>
                        {o.label}
                      </Text>
                      {on && <FontAwesome name="check" size={12} color={COLORS.cardWhite} style={styles.check} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ===== STEP 4 — FOODS YOU ENJOY ===== */}
          {step === 4 && (
            <View>
              <Text style={styles.h1}>What do you enjoy? 😋</Text>
              <Text style={styles.sub}>
                Tap everything that sounds good. The more you pick, the smarter
                your matches get.
              </Text>
              <View style={styles.chipGrid}>
                {TASTE_OPTIONS.map(o => {
                  const on = loves.has(o.id);
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.tasteChip, on && styles.tasteChipOn]}
                      onPress={() => toggleLove(o.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.tasteEmoji}>{o.emoji}</Text>
                      <Text style={[styles.tasteLabel, on && styles.tasteLabelOn]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ===== STEP 5 — FOODS TO SKIP ===== */}
          {step === 5 && (
            <View>
              <Text style={styles.h1}>Anything you'd rather skip? 🙅</Text>
              <Text style={styles.sub}>
                Not allergies — just foods that aren't your thing. We'll steer
                recommendations away from these.
              </Text>
              <View style={styles.chipGrid}>
                {TASTE_OPTIONS.map(o => {
                  const on = dislikes.has(o.id);
                  const loved = loves.has(o.id);
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[
                        styles.tasteChip,
                        on && styles.dislikeChipOn,
                        loved && styles.chipDimmed,
                      ]}
                      onPress={() => toggleDislike(o.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.tasteEmoji}>{o.emoji}</Text>
                      <Text style={[styles.tasteLabel, on && styles.tasteLabelOn]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ===== STEP 6 — SPICE, SKILL, TIME ===== */}
          {step === 6 && (
            <View>
              <Text style={styles.h1}>How do you cook? 🍳</Text>
              <Text style={styles.sub}>Last one — this tunes what we suggest.</Text>

              <Text style={styles.fieldLabel}>Spice tolerance</Text>
              <View style={styles.segmentRow}>
                {SPICE_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.segmentTall, spice === o.key && styles.segmentOn]}
                    onPress={() => setSpice(spice === o.key ? null : o.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.segmentEmoji}>{o.emoji}</Text>
                    <Text style={[styles.segmentText, spice === o.key && styles.segmentTextOn]}>
                      {o.label}
                    </Text>
                    <Text style={styles.segmentHint}>{o.hint}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Comfort in the kitchen</Text>
              <View style={styles.segmentRow}>
                {SKILL_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.segmentTall, skill === o.key && styles.segmentOn]}
                    onPress={() => setSkill(skill === o.key ? null : o.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.segmentEmoji}>{o.emoji}</Text>
                    <Text style={[styles.segmentText, skill === o.key && styles.segmentTextOn]}>
                      {o.label}
                    </Text>
                    <Text style={styles.segmentHint}>{o.hint}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Weeknight time budget</Text>
              <View style={styles.segmentRow}>
                {TIME_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={String(o.key)}
                    style={[styles.segment, maxTime === o.key && styles.segmentOn]}
                    onPress={() => setMaxTime(o.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, maxTime === o.key && styles.segmentTextOn]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* FOOTER */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={next} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>{ctaLabel()}</Text>
          </TouchableOpacity>
          {skippable && (
            <TouchableOpacity style={styles.skipBtn} onPress={next} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip this step</Text>
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
    paddingVertical: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.borderLight },
  dotActive: { backgroundColor: COLORS.darkGold, width: 20 },

  scroll: { paddingHorizontal: 24, paddingBottom: 24 },

  brand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.darkGold,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  h1: { fontSize: 27, fontWeight: '700', color: COLORS.darkNavy, lineHeight: 34, marginTop: 4 },
  sub: { fontSize: 15, color: COLORS.textMuted, marginTop: 8, marginBottom: 20, lineHeight: 22 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkNavy,
    marginTop: 18,
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
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.darkNavy,
  },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Small chips (dietary / allergens / cuisines)
  smallChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  smallChipOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  allergenChipOn: { backgroundColor: COLORS.redAccent, borderColor: COLORS.redAccent },
  smallChipEmoji: { fontSize: 15 },
  chipTextWrap: { flexShrink: 1 },
  smallChipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  smallChipTextOn: { color: COLORS.cardWhite },
  allergenChipTextOn: { color: COLORS.cardWhite },
  chipHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  check: { marginLeft: 2 },

  // Taste chips (loves / dislikes)
  tasteChip: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tasteChipOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  dislikeChipOn: { backgroundColor: COLORS.redAccent, borderColor: COLORS.redAccent },
  chipDimmed: { opacity: 0.35 },
  tasteEmoji: { fontSize: 18 },
  tasteLabel: { flexShrink: 1, fontSize: 13.5, fontWeight: '600', color: COLORS.darkNavy },
  tasteLabelOn: { color: COLORS.cardWhite },

  // Segments (household / spice / skill / time)
  segmentRow: { flexDirection: 'row', gap: 9, flexWrap: 'wrap' },
  segment: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  segmentTall: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 8,
    gap: 3,
  },
  segmentOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  segmentEmoji: { fontSize: 20 },
  segmentText: { fontSize: 13.5, fontWeight: '700', color: COLORS.darkNavy, textAlign: 'center' },
  segmentTextOn: { color: COLORS.cardWhite },
  segmentHint: { fontSize: 10.5, color: COLORS.textMuted, textAlign: 'center' },

  footer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 14, gap: 4 },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 16,
  },
  primaryBtnText: { color: COLORS.cardWhite, fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { fontSize: 14, color: COLORS.darkGold, fontWeight: '700' },
});
