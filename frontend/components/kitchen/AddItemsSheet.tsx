// components/kitchen/AddItemsSheet.tsx — add things to the pantry, fast.
//
// One sheet for the whole job. Type a name and pick from the library
// (other names work: "scallions" finds Green Onions); each result says
// where it's kept and how long it lasts, so people learn what the app
// will do with it. With nothing typed, common staples are one tap away,
// grouped the way a kitchen is. Anything already in the pantry shows a
// stepper instead of an Add button, so quantities are settled right here.
//
// The sheet keeps a running "Added" strip so people can see what went in
// before they tap Done.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { findPantryLibraryItem, type PantryLibraryItem } from '@/constants/pantryData';
import { CATEGORY_LABELS, getIconForItem, guessCategory } from '@/constants/Itemicons';
import { useApp } from '@/context/AppContext';
import { useAccessibility } from '@/hooks/useAccessibility';
import { searchLibrary } from '@/utils/librarySearch';
import { STORAGE_LABELS } from '@/utils/pantryStatus';
import { describeQuantity, unitWord } from '@/utils/pantryWords';
import type { PantryCategoryId, PantryItem } from '@/types';

const SERIF = 'PlayfairDisplay_700Bold';

/** Staples most kitchens keep, in kitchen order. Names resolve against the library. */
const STAPLES: { title: string; names: string[] }[] = [
  { title: 'Dairy & eggs', names: ['Milk', 'Eggs', 'Butter', 'Cheddar Cheese', 'Greek Yogurt', 'Parmesan'] },
  { title: 'Fruit & veg', names: ['Onions', 'Garlic', 'Tomatoes', 'Lemons', 'Potatoes', 'Carrots', 'Spinach', 'Bell Peppers', 'Avocados', 'Bananas', 'Broccoli', 'Apples'] },
  { title: 'Proteins', names: ['Chicken Breast', 'Ground Beef', 'Salmon', 'Shrimp', 'Bacon', 'Tofu', 'Black Beans', 'Chickpeas'] },
  { title: 'Grains & bread', names: ['Rice', 'Pasta', 'Bread', 'Oats', 'Flour', 'Quinoa'] },
  { title: 'Cupboard', names: ['Olive Oil', 'Soy Sauce', 'Canned Tomatoes', 'Chicken Broth', 'Peanut Butter', 'Honey', 'Hot Sauce', 'Sugar'] },
  { title: 'Freezer', names: ['Frozen Peas'] },
];

function keepsFor(days: number): string {
  if (days >= 365) return `keeps ${Math.round(days / 365)} year${days >= 730 ? 's' : ''}+`;
  if (days >= 60) return `keeps ~${Math.round(days / 30)} months`;
  if (days >= 14) return `keeps ~${Math.round(days / 7)} weeks`;
  return `keeps ~${days} day${days === 1 ? '' : 's'}`;
}

