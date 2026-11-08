// components/kitchen/PantryPane.tsx — the Pantry half of the Kitchen tab
//
// What's in your kitchen, saved to your account (AppContext keeps a local
// copy; lib/kitchenSync.ts syncs it). Turning it into meals is Cook with my
// pantry (app/cookWithPantry.tsx); buying more is the Grocery tab.
//
// The screen is built to be read at a glance and to need as few taps as
// possible:
//   * an "at a glance" card in plain words: how many items, how many need
//     restocking, how many to use soon — each one a tap to see just those
//   * Search (find what you have) and Add (components/kitchen/AddItemsSheet)
//     are two different buttons, because they are two different jobs
//   * "Where" chips filter by fridge / freezer / cupboard / counter
//   * "Needs attention" first: out, running low, use soon — with the fix
//     right on the row (add to list, I bought more)
//   * then everything else by section; every row says its state in a
//     sentence ("2 eggs left of 12 · running low", "1 bag · use within 2
//     days") instead of bare numbers and bars (utils/pantryWords.ts)
//   * tap a row for details (components/PantryItemSheet)

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import AddItemsSheet from '@/components/kitchen/AddItemsSheet';
import PantryItemSheet from '@/components/PantryItemSheet';
import { Chip, SectionLabel } from '@/components/ui';
import { confirmAction } from '@/utils/confirm';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { type PantryStorage } from '@/constants/pantryData';
import { CATEGORY_LABELS, getCategoryIcon } from '@/constants/Itemicons';
import { useAccessibility } from '@/hooks/useAccessibility';
import { STORAGE_LABELS, freshness, stockStatus, storageFor, summarizePantry } from '@/utils/pantryStatus';
import { itemWords, unitOnly } from '@/utils/pantryWords';
import type { PantryCategoryId, PantryItem } from '@/types';

const SERIF = 'PlayfairDisplay_700Bold';
const CATEGORY_ORDER: PantryCategoryId[] = ['produce', 'proteins', 'dairy', 'grains', 'pantry', 'other'];
const STORAGE_ORDER: PantryStorage[] = ['fridge', 'freezer', 'pantry', 'counter'];

type Focus = 'all' | 'restock' | 'soon';

