// app/settings/accessibility.tsx — Settings → Accessibility.
//
// Everything here takes effect immediately (see hooks/useAccessibility.ts):
//   text size & bold text   recipes, Decide for me, chat
//   reduce motion           follows the phone by default
//   vibration feedback      hearts, picks, sending messages
//   read aloud speed+voice  the "Read aloud" button on recipes

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import {
  SettingsChoice, SettingsHeader, SettingsSection, SettingsToggle, settingsStyles as s,
} from '@/components/SettingsUI';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { useAccessibility, useSystemReduceMotion } from '@/hooks/useAccessibility';
import { loadVoices, sortVoices, voicesForLanguage, type VoiceOption } from '@/utils/voices';
import type { AppSettings } from '@/types';

const SAMPLE = 'This is how recipes will sound. Step one: preheat the oven.';

function deviceLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
}

export default function AccessibilityScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useApp();
  const a11y = useAccessibility();
  const systemReduceMotion = useSystemReduceMotion();

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <SettingsHeader title="Accessibility" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <SettingsSection
          title="Reading"
          footer="Applies to recipes, Decide for me and chat. BiteWise also follows your phone's own text size setting everywhere."
        >
          <SettingsChoice<AppSettings['textScale']>
            label="Text size"
            options={[
              { value: 1, label: 'Default' }, { value: 1.15, label: 'Large' },
              { value: 1.3, label: 'Larger' }, { value: 1.5, label: 'Largest' },
            ]}
            value={settings.textScale}
            onChange={v => updateSettings({ textScale: v })}
          />
          <SettingsToggle label="Bold text" value={settings.boldText} onChange={v => updateSettings({ boldText: v })} />
          <View style={[s.padded, { backgroundColor: COLORS.background }]}>
            <Text style={s.message}>Preview</Text>
            <Text style={[{ color: COLORS.darkNavy }, a11y.text(15)]}>
              Step 1. Heat the olive oil in a large pan over medium heat, then add the garlic.
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection
          title="Read aloud"
          footer='Use the "Read aloud" button on any recipe to hear the ingredients and steps — handy with messy hands.'
        >
          <SettingsChoice<AppSettings['speechRate']>
            label="Speaking speed"
            options={[{ value: 0.75, label: 'Slower' }, { value: 1, label: 'Normal' }, { value: 1.25, label: 'Faster' }]}
            value={settings.speechRate}
            onChange={v => updateSettings({ speechRate: v })}
          />
          <TouchableOpacity
            style={[s.padded, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
            onPress={() => (a11y.speaking ? a11y.stop() : a11y.speak([SAMPLE]))}
            accessibilityRole="button"
            accessibilityLabel={a11y.speaking ? 'Stop the test voice' : 'Test the voice'}
          >
            <FontAwesome name={a11y.speaking ? 'stop' : 'volume-up'} size={16} color={COLORS.darkNavy} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.darkNavy }}>
              {a11y.speaking ? 'Stop' : 'Test voice'}
            </Text>
          </TouchableOpacity>
        </SettingsSection>

        <SettingsSection
          title="Voice"
          footer="Voices come from your device, so the list differs between phones and browsers. Enhanced voices sound more natural; your phone may offer more under its own accessibility settings."
        >
          <VoicePicker
            value={settings.voiceId ?? null}
            onChange={v => updateSettings({ voiceId: v })}
            speaking={a11y.speaking}
            onPreview={id => (a11y.speaking ? a11y.stop() : a11y.speak([SAMPLE], { voiceId: id }))}
          />
        </SettingsSection>

        <SettingsSection title="Motion & touch">
          <SettingsChoice<AppSettings['reduceMotion']>
            label="Reduce motion"
            hint={`Turns off animations. Your phone's setting is currently ${systemReduceMotion ? 'on' : 'off'}.`}
            options={[{ value: 'system', label: 'Match phone' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
            value={settings.reduceMotion}
            onChange={v => updateSettings({ reduceMotion: v })}
          />
          <SettingsToggle
            label="Vibration feedback"
            hint="A small buzz when you save a favorite, pick a meal or send a message."
            value={settings.haptics}
            onChange={v => {
              updateSettings({ haptics: v });
              if (v) a11y.haptic('success');
            }}
            last
          />
        </SettingsSection>

        <SettingsSection
          title="Screen readers"
          footer="BiteWise works with VoiceOver (iPhone) and TalkBack (Android): buttons, tabs and choices are labelled. Turn them on in your phone's accessibility settings."
        >
          <View style={s.padded}>
            <Text style={s.message}>
              Allergy warnings on recipes are written out in words, not only shown in color, so they're read aloud too.
            </Text>
          </View>
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// VOICE PICKER
// ============================================
// A radio list: "Device default" plus every voice in the user's language
// (enhanced ones first), each with a play button to hear it before choosing.
// "Show all languages" reveals the rest.

function VoicePicker({ value, onChange, onPreview, speaking }: {
  value: string | null;
  onChange: (id: string | null) => void;
  onPreview: (id: string | null) => void;
  speaking: boolean;
}) {
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [previewing, setPreviewing] = useState<string | null | undefined>(undefined);
  const language = useMemo(deviceLanguage, []);

  useEffect(() => {
    let mounted = true;
    loadVoices().then(v => mounted && setVoices(sortVoices(v, language)));
    return () => {
      mounted = false;
    };
  }, [language]);

  useEffect(() => {
    if (!speaking) setPreviewing(undefined);
  }, [speaking]);

  if (voices === null) {
    return (
      <View style={[s.padded, vp.loading]}>
        <ActivityIndicator size="small" color={COLORS.darkNavy} />
        <Text style={s.message}>Finding voices on this device…</Text>
      </View>
    );
  }

  const mine = voicesForLanguage(voices, language);
  const shown = showAll ? voices : mine;
  const hiddenCount = voices.length - mine.length;
  // The saved voice may be in another language: keep it visible.
  const list = value && !shown.some(v => v.id === value)
    ? [...shown, ...voices.filter(v => v.id === value)]
    : shown;

  const preview = (id: string | null) => {
    setPreviewing(id);
    onPreview(id);
  };

  const Row = ({ id, name, detail, enhanced, last }: {
    id: string | null; name: string; detail?: string; enhanced?: boolean; last?: boolean;
  }) => {
    const on = value === id;
    const playing = speaking && previewing === id;
    return (
      <View style={[vp.row, !last && vp.rowBorder]}>
        <TouchableOpacity
          style={vp.rowMain}
          onPress={() => onChange(id)}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
          accessibilityLabel={`${name}${detail ? `, ${detail}` : ''}${enhanced ? ', enhanced' : ''}`}
        >
          <FontAwesome name={on ? 'dot-circle-o' : 'circle-o'} size={18} color={on ? COLORS.darkNavy : COLORS.inactiveGray} />
          <View style={vp.rowText}>
            <View style={vp.nameRow}>
              <Text style={vp.name}>{name}</Text>
              {enhanced ? <Text style={vp.badge}>Enhanced</Text> : null}
            </View>
            {detail ? <Text style={vp.detail}>{detail}</Text> : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[vp.play, playing && vp.playOn]}
          onPress={() => preview(id)}
          accessibilityRole="button"
          accessibilityLabel={playing ? `Stop ${name}` : `Hear ${name}`}
        >
          <FontAwesome name={playing ? 'stop' : 'play'} size={12} color={COLORS.darkNavy} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View>
      <Row id={null} name="Device default" detail="Whatever your phone or browser uses" last={list.length === 0} />
      {list.map((v, i) => (
        <Row
          key={v.id}
          id={v.id}
          name={v.name}
          detail={v.languageLabel}
          enhanced={v.enhanced}
          last={i === list.length - 1 && (hiddenCount <= 0 || showAll)}
        />
      ))}
      {voices.length === 0 ? (
        <View style={s.padded}>
          <Text style={s.message}>This device doesn’t offer a choice of voices, so the default is used.</Text>
        </View>
      ) : null}
      {hiddenCount > 0 ? (
        <TouchableOpacity
          style={vp.more}
          onPress={() => setShowAll(v => !v)}
          accessibilityRole="button"
        >
          <Text style={vp.moreText}>
            {showAll ? 'Show only my language' : `Show all languages (${hiddenCount} more)`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const vp = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 10, minHeight: 56 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.textDark },
  badge: {
    fontSize: 10, fontWeight: '800', color: COLORS.darkGold, letterSpacing: 0.4, textTransform: 'uppercase',
    backgroundColor: COLORS.lightYellow, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  detail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  play: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.borderLight, marginLeft: 8,
  },
  playOn: { backgroundColor: COLORS.lightYellow, borderColor: '#DCCB72' },
  more: { alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  moreText: { fontSize: 14, fontWeight: '700', color: COLORS.darkGold },
});
