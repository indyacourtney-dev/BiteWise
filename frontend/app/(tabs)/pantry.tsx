// app/(tabs)/pantry.tsx — "My Pantry"
//
// What's in your kitchen, saved to your account (AppContext keeps a local
// copy; lib/kitchenSync.ts syncs it). Turning it into meals is Cook with my
// pantry (app/cookWithPantry.tsx); buying more is the Grocery tab.
//
// Layout, top to bottom:
//   * the kitchen card: Fridge / Freezer / Cupboard / Counter, each a filter,
//     plus how many items are running low and need using soon
//   * one box to add OR find items (suggestions include other names, so
//     "scallions" finds Green Onions)
//   * quick adds, then your items by section, each with stock, freshness
//     and a stepper. Tap an item for details (components/PantryItemSheet).

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import PantryItemSheet from '@/components/PantryItemSheet';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { QUICK_ADDS, type PantryStorage } from '@/constants/pantryData';
import { CATEGORY_LABELS, getCategoryIcon } from '@/constants/Itemicons';
import { searchLibrary } from '@/utils/librarySearch';
import {
  STORAGE_LABELS,
  freshness,
  freshnessLabel,
  stockStatus,
  storageFor,
  summarizePantry,
} from '@/utils/pantryStatus';
import type { PantryCategoryId, PantryItem } from '@/types';

const SERIF = 'PlayfairDisplay_700Bold';
const CATEGORY_ORDER: PantryCategoryId[] = ['produce', 'proteins', 'dairy', 'grains', 'pantry', 'other'];
const STORAGE_ORDER: PantryStorage[] = ['fridge', 'freezer', 'pantry', 'counter'];

type StatusFilter = 'all' | 'soon';

