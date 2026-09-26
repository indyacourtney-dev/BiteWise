// components/FavoriteButton.tsx
//
// The heart. Saves to the user's favorites (AppContext → Supabase,
// Task 1.6). Use it anywhere a recipe is shown.

import React from 'react';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { useAccessibility } from '../hooks/useAccessibility';

interface Props {
  recipeId: string;
  size?: number;
  /** Show "Saved by N" next to the heart. */
  count?: number;
  /** Draw a white rounded button behind the heart (for headers). */
  boxed?: boolean;
}

export default function FavoriteButton({ recipeId, size = 18, count, boxed = false }: Props) {
  const { isFavorite, toggleFavorite } = useApp();
  const saved = isFavorite(recipeId);
  const { haptic } = useAccessibility();
  return (
    <TouchableOpacity
      onPress={() => {
        haptic(saved ? 'light' : 'success');
        toggleFavorite(recipeId);
      }}
      style={[styles.btn, boxed && styles.boxed]}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from favorites' : 'Add to favorites'}
    >
      <View style={styles.row}>
        <FontAwesome name={saved ? 'heart' : 'heart-o'} size={size} color={saved ? COLORS.redAccent : COLORS.darkNavy} />
        {typeof count === 'number' && count > 0 ? <Text style={styles.count}>{count}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
  boxed: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
});
