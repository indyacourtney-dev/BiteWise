// components/Avatar.tsx — a user's profile photo, or their emoji if they haven't added one.

import React from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/Colors';

interface Props {
  url?: string | null;
  emoji?: string | null;
  size?: number;
  /** Read by screen readers, e.g. "Sam's profile photo". */
  label?: string;
}

export default function Avatar({ url, emoji, size = 40, label }: Props) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  return url ? (
    <Image source={{ uri: url }} style={[styles.base, box]} accessibilityLabel={label ?? 'Profile photo'} />
  ) : (
    <View style={[styles.base, styles.fallback, box]} accessibilityLabel={label ?? 'Profile picture'}>
      <Text style={{ fontSize: size * 0.55 }}>{emoji || '🧑‍🍳'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: COLORS.lightYellow, overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
