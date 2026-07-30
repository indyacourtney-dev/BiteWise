// app/(tabs)/_layout.tsx — the bottom tab bar: Home + Pantry.
import { COLORS } from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.darkNavy,
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: COLORS.yellowAccent,
        tabBarInactiveTintColor: COLORS.inactiveGray,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
        }}
      />

      {/* Pantry Tab */}
      <Tabs.Screen
        name="pantry"
        options={{
          title: 'Pantry',
          tabBarIcon: ({ color }) => <FontAwesome name="shopping-basket" size={22} color={color} />,
        }}
      />

    </Tabs>
  );
}