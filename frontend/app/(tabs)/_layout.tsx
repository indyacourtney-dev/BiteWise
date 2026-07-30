// app/(tabs)/_layout.tsx — the bottom tab bar: Home + Pantry.
import React from 'react';
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { COLORS } from '@/constants/Colors';

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
        name="home"
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