// app/(tabs)/kitchen.tsx — KITCHEN: pantry and grocery list in one tab.
//
// Items flow between the two (running low → list → bought → pantry), so
// they share a tab with a segmented switch. Deep links still work:
// /pantry and /grocery redirect here with ?tab=.

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { HelpButton } from '@/components/Help';
import PantryPane from '@/components/kitchen/PantryPane';
import GroceryPane from '@/components/kitchen/GroceryPane';
import { Display, SegmentedControl } from '@/components/ui';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { stockStatus } from '@/utils/pantryStatus';
import { Text } from 'react-native';

type Tab = 'pantry' | 'grocery';

export default function KitchenScreen() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(tabParam === 'grocery' ? 'grocery' : 'pantry');
  const { pantry, grocery } = useApp();

  useEffect(() => {
    if (tabParam === 'grocery' || tabParam === 'pantry') setTab(tabParam);
  }, [tabParam]);

  const toBuy = grocery.filter(g => !g.checked).length;
  const low = pantry.filter(i => stockStatus(i) !== 'ok').length;
  // Same number as the pantry's "items in your kitchen": things you actually have.
  const inStock = pantry.filter(i => i.quantity > 0).length;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Display size={26}>Kitchen</Display>
        <View style={styles.subRow}>
          <Text style={styles.subtitle}>{tab === 'pantry' ? 'What you have' : 'What to buy'}</Text>
          <HelpButton topic={tab === 'pantry' ? 'pantry' : 'grocery'} />
        </View>
      </View>
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { key: 'pantry', label: `Pantry · ${inStock}`, badge: low > 0 && tab !== 'pantry' },
          { key: 'grocery', label: `Grocery · ${toBuy}`, badge: toBuy > 0 && tab !== 'grocery' },
        ]}
        style={{ marginTop: 14 }}
      />
    </View>
  );

  return tab === 'pantry'
    ? <PantryPane header={header} onSwitch={setTab} />
    : <GroceryPane header={header} onSwitch={setTab} />;
}

const styles = StyleSheet.create({
  header: { paddingTop: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subtitle: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
});
