// app/(tabs)/favorites.tsx — every recipe the user hearted (Task 1.6)
//
// Favorites live in Supabase (synced by AppContext), so they follow the
// user across devices. Curated recipes resolve instantly from
// constants/recipes.ts; imported and community ones load from Supabase.
//
// "Pick one for me" chooses among favorites for the selected meal — the
// quickest decision there is: you already know you like all of them.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import RecipeListCard from '@/components/RecipeListCard';
import { COLORS } from '@/constants/Colors';
import { getRecipeById } from '@/constants/recipes';
import { useApp } from '@/context/AppContext';
import { fetchRecipesByIds } from '@/lib/recipesApi';
import { findCustomConflicts } from '@/utils/customFoods';
import { MEAL_INFO, MEAL_TYPES, suitsMeal } from '@/utils/meals';
import { ageAllowsRecipe } from '@/utils/matching';
import type { MealType, Recipe } from '@/types';

export default function FavoritesScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { favorites, preferences, recordQuizRun } = useApp();
  const [filter, setFilter] = useState<MealType | 'all'>('all');
  const [remote, setRemote] = useState<Record<string, Recipe>>({});
  const [loading, setLoading] = useState(false);

  // Load favorites that aren't curated recipes.
  const missingIds = useMemo(
    () => favorites.map(f => f.recipeId).filter(id => !getRecipeById(id) && !remote[id]),
    [favorites, remote]
  );
  useEffect(() => {
    if (missingIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    fetchRecipesByIds(missingIds)
      .then(rows => {
        if (!cancelled) setRemote(prev => ({ ...prev, ...Object.fromEntries(rows.map(r => [r.id, r])) }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // missingIds changes whenever favorites do
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingIds.join(',')]);

  const recipes = favorites
    .map(f => getRecipeById(f.recipeId) ?? remote[f.recipeId])
    .filter((r): r is Recipe => Boolean(r))
    // Age safeguard (e.g. a favorite saved before the birthday was set).
    .filter(r => ageAllowsRecipe(r, preferences));
  const shown = filter === 'all' ? recipes : recipes.filter(r => suitsMeal(r, filter));

  // Hearts are respected even if preferences changed later — but never
  // suggest something that now conflicts with an allergy.
  const pickForMe = () => {
    const safe = shown.filter(r =>
      !r.allergens.some(a => preferences.avoidAllergens.includes(a))
      && findCustomConflicts(r, preferences).allergies.length === 0);
    if (safe.length === 0) return;
    const choice = safe[Math.floor(Math.random() * safe.length)];
    recordQuizRun({
      mode: 'random',
      mealType: filter === 'all' ? undefined : filter,
      chosenRecipeId: choice.id,
      vibe: null,
      tags: choice.tags,
      topRecipeIds: [choice.id],
    });
    router.push(`/recipe/${choice.id}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Favorites</Text>
        <Text style={styles.sub}>
          {favorites.length > 0
            ? `${favorites.length} saved recipe${favorites.length === 1 ? '' : 's'}`
            : 'Recipes you heart show up here.'}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['all', ...MEAL_TYPES] as const).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.filter, filter === m && styles.filterActive]}
              onPress={() => setFilter(m)}
            >
              <Text style={[styles.filterText, filter === m && styles.filterTextActive]}>
                {m === 'all' ? 'All' : `${MEAL_INFO[m].emoji} ${MEAL_INFO[m].label}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {shown.length > 1 ? (
          <TouchableOpacity style={styles.pickBtn} onPress={pickForMe} activeOpacity={0.9}>
            <FontAwesome name="random" size={15} color={COLORS.darkNavy} />
            <Text style={styles.pickBtnText}>Can't choose? Pick one of these for me</Text>
          </TouchableOpacity>
        ) : null}

        {loading && shown.length === 0 ? <ActivityIndicator color={COLORS.darkNavy} style={{ marginTop: 30 }} /> : null}

        {favorites.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🤍</Text>
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyText}>
              Tap the heart on any recipe to save it. Your favorites are backed up to your account.
            </Text>
          </View>
        ) : shown.length === 0 && !loading ? (
          <Text style={styles.emptyText}>
            No saved {filter === 'all' ? '' : MEAL_INFO[filter as MealType].label.toLowerCase() + ' '}recipes yet.
          </Text>
        ) : (
          shown.map(r => <RecipeListCard key={r.id} recipe={r} onPress={() => router.push(`/recipe/${r.id}`)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.darkNavy },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, marginBottom: 14 },
  filters: { gap: 8, paddingBottom: 14 },
  filter: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  filterActive: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.darkNavy },
  filterTextActive: { color: COLORS.cardWhite },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.goldYellow,
    borderRadius: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  pickBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  empty: { alignItems: 'center', paddingTop: 50, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.darkNavy },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
