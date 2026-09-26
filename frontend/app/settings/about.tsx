// app/settings/about.tsx — Settings → How BiteWise picks meals.

import React from 'react';
import { Text, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { SettingsHeader, SettingsSection, settingsStyles as s } from '@/components/SettingsUI';
import { COLORS } from '@/constants/Colors';

const POINTS: [string, string][] = [
  ['🛡️ Safety first', 'Recipes with your allergies, or ones we can\'t fully check, are never suggested. Diet and health goals you pick must all be met.'],
  ['🍽️ The right meal', 'Breakfast, brunch, lunch, dinner or dessert — set from the time of day, change it any time.'],
  ['😋 Your taste', 'Foods and cuisines you love move up; foods you avoid never show.'],
  ['🧺 Your pantry', 'Recipes you can make with what you have rank higher.'],
  ['🔁 What you pick', 'We learn from the meals you choose and avoid repeating recent ones.'],
  ['❤️ The community', 'Recipes other BiteWise cooks saved get a small boost.'],
];

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <SettingsHeader title="About" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <SettingsSection title="How BiteWise picks meals">
          <View style={s.padded}>
            {POINTS.map(([title, text]) => (
              <View key={title} style={{ gap: 2, marginBottom: 6 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.darkNavy }}>{title}</Text>
                <Text style={s.message}>{text}</Text>
              </View>
            ))}
          </View>
        </SettingsSection>
        <SettingsSection
          title="Nutrition"
          footer="Calories, macros and health labels are estimates from standard nutrition data. They're for planning meals, not medical advice."
        >
          <View style={s.padded}>
            <Text style={s.message}>BiteWise {Constants.expoConfig?.version ?? ''}</Text>
          </View>
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}
