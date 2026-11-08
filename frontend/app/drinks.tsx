// app/drinks.tsx — Drinks: a section of its own, separate from food.
//
// Two segments: "Mocktails & more" (smoothies, coffee, tea, lemonades) for
// everyone, and "Cocktails" for accounts whose age allows alcohol. When it
// isn't allowed the segment simply isn't there — the screen never says why
// (see utils/age.ts; the birthday copy stays neutral on purpose).
//
// The first time someone opens Cocktails they see a short note and tap
// through once; it's remembered with their preferences (synced), so it's
// asked once per account, not per device.
//
// Ranking favours what they can make right now (pantry), then what they've
// saved. Nothing here feeds meal picks or the week plan, and vice versa.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { HelpButton } from '@/components/Help';
import { Card, Chip, Display, Pill, PrimaryButton, RecipeTile, ScreenHeader, SecondaryButton, SectionLabel, SegmentedControl, ui } from '@/components/ui';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { useAccessibility } from '@/hooks/useAccessibility';
import { fetchDrinks } from '@/lib/drinksApi';
import { applyDrinkFilters, countByType, DRINK_FILTERS, DRINK_TYPES, drinksForSegment, keyIngredients, rankDrinks, type DrinkFilter, type DrinkSegment, type DrinkType, type RankedDrink } from '@/utils/drinks';
import { displayIngredientName } from '@/utils/matching';
import type { Recipe } from '@/types';

