// app/shareRecipe.tsx — share a home recipe with everyone (Task 1.7)
//
// The recipe goes into the shared recipe database. The database matches the
// ingredients to its catalog and works out allergens and diet tags itself
// (users can't set those), then it's suggested to other people, can be
// hearted, and can be shared into chat rooms.

import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import ShareToRoomModal from '@/components/ShareToRoomModal';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { shareHomeRecipe } from '@/lib/communityApi';
import { clearRecipeLibraryCache } from '@/hooks/useRecipeLibrary';
import { MEAL_INFO, MEAL_TYPES } from '@/utils/meals';
import { recipeHasAlcohol } from '@/utils/alcohol';
import type { Difficulty, Ingredient, MealType, Recipe, Vibe } from '@/types';

const EMOJIS = ['🍽️', '🍳', '🥞', '🥪', '🥗', '🍲', '🍝', '🌮', '🍛', '🍗', '🐟', '🥩', '🍕', '🍰', '🍪', '🥧'];
const DIET_LABELS = ['vegan', 'vegetarian', 'pescatarian', 'gluten-free', 'dairy-free', 'nut-free', 'peanut-free',
  'egg-free', 'halal', 'kosher-style', 'paleo', 'no-red-meat'];

type Row = { amount: string; name: string };

export default function ShareRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { mealType, toggleFavorite, preferences } = useApp();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [meals, setMeals] = useState<MealType[]>([mealType]);
  const [vibe, setVibe] = useState<Vibe>('savory');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [prep, setPrep] = useState('10');
  const [cook, setCook] = useState('20');
  const [servings, setServings] = useState('4');
  const [rows, setRows] = useState<Row[]>([{ amount: '', name: '' }, { amount: '', name: '' }, { amount: '', name: '' }]);
  const [steps, setSteps] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Recipe | null>(null);
  const [sharing, setSharing] = useState(false);

  const toggleMeal = (m: MealType) =>
    setMeals(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]));

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const ingredients: Ingredient[] = rows
        .filter(r => r.name.trim())
        .map(r => ({ name: r.name.trim(), amount: r.amount.trim(), category: 'other' }));
      // Age safeguard: under-21s can't post recipes made with alcohol.
      if (!preferences.allowAlcohol && recipeHasAlcohol({ name, tags: [], ingredients, instructions: steps })) {
        setError("Recipes made with alcohol can only be shared by people 21 or older. Remove the alcohol to share this one.");
        return;
      }
      const recipe = await shareHomeRecipe(
        {
          name, emoji, mealTypes: meals, vibe, difficulty,
          prepMinutes: Number(prep) || 0,
          cookMinutes: Number(cook) || 0,
          servings: Math.max(1, Number(servings) || 1),
          ingredients,
          instructions: steps,
        },
        user.id,
      );
      clearRecipeLibraryCache();   // so it can be suggested right away
      toggleFavorite(recipe.id);   // your own recipe starts in your favorites
      setSaved(recipe);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share the recipe');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    const found = DIET_LABELS.filter(t => (saved.dietary as string[]).includes(t));
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.scroll, styles.doneWrap]}>
          <Text style={styles.doneEmoji}>{saved.emoji}</Text>
          <Text style={styles.doneTitle}>{saved.name} is shared!</Text>
          <Text style={styles.hint}>Everyone can now find it, heart it, and get it suggested.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>What we found</Text>
            {found.length ? (
              <View style={styles.chipRow}>
                {found.map(t => (
                  <View key={t} style={styles.chipDone}><Text style={styles.chipDoneText}>{t.replace(/-/g, ' ')}</Text></View>
                ))}
              </View>
            ) : null}
            {saved.allergens.length ? (
              <Text style={styles.foundLine}>Contains: {saved.allergens.join(', ')}</Text>
            ) : null}
            {saved.allergensVerified === false ? (
              <Text style={styles.foundLine}>
                We didn't recognise every ingredient, so it won't be shown to people with allergies. Using common
                names ("chicken breast", "cheddar") helps.
              </Text>
            ) : null}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace(`/recipe/${saved.id}`)}>
            <Text style={styles.primaryBtnText}>View recipe</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSharing(true)}>
            <Text style={styles.secondaryBtnText}>Share it in a chat room</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Done</Text>
          </TouchableOpacity>
          <ShareToRoomModal visible={sharing} recipe={saved} onClose={() => setSharing(false)} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <FontAwesome name="times" size={18} color={COLORS.darkNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share a home recipe</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Grandma's Sunday chili" placeholderTextColor={COLORS.inactiveGray} maxLength={120} />

          <Text style={styles.label}>Pick an emoji</Text>
          <View style={styles.chipRow}>
            {EMOJIS.map(e => (
              <TouchableOpacity key={e} style={[styles.emojiBtn, emoji === e && styles.emojiActive]} onPress={() => setEmoji(e)}>
                <Text style={styles.emoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Good for</Text>
          <View style={styles.chipRow}>
            {MEAL_TYPES.map(m => (
              <Chip key={m} active={meals.includes(m)} onPress={() => toggleMeal(m)}
                text={`${MEAL_INFO[m].emoji} ${MEAL_INFO[m].label}`} />
            ))}
          </View>

          <Text style={styles.label}>Flavor</Text>
          <View style={styles.chipRow}>
            {(['savory', 'spicy', 'sweet'] as Vibe[]).map(v => (
              <Chip key={v} active={vibe === v} onPress={() => setVibe(v)} text={v} />
            ))}
          </View>

          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.chipRow}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <Chip key={d} active={difficulty === d} onPress={() => setDifficulty(d)} text={d} />
            ))}
          </View>

          <View style={styles.numbersRow}>
            <NumberField label="Prep (min)" value={prep} onChange={setPrep} />
            <NumberField label="Cook (min)" value={cook} onChange={setCook} />
            <NumberField label="Serves" value={servings} onChange={setServings} />
          </View>

          <Text style={styles.label}>Ingredients</Text>
          {rows.map((row, i) => (
            <View key={i} style={styles.ingRow}>
              <TextInput style={[styles.input, styles.amount]} value={row.amount} placeholder="1 cup"
                placeholderTextColor={COLORS.inactiveGray}
                onChangeText={v => setRows(rs => rs.map((r, j) => (j === i ? { ...r, amount: v } : r)))} />
              <TextInput style={[styles.input, styles.flex1]} value={row.name} placeholder="ingredient"
                placeholderTextColor={COLORS.inactiveGray}
                onChangeText={v => setRows(rs => rs.map((r, j) => (j === i ? { ...r, name: v } : r)))} />
              {rows.length > 1 ? (
                <TouchableOpacity onPress={() => setRows(rs => rs.filter((_, j) => j !== i))} style={styles.removeBtn}>
                  <FontAwesome name="minus-circle" size={18} color={COLORS.inactiveGray} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={() => setRows(rs => [...rs, { amount: '', name: '' }])}>
            <FontAwesome name="plus" size={12} color={COLORS.darkNavy} />
            <Text style={styles.addText}>Add ingredient</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Steps</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.ingRow}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <TextInput style={[styles.input, styles.flex1]} value={step} multiline placeholder="Describe this step"
                placeholderTextColor={COLORS.inactiveGray}
                onChangeText={v => setSteps(ss => ss.map((s, j) => (j === i ? v : s)))} />
              {steps.length > 1 ? (
                <TouchableOpacity onPress={() => setSteps(ss => ss.filter((_, j) => j !== i))} style={styles.removeBtn}>
                  <FontAwesome name="minus-circle" size={18} color={COLORS.inactiveGray} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={() => setSteps(ss => [...ss, ''])}>
            <FontAwesome name="plus" size={12} color={COLORS.darkNavy} />
            <Text style={styles.addText}>Add step</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.darkNavy} /> : <Text style={styles.primaryBtnText}>Share with everyone</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>
            BiteWise checks the ingredients for allergens and diets automatically.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip({ active, onPress, text }: { active: boolean; onPress: () => void; text: string }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{text}</Text>
    </TouchableOpacity>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.flex1}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} keyboardType="number-pad" maxLength={4}
        onChangeText={v => onChange(v.replace(/[^0-9]/g, ''))} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.darkNavy },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy, marginTop: 18, marginBottom: 8 },
  smallLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textDark,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chipActive: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy, textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.cardWhite },
  emojiBtn: { padding: 6, borderRadius: 10 },
  emojiActive: { backgroundColor: COLORS.lightYellow },
  emoji: { fontSize: 24 },
  numbersRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  amount: { width: 90 },
  removeBtn: { padding: 4 },
  stepNum: { width: 20, fontSize: 15, fontWeight: '700', color: COLORS.darkGold, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  error: { color: COLORS.redAccent, marginTop: 14, fontSize: 14 },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: COLORS.goldYellow,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.darkNavy },
  secondaryBtn: { alignItems: 'center', paddingVertical: 14 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textMuted },
  hint: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 19 },
  doneWrap: { alignItems: 'stretch', paddingTop: 40 },
  doneEmoji: { fontSize: 64, textAlign: 'center' },
  doneTitle: { fontSize: 22, fontWeight: '700', color: COLORS.darkNavy, textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    marginTop: 20,
  },
  chipDone: { backgroundColor: COLORS.lightYellow, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10 },
  chipDoneText: { fontSize: 13, fontWeight: '600', color: COLORS.darkNavy, textTransform: 'capitalize' },
  foundLine: { fontSize: 14, color: COLORS.textDark, marginTop: 10, lineHeight: 20 },
});
