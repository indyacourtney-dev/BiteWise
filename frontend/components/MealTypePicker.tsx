// components/MealTypePicker.tsx
//
// "What are we eating?" — breakfast / brunch / lunch / dinner / dessert
// chips. Defaults to the current meal in AppContext (set from the clock),
// so most of the time the user doesn't have to touch it.

import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { COLORS } from '../constants/Colors';
import { MEAL_INFO, MEAL_TYPES } from '../utils/meals';
import type { MealType } from '../types';

interface Props {
  value: MealType;
  onChange: (meal: MealType) => void;
  /** Limit the choices, e.g. the quizzes only offer lunch and dinner. */
  options?: MealType[];
}

export default function MealTypePicker({ value, onChange, options = MEAL_TYPES }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map(meal => {
        const active = meal === value;
        return (
          <TouchableOpacity
            key={meal}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(meal)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={styles.emoji}>{MEAL_INFO[meal].emoji}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{MEAL_INFO[meal].label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chipActive: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  emoji: { fontSize: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  labelActive: { color: COLORS.cardWhite },
});
