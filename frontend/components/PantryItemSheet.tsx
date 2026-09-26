// components/PantryItemSheet.tsx — details for one pantry item.
//
// Opens from a pantry row. Shows how much you have, when you'll run low
// (automatic, or your own level), how fresh it is, where to keep it,
// typical allergens and USDA nutrition, with actions to add it to the
// grocery list, mark it as just bought, or remove it.

import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import UnitSelectModal from './UnitSelectModal';
import { COLORS } from '../constants/Colors';
import { getStorageTip, nutritionFor } from '../constants/pantryData';
import { useApp } from '../context/AppContext';
import { useAccessibility } from '../hooks/useAccessibility';
import {
  STORAGE_LABELS,
  freshness,
  freshnessLabel,
  libraryFor,
  lowLevel,
  stockStatus,
  storageFor,
} from '../utils/pantryStatus';
import type { PantryItem } from '../types';

const SERIF = 'PlayfairDisplay_700Bold';

const ALLERGEN_LABELS: Record<string, string> = {
  dairy: 'Dairy', eggs: 'Eggs', fish: 'Fish', shellfish: 'Shellfish', mollusc: 'Molluscs',
  nuts: 'Tree nuts', peanuts: 'Peanuts', wheat: 'Wheat', gluten: 'Gluten', soy: 'Soy', sesame: 'Sesame',
};

export default function PantryItemSheet({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();
  const { pantry, updatePantryQuantity, updatePantryItem, removePantryItem, addGroceryItem, grocery } = useApp();
  const [unitPicker, setUnitPicker] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const item = pantry.find(i => i.id === itemId) ?? null;

  const close = () => {
    setFlash(null);
    onClose();
  };

  return (
    <Modal visible={!!item} transparent animationType={a11y.reduceMotion ? 'fade' : 'slide'} onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close details" />
      {item ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Body
              item={item}
              onGrocery={() => {
                const added = addGroceryItem(item.name, {
                  source: stockStatus(item) === 'ok' ? 'manual' : 'low-stock',
                  quantity: Math.max(1, (item.stockedQty ?? 1) - item.quantity),
                  unit: item.unit,
                  category: item.category,
                });
                a11y.haptic('success');
                setFlash(added ? 'Added to your grocery list' : 'Already on your grocery list');
              }}
              onGroceryState={grocery.some(g => g.name.toLowerCase() === item.name.toLowerCase() && !g.checked)}
              onRestock={() => {
                updatePantryItem(item.id, { restocked: true });
                setFlash('Freshness restarted from today');
              }}
              onStep={d => updatePantryQuantity(item.id, d)}
              onUnit={() => setUnitPicker(true)}
              onLowAt={v => updatePantryItem(item.id, { lowAt: v })}
              onRemove={() => {
                removePantryItem(item.id);
                close();
              }}
              flash={flash}
            />
          </ScrollView>
          <UnitSelectModal
            visible={unitPicker}
            onClose={() => setUnitPicker(false)}
            onSelectUnit={unit => {
              updatePantryItem(item.id, { unit });
              setUnitPicker(false);
            }}
          />
        </View>
      ) : null}
    </Modal>
  );
}

