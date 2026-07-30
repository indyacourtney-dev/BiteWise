// components/PlateVisualization.tsx
//
// REDESIGN: one sleek card in the app's navy/gold theme.
//  - Proportional plate bar with soft rounded segments and a gold
//    "Balanced" pill when the plate meets targets.
//  - Legend with muted dot swatches + percentages.
//  - Macro row (when `nutrition` is provided): Calories, Protein, Carbs,
//    Total Fat, and Healthy Fats — healthy fats get the gold accent and
//    show what share of total fat they make up.
// Props stay backward-compatible: `nutrition` is optional, `compact`
// still renders just the slim bar for list cards.

import React from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import type { PlateComposition, Nutrition } from '../types';
import { isPlateBalanced } from '../utils/matching';
import { COLORS } from '../constants/Colors';

export const PLATE_COLORS = {
  produce: '#6FBF73',
  protein: '#E8896B',
  carbs: '#F0C75E',
  fats: '#8FA9C4',
} as const;

const SEGMENTS = [
  { key: 'produce', label: 'Veggies & fruit', color: PLATE_COLORS.produce },
  { key: 'protein', label: 'Protein', color: PLATE_COLORS.protein },
  { key: 'carbs', label: 'Carbs', color: PLATE_COLORS.carbs },
  { key: 'healthyFats', label: 'Healthy fats', color: PLATE_COLORS.fats },
] as const;

interface Props {
  plate: PlateComposition;
  nutrition?: Nutrition;
  compact?: boolean;
}

export default function PlateVisualization({ plate, nutrition, compact = false }: Props) {
  const balanced = isPlateBalanced(plate);

  if (compact) {
    return (
      <RNView style={styles.barCompact}>
        {SEGMENTS.map(s => (
          <RNView
            key={s.key}
            style={{ flex: Math.max(plate[s.key], 1), backgroundColor: s.color }}
          />
        ))}
      </RNView>
    );
  }

  return (
    <RNView style={styles.card}>
      {/* Header */}
      <RNView style={styles.headerRow}>
        <Text style={styles.title}>Plate Balance</Text>
        {balanced && (
          <RNView style={styles.balancedPill}>
            <FontAwesome name="check" size={10} color={COLORS.darkNavy} />
            <Text style={styles.balancedText}>Balanced</Text>
          </RNView>
        )}
      </RNView>

      {/* Proportional bar */}
      <RNView style={styles.bar}>
        {SEGMENTS.map((s, i) => (
          <RNView
            key={s.key}
            style={[
              styles.seg,
              { flex: Math.max(plate[s.key], 1), backgroundColor: s.color },
              i === 0 && styles.segFirst,
              i === SEGMENTS.length - 1 && styles.segLast,
            ]}
          />
        ))}
      </RNView>

      {/* Legend */}
      <RNView style={styles.legend}>
        {SEGMENTS.map(s => (
          <RNView key={s.key} style={styles.legendItem}>
            <RNView style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendPct}>{plate[s.key]}%</Text>
          </RNView>
        ))}
      </RNView>

      {/* Macros */}
      {nutrition && (
        <>
          <RNView style={styles.divider} />
          <RNView style={styles.macroRow}>
            <MacroStat value={`${nutrition.calories}`} label="Calories" big />
            <MacroStat value={`${nutrition.protein}g`} label="Protein" />
            <MacroStat value={`${nutrition.carbs}g`} label="Carbs" />
            <MacroStat value={`${nutrition.totalFat}g`} label="Total Fat" />
          </RNView>
          <RNView style={styles.healthyFatRow}>
            <RNView style={styles.healthyFatBadge}>
              <FontAwesome name="heart" size={10} color={COLORS.darkGold} />
              <Text style={styles.healthyFatText}>
                {nutrition.healthyFat}g healthy fats
              </Text>
            </RNView>
            <Text style={styles.healthyFatShare}>
              {Math.round((nutrition.healthyFat / Math.max(nutrition.totalFat, 1)) * 100)}% of
              total fat
            </Text>
          </RNView>
          <Text style={styles.perServing}>Estimated per serving</Text>
        </>
      )}
    </RNView>
  );
}

function MacroStat({ value, label, big }: { value: string; label: string; big?: boolean }) {
  return (
    <RNView style={styles.macroStat}>
      <Text style={[styles.macroValue, big && styles.macroValueBig]}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </RNView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.darkNavy,
  },
  balancedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.goldYellow,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  balancedText: { fontSize: 11, fontWeight: '800', color: COLORS.darkNavy },

  bar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    gap: 2,
    backgroundColor: COLORS.background,
  },
  barCompact: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  seg: { height: '100%' },
  segFirst: { borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
  segLast: { borderTopRightRadius: 7, borderBottomRightRadius: 7 },

  legend: { marginTop: 12, gap: 7 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, color: COLORS.textMuted },
  legendPct: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },

  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 14 },

  macroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  macroStat: { alignItems: 'center', flex: 1 },
  macroValue: { fontSize: 16, fontWeight: '800', color: COLORS.darkNavy },
  macroValueBig: { fontSize: 18, color: COLORS.darkGold },
  macroLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },

  healthyFatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    backgroundColor: COLORS.lightYellow,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  healthyFatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthyFatText: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },
  healthyFatShare: { fontSize: 12, color: COLORS.textMuted },

  perServing: {
    fontSize: 11,
    color: COLORS.inactiveGray,
    textAlign: 'center',
    marginTop: 10,
  },
});
