// app/onboarding.tsx
//
// First-run setup for each NEW ACCOUNT. Four steps (down from eight):
//
//   0. Birthday                       → saved once to the account, locked
//   1. Name + household size          → greeting, portion context
//   2. Anything we must avoid?        → allergies + diet on ONE screen.
//                                       Hard filters: never suggested.
//   3. A few foods you enjoy          → soft signal (favoriteTags), skippable
//
// Cuisines, foods to skip, spice, skill and time budget are asked later,
// once the app has shown something (the "Tune your tastes" card on Home →
// Settings → Food preferences), so the first run stays under a minute.
//
// What's saved here follows the account (lib/preferencesSync.ts), so
// finishing on one device means every other device skips this.

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
import { Chip, Display, PrimaryButton, SectionLabel } from '../components/ui';
import { COLORS } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import type { Allergen, DietaryTag } from '../types';
import {
  ALLERGEN_OPTIONS, DIETARY_OPTIONS, HEALTH_OPTIONS, HOUSEHOLD_OPTIONS, MORE_ALLERGEN_OPTIONS, TASTE_OPTIONS,
} from '@/constants/preferenceOptions';

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const { updatePreferences, completeOnboarding, preferences, birthDate } = useApp();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(preferences.name ?? '');
  const [household, setHousehold] = useState<number>(preferences.householdSize ?? 2);
  const [dietary, setDietary] = useState<Set<DietaryTag>>(new Set(preferences.dietary));
  const [allergens, setAllergens] = useState<Set<Allergen>>(new Set(preferences.avoidAllergens));
  const [customAllergies, setCustomAllergies] = useState<string[]>(preferences.customAllergies ?? []);
  const [customDraft, setCustomDraft] = useState('');
  const [showMoreAllergens, setShowMoreAllergens] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [loves, setLoves] = useState<Set<string>>(new Set());

  const toggle = <T,>(set: Set<T>, setter: (s: Set<T>) => void, v: T) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    setter(next);
  };

  const favoriteTags = useMemo(() => {
    const t = new Set<string>();
    TASTE_OPTIONS.filter(o => loves.has(o.id)).forEach(o => o.tags.forEach(x => t.add(x)));
    return Array.from(t);
  }, [loves]);

  const addCustomAllergy = () => {
    const v = customDraft.trim().toLowerCase();
    if (!v) return;
    if (!customAllergies.includes(v)) setCustomAllergies([...customAllergies, v]);
    setCustomDraft('');
  };

  const finish = () => {
    updatePreferences({
      name: name.trim(),
      householdSize: household,
      dietary: Array.from(dietary),
      avoidAllergens: Array.from(allergens),
      customAllergies,
      favoriteTags,
    });
    completeOnboarding();
    // Questions first, then the guided tour of the app, then Home.
    router.replace('/tour?from=onboarding');
  };

  const next = () => {
    if (step === 0 && !birthDate) return; // the birthday can't be skipped
    step < TOTAL_STEPS - 1 ? setStep(step + 1) : finish();
  };
  const back = () => step > 0 && setStep(step - 1);

  const avoidCount = allergens.size + customAllergies.length;
  const avoidSummary = [
    avoidCount > 0 ? `${avoidCount} allerg${avoidCount === 1 ? 'y' : 'ies'}` : '',
    dietary.size > 0 ? (dietary.size === 1 ? DIETARY_OPTIONS.find(o => o.key === Array.from(dietary)[0])?.label?.toLowerCase() ?? '1 diet' : `${dietary.size} diets`) : '',
  ].filter(Boolean).join(', ');

  const ctaLabel = () => {
    switch (step) {
      case 0: return 'Continue';
      case 1: return 'Continue';
      case 2: return avoidSummary ? `Continue · ${avoidSummary}` : 'Continue';
      case 3: return loves.size > 0 ? `Let’s eat · ${loves.size} picked` : 'Let’s eat';
      default: return 'Continue';
    }
  };

  const healthDiets = HEALTH_OPTIONS.filter(o => dietary.has(o.key));

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* PROGRESS */}
        <View style={styles.header}>
          {step > 0 ? (
            <TouchableOpacity onPress={back} style={styles.backBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Back">
              <FontAwesome name="chevron-left" size={15} color={COLORS.darkNavy} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={styles.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[styles.dot, i < step && styles.dotDone, i === step && styles.dotActive]} />
            ))}
          </View>
          <Text style={styles.stepCount}>{step + 1} of {TOTAL_STEPS}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ===== STEP 0 — BIRTHDAY ===== */}
          {step === 0 && (
            <View>
              <Text style={styles.brand}>BiteWise</Text>
              <Display size={27}>First, your birthday</Display>
              <Text style={styles.sub}>One quick thing before we set things up.</Text>
              <BirthdayForm />
            </View>
          )}

          {/* ===== STEP 1 — NAME + HOUSEHOLD ===== */}
          {step === 1 && (
            <View>
              <Display size={27}>Let’s set you up</Display>
              <Text style={styles.sub}>Under a minute, and you can change any of it later.</Text>

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

              <Text style={styles.fieldLabel}>Who are you usually cooking for?</Text>
              <View style={styles.segmentRow}>
                {HOUSEHOLD_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.segment, household === o.key && styles.segmentOn]}
                    onPress={() => setHousehold(o.key)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: household === o.key }}
                  >
                    <Text style={[styles.segmentText, household === o.key && styles.segmentTextOn]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ===== STEP 2 — MUST-AVOIDS (allergies + diet) ===== */}
          {step === 2 && (
            <View>
              <Display size={27}>Anything we must avoid?</Display>
              <Text style={styles.sub}>
                This is the one that matters. Anything you pick here is{' '}
                <Text style={styles.strong}>never</Text> suggested — not in picks, games, or your week.
              </Text>

              <SectionLabel tone="red" style={{ marginTop: 6, marginBottom: 10 }}>Allergies</SectionLabel>
              <View style={styles.chipWrap}>
                {ALLERGEN_OPTIONS.map(o => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    tone="red"
                    icon={allergens.has(o.key) ? 'ban' : undefined}
                    selected={allergens.has(o.key)}
                    onPress={() => toggle(allergens, setAllergens, o.key)}
                  />
                ))}
                {(showMoreAllergens ? MORE_ALLERGEN_OPTIONS : MORE_ALLERGEN_OPTIONS.filter(o => allergens.has(o.key))).map(o => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    tone="red"
                    icon={allergens.has(o.key) ? 'ban' : undefined}
                    selected={allergens.has(o.key)}
                    onPress={() => toggle(allergens, setAllergens, o.key)}
                  />
                ))}
                {customAllergies.map(c => (
                  <Chip key={c} label={c} tone="red" icon="ban" selected onPress={() => setCustomAllergies(customAllergies.filter(x => x !== c))} />
                ))}
                {!showMoreAllergens ? (
                  <TouchableOpacity style={styles.moreChip} onPress={() => setShowMoreAllergens(true)} accessibilityRole="button">
                    <Text style={styles.moreChipText}>+ More / type one</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {showMoreAllergens ? (
                <View style={styles.customRow}>
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    value={customDraft}
                    onChangeText={setCustomDraft}
                    placeholder="Something else, e.g. kiwi"
                    placeholderTextColor={COLORS.inactiveGray}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={addCustomAllergy}
                    accessibilityLabel="Add another allergy"
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addCustomAllergy} accessibilityRole="button" accessibilityLabel="Add allergy">
                    <FontAwesome name="plus" size={14} color={COLORS.cardWhite} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {allergens.has('shellfish') ? <Text style={styles.hint}>Shellfish also covers clams, mussels and squid.</Text> : null}

              <SectionLabel tone="navy" style={{ marginTop: 22, marginBottom: 10 }}>Way of eating</SectionLabel>
              <View style={styles.chipWrap}>
                {DIETARY_OPTIONS.map(o => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    icon={dietary.has(o.key) ? 'check' : undefined}
                    selected={dietary.has(o.key)}
                    onPress={() => toggle(dietary, setDietary, o.key)}
                  />
                ))}
                {(showHealth ? HEALTH_OPTIONS : healthDiets).map(o => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    icon={dietary.has(o.key) ? 'check' : undefined}
                    selected={dietary.has(o.key)}
                    onPress={() => toggle(dietary, setDietary, o.key)}
                  />
                ))}
                {!showHealth ? (
                  <TouchableOpacity style={styles.moreChip} onPress={() => setShowHealth(true)} accessibilityRole="button">
                    <Text style={styles.moreChipText}>+ Health goals</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.syncNote}>
                <FontAwesome name="shield" size={15} color={COLORS.green} />
                <Text style={styles.syncText}>Saved to your account, so your phone and the web stay in sync.</Text>
              </View>
            </View>
          )}

          {/* ===== STEP 3 — A FEW LOVES ===== */}
          {step === 3 && (
            <View>
              <Display size={27}>What do you enjoy?</Display>
              <Text style={styles.sub}>
                Tap a few. These nudge suggestions toward you; they never rule anything out.
                You can fine-tune cuisines, spice and more later.
              </Text>
              <View style={styles.tasteGrid}>
                {TASTE_OPTIONS.map(o => {
                  const on = loves.has(o.id);
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.tasteChip, on && styles.tasteChipOn]}
                      onPress={() => toggle(loves, setLoves, o.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={styles.tasteEmoji}>{o.emoji}</Text>
                      <Text style={[styles.tasteLabel, on && styles.tasteLabelOn]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        {/* FOOTER (hidden on the birthday step until it's saved: the form has its own button) */}
        {(step !== 0 || birthDate) ? (
          <View style={styles.footer}>
            <PrimaryButton label={ctaLabel()} onPress={next} disabled={step === 0 && !birthDate} />
            {step === 2 && !avoidSummary ? (
              <TouchableOpacity style={styles.skipBtn} onPress={next} activeOpacity={0.7} accessibilityRole="button">
                <Text style={styles.skipText}>Nothing to avoid — continue</Text>
              </TouchableOpacity>
            ) : null}
            {step === 3 ? (
              <TouchableOpacity style={styles.skipBtn} onPress={next} activeOpacity={0.7} accessibilityRole="button">
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
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
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderLight },
  dotDone: { backgroundColor: COLORS.darkGold },
  dotActive: { backgroundColor: COLORS.darkGold, width: 22 },
  stepCount: { width: 44, fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textAlign: 'right' },

  scroll: { paddingHorizontal: 24, paddingBottom: 24 },

  brand: {
    fontSize: 14, fontWeight: '800', letterSpacing: 1, color: COLORS.textGold, textTransform: 'uppercase', marginBottom: 6,
  },
  sub: { fontSize: 15, color: COLORS.textMuted, marginTop: 8, marginBottom: 20, lineHeight: 22 },
  strong: { fontWeight: '700', color: COLORS.textDark },
  hint: { fontSize: 12, lineHeight: 17, color: COLORS.textMuted, marginTop: 10 },

  fieldLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.darkNavy, marginTop: 18, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.darkNavy,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moreChip: {
    minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: COLORS.inactiveGray, alignItems: 'center', justifyContent: 'center',
  },
  moreChipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  addBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.darkNavy, alignItems: 'center', justifyContent: 'center' },
  syncNote: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, padding: 12, borderRadius: 14,
    backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  syncText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.textDark },

  // Taste chips (loves)
  tasteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tasteChip: {
    width: '47.5%', flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: COLORS.cardWhite, borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 12,
  },
  tasteChipOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  tasteEmoji: { fontSize: 18 },
  tasteLabel: { flexShrink: 1, fontSize: 13.5, fontWeight: '600', color: COLORS.darkNavy },
  tasteLabelOn: { color: COLORS.cardWhite },

  // Segments (household)
  segmentRow: { flexDirection: 'row', gap: 9, flexWrap: 'wrap' },
  segment: {
    flexGrow: 1, alignItems: 'center', backgroundColor: COLORS.cardWhite, borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: 13, paddingVertical: 12, paddingHorizontal: 10,
  },
  segmentOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  segmentText: { fontSize: 13.5, fontWeight: '700', color: COLORS.darkNavy, textAlign: 'center' },
  segmentTextOn: { color: COLORS.cardWhite },

  footer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 14, gap: 4 },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { fontSize: 14, color: COLORS.textGold, fontWeight: '700' },
});