export default function AddItemsSheet({ visible, onClose, initialQuery = '' }: { visible: boolean; onClose: () => void; initialQuery?: string }) {
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();
  const { pantry, addPantryItem, updatePantryQuantity, preferences } = useApp();
  const [query, setQuery] = useState(initialQuery);
  const [added, setAdded] = useState<string[]>([]);
  const inputRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setAdded([]);
      const t = setTimeout(() => inputRef.current?.focus(), Platform.OS === 'web' ? 50 : 350);
      return () => clearTimeout(t);
    }
  }, [visible, initialQuery]);

  const byName = useMemo(() => new Map(pantry.map(i => [i.name.toLowerCase(), i])), [pantry]);
  const q = query.trim();
  const results = useMemo(() => searchLibrary(q, 8, preferences.allowAlcohol), [q, preferences.allowAlcohol]);
  const exact = results.some(r => r.name.toLowerCase() === q.toLowerCase()) || Boolean(findPantryLibraryItem(q));

  const noteAdded = (name: string) => setAdded(prev => (prev.includes(name) ? prev : [...prev, name]));

  const addLibrary = (lib: PantryLibraryItem) => {
    a11y.haptic('success');
    addPantryItem(lib.name, lib.pantryCategory, lib.unit);
    noteAdded(lib.name);
  };
  const addCustom = () => {
    if (!q) return;
    a11y.haptic('success');
    const known = findPantryLibraryItem(q);
    addPantryItem(q, known?.pantryCategory, known?.unit);
    noteAdded(known?.name ?? q);
    setQuery('');
  };
  const step = (item: PantryItem, d: number) => {
    a11y.haptic();
    updatePantryQuantity(item.id, d);
    if (d > 0) noteAdded(item.name);
  };

  const staples = useMemo(
    () => STAPLES.map(g => ({ title: g.title, items: g.names.map(n => findPantryLibraryItem(n)).filter((x): x is PantryLibraryItem => Boolean(x)) })),
    [],
  );

  return (
    <Modal visible={visible} transparent animationType={a11y.reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.handle} />
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.title} accessibilityRole="header">Add to your pantry</Text>
            <Text style={s.sub}>Type a name, or tap a staple. Tap again for more.</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.done} accessibilityRole="button" accessibilityLabel="Done adding">
            <Text style={s.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={s.search}>
          <FontAwesome name="search" size={15} color={COLORS.inactiveGray} />
          <TextInput
            ref={inputRef}
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Eggs, scallions, basmati rice…"
            placeholderTextColor={COLORS.inactiveGray}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => (results[0] && !exact ? addLibrary(results[0]) : addCustom())}
            accessibilityLabel="Item name"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear" hitSlop={10}>
              <FontAwesome name="times-circle" size={16} color={COLORS.inactiveGray} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
          {q.length >= 2 ? (
            <View style={s.card}>
              {results.map((lib, i) => {
                const have = byName.get(lib.name.toLowerCase());
                const where = STORAGE_LABELS[lib.storage];
                return (
                  <View key={lib.name} style={[s.row, i < results.length - 1 && s.rowBorder]}>
                    <Text style={s.rowEmoji}>{lib.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowName}>{lib.name}</Text>
                      <Text style={s.rowMeta}>
                        {where.emoji} {where.label} · {keepsFor(lib.shelfLifeDays)}
                        {have ? (have.quantity > 0 ? ` · you have ${describeQuantity(have)}` : ' · you’re out') : ''}
                      </Text>
                    </View>
                    {have ? (
                      <Stepper value={have.quantity} unit={unitWord(have.unit, have.quantity)} onStep={d => step(have, d)} name={lib.name} />
                    ) : (
                      <TouchableOpacity style={s.addBtn} onPress={() => addLibrary(lib)} accessibilityRole="button" accessibilityLabel={`Add 1 ${unitWord(lib.unit, 1)} of ${lib.name}`}>
                        <FontAwesome name="plus" size={12} color={COLORS.cardWhite} />
                        <Text style={s.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {!exact ? (
                <TouchableOpacity style={[s.row, results.length > 0 && s.rowTop]} onPress={addCustom} accessibilityRole="button" accessibilityLabel={`Add ${q} as a new item`}>
                  <Text style={s.rowEmoji}>{getIconForItem(q, guessCategory(q))}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>Add “{q}”</Text>
                    <Text style={s.rowMeta}>As a new item under {CATEGORY_LABELS[guessCategory(q) as PantryCategoryId]}</Text>
                  </View>
                  <View style={s.addBtn}><FontAwesome name="plus" size={12} color={COLORS.cardWhite} /><Text style={s.addBtnText}>Add</Text></View>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            staples.map(group => (
              <View key={group.title} style={{ marginTop: 16 }}>
                <Text style={s.groupTitle}>{group.title}</Text>
                <View style={s.chips}>
                  {group.items.map(lib => {
                    const have = byName.get(lib.name.toLowerCase());
                    const inStock = Boolean(have && have.quantity > 0);
                    return (
                      <TouchableOpacity
                        key={lib.name}
                        style={[s.chip, inStock && s.chipHave]}
                        onPress={() => (have ? step(have, 1) : addLibrary(lib))}
                        accessibilityRole="button"
                        accessibilityLabel={inStock && have ? `${lib.name}, you have ${describeQuantity(have)}. Add one more` : `Add ${lib.name}`}
                      >
                        <Text style={s.chipEmoji}>{lib.icon}</Text>
                        <Text style={[s.chipText, inStock && s.chipTextHave]}>{lib.name}</Text>
                        {inStock && have ? <Text style={s.chipCount}>{have.quantity}</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
          <Text style={s.foot}>Salt, pepper and water are always assumed to be in your kitchen.</Text>
        </ScrollView>

        {added.length > 0 ? (
          <View style={s.addedStrip} accessibilityLiveRegion="polite">
            <FontAwesome name="check-circle" size={15} color={COLORS.green} />
            <Text style={s.addedText} numberOfLines={1}>
              Added {added.length === 1 ? '' : `${added.length}: `}{added.slice(-4).join(', ')}{added.length > 4 ? '…' : ''}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Stepper({ value, unit, onStep, name }: { value: number; unit: string; onStep: (d: number) => void; name: string }) {
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onStep(-1)} accessibilityRole="button" accessibilityLabel={`One less ${name}`}>
        <FontAwesome name="minus" size={11} color={COLORS.darkNavy} />
      </TouchableOpacity>
      <View style={{ alignItems: 'center', minWidth: 40 }}>
        <Text style={s.stepValue}>{value}</Text>
        {unit ? <Text style={s.stepUnit}>{unit}</Text> : null}
      </View>
      <TouchableOpacity style={s.stepBtn} onPress={() => onStep(1)} accessibilityRole="button" accessibilityLabel={`One more ${name}`}>
        <FontAwesome name="plus" size={11} color={COLORS.darkNavy} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,42,58,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '92%',
    backgroundColor: COLORS.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.borderLight, marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  title: { fontFamily: SERIF, fontSize: 24, color: COLORS.darkNavy },
  sub: { fontSize: 13, color: COLORS.textMuted, marginTop: 3, lineHeight: 18 },
  done: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: COLORS.darkNavy, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  doneText: { color: COLORS.cardWhite, fontWeight: '800', fontSize: 14 },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 14,
    backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: 16, paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: COLORS.darkNavy },
  body: { paddingHorizontal: 20, paddingBottom: 24 },

  card: { backgroundColor: COLORS.cardWhite, borderRadius: 18, borderWidth: 1, borderColor: COLORS.borderLight, marginTop: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
  rowTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight, backgroundColor: COLORS.lightBlueBg },
  rowEmoji: { fontSize: 24, width: 30, textAlign: 'center' },
  rowName: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  rowMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, lineHeight: 16 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.darkNavy },
  addBtnText: { color: COLORS.cardWhite, fontWeight: '800', fontSize: 13 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.background, borderRadius: 12, padding: 3 },
  stepBtn: { width: 32, height: 36, borderRadius: 10, backgroundColor: COLORS.cardWhite, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderLight },
  stepValue: { fontSize: 15, fontWeight: '800', color: COLORS.darkNavy, lineHeight: 18 },
  stepUnit: { fontSize: 10, color: COLORS.textMuted, lineHeight: 12 },

  groupTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.textMuted, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  chipHave: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  chipTextHave: { color: COLORS.cardWhite },
  chipCount: { fontSize: 12, fontWeight: '800', color: COLORS.darkNavy, backgroundColor: COLORS.goldYellow, minWidth: 22, textAlign: 'center', borderRadius: 11, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  foot: { fontSize: 12, color: COLORS.textMuted, marginTop: 20, textAlign: 'center', lineHeight: 17 },

  addedStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 8, padding: 12,
    borderRadius: 14, backgroundColor: COLORS.greenSoft,
  },
  addedText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.green },
});
