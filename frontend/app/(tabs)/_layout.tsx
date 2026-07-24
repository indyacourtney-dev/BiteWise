// frontend/app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS } from '../../constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // 1. Hide the default header banner at the top of the screen
        headerShown: false,
        
        // 2. Navigation Bar Background and Border styling
        tabBarStyle: {
          backgroundColor: COLORS.darkNavy,
          borderTopWidth: 3,                 // Height of the trim line
          borderTopColor: COLORS.goldYellow, // Yellow trim at the top of the navbar
          height: 85,                        // Extra padding for tab comfort
          paddingBottom: 8,
          paddingTop: 8,
        },
        
        // 3. Icon selection colors
        tabBarActiveTintColor: COLORS.yellowAccent, // Highlight selected tab with yellow
        tabBarInactiveTintColor: COLORS.inactiveGray, // Default unselected tab color
        
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 11,
        },
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-variant" size={size} color={color} />
          ),
        }}
      />

      {/* Pantry Tab */}
      <Tabs.Screen
        name="pantry"
        options={{
          title: 'My Pantry',
          tabBarIcon: ({ color, size }) => (
            // A perfect shelf / cupboard pantry icon from MaterialCommunityIcons
            <MaterialCommunityIcons name="fridge-outline" size={size} color={color} />
          ),
        }}
      />

    </Tabs>
  );
}