export default function PantryPane({ header, onSwitch }: { header: React.ReactNode; onSwitch: (tab: 'pantry' | 'grocery') => void }) {
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const a11y = useAccessibility();
  const { pantry, grocery, updatePantryQuantity, removePantryItem, clearPantry, addGroceryItem, addLowStockToGrocery, settings, updateSettings } = useApp();

  const [query, setQuery] = useState('');
  const [where, setWhere] = useState<PantryStorage | null>(null);
  const [focus, setFocus] = useState<Focus>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState('');

  const summary = useMemo(() => summarizePantry(pantry), [pantry]);
  const restockCount = summary.low.length + summary.out.length;
  const soonCount = summary.useSoon.length + summary.expired.length;
  const onList = useMemo(() => new Set(grocery.filter(g => !g.checked).map(g => g.name.toLowerCase())), [grocery]);

  const q = query.trim().toLowerCase();
  const filtering = Boolean(q) || Boolean(where) || focus !== 'all';

  const visible = useMemo(
    () =>
      pantry.filter(item => {
        if (q && !item.name.toLowerCase().includes(q)) return false;
        if (where && (item.quantity <= 0 || storageFor(item) !== where)) return false;
        if (focus === 'restock' && stockStatus(item) === 'ok') return false;
        if (focus === 'soon') {
          const f = freshness(item).status;
          if (f !== 'soon' && f !== 'expired') return false;
        }
        return true;
      }),
    [pantry, q, where, focus],
  );

  // "Needs attention" sits on top (only in the unfiltered view): out, then
  // running low, then use soon — the things worth doing something about.
  const attention = useMemo(() => {
    if (filtering) return [];
    const rank = (i: PantryItem) => {
      const st = stockStatus(i);
      const fr = freshness(i).status;
      if (st === 'out') return 0;
      if (fr === 'expired') return 1;
      if (st === 'low') return 2;
      if (fr === 'soon') return 3;
      return 9;
    };
    return visible.filter(i => rank(i) < 9).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [visible, filtering]);
  const attentionIds = useMemo(() => new Set(attention.map(i => i.id)), [attention]);

  const grouped = useMemo(() => {
    const map = new Map<PantryCategoryId, PantryItem[]>();
    visible.filter(i => !attentionIds.has(i.id)).forEach(item => {
      const key = CATEGORY_ORDER.includes(item.category) ? item.category : 'other';
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return CATEGORY_ORDER.filter(c => map.has(c)).map(c => ({
      category: c,
      items: map.get(c)!.sort((a, b) => Number(a.quantity <= 0) - Number(b.quantity <= 0) || a.name.localeCompare(b.name)),
    }));
  }, [visible, attentionIds]);

  const openAdd = (prefill = '') => {
    setAddQuery(prefill);
    setAdding(true);
  };

  const toList = (item: PantryItem) =>
    addGroceryItem(item.name, {
      source: 'low-stock',
      quantity: Math.max(1, (item.stockedQty ?? 1) - item.quantity),
      unit: item.unit,
      category: item.category,
    });

  const confirmClear = () =>
    confirmAction({
      title: 'Clear your pantry?',
      message: 'This removes every item, on all your devices.',
      confirmLabel: 'Clear all',
      destructive: true,
      onConfirm: clearPantry,
    });

  const rowProps = (item: PantryItem) => ({
    item,
    onList: onList.has(item.name.toLowerCase()),
    onOpen: () => setOpenId(item.id),
    onStep: (d: number) => { a11y.haptic(); updatePantryQuantity(item.id, d); },
    onRemove: () => removePantryItem(item.id),
    onAddToList: () => { a11y.haptic('success'); toList(item); },
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {header}

        {/* AT A GLANCE */}
        {pantry.length > 0 ? (
          <View style={styles.glance}>
            <View style={styles.glanceTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.glanceCount}>{summary.total}</Text>
                <Text style={styles.glanceLabel}>{summary.total === 1 ? 'item' : 'items'} in your kitchen</Text>
              </View>
              <TouchableOpacity
                style={styles.cookBtn}
                onPress={() => router.push('/cookWithPantry')}
                accessibilityRole="button"
                accessibilityLabel="See what you can cook with what you have"
              >
                <FontAwesome name="cutlery" size={13} color={COLORS.darkNavy} />
                <Text style={styles.cookBtnText}>What can I make?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.glanceRow}>
              <GlanceStat
                icon="shopping-cart"
                count={restockCount}
                label={restockCount === 0 ? 'Nothing to restock' : restockCount === 1 ? 'needs restocking' : 'need restocking'}
                tone={restockCount > 0 ? 'gold' : 'quiet'}
                active={focus === 'restock'}
                onPress={() => setFocus(focus === 'restock' ? 'all' : 'restock')}
              />
              <GlanceStat
                icon="clock-o"
                count={soonCount}
                label={soonCount === 0 ? 'Everything is fresh' : soonCount === 1 ? 'to use soon' : 'to use soon'}
                tone={soonCount > 0 ? 'red' : 'quiet'}
                active={focus === 'soon'}
                onPress={() => setFocus(focus === 'soon' ? 'all' : 'soon')}
              />
            </View>
          </View>
        ) : null}

        {/* SEARCH + ADD: two jobs, two buttons */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <FontAwesome name="search" size={15} color={COLORS.inactiveGray} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search your pantry"
              placeholderTextColor={COLORS.inactiveGray}
              autoCapitalize="words"
              returnKeyType="search"
              accessibilityLabel="Search your pantry"
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={10}>
                <FontAwesome name="times-circle" size={16} color={COLORS.inactiveGray} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => openAdd()} accessibilityRole="button" accessibilityLabel="Add items to your pantry">
            <FontAwesome name="plus" size={14} color={COLORS.cardWhite} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* WHERE */}
        {pantry.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.whereRow}>
            <Chip label={`All · ${summary.total}`} small selected={!where} onPress={() => setWhere(null)} />
            {STORAGE_ORDER.map(st => {
              const n = summary.byStorage[st].length;
              if (n === 0 && where !== st) return null;
              return (
                <Chip
                  key={st}
                  label={`${STORAGE_LABELS[st].emoji} ${STORAGE_LABELS[st].label} · ${n}`}
                  small
                  selected={where === st}
                  onPress={() => setWhere(where === st ? null : st)}
                />
              );
            })}
          </ScrollView>
        ) : null}

        {/* HOW IT WORKS — once, until dismissed */}
        {pantry.length > 0 && !settings.pantryTipSeen && !filtering ? (
          <View style={styles.tipCard} accessibilityRole="summary">
            <View style={styles.tipHead}>
              <Text style={styles.tipTitle}>How your pantry works</Text>
              <TouchableOpacity onPress={() => updateSettings({ pantryTipSeen: true })} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10}>
                <Text style={styles.tipDismiss}>Got it</Text>
              </TouchableOpacity>
            </View>
            <TipLine icon="minus-circle" text="Tap − as you use things up. Every item says what’s left in plain words." />
            <TipLine icon="arrow-up" text="Running low or going off? It moves to the top, with the fix right there: add to list, or mark it bought." />
            <TipLine icon="cutlery" text="“What can I make?” turns what you have into tonight’s meal." />
          </View>
        ) : null}

        {/* ACTIVE FILTERS */}
        {filtering && pantry.length > 0 ? (
          <View style={styles.filterBar}>
            <Text style={styles.filterText}>
              {focus === 'restock' ? 'Needs restocking' : focus === 'soon' ? 'Use soon' : 'Showing'}
              {' '}{visible.length} of {pantry.length}
              {where ? ` · ${STORAGE_LABELS[where].label.toLowerCase()}` : ''}
              {q ? ` · “${query.trim()}”` : ''}
            </Text>
            <TouchableOpacity onPress={() => { setWhere(null); setFocus('all'); setQuery(''); }} accessibilityRole="button">
              <Text style={styles.filterReset}>Show all</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ITEMS */}
        {pantry.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🧺</Text>
            <Text style={styles.emptyTitle}>Your pantry is empty</Text>
            <Text style={styles.emptyText}>
              Add what's in your kitchen and BiteWise will suggest meals you can make, remind you what's running low, and build your grocery list.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => openAdd()} accessibilityRole="button">
              <FontAwesome name="plus" size={13} color={COLORS.cardWhite} />
              <Text style={styles.emptyBtnText}>Add your first items</Text>
            </TouchableOpacity>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{q ? `No “${query.trim()}” in your pantry` : 'Nothing here'}</Text>
            <Text style={styles.emptyText}>{q ? 'Want to add it?' : 'Tap Show all to see your whole pantry.'}</Text>
            {q ? (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => openAdd(query.trim())} accessibilityRole="button">
                <FontAwesome name="plus" size={13} color={COLORS.cardWhite} />
                <Text style={styles.emptyBtnText}>Add “{query.trim()}”</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <>
            {attention.length > 0 ? (
              <View style={styles.group}>
                <SectionLabel
                  tone="gold"
                  style={{ marginBottom: 8 }}
                  right={
                    restockCount > 0 ? (
                      <TouchableOpacity
                        onPress={() => { a11y.haptic('success'); addLowStockToGrocery(); }}
                        accessibilityRole="button"
                        accessibilityLabel="Add everything running low or out to the grocery list"
                        style={styles.lowAllBtn}
                      >
                        <FontAwesome name="cart-plus" size={12} color={COLORS.darkNavy} />
                        <Text style={styles.lowAllText}>Add {restockCount} to list</Text>
                      </TouchableOpacity>
                    ) : undefined
                  }
                >
                  Needs attention · {attention.length}
                </SectionLabel>
                <View style={[styles.groupCard, styles.groupCardLow]}>
                  {attention.map((item, i) => (
                    <ItemRow key={item.id} {...rowProps(item)} last={i === attention.length - 1} />
                  ))}
                </View>
              </View>
            ) : null}

            {grouped.map(group => (
              <View key={group.category} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupEmoji}>{getCategoryIcon(group.category)}</Text>
                  <Text style={styles.groupTitle}>{CATEGORY_LABELS[group.category]}</Text>
                  <Text style={styles.groupCount}>{group.items.length}</Text>
                </View>
                <View style={styles.groupCard}>
                  {group.items.map((item, i) => (
                    <ItemRow key={item.id} {...rowProps(item)} last={i === group.items.length - 1} />
                  ))}
                </View>
              </View>
            ))}

            {!filtering ? (
              <View style={styles.footerRow}>
                <TouchableOpacity onPress={() => onSwitch('grocery')} accessibilityRole="button" style={styles.footerLink}>
                  <FontAwesome name="shopping-basket" size={13} color={COLORS.darkNavy} />
                  <Text style={styles.footerLinkText}>Open grocery list</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmClear} accessibilityRole="button" accessibilityLabel="Clear pantry" style={styles.footerLink}>
                  <Text style={styles.clearText}>Clear my pantry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <PantryItemSheet itemId={openId} onClose={() => setOpenId(null)} />
      <AddItemsSheet visible={adding} initialQuery={addQuery} onClose={() => { setAdding(false); setQuery(''); }} />
    </SafeAreaView>
  );
}

function TipLine({ icon, text }: { icon: 'minus-circle' | 'arrow-up' | 'cutlery'; text: string }) {
  return (
    <View style={styles.tipLine}>
      <View style={styles.tipIcon}><FontAwesome name={icon} size={12} color={COLORS.darkNavy} /></View>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

// =====================================================
// AT-A-GLANCE STAT
// =====================================================

function GlanceStat({ icon, count, label, tone, active, onPress }: {
  icon: 'shopping-cart' | 'clock-o';
  count: number;
  label: string;
  tone: 'gold' | 'red' | 'quiet';
  active: boolean;
  onPress: () => void;
}) {
  const disabled = count === 0;
  const bg = active ? COLORS.cardWhite : tone === 'gold' ? COLORS.goldYellow : tone === 'red' ? COLORS.redSoft : 'rgba(255,255,255,0.1)';
  const fg = active || tone !== 'quiet' ? COLORS.darkNavy : COLORS.cardWhite;
  return (
    <TouchableOpacity
      style={[styles.stat, { backgroundColor: bg }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={count === 0 ? label : `${count} ${label}. ${active ? 'Showing only these' : 'Show only these'}`}
    >
      <FontAwesome name={icon} size={14} color={fg} />
      <Text style={[styles.statText, { color: fg }]} numberOfLines={2}>
        {count > 0 ? <Text style={styles.statNum}>{count} </Text> : null}
        {label}
      </Text>
      {!disabled ? <FontAwesome name={active ? 'times' : 'chevron-right'} size={11} color={fg} /> : null}
    </TouchableOpacity>
  );
}

// =====================================================
// ITEM ROW
// =====================================================

function ItemRow({
  item, last, onList, onOpen, onStep, onRemove, onAddToList,
}: {
  item: PantryItem;
  last: boolean;
  onList: boolean;
  onOpen: () => void;
  onStep: (delta: number) => void;
  onRemove: () => void;
  onAddToList: () => void;
}) {
  const w = itemWords(item);
  const out = w.tone === 'out';
  const lineColor =
    w.tone === 'out' || w.tone === 'expired' ? COLORS.redText
      : w.tone === 'low' || w.tone === 'soon' ? COLORS.textGold
      : COLORS.textMuted;
  const spoken = `${item.name}. ${w.line}${!out && w.freshText && w.tone === 'ok' ? `. ${w.freshText}` : ''}`;

  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <TouchableOpacity style={styles.rowMain} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${spoken}. Open details`}>
        <View style={[styles.iconTile, (w.tone === 'low' || w.tone === 'soon') && styles.iconTileWarn, (w.tone === 'expired') && styles.iconTileBad, out && styles.iconTileOut]}>
          <Text style={[styles.itemEmoji, out && styles.faded]}>{item.icon}</Text>
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.itemName, out && styles.fadedText]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.itemLine, { color: lineColor }]} numberOfLines={2}>
            {w.line}
            {out ? <Text style={styles.itemHint}> · tap + when you buy more</Text> : null}
            {!out && w.tone === 'ok' && w.freshText && w.fresh.daysLeft !== null && w.fresh.daysLeft <= 14 ? (
              <Text style={styles.itemHint}> · {w.freshText.toLowerCase()}</Text>
            ) : null}
          </Text>
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
            <FontAwesome name={onList ? 'check' : 'cart-plus'} size={13} color={COLORS.darkNavy} />
            <Text style={styles.listBtnText}>{onList ? 'Listed' : 'List'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(1)} accessibilityRole="button" accessibilityLabel={`I have ${item.name} again`}>
            <FontAwesome name="plus" size={13} color={COLORS.darkNavy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.stepBtn} onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
            <FontAwesome name="trash-o" size={14} color={COLORS.redAccent} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.rightSide}>
          {w.tone === 'low' && !onList ? (
            <TouchableOpacity style={styles.listMini} onPress={onAddToList} accessibilityRole="button" accessibilityLabel={`Add ${item.name} to grocery list`}>
              <FontAwesome name="cart-plus" size={12} color={COLORS.darkNavy} />
            </TouchableOpacity>
          ) : w.tone === 'low' && onList ? (
            <View style={[styles.listMini, styles.listMiniDone]} accessibilityLabel="On your grocery list">
              <FontAwesome name="check" size={11} color={COLORS.green} />
            </View>
          ) : null}
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(-1)} accessibilityRole="button" accessibilityLabel={`One less ${item.name}`}>
              <FontAwesome name="minus" size={12} color={COLORS.darkNavy} />
            </TouchableOpacity>
            <Text style={styles.qty} numberOfLines={1}>{unitOnly(item)}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(1)} accessibilityRole="button" accessibilityLabel={`One more ${item.name}`}>
              <FontAwesome name="plus" size={12} color={COLORS.darkNavy} />
            </TouchableOpacity>
          </View>
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

  // At a glance
  glance: { backgroundColor: COLORS.darkNavy, borderRadius: 24, padding: 16, marginTop: 16 },
  glanceTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  glanceCount: { fontFamily: SERIF, fontSize: 36, color: COLORS.cardWhite, lineHeight: 40 },
  glanceLabel: { fontSize: 13, fontWeight: '600', color: COLORS.navyMuted, marginTop: -2 },
  cookBtn: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: COLORS.goldYellow, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cookBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.darkNavy },
  glanceRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16, minHeight: 48 },
  statText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 17 },
  statNum: { fontWeight: '800', fontSize: 15 },

  // Search + add
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 16 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: 16, paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.darkNavy },
  addBtn: { height: 50, paddingHorizontal: 18, borderRadius: 16, backgroundColor: COLORS.darkNavy, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtnText: { color: COLORS.cardWhite, fontWeight: '800', fontSize: 15 },

  whereRow: { gap: 8, paddingTop: 12, paddingRight: 20 },

  tipCard: { marginTop: 14, backgroundColor: COLORS.lightBlueBg, borderRadius: 18, padding: 14, gap: 10 },
  tipHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tipTitle: { fontSize: 14, fontWeight: '800', color: COLORS.darkNavy },
  tipDismiss: { fontSize: 13, fontWeight: '800', color: COLORS.darkNavy, textDecorationLine: 'underline' },
  tipLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: COLORS.cardWhite, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.textDark },

  filterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: COLORS.lightBlueBg, gap: 10,
  },
  filterText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.darkNavy },
  filterReset: { fontSize: 13, fontWeight: '800', color: COLORS.darkNavy, textDecorationLine: 'underline' },

  emptyBox: {
    alignItems: 'center', gap: 8, backgroundColor: COLORS.cardWhite, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderLight,
    padding: 28, marginTop: 20,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: SERIF, fontSize: 20, color: COLORS.darkNavy, textAlign: 'center' },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 8, height: 46, paddingHorizontal: 20, borderRadius: 14, backgroundColor: COLORS.darkNavy, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyBtnText: { color: COLORS.cardWhite, fontWeight: '800', fontSize: 14 },

  // Groups
  group: { marginTop: 18 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 },
  groupEmoji: { fontSize: 16 },
  groupTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.darkNavy },
  groupCount: { fontSize: 12, fontWeight: '800', color: COLORS.darkNavy, backgroundColor: COLORS.blueSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  groupCard: { backgroundColor: COLORS.cardWhite, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderLight },
  groupCardLow: { borderColor: COLORS.yellowBorder },
  lowAllBtn: { height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: COLORS.lightYellow, flexDirection: 'row', alignItems: 'center', gap: 6 },
  lowAllText: { fontSize: 12, fontWeight: '700', color: COLORS.darkNavy },

  // Rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingLeft: 11, paddingRight: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  iconTileWarn: { backgroundColor: COLORS.lightYellow },
  iconTileBad: { backgroundColor: COLORS.redSoft },
  iconTileOut: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.inactiveGray },
  itemEmoji: { fontSize: 23 },
  faded: { opacity: 0.45 },
  fadedText: { color: COLORS.textMuted },
  itemName: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  itemLine: { fontSize: 12.5, fontWeight: '600', marginTop: 2, lineHeight: 17 },
  itemHint: { fontWeight: '400', color: COLORS.textMuted },

  rightSide: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.background, borderRadius: 12, padding: 3 },
  stepBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.cardWhite, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderLight },
  qty: { minWidth: 30, maxWidth: 74, paddingHorizontal: 4, textAlign: 'center', fontSize: 13, fontWeight: '800', color: COLORS.darkNavy },
  listMini: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.goldYellow, alignItems: 'center', justifyContent: 'center' },
  listMiniDone: { backgroundColor: COLORS.greenSoft },
  outActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listBtn: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: COLORS.goldYellow, flexDirection: 'row', alignItems: 'center', gap: 6 },
  listBtnDone: { backgroundColor: COLORS.greenSoft },
  listBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.darkNavy },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingHorizontal: 4 },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  footerLinkText: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  clearText: { fontSize: 14, fontWeight: '700', color: COLORS.redAccent },
});
