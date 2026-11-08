// app/settings/goals.tsx — Profile → Your goal.
//
// Optional. Pick what you're working toward, tell us your height, weight
// and how active you are, and the app works out a day's calories and
// protein, splits them across meals, and uses them to lean picks and
// suggest portions (utils/goals.ts). The numbers update live as you type,
// so you can see what each choice does before you save.
//
// Age comes from the birthday already on the account; it's never asked
// again here. Estimates, not medical advice — said plainly at the bottom.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { SettingsHeader, settingsStyles as s } from '@/components/SettingsUI';
import { PrimaryButton, SecondaryButton, SegmentedControl } from '@/components/ui';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { useAccessibility } from '@/hooks/useAccessibility';
import { ageOn } from '@/utils/age';
import { confirmAction } from '@/utils/confirm';
import {
  ACTIVITY_LABELS, GOAL_BLURBS, GOAL_LABELS, HEIGHT_RANGE_CM, WEIGHT_RANGE_KG,
  cmToFtIn, dailyTargets, ftInToCm, isCompleteGoals, kgToLb, lbToKg, mealTargets,
  type ActivityLevel, type BodyType, type GoalKind, type NutritionGoals, type UnitSystem,
} from '@/utils/goals';

const GOALS: GoalKind[] = ['lose', 'gain', 'maintain'];
const ACTIVITIES: ActivityLevel[] = ['low', 'light', 'moderate', 'high'];
const GOAL_ICONS: Record<GoalKind, React.ComponentProps<typeof FontAwesome>['name']> = { lose: 'leaf', gain: 'bolt', maintain: 'balance-scale' };

