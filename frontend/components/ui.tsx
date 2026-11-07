// components/ui.tsx
//
// The small set of building blocks the redesigned screens share, so chips,
// buttons, section labels and headers look and behave the same everywhere
// (and screen-reader roles come for free). Keep these dumb: layout and
// styling only, no app state.

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '../constants/Colors';

type IconName = React.ComponentProps<typeof FontAwesome>['name'];

// ============================================
// TEXT
// ============================================

/** Serif display heading (Playfair), the voice of the redesign. */
export function Display({ children, size = 26, style }: { children: React.ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: size, lineHeight: Math.round(size * 1.22), color: COLORS.darkNavy }, style]}>
      {children}
    </Text>
  );
}

/** Small uppercase label above a group ("RUNNING LOW · 3"). */
export function SectionLabel({ children, tone = 'muted', right, style }: {
  children: React.ReactNode;
  tone?: 'muted' | 'gold' | 'red' | 'green' | 'navy';
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const color = { muted: COLORS.textMuted, gold: COLORS.textGold, red: COLORS.redText, green: COLORS.green, navy: COLORS.darkNavy }[tone];
  return (
    <View style={[ui.sectionLabelRow, style]}>
      <Text style={[ui.sectionLabel, { color }]} accessibilityRole="header">{children}</Text>
      {right}
    </View>
  );
}

// ============================================
// CHIPS & PILLS
// ============================================

/** A selectable chip (meal, craving, filter, allergen...). */
export function Chip({ label, selected = false, onPress, tone = 'navy', icon, small = false, style }: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Color when selected. */
  tone?: 'navy' | 'red' | 'gold';
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const on = { navy: COLORS.darkNavy, red: COLORS.redText, gold: COLORS.goldYellow }[tone];
  const onText = tone === 'gold' ? COLORS.darkNavy : COLORS.cardWhite;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        ui.chip,
        small && ui.chipSmall,
        selected && { backgroundColor: on, borderColor: on },
        style,
      ]}
    >
      {icon ? <FontAwesome name={icon} size={small ? 11 : 13} color={selected ? onText : COLORS.darkNavy} /> : null}
      <Text style={[ui.chipText, small && ui.chipTextSmall, selected && { color: onText, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** A non-interactive status pill ("Ready", "missing", "21+"). */
export function Pill({ label, tone = 'navy', icon, style }: {
  label: string;
  tone?: 'navy' | 'yellow' | 'green' | 'red' | 'gold' | 'blue';
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const t = {
    navy: { bg: COLORS.darkNavy, fg: COLORS.cardWhite },
    yellow: { bg: COLORS.goldYellow, fg: COLORS.darkNavy },
    green: { bg: COLORS.greenSoft, fg: COLORS.green },
    red: { bg: COLORS.redSoft, fg: COLORS.redText },
    gold: { bg: COLORS.lightYellow, fg: COLORS.textGold },
    blue: { bg: '#F1F6FD', fg: COLORS.darkNavy },
  }[tone];
  return (
    <View style={[ui.pill, { backgroundColor: t.bg }, style]}>
      {icon ? <FontAwesome name={icon} size={11} color={t.fg} /> : null}
      <Text style={[ui.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

// ============================================
// BUTTONS
// ============================================

export function PrimaryButton({ label, onPress, icon, tone = 'navy', busy = false, disabled = false, style }: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  tone?: 'navy' | 'yellow';
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'yellow' ? COLORS.goldYellow : COLORS.darkNavy;
  const fg = tone === 'yellow' ? COLORS.darkNavy : COLORS.cardWhite;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={[ui.primary, { backgroundColor: bg }, (disabled || busy) && ui.disabled, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          <Text style={[ui.primaryText, { color: fg }]}>{label}</Text>
          {icon ? <FontAwesome name={icon} size={15} color={fg} /> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, icon, disabled = false, style, compact = false }: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={[ui.secondary, compact && ui.secondaryCompact, disabled && ui.disabled, style]}
    >
      {icon ? <FontAwesome name={icon} size={14} color={COLORS.darkNavy} /> : null}
      <Text style={[ui.secondaryText, compact && { fontSize: 13 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** A 44px round icon button (header actions). */
export function IconButton({ icon, onPress, label, tone = 'light', style }: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: 'light' | 'dark' | 'plain';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'dark' ? 'rgba(255,255,255,0.12)' : tone === 'light' ? COLORS.cardWhite : 'transparent';
  const fg = tone === 'dark' ? COLORS.cardWhite : COLORS.darkNavy;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[ui.iconBtn, { backgroundColor: bg }, tone === 'light' && ui.iconBtnBorder, style]}
    >
      <FontAwesome name={icon} size={17} color={fg} />
    </TouchableOpacity>
  );
}

// ============================================
// LAYOUT
// ============================================

export function Card({ children, style, tone = 'white' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'white' | 'yellow' | 'navy' }) {
  const t = {
    white: { backgroundColor: COLORS.cardWhite, borderColor: COLORS.borderLight },
    yellow: { backgroundColor: COLORS.lightYellow, borderColor: COLORS.yellowBorder },
    navy: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy },
  }[tone];
  return <View style={[ui.card, t, style]}>{children}</View>;
}

/** Two or three mutually exclusive views (Pantry | Grocery). */
export function SegmentedControl<T extends string>({ options, value, onChange, style }: {
  options: { key: T; label: string; badge?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[ui.segmented, style]} accessibilityRole="tablist">
      {options.map(o => {
        const on = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[ui.segment, on && ui.segmentOn]}
          >
            <Text style={[ui.segmentText, on && ui.segmentTextOn]}>{o.label}</Text>
            {o.badge ? <View style={ui.segmentBadge} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Header for a pushed screen: back, centered title (+ optional kicker), right slot. */
export function ScreenHeader({ title, kicker, right, onBack, dark = false, closeIcon = false }: {
  title?: string;
  kicker?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  dark?: boolean;
  closeIcon?: boolean;
}) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const fg = dark ? COLORS.cardWhite : COLORS.darkNavy;
  return (
    <View style={ui.header}>
      <IconButton icon={closeIcon ? 'times' : 'chevron-left'} onPress={back} label={closeIcon ? 'Close' : 'Go back'} tone={dark ? 'dark' : 'plain'} />
      <View style={ui.headerMid}>
        {kicker ? <Text style={[ui.headerKicker, dark && { color: COLORS.goldYellow }]}>{kicker}</Text> : null}
        {title ? <Text style={[ui.headerTitle, { color: dark ? COLORS.navyMuted : COLORS.textMuted }, !kicker && { color: fg, fontSize: 16, fontWeight: '700' }]} numberOfLines={1}>{title}</Text> : null}
      </View>
      <View style={ui.headerRight}>{right ?? null}</View>
    </View>
  );
}

/** Flat warm tile shown where a recipe has no photo. */
export function RecipeTile({ emoji, height = 150, tone = 'sand', radius = 0, children }: {
  emoji?: string;
  height?: number;
  tone?: 'sand' | 'clay' | 'sage';
  radius?: number;
  children?: React.ReactNode;
}) {
  const bg = { sand: COLORS.tileSand, clay: COLORS.tileClay, sage: COLORS.tileSage }[tone];
  return (
    <View style={{ height, backgroundColor: bg, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}>
      {emoji ? <Text style={{ fontSize: Math.min(64, height * 0.4) }}>{emoji}</Text> : null}
      {children}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

export const ui = StyleSheet.create({
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 40, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: COLORS.cardWhite, borderWidth: 1.5, borderColor: COLORS.borderLight,
  },
  chipSmall: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  chipTextSmall: { fontSize: 13 },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 9, borderRadius: 13, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800' },

  primary: {
    minHeight: 52, borderRadius: 16, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryText: { fontSize: 16, fontWeight: '700' },
  secondary: {
    minHeight: 46, borderRadius: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: COLORS.cardWhite, borderWidth: 1.5, borderColor: COLORS.borderLight,
  },
  secondaryCompact: { minHeight: 38, paddingHorizontal: 12, borderRadius: 12 },
  secondaryText: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  disabled: { opacity: 0.5 },

  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconBtnBorder: { borderWidth: 1, borderColor: COLORS.borderLight },

  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },

  segmented: { height: 44, padding: 4, borderRadius: 14, backgroundColor: COLORS.lightBlueBg, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  segmentOn: { backgroundColor: COLORS.cardWhite },
  segmentText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  segmentTextOn: { color: COLORS.darkNavy, fontWeight: '700' },
  segmentBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.darkGold },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 6 },
  headerMid: { flex: 1, alignItems: 'center', gap: 1, paddingHorizontal: 6 },
  headerKicker: { fontSize: 12, fontWeight: '700', color: COLORS.textGold, letterSpacing: 0.6, textTransform: 'uppercase' },
  headerTitle: { fontSize: 13, fontWeight: '500' },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },

  // Shared page scaffolding
  screen: { flex: 1, backgroundColor: COLORS.background },
  pad: { paddingHorizontal: 20 },
});
