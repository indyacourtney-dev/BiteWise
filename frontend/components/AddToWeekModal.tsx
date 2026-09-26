// components/AddToWeekModal.tsx — "Add to my week" from a recipe page.
// Pick a day (next 7) and a meal; it replaces whatever was planned there.

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { useAccessibility } from '../hooks/useAccessibility';
import { todayIso } from '../utils/age';
import { PLAN_SLOTS, weekDays } from '../utils/weekPlan';
import type { PlanSlot, Recipe } from '../types';

export default function AddToWeekModal({ recipe, visible, onClose }: { recipe: Recipe | null; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();
  const { mealPlan, planMeal } = useApp();
  const days = weekDays(todayIso());
  const [date, setDate] = useState(days[0].iso);
  const [slot, setSlot] = useState<PlanSlot>('dinner');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!visible || !recipe) return;
    setDone(false);
    // Default to the recipe's own meal, and the first day that slot is free.
    const meals = recipe.mealTypes ?? [];
    const s: PlanSlot = meals.includes('dinner') ? 'dinner' : meals.includes('lunch') ? 'lunch' : meals.includes('breakfast') ? 'breakfast' : 'dinner';
    setSlot(s);
    const free = days.find(d => !mealPlan.some(m => m.date === d.iso && m.slot === s));
    setDate((free ?? days[0]).iso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, recipe?.id]);

  if (!recipe) return null;
  const taken = mealPlan.find(m => m.date === date && m.slot === slot);
  const dayTitle = days.find(d => d.iso === date)?.title ?? '';

  return (
    <Modal visible={visible} transparent animationType={a11y.reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        {done ? (
          <View style={styles.doneWrap} accessibilityLiveRegion="polite">
            <Text style={styles.doneEmoji}>📅</Text>
            <Text style={styles.title}>Added to your week</Text>
            <Text style={styles.sub}>
              {recipe.name} is {slot === 'dinner' ? 'dinner' : slot} {dayTitle === 'Today' || dayTitle === 'Tomorrow' ? dayTitle.toLowerCase() : `on ${dayTitle}`}.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.primaryText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Add to my week</Text>
            <Text style={styles.sub} numberOfLines={1}>{recipe.name}</Text>

            <Text style={styles.label}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {days.map(d => {
                const on = d.iso === date;
                return (
                  <TouchableOpacity
                    key={d.iso}
                    style={[styles.day, on && styles.dayOn]}
                    onPress={() => setDate(d.iso)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={d.title}
                  >
                    <Text style={[styles.dayShort, on && styles.textOn]}>{d.short}</Text>
                    <Text style={[styles.dayNum, on && styles.textOn]}>{d.dayNum}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Meal</Text>
            <View style={styles.row}>
              {PLAN_SLOTS.map(s => {
                const on = s.key === slot;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.slot, on && styles.slotOn]}
                    onPress={() => setSlot(s.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text>{s.emoji}</Text>
                    <Text style={[styles.slotText, on && styles.textOn]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {taken && taken.recipeId !== recipe.id ? (
              <Text style={styles.note}>This replaces {taken.name}.</Text>
            ) : null}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                planMeal(date, slot, recipe);
                a11y.haptic('success');
                setDone(true);
              }}
              accessibilityRole="button"
            >
              <FontAwesome name="calendar-plus-o" size={15} color={COLORS.cardWhite} />
              <Text style={styles.primaryText}>Add to {dayTitle === 'Today' || dayTitle === 'Tomorrow' ? dayTitle.toLowerCase() : dayTitle}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,42,58,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.borderLight, marginVertical: 10 },
  title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, color: COLORS.darkNavy },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  day: {
    width: 50, alignItems: 'center', paddingVertical: 9, borderRadius: 14,
    backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  dayOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  dayShort: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  dayNum: { fontSize: 18, fontWeight: '800', color: COLORS.darkNavy, marginTop: 2 },
  textOn: { color: COLORS.cardWhite },
  slot: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11,
    borderRadius: 14, backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  slotOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  slotText: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  note: { fontSize: 13, color: COLORS.darkGold, fontWeight: '600', marginTop: 12 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.darkNavy, borderRadius: 14, paddingVertical: 15, marginTop: 18,
  },
  primaryText: { color: COLORS.cardWhite, fontSize: 16, fontWeight: '700' },
  doneWrap: { alignItems: 'center', paddingVertical: 8 },
  doneEmoji: { fontSize: 36, marginBottom: 6 },
});
