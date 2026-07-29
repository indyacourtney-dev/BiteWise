// app/randomMeal.tsx
//
// "Surprise Me" — picks a random meal, shows the full recipe, and lets the
// user reroll as many times as they want.
//
// The reroll deliberately remembers what it has already shown and excludes
// it, so hitting the button repeatedly walks the whole library before
// anything repeats. A plain Math.random() would show the same meal twice in
// a row often enough that the button would feel broken.
//
// This lives outside (tabs) on purpose: it's a focused, one-thing screen you
// exit from, not a destination you tab between.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import RecipeDetail from '../components/RecipeDetail';
import { COLORS } from '../constants/Colors';
import { RECIPES } from '../constants/recipes';
import { getPlateSuggestion, passesDietaryFilter, favoriteOverlap } from '../utils/matching';
import { useApp } from '../context/AppContext';
import type { Recipe } from '../types';

export default function RandomMealScreen() {
  const router = useRouter();
  const { toggleFavorite, isFavorite, preferences } = useApp();

  const [meal, setMeal] = useState<Recipe | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  const fade = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  // Surprise Me still respects hard limits (allergies, dietary rules) —
  // random should never mean "randomly contains your allergen."
  //
  // BUG FIX ("maximum update depth exceeded"): this list used to be
  // rebuilt as a brand-new array on every render. It's a dependency of
  // the roll-on-mount effect, so every render made the effect think its
  // inputs changed, which re-rolled, which set state, which rendered —
  // an infinite loop. useMemo keeps the array's identity stable until
  // preferences actually change.
  const library = useMemo(() => {
    const eligible = RECIPES.filter(r => passesDietaryFilter(r, preferences));
    return eligible.length > 0 ? eligible : RECIPES;
  }, [preferences]);

  // Plain function, and all side effects (setMeal, animation, scroll)
  // happen OUT here — never inside a setState updater, which React
  // requires to be pure and may invoke twice in development.
  const roll = () => {
    const exclude = seen.length >= library.length ? [] : seen;
    const pool = library.filter(r => !exclude.includes(r.id));

    // "Surprise" with a thumb on the scale: ~65% of rolls draw from
    // meals overlapping the user's onboarding tastes (when any exist
    // in the pool), the rest from the whole pool so it never becomes
    // an echo chamber.
    const favs = preferences.favoriteTags ?? [];
    const liked = pool.filter(r => favoriteOverlap(r, favs) > 0);
    const source = liked.length > 0 && Math.random() < 0.65 ? liked : pool;
    const next = source[Math.floor(Math.random() * source.length)];

    setSeen([...exclude, next.id]);
    setMeal(next);

    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Roll exactly once on mount so the user lands straight on a meal.
  // Deliberately mount-only: re-running on dependency changes is what
  // caused the update-depth crash.
  useEffect(() => {
    roll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!meal) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingEmoji}>🎲</Text>
          <Text style={styles.loadingText}>Picking something…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const saved = isFavorite(meal.id);
  const rollsLeft = Math.max(0, library.length - seen.length);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={styles.iconBtn}
          activeOpacity={0.7}
        >
          <FontAwesome name="times" size={18} color={COLORS.darkNavy} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Surprise Me</Text>

        <TouchableOpacity
          onPress={() => toggleFavorite(meal.id)}
          style={styles.iconBtn}
          activeOpacity={0.7}
        >
          <FontAwesome
            name={saved ? 'heart' : 'heart-o'}
            size={18}
            color={saved ? COLORS.redAccent : COLORS.darkNavy}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fade,
            transform: [
              {
                translateY: fade.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.banner}>
            <Text style={styles.bannerEmoji}>🎲</Text>
            <Text style={styles.bannerText}>Tonight you're making…</Text>
          </View>

          <RecipeDetail recipe={meal} suggestion={getPlateSuggestion(meal.plate)} />
        </Animated.View>

        {/* ACTIONS */}
        <TouchableOpacity style={styles.primaryBtn} onPress={roll} activeOpacity={0.9}>
          <FontAwesome name="refresh" size={15} color={COLORS.cardWhite} />
          <Text style={styles.primaryBtnText}>Give me another</Text>
        </TouchableOpacity>

        <Text style={styles.rollsHint}>
          {rollsLeft > 0
            ? `${rollsLeft} more meal${rollsLeft === 1 ? '' : 's'} you haven't seen yet`
            : "You've seen them all — rerolling from the top"}
        </Text>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/thisorthat')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryBtnText}>Rather answer some questions?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingEmoji: { fontSize: 48, marginBottom: 12 },
  loadingText: { fontSize: 15, color: COLORS.textMuted },

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

  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    backgroundColor: COLORS.lightYellow,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  bannerEmoji: { fontSize: 16 },
  bannerText: { fontSize: 13, fontWeight: '600', color: COLORS.darkGold },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 30,
  },
  primaryBtnText: { color: COLORS.cardWhite, fontSize: 15, fontWeight: '700' },

  rollsHint: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 10,
  },

  secondaryBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  secondaryBtnText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
});