function Body({
  item, onGrocery, onGroceryState, onRestock, onStep, onUnit, onLowAt, onRemove, flash,
}: {
  item: PantryItem;
  onGrocery: () => void;
  onGroceryState: boolean;
  onRestock: () => void;
  onStep: (delta: number) => void;
  onUnit: () => void;
  onLowAt: (v: number | null) => void;
  onRemove: () => void;
  flash: string | null;
}) {
  const lib = libraryFor(item.name);
  const stock = stockStatus(item);
  const fresh = freshness(item);
  const freshText = freshnessLabel(fresh);
  const storage = STORAGE_LABELS[storageFor(item)];
  const level = lowLevel(item);
  const auto = typeof item.lowAt !== 'number';
  const tip = lib ? getStorageTip(lib) : undefined;
  const nutrition = lib ? nutritionFor(lib) : undefined;
  const per = lib?.portion ? `${lib.portion.label} (${Math.round(lib.portion.grams)} g)` : '100 g';

  const freshColor =
    fresh.status === 'expired' ? COLORS.redAccent : fresh.status === 'soon' ? COLORS.darkGold : COLORS.darkNavy;

  return (
    <>
      {/* Identity */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroEmoji}>{item.icon}</Text>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.name} accessibilityRole="header">{item.name}</Text>
          <Text style={styles.subcat}>{lib?.subcategory ?? 'Your item'}</Text>
        </View>
      </View>

      <View style={styles.tags}>
        <Tag text={`${storage.emoji}  ${storage.label}`} />
        {freshText ? <Tag text={freshText} color={freshColor} /> : null}
        {stock === 'out' ? <Tag text="Out of stock" color={COLORS.redAccent} /> : null}
        {stock === 'low' ? <Tag text="Running low" color={COLORS.darkGold} tint={COLORS.lightYellow} /> : null}
      </View>

      {fresh.status !== 'unknown' ? (
        <View style={styles.freshTrack} accessibilityLabel={freshText ?? undefined}>
          <View style={[styles.freshFill, { width: `${Math.max(4, fresh.fraction * 100)}%`, backgroundColor: freshColor }]} />
        </View>
      ) : null}

      {flash ? (
        <View style={styles.flash} accessibilityLiveRegion="polite">
          <FontAwesome name="check" size={13} color={COLORS.darkNavy} />
          <Text style={styles.flashText}>{flash}</Text>
        </View>
      ) : null}

      {/* How much */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>In your kitchen</Text>
        <View style={styles.qtyRow}>
          <View style={styles.bigStepper}>
            <StepButton icon="minus" label="One less" onPress={() => onStep(-1)} disabled={item.quantity <= 0} />
            <Text style={styles.bigQty}>{item.quantity}</Text>
            <StepButton icon="plus" label="One more" onPress={() => onStep(1)} />
          </View>
          <TouchableOpacity style={styles.unitBtn} onPress={onUnit} accessibilityRole="button" accessibilityLabel={`Unit: ${item.unit}. Change`}>
            <Text style={styles.unitText}>{item.unit}</Text>
            <FontAwesome name="caret-down" size={13} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <Text style={styles.cardTitle}>Tell me it's running low at</Text>
        <View style={styles.qtyRow}>
          <View style={styles.smallStepper}>
            <StepButton icon="minus" label="Lower" small onPress={() => onLowAt(Math.max(0, level - 1))} disabled={level <= 0} />
            <Text style={styles.smallQty}>{level}</Text>
            <StepButton icon="plus" label="Higher" small onPress={() => onLowAt(level + 1)} />
          </View>
          <TouchableOpacity
            style={[styles.autoChip, auto && styles.autoChipOn]}
            onPress={() => onLowAt(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: auto }}
          >
            <Text style={[styles.autoText, auto && styles.autoTextOn]}>Automatic</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          {auto
            ? `Automatic: a quarter of what you last stocked up (${item.stockedQty ?? item.quantity} ${item.unit.toLowerCase()}).`
            : 'Your own level. Tap Automatic to go back.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primary} onPress={onGrocery} accessibilityRole="button">
          <FontAwesome name="shopping-cart" size={15} color={COLORS.cardWhite} />
          <Text style={styles.primaryText}>{onGroceryState ? 'On your list' : 'Add to grocery list'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={onRestock} accessibilityRole="button">
          <Text style={styles.secondaryText}>Just bought</Text>
        </TouchableOpacity>
      </View>

      {tip ? (
        <View style={styles.tip}>
          <Text style={styles.tipTitle}>How to keep it</Text>
          <Text style={styles.tipText}>{tip}</Text>
          {lib ? (
            <Text style={styles.tipMeta}>
              Typically keeps about {lib.shelfLifeDays >= 60 ? `${Math.round(lib.shelfLifeDays / 30)} months` : `${lib.shelfLifeDays} day${lib.shelfLifeDays === 1 ? '' : 's'}`} unopened, less once opened.
            </Text>
          ) : null}
        </View>
      ) : null}

      {lib?.allergens?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usually contains</Text>
          <View style={styles.tags}>
            {lib.allergens.map(a => (
              <Tag key={a} text={ALLERGEN_LABELS[a] ?? a} color={COLORS.redAccent} />
            ))}
          </View>
          <Text style={styles.hint}>Brands differ, so check the label.</Text>
        </View>
      ) : null}

      {nutrition && nutrition.calories !== undefined ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition per {per}</Text>
          <View style={styles.nutriGrid}>
            <Nutrient label="Calories" value={nutrition.calories} unit="" big />
            <Nutrient label="Protein" value={nutrition.protein} unit="g" big />
            <Nutrient label="Carbs" value={nutrition.carbs} unit="g" big />
            <Nutrient label="Fat" value={nutrition.fat} unit="g" big />
          </View>
          <View style={styles.nutriGrid}>
            <Nutrient label="Fiber" value={nutrition.fiber} unit="g" />
            <Nutrient label="Sugar" value={nutrition.sugar} unit="g" />
            <Nutrient label="Sodium" value={nutrition.sodium} unit="mg" />
            <Nutrient label="Potassium" value={nutrition.potassium} unit="mg" />
          </View>
          <Text style={styles.hint}>From USDA FoodData Central.</Text>
        </View>
      ) : null}

      {lib?.aliases?.length ? (
        <Text style={[styles.hint, styles.aka]}>Also called {lib.aliases.join(', ')}.</Text>
      ) : null}

      <TouchableOpacity style={styles.remove} onPress={onRemove} accessibilityRole="button">
        <FontAwesome name="trash-o" size={15} color={COLORS.redAccent} />
        <Text style={styles.removeText}>Remove from pantry</Text>
      </TouchableOpacity>
    </>
  );
}

