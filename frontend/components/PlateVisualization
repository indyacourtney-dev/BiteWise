// components/PlateVisualization.tsx
//
// BUG FIX from the earlier version:
// The old code used `flex: plate.produce / 50` for produce and
// `flex: plate.protein / 25` for protein. A balanced 50/25 plate
// therefore rendered as flex:1 / flex:1 — two EQUAL bands, which is
// exactly backwards from what it was trying to show. Dividing each
// value by a different denominator destroys the proportion.
//
// The fix is to feed the raw percentages into flex directly, so the
// bands are sized relative to each other the way they actually are.

import React from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import type { PlateComposition } from '../types';
import { isPlateBalanced } from '../utils/matching';

export const PLATE_COLORS = {
  produce: '#52C41A',
  protein: '#FF4D4F',
  carbs: '#FAAD14',
  fats: '#D4AF37',
} as const;

interface Props {
  plate: PlateComposition;
  compact?: boolean;
}

export default function PlateVisualization({ plate, compact = false }: Props) {
  const balanced = isPlateBalanced(plate);

  return (
    <RNView style={styles.wrap}>
      {/* Proportional bar — flex values are the raw percentages */}
      <RNView style={[styles.bar, compact && styles.barCompact]}>
        <RNView style={[styles.seg, { flex: plate.produce, backgroundColor: PLATE_COLORS.produce }]}>
          {!compact && plate.produce >= 15 && <Text style={styles.segLabel}>🥗</Text>}
        </RNView>
        <RNView style={[styles.seg, { flex: plate.protein, backgroundColor: PLATE_COLORS.protein }]}>
          {!compact && plate.protein >= 15 && <Text style={styles.segLabel}>🍗</Text>}
        </RNView>
        <RNView style={[styles.seg, { flex: plate.carbs, backgroundColor: PLATE_COLORS.carbs }]}>
          {!compact && plate.carbs >= 15 && <Text style={styles.segLabel}>🍚</Text>}
        </RNView>
        <RNView style={[styles.seg, { flex: plate.healthyFats, backgroundColor: PLATE_COLORS.fats }]} />
      </RNView>

      {/* Target markers at 50% and 75% show where the ideal cuts fall */}
      {!compact && (
        <RNView style={styles.markerRow}>
          <RNView style={{ flex: 50 }} />
          <RNView style={styles.marker} />
          <RNView style={{ flex: 25 }} />
          <RNView style={styles.marker} />
          <RNView style={{ flex: 25 }} />
        </RNView>
      )}

      {!compact && (
        <View style={styles.legend}>
          <LegendRow color={PLATE_COLORS.produce} label="Produce" value={plate.produce} target="50%" />
          <LegendRow color={PLATE_COLORS.protein} label="Protein" value={plate.protein} target="25%" />
          <LegendRow color={PLATE_COLORS.carbs} label="Carbs" value={plate.carbs} target="25%" />
          <LegendRow color={PLATE_COLORS.fats} label="Healthy fats" value={plate.healthyFats} target="~8%" />
        </View>
      )}

      <View style={[styles.status, balanced ? styles.statusOk : styles.statusWarn]}>
        <FontAwesome
          name={balanced ? 'check-circle' : 'info-circle'}
          size={14}
          color={balanced ? '#389E0D' : '#D46B08'}
        />
        <Text style={[styles.statusText, { color: balanced ? '#389E0D' : '#D46B08' }]}>
          {balanced ? 'Balanced plate' : 'Slightly off balance'}
        </Text>
      </View>
    </RNView>
  );
}

function LegendRow({
  color,
  label,
  value,
  target,
}: {
  color: string;
  label: string;
  value: number;
  target: string;
}) {
  return (
    <RNView style={styles.legendRow}>
      <RNView style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}%</Text>
      <Text style={styles.legendTarget}>target {target}</Text>
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  bar: {
    flexDirection: 'row',
    height: 34,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  barCompact: {
    height: 8,
    borderRadius: 4,
  },
  seg: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  segLabel: {
    fontSize: 14,
  },
  markerRow: {
    flexDirection: 'row',
    height: 8,
    marginBottom: 10,
  },
  marker: {
    width: 2,
    height: 6,
    backgroundColor: '#8c8c8c',
  },
  legend: {
    gap: 6,
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: '#2e4053',
    fontWeight: '600',
    flex: 1,
  },
  legendValue: {
    fontSize: 12,
    color: '#2e4053',
    fontWeight: '700',
    minWidth: 34,
    textAlign: 'right',
  },
  legendTarget: {
    fontSize: 11,
    color: '#999',
    minWidth: 68,
    textAlign: 'right',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusOk: {
    backgroundColor: '#F6FFED',
  },
  statusWarn: {
    backgroundColor: '#FFF7E6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
