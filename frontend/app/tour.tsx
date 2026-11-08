// app/tour.tsx — the guided tour: swipeable cards, one per part of the app.
//
// Shown once, right after the onboarding questions (app/onboarding.tsx
// sends people here instead of straight Home), and again from Help any
// time. Cards come from constants/help.ts TOUR so the words match the
// "?" help on each screen.

import React, { useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { TONE_BG } from '@/components/Help';
import { PrimaryButton } from '@/components/ui';
import { COLORS } from '@/constants/Colors';
import { TOUR } from '@/constants/help';
import { useAccessibility } from '@/hooks/useAccessibility';

const SERIF = 'PlayfairDisplay_700Bold';

export default function TourScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();
  // Measured from the pager itself (useWindowDimensions can be 0 on a
  // static web render, which squeezes every page into one screen).
  const [width, setWidth] = useState(() => Dimensions.get('window').width || 390);
  const { from } = useLocalSearchParams<{ from?: string }>();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const last = index === TOUR.length - 1;

  const finish = () => {
    a11y.haptic('success');
    if (from === 'onboarding' || !router.canGoBack()) router.replace('/');
    else router.back();
  };

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(TOUR.length - 1, i));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: !a11y.reduceMotion });
    setIndex(clamped);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) {
      setWidth(w);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: index * w, animated: false }));
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < TOUR.length) setIndex(i);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.top}>
        <Text style={s.brand}>BiteWise</Text>
        <TouchableOpacity onPress={finish} style={s.skip} accessibilityRole="button" accessibilityLabel={last ? 'Finish the tour' : 'Skip the tour'}>
          <Text style={s.skipText}>{last ? 'Done' : 'Skip'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={{ flex: 1 }}
        contentContainerStyle={{ width: width * TOUR.length }}
        accessibilityRole="adjustable"
        accessibilityLabel={`Tour card ${index + 1} of ${TOUR.length}`}
      >
        {TOUR.map((c, i) => (
          <View key={c.key} style={[s.page, { width, minWidth: width, maxWidth: width }]}>
            <View style={[s.tile, { backgroundColor: TONE_BG[c.tone] }]}>
              <Text style={s.emoji}>{c.emoji}</Text>
              {c.example?.length ? (
                <View style={s.exampleWrap}>
                  {c.example.map((ex, j) => (
                    <View key={ex} style={[s.example, j === 0 && c.key === 'home' && s.exampleOn]}>
                      <Text style={[s.exampleText, j === 0 && c.key === 'home' && s.exampleTextOn]}>{ex}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={s.count}>{i + 1} / {TOUR.length}</Text>
            </View>
            <Text style={s.kicker}>{c.kicker}</Text>
            <Text style={s.title} accessibilityRole="header">{c.title}</Text>
            <Text style={[s.body, a11y.text(16)]}>{c.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.dots}>
          {TOUR.map((c, i) => (
            <TouchableOpacity key={c.key} onPress={() => goTo(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Go to card ${i + 1}`}>
              <View style={[s.dot, i === index && s.dotOn, i < index && s.dotDone]} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.buttons}>
          {index > 0 ? (
            <TouchableOpacity onPress={() => goTo(index - 1)} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Previous card">
              <FontAwesome name="chevron-left" size={15} color={COLORS.darkNavy} />
            </TouchableOpacity>
          ) : null}
          <PrimaryButton
            label={last ? (from === 'onboarding' ? 'Start cooking' : 'Done') : 'Next'}
            icon={last ? 'cutlery' : 'arrow-right'}
            onPress={() => (last ? finish() : goTo(index + 1))}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, height: 52 },
  brand: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2, color: COLORS.textGold, textTransform: 'uppercase' },
  skip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight },
  skipText: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },

  page: { paddingHorizontal: 24, paddingTop: 8, flexGrow: 0, flexShrink: 0 },
  tile: { borderRadius: 28, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 22, gap: 18 },
  emoji: { fontSize: 72 },
  exampleWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  example: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.85)' },
  exampleOn: { backgroundColor: COLORS.darkNavy },
  exampleText: { fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },
  exampleTextOn: { color: COLORS.cardWhite },
  count: { position: 'absolute', top: 14, right: 16, fontSize: 12, fontWeight: '800', color: COLORS.darkNavy, opacity: 0.55 },

  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: COLORS.textGold, marginTop: 26 },
  title: { fontFamily: SERIF, fontSize: 30, lineHeight: 36, color: COLORS.darkNavy, marginTop: 6 },
  body: { fontSize: 16, lineHeight: 24, color: COLORS.textDark, marginTop: 12 },

  bottom: { paddingHorizontal: 24, paddingTop: 10, gap: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderLight },
  dotDone: { backgroundColor: COLORS.darkGold },
  dotOn: { width: 24, backgroundColor: COLORS.darkGold },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.cardWhite, borderWidth: 1, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center' },
});
