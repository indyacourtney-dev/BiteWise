// constants/goalIcons.ts — one icon per fitness goal (Profile card, goals screen).

import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';
import type { GoalKind } from '@/utils/goals';

export const GOAL_ICONS: Record<GoalKind, ComponentProps<typeof FontAwesome>['name']> = {
  lose: 'leaf', gain: 'bolt', performance: 'trophy', health: 'heart', energy: 'sun-o', maintain: 'balance-scale',
};
