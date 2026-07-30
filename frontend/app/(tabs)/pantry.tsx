// app/(tabs)/pantry.tsx — "My Pantry"
//
// PERSISTENT: everything reads/writes through AppContext, which saves to
// AsyncStorage under per-account keys. Add an item, kill the app, reopen,
// log back in — it's still there. (The old version kept items in local
// component state, which evaporated on every unmount. That was the
// "pantry doesn't hold my data" bug.)
//
// This screen is STORAGE ONLY — what's in your kitchen. Turning it into
// meals is Cook With My Pantry (app/cookWithPantry.tsx), which reads
// this same data through the same context.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { QUICK_ADDS, SUGGESTION_LIBRARY } from '@/constants/pantryData';
import { CATEGORY_LABELS, getCategoryIcon } from '@/constants/Itemicons';
import type { PantryCategoryId, PantryItem } from '@/types';

const CATEGORY_ORDER: PantryCategoryId[] = [
  'proteins',
  'produce',
  'dairy',
  'grains',
  'pantry',
  'other',
];

export default function PantryScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const {
    pantry,
    addPantryItem,
    updatePantryQuantity,
    removePantryItem,
    clearPantry,
  } = useApp();

  const [query, setQuery] = useState('');

  // Live suggestions while typing a custom item
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return SUGGESTION_LIBRARY.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5);
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<PantryCategoryId, PantryItem[]>();
    CATEGORY_ORDER.forEach(c => map.set(c, []));
    pantry.forEach(item => {
      const list = map.get(item.category) ?? map.get('other')!;
      list.push(item);
    });
    return CATEGORY_ORDER.map(c => ({ category: c, items: map.get(c)! })).filter(
      g => g.items.length > 0
    );
  }, [pantry]);

  const addCustom = (name: string, unit?: string) => {
    if (!name.trim()) return;
    addPantryItem(name, undefined, unit);
    setQuery('');
  };

  const confirmClear = () => {
    Alert.alert('Clear pantry?', 'This removes every item.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clearPantry },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.h1}>My Pantry</Text>
            <Text style={styles.sub}>
              {pantry.length === 0
                ? 'What do you have at home?'
                : `${pantry.length} item${pantry.length === 1 ? '' : 's'} — saved to your account`}
            </Text>
          </View>
          {pantry.length > 0 && (
            <TouchableOpacity onPress={confirmClear} style={styles.clearBtn} activeOpacity={0.7}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cook with pantry shortcut */}
        {pantry.length > 0 && (
          <TouchableOpacity
            style={styles.cookBanner}
            activeOpacity={0.9}
            onPress={() => router.push('/cookWithPantry')}
          >
            <Text style={styles.cookEmoji}>👩‍🍳</Text>
            <View style={styles.flex1}>
              <Text style={styles.cookTitle}>Cook with my pantry</Text>
              <Text style={styles.cookSub}>See meals you can make with these items</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color={COLORS.darkNavy} />
          </TouchableOpacity>
        )}

        {/* Add custom item */}
        <Text style={styles.sectionLabel}>Add an item</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Type anything — chicken, rice, kale…"
            placeholderTextColor={COLORS.inactiveGray}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => addCustom(query)}
          />
          <TouchableOpacity
            style={[styles.addBtn, !query.trim() && styles.addBtnDisabled]}
            onPress={() => addCustom(query)}
            disabled={!query.trim()}
            activeOpacity={0.85}
          >
            <FontAwesome name="plus" size={16} color={COLORS.cardWhite} />
          </TouchableOpacity>
        </View>

        {/* Type-ahead suggestions */}
        {suggestions.length > 0 && (
          <View style={styles.suggestBox}>
            {suggestions.map(s => (
              <TouchableOpacity
                key={s.name}
                style={styles.suggestRow}
                onPress={() => addCustom(s.name, s.unit)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestEmoji}>{s.icon}</Text>
                <Text style={styles.suggestName}>{s.name}</Text>
                <FontAwesome name="plus-circle" size={16} color={COLORS.darkGold} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quick adds */}
        <Text style={styles.sectionLabel}>Quick add</Text>
        <View style={styles.chipsWrap}>
          {QUICK_ADDS.map(q => (
            <TouchableOpacity
              key={q.id}
              style={styles.chip}
              onPress={() => addPantryItem(q.name, undefined, q.unit)}
              activeOpacity={0.8}
            >
              <Text style={styles.chipEmoji}>{q.icon}</Text>
              <Text style={styles.chipText}>{q.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Items grouped by category */}
        {pantry.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🧺</Text>
            <Text style={styles.emptyTitle}>Your pantry is empty</Text>
            <Text style={styles.emptyText}>
              Add what's in your kitchen and BiteWise will match meals to it.
            </Text>
          </View>
        ) : (
          grouped.map(group => (
            <View key={group.category}>
              <Text style={styles.categoryLabel}>
                {getCategoryIcon(group.category)}{'  '}
                {CATEGORY_LABELS[group.category]}
              </Text>
              {group.items.map(item => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemEmoji}>{item.icon}</Text>
                  <View style={styles.flex1}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemUnit}>{item.unit}</Text>
                  </View>

                  {/* Quantity stepper */}
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      activeOpacity={0.7}
                      onPress={() =>
                        item.quantity <= 1
                          ? removePantryItem(item.id)
                          : updatePantryQuantity(item.id, -1)
                      }
                    >
                      <FontAwesome
                        name={item.quantity <= 1 ? 'trash-o' : 'minus'}
                        size={13}
                        color={item.quantity <= 1 ? COLORS.redAccent : COLORS.darkNavy}
                      />
                    </TouchableOpacity>
                    <Text style={styles.qty}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      activeOpacity={0.7}
                      onPress={() => updatePantryQuantity(item.id, 1)}
                    >
                      <FontAwesome name="plus" size={13} color={COLORS.darkNavy} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
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
  flex1: { flex: 1 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  h1: { fontSize: 28, fontWeight: '700', color: COLORS.darkNavy },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 5 },
  clearBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  clearText: { fontSize: 13, fontWeight: '700', color: COLORS.redAccent },

  cookBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.goldYellow,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  cookEmoji: { fontSize: 26 },
  cookTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkNavy },
  cookSub: { fontSize: 12, color: COLORS.darkNavy, opacity: 0.75, marginTop: 2 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkNavy,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 24,
    marginBottom: 12,
  },

  addRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.darkNavy,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.darkNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },

  suggestBox: {
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    marginTop: 8,
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  suggestEmoji: { fontSize: 16 },
  suggestName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },

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
    marginTop: 24,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.darkNavy },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  categoryLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginTop: 22,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 12,
    marginBottom: 10,
  },
  itemEmoji: { fontSize: 22 },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.darkNavy },
  itemUnit: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 3,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  qty: {
    minWidth: 30,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.darkNavy,
  },
});
