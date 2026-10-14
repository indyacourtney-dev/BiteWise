// app/planWeek.tsx — "My Week"
//
// The meals you plan to make or eat over the next 7 days: breakfast,
// lunch and dinner for each day. (This screen used to be a question quiz
// that ended in one meal; This or That does that job better now.)
//
//   * each day shows its planned meals with a photo; tap one to open the
//     recipe, tick it when it's cooked, or remove it
//   * tap an empty slot to pick a recipe: your favorites first, then
//     varied suggestions, or search the whole library (curated + database)
//   * "Fill empty slots" plans the rest with variety rules
//     (utils/weekPlan.ts, tested in tests/weekPlan.test.ts)
//   * "Shop for my week" puts every missing ingredient on the grocery list
//
// Recipes also get here from a recipe page's "Add to my week" button.
// Every suggestion goes through the same filters as the rest of the app
// (allergies, diets, and the 21+ alcohol rule).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { getRecipeById, formatTime, getTotalTime } from '@/constants/recipes';
import { getRecipeImage, getFallbackRecipeImage } from '@/constants/recipeImages';
import { useApp } from '@/context/AppContext';
import { useRecipeLibrary } from '@/hooks/useRecipeLibrary';
import { useAccessibility } from '@/hooks/useAccessibility';
import { fetchRecipesByIds } from '@/lib/recipesApi';
import { configured } from '@/lib/supabase';
import { ageAllowsRecipe, pantryHas } from '@/utils/matching';
import { todayIso } from '@/utils/age';
import { addDays, planSlotKey, PLAN_SLOTS, fillWeek, ingredientsToBuy, pickForSlot, weekDays } from '@/utils/weekPlan';
import { recencyPenalty } from '@/utils/variety';
import type { PlanDayStatus, PlannedMeal, PlanSlot, Recipe } from '@/types';

const SERIF = 'PlayfairDisplay_700Bold';
const DAY_STATUSES: { key: PlanDayStatus; label: string }[] = [
  { key: 'cook', label: 'Cook' },
  { key: 'leftovers', label: 'Leftovers' },
  { key: 'takeout', label: 'Takeout' },
  { key: 'no-cook', label: 'No-cook' },
];