const num = (t: string): number | null => {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function GoalsScreen() {
  const { preferences } = useApp();
  // Keyed on the saved goal so the form refills if preferences arrive after mount.
  return <GoalsForm key={preferences.goals?.updatedAt ?? 'new'} />;
}

function GoalsForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();
  const { preferences, updatePreferences, birthDate } = useApp();
  const saved = preferences.goals ?? null;

  const [goal, setGoal] = useState<GoalKind>(saved?.goal ?? 'lose');
  const [units, setUnits] = useState<UnitSystem>(saved?.units ?? 'imperial');
  const [activity, setActivity] = useState<ActivityLevel>(saved?.activity ?? 'light');
  const [body, setBody] = useState<BodyType>(saved?.body ?? 'unspecified');
  const init = saved ? cmToFtIn(saved.heightCm) : null;
  const [ft, setFt] = useState(init ? String(init.ft) : '');
  const [inch, setInch] = useState(init ? String(init.in) : '');
  const [cm, setCm] = useState(saved ? String(Math.round(saved.heightCm)) : '');
  const [lb, setLb] = useState(saved ? String(kgToLb(saved.weightKg)) : '');
  const [kg, setKg] = useState(saved ? String(Math.round(saved.weightKg)) : '');

  const heightCm = units === 'metric' ? num(cm) : (num(ft) !== null ? ftInToCm(num(ft)!, num(inch) ?? 0) : null);
  const weightKg = units === 'metric' ? num(kg) : (num(lb) !== null ? lbToKg(num(lb)!) : null);

  const draft: Partial<NutritionGoals> = { goal, activity, body, units, heightCm: heightCm ?? undefined, weightKg: weightKg ?? undefined };
  const complete = isCompleteGoals(draft);
  const heightBad = heightCm !== null && (heightCm < HEIGHT_RANGE_CM.min || heightCm > HEIGHT_RANGE_CM.max);
  const weightBad = weightKg !== null && (weightKg < WEIGHT_RANGE_KG.min || weightKg > WEIGHT_RANGE_KG.max);

  const age = birthDate ? ageOn(birthDate) : 30;
  const daily = useMemo(() => (complete ? dailyTargets(draft as NutritionGoals, age) : null), [complete, goal, activity, body, heightCm, weightKg, age]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchUnits = (u: UnitSystem) => {
    if (u === units) return;
    // Carry the numbers across so nobody has to retype.
    if (u === 'metric') {
      if (heightCm !== null) setCm(String(Math.round(heightCm)));
      if (weightKg !== null) setKg(String(Math.round(weightKg)));
    } else {
      if (heightCm !== null) { const f = cmToFtIn(heightCm); setFt(String(f.ft)); setInch(String(f.in)); }
      if (weightKg !== null) setLb(String(kgToLb(weightKg)));
    }
    setUnits(u);
  };

  const save = () => {
    if (!complete) return;
    a11y.haptic('success');
    updatePreferences({ goals: { ...(draft as NutritionGoals), updatedAt: Date.now() } });
    router.back();
  };

  const turnOff = () =>
    confirmAction({
      title: 'Turn off your goal?',
      message: 'Picks and portions go back to normal. Your height and weight are removed.',
      confirmLabel: 'Turn off',
      destructive: true,
      onConfirm: () => {
        updatePreferences({ goals: null });
        router.back();
      },
    });

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <SettingsHeader title="Your goal" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <Text style={st.intro}>
          Tell BiteWise what you’re working toward. Meal picks and portion tips will lean that way — everything else stays the same.
        </Text>

        {/* WHAT */}
        <Text style={st.label}>What are you after?</Text>
        <View style={{ gap: 8 }}>
          {GOALS.map(g => {
            const on = g === goal;
            return (
              <TouchableOpacity
                key={g}
                style={[st.option, on && st.optionOn]}
                onPress={() => setGoal(g)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
              >
                <View style={[st.optionIcon, on && st.optionIconOn]}>
                  <FontAwesome name={GOAL_ICONS[g]} size={15} color={on ? COLORS.darkNavy : COLORS.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.optionTitle, on && st.optionTitleOn]}>{GOAL_LABELS[g]}</Text>
                  <Text style={[st.optionBlurb, on && st.optionBlurbOn]}>{GOAL_BLURBS[g]}</Text>
                </View>
                <FontAwesome name={on ? 'check-circle' : 'circle-o'} size={20} color={on ? COLORS.goldYellow : COLORS.borderLight} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ABOUT YOU */}
        <View style={st.labelRow}>
          <Text style={st.label}>About you</Text>
          <SegmentedControl<UnitSystem>
            value={units}
            onChange={switchUnits}
            options={[{ key: 'imperial', label: 'ft · lb' }, { key: 'metric', label: 'cm · kg' }]}
            style={st.unitSwitch}
          />
        </View>
        <View style={st.card}>
          <View style={st.fieldRow}>
            <Text style={st.fieldLabel}>Height</Text>
            {units === 'metric' ? (
              <Field value={cm} onChange={setCm} suffix="cm" width={96} bad={heightBad} label="Height in centimetres" />
            ) : (
              <View style={st.pair}>
                <Field value={ft} onChange={setFt} suffix="ft" width={74} bad={heightBad} label="Height, feet" />
                <Field value={inch} onChange={setInch} suffix="in" width={74} bad={heightBad} label="Height, inches" />
              </View>
            )}
          </View>
          <View style={st.divider} />
          <View style={st.fieldRow}>
            <Text style={st.fieldLabel}>Weight</Text>
            {units === 'metric' ? (
              <Field value={kg} onChange={setKg} suffix="kg" width={96} bad={weightBad} label="Weight in kilograms" />
            ) : (
              <Field value={lb} onChange={setLb} suffix="lb" width={96} bad={weightBad} label="Weight in pounds" />
            )}
          </View>
          {heightBad || weightBad ? (
            <Text style={st.bad}>{heightBad ? 'That height doesn’t look right.' : ''} {weightBad ? 'That weight doesn’t look right.' : ''}</Text>
          ) : null}

          <View style={st.divider} />
          <Text style={st.fieldLabel}>How active are you, most weeks?</Text>
          <View style={{ gap: 6, marginTop: 8 }}>
            {ACTIVITIES.map(a => {
              const on = a === activity;
              return (
                <TouchableOpacity key={a} style={[st.activity, on && st.activityOn]} onPress={() => setActivity(a)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                  <FontAwesome name={on ? 'dot-circle-o' : 'circle-o'} size={16} color={on ? COLORS.darkNavy : COLORS.inactiveGray} />
                  <Text style={st.activityText}>
                    <Text style={st.activityTitle}>{ACTIVITY_LABELS[a].label}</Text>
                    <Text style={st.activityHint}>  {ACTIVITY_LABELS[a].hint}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={st.divider} />
          <Text style={st.fieldLabel}>For the energy estimate</Text>
          <View style={st.chips}>
            {([['female', 'Female'], ['male', 'Male'], ['unspecified', 'Prefer not to say']] as [BodyType, string][]).map(([k, l]) => (
              <TouchableOpacity key={k} style={[st.chip, body === k && st.chipOn]} onPress={() => setBody(k)} accessibilityRole="radio" accessibilityState={{ checked: body === k }}>
                <Text style={[st.chipText, body === k && st.chipTextOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={st.hint}>Only used in the resting-energy formula. “Prefer not to say” uses the midpoint.</Text>
        </View>

        {/* YOUR DAY — live */}
        <Text style={st.label}>Your day</Text>
        <View style={st.day}>
          {daily ? (
            <>
              <View style={st.dayTop}>
                <View style={{ flex: 1 }}>
                  <Text style={st.dayBig}>~{daily.calories.toLocaleString('en-US')}</Text>
                  <Text style={st.dayUnit}>calories a day</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.dayBig}>{daily.protein} g</Text>
                  <Text style={st.dayUnit}>protein a day</Text>
                </View>
              </View>
              <View style={st.mealRows}>
                {(['breakfast', 'lunch', 'dinner'] as const).map(m => {
                  const t = mealTargets(daily, m);
                  return (
                    <View key={m} style={st.mealRow}>
                      <Text style={st.mealName}>{m[0].toUpperCase() + m.slice(1)}</Text>
                      <Text style={st.mealNums}>~{t.calories} cal · {t.protein} g protein</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={st.dayNote}>
                {goal === 'lose' && daily.floored
                  ? 'Kept at a safe minimum rather than lower — losing weight slower and steadily works better.'
                  : goal === 'lose'
                    ? 'About 500 calories under what you burn: roughly a pound a week, with protein kept high so you stay full.'
                    : goal === 'gain'
                      ? 'A modest surplus and plenty of protein — enough to build on without piling on.'
                      : 'About what you burn in a day, so meals keep you where you are.'}
              </Text>
            </>
          ) : (
            <Text style={st.dayEmpty}>Add your height and weight to see your numbers.</Text>
          )}
        </View>

        <PrimaryButton label={saved ? 'Save changes' : 'Set my goal'} icon="check" onPress={save} disabled={!complete} style={{ marginTop: 16 }} />
        {saved ? <SecondaryButton label="Turn off my goal" onPress={turnOff} style={{ marginTop: 10 }} /> : null}

        <Text style={st.fine}>
          These are estimates for planning meals (Mifflin-St Jeor, with a standard activity multiplier), not medical advice. If a doctor or dietitian has given you targets, follow theirs. Your height and weight stay with your account and are never shown to other people.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ value, onChange, suffix, width, bad, label }: { value: string; onChange: (t: string) => void; suffix: string; width: number; bad: boolean; label: string }) {
  return (
    <View style={[st.field, { width }, bad && st.fieldBad]}>
      <TextInput
        style={st.fieldInput}
        value={value}
        onChangeText={t => onChange(t.replace(/[^0-9.,]/g, ''))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        maxLength={5}
        placeholder="–"
        placeholderTextColor={COLORS.inactiveGray}
        accessibilityLabel={label}
      />
      <Text style={st.fieldSuffix}>{suffix}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 20, color: COLORS.textMuted, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  unitSwitch: { width: 150, marginBottom: 6 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  optionOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  optionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  optionIconOn: { backgroundColor: COLORS.goldYellow },
  optionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkNavy },
  optionTitleOn: { color: COLORS.cardWhite },
  optionBlurb: { fontSize: 12.5, lineHeight: 17, color: COLORS.textMuted, marginTop: 2 },
  optionBlurbOn: { color: COLORS.navyMuted },

  card: { backgroundColor: COLORS.cardWhite, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderLight, padding: 14 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textDark },
  pair: { flexDirection: 'row', gap: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background, paddingHorizontal: 10, gap: 6,
  },
  fieldBad: { borderColor: COLORS.redAccent },
  fieldInput: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.darkNavy, textAlign: 'right', paddingVertical: 0 },
  fieldSuffix: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  bad: { fontSize: 12, color: COLORS.redText, marginTop: 8 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 12 },

  activity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  activityOn: { backgroundColor: COLORS.lightBlueBg, borderColor: COLORS.blueSoft },
  activityText: { flex: 1, fontSize: 14, lineHeight: 19 },
  activityTitle: { fontWeight: '700', color: COLORS.darkNavy },
  activityHint: { color: COLORS.textMuted },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.borderLight },
  chipOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  chipTextOn: { color: COLORS.cardWhite },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, lineHeight: 17 },

  day: { backgroundColor: COLORS.darkNavy, borderRadius: 20, padding: 16 },
  dayTop: { flexDirection: 'row', gap: 12 },
  dayBig: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 30, color: COLORS.cardWhite, lineHeight: 34 },
  dayUnit: { fontSize: 12, fontWeight: '600', color: COLORS.navyMuted },
  mealRows: { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  mealRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  mealName: { fontSize: 14, fontWeight: '700', color: COLORS.cardWhite },
  mealNums: { fontSize: 14, color: COLORS.navyMuted },
  dayNote: { fontSize: 12.5, lineHeight: 18, color: COLORS.navyMuted, marginTop: 12 },
  dayEmpty: { fontSize: 14, color: COLORS.navyMuted, textAlign: 'center', paddingVertical: 10 },

  fine: { fontSize: 12, lineHeight: 17, color: COLORS.textMuted, marginTop: 18, textAlign: 'center' },
});
