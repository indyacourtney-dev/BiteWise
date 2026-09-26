// components/BirthdayForm.tsx — asks for the birthday once, then locks it.
//
// Used as the first onboarding step and by app/ageCheck.tsx (accounts made
// before this existed). Flow: warning, month / day / year, a "Is this
// right?" check, then saved and shown as locked. Saving goes through
// AppContext.setBirthDate, which also stores it on the account where the
// database refuses changes.

import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { LEGAL_DRINKING_AGE, ageOn, formatBirthDate, parseBirthDate } from '../utils/age';

export default function BirthdayForm() {
  const { birthDate, setBirthDate } = useApp();
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null); // waiting for "Yes, save it"
  const [saving, setSaving] = useState(false);
  const dayRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  // ----- Already saved: locked -----
  if (birthDate) {
    const age = ageOn(birthDate);
    const adult = age >= LEGAL_DRINKING_AGE;
    return (
      <View style={styles.lockedCard} accessibilityLiveRegion="polite">
        <View style={styles.lockedRow}>
          <FontAwesome name="lock" size={18} color={COLORS.darkNavy} />
          <View style={styles.flex1}>
            <Text style={styles.lockedTitle}>Birthday saved</Text>
            <Text style={styles.lockedDate}>{formatBirthDate(birthDate)}</Text>
          </View>
        </View>
        <Text style={styles.lockedNote}>
          {adult
            ? "You're 21 or older, so recipes made with alcohol are included."
            : `Recipes made with alcohol are hidden until you turn ${LEGAL_DRINKING_AGE}. Everything else works as usual.`}
        </Text>
      </View>
    );
  }

  const check = () => {
    const result = parseBirthDate(month, day, year);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setPending(result.iso);
  };

  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    const res = await setBirthDate(pending);
    setSaving(false);
    if (!res.ok) setError(res.error ?? 'Could not save your birthday.');
    setPending(null);
  };

  const digits = (v: string) => v.replace(/[^0-9]/g, '');

  return (
    <View>
      <View style={styles.warning} accessibilityRole="alert">
        <FontAwesome name="exclamation-triangle" size={18} color={COLORS.darkGold} style={styles.warnIcon} />
        <View style={styles.flex1}>
          <Text style={styles.warnTitle}>Why we ask</Text>
          <Text style={styles.warnText}>
            Some recipes are made with alcohol, like wine, beer or spirits. BiteWise only shows them to people{' '}
            {LEGAL_DRINKING_AGE} or older.
          </Text>
          <Text style={[styles.warnText, styles.warnStrong]}>
            Your birthday can't be changed after you save it, so make sure it's right.
          </Text>
        </View>
      </View>

      {pending ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Is this right?</Text>
          <Text style={styles.confirmDate}>{formatBirthDate(pending)}</Text>
          <Text style={styles.confirmSub}>
            That makes you {ageOn(pending)}. You won't be able to change it later.
          </Text>
          <View style={styles.confirmRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setPending(null)}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Change it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.disabled]}
              onPress={confirm}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{saving ? 'Saving' : 'Yes, save it'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Your birthday</Text>
          <View style={styles.fields}>
            <Field
              label="Month"
              placeholder="MM"
              value={month}
              maxLength={2}
              onChangeText={v => {
                const next = digits(v);
                setMonth(next);
                if (next.length === 2 || (next.length === 1 && Number(next) > 1)) dayRef.current?.focus();
              }}
            />
            <Field
              ref={dayRef}
              label="Day"
              placeholder="DD"
              value={day}
              maxLength={2}
              onChangeText={v => {
                const next = digits(v);
                setDay(next);
                if (next.length === 2 || (next.length === 1 && Number(next) > 3)) yearRef.current?.focus();
              }}
            />
            <Field
              ref={yearRef}
              label="Year"
              placeholder="YYYY"
              value={year}
              maxLength={4}
              wide
              onChangeText={v => setYear(digits(v))}
              onSubmitEditing={check}
            />
          </View>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryBtn, styles.saveBtn, !(month && day && year.length === 4) && styles.disabled]}
            onPress={check}
            disabled={!(month && day && year.length === 4)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Save my birthday</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const Field = React.forwardRef<
  TextInput,
  {
    label: string;
    placeholder: string;
    value: string;
    maxLength: number;
    wide?: boolean;
    onChangeText: (v: string) => void;
    onSubmitEditing?: () => void;
  }
>(({ label, placeholder, value, maxLength, wide, onChangeText, onSubmitEditing }, ref) => (
  <View style={[styles.field, wide && styles.fieldWide]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      ref={ref}
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.inactiveGray}
      keyboardType="number-pad"
      maxLength={maxLength}
      returnKeyType={onSubmitEditing ? 'done' : 'next'}
      onSubmitEditing={onSubmitEditing}
      accessibilityLabel={`Birthday ${label.toLowerCase()}`}
      textContentType="none"
      autoComplete={label === 'Month' ? 'birthdate-month' : label === 'Day' ? 'birthdate-day' : 'birthdate-year'}
    />
  </View>
));
Field.displayName = 'Field';

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  warning: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.lightYellow,
    borderWidth: 1,
    borderColor: '#EDE28A',
    borderRadius: 18,
    padding: 16,
  },
  warnIcon: { marginTop: 2 },
  warnTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkNavy, marginBottom: 4 },
  warnText: { fontSize: 14, color: COLORS.textDark, lineHeight: 20 },
  warnStrong: { fontWeight: '700', marginTop: 8 },

  label: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy, marginTop: 22, marginBottom: 10 },
  fields: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  fieldWide: { flex: 1.5 },
  fieldLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkNavy,
    textAlign: 'center',
  },
  error: { color: COLORS.redAccent, fontSize: 14, fontWeight: '600', marginTop: 10 },

  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 15,
  },
  saveBtn: { marginTop: 18, flex: 0 },
  primaryText: { color: COLORS.cardWhite, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
  },
  secondaryText: { color: COLORS.darkNavy, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.4 },

  confirmCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 18,
    marginTop: 18,
  },
  confirmTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },
  confirmDate: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 26, color: COLORS.darkNavy, marginTop: 4 },
  confirmSub: { fontSize: 14, color: COLORS.textDark, marginTop: 6, lineHeight: 20 },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 16 },

  lockedCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 18,
  },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  lockedTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  lockedDate: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: COLORS.darkNavy, marginTop: 2 },
  lockedNote: { fontSize: 14, color: COLORS.textDark, marginTop: 12, lineHeight: 20 },
});
