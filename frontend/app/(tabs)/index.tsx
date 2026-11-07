// app/(tabs)/index.tsx — HOME, answer first.
//
// The app's promise is to take the decision off your plate, so Home opens
// on an answer: one pick for the current meal, with the reasons it was
// chosen and how much of it is already in your pantry. "Cook this" goes to
// the recipe; "Swap" shows the next best. The other ways to decide (This or
// That, your pantry), the Drinks section and a running-low nudge sit below.
//
// The pick comes from the same engine as Pick for me (hooks/useDecision.ts)
// with the craving set to "anything". Opening the app does NOT count as
// "showing" the pick for variety purposes; only Swap and Cook do, so the
// suggestion stays put through the day.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { DIFFICULTY_LABELS, formatTime, getTotalTime } from '@/constants/recipes';
import { getRecipeImage, hasRecipePhoto } from '@/constants/recipeImages';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useDecision } from '@/hooks/useDecision';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useMyProfile } from '@/hooks/useMyProfile';
import Avatar from '@/components/Avatar';
import { Card, Chip, Display, Pill, PrimaryButton, RecipeTile, SecondaryButton, ui } from '@/components/ui';
import { MEAL_INFO, MEAL_TYPES, QUIZ_MEAL_TYPES } from '@/utils/meals';
import { stockStatus } from '@/utils/pantryStatus';
import type { MealType } from '@/types';

