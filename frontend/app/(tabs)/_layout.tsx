// app/(tabs)/_layout.tsx — the bottom tab bar.
// Without this file, (tabs)/index is a loose screen with no Tab
// Navigator around it, and useBottomTabBarHeight() throws.

import React from 'react';
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
        }}
      />
      {/* Add a <Tabs.Screen name="..."> per file in app/(tabs)/ */}
    </Tabs>
  );
}