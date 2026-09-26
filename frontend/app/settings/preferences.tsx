// app/settings/preferences.tsx — Settings → Food preferences.
// Change everything from onboarding, any time.
//
// Every tap saves immediately (same as hearts), so there's no "unsaved
// changes" state. Users can also type their own:
//   * allergies not in the list ("kiwi")          -> never suggested
//   * foods to avoid ("mushrooms")                -> never suggested
//   * foods they love ("garlic")                  -> suggested more, with the reason
// See utils/customFoods.ts for how those are matched to recipes.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import {
  ALLERGEN_OPTIONS, CUISINE_OPTIONS, DIETARY_OPTIONS, HEALTH_OPTIONS, HOUSEHOLD_OPTIONS, MORE_ALLERGEN_OPTIONS,
  SKILL_OPTIONS, SPICE_OPTIONS, TASTE_OPTIONS, TIME_OPTIONS, tagsForTasteIds, tasteIdsForTags,
} from '@/constants/preferenceOptions';
import { useApp } from '@/context/AppContext';
import { cleanFoodEntry, foodWords } from '@/utils/customFoods';
import type { Allergen, DietaryTag, UserPreferences } from '@/types';

export default function FoodPreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { preferences: p, updatePreferences } = useApp();
  const [savedNote, setSavedNote] = useState(false);

  // Save a change right away and flash "Saved".
  const save = (patch: Partial<UserPreferences>) => {
    updatePreferences(patch);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 1200);
  };

  const toggleIn = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  // Loves / dislikes are stored as recipe tags; show them as the options they came from.
  const loveIds = useMemo(() => tasteIdsForTags(p.favoriteTags), [p.favoriteTags]);
  const dislikeIds = useMemo(() => tasteIdsForTags(p.dislikedTags), [p.dislikedTags]);
  const toggleTaste = (id: string, which: 'love' | 'dislike') => {
    const loves = new Set(loveIds);
    const dislikes = new Set(dislikeIds);
    const [mine, other] = which === 'love' ? [loves, dislikes] : [dislikes, loves];
    if (mine.has(id)) mine.delete(id);
    else {
      mine.add(id);
      other.delete(id);   // can't both love and dislike the same thing
    }
    save({ favoriteTags: tagsForTasteIds(loves), dislikedTags: tagsForTasteIds(dislikes) });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <FontAwesome name="chevron-left" size={16} color={COLORS.darkNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food preferences</Text>
        <View style={styles.iconBtn}>
          {savedNote ? <Text style={styles.saved}>Saved ✓</Text> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>Changes save as you tap. Everything BiteWise suggests follows these.</Text>

        <Section title="Allergies" subtitle="Recipes with these are never suggested.">
          <Chips
            options={[...ALLERGEN_OPTIONS, ...MORE_ALLERGEN_OPTIONS].map(o => ({ key: o.key, label: `${o.emoji} ${o.label}` }))}
            selected={p.avoidAllergens}
            onToggle={k => save({ avoidAllergens: toggleIn(p.avoidAllergens, k as Allergen) })}
            danger
          />
          <CustomList
            label="Something else?"
            placeholder="e.g. kiwi, cinnamon"
            items={p.customAllergies ?? []}
            onChange={items => save({ customAllergies: items })}
            danger
          />
          {(p.customAllergies ?? []).length > 0 ? (
            <Text style={styles.hint}>
              We hide any recipe that mentions these, plus any recipe with ingredients we couldn't check.
              Hidden sources (like spice blends) can slip through, so always check labels.
            </Text>
          ) : null}
        </Section>

        <Section title="Diet">
          <Chips
            options={DIETARY_OPTIONS.map(o => ({ key: o.key, label: `${o.emoji} ${o.label}` }))}
            selected={p.dietary}
            onToggle={k => save({ dietary: toggleIn(p.dietary, k as DietaryTag) })}
          />
        </Section>

        <Section title="Health goals" subtitle="Suggestions only include recipes that fit every goal you pick.">
          <Chips
            options={HEALTH_OPTIONS.map(o => ({ key: o.key, label: `${o.emoji} ${o.label}`, hint: o.hint }))}
            selected={p.dietary}
            onToggle={k => save({ dietary: toggleIn(p.dietary, k as DietaryTag) })}
          />
          <Text style={styles.hint}>Based on estimated nutrition — not medical advice.</Text>
        </Section>

        <Section title="Foods you love">
          <Chips
            options={TASTE_OPTIONS.map(o => ({ key: o.id, label: `${o.emoji} ${o.label}` }))}
            selected={loveIds}
            onToggle={k => toggleTaste(k, 'love')}
          />
          <CustomList
            label="Add your own"
            placeholder="e.g. garlic, avocado"
            items={p.customLoves ?? []}
            onChange={items => save({ customLoves: items })}
          />
        </Section>

        <Section title="Foods you'd rather avoid">
          <Chips
            options={TASTE_OPTIONS.map(o => ({ key: o.id, label: `${o.emoji} ${o.label}` }))}
            selected={dislikeIds}
            onToggle={k => toggleTaste(k, 'dislike')}
          />
          <CustomList
            label="Never suggest"
            placeholder="e.g. mushrooms, olives"
            items={p.customAvoid ?? []}
            onChange={items => save({ customAvoid: items })}
          />
          <Text style={styles.hint}>
            The options above just nudge suggestions; foods you type here are never suggested.
          </Text>
        </Section>

        <Section title="Favorite cuisines">
          <Chips
            options={CUISINE_OPTIONS.map(o => ({ key: o.id, label: `${o.emoji} ${o.label}` }))}
            selected={p.cuisines}
            onToggle={k => save({ cuisines: toggleIn(p.cuisines, k) })}
          />
        </Section>

        <Section title="Spice level">
          <Chips
            options={SPICE_OPTIONS.map(o => ({ key: o.key, label: `${o.emoji} ${o.label}` }))}
            selected={p.spiceTolerance ? [p.spiceTolerance] : []}
            onToggle={k => save({ spiceTolerance: p.spiceTolerance === k ? null : (k as UserPreferences['spiceTolerance']) })}
          />
        </Section>

        <Section title="Cooking skill">
          <Chips
            options={SKILL_OPTIONS.map(o => ({ key: o.key, label: `${o.emoji} ${o.label}` }))}
            selected={p.preferredDifficulty ? [p.preferredDifficulty] : []}
            onToggle={k => save({ preferredDifficulty: p.preferredDifficulty === k ? null : (k as UserPreferences['preferredDifficulty']) })}
          />
        </Section>

        <Section title="Time to cook">
          <Chips
            options={TIME_OPTIONS.map(o => ({ key: String(o.key), label: o.label }))}
            selected={[String(p.maxCookMinutes)]}
            onToggle={k => save({ maxCookMinutes: k === 'null' ? null : Number(k) })}
          />
        </Section>

        <Section title="Cooking for">
          <Chips
            options={HOUSEHOLD_OPTIONS.map(o => ({ key: String(o.key), label: o.label }))}
            selected={[String(p.householdSize)]}
            onToggle={k => save({ householdSize: Number(k) })}
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function Chips({ options, selected, onToggle, danger = false }: {
  options: { key: string; label: string; hint?: string }[];
  selected: string[];
  onToggle: (key: string) => void;
  danger?: boolean;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map(o => {
        const on = selected.includes(o.key);
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.chip, on && (danger ? styles.chipDanger : styles.chipOn)]}
            onPress={() => onToggle(o.key)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CustomList({ label, placeholder, items, onChange, danger = false }: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
  danger?: boolean;
}) {
  const [text, setText] = useState('');
  const add = () => {
    const entry = cleanFoodEntry(text);
    if (!entry || foodWords(entry).length === 0) return;
    // No duplicates, ignoring case and plurals ("Kiwis" = "kiwi").
    const key = foodWords(entry).join(' ');
    if (!items.some(i => foodWords(i).join(' ') === key)) onChange([...items, entry]);
    setText('');
  };
  return (
    <View style={styles.custom}>
      <Text style={styles.customLabel}>{label}</Text>
      <View style={styles.customRow}>
        <TextInput
          style={[styles.input, styles.flex1]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.inactiveGray}
          onSubmitEditing={add}
          returnKeyType="done"
          maxLength={40}
          autoCapitalize="none"
        />
        <TouchableOpacity style={[styles.addBtn, !text.trim() && { opacity: 0.5 }]} onPress={add} disabled={!text.trim()}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>
      {items.length > 0 ? (
        <View style={styles.chipWrap}>
          {items.map(item => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, danger ? styles.chipDanger : styles.chipOn, styles.removable]}
              onPress={() => onChange(items.filter(i => i !== item))}
              accessibilityLabel={`Remove ${item}`}
            >
              <Text style={[styles.chipText, styles.chipTextOn]}>{item}</Text>
              <FontAwesome name="times" size={12} color={COLORS.cardWhite} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { minWidth: 64, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.darkNavy },
  saved: { fontSize: 13, fontWeight: '700', color: COLORS.darkGold },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  intro: { fontSize: 14, color: COLORS.textMuted, lineHeight: 20, marginBottom: 8 },
  section: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    marginTop: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy },
  sectionSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  hint: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, marginTop: 10 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textDark,
    marginTop: 10,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chipOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  chipDanger: { backgroundColor: COLORS.redAccent, borderColor: COLORS.redAccent },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  chipTextOn: { color: COLORS.cardWhite },
  removable: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  custom: { marginTop: 14 },
  customLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { backgroundColor: COLORS.goldYellow, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginTop: 10 },
  addText: { fontWeight: '700', color: COLORS.darkNavy },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.redAccent,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: COLORS.redAccent },
});
