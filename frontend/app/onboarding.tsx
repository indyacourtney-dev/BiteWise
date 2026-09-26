// app/onboarding.tsx
//
// First-launch setup for each NEW ACCOUNT (storage is per-user now, so
// every fresh account goes through this once). Eight steps:
//
//   0. Birthday (can't skip)        → age safeguard: locked once saved;
//                                     alcohol recipes only for 21+
//   1. Name + household size        → greeting, portion context
//   2. Dietary lifestyle            → hard filter in matching
//   3. Allergies & must-avoids      → hard filter, safety-critical
//   4. Cuisines you love            → soft signal
//   5. Foods & flavors you enjoy    → soft signal (favoriteTags)
//   6. Foods you'd rather skip      → soft signal (dislikedTags)
//   7. Spice, skill & time          → tunes recommendations
//
// Soft signals steer quiz tie-breaks, This or That and Decide for me.
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

import BirthdayForm from '../components/BirthdayForm';
import { COLORS } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import type { Allergen, DietaryTag, Difficulty } from '../types';
import {
  ALLERGEN_OPTIONS, CUISINE_OPTIONS, DIETARY_OPTIONS, HOUSEHOLD_OPTIONS, SKILL_OPTIONS, SPICE_OPTIONS,
  TASTE_OPTIONS, TIME_OPTIONS,
} from '@/constants/preferenceOptions';

// ============================================
// OPTIONS
// ============================================
// Taste chips map to recipe tags in constants/recipes.ts. One chip can
// carry several tags so an honest answer lights up every related recipe.

const TOTAL_STEPS = 8;

// ============================================
// SCREEN
// ============================================

export default function OnboardingScreen() {
  const router = useRouter();
  const { updatePreferences, completeOnboarding, preferences, birthDate } = useApp();

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

  const next = () => {
    if (step === 0 && !birthDate) return; // the age check can't be skipped
    step < TOTAL_STEPS - 1 ? setStep(step + 1) : finish();
  };
  const back = () => step > 0 && setStep(step - 1);

  // Steps where skipping is fine (soft signals). Diet/allergy steps keep
  // a "None apply" feel via just tapping Continue with nothing selected.
  const skippable = step >= 4 && step <= 6;

  const ctaLabel = () => {
    switch (step) {
      case 0: return 'Continue';
      case 1: return 'Get started';
      case 2: return dietary.size > 0 ? `Continue (${dietary.size} selected)` : 'No restrictions — continue';
      case 3: return allergens.size > 0 ? `Continue (${allergens.size} selected)` : 'No allergies — continue';
      case 4: return cuisines.size > 0 ? `Continue (${cuisines.size} picked)` : 'Continue';
      case 5: return loves.size > 0 ? `Continue (${loves.size} picked)` : 'Continue';
      case 6: return dislikes.size > 0 ? `Continue (${dislikes.size} to avoid)` : 'Continue';
      case 7: return "Let's eat";
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
          {/* ===== STEP 0 — BIRTHDAY (age safeguard) ===== */}
          {step === 0 && (
            <View>
              <Text style={styles.brand}>BiteWise</Text>
              <Text style={styles.h1}>First, your birthday 🎂</Text>
              <Text style={styles.sub}>One quick check before we set things up.</Text>
              <BirthdayForm />
            </View>
          )}

          {/* ===== STEP 1 — NAME + HOUSEHOLD ===== */}
          {step === 1 && (
            <View>
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

          {/* ===== STEP 2 — DIETARY ===== */}
          {step === 2 && (
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

          {/* ===== STEP 3 — ALLERGIES ===== */}
          {step === 3 && (
            <View>
              <Text style={styles.h1}>Allergies or must-avoids? 🚫</Text>
              <Text style={styles.sub}>
                This one matters most — anything you select is completely
                excluded from every recommendation, quiz result, and pick we make for you.
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

          {/* ===== STEP 4 — CUISINES ===== */}
          {step === 4 && (
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

          {/* ===== STEP 5 — FOODS YOU ENJOY ===== */}
          {step === 5 && (
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

          {/* ===== STEP 6 — FOODS TO SKIP ===== */}
          {step === 6 && (
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

          {/* ===== STEP 7 — SPICE, SKILL, TIME ===== */}
          {step === 7 && (
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

        {/* FOOTER (hidden on the birthday step until it's saved: the form has its own button) */}
        {(step !== 0 || birthDate) && <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, step === 0 && !birthDate && styles.primaryBtnDisabled]}
            onPress={next}
            disabled={step === 0 && !birthDate}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>{ctaLabel()}</Text>
          </TouchableOpacity>
          {skippable && (
            <TouchableOpacity style={styles.skipBtn} onPress={next} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip this step</Text>
            </TouchableOpacity>
          )}
        </View>}
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
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { color: COLORS.cardWhite, fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { fontSize: 14, color: COLORS.darkGold, fontWeight: '700' },
});