export default function PlanWeekScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();
  const {
    mealPlan, mealPlanDays, mealPlanSlots, planMeal, planMeals, unplanMeal, unplanMeals, clearMealPlanRange, toggleMealCooked, updateMealServings,
    setPlanDayStatus, setPlanSlotStatus, preferences, favorites, pantry, addGroceryItem, recipeExposure,
  } = useApp();

  // ----- the week -----
  const today = todayIso();
  const [weekStart, setWeekStart] = useState(today);
  const days = useMemo(() => weekDays(weekStart, 7, today), [weekStart, today]);
  const dayIsos = useMemo(() => days.map(d => d.iso), [days]);
  const [slots, setSlots] = useState<PlanSlot[]>(['breakfast', 'lunch', 'dinner']);
  const [undoEntries, setUndoEntries] = useState<{ date: string; slot: PlanSlot; recipeId: string }[]>([]);
  const oldestWeekStart = addDays(today, -180);
  const canGoBack = weekStart > oldestWeekStart;

  // ----- recipes: every meal's library (curated + database, already filtered) -----
  const breakfast = useRecipeLibrary('breakfast', preferences).recipes;
  const lunch = useRecipeLibrary('lunch', preferences).recipes;
  const dinner = useRecipeLibrary('dinner', preferences).recipes;
  const libraries = useMemo(() => ({ breakfast, lunch, dinner }), [breakfast, lunch, dinner]);

  // Planned recipes that aren't in those pools (e.g. added from a recipe page).
  const [extra, setExtra] = useState<Record<string, Recipe>>({});
  const recipesById = useMemo(() => {
    const map = new Map<string, Recipe>();
    [...breakfast, ...lunch, ...dinner, ...Object.values(extra)].forEach(r => map.set(r.id, r));
    return map;
  }, [breakfast, lunch, dinner, extra]);

  const thisWeek = useMemo(
    () => mealPlan.filter(m => m.date >= dayIsos[0] && m.date <= dayIsos[dayIsos.length - 1]),
    [mealPlan, dayIsos]
  );

  useEffect(() => {
    const missing = thisWeek.map(m => m.recipeId).filter(id => !recipesById.has(id));
    if (missing.length === 0) return;
    const local = missing.map(id => getRecipeById(id)).filter((r): r is Recipe => !!r);
    const remoteIds = missing.filter(id => !getRecipeById(id));
    (async () => {
      const remote = configured && remoteIds.length ? await fetchRecipesByIds(remoteIds).catch(() => []) : [];
      setExtra(prev => {
        const next = { ...prev };
        [...local, ...remote].forEach(r => (next[r.id] = r));
        return next;
      });
    })();
  }, [thisWeek, recipesById]);

  // Age safeguard: a plan made before the birthday was set can't show an alcohol recipe.
  const visible = thisWeek.filter(m => {
    const r = recipesById.get(m.recipeId);
    return !r || ageAllowsRecipe(r, preferences);
  });
  const entryFor = (date: string, slot: PlanSlot) =>
    (mealPlanDays[date] && mealPlanDays[date] !== 'cook') ||
    (mealPlanSlots[planSlotKey(date, slot)] && mealPlanSlots[planSlotKey(date, slot)] !== 'cook')
      ? undefined
      : visible.find(m => m.date === date && m.slot === slot);
  const favoriteIds = useMemo(() => new Set(favorites.map(f => f.recipeId)), [favorites]);

  // ----- actions -----
  const [picker, setPicker] = useState<{ date: string; slot: PlanSlot } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const say = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash(f => (f === text ? null : f)), 3000);
  };

  const cookingDays = days.filter(d => d.iso >= today && (!mealPlanDays[d.iso] || mealPlanDays[d.iso] === 'cook'));
  const emptyCount = cookingDays.reduce((n, d) => n + slots.filter(s =>
    (!mealPlanSlots[planSlotKey(d.iso, s)] || mealPlanSlots[planSlotKey(d.iso, s)] === 'cook') && !entryFor(d.iso, s)
  ).length, 0);
  const plannedCount = cookingDays.reduce((n, d) => n + slots.filter(s => entryFor(d.iso, s)).length, 0);
  const weekHasContent = thisWeek.length > 0 ||
    days.some(d => mealPlanDays[d.iso] && mealPlanDays[d.iso] !== 'cook') ||
    Object.keys(mealPlanSlots).some(key => dayIsos.includes(key.slice(0, 10)));
  const dayMinutes = (date: string) =>
    visible
      .filter(m => m.date === date && !m.isLeftovers && (!mealPlanDays[date] || mealPlanDays[date] === 'cook') &&
        (!mealPlanSlots[planSlotKey(date, m.slot)] || mealPlanSlots[planSlotKey(date, m.slot)] === 'cook'))
      .reduce((total, m) => total + (recipesById.get(m.recipeId) ? getTotalTime(recipesById.get(m.recipeId)!) : m.minutes ?? 0), 0);

  const fill = (dates = cookingDays.map(d => d.iso)) => {
    const activePlan = visible.filter(m =>
      (!mealPlanDays[m.date] || mealPlanDays[m.date] === 'cook') &&
      (!mealPlanSlots[planSlotKey(m.date, m.slot)] || mealPlanSlots[planSlotKey(m.date, m.slot)] === 'cook'));
    const added = fillWeek(dates, slots, libraries, activePlan, recipesById, {
      preferences,
      favoriteIds,
      dayStatuses: mealPlanDays,
      slotStatuses: mealPlanSlots,
      // Dishes suggested or eaten in the last few days rank lower (utils/variety.ts).
      penalty: r => recencyPenalty(r.id, recipeExposure) / 10,
    });
    planMeals(added.map(({ id: _i, addedAt: _a, ...rest }) => rest));
    setUndoEntries(added.map(({ date, slot, recipeId }) => ({ date, slot, recipeId })));
    a11y.haptic('success');
    say(added.length ? `Planned ${added.length} meal${added.length === 1 ? '' : 's'}` : 'No more recipes to add');
  };

  const undoFill = () => {
    if (!undoEntries.length) return;
    unplanMeals(undoEntries);
    setUndoEntries([]);
    say('Auto-filled meals removed');
  };

  const clearWeek = () => {
    clearMealPlanRange(dayIsos[0], dayIsos[dayIsos.length - 1]);
    setUndoEntries([]);
    setConfirmClear(false);
    say('Week cleared');
  };

  const need = useMemo(
    () =>
      ingredientsToBuy(
        visible.filter(m => m.date >= today),
        recipesById,
        name => pantryHas(pantry, name),
        mealPlanDays,
        mealPlanSlots,
      ),
    [visible, recipesById, pantry, today, mealPlanDays, mealPlanSlots]
  );

  const shop = () => {
    let added = 0;
    need.forEach(n => {
      const note = n.forRecipes.length === 1 ? `For ${n.forRecipes[0]}` : `For ${n.forRecipes.length} meals this week`;
      if (addGroceryItem(n.name, { source: 'recipe', note, quantity: n.quantity, unit: n.unit, category: n.category })) added++;
    });
    a11y.haptic('success');
    say(added ? `Added ${added} item${added === 1 ? '' : 's'} to your grocery list` : 'Everything is already on your list');
  };

  // Jump from the day strip to a day.
  const scrollRef = useRef<ScrollView>(null);
  const dayY = useRef<Record<string, number>>({});

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <FontAwesome name="chevron-left" size={15} color={COLORS.darkNavy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1} accessibilityRole="header">My Week</Text>
        <Text style={styles.sub}>
          {weekStart !== today
            ? plannedCount === 0 ? 'No meals planned for this week.' : `${plannedCount} meals planned this week`
            : plannedCount === 0
            ? 'Plan what you’ll make or eat for the next 7 days.'
            : `${plannedCount} of ${plannedCount + emptyCount} meals planned`}
        </Text>

        <View style={styles.weekNav}>
          <TouchableOpacity
            style={[styles.navButton, !canGoBack && styles.disabled]}
            onPress={() => setWeekStart(current => {
              const previous = addDays(current, -7);
              return previous < oldestWeekStart ? oldestWeekStart : previous;
            })}
            disabled={!canGoBack}
            accessibilityRole="button"
            accessibilityLabel="Previous week"
          >
            <FontAwesome name="chevron-left" size={13} color={COLORS.darkNavy} />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>{days[0].date} – {days[6].date}</Text>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setWeekStart(current => addDays(current, 7))}
            accessibilityRole="button"
            accessibilityLabel="Next week"
          >
            <FontAwesome name="chevron-right" size={13} color={COLORS.darkNavy} />
          </TouchableOpacity>
          {weekStart !== today ? (
            <TouchableOpacity style={styles.todayButton} onPress={() => setWeekStart(today)} accessibilityRole="button">
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Day strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {days.map(d => {
            const isToday = d.iso === today;
            const count = slots.filter(s => entryFor(d.iso, s)).length;
            return (
              <TouchableOpacity
                key={d.iso}
                style={[styles.stripDay, isToday && styles.stripToday]}
                onPress={() => scrollRef.current?.scrollTo({ y: (dayY.current[d.iso] ?? 0) - 8, animated: !a11y.reduceMotion })}
                accessibilityRole="button"
                accessibilityLabel={`${d.title}, ${count} of ${slots.length} meals planned`}
              >
                <Text style={[styles.stripShort, isToday && styles.stripTextToday]}>{d.short}</Text>
                <Text style={[styles.stripNum, isToday && styles.stripTextToday]}>{d.dayNum}</Text>
                <View style={styles.stripDots}>
                  {slots.map((s, j) => (
                    <View key={s} style={[styles.dot, j < count && (isToday ? styles.dotOnToday : styles.dotOn)]} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Which meals to plan */}
        <View style={styles.slotChips}>
          {PLAN_SLOTS.map(s => {
            const on = slots.includes(s.key);
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.slotChip, on && styles.slotChipOn]}
                onPress={() =>
                  setSlots(prev =>
                    on
                      ? prev.length > 1
                        ? prev.filter(x => x !== s.key)
                        : prev
                      : PLAN_SLOTS.map(p => p.key).filter(k => k === s.key || prev.includes(k))
                  )
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Text style={styles.slotChipEmoji}>{s.emoji}</Text>
                <Text style={[styles.slotChipText, on && styles.slotChipTextOn]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, emptyCount === 0 && styles.disabled]}
            onPress={() => fill()}
            disabled={emptyCount === 0}
            accessibilityRole="button"
          >
            <FontAwesome name="magic" size={15} color={COLORS.cardWhite} />
            <Text style={styles.primaryText}>{emptyCount === 0 ? cookingDays.length ? 'Week is full' : 'No cook days' : `Fill ${emptyCount} empty`}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.goldBtn, need.length === 0 && styles.disabled]}
            onPress={shop}
            disabled={need.length === 0}
            accessibilityRole="button"
            accessibilityLabel={`Add ${need.length} missing ingredients to the grocery list`}
          >
            <FontAwesome name="shopping-cart" size={15} color={COLORS.darkNavy} />
            <Text style={styles.goldText}>{need.length ? `Shop for it (${need.length})` : 'Nothing to buy'}</Text>
          </TouchableOpacity>
        </View>
        {weekHasContent ? (
          <TouchableOpacity
            style={styles.clearWeekButton}
            onPress={() => setConfirmClear(true)}
            accessibilityRole="button"
            accessibilityLabel="Clear all meals and settings for this week"
          >
            <FontAwesome name="trash-o" size={15} color={COLORS.redAccent} />
            <Text style={styles.clearWeekText}>Clear week</Text>
          </TouchableOpacity>
        ) : null}

        {flash ? (
          <View style={styles.flash} accessibilityLiveRegion="polite">
            <FontAwesome name="check" size={13} color={COLORS.darkNavy} />
            <Text style={styles.flashText}>{flash}</Text>
            {undoEntries.length > 0 ? (
              <TouchableOpacity onPress={undoFill} accessibilityRole="button" accessibilityLabel="Undo auto-fill">
                <Text style={styles.undoText}>Undo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Days */}
        {days.map(d => (
          <View
            key={d.iso}
            style={styles.day}
            onLayout={e => {
              dayY.current[d.iso] = e.nativeEvent.layout.y;
            }}
          >
            <View style={styles.dayHeader}>
              <Text style={[styles.dayTitle, d.iso === today && styles.dayTitleToday]}>{d.title}</Text>
              <Text style={styles.dayDate}>{d.date}</Text>
              <View style={styles.flex1} />
              <Text style={styles.dayTime}>
                {mealPlanDays[d.iso] && mealPlanDays[d.iso] !== 'cook'
                  ? 'No cooking'
                  : dayMinutes(d.iso) ? `${dayMinutes(d.iso)} min planned` : 'No meals planned'}
              </Text>
              {d.iso >= today && (!mealPlanDays[d.iso] || mealPlanDays[d.iso] === 'cook') && slots.some(s =>
                (!mealPlanSlots[planSlotKey(d.iso, s)] || mealPlanSlots[planSlotKey(d.iso, s)] === 'cook') && !entryFor(d.iso, s)
              ) ? (
                <TouchableOpacity
                  style={styles.dayFillButton}
                  onPress={() => fill([d.iso])}
                  accessibilityRole="button"
                  accessibilityLabel={`Fill empty meals for ${d.title}`}
                >
                  <FontAwesome name="magic" size={13} color={COLORS.darkNavy} />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.dayStatusRow}>
              {DAY_STATUSES.map(option => {
                const selected = (mealPlanDays[d.iso] ?? 'cook') === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.dayStatus, selected && styles.dayStatusOn]}
                    onPress={() => setPlanDayStatus(d.iso, option.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${d.title}: ${option.label}`}
                  >
                    <Text style={[styles.dayStatusText, selected && styles.dayStatusTextOn]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.dayCard}>
              {mealPlanDays[d.iso] && mealPlanDays[d.iso] !== 'cook' ? (
                <View style={styles.dayOffMessage}>
                  <Text style={styles.dayOffTitle}>{DAY_STATUSES.find(option => option.key === mealPlanDays[d.iso])?.label}</Text>
                  <Text style={styles.dayOffText}>Switch to Cook to view or add recipes for this day.</Text>
                </View>
              ) : slots.map((slot, j) => {
                const entry = entryFor(d.iso, slot);
                const slotStatus = mealPlanSlots[planSlotKey(d.iso, slot)] ?? 'cook';
                const info = PLAN_SLOTS.find(s => s.key === slot)!;
                if (slotStatus !== 'cook') {
                  return (
                    <View key={slot} style={[styles.emptyRow, j === slots.length - 1 && styles.lastRow]}>
                      <View style={styles.emptyIcon}><Text style={styles.emptyEmoji}>{info.emoji}</Text></View>
                      <View style={styles.flex1}>
                        <Text style={styles.emptyText}>{info.label}: {slotStatus === 'leftovers' ? 'Eating leftovers' : slotStatus}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.cookSlotButton}
                        onPress={() => setPlanSlotStatus(d.iso, slot, 'cook')}
                        accessibilityRole="button"
                        accessibilityLabel={`Change ${info.label.toLowerCase()} back to cooking`}
                      >
                        <FontAwesome name="fire" size={12} color={COLORS.cardWhite} />
                        <Text style={styles.cookSlotText}>Cook</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                return entry ? (
                  <PlannedRow
                    key={slot}
                    entry={entry}
                    recipe={recipesById.get(entry.recipeId)}
                    label={`${info.label}${entry.isLeftovers ? ' · leftovers' : ''}`}
                    last={j === slots.length - 1}
                    servings={entry.servings ?? Math.max(1, preferences.householdSize)}
                    mealServings={entry.mealServings ?? Math.min(entry.servings ?? preferences.householdSize, preferences.householdSize)}
                    isLeftovers={!!entry.isLeftovers}
                    onOpen={() => router.push(`/recipe/${entry.recipeId}`)}
                    onSwap={() => setPicker({ date: d.iso, slot })}
                    onCooked={() => toggleMealCooked(entry.id)}
                    onRemove={() => unplanMeal(entry.id)}
                    onServingsChange={value => updateMealServings(entry.id, value)}
                    onLeftovers={() => setPlanSlotStatus(d.iso, slot, 'leftovers')}
                  />
                ) : (
                  <View key={slot} style={[styles.emptySlotRow, j === slots.length - 1 && styles.lastRow]}>
                    <TouchableOpacity
                      style={styles.emptyPickButton}
                      onPress={() => setPicker({ date: d.iso, slot })}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${info.label.toLowerCase()} for ${d.title}`}
                    >
                      <View style={styles.emptyIcon}><Text style={styles.emptyEmoji}>{info.emoji}</Text></View>
                      <Text style={styles.emptyText}>Add {info.label.toLowerCase()}</Text>
                      <FontAwesome name="plus" size={13} color={COLORS.darkGold} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.leftoverEmptyButton}
                      onPress={() => setPlanSlotStatus(d.iso, slot, 'leftovers')}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${info.label.toLowerCase()} as leftovers`}
                    >
                      <FontAwesome name="repeat" size={12} color={COLORS.darkGold} />
                      <Text style={styles.leftoverEmptyText}>Use leftovers</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <RecipePicker
        target={picker}
        dayTitle={picker ? days.find(d => d.iso === picker.date)?.title ?? '' : ''}
        library={picker ? libraries[picker.slot] : []}
        plan={visible}
        recipesById={recipesById}
        favoriteIds={favoriteIds}
        onClose={() => setPicker(null)}
        onPick={r => {
          if (!picker) return;
          planMeal(picker.date, picker.slot, r);
          setPicker(null);
        }}
      />

      <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={() => setConfirmClear(false)}>
        <View style={styles.clearBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmClear(false)} accessibilityLabel="Cancel clearing the week" />
          <View style={styles.clearDialog}>
            <Text style={styles.clearTitle}>Clear this week?</Text>
            <Text style={styles.clearMessage}>Meals, rollover portions, and day settings for these dates will be removed.</Text>
            <View style={styles.clearActions}>
              <TouchableOpacity style={styles.cancelClearButton} onPress={() => setConfirmClear(false)} accessibilityRole="button">
                <Text style={styles.cancelClearText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmClearButton} onPress={clearWeek} accessibilityRole="button">
                <Text style={styles.confirmClearText}>Clear week</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =====================================================
// A PLANNED MEAL
// =====================================================

function PlannedRow({
  entry,
  recipe,
  label,
  last,
  servings,
  mealServings,
  isLeftovers,
  onOpen,
  onSwap,
  onCooked,
  onRemove,
  onServingsChange,
  onLeftovers,
}: {
  entry: PlannedMeal;
  recipe?: Recipe;
  label: string;
  last: boolean;
  servings: number;
  mealServings: number;
  isLeftovers: boolean;
  onOpen: () => void;
  onSwap: () => void;
  onCooked: () => void;
  onRemove: () => void;
  onServingsChange: (servings: number) => void;
  onLeftovers: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const image = broken
    ? getFallbackRecipeImage()
    : getRecipeImage((recipe ?? { id: entry.recipeId, name: entry.name }) as Recipe);
  const minutes = recipe ? getTotalTime(recipe) : entry.minutes;

  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${entry.name}${entry.cooked ? ', cooked' : ''}. Open recipe`}
      >
        <Image source={image} style={[styles.thumb, entry.cooked && styles.faded]} onError={() => setBroken(true)} />
        <View style={styles.flex1}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={[styles.rowName, entry.cooked && styles.rowNameDone]} numberOfLines={2}>
            {entry.name}
          </Text>
          {minutes ? <Text style={styles.rowMeta}>{formatTime(minutes)}</Text> : null}
        </View>
      </TouchableOpacity>
      <View style={styles.rowControls}>
        {isLeftovers ? (
          <Text style={styles.servingText}>{mealServings} servings{entry.servingsEstimated ? ' est.' : ''}</Text>
        ) : (
          <>
            <TouchableOpacity
              style={styles.leftoversToggle}
              onPress={onLeftovers}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Use leftovers instead of cooking ${entry.name}`}
            >
              <FontAwesome name="repeat" size={12} color={COLORS.darkGold} />
              <Text style={styles.leftoversToggleText}>Leftovers</Text>
            </TouchableOpacity>
            <View style={styles.servingControl}>
              <TouchableOpacity
                onPress={() => onServingsChange(servings - 1)}
                disabled={servings <= 1}
                accessibilityRole="button"
                accessibilityLabel="Reduce cooked batch by one serving"
              >
                <FontAwesome name="minus-circle" size={17} color={servings <= 1 ? COLORS.borderLight : COLORS.darkGold} />
              </TouchableOpacity>
              <Text style={styles.servingText}>
                {servings} servings{entry.servingsEstimated ? ' est.' : ''}
              </Text>
              <TouchableOpacity
                onPress={() => onServingsChange(servings + 1)}
                disabled={servings >= 20}
                accessibilityRole="button"
                accessibilityLabel="Increase cooked batch by one serving"
              >
                <FontAwesome name="plus-circle" size={17} color={servings >= 20 ? COLORS.borderLight : COLORS.darkGold} />
              </TouchableOpacity>
            </View>
          </>
        )}
        <View style={styles.rowActions}>
        <TouchableOpacity
          style={[styles.roundBtn, entry.cooked && styles.roundBtnOn]}
          onPress={onCooked}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!entry.cooked }}
          accessibilityLabel={isLeftovers ? `Mark leftovers for ${entry.name} as eaten` : `Mark ${entry.name} as cooked`}
          hitSlop={6}
        >
          <FontAwesome name="check" size={12} color={entry.cooked ? COLORS.darkNavy : COLORS.inactiveGray} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.roundBtn} onPress={onSwap} accessibilityRole="button" accessibilityLabel={`Swap ${entry.name}`} hitSlop={6}>
          <FontAwesome name="exchange" size={11} color={COLORS.darkNavy} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.roundBtn} onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${entry.name}`} hitSlop={6}>
          <FontAwesome name="times" size={12} color={COLORS.redAccent} />
        </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// =====================================================
// PICKING A RECIPE FOR A SLOT
// =====================================================

function RecipePicker({
  target,
  dayTitle,
  library,
  plan,
  recipesById,
  favoriteIds,
  onClose,
  onPick,
}: {
  target: { date: string; slot: PlanSlot } | null;
  dayTitle: string;
  library: Recipe[];
  plan: PlannedMeal[];
  recipesById: Map<string, Recipe>;
  favoriteIds: Set<string>;
  onClose: () => void;
  onPick: (r: Recipe) => void;
}) {
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();
  const { preferences, recipeExposure } = useApp();
  const [query, setQuery] = useState('');

  useEffect(() => setQuery(''), [target]);

  const slotLabel = target ? PLAN_SLOTS.find(s => s.key === target.slot)!.label : '';
  const planned = new Set(plan.map(p => p.recipeId));

  // Five varied suggestions for this slot (same rules as Fill), then favorites, then search.
  const suggestions = useMemo(() => {
    if (!target) return [];
    const picks: Recipe[] = [];
    const working = plan.filter(p => !(p.date === target.date && p.slot === target.slot));
    for (let i = 0; i < 5; i++) {
      const r = pickForSlot(target.date, target.slot, library.filter(x => !picks.includes(x)), working, recipesById, {
        preferences,
        favoriteIds,
        penalty: x => recencyPenalty(x.id, recipeExposure) / 10,
      });
      if (!r) break;
      picks.push(r);
    }
    return picks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, library]);

  const favs = library.filter(r => favoriteIds.has(r.id)).slice(0, 10);
  const q = query.trim().toLowerCase();
  const results = q ? library.filter(r => r.name.toLowerCase().includes(q)).slice(0, 40) : [];

  return (
    <Modal visible={!!target} transparent animationType={a11y.reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>
          {slotLabel} for {dayTitle.toLowerCase() === 'today' || dayTitle.toLowerCase() === 'tomorrow' ? dayTitle.toLowerCase() : dayTitle}
        </Text>
        <View style={styles.searchBox}>
          <FontAwesome name="search" size={14} color={COLORS.inactiveGray} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${library.length} ${slotLabel.toLowerCase()} recipes`}
            placeholderTextColor={COLORS.inactiveGray}
            accessibilityLabel="Search recipes"
          />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetScroll}>
          {q ? (
            <>
              <Text style={styles.sectionTitle}>
                {results.length ? `${results.length === 40 ? '40+' : results.length} found` : 'No recipes match'}
              </Text>
              {results.map(r => (
                <PickRow key={r.id} recipe={r} planned={planned.has(r.id)} onPress={() => onPick(r)} />
              ))}
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Good picks for this day</Text>
              {suggestions.length === 0 ? <Text style={styles.emptyNote}>Loading recipes…</Text> : null}
              {suggestions.map(r => (
                <PickRow key={r.id} recipe={r} planned={planned.has(r.id)} onPress={() => onPick(r)} />
              ))}
              {favs.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Your favorites</Text>
                  {favs.map(r => (
                    <PickRow key={r.id} recipe={r} planned={planned.has(r.id)} onPress={() => onPick(r)} />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function PickRow({ recipe, planned, onPress }: { recipe: Recipe; planned: boolean; onPress: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <TouchableOpacity style={styles.pickRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Plan ${recipe.name}`}>
      <Image
        source={broken ? getFallbackRecipeImage() : getRecipeImage(recipe)}
        style={styles.pickThumb}
        onError={() => setBroken(true)}
      />
      <View style={styles.flex1}>
        <Text style={styles.pickName} numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text style={styles.pickMeta}>
          {formatTime(getTotalTime(recipe))}
          {planned ? '   Already this week' : ''}
        </Text>
      </View>
      <FontAwesome name="plus-circle" size={20} color={COLORS.darkGold} />
    </TouchableOpacity>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 4 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  h1: { fontFamily: SERIF, fontSize: 32, color: COLORS.darkNavy },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },

  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
  },
  weekLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.darkNavy, textAlign: 'center' },
  todayButton: { paddingHorizontal: 10, paddingVertical: 8 },
  todayButtonText: { color: COLORS.darkGold, fontSize: 13, fontWeight: '700' },

  strip: { gap: 8, paddingVertical: 16, paddingRight: 20 },
  stripDay: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  stripToday: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  stripShort: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  stripNum: { fontFamily: SERIF, fontSize: 20, color: COLORS.darkNavy, marginTop: 2 },
  stripTextToday: { color: COLORS.cardWhite },
  stripDots: { flexDirection: 'row', gap: 3, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderLight },
  dotOn: { backgroundColor: COLORS.darkGold },
  dotOnToday: { backgroundColor: COLORS.goldYellow },

  slotChips: { flexDirection: 'row', gap: 8 },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
  },
  slotChipOn: { backgroundColor: COLORS.lightYellow, borderColor: '#EDE28A' },
  slotChipEmoji: { fontSize: 14 },
  slotChipText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  slotChipTextOn: { color: COLORS.darkNavy },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryText: { color: COLORS.cardWhite, fontSize: 15, fontWeight: '700' },
  goldBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.goldYellow,
    borderRadius: 14,
    paddingVertical: 14,
  },
  goldText: { color: COLORS.darkNavy, fontSize: 15, fontWeight: '700' },
  clearWeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 9,
    paddingVertical: 9,
  },
  clearWeekText: { color: COLORS.redAccent, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.4 },

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
  undoText: { color: COLORS.darkGold, fontSize: 14, fontWeight: '800', paddingHorizontal: 8 },

  day: { marginTop: 22 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 },
  dayTitle: { fontFamily: SERIF, fontSize: 20, color: COLORS.darkNavy },
  dayTitleToday: { color: COLORS.darkGold },
  dayDate: { fontSize: 13, color: COLORS.textMuted },
  dayTime: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  dayFillButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
  },
  dayStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  dayStatus: {
    flexGrow: 1,
    flexBasis: '22%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
  },
  dayStatusOn: { backgroundColor: COLORS.lightYellow, borderColor: '#EDE28A' },
  dayStatusText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  dayStatusTextOn: { color: COLORS.darkNavy },
  dayCard: { backgroundColor: COLORS.cardWhite, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderLight },
  dayOffMessage: { padding: 14 },
  dayOffTitle: { fontSize: 14, fontWeight: '800', color: COLORS.darkNavy },
  dayOffText: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  lastRow: { borderBottomWidth: 0 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 58, height: 58, borderRadius: 14, backgroundColor: COLORS.blueSoft },
  faded: { opacity: 0.45 },
  rowLabel: { fontSize: 11, fontWeight: '700', color: COLORS.darkGold },
  rowName: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy, marginTop: 1 },
  rowNameDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  rowMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  rowControls: { alignItems: 'flex-end', gap: 6 },
  servingControl: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leftoversToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DCCB72',
    backgroundColor: COLORS.lightYellow,
  },
  leftoversToggleText: { fontSize: 12, fontWeight: '700', color: COLORS.darkGold },
  servingText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  rowActions: { flexDirection: 'row', gap: 6 },
  roundBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
  },
  roundBtnOn: { backgroundColor: COLORS.goldYellow, borderColor: COLORS.goldYellow },

  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  emptySlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  emptyPickButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  leftoverEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DCCB72',
    backgroundColor: COLORS.lightYellow,
  },
  leftoverEmptyText: { fontSize: 11, fontWeight: '700', color: COLORS.darkGold },
  cookSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.darkNavy,
    backgroundColor: COLORS.darkNavy,
  },
  cookSlotText: { fontSize: 12, fontWeight: '700', color: COLORS.cardWhite },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.borderLight,
  },
  emptyEmoji: { fontSize: 22, opacity: 0.6 },
  emptyText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textMuted },

  // Picker
  backdrop: { flex: 1, backgroundColor: 'rgba(28,42,58,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.borderLight, marginVertical: 10 },
  sheetTitle: { fontFamily: SERIF, fontSize: 24, color: COLORS.darkNavy },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.darkNavy },
  sheetScroll: { paddingBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.darkNavy, marginTop: 18, marginBottom: 8 },
  emptyNote: { fontSize: 14, color: COLORS.textMuted },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  pickThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: COLORS.blueSoft },
  pickName: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  pickMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  clearBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(28,42,58,0.45)' },
  clearDialog: {
    width: '100%',
    maxWidth: 380,
    padding: 20,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  clearTitle: { fontFamily: SERIF, fontSize: 22, color: COLORS.darkNavy },
  clearMessage: { marginTop: 6, fontSize: 14, lineHeight: 20, color: COLORS.textMuted },
  clearActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelClearButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.cardWhite },
  cancelClearText: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  confirmClearButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.redAccent },
  confirmClearText: { fontSize: 14, fontWeight: '700', color: COLORS.cardWhite },
});
