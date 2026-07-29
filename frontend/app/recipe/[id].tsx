// app/recipe/[id].tsx
//
// Full recipe for any single meal, addressed by id (e.g. /recipe/r14).
//
// This exists so the "other options" on the quiz results screen aren't
// dead ends. Previously an alternate showed only a name and a match
// percentage, with no way to actually read the recipe — the user could
// see that a meal fit them but not how to cook it.
//
// It's a plain route, so anything can link here later (favorites list,
// history, pantry matches) without duplicating the layout.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import RecipeDetail from '../../components/RecipeDetail';
import { COLORS } from '../../constants/Colors';
import { getRecipeById } from '../../constants/recipes';
import { getPlateSuggestion } from '../../utils/matching';
import { useApp } from '../../context/AppContext';

export default function RecipeScreen() {
  const { id, match } = useLocalSearchParams<{ id: string; match?: string }>();
  const router = useRouter();
  const { toggleFavorite, isFavorite } = useApp();

  const recipe = getRecipeById(id);

  // Guard against a bad or stale id rather than crashing on undefined.
  if (!recipe) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <FontAwesome name="chevron-left" size={15} color={COLORS.darkNavy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recipe</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={styles.emptyTitle}>Recipe not found</Text>
          <Text style={styles.emptyText}>
            That meal isn't in the library anymore.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.back()}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const saved = isFavorite(recipe.id);
  const matchScore = match ? Number(match) : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.7}
        >
          <FontAwesome name="chevron-left" size={15} color={COLORS.darkNavy} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Recipe
        </Text>

        <TouchableOpacity
          onPress={() => toggleFavorite(recipe.id)}
          style={styles.iconBtn}
          activeOpacity={0.7}
        >
          <FontAwesome
            name={saved ? 'heart' : 'heart-o'}
            size={17}
            color={saved ? COLORS.redAccent : COLORS.darkNavy}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <RecipeDetail
          recipe={recipe}
          matchScore={Number.isFinite(matchScore) ? matchScore : undefined}
          suggestion={getPlateSuggestion(recipe.plate)}
        />

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryBtnText}>Back to your results</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  // Generous bottom padding: this screen sits outside the tab navigator,
  // but the home indicator still needs clearance.
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  secondaryBtn: { alignItems: 'center', paddingVertical: 18, marginTop: 12 },
  secondaryBtnText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.darkNavy },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    marginTop: 22,
  },
  primaryBtnText: { color: COLORS.cardWhite, fontSize: 15, fontWeight: '700' },
});
