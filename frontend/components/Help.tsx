// components/Help.tsx — the little "?" beside a feature, and the sheet it opens.
//
//   <HelpButton topic="pantry" />         a 32px round "?" (plain, light or dark)
//   <HelpSheet topic="pantry" onClose /> what it is, how to use it, tips,
//                                        with "All help" and "Take the tour"
//
// Content comes from constants/help.ts, the same text the guided tour uses.

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { HELP_TOPICS, type HelpTone, type HelpTopicId } from '@/constants/help';
import { useAccessibility } from '@/hooks/useAccessibility';

const SERIF = 'PlayfairDisplay_700Bold';

export const TONE_BG: Record<HelpTone, string> = {
  sand: COLORS.tileSand,
  clay: COLORS.tileClay,
  sage: COLORS.tileSage,
  navy: COLORS.lightBlueBg,
  yellow: COLORS.lightYellow,
};

export function HelpButton({ topic, tone = 'plain', style }: { topic: HelpTopicId; tone?: 'plain' | 'light' | 'dark'; style?: object }) {
  const [open, setOpen] = useState(false);
  const bg = tone === 'dark' ? 'rgba(255,255,255,0.14)' : tone === 'light' ? COLORS.cardWhite : 'transparent';
  const fg = tone === 'dark' ? COLORS.cardWhite : COLORS.darkNavy;
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[s.btn, { backgroundColor: bg }, tone === 'plain' && s.btnPlain, style]}
        accessibilityRole="button"
        accessibilityLabel={`Help: ${HELP_TOPICS[topic].title}`}
        hitSlop={8}
      >
        <FontAwesome name="question" size={13} color={fg} />
      </TouchableOpacity>
      <HelpSheet topic={open ? topic : null} onClose={() => setOpen(false)} />
    </>
  );
}

export function HelpSheet({ topic, onClose }: { topic: HelpTopicId | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const a11y = useAccessibility();
  const t = topic ? HELP_TOPICS[topic] : null;

  const go = (path: '/help' | '/tour') => {
    onClose();
    setTimeout(() => router.push(path), 50);
  };

  return (
    <Modal visible={!!t} transparent animationType={a11y.reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close help" />
      {t ? (
        <View style={[s.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
            <View style={s.hero}>
              <View style={[s.tile, { backgroundColor: TONE_BG[t.tone] }]}><Text style={s.emoji}>{t.emoji}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.where}>{t.where}</Text>
                <Text style={s.title} accessibilityRole="header">{t.title}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Close">
                <FontAwesome name="times" size={15} color={COLORS.darkNavy} />
              </TouchableOpacity>
            </View>
            <Text style={[s.summary, a11y.text(16)]}>{t.summary}</Text>

            <Text style={s.label}>How to use it</Text>
            <View style={s.card}>
              {t.steps.map((step, i) => (
                <View key={i} style={[s.step, i < t.steps.length - 1 && s.stepBorder]}>
                  <View style={s.num}><Text style={s.numText}>{i + 1}</Text></View>
                  <Text style={[s.stepText, a11y.text(14)]}>{step}</Text>
                </View>
              ))}
            </View>

            {t.tips?.length ? (
              <View style={s.tips}>
                {t.tips.map((tip, i) => (
                  <View key={i} style={s.tipRow}>
                    <FontAwesome name="lightbulb-o" size={14} color={COLORS.textGold} style={{ marginTop: 2 }} />
                    <Text style={[s.tipText, a11y.text(13)]}>{tip}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={s.links}>
              <TouchableOpacity onPress={() => go('/help')} style={s.link} accessibilityRole="button">
                <FontAwesome name="list-ul" size={13} color={COLORS.darkNavy} />
                <Text style={s.linkText}>All help topics</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => go('/tour')} style={s.link} accessibilityRole="button">
                <FontAwesome name="play-circle-o" size={14} color={COLORS.darkNavy} />
                <Text style={s.linkText}>Take the tour</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

const s = StyleSheet.create({
  btn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderLight },
  btnPlain: { borderColor: COLORS.borderLight, backgroundColor: COLORS.cardWhite },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,42,58,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '86%', backgroundColor: COLORS.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.borderLight, marginTop: 10 },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  where: { fontSize: 12, fontWeight: '700', color: COLORS.textGold, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontFamily: SERIF, fontSize: 24, color: COLORS.darkNavy, marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardWhite, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderLight },
  summary: { fontSize: 16, lineHeight: 23, color: COLORS.textDark, marginTop: 14 },

  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.textMuted, marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: COLORS.cardWhite, borderRadius: 18, borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.goldYellow, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 13, fontWeight: '800', color: COLORS.darkNavy },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.textDark },

  tips: { marginTop: 12, gap: 8 },
  tipRow: { flexDirection: 'row', gap: 10, backgroundColor: COLORS.lightYellow, borderRadius: 14, padding: 12 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.textDark },

  links: { flexDirection: 'row', gap: 10, marginTop: 18 },
  link: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight },
  linkText: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
});