function Tag({ text, color = COLORS.darkNavy, tint = COLORS.background }: { text: string; color?: string; tint?: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: tint, borderColor: color === COLORS.darkNavy ? COLORS.borderLight : color }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
    </View>
  );
}

function StepButton({
  icon, label, onPress, disabled, small,
}: { icon: 'plus' | 'minus'; label: string; onPress: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <TouchableOpacity
      style={[small ? styles.stepSmall : styles.step, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <FontAwesome name={icon} size={small ? 11 : 14} color={COLORS.darkNavy} />
    </TouchableOpacity>
  );
}

function Nutrient({ label, value, unit, big }: { label: string; value?: number; unit: string; big?: boolean }) {
  return (
    <View style={styles.nutrient}>
      <Text style={big ? styles.nutriBig : styles.nutriSmall}>
        {value === undefined ? '–' : `${Math.round(value)}${unit ? ` ${unit}` : ''}`}
      </Text>
      <Text style={styles.nutriLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,42,58,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%',
    backgroundColor: COLORS.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.borderLight, marginTop: 10 },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 68, height: 68, borderRadius: 22, backgroundColor: COLORS.lightYellow,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EDE28A',
  },
  heroEmoji: { fontSize: 36 },
  name: { fontFamily: SERIF, fontSize: 26, color: COLORS.darkNavy },
  subcat: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5 },
  tagText: { fontSize: 13, fontWeight: '700' },

  freshTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.blueSoft, marginTop: 12, overflow: 'hidden' },
  freshFill: { height: 6, borderRadius: 3 },

  flash: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 10,
    borderRadius: 12, backgroundColor: COLORS.lightYellow,
  },
  flashText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },

  card: {
    backgroundColor: COLORS.cardWhite, borderRadius: 18, borderWidth: 1, borderColor: COLORS.borderLight,
    padding: 16, marginTop: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy, marginBottom: 10 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 14 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bigStepper: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.background, borderRadius: 16, padding: 4 },
  step: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  bigQty: { minWidth: 48, textAlign: 'center', fontSize: 24, fontWeight: '800', color: COLORS.darkNavy },
  smallStepper: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.background, borderRadius: 12, padding: 3 },
  stepSmall: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  smallQty: { minWidth: 34, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.darkNavy },
  disabled: { opacity: 0.35 },
  unitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.background,
  },
  unitText: { fontSize: 15, fontWeight: '600', color: COLORS.darkNavy },
  autoChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: COLORS.borderLight },
  autoChipOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  autoText: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },
  autoTextOn: { color: COLORS.cardWhite },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, lineHeight: 17 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.darkNavy, borderRadius: 14, paddingVertical: 14,
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: COLORS.cardWhite },
  secondary: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.goldYellow,
    borderRadius: 14, paddingVertical: 14,
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },

  tip: { backgroundColor: COLORS.lightBlueBg, borderRadius: 16, padding: 14, marginTop: 16 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy, marginBottom: 4 },
  tipText: { fontSize: 14, color: COLORS.textDark, lineHeight: 20 },
  tipMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },

  section: { marginTop: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  nutriGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  nutrient: {
    flex: 1, backgroundColor: COLORS.cardWhite, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight,
    paddingVertical: 10, alignItems: 'center',
  },
  nutriBig: { fontSize: 17, fontWeight: '800', color: COLORS.darkNavy },
  nutriSmall: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  nutriLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  aka: { marginTop: 14 },

  remove: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, marginTop: 6 },
  removeText: { fontSize: 15, fontWeight: '700', color: COLORS.redAccent },
});
