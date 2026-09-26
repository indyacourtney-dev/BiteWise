// components/RecipeListCard.tsx
//
// Compact recipe row used by Favorites, Community and anywhere a list of
// recipes is shown. Tap to open; heart to save.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import FavoriteButton from './FavoriteButton';
import { COLORS } from '../constants/Colors';
import { formatTime, getTotalTime } from '../constants/recipes';
import { MEAL_INFO, getMealTypes } from '../utils/meals';
import type { Recipe } from '../types';

interface Props {
  recipe: Recipe;
  onPress: () => void;
  /** Extra line under the meta, e.g. "You have 5 of 6 ingredients". */
  note?: string;
}

export default function RecipeListCard({ recipe, onPress, note }: Props) {
  const meals = getMealTypes(recipe).map(m => MEAL_INFO[m].emoji).join(' ');
  const calories = recipe.nutrition.calories > 0 ? ` · ${recipe.nutrition.calories} cal` : '';
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <Text style={styles.emoji}>{recipe.emoji}</Text>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{recipe.name}</Text>
        <Text style={styles.meta}>
          {formatTime(getTotalTime(recipe))}{calories} · {meals}
        </Text>
        {recipe.source === 'community' ? (
          <Text style={styles.author}>🏠 Home recipe{recipe.authorName ? ` by ${recipe.authorName}` : ''}</Text>
        ) : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <FavoriteButton recipeId={recipe.id} count={recipe.favoriteCount} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    marginBottom: 10,
  },
  emoji: { fontSize: 34 },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  meta: { fontSize: 12, color: COLORS.textMuted },
  author: { fontSize: 12, color: COLORS.darkGold, fontWeight: '600' },
  note: { fontSize: 12, color: COLORS.darkNavy, fontWeight: '600' },
});
