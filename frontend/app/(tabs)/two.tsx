import React, { useState } from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  View as RNView,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface PantryCategory {
  id: string;
  category: string;
  items: PantryItem[];
}

const INITIAL_PANTRY: PantryCategory[] = [
  { id: 'proteins', category: 'Proteins', items: [] },
  { id: 'produce', category: 'Produce', items: [] },
  { id: 'dairy', category: 'Dairy', items: [] },
  { id: 'pantry', category: 'Pantry / Dry Goods', items: [] },
];

const COMMON_ITEMS = [
  { name: 'Chicken', category: 'proteins', emoji: '🍗' },
  { name: 'Beef', category: 'proteins', emoji: '🥩' },
  { name: 'Tomato', category: 'produce', emoji: '🍅' },
  { name: 'Lettuce', category: 'produce', emoji: '🥬' },
  { name: 'Milk', category: 'dairy', emoji: '🥛' },
  { name: 'Cheese', category: 'dairy', emoji: '🧀' },
  { name: 'Rice', category: 'pantry', emoji: '🍚' },
  { name: 'Pasta', category: 'pantry', emoji: '🍝' },
];

export default function PantryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [pantry, setPantry] = useState<PantryCategory[]>(INITIAL_PANTRY);
  const [searchInput, setSearchInput] = useState('');

  const addItemToPantry = (name: string, categoryId: string) => {
    const newItem: PantryItem = {
      id: Date.now().toString(),
      name,
      quantity: 1,
      unit: 'qty',
    };

    const updated = pantry.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, items: [...cat.items, newItem] };
      }
      return cat;
    });

    setPantry(updated);
    setSearchInput('');
  };

  const updateQuantity = (categoryId: string, itemId: string, change: number) => {
    const updated = pantry.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item =>
            item.id === itemId
              ? { ...item, quantity: Math.max(0, item.quantity + change) }
              : item
          ),
        };
      }
      return cat;
    });
    setPantry(updated);
  };

  const deleteItem = (categoryId: string, itemId: string) => {
    const updated = pantry.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, items: cat.items.filter(item => item.id !== itemId) };
      }
      return cat;
    });
    setPantry(updated);
  };

  const totalItems = pantry.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Pantry</Text>
        <Text style={styles.headerSubtitle}>
          {totalItems} {totalItems === 1 ? 'item' : 'items'} stored
        </Text>
      </View>

      {/* Quick Access to This or That Game */}
      <TouchableOpacity 
        style={styles.gameAccessCard}
        onPress={() => router.push('/(tabs)/thisorthat')}
        activeOpacity={0.85}
      >
        <FontAwesome name="gamepad" size={24} color="#2e4053" />
        <RNView style={styles.gameAccessText}>
          <Text style={styles.gameAccessTitle}>Play This or That</Text>
          <Text style={styles.gameAccessSubtitle}>Get recipe ideas based on your pantry</Text>
        </RNView>
        <FontAwesome name="chevron-right" size={18} color="#2e4053" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Search / Add Item */}
        <View style={styles.searchSection}>
          <View style={styles.searchInputContainer}>
            <FontAwesome name="search" size={16} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Add ingredient..."
              value={searchInput}
              onChangeText={setSearchInput}
              placeholderTextColor="#999"
            />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={() => setSearchInput('')}>
                <FontAwesome name="times-circle" size={16} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Add Buttons */}
        <View style={styles.quickAddSection}>
          <Text style={styles.sectionLabel}>Quick Add</Text>
          <View style={styles.quickAddGrid}>
            {COMMON_ITEMS.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.quickAddBtn}
                onPress={() => addItemToPantry(item.name, item.category)}
              >
                <Text style={styles.quickAddEmoji}>{item.emoji}</Text>
                <Text style={styles.quickAddLabel}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pantry Categories */}
        {pantry.map(category => (
          <View key={category.id} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>
              {category.category} ({category.items.length})
            </Text>

            {category.items.length === 0 ? (
              <Text style={styles.emptyState}>No items yet</Text>
            ) : (
              category.items.map(item => (
                <View key={item.id} style={styles.itemRow}>
                  <RNView style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQuantity}>
                      {item.quantity} {item.unit}
                    </Text>
                  </RNView>

                  <RNView style={styles.itemControls}>
                    <TouchableOpacity
                      style={styles.quantityBtn}
                      onPress={() => updateQuantity(category.id, item.id, -1)}
                    >
                      <FontAwesome name="minus" size={12} color="#2e4053" />
                    </TouchableOpacity>

                    <Text style={styles.quantityDisplay}>{item.quantity}</Text>

                    <TouchableOpacity
                      style={styles.quantityBtn}
                      onPress={() => updateQuantity(category.id, item.id, 1)}
                    >
                      <FontAwesome name="plus" size={12} color="#2e4053" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteItem(category.id, item.id)}
                    >
                      <FontAwesome name="trash" size={14} color="#e74c3c" />
                    </TouchableOpacity>
                  </RNView>
                </View>
              ))
            )}
          </View>
        ))}
      </ScrollView>

      {/* Find Meals CTA */}
      {totalItems > 0 && (
        <View style={styles.bottomCtaContainer}>
          <TouchableOpacity style={styles.findMealsBtn} activeOpacity={0.9}>
            <Text style={styles.findMealsBtnText}>Find Meals with My Pantry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f6fd',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2e4053',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  gameAccessCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#b49221',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gameAccessText: {
    flex: 1,
  },
  gameAccessTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2e4053',
  },
  gameAccessSubtitle: {
    fontSize: 12,
    color: '#2e4053',
    opacity: 0.7,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#2e4053',
  },
  quickAddSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e4053',
    marginBottom: 12,
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAddBtn: {
    width: '32%',
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    alignItems: 'center',
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  quickAddEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickAddLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2e4053',
  },
  categorySection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2e4053',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f1f6fd',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  quantityDisplay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e4053',
    minWidth: 20,
    textAlign: 'center',
  },
  deleteBtn: {
    padding: 6,
  },
  emptyState: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  bottomCtaContainer: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
  },
  findMealsBtn: {
    backgroundColor: '#2e4053',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  findMealsBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
