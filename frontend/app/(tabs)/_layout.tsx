// app/(tabs)/_layout.tsx — the bottom tab bar: Home, Pantry, Grocery, Favorites, Community.
import { COLORS } from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router/js-tabs';
import React, { useMemo } from 'react';

import { useApp } from '@/context/AppContext';
import { stockStatus } from '@/utils/pantryStatus';

export default function TabLayout() {
  const { pantry, grocery } = useApp();
  // Badge on Grocery: pantry items running low or out that aren't on the list yet.
  const needsAttention = useMemo(() => {
    const listed = new Set(grocery.map(g => g.name.toLowerCase()));
    return pantry.filter(i => stockStatus(i) !== 'ok' && !listed.has(i.name.toLowerCase())).length;
  }, [pantry, grocery]);

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

      {/* Grocery list — badge = items running low at home, not on the list yet */}
      <Tabs.Screen
        name="grocery"
        options={{
          title: 'Grocery',
          tabBarIcon: ({ color }) => <FontAwesome name="shopping-cart" size={22} color={color} />,
          tabBarBadge: needsAttention > 0 ? needsAttention : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.goldYellow, color: COLORS.darkNavy, fontWeight: '800' },
          tabBarAccessibilityLabel:
            needsAttention > 0 ? `Grocery, ${needsAttention} items running low` : 'Grocery',
        }}
      />

      {/* Favorites — hearted recipes, stored in Supabase (Task 1.6) */}
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color }) => <FontAwesome name="heart" size={21} color={color} />,
        }}
      />

      {/* Community — chat rooms + shared home recipes (Task 1.7) */}
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color }) => <FontAwesome name="comments" size={22} color={color} />,
        }}
      />

    </Tabs>
  );
}