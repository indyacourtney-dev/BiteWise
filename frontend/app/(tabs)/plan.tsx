// app/(tabs)/plan.tsx — PLAN: the week, as a tab.
// The screen itself lives in components/plan/PlanWeekScreen.tsx; /planWeek
// (older links, the recipe page's "Add to my week") redirects here.

import React from 'react';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';

import PlanWeekScreen from '@/components/plan/PlanWeekScreen';

export default function PlanTab() {
  const tabBarHeight = useBottomTabBarHeight();
  return <PlanWeekScreen embedded bottomPadding={tabBarHeight} />;
}
