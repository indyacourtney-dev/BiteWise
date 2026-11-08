// app/help.tsx — Help & how it works: every feature in one list.
//
// Reached from Profile and from any "?" sheet. Tap a topic for the same
// sheet the "?" opens; "Take the tour" replays the cards from onboarding.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { HelpSheet, TONE_BG } from '@/components/Help';
import { SettingsHeader, settingsStyles } from '@/components/SettingsUI';
import { PrimaryButton } from '@/components/ui';
import { COLORS } from '@/constants/Colors';
import { HELP_ORDER, HELP_TOPICS, type HelpTopicId } from '@/constants/help';

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<HelpTopicId | null>(null);

  return (
    <SafeAreaView style={settingsStyles.safeArea} edges={['top']}>
      <SettingsHeader title="Help & how it works" />
      <ScrollView contentContainerStyle={[settingsStyles.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={s.tourCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.tourTitle}>New here, or just curious?</Text>
            <Text style={s.tourText}>The two-minute tour shows what each part of the app does.</Text>
          </View>
          <PrimaryButton label="Take the tour" icon="play" tone="yellow" onPress={() => router.push('/tour')} style={{ paddingHorizontal: 16 }} />
        </View>

        <Text style={s.label}>Everything, one screen at a time</Text>
        <View style={s.list}>
          {HELP_ORDER.map((id, i) => {
            const t = HELP_TOPICS[id];
            return (
              <TouchableOpacity
                key={id}
                style={[s.row, i < HELP_ORDER.length - 1 && s.rowBorder]}
                onPress={() => setOpen(id)}
                accessibilityRole="button"
                accessibilityLabel={`${t.title}. ${t.summary}`}
              >
                <View style={[s.tile, { backgroundColor: TONE_BG[t.tone] }]}><Text style={s.emoji}>{t.emoji}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{t.title}</Text>
                  <Text style={s.summary} numberOfLines={2}>{t.summary}</Text>
                </View>
                <FontAwesome name="chevron-right" size={13} color={COLORS.inactiveGray} />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.foot}>Look for the small ? beside a feature — it opens the same card for that screen.</Text>
      </ScrollView>
      <HelpSheet topic={open} onClose={() => setOpen(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  tourCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.darkNavy, borderRadius: 20, padding: 16, marginTop: 12 },
  tourTitle: { fontSize: 16, fontWeight: '800', color: COLORS.cardWhite },
  tourText: { fontSize: 13, lineHeight: 18, color: COLORS.navyMuted, marginTop: 3 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  list: { backgroundColor: COLORS.cardWhite, borderRadius: 18, borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  summary: { fontSize: 12.5, lineHeight: 17, color: COLORS.textMuted, marginTop: 1 },
  foot: { fontSize: 12, lineHeight: 17, color: COLORS.textMuted, textAlign: 'center', marginTop: 18 },
});
