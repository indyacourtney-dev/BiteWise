// app/cookWithPantry.tsx — "Cook With My Pantry"
//
// SEPARATE from the Pantry tab on purpose:
//   Pantry tab            = storage. What's in your kitchen.
//   Cook With My Pantry   = this screen. What you can MAKE with it.
//
// Reads the persistent pantry from AppContext, hard-filters by the
// user's dietary restrictions and allergens (never show someone a
// recipe they can't eat), then ranks every recipe by ingredient
// coverage:
//   Ready to cook  — you have ≥80% of required ingredients
//   Almost there   — 50–79%, with the missing items listed so a quick
//                    grocery run unlocks them
// Tapping a meal opens the full recipe with its coverage as the match %.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { getTotalTime, formatTime } from '@/constants/recipes';
import { getPantryCoverage, passesDietaryFilter } from '@/utils/matching';
import MealTypePicker from '@/components/MealTypePicker';
import FavoriteButton from '@/components/FavoriteButton';
import { useRecipeLibrary } from '@/hooks/useRecipeLibrary';
import { fetchPantryMatches } from '@/lib/pantryApi';
import { fetchRecipesByIds } from '@/lib/recipesApi';
import { MEAL_INFO } from '@/utils/meals';
import { findPantryLibraryItem } from '@/constants/pantryData';
import type { Recipe } from '@/types';

interface RankedMeal {
  recipe: Recipe;
  percent: number;
  have: string[];
  missing: string[];
}

