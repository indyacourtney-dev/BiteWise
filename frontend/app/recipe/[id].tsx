// app/recipe/[id].tsx
// Full recipe screen. Reached via router.push(`/recipe/${id}?match=${score}`)
// from the This-or-That results (and anywhere else a recipe is tapped).
//
// - id fills the [id] slot in the path; match arrives as a query param.
// - Renders the shared <RecipeDetail /> (hero, ingredients with pantry
//   check, steps, plate balance, reviews) with a fixed bottom bar:
//   Start cooking (guided mode) and Add to my week.
// - Unknown ids get a friendly not-found state instead of a crash, so a
//   stale link can never strand the user.
// - Curated recipes load instantly from constants/recipes.ts; imported and
//   community recipes (Pick for me, Favorites, chat cards) load from Supabase.

import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import RecipeDetail from '@/components/RecipeDetail';
import FavoriteButton from '@/components/FavoriteButton';
import ShareToRoomModal from '@/components/ShareToRoomModal';
import AddToWeekModal from '@/components/AddToWeekModal';
import { Display, IconButton, PrimaryButton, ScreenHeader, ui } from '@/components/ui';
import { getRecipeById } from '@/constants/recipes';
import { COLORS } from '@/constants/Colors';
import { configured } from '@/lib/supabase';
import { fetchRecipeById } from '@/lib/recipesApi';
import { useApp } from '@/context/AppContext';
import { ageAllowsRecipe } from '@/utils/matching';
import type { Recipe } from '@/types';

export default function RecipeScreen() {
  const { id, match } = useLocalSearchParams<{ id: string; match?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const local = id ? getRecipeById(id) : undefined;
  const [remote, setRemote] = useState<Recipe | undefined>(undefined);
  const [loading, setLoading] = useState(!local && Boolean(id) && configured);
  const [sharing, setSharing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [cookSignal, setCookSignal] = useState(0);
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

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const barHeight = 52 + 12 + Math.max(insets.bottom, 16);

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScreenHeader
        onBack={goBack}
        right={recipe ? (
          <View style={styles.headerActions}>
            {configured ? <IconButton icon="comments-o" label="Share to a chat room" onPress={() => setSharing(true)} /> : null}
            <FavoriteButton recipeId={recipe.id} boxed />
          </View>
        ) : undefined}
      />

      <ShareToRoomModal visible={sharing} recipe={recipe ?? null} onClose={() => setSharing(false)} />
      <AddToWeekModal visible={planning} recipe={recipe ?? null} onClose={() => setPlanning(false)} />

      {loading ? (
        <View style={styles.notFound}>
          <ActivityIndicator color={COLORS.darkNavy} />
        </View>
      ) : blocked ? (
        <View style={styles.notFound}>
          <Text style={styles.notFoundEmoji}>🍽️</Text>
          <Display size={22}>Not available on your account</Display>
          <Text style={styles.notFoundSub}>This recipe can't be shown here. There are thousands of others to choose from.</Text>
          <PrimaryButton label="Go back" onPress={goBack} style={{ marginTop: 8, paddingHorizontal: 28 }} />
        </View>
      ) : recipe ? (
        <>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[ui.pad, { paddingBottom: barHeight + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            <RecipeDetail
              recipe={recipe}
              onJumpToReviews={y => scrollRef.current?.scrollTo({ y, animated: true })}
              openCookingSignal={cookSignal}
              hideInlineCookButton
              matchScore={
                typeof matchScore === 'number' && !Number.isNaN(matchScore)
                  ? matchScore
                  : undefined
              }
            />
          </ScrollView>

          {/* Fixed action bar */}
          <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <PrimaryButton
              label={recipe.kind === 'drink' ? 'Make it' : 'Start cooking'}
              icon="play"
              onPress={() => setCookSignal(n => n + 1)}
              style={{ flex: 1 }}
            />
            {/* Drinks are never part of the week plan. */}
            {recipe.kind !== 'drink' ? (
              <IconButton icon="calendar-plus-o" label="Add to my week" onPress={() => setPlanning(true)} style={styles.barIcon} />
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.notFound}>
          <Text style={styles.notFoundEmoji}>🍽️</Text>
          <Display size={22}>Recipe not found</Display>
          <Text style={styles.notFoundSub}>This recipe may have been removed or the link is out of date.</Text>
          <PrimaryButton label="Back to Home" onPress={() => router.replace('/')} style={{ marginTop: 8, paddingHorizontal: 28 }} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    flexDirection: 'row', gap: 10, alignItems: 'center',
  },
  barIcon: { width: 52, height: 52, borderRadius: 16 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  notFoundEmoji: { fontSize: 52 },
  notFoundSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
