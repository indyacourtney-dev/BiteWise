// app/(tabs)/grocery.tsx — the grocery list.
//
//   * "Running low at home": pantry items at or below their running-low
//     level, or out, that aren't on the list yet. One tap adds one, or all.
//   * The list, sorted by store aisle in walking order (produce first,
//     frozen last), so you shop in one pass.
//   * Check things off as they go in the cart; "Put in pantry" moves them
//     into the pantry with fresh dates and the running-low level reset.
//
// Items also arrive from Cook with my pantry ("add missing") and from each
// pantry item's details. Everything syncs with the account (lib/kitchenSync.ts).

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { useAccessibility } from '@/hooks/useAccessibility';
import { searchLibrary } from '@/utils/librarySearch';
import { AISLE_EMOJI, aisleRank, stockStatus, type Aisle } from '@/utils/pantryStatus';
import type { GroceryItem, PantryItem } from '@/types';

const SERIF = 'PlayfairDisplay_700Bold';

export default function GroceryScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const a11y = useAccessibility();
  const {
    pantry,
    grocery,
    addGroceryItem,
    toggleGroceryItem,
    updateGroceryQuantity,
    removeGroceryItem,
    addLowStockToGrocery,
    moveCheckedToPantry,
    clearCheckedGrocery,
    preferences,
  } = useApp();

  const [query, setQuery] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const listed = useMemo(() => new Set(grocery.map(g => g.name.toLowerCase())), [grocery]);
  const lowAtHome = useMemo(
    () =>
      pantry
        .filter(i => stockStatus(i) !== 'ok' && !listed.has(i.name.toLowerCase()))
        .sort((a, b) => a.quantity - b.quantity),
    [pantry, listed]
  );
  const toBuy = grocery.filter(g => !g.checked);
  const inCart = grocery.filter(g => g.checked);
  const suggestions = useMemo(() => searchLibrary(query, 5, preferences.allowAlcohol), [query, preferences.allowAlcohol]);

  const aisles = useMemo(() => {
    const map = new Map<string, GroceryItem[]>();
    toBuy.forEach(g => map.set(g.aisle, [...(map.get(g.aisle) ?? []), g]));
    return [...map.entries()]
      .sort((a, b) => aisleRank(a[0]) - aisleRank(b[0]))
      .map(([aisle, items]) => ({ aisle, items: items.sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [toBuy]);

  const say = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash(f => (f === text ? null : f)), 2600);
  };

  const add = (name: string, unit?: string) => {
    if (!name.trim()) return;
    const added = addGroceryItem(name, { unit });
    say(added ? `Added ${name.trim()}` : `${name.trim()} is already on your list`);
    setQuery('');
  };

  const addLow = (item: PantryItem) => {
    addGroceryItem(item.name, {
      source: 'low-stock',
      quantity: Math.max(1, (item.stockedQty ?? 1) - item.quantity),
      unit: item.unit,
      category: item.category,
    });
  };

  const putAway = () => {
    const n = moveCheckedToPantry();
    a11y.haptic('success');
    say(`${n} item${n === 1 ? '' : 's'} put in your pantry`);
  };

  const share = () => {
    const text = aisles
      .map(({ aisle, items }) => `${aisle}\n${items.map(g => `- ${g.name} (${g.quantity} ${g.unit.toLowerCase()})`).join('\n')}`)
      .join('\n\n');
    Share.share({ title: 'Grocery list', message: `Grocery list\n\n${text}` }).catch(() => {});
  };

  const progress = grocery.length ? inCart.length / grocery.length : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={styles.headerRow}>
          <View style={styles.flex1}>
            <Text style={styles.h1} accessibilityRole="header">Grocery List</Text>
            <Text style={styles.sub}>
              {grocery.length === 0
                ? 'Nothing to buy yet'
                : toBuy.length === 0
                  ? 'Everything is in your cart'
                  : `${toBuy.length} to buy${inCart.length ? `, ${inCart.length} in your cart` : ''}`}
            </Text>
          </View>
          {toBuy.length > 0 && (
            <TouchableOpacity style={styles.iconBtn} onPress={share} accessibilityRole="button" accessibilityLabel="Share list">
              <FontAwesome name="share-square-o" size={17} color={COLORS.darkNavy} />
            </TouchableOpacity>
          )}
        </View>

        {grocery.length > 0 && (
          <View style={styles.progressTrack} accessibilityLabel={`${inCart.length} of ${grocery.length} in your cart`}>
            <View style={[styles.progressFill, { width: `${Math.max(3, progress * 100)}%` }]} />
          </View>
        )}

        {/* Running low at home */}
        {lowAtHome.length > 0 && (
          <View style={styles.lowCard}>
            <View style={styles.lowHeader}>
              <View style={styles.flex1}>
                <Text style={styles.lowTitle}>Running low at home</Text>
                <Text style={styles.lowSub}>
                  {lowAtHome.length} item{lowAtHome.length === 1 ? '' : 's'} from your pantry. Tap to add.
                </Text>
              </View>
              {lowAtHome.length > 1 && (
                <TouchableOpacity
                  style={styles.addAllBtn}
                  onPress={() => {
                    const n = addLowStockToGrocery();
                    say(`Added ${n} item${n === 1 ? '' : 's'}`);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.addAllText}>Add all</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.lowChips}>
              {lowAtHome.map(item => {
                const out = item.quantity <= 0;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.lowChip}
                    onPress={() => addLow(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.name}, ${out ? 'out' : `${item.quantity} left`}`}
                  >
                    <Text style={styles.lowChipEmoji}>{item.icon}</Text>
                    <View>
                      <Text style={styles.lowChipName}>{item.name}</Text>
                      <Text style={[styles.lowChipMeta, out && styles.lowChipOut]}>
                        {out ? 'Out' : `${item.quantity} left`}
                      </Text>
                    </View>
                    <FontAwesome name="plus" size={12} color={COLORS.goldYellow} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Add */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <FontAwesome name="plus" size={14} color={COLORS.inactiveGray} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Add to the list"
              placeholderTextColor={COLORS.inactiveGray}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => add(query)}
              accessibilityLabel="Add to the grocery list"
            />
          </View>
          <TouchableOpacity
            style={[styles.addBtn, !query.trim() && styles.addBtnDisabled]}
            onPress={() => add(query)}
            disabled={!query.trim()}
            accessibilityRole="button"
            accessibilityLabel="Add"
          >
            <FontAwesome name="plus" size={16} color={COLORS.cardWhite} />
          </TouchableOpacity>
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestBox}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={s.name}
                style={[styles.suggestRow, i === suggestions.length - 1 && styles.lastRow]}
                onPress={() => add(s.name, s.unit)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${s.name}`}
              >
                <Text style={styles.suggestEmoji}>{s.icon}</Text>
                <Text style={styles.suggestName}>{s.name}</Text>
                <FontAwesome
                  name={listed.has(s.name.toLowerCase()) ? 'check' : 'plus-circle'}
                  size={17}
                  color={COLORS.darkGold}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {flash ? (
          <View style={styles.flash} accessibilityLiveRegion="polite">
            <FontAwesome name="check" size={13} color={COLORS.darkNavy} />
            <Text style={styles.flashText}>{flash}</Text>
          </View>
        ) : null}

        {/* The list */}
        {grocery.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>Your list is empty</Text>
            <Text style={styles.emptyText}>
              Add items above. When something in your pantry runs low, it shows up here so you can add it in one tap.
            </Text>
          </View>
        ) : (
          aisles.map(({ aisle, items }) => (
            <View key={aisle} style={styles.aisle}>
              <View style={styles.aisleHeader}>
                <Text style={styles.aisleEmoji}>{AISLE_EMOJI[aisle as Aisle] ?? '🛒'}</Text>
                <Text style={styles.aisleTitle}>{aisle}</Text>
                <Text style={styles.aisleCount}>{items.length}</Text>
              </View>
              <View style={styles.card}>
                {items.map((g, i) => (
                  <GroceryRow
                    key={g.id}
                    item={g}
                    last={i === items.length - 1}
                    onToggle={() => {
                      a11y.haptic('light');
                      toggleGroceryItem(g.id);
                    }}
                    onStep={d => updateGroceryQuantity(g.id, d)}
                    onRemove={() => removeGroceryItem(g.id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {/* In the cart */}
        {inCart.length > 0 && (
          <View style={styles.cart}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>In your cart</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Remove checked items?', "They'll leave the list without going into your pantry.", [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: clearCheckedGrocery },
                  ])
                }
                accessibilityRole="button"
              >
                <Text style={styles.cartClear}>Remove</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {inCart.map((g, i) => (
                <GroceryRow
                  key={g.id}
                  item={g}
                  last={i === inCart.length - 1}
                  onToggle={() => toggleGroceryItem(g.id)}
                  onStep={d => updateGroceryQuantity(g.id, d)}
                  onRemove={() => removeGroceryItem(g.id)}
                />
              ))}
            </View>
            <TouchableOpacity style={styles.putAway} onPress={putAway} accessibilityRole="button">
              <FontAwesome name="archive" size={16} color={COLORS.darkNavy} />
              <Text style={styles.putAwayText}>
                Put {inCart.length} item{inCart.length === 1 ? '' : 's'} in my pantry
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function GroceryRow({
  item,
  last,
  onToggle,
  onStep,
  onRemove,
}: {
  item: GroceryItem;
  last: boolean;
  onToggle: () => void;
  onStep: (d: number) => void;
  onRemove: () => void;
}) {
  const detail =
    item.note ?? (item.source === 'low-stock' ? 'Running low at home' : item.source === 'recipe' ? 'For a recipe' : null);
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
      >
        <View style={[styles.check, item.checked && styles.checkOn]}>
          {item.checked ? <FontAwesome name="check" size={13} color={COLORS.darkNavy} /> : null}
        </View>
        <Text style={[styles.rowEmoji, item.checked && styles.faded]}>{item.icon}</Text>
        <View style={styles.flex1}>
          <Text style={[styles.rowName, item.checked && styles.rowNameDone]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {item.quantity} {item.unit.toLowerCase()}
            {detail ? `   ${detail}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
      {!item.checked ? (
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => (item.quantity <= 1 ? onRemove() : onStep(-1))}
            accessibilityRole="button"
            accessibilityLabel={item.quantity <= 1 ? `Remove ${item.name}` : `One less ${item.name}`}
          >
            <FontAwesome
              name={item.quantity <= 1 ? 'trash-o' : 'minus'}
              size={12}
              color={item.quantity <= 1 ? COLORS.redAccent : COLORS.darkNavy}
            />
          </TouchableOpacity>
          <Text style={styles.qty}>{item.quantity}</Text>
          <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(1)} accessibilityRole="button" accessibilityLabel={`One more ${item.name}`}>
            <FontAwesome name="plus" size={12} color={COLORS.darkNavy} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  flex1: { flex: 1 },
  lastRow: { borderBottomWidth: 0 },
  faded: { opacity: 0.45 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  h1: { fontFamily: SERIF, fontSize: 32, color: COLORS.darkNavy },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.blueSoft, marginTop: 14, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.goldYellow },

  // Running low
  lowCard: { backgroundColor: COLORS.darkNavy, borderRadius: 24, padding: 16, marginTop: 16 },
  lowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lowTitle: { fontFamily: SERIF, fontSize: 20, color: COLORS.cardWhite },
  lowSub: { fontSize: 13, color: COLORS.blueSoft, marginTop: 2 },
  addAllBtn: { backgroundColor: COLORS.goldYellow, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  addAllText: { fontSize: 14, fontWeight: '800', color: COLORS.darkNavy },
  lowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  lowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 12,
  },
  lowChipEmoji: { fontSize: 20 },
  lowChipName: { fontSize: 14, fontWeight: '700', color: COLORS.cardWhite },
  lowChipMeta: { fontSize: 11, color: COLORS.blueSoft },
  lowChipOut: { color: COLORS.goldYellow, fontWeight: '800' },

  // Add
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 18 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.darkNavy },
  addBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: COLORS.darkNavy, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.35 },
  suggestBox: {
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 16,
    marginTop: 8,
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  suggestEmoji: { fontSize: 20 },
  suggestName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.darkNavy },

  flash: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.lightYellow,
  },
  flashText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },

  emptyBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 28,
    marginTop: 20,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: SERIF, fontSize: 20, color: COLORS.darkNavy },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  // Aisles
  aisle: { marginTop: 18 },
  aisleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 },
  aisleEmoji: { fontSize: 16 },
  aisleTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.darkNavy },
  aisleCount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.darkNavy,
    backgroundColor: COLORS.blueSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  card: { backgroundColor: COLORS.cardWhite, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderLight },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingLeft: 12, paddingRight: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: COLORS.inactiveGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: COLORS.goldYellow, borderColor: COLORS.goldYellow },
  rowEmoji: { fontSize: 22 },
  rowName: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  rowNameDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  rowMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.background, borderRadius: 12, padding: 3 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  qty: { minWidth: 26, textAlign: 'center', fontSize: 14, fontWeight: '800', color: COLORS.darkNavy },

  // Cart
  cart: { marginTop: 26 },
  cartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  cartTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMuted },
  cartClear: { fontSize: 14, fontWeight: '700', color: COLORS.redAccent },
  putAway: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.goldYellow,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 12,
  },
  putAwayText: { fontSize: 16, fontWeight: '800', color: COLORS.darkNavy },
});