export default function CookWithPantryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pantry, preferences, mealType, setMealType } = useApp();

  // Curated + database recipes for this meal, already allergy/diet filtered.
  const { recipes: library } = useRecipeLibrary(mealType, preferences);

  // The server ranks the WHOLE database against the pantry with proper
  // ingredient matching ("chicken breasts" = chicken breast = counts for
  // "chicken"), which a local name comparison can't do.
  const [serverRanked, setServerRanked] = useState<RankedMeal[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (pantry.length === 0) {
      setServerRanked([]);
      return;
    }
    (async () => {
      try {
        const matches = await fetchPantryMatches(pantry, preferences, { mealType, minPercent: 50, maxMissing: 4, limit: 30 });
        const recipes = await fetchRecipesByIds(matches.map(m => m.recipeId));
        const byId = new Map(recipes.map(r => [r.id, r]));
        const ranked = matches
          // The database already applied allergies and diets; this adds the
          // user's own typed allergies / foods to avoid (Profile).
          .filter(m => byId.has(m.recipeId) && passesDietaryFilter(byId.get(m.recipeId)!, preferences))
          .map(m => ({
            recipe: byId.get(m.recipeId)!,
            percent: m.percent,
            have: Array<string>(m.haveCount).fill(''),
            missing: m.missingIngredients,
          }));
        if (!cancelled) setServerRanked(ranked);
      } catch {
        if (!cancelled) setServerRanked([]);   // offline: local ranking still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pantry, preferences, mealType]);

  const { ready, almost } = useMemo(() => {
    const local: RankedMeal[] = library.map(recipe => {
      const cov = getPantryCoverage(recipe, pantry);
      return { recipe, percent: cov.percent, have: cov.have, missing: cov.missing };
    });
    const serverIds = new Set(serverRanked.map(m => m.recipe.id));
    const ranked = [...serverRanked, ...local.filter(m => !serverIds.has(m.recipe.id))]
      .sort(
        (a, b) => b.percent - a.percent || a.missing.length - b.missing.length
      );

    return {
      ready: ranked.filter(m => m.percent >= 80).slice(0, 12),
      almost: ranked.filter(m => m.percent >= 50 && m.percent < 80).slice(0, 8),
    };
  }, [library, pantry, serverRanked]);

  const openRecipe = (m: RankedMeal) =>
    router.push(`/recipe/${m.recipe.id}?match=${m.percent}`);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <FontAwesome name="chevron-left" size={16} color={COLORS.darkNavy} />
        </TouchableOpacity>
        <View style={styles.flex1}>
          <Text style={styles.h1}>Cook With My Pantry</Text>
          <Text style={styles.sub}>
            {pantry.length > 0
              ? `${MEAL_INFO[mealType].label} ideas from your ${pantry.length} pantry item${pantry.length === 1 ? '' : 's'}`
              : 'Meals from what you already have'}
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <MealTypePicker value={mealType} onChange={setMealType} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Empty pantry */}
        {pantry.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🧺</Text>
            <Text style={styles.emptyTitle}>Your pantry is empty</Text>
            <Text style={styles.emptyText}>
              Stock your pantry first, then come back and we'll show you every
              meal you can make with it.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.9}
              onPress={() => router.push('/pantry')}
            >
              <Text style={styles.primaryBtnText}>Stock My Pantry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* READY TO COOK */}
            <SectionHeader
              emoji="✅"
              title="Ready to cook"
              subtitle="You have everything (or nearly everything) these need."
            />
            {ready.length === 0 ? (
              <Text style={styles.noneText}>
                Nothing fully matches yet — add a few more staples to your pantry
                and check the "almost there" list below.
              </Text>
            ) : (
              ready.map(m => <MealCard key={m.recipe.id} meal={m} onPress={() => openRecipe(m)} />)
            )}

            {/* ALMOST THERE */}
            {almost.length > 0 && (
              <>
                <SectionHeader
                  emoji="🛒"
                  title="Almost there"
                  subtitle="One small grocery run away."
                />
                {almost.map(m => (
                  <MealCard key={m.recipe.id} meal={m} onPress={() => openRecipe(m)} showMissing />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        {emoji} {title}
      </Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
    </View>
  );
}

function MealCard({
  meal,
  onPress,
  showMissing = false,
}: {
  meal: RankedMeal;
  onPress: () => void;
  showMissing?: boolean;
}) {
  const { recipe, percent, have, missing } = meal;
  const total = have.length + missing.length;
  const { grocery, addGroceryItem } = useApp();
  const listed = new Set(grocery.filter(g => !g.checked).map(g => g.name.toLowerCase()));
  const allListed = missing.every(m => listed.has(m.toLowerCase()) || listed.has((findPantryLibraryItem(m)?.name ?? '').toLowerCase()));
  const addMissing = () =>
    missing.forEach(name => addGroceryItem(name, { source: 'recipe', note: `For ${recipe.name}` }));

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cardEmoji}>{recipe.emoji}</Text>
        <View style={styles.flex1}>
          <Text style={styles.cardName}>{recipe.name}</Text>
          <Text style={styles.cardMeta}>
            {formatTime(getTotalTime(recipe))}
            {recipe.nutrition.calories > 0 ? ` · ${recipe.nutrition.calories} cal` : ''} · {recipe.difficulty}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <View style={[styles.pctPill, percent >= 100 && styles.pctPillFull]}>
            <Text style={styles.pctText}>{percent}%</Text>
          </View>
          <FavoriteButton recipeId={recipe.id} size={16} />
        </View>
      </View>

      {/* Coverage bar */}
      <View style={styles.coverageTrack}>
        <View style={[styles.coverageFill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.coverageText}>
        You have {have.length} of {total} ingredients
      </Text>

      {showMissing && missing.length > 0 && (
        <View style={styles.missingWrap}>
          <Text style={styles.missingLabel}>Missing:</Text>
          {missing.slice(0, 3).map(name => (
            <View key={name} style={styles.missingChip}>
              <Text style={styles.missingChipText}>{name}</Text>
            </View>
          ))}
          {missing.length > 3 && (
            <Text style={styles.missingMore}>+{missing.length - 3} more</Text>
          )}
        </View>
      )}

      {showMissing && missing.length > 0 && (
        <TouchableOpacity
          style={[styles.listBtn, allListed && styles.listBtnDone]}
          onPress={addMissing}
          disabled={allListed}
          accessibilityRole="button"
        >
          <FontAwesome name={allListed ? 'check' : 'cart-plus'} size={14} color={COLORS.darkNavy} />
          <Text style={styles.listBtnText}>
            {allListed ? 'On your grocery list' : `Add ${missing.length === 1 ? 'it' : `all ${missing.length}`} to my grocery list`}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.goldYellow,
  },
  listBtnDone: { backgroundColor: COLORS.lightYellow },
  listBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { fontSize: 20, fontWeight: '800', color: COLORS.darkNavy },
  sub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 6 },

  sectionHeader: { marginTop: 18, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.darkNavy },
  sectionSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  noneText: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
  },

  card: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 30 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  cardMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  pctPill: {
    backgroundColor: COLORS.lightYellow,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  pctPillFull: { backgroundColor: COLORS.goldYellow },
  pctText: { fontSize: 13, fontWeight: '800', color: COLORS.darkNavy },

  coverageTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.background,
    marginTop: 12,
    overflow: 'hidden',
  },
  coverageFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.goldYellow },
  coverageText: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },

  missingWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  missingLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  missingChip: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  missingChipText: { fontSize: 12, color: COLORS.darkNavy },
  missingMore: { fontSize: 12, color: COLORS.inactiveGray },

  emptyBox: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 30,
    marginTop: 30,
  },
  emptyEmoji: { fontSize: 46 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: COLORS.darkNavy },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 21 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 30,
  },
  primaryBtnText: { color: COLORS.cardWhite, fontSize: 15, fontWeight: '800' },
});
