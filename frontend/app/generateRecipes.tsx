// app/generateRecipes.tsx — "Create with AI".
//
// The user picks the meal, how many people, and which ingredients to use
// (their pantry is filled in), and Claude writes up to three recipes
// (lib/aiRecipesApi.ts). Only recipes that pass the safety check are shown
// as suggestions; anything held back is listed with the reason, so nothing
// unchecked is ever presented as suitable.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import MealTypePicker from '@/components/MealTypePicker';
import RecipeListCard from '@/components/RecipeListCard';
import { Card, Chip, PrimaryButton, ScreenHeader, SecondaryButton, SectionLabel, ui } from '@/components/ui';
import { AiRecipeError, generateRecipes, type GenerateResult } from '@/lib/aiRecipesApi';
import type { MealType } from '@/types';

const MEALS: MealType[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'dessert'];

export default function GenerateRecipesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string }>();
  const { preferences, pantry } = useApp();

  const [mealType, setMealType] = useState<MealType>(
    MEALS.includes(params.meal as MealType) ? (params.meal as MealType) : 'dinner',
  );
  const [servings, setServings] = useState(Math.max(1, Math.min(12, preferences.householdSize || 2)));
  const pantryNames = useMemo(
    () => Array.from(new Set(pantry.filter(p => p.quantity > 0).map(p => p.name.trim()).filter(Boolean))),
    [pantry],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pantryNames));
  const [extra, setExtra] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [pantryOnly, setPantryOnly] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const allIngredients = [...pantryNames, ...extra];
  const chosen = allIngredients.filter(i => selected.has(i));

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const addTyped = () => {
    const t = typed.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!t) return;
    if (!allIngredients.some(i => i.toLowerCase() === t.toLowerCase())) setExtra([...extra, t]);
    setSelected(new Set([...selected, t]));
    setTyped('');
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await generateRecipes({ ingredients: chosen, mealType, servings, pantryOnly, note }, preferences));
    } catch (e) {
      setError(e instanceof AiRecipeError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScreenHeader
        kicker="Create with AI"
        title="New recipes from what you have"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <ScrollView contentContainerStyle={[ui.pad, { paddingBottom: 48 }]} keyboardShouldPersistTaps="handled">
        <SectionLabel>Meal</SectionLabel>
        <MealTypePicker value={mealType} onChange={setMealType} options={MEALS} />

        <SectionLabel style={{ marginTop: 18 }}>How many people</SectionLabel>
        <View style={s.row}>
          <SecondaryButton compact label="−" onPress={() => setServings(Math.max(1, servings - 1))} disabled={servings <= 1} />
          <Text style={s.servings} accessibilityLabel={`${servings} servings`}>{servings}</Text>
          <SecondaryButton compact label="+" onPress={() => setServings(Math.min(12, servings + 1))} disabled={servings >= 12} />
        </View>

        <SectionLabel style={{ marginTop: 18 }}>Ingredients to use</SectionLabel>
        {allIngredients.length === 0 ? (
          <Text style={s.muted}>Your pantry is empty. Add a few ingredients, or leave it blank for everyday ideas.</Text>
        ) : null}
        <View style={s.chips}>
          {allIngredients.map(name => (
            <Chip key={name} label={name} small selected={selected.has(name)} onPress={() => toggle(name)} />
          ))}
        </View>
        <View style={[s.row, { marginTop: 10 }]}>
          <TextInput
            style={s.input}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={addTyped}
            placeholder="Add an ingredient"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="done"
            maxLength={60}
            accessibilityLabel="Add an ingredient"
          />
          <SecondaryButton compact label="Add" onPress={addTyped} disabled={!typed.trim()} />
        </View>
        <View style={[s.chips, { marginTop: 10 }]}>
          <Chip label="Only these (plus staples)" small selected={pantryOnly} onPress={() => setPantryOnly(!pantryOnly)} />
        </View>

        <SectionLabel style={{ marginTop: 18 }}>Anything in mind? (optional)</SectionLabel>
        <TextInput
          style={[s.input, { flex: 0 }]}
          value={note}
          onChangeText={setNote}
          placeholder="Something cozy, one pan, kid-friendly…"
          placeholderTextColor={COLORS.textMuted}
          maxLength={200}
          accessibilityLabel="What you're in the mood for"
        />

        <Text style={s.muted}>
          Your allergies and diets from Profile are always included. Every recipe is checked against them before it’s shown.
        </Text>
        <PrimaryButton label={busy ? 'Writing recipes…' : 'Create recipes'} icon="magic" busy={busy} disabled={busy} onPress={run} style={{ marginTop: 14 }} />
        {busy ? (
          <View style={[s.row, { marginTop: 12 }]}>
            <ActivityIndicator color={COLORS.darkNavy} />
            <Text style={s.muted}>This usually takes 20–60 seconds.</Text>
          </View>
        ) : null}

        {error ? (
          <Card style={s.errorBox}>
            <Text style={s.errorText} accessibilityRole="alert">{error}</Text>
            <SecondaryButton compact label="Try again" onPress={run} />
          </Card>
        ) : null}

        {result ? (
          <View style={{ marginTop: 22 }}>
            <SectionLabel>{result.recipes.length ? 'Your new recipes' : 'No recipes to show'}</SectionLabel>
            {result.recipes.length ? (
              <Text style={s.muted}>
                <FontAwesome name="shield" size={12} color={COLORS.textMuted} /> Written by AI and checked against your allergies and diets. Still read labels before cooking.
              </Text>
            ) : null}
            {result.recipes.map(r => (
              <RecipeListCard key={r.id} recipe={r} note={r.description} onPress={() => router.push(`/recipe/${r.id}`)} />
            ))}
            {result.heldBack.length ? (
              <Card style={s.heldBox}>
                <Text style={s.heldTitle}>
                  {result.heldBack.length} {result.heldBack.length === 1 ? 'recipe was' : 'recipes were'} held back
                </Text>
                {result.heldBack.map(({ recipe, validation }) => (
                  <Text key={recipe.id} style={s.heldText}>• {recipe.name}: {validation.reason}</Text>
                ))}
              </Card>
            ) : null}
            {result.dropped.length ? (
              <Text style={s.muted}>{result.dropped.length} more couldn’t be read and were skipped.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  servings: { fontSize: 20, fontWeight: '700', color: COLORS.textDark, minWidth: 28, textAlign: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: COLORS.yellowBorder, borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, color: COLORS.textDark, backgroundColor: '#fff',
  },
  muted: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18, marginTop: 10 },
  errorBox: { marginTop: 16, gap: 10, borderColor: COLORS.redText, borderWidth: 1 },
  errorText: { fontSize: 14, color: COLORS.redText },
  heldBox: { marginTop: 14, gap: 4 },
  heldTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textDark, marginBottom: 2 },
  heldText: { fontSize: 13, color: COLORS.textDark, lineHeight: 18 },
});
