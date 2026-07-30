// app/recipe/[id].tsx
// Full recipe screen. Reached via router.push(`/recipe/${id}?match=${score}`)
// from the This-or-That results (and anywhere else a recipe is tapped).
//
// - id fills the [id] slot in the path; match arrives as a query param.
// - Renders the shared <RecipeDetail /> without onOpenRecipe (this IS the
//   full recipe screen, so no "See full recipe" button).
// - Unknown ids get a friendly not-found state instead of a crash, so a
//   stale link can never strand the user.

import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import RecipeDetail from '@/components/RecipeDetail';
import { getRecipeById } from '@/constants/recipes';
import { COLORS } from '@/constants/Colors';

export default function RecipeScreen() {
  const { id, match } = useLocalSearchParams<{ id: string; match?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const recipe = id ? getRecipeById(id) : undefined;
  const matchScore = match ? Number(match) : undefined;

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
      </View>

      {recipe ? (
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
  header: { paddingHorizontal: 16, paddingVertical: 10 },
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
