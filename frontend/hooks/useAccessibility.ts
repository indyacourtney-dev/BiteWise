// hooks/useAccessibility.ts
//
// One place for the Settings → Accessibility options, so screens don't
// each reimplement them:
//
//   const a11y = useAccessibility();
//   <Text style={[styles.step, a11y.text(15)]}>...</Text>   // user's text size + bold
//   if (!a11y.reduceMotion) Animated.timing(...)            // follows phone setting too
//   a11y.haptic('success')                                  // respects the vibration toggle
//   a11y.speak(['Step one...', 'Step two...'])               // read aloud at the chosen speed
//
// Note: the phone's own text-size setting also still applies everywhere
// (React Native scales text with it automatically); the in-app setting
// adds to it on the screens you read the most.

import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, type TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import { useApp } from '../context/AppContext';

export function useSystemReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => mounted && setEnabled(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return enabled;
}

export function useAccessibility() {
  const { settings } = useApp();
  const systemReduceMotion = useSystemReduceMotion();
  const [speaking, setSpeaking] = useState(false);

  const reduceMotion = settings.reduceMotion === 'system' ? systemReduceMotion : settings.reduceMotion === 'on';

  /** Font size (and weight, if Bold text is on) for reading text. */
  const text = useCallback(
    (baseSize: number, baseWeight: TextStyle['fontWeight'] = '400'): TextStyle => ({
      fontSize: Math.round(baseSize * settings.textScale),
      lineHeight: Math.round(baseSize * settings.textScale * 1.4),
      fontWeight: settings.boldText ? (baseWeight === '400' || baseWeight === 'normal' ? '600' : '800') : baseWeight,
    }),
    [settings.textScale, settings.boldText]
  );

  const haptic = useCallback(
    (kind: 'light' | 'success' = 'light') => {
      if (!settings.haptics || Platform.OS === 'web') return;
      const run = kind === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      run.catch(() => {});
    },
    [settings.haptics]
  );

  const stop = useCallback(() => {
    Speech.stop();
    setSpeaking(false);
  }, []);

  /** Read several pieces of text aloud, one after another. */
  const speak = useCallback(
    (parts: string[]) => {
      Speech.stop();
      const queue = parts.map(p => p.trim()).filter(Boolean);
      if (queue.length === 0) return;
      setSpeaking(true);
      queue.forEach((part, i) =>
        Speech.speak(part, {
          rate: settings.speechRate,
          onDone: i === queue.length - 1 ? () => setSpeaking(false) : undefined,
          onStopped: () => setSpeaking(false),
          onError: () => setSpeaking(false),
        })
      );
    },
    [settings.speechRate]
  );

  // Stop talking when the screen using this goes away.
  useEffect(() => () => {
    Speech.stop();
  }, []);

  return { settings, reduceMotion, text, haptic, speak, stop, speaking };
}
