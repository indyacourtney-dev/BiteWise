// app/(tabs)/pantry.tsx
// The /pantry route. Home's "Pantry" card pushes here, and it's also a tab.
//
// STARTER VERSION: keeps items in local state so the route works end to
// end today. The pieces for the full version already exist in the repo —
// hooks/usePantry.ts (backend fetch), PantryItemRow, QuickAddRow,
// UnitSelectModal — swap them in when the backend is running.

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { QUICK_ADDS } from '@/constants/pantryData';

type Item = { id: string; icon: string; name: string; unit: string; qty: number };

export default function PantryScreen() {
  // Inside the Tab Navigator, so this hook is safe here (unlike on
  // full-screen routes) — pads the scroll past the floating tab bar.
  const tabBarHeight = useBottomTabBarHeight();
  const [items, setItems] = useState<Item[]>([]);

  const addQuick = (q: (typeof QUICK_ADDS)[number]) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === q.id);
      if (existing) {
        return prev.map(i => (i.id === q.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: q.id, icon: q.icon, name: q.name, unit: q.unit, qty: 1 }];
    });
  };

  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>My Pantry</Text>
        <Text style={styles.sub}>Tap to add what you have at home.</Text>

        {/* Quick adds */}
        <Text style={styles.sectionLabel}>Quick add</Text>
        <View style={styles.chipsWrap}>
          {QUICK_ADDS.map(q => (
            <TouchableOpacity
              key={q.id}
              style={styles.chip}
              onPress={() => addQuick(q)}
              activeOpacity={0.8}
            >
              <Text style={styles.chipEmoji}>{q.icon}</Text>
              <Text style={styles.chipText}>{q.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Current items */}
        <Text style={styles.sectionLabel}>In your pantry</Text>
        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🧺</Text>
            <Text style={styles.emptyText}>
              Nothing yet — tap a quick add above to get started.
            </Text>
          </View>
        ) : (
          items.map(item => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemEmoji}>{item.icon}</Text>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>
                  {item.qty} {item.unit}
                </Text>
              </View>
              <TouchableOpacity onPress={() => remove(item.id)} activeOpacity={0.7} style={styles.removeBtn}>
                <FontAwesome name="trash-o" size={18} color={COLORS.redAccent} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  h1: { fontSize: 28, fontWeight: '700', color: COLORS.darkNavy },
  sub: { fontSize: 15, color: COLORS.textMuted, marginTop: 6 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkNavy,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 24,
    marginBottom: 12,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  chipEmoji: { fontSize: 15 },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },

  emptyBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 28,
  },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    marginBottom: 10,
  },
  itemEmoji: { fontSize: 22 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.darkNavy },
  itemQty: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  removeBtn: { padding: 6 },
});