export default function PantryScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { pantry, grocery, addPantryItem, updatePantryQuantity, removePantryItem, clearPantry, addGroceryItem, preferences } =
    useApp();

  const [query, setQuery] = useState('');
  const [storageFilter, setStorageFilter] = useState<PantryStorage | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const summary = useMemo(() => summarizePantry(pantry), [pantry]);
  const needsBuying = summary.low.length + summary.out.length;
  const useSoonCount = summary.useSoon.length + summary.expired.length;
  const suggestions = useMemo(() => searchLibrary(query, 6, preferences.allowAlcohol), [query, preferences.allowAlcohol]);
  const onList = useMemo(() => new Set(grocery.filter(g => !g.checked).map(g => g.name.toLowerCase())), [grocery]);
  const inPantry = useMemo(() => new Map(pantry.map(i => [i.name.toLowerCase(), i])), [pantry]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pantry.filter(item => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (storageFilter && (item.quantity <= 0 || storageFor(item) !== storageFilter)) return false;
      if (statusFilter === 'soon') {
        const f = freshness(item).status;
        if (f !== 'soon' && f !== 'expired') return false;
      }
      return true;
    });
  }, [pantry, query, storageFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<PantryCategoryId, PantryItem[]>();
    visible.forEach(item => {
      const key = CATEGORY_ORDER.includes(item.category) ? item.category : 'other';
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return CATEGORY_ORDER.filter(c => map.has(c)).map(c => ({
      category: c,
      // Out of stock sinks to the bottom of its section.
      items: map
        .get(c)!
        .sort((a, b) => Number(a.quantity <= 0) - Number(b.quantity <= 0) || a.name.localeCompare(b.name)),
    }));
  }, [visible]);

  const add = (name: string, unit?: string) => {
    if (!name.trim()) return;
    addPantryItem(name, undefined, unit);
    setQuery('');
  };

  const confirmClear = () =>
    Alert.alert('Clear your pantry?', 'This removes every item, on all your devices.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clearPantry },
    ]);

  const filtering = !!storageFilter || statusFilter !== 'all' || !!query.trim();

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
            <Text style={styles.h1} accessibilityRole="header">My Pantry</Text>
            <Text style={styles.sub}>
              {summary.total === 0
                ? 'What do you have at home?'
                : `${summary.total} item${summary.total === 1 ? '' : 's'} in your kitchen`}
            </Text>
          </View>
          {pantry.length > 0 && (
            <TouchableOpacity onPress={confirmClear} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear pantry">
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* The kitchen at a glance: each compartment is also a filter */}
        <View style={styles.kitchen}>
          <View style={styles.compartments}>
            {STORAGE_ORDER.map((s, idx) => {
              const items = summary.byStorage[s];
              const active = storageFilter === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.compartment, idx > 0 && !active && styles.compartmentBorder, active && styles.compartmentActive]}
                  onPress={() => setStorageFilter(active ? null : s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${STORAGE_LABELS[s].label}, ${items.length} items${active ? ', showing only these' : ''}`}
                >
                  <Text style={[styles.compCount, active && styles.compCountActive]}>{items.length}</Text>
                  <Text style={[styles.compLabel, active && styles.compLabelActive]}>{STORAGE_LABELS[s].label}</Text>
                  <Text style={styles.compEmoji} numberOfLines={1}>
                    {items.length ? items.slice(0, 3).map(i => i.icon).join('') : STORAGE_LABELS[s].emoji}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[styles.statusBtn, needsBuying > 0 && styles.statusBtnAlert]}
              onPress={() => router.push('/grocery')}
              accessibilityRole="button"
              accessibilityLabel={`${needsBuying} running low or out. Open grocery list`}
            >
              <FontAwesome name="shopping-cart" size={14} color={needsBuying > 0 ? COLORS.darkNavy : COLORS.cardWhite} />
              <Text style={[styles.statusText, needsBuying > 0 && styles.statusTextAlert]}>
                {needsBuying === 0 ? 'Nothing running low' : `${needsBuying} running low or out`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusBtn, statusFilter === 'soon' && styles.statusBtnOn]}
              onPress={() => setStatusFilter(statusFilter === 'soon' ? 'all' : 'soon')}
              disabled={useSoonCount === 0 && statusFilter !== 'soon'}
              accessibilityRole="button"
              accessibilityState={{ selected: statusFilter === 'soon' }}
            >
              <FontAwesome name="clock-o" size={14} color={COLORS.cardWhite} />
              <Text style={styles.statusText}>{useSoonCount === 0 ? 'All fresh' : `${useSoonCount} to use soon`}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cook with pantry */}
        <TouchableOpacity style={styles.cookBanner} activeOpacity={0.9} onPress={() => router.push('/cookWithPantry')}>
          <Text style={styles.cookEmoji}>👩‍🍳</Text>
          <View style={styles.flex1}>
            <Text style={styles.cookTitle}>Cook with my pantry</Text>
            <Text style={styles.cookSub}>
              {summary.useSoon.length > 0
                ? `Use up your ${summary.useSoon[0].name.toLowerCase()} while it's fresh`
                : summary.total > 0
                  ? 'Meals you can make with what you have'
                  : 'Add a few items, then see what you can make'}
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={14} color={COLORS.darkNavy} />
        </TouchableOpacity>

        {/* Add or find */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <FontAwesome name="search" size={15} color={COLORS.inactiveGray} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Add or find an item"
              placeholderTextColor={COLORS.inactiveGray}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => add(query)}
              accessibilityLabel="Add or find an item"
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear text" hitSlop={10}>
                <FontAwesome name="times-circle" size={16} color={COLORS.inactiveGray} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.addBtn, !query.trim() && styles.addBtnDisabled]}
            onPress={() => add(query)}
            disabled={!query.trim()}
            accessibilityRole="button"
            accessibilityLabel={query.trim() ? `Add ${query.trim()}` : 'Add item'}
          >
            <FontAwesome name="plus" size={16} color={COLORS.cardWhite} />
          </TouchableOpacity>
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestBox}>
            {suggestions.map((s, i) => {
              const have = inPantry.get(s.name.toLowerCase());
              return (
                <TouchableOpacity
                  key={s.name}
                  style={[styles.suggestRow, i === suggestions.length - 1 && styles.lastRow]}
                  onPress={() => add(s.name, s.unit)}
                  accessibilityRole="button"
                  accessibilityLabel={have ? `Add one more ${s.name}` : `Add ${s.name}`}
                >
                  <Text style={styles.suggestEmoji}>{s.icon}</Text>
                  <View style={styles.flex1}>
                    <Text style={styles.suggestName}>{s.name}</Text>
                    <Text style={styles.suggestMeta}>
                      {have ? `You have ${have.quantity} ${have.unit.toLowerCase()}` : s.subcategory}
                    </Text>
                  </View>
                  <FontAwesome name={have ? 'plus-square' : 'plus-circle'} size={18} color={COLORS.darkGold} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Quick adds */}
        {!query && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            {QUICK_ADDS.map(q => {
              const have = inPantry.has(q.name.toLowerCase());
              return (
                <TouchableOpacity
                  key={q.id}
                  style={[styles.chip, have && styles.chipHave]}
                  onPress={() => addPantryItem(q.name, undefined, q.unit)}
                  accessibilityRole="button"
                  accessibilityLabel={have ? `Add one more ${q.name}` : `Add ${q.name}`}
                >
                  <Text style={styles.chipEmoji}>{q.icon}</Text>
                  <Text style={styles.chipText}>{q.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Active filters */}
        {filtering && pantry.length > 0 && (
          <View style={styles.filterBar}>
            <Text style={styles.filterText}>
              Showing {visible.length} of {pantry.length}
              {storageFilter ? `, ${STORAGE_LABELS[storageFilter].label.toLowerCase()} only` : ''}
              {statusFilter === 'soon' ? ', use soon' : ''}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setStorageFilter(null);
                setStatusFilter('all');
                setQuery('');
              }}
              accessibilityRole="button"
            >
              <Text style={styles.filterReset}>Show all</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Items */}
        {pantry.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🧺</Text>
            <Text style={styles.emptyTitle}>Your pantry is empty</Text>
            <Text style={styles.emptyText}>
              Add what's in your kitchen. BiteWise matches meals to it and tells you when something is running low.
            </Text>
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No matching items</Text>
            <Text style={styles.emptyText}>Tap Show all to see your whole pantry.</Text>
          </View>
        ) : (
          grouped.map(group => (
            <View key={group.category} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupEmoji}>{getCategoryIcon(group.category)}</Text>
                <Text style={styles.groupTitle}>{CATEGORY_LABELS[group.category]}</Text>
                <Text style={styles.groupCount}>{group.items.length}</Text>
              </View>
              <View style={styles.groupCard}>
                {group.items.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    last={i === group.items.length - 1}
                    onList={onList.has(item.name.toLowerCase())}
                    onOpen={() => setOpenId(item.id)}
                    onStep={d => updatePantryQuantity(item.id, d)}
                    onRemove={() => removePantryItem(item.id)}
                    onAddToList={() =>
                      addGroceryItem(item.name, {
                        source: 'low-stock',
                        quantity: Math.max(1, (item.stockedQty ?? 1) - item.quantity),
                        unit: item.unit,
                        category: item.category,
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <PantryItemSheet itemId={openId} onClose={() => setOpenId(null)} />
    </SafeAreaView>
  );
}

// =====================================================
// ITEM ROW
// =====================================================

function ItemRow({
  item,
  last,
  onList,
  onOpen,
  onStep,
  onRemove,
  onAddToList,
}: {
  item: PantryItem;
  last: boolean;
  onList: boolean;
  onOpen: () => void;
  onStep: (delta: number) => void;
  onRemove: () => void;
  onAddToList: () => void;
}) {
  const stock = stockStatus(item);
  const fresh = freshness(item);
  const freshText = freshnessLabel(fresh);
  const out = stock === 'out';
  const freshColor =
    fresh.status === 'expired' ? COLORS.redAccent : fresh.status === 'soon' ? COLORS.darkGold : COLORS.textMuted;
  const spoken = [
    item.name,
    out ? 'out of stock' : `${item.quantity} ${item.unit}`,
    stock === 'low' ? 'running low' : '',
    !out && freshText ? freshText : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <TouchableOpacity style={styles.rowMain} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${spoken}. Open details`}>
        <View style={[styles.iconTile, stock === 'low' && styles.iconTileLow, out && styles.iconTileOut]}>
          <Text style={[styles.itemEmoji, out && styles.faded]}>{item.icon}</Text>
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.itemName, out && styles.fadedText]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.metaRow}>
            {out ? (
              <Text style={styles.outText}>Out</Text>
            ) : (
              <Text style={styles.itemMeta}>
                {item.quantity} {item.unit.toLowerCase()}
              </Text>
            )}
            {stock === 'low' ? <Text style={styles.lowPill}>Running low</Text> : null}
            {!out && freshText && fresh.status !== 'fresh' ? (
              <Text style={[styles.freshText, { color: freshColor }]}>{freshText}</Text>
            ) : null}
          </View>
          {!out && fresh.status !== 'unknown' ? (
            <View style={styles.freshTrack}>
              <View
                style={[
                  styles.freshFill,
                  {
                    width: `${Math.max(4, fresh.fraction * 100)}%`,
                    backgroundColor: fresh.status === 'fresh' ? COLORS.inactiveGray : freshColor,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      {out ? (
        <View style={styles.outActions}>
          <TouchableOpacity
            style={[styles.listBtn, onList && styles.listBtnDone]}
            onPress={onAddToList}
            disabled={onList}
            accessibilityRole="button"
            accessibilityLabel={onList ? `${item.name} is on your grocery list` : `Add ${item.name} to grocery list`}
          >
            <FontAwesome name={onList ? 'check' : 'cart-plus'} size={14} color={COLORS.darkNavy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(1)} accessibilityRole="button" accessibilityLabel={`I have ${item.name} again`}>
            <FontAwesome name="plus" size={13} color={COLORS.darkNavy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.stepBtn} onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
            <FontAwesome name="trash-o" size={14} color={COLORS.redAccent} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(-1)} accessibilityRole="button" accessibilityLabel={`One less ${item.name}`}>
            <FontAwesome name="minus" size={12} color={COLORS.darkNavy} />
          </TouchableOpacity>
          <Text style={styles.qty}>{item.quantity}</Text>
          <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(1)} accessibilityRole="button" accessibilityLabel={`One more ${item.name}`}>
            <FontAwesome name="plus" size={12} color={COLORS.darkNavy} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  flex1: { flex: 1 },
  lastRow: { borderBottomWidth: 0 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  h1: { fontFamily: SERIF, fontSize: 32, color: COLORS.darkNavy },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  clearBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  clearText: { fontSize: 14, fontWeight: '700', color: COLORS.redAccent },

  // Kitchen card
  kitchen: { backgroundColor: COLORS.darkNavy, borderRadius: 24, padding: 8, marginTop: 16 },
  compartments: { flexDirection: 'row' },
  compartment: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 18 },
  compartmentBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.12)' },
  compartmentActive: { backgroundColor: COLORS.goldYellow },
  compCount: { fontFamily: SERIF, fontSize: 26, color: COLORS.cardWhite },
  compCountActive: { color: COLORS.darkNavy },
  compLabel: { fontSize: 12, fontWeight: '700', color: COLORS.blueSoft, marginTop: 1 },
  compLabelActive: { color: COLORS.darkNavy },
  compEmoji: { fontSize: 14, marginTop: 6, minHeight: 18 },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusBtnAlert: { backgroundColor: COLORS.goldYellow },
  statusBtnOn: { backgroundColor: 'rgba(255,255,255,0.24)' },
  statusText: { fontSize: 13, fontWeight: '700', color: COLORS.cardWhite, flexShrink: 1 },
  statusTextAlert: { color: COLORS.darkNavy },

  cookBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.lightYellow,
    borderWidth: 1,
    borderColor: '#EDE28A',
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  cookEmoji: { fontSize: 26 },
  cookTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkNavy },
  cookSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  // Add / find
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 20 },
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
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  suggestEmoji: { fontSize: 22 },
  suggestName: { fontSize: 15, fontWeight: '600', color: COLORS.darkNavy },
  suggestMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  quickRow: { gap: 8, paddingVertical: 12, paddingRight: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipHave: { backgroundColor: COLORS.lightBlueBg },
  chipEmoji: { fontSize: 15 },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.lightBlueBg,
  },
  filterText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.darkNavy },
  filterReset: { fontSize: 13, fontWeight: '800', color: COLORS.darkNavy, textDecorationLine: 'underline' },

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

  // Groups
  group: { marginTop: 18 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 },
  groupEmoji: { fontSize: 16 },
  groupTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.darkNavy },
  groupCount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.darkNavy,
    backgroundColor: COLORS.blueSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  groupCard: { backgroundColor: COLORS.cardWhite, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderLight },

  // Rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingLeft: 11, paddingRight: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  iconTileLow: { backgroundColor: COLORS.lightYellow },
  iconTileOut: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.inactiveGray },
  itemEmoji: { fontSize: 23 },
  faded: { opacity: 0.45 },
  fadedText: { color: COLORS.textMuted },
  itemName: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  itemMeta: { fontSize: 12, color: COLORS.textMuted },
  outText: { fontSize: 12, fontWeight: '800', color: COLORS.redAccent },
  lowPill: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.darkGold,
    backgroundColor: COLORS.lightYellow,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  freshText: { fontSize: 12, fontWeight: '700' },
  freshTrack: { height: 3, borderRadius: 2, backgroundColor: COLORS.background, marginTop: 7, overflow: 'hidden', maxWidth: 160 },
  freshFill: { height: 3, borderRadius: 2 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.background, borderRadius: 12, padding: 3 },
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
  qty: { minWidth: 28, textAlign: 'center', fontSize: 15, fontWeight: '800', color: COLORS.darkNavy },
  outActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listBtn: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: COLORS.goldYellow, alignItems: 'center', justifyContent: 'center' },
  listBtnDone: { backgroundColor: COLORS.lightYellow },
});