export default function DrinksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();
  const { preferences, pantry, favorites, toggleFavorite, isFavorite, updatePreferences } = useApp();

  const cocktailsAllowed = preferences.allowAlcohol === true;
  const [segment, setSegment] = useState<DrinkSegment>('mocktails');
  const [filters, setFilters] = useState<Set<DrinkFilter>>(new Set());
  const [all, setAll] = useState<Recipe[] | null>(null);
  const [error, setError] = useState(false);
  const [featured, setFeatured] = useState(0);
  const [type, setType] = useState<DrinkType | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDrinks()
      .then(d => { if (!cancelled) setAll(d); })
      .catch(() => { if (!cancelled) { setAll([]); setError(true); } });
    return () => { cancelled = true; };
  }, []);

  // If the account stops allowing cocktails (it can't, but be safe), fall back.
  useEffect(() => {
    if (!cocktailsAllowed && segment === 'cocktails') setSegment('mocktails');
  }, [cocktailsAllowed, segment]);

  const pool = useMemo(
    () => (all ? drinksForSegment(all, segment, preferences) : []),
    [all, segment, preferences],
  );
  const favoriteIds = useMemo(() => favorites.map(f => f.recipeId), [favorites]);
  const ranked = useMemo(
    () => rankDrinks(applyDrinkFilters(pool, filters, pantry, type), pantry, favoriteIds),
    [pool, filters, pantry, favoriteIds, type],
  );
  const typeCounts = useMemo(() => countByType(applyDrinkFilters(pool, filters, pantry)), [pool, filters, pantry]);
  const types = DRINK_TYPES[segment].filter(t => (typeCounts[t.id] ?? 0) > 0);

  useEffect(() => { setFeatured(0); }, [segment, filters, pool.length, type]);
  useEffect(() => { setType(null); }, [segment]);

  const toggleFilter = (f: DrinkFilter) => {
    a11y.haptic();
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  const needsConfirm = segment === 'cocktails' && !preferences.cocktailsConfirmedAt;
  const top = ranked.length > 0 ? ranked[featured % ranked.length] : null;
  const rest = ranked.filter((_, i) => i !== (featured % Math.max(1, ranked.length)));

  const open = (r: Recipe) => router.push(`/recipe/${r.id}`);
  const barCount = pantry.filter(p => p.quantity > 0).length;

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScreenHeader
        kicker="Drinks"
        title="Something to sip"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        right={<HelpButton topic="drinks" />}
      />

      <ScrollView contentContainerStyle={[ui.pad, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        {cocktailsAllowed ? (
          <SegmentedControl<DrinkSegment>
            options={[{ key: 'mocktails', label: 'Mocktails & more' }, { key: 'cocktails', label: 'Cocktails' }]}
            value={segment}
            onChange={v => { a11y.haptic(); setSegment(v); }}
            style={{ marginTop: 6 }}
          />
        ) : (
          <Text style={s.lede}>Smoothies, coffee, tea, lemonades and more — made with what's in your kitchen.</Text>
        )}

        <View style={s.filterRow}>
          {DRINK_FILTERS.map(f => (
            <Chip
              key={f.id}
              label={f.label}
              icon={f.icon as any}
              small
              selected={filters.has(f.id)}
              onPress={() => toggleFilter(f.id)}
            />
          ))}
        </View>

        {/* WHAT KIND — one row, counts included, so the section reads as specific drinks, not a pile */}
        {!needsConfirm && types.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeRow}>
            <Chip label={`All · ${Object.values(typeCounts).reduce((a, b) => a + (b ?? 0), 0)}`} small tone="gold" selected={type === null} onPress={() => { a11y.haptic(); setType(null); }} />
            {types.map(t => (
              <Chip
                key={t.id}
                label={`${t.emoji} ${t.label} · ${typeCounts[t.id]}`}
                small
                tone="gold"
                selected={type === t.id}
                onPress={() => { a11y.haptic(); setType(type === t.id ? null : t.id); }}
              />
            ))}
          </ScrollView>
        ) : null}

        {needsConfirm ? (
          <Card style={s.confirmCard} tone="navy">
            <Text style={s.confirmEmoji}>🍸</Text>
            <Display size={22} style={{ color: COLORS.cardWhite }}>Before you open Cocktails</Display>
            <Text style={s.confirmText}>
              These recipes contain alcohol. Please enjoy them responsibly and only where it's legal for you.
              Cocktails stay in this section — they never appear in your meal picks or week plan.
            </Text>
            <PrimaryButton
              label="Show cocktails"
              tone="yellow"
              icon="arrow-right"
              onPress={() => { a11y.haptic('success'); updatePreferences({ cocktailsConfirmedAt: Date.now() }); }}
            />
            <TouchableOpacity onPress={() => setSegment('mocktails')} style={s.confirmSecondary} accessibilityRole="button">
              <Text style={s.confirmSecondaryText}>Not now — back to mocktails</Text>
            </TouchableOpacity>
          </Card>
        ) : all === null ? (
          <View style={s.center}>
            <ActivityIndicator color={COLORS.darkNavy} />
            <Text style={s.hint}>Pouring…</Text>
          </View>
        ) : !top ? (
          <Card style={[s.emptyCard]}>
            <Display size={20}>{filters.size > 0 ? 'Nothing matches those filters' : 'Nothing fits every rule'}</Display>
            <Text style={s.hint}>
              {filters.size > 0
                ? filters.has('pantry') && barCount === 0
                  ? 'Add what you have to your pantry and we’ll show drinks you can make right now.'
                  : 'Try taking a filter off.'
                : `Your allergies and diets rule out every ${segment === 'cocktails' ? 'cocktail' : 'drink'} we have right now.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {filters.size > 0 ? (
                <SecondaryButton label="Clear filters" onPress={() => setFilters(new Set())} style={{ flex: 1 }} />
              ) : (
                <SecondaryButton label="Preferences" onPress={() => router.push('/settings/preferences')} style={{ flex: 1 }} />
              )}
              {filters.has('pantry') && barCount === 0 ? (
                <SecondaryButton label="Open pantry" onPress={() => router.push('/kitchen')} style={{ flex: 1 }} />
              ) : null}
            </View>
          </Card>
        ) : (
          <>
            {error ? <Text style={s.error}>Showing the built-in drinks — more will load when you’re back online.</Text> : null}

            {/* TONIGHT'S DRINK */}
            <SectionLabel tone="gold" style={{ marginTop: 18 }}>Tonight’s drink</SectionLabel>
            <FeaturedDrink
              item={top}
              saved={isFavorite(top.recipe.id)}
              onOpen={() => open(top.recipe)}
              onAnother={() => { a11y.haptic(); setFeatured(n => n + 1); }}
              onSave={() => { a11y.haptic(); toggleFavorite(top.recipe.id); }}
              canCycle={ranked.length > 1}
            />

            {/* MORE */}
            {rest.length > 0 ? (
              <>
                <SectionLabel
                  style={{ marginTop: 22 }}
                  right={barCount > 0 ? <Text style={s.barCount}>Your pantry · {barCount} {barCount === 1 ? 'item' : 'items'}</Text> : undefined}
                >
                  {type ? `More ${DRINK_TYPES[segment].find(t => t.id === type)?.label.toLowerCase() ?? ''}` : filters.has('pantry') ? 'More you can make' : segment === 'cocktails' ? 'More cocktails' : 'More to try'}
                </SectionLabel>
                <View style={{ marginTop: 10, gap: 8 }}>
                  {rest.slice(0, 60).map(item => (
                    <DrinkRow key={item.recipe.id} item={item} saved={isFavorite(item.recipe.id)} onPress={() => open(item.recipe)} />
                  ))}
                </View>
                {rest.length > 30 ? <Text style={[s.hint, { marginTop: 10 }]}>Showing 30 of {rest.length}. Use the filters to narrow it down.</Text> : null}
              </>
            ) : null}

            <Text style={s.footnote}>
              {segment === 'cocktails'
                ? 'Please drink responsibly. Meals that use a splash of wine or beer in cooking stay in your meal picks.'
                : 'Drinks live here, on their own. They never show up in your meal picks or week plan.'}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function FeaturedDrink({ item, saved, onOpen, onAnother, onSave, canCycle }: {
  item: RankedDrink;
  saved: boolean;
  onOpen: () => void;
  onAnother: () => void;
  onSave: () => void;
  canCycle: boolean;
}) {
  const a11y = useAccessibility();
  const r = item.recipe;
  const total = r.prepMinutes + r.cookMinutes;
  const have = item.coverage ? item.coverage.have.length : null;
  const need = item.coverage ? item.coverage.have.length + item.coverage.missing.length : null;
  return (
    <Card style={s.featured}>
      <RecipeTile height={150} emoji={r.emoji} tone={r.containsAlcohol ? 'clay' : 'sage'}>
        <View style={s.featuredTag}><Pill label={item.status.label} tone={item.status.tone} /></View>
      </RecipeTile>
      <View style={s.featuredBody}>
        <Display size={23}>{r.name}</Display>
        <Text style={[s.featuredMeta, a11y.text(13)]}>
          {total} min · {keyIngredients(r)}
          {r.servings >= 4 ? ` · makes ${r.servings}` : ''}
        </Text>
        {item.coverage ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <View style={s.barLabelRow}>
              <Text style={s.barLabel}>{have} of {need} in your pantry</Text>
              {item.coverage.missing.length > 0 ? (
                <Text style={[s.barLabel, { color: COLORS.redText }]} numberOfLines={1}>missing: {item.coverage.missing.slice(0, 3).map(displayIngredientName).join(', ')}{item.coverage.missing.length > 3 ? '…' : ''}</Text>
              ) : (
                <Text style={[s.barLabel, { color: COLORS.green }]}>you have everything</Text>
              )}
            </View>
            <View style={s.barTrack}><View style={[s.barFill, { width: `${item.coverage.percent}%` }]} /></View>
          </View>
        ) : null}
        <View style={s.featuredActions}>
          <PrimaryButton label="Make it" icon="arrow-right" onPress={onOpen} style={{ flex: 1 }} />
          <SecondaryButton label="Another" icon="random" onPress={onAnother} disabled={!canCycle} />
          <TouchableOpacity
            onPress={onSave}
            style={s.heart}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save for later'}
          >
            <FontAwesome name={saved ? 'heart' : 'heart-o'} size={18} color={saved ? COLORS.redText : COLORS.darkNavy} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

function DrinkRow({ item, saved, onPress }: { item: RankedDrink; saved: boolean; onPress: () => void }) {
  const a11y = useAccessibility();
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${item.recipe.name}. ${item.note}`}>
      <View style={s.rowEmojiWrap}><Text style={s.rowEmoji}>{item.recipe.emoji}</Text></View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.rowName, a11y.text(15, '700')]} numberOfLines={1}>{item.recipe.name}</Text>
          {saved ? <FontAwesome name="heart" size={11} color={COLORS.redText} /> : null}
        </View>
        <Text style={[s.rowNote, a11y.text(12)]} numberOfLines={1}>{item.note}</Text>
      </View>
      <Pill label={item.status.label} tone={item.status.tone} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  lede: { fontSize: 14, lineHeight: 20, color: COLORS.textMuted, marginTop: 6 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  typeRow: { gap: 8, paddingTop: 10, paddingRight: 20 },
  error: { fontSize: 12, lineHeight: 17, color: COLORS.textMuted, marginTop: 12 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 60 },
  hint: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },

  confirmCard: { marginTop: 18, padding: 22, gap: 12 },
  confirmEmoji: { fontSize: 34 },
  confirmText: { fontSize: 14, lineHeight: 21, color: COLORS.navyMuted },
  confirmSecondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  confirmSecondaryText: { color: COLORS.navyMuted, fontSize: 14, fontWeight: '600' },

  emptyCard: { marginTop: 18, padding: 22, gap: 10 },

  featured: { marginTop: 10, borderRadius: 22 },
  featuredTag: { position: 'absolute', top: 12, right: 12 },
  featuredBody: { padding: 16, gap: 8 },
  featuredMeta: { fontSize: 13, lineHeight: 18, color: COLORS.textMuted },
  featuredActions: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  heart: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardWhite },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  barLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, flexShrink: 1 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.lightBlueBg, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.green },
  barCount: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
    borderRadius: 16, padding: 12,
  },
  rowEmojiWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.lightBlueBg, alignItems: 'center', justifyContent: 'center' },
  rowEmoji: { fontSize: 22 },
  rowName: { fontSize: 15, fontWeight: '700', color: COLORS.textDark, flexShrink: 1 },
  rowNote: { fontSize: 12, color: COLORS.textMuted },

  footnote: { fontSize: 12, lineHeight: 17, color: COLORS.textMuted, marginTop: 22, textAlign: 'center' },
});
