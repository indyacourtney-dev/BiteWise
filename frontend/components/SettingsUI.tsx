// components/SettingsUI.tsx
//
// Building blocks shared by the Profile & settings screens so they look and
// behave the same, with screen-reader labels built in.

import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '../constants/Colors';

export function SettingsHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.side}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <FontAwesome name="chevron-left" size={16} color={COLORS.darkNavy} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

export function SettingsSection({ title, footer, children }: {
  title?: string; footer?: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionWrap}>
      {title ? <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text> : null}
      <View style={styles.section}>{children}</View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

/** A tappable row: icon, label, optional value on the right, chevron. */
export function SettingsRow({ icon, label, value, onPress, danger = false, last = false }: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>
        <FontAwesome name={icon} size={15} color={danger ? COLORS.redAccent : COLORS.darkNavy} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
      {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      {!danger ? <FontAwesome name="chevron-right" size={12} color={COLORS.inactiveGray} /> : null}
    </TouchableOpacity>
  );
}

/** A row with an on/off switch. */
export function SettingsToggle({ label, hint, value, onChange, last = false }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.flex1}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: COLORS.darkNavy, false: COLORS.borderLight }}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** A choice between a few options, shown as chips. */
export function SettingsChoice<T extends string | number>({ label, hint, options, value, onChange, last = false }: {
  label: string;
  hint?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.choice, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map(o => {
          const on = o.value === value;
          return (
            <TouchableOpacity
              key={String(o.value)}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label}: ${o.label}`}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  button: {
    backgroundColor: COLORS.goldYellow,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  dangerButton: { backgroundColor: COLORS.redAccent },
  dangerButtonText: { color: COLORS.cardWhite },
  message: { fontSize: 13, lineHeight: 19, color: COLORS.textMuted },
  success: { fontSize: 13, lineHeight: 19, color: '#1E7B4F', fontWeight: '600' },
  error: { fontSize: 13, lineHeight: 19, color: COLORS.redAccent, fontWeight: '600' },
  padded: { padding: 14, gap: 10 },
});

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  side: { minWidth: 64, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.darkNavy },
  sectionWrap: { marginTop: 18 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginLeft: 4,
  },
  section: { backgroundColor: COLORS.cardWhite, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden' },
  footer: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, marginTop: 8, marginHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, minHeight: 52 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  iconBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.lightYellow, alignItems: 'center', justifyContent: 'center' },
  iconBoxDanger: { backgroundColor: '#FDECEA' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textDark },
  rowValue: { maxWidth: '45%', fontSize: 14, color: COLORS.textMuted },
  danger: { color: COLORS.redAccent },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, lineHeight: 17 },
  choice: { paddingHorizontal: 14, paddingVertical: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.borderLight, minHeight: 36, justifyContent: 'center',
  },
  chipOn: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  chipTextOn: { color: COLORS.cardWhite },
});
