// app/(tabs)/_layout.tsx
//
// The bottom tab bar. This file did not exist before — the Tabs component
// was sitting in the root layout, which is why the bar never matched the
// screens underneath it.
//
// Design notes (matching the Figma):
//   - White bar, thin top hairline, no heavy shadow
//   - Navy for the active tab, muted gray for inactive
//   - A small gold dot above the active icon instead of a filled pill,
//     so the bar stays light
//   - Bottom inset handled manually so the bar clears the iPhone home
//     indicator without floating awkwardly on Android

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/Colors';

/** Home is the first tab and the screen Expo Go opens on. */
export const unstable_settings = {
  initialRouteName: 'index',
};

function TabIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.dot, focused && styles.dotActive]} />
      {children}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.darkNavy,
        tabBarInactiveTintColor: COLORS.inactiveGray,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarStyle: [
          styles.bar,
          { height: 62 + insets.bottom, paddingBottom: insets.bottom + 6 },
        ],
      }}
    >
      {/* HOME — first tab, default screen */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={23}
                color={color}
              />
            </TabIcon>
          ),
        }}
      />

      {/* THIS OR THAT */}
      <Tabs.Screen
        name="thisorthat"
        options={{
          title: 'This or That',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <MaterialCommunityIcons
                name={focused ? 'cards' : 'cards-outline'}
                size={23}
                color={color}
              />
            </TabIcon>
          ),
        }}
      />

      {/* PANTRY */}
      <Tabs.Screen
        name="pantry"
        options={{
          title: 'My Pantry',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <MaterialCommunityIcons
                name={focused ? 'fridge' : 'fridge-outline'}
                size={23}
                color={color}
              />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.cardWhite,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderLight,
    paddingTop: 8,
    elevation: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
      },
    }),
  },
  item: {
    paddingTop: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: COLORS.goldYellow,
  },
});