function greetingFor(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const PICK_LABEL: Record<MealType, string> = {
  breakfast: 'This morning’s pick',
  brunch: 'Brunch pick',
  lunch: 'Lunch pick',
  dinner: 'Tonight’s pick',
  dessert: 'Dessert pick',
};

export default function Home() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const a11y = useAccessibility();
  const { user } = useAuth();
  const { profile: myProfile } = useMyProfile();
  const { preferences, mealType, setMealType, pantry, grocery } = useApp();

  const userName = preferences.name?.trim() || user?.user_metadata?.username || 'there';
  const initials = userName.slice(0, 2).toUpperCase();
  const dayName = new Date().toLocaleDateString(undefined, { weekday: 'long' });

  const decision = useDecision({ mealType, craving: 'anything', noteShown: false });
  const pick = decision.pick;

  const cook = () => {
    if (!pick) return;
    a11y.haptic('success');
    const recipe = decision.lockIn(pick);
    if (recipe) router.push(`/recipe/${recipe.id}`);
  };

  // Running-low nudge: pantry items low/out that aren't on the list yet.
  const nudge = useMemo(() => {
    const listed = new Set(grocery.map(g => g.name.toLowerCase()));
    const low = pantry.filter(i => stockStatus(i) !== 'ok' && !listed.has(i.name.toLowerCase()));
    const toBuy = grocery.filter(g => !g.checked).length;
    if (low.length === 0 && toBuy === 0) return null;
    const names = low.slice(0, 2).map(i => i.name.toLowerCase());
    const more = low.length - names.length;
    const inPick = pick ? low.filter(i => pick.recipe.ingredients.some(ing => ing.name.toLowerCase().includes(i.name.toLowerCase()))).length : 0;
    return {
      title: low.length > 0
        ? `Low on ${names.join(names.length === 2 && more === 0 ? ' and ' : ', ')}${more > 0 ? ` and ${more} more` : ''}`
        : `${toBuy} item${toBuy === 1 ? '' : 's'} on your grocery list`,
      sub: inPick > 0 ? `${inPick === 1 ? 'One is' : `${inPick} are`} in your pick` : low.length > 0 ? 'Add them to your grocery list' : 'Open your grocery list',
      cta: low.length > 0 ? 'Add to list' : 'Open',
      warn: low.length > 0,
    };
  }, [pantry, grocery, pick]);

  const quizMeal = QUIZ_MEAL_TYPES.includes(mealType);

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={[ui.pad, s.header]}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>{dayName} · {MEAL_INFO[mealType].label}</Text>
            <Display size={26}>{greetingFor()}, {userName}</Display>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/profile')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Profile and settings"
            style={s.avatarBtn}
          >
            {myProfile?.avatarUrl ? (
              <Avatar url={myProfile.avatarUrl} size={44} label="Profile and settings" />
            ) : (
              <Text style={s.avatarText}>{initials}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* MEAL SWITCH */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[ui.pad, s.mealRow]}>
          {MEAL_TYPES.map(m => (
            <Chip key={m} label={MEAL_INFO[m].label} small selected={m === mealType} onPress={() => setMealType(m)} />
          ))}
        </ScrollView>

        {/* THE PICK */}
        <View style={ui.pad}>
          {decision.loading && !pick ? (
            <Card style={s.pickCard}>
              <RecipeTile height={150} />
              <View style={[s.pickBody, { alignItems: 'center', paddingVertical: 28 }]}>
                <ActivityIndicator color={COLORS.darkNavy} />
                <Text style={s.hint}>Finding your {MEAL_INFO[mealType].label.toLowerCase()}…</Text>
              </View>
            </Card>
          ) : !pick ? (
            <Card style={s.pickCard}>
              <View style={[s.pickBody, { gap: 10 }]}>
                <Display size={20}>Nothing fits every rule</Display>
                <Text style={s.hint}>
                  Your allergies and diets rule out everything we have for {MEAL_INFO[mealType].label.toLowerCase()} right now.
                  Try another meal, or loosen a preference.
                </Text>
                <SecondaryButton label="Check preferences" onPress={() => router.push('/settings/preferences')} />
              </View>
            </Card>
          ) : (
            <Card style={s.pickCard}>
              <View>
                {hasRecipePhoto(pick.recipe) ? (
                  <Image source={getRecipeImage(pick.recipe)} style={s.pickImage} accessibilityIgnoresInvertColors />
                ) : (
                  <RecipeTile height={150} emoji={pick.recipe.emoji} />
                )}
                <View style={s.pickTagLeft}><Pill label={PICK_LABEL[mealType]} tone="navy" /></View>
                {pick.pantryPercent !== null && pantry.length > 0 ? (
                  <View style={s.pickTagRight}><Pill label={`${pick.pantryPercent}% in pantry`} tone="yellow" /></View>
                ) : null}
              </View>
              <View style={s.pickBody}>
                <Display size={22}>{pick.recipe.name}</Display>
                <View style={s.metaRow}>
                  <Meta icon="clock-o" text={formatTime(getTotalTime(pick.recipe))} />
                  <Meta icon="signal" text={DIFFICULTY_LABELS[pick.recipe.difficulty]} />
                  <Meta icon="users" text={`Serves ${pick.recipe.servings}`} />
                </View>
                {pick.reasons.length > 0 ? (
                  <View style={s.reasons}>
                    {pick.reasons.slice(0, 3).map(r => (
                      <View key={r} style={s.reasonRow}>
                        <FontAwesome name="check-circle-o" size={17} color={COLORS.green} />
                        <Text style={[s.reasonText, a11y.text(14)]}>{r}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={s.actions}>
                  <PrimaryButton label="Cook this" icon="arrow-right" onPress={cook} style={{ flex: 1, minHeight: 48 }} />
                  <SecondaryButton label="Swap" icon="random" onPress={decision.skip} style={{ minHeight: 48 }} />
                </View>
              </View>
            </Card>
          )}
        </View>

        {/* OTHER WAYS TO DECIDE */}
        <View style={[ui.pad, s.waysRow]}>
          {quizMeal ? (
            <WayCard
              title="This or That"
              sub="Can’t name it? Tap to find it"
              icon="th-large"
              tone="yellow"
              onPress={() => router.push('/thisorthat')}
            />
          ) : (
            <WayCard
              title="Pick for me"
              sub="Tell us your mood, get one pick"
              icon="magic"
              tone="yellow"
              onPress={() => router.push('/decide')}
            />
          )}
          <WayCard
            title="From my pantry"
            sub="Use what you have"
            icon="cutlery"
            tone="white"
            onPress={() => router.push('/cookWithPantry')}
          />
        </View>

        {/* DRINKS — its own section, never mixed into meal picks */}
        <TouchableOpacity
          style={[ui.pad, { marginTop: 10 }]}
          onPress={() => router.push('/drinks')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Drinks: mocktails, smoothies, and cocktails for 21 and over"
        >
          <View style={s.drinksRow}>
            <FontAwesome name="glass" size={20} color={COLORS.goldYellow} />
            <View style={{ flex: 1 }}>
              <Text style={s.drinksTitle}>Drinks</Text>
              <Text style={s.drinksSub}>Mocktails, smoothies — and cocktails for 21+</Text>
            </View>
            <Pill label="21+" tone="yellow" />
            <FontAwesome name="chevron-right" size={13} color={COLORS.navyMuted} />
          </View>
        </TouchableOpacity>

        {/* KITCHEN NUDGE */}
        {nudge ? (
          <TouchableOpacity
            style={[ui.pad, { marginTop: 10 }]}
            onPress={() => router.push('/kitchen?tab=grocery')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${nudge.title}. ${nudge.cta}`}
          >
            <View style={[s.nudge, nudge.warn ? s.nudgeWarn : null]}>
              <FontAwesome name={nudge.warn ? 'exclamation-triangle' : 'shopping-cart'} size={18} color={nudge.warn ? COLORS.textGold : COLORS.darkNavy} />
              <View style={{ flex: 1 }}>
                <Text style={s.nudgeTitle} numberOfLines={2}>{nudge.title}</Text>
                <Text style={s.nudgeSub}>{nudge.sub}</Text>
              </View>
              <View style={s.nudgeCta}><Text style={s.nudgeCtaText}>{nudge.cta}</Text></View>
            </View>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof FontAwesome>['name']; text: string }) {
  return (
    <View style={s.meta}>
      <FontAwesome name={icon} size={13} color={COLORS.textMuted} />
      <Text style={s.metaText}>{text}</Text>
    </View>
  );
}

function WayCard({ title, sub, icon, tone, onPress }: {
  title: string; sub: string; icon: React.ComponentProps<typeof FontAwesome>['name']; tone: 'yellow' | 'white'; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.way, tone === 'yellow' ? s.wayYellow : s.wayWhite]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
    >
      <FontAwesome name={icon} size={22} color={COLORS.darkNavy} />
      <View style={{ flex: 1 }}>
        <Text style={s.wayTitle}>{title}</Text>
        <Text style={[s.waySub, tone === 'yellow' && { color: '#4A4A2A' }]}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6 },
  kicker: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 2 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.darkNavy,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarText: { color: COLORS.goldYellow, fontWeight: '800', fontSize: 15 },

  mealRow: { gap: 8, paddingTop: 16, paddingBottom: 2 },

  pickCard: { marginTop: 16, borderRadius: 22 },
  pickImage: { width: '100%', height: 150, backgroundColor: COLORS.tileSand },
  pickTagLeft: { position: 'absolute', top: 12, left: 12 },
  pickTagRight: { position: 'absolute', top: 12, right: 12 },
  pickBody: { padding: 18, gap: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  reasons: { gap: 7 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  reasonText: { flex: 1, fontSize: 14, color: COLORS.textDark },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  hint: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, textAlign: 'center' },

  waysRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  way: { flex: 1, minHeight: 76, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  wayYellow: { backgroundColor: COLORS.goldYellow },
  wayWhite: { backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight },
  wayTitle: { fontSize: 14, fontWeight: '800', color: COLORS.darkNavy },
  waySub: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted, marginTop: 1 },

  drinksRow: {
    minHeight: 56, borderRadius: 16, backgroundColor: COLORS.darkNavy,
    paddingVertical: 10, paddingLeft: 14, paddingRight: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  drinksTitle: { fontSize: 14, fontWeight: '700', color: COLORS.cardWhite },
  drinksSub: { fontSize: 12, color: COLORS.navyMuted, marginTop: 1 },

  nudge: {
    minHeight: 56, borderRadius: 16, backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
    paddingVertical: 10, paddingLeft: 14, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  nudgeWarn: { backgroundColor: COLORS.lightYellow, borderColor: COLORS.yellowBorder },
  nudgeTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  nudgeSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  nudgeCta: { height: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: COLORS.darkNavy, alignItems: 'center', justifyContent: 'center' },
  nudgeCtaText: { color: COLORS.cardWhite, fontSize: 13, fontWeight: '700' },
});
