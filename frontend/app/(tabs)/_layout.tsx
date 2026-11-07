// app/(tabs)/_layout.tsx — the bottom tab bar: Home, Kitchen, Plan, Saved, Community.
//
// Kitchen = pantry + grocery (items flow between them). Plan is a tab
// because planning the week is a core function, not a card. Profile and
// settings open from the avatar on Home.
import { COLORS } from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router/js-tabs';
import React, { useMemo } from 'react';

import { useApp } from '@/context/AppContext';
import { stockStatus } from '@/utils/pantryStatus';
import { todayIso } from '@/utils/age';

export default function TabLayout() {
  const { pantry, grocery, mealPlan } = useApp();
  // Badge on Kitchen: pantry items running low or out that aren't on the list yet.
  const needsAttention = useMemo(() => {
    const listed = new Set(grocery.map(g => g.name.toLowerCase()));
    return pantry.filter(i => stockStatus(i) !== 'ok' && !listed.has(i.name.toLowerCase())).length;
  }, [pantry, grocery]);
  // Dot on Plan when tonight's dinner isn't planned yet.
  const today = todayIso();
  const dinnerPlanned = mealPlan.some(m => m.date === today && m.slot === 'dinner');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.darkNavy,
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: COLORS.yellowAccent,
        tabBarInactiveTintColor: COLORS.navyMuted,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: 'Kitchen',
          tabBarIcon: ({ color }) => <FontAwesome name="shopping-basket" size={21} color={color} />,
          tabBarBadge: needsAttention > 0 ? needsAttention : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.goldYellow, color: COLORS.darkNavy, fontWeight: '800' },
          tabBarAccessibilityLabel:
            needsAttention > 0 ? `Kitchen, ${needsAttention} items running low` : 'Kitchen',
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <FontAwesome name="calendar" size={21} color={color} />,
          tabBarBadge: dinnerPlanned ? undefined : '',
          tabBarBadgeStyle: { backgroundColor: COLORS.goldYellow, minWidth: 8, height: 8, borderRadius: 4, marginTop: 2 },
          tabBarAccessibilityLabel: dinnerPlanned ? 'Plan' : 'Plan, nothing planned for tonight',
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <FontAwesome name="heart" size={21} color={color} />,
        }}
      />
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
