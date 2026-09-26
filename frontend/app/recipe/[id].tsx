// app/recipe/[id].tsx
// Full recipe screen. Reached via router.push(`/recipe/${id}?match=${score}`)
// from the This-or-That results (and anywhere else a recipe is tapped).
//
// - id fills the [id] slot in the path; match arrives as a query param.
// - Renders the shared <RecipeDetail /> without onOpenRecipe (this IS the
//   full recipe screen, so no "See full recipe" button).
// - Unknown ids get a friendly not-found state instead of a crash, so a
//   stale link can never strand the user.
// - Curated recipes load instantly from constants/recipes.ts; imported and
//   community recipes (Decide for Me, Favorites, chat cards) load from
//   Supabase.
// - Header: add to my week (app/planWeek.tsx), share-to-chat and heart.

import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import RecipeDetail from '@/components/RecipeDetail';
import FavoriteButton from '@/components/FavoriteButton';
import ShareToRoomModal from '@/components/ShareToRoomModal';
import AddToWeekModal from '@/components/AddToWeekModal';
import { getRecipeById } from '@/constants/recipes';
import { COLORS } from '@/constants/Colors';
import { configured } from '@/lib/supabase';
import { fetchRecipeById } from '@/lib/recipesApi';
import { useApp } from '@/context/AppContext';
import { ageAllowsRecipe } from '@/utils/matching';
import { LEGAL_DRINKING_AGE } from '@/utils/age';
import type { Recipe } from '@/types';

export default function RecipeScreen() {
  const { id, match } = useLocalSearchParams<{ id: string; match?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const local = id ? getRecipeById(id) : undefined;
  const [remote, setRemote] = useState<Recipe | undefined>(undefined);
  const [loading, setLoading] = useState(!local && Boolean(id) && configured);
  const [sharing, setSharing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const found = local ?? remote;
  // Age safeguard: however someone got here (link, chat, favorites), a
  // recipe made with alcohol isn't shown to under-21s.
  const { preferences } = useApp();
  const blocked = !!found && !ageAllowsRecipe(found, preferences);
  const recipe = blocked ? undefined : found;
  const matchScore = match ? Number(match) : undefined;

  useEffect(() => {
    if (local || !id || !configured) return;
    let cancelled = false;
    setLoading(true);
    fetchRecipeById(id)
      .then(r => {
        if (!cancelled) setRemote(r);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, local]);

  // Back should pop when pushed; if this screen was somehow opened
  // directly (deep link, reload), fall back to Home instead of a dead end.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
          <FontAwesome name="chevron-left" size={16} color={COLORS.darkNavy} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        {recipe ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => setPlanning(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add to my week"
            >
              <FontAwesome name="calendar-plus-o" size={17} color={COLORS.darkNavy} />
            </TouchableOpacity>
            {configured ? (
              <TouchableOpacity style={styles.shareBtn} onPress={() => setSharing(true)} activeOpacity={0.7}>
                <FontAwesome name="comments-o" size={18} color={COLORS.darkNavy} />
              </TouchableOpacity>
            ) : null}
            <FavoriteButton recipeId={recipe.id} boxed />
          </View>
        ) : null}
      </View>

      <ShareToRoomModal visible={sharing} recipe={recipe ?? null} onClose={() => setSharing(false)} />
      <AddToWeekModal visible={planning} recipe={recipe ?? null} onClose={() => setPlanning(false)} />

      {loading ? (
        <View style={styles.notFound}>
          <ActivityIndicator color={COLORS.darkNavy} />
        </View>
      ) : blocked ? (
        <View style={styles.notFound}>
          <Text style={styles.notFoundEmoji}>🔞</Text>
          <Text style={styles.notFoundTitle}>This recipe is for {LEGAL_DRINKING_AGE}+</Text>
          <Text style={styles.notFoundSub}>
            It's made with alcohol, so it isn't available on your account.
          </Text>
          <TouchableOpacity style={styles.homeBtn} onPress={goBack} activeOpacity={0.9}>
            <Text style={styles.homeBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : recipe ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <RecipeDetail
            recipe={recipe}
            matchScore={
              typeof matchScore === 'number' && !Number.isNaN(matchScore)
                ? matchScore
                : undefined
            }
          />
        </ScrollView>
      ) : (
        <View style={styles.notFound}>
          <Text style={styles.notFoundEmoji}>🍽️</Text>
          <Text style={styles.notFoundTitle}>Recipe not found</Text>
          <Text style={styles.notFoundSub}>
            This recipe may have been removed or the link is out of date.
          </Text>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')} activeOpacity={0.9}>
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: { fontSize: 16, fontWeight: '600', color: COLORS.darkNavy },
  scroll: { paddingHorizontal: 20 },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  notFoundEmoji: { fontSize: 52 },
  notFoundTitle: { fontSize: 22, fontWeight: '700', color: COLORS.darkNavy },
  notFoundSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  homeBtn: {
    marginTop: 12,
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  homeBtnText: { color: COLORS.cardWhite, fontSize: 15, fontWeight: '700' },
});
