// app/settings/accessibility.tsx — Settings → Accessibility.
//
// Everything here takes effect immediately (see hooks/useAccessibility.ts):
//   text size & bold text   recipes, Decide for me, chat
//   reduce motion           follows the phone by default
//   vibration feedback      hearts, picks, sending messages
//   read aloud speed        the "Read aloud" button on recipes

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import {
  SettingsChoice, SettingsHeader, SettingsSection, SettingsToggle, settingsStyles as s,
} from '@/components/SettingsUI';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { useAccessibility, useSystemReduceMotion } from '@/hooks/useAccessibility';
import type { AppSettings } from '@/types';

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
            onPress={() => (a11y.speaking ? a11y.stop() : a11y.speak(['This is how recipes will sound. Step one: preheat the oven.']))}
            accessibilityRole="button"
            accessibilityLabel={a11y.speaking ? 'Stop the test voice' : 'Test the voice'}
          >
            <FontAwesome name={a11y.speaking ? 'stop' : 'volume-up'} size={16} color={COLORS.darkNavy} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.darkNavy }}>
              {a11y.speaking ? 'Stop' : 'Test voice'}
            </Text>
          </TouchableOpacity>
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
