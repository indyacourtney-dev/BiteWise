// frontend/app/(tabs)/pantry.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFonts, PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { COLORS } from '../../constants/Colors';
import { SUGGESTION_LIBRARY, INITIAL_CATEGORIES, MOCK_MEALS } from '../../constants/pantryData';
import { layoutStyles } from '../../styles/layoutStyles';
import { inputStyles } from '../../styles/inputStyles';
import { componentStyles } from '../../styles/componentStyles';
import { mealCardStyles } from '../../styles/mealCardStyles';

import QuickAddRow from '../../components/QuickAddRow';
import CategoryCard from '../../components/CategoryCard';
import UnitSelectModal from '../../components/UnitSelectModal';
import MatchedStatsModal from '../../components/MatchedStatsModal';
import MealDisplayCard from '../../components/MealDisplayCard';

interface ActiveEditState {
  categoryId: string;
  itemId: string;
}

// Renamed from `pantry` to `Pantry`. The old lowercase name was shadowed
// by the `pantry` state variable inside the component body, and React
// expects component names to be capitalized.
export default function Pantry() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  /* --- STATE MANAGEMENT --- */
  const [currentView, setCurrentView] = useState<'pantry' | 'meals'>('pantry');
  const [pantry, setPantry] = useState(INITIAL_CATEGORIES);
  const [searchVal, setSearchVal] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showAllMeals, setShowAllMeals] = useState(false);

  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [mealModalVisible, setMealModalVisible] = useState(false);
  const [activeItemToEdit, setActiveItemToEdit] = useState<ActiveEditState | null>(null);
  const [dynamicStats, setDynamicStats] = useState({ mealsCount: 0, ingredientsCount: 0 });

  if (!fontsLoaded) return null;

  /* --- HANDLER FUNCTIONS --- */

  // Collapse/expand category sections
  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  // Monitor input changes and filter suggestions from library
  const handleTextChange = (text: string) => {
    setSearchVal(text);
    const trimmed = text.trim().toLowerCase();

    if (trimmed.length > 0) {
      const matched = SUGGESTION_LIBRARY.filter(item => item.name.toLowerCase().startsWith(trimmed));
      setFilteredSuggestions(matched);
    } else {
      setFilteredSuggestions([]);
    }
  };

  // Add new item to pantry with smart category/unit detection
  const handleAddItem = (name: string, overrideCategory?: string, overrideUnit?: string) => {
    if (!name.trim()) return;
    let targetCategory = overrideCategory;
    let targetUnit = overrideUnit || "Items";

    if (!targetCategory) {
      const matchedLibraryItem = SUGGESTION_LIBRARY.find(
        libItem => libItem.name.toLowerCase() === name.trim().toLowerCase()
      );

      if (matchedLibraryItem) {
        targetCategory = matchedLibraryItem.category;
        targetUnit = matchedLibraryItem.unit;
      } else {
        const lowerName = name.toLowerCase();

        if (lowerName.includes('milk') || lowerName.includes('cheese') || lowerName.includes('cream') || lowerName.includes('egg') || lowerName.includes('mayo') || lowerName.includes('sour cream')) {
          targetCategory = "Dairy / Refrigerated";
        } else if (lowerName.includes('chicken') || lowerName.includes('beef') || lowerName.includes('steak')) {
          targetCategory = "Proteins";
          targetUnit = "Lbs";
        } else if (lowerName.includes('cookie') || lowerName.includes('mix') || lowerName.includes('pasta') || lowerName.includes('buttermilk')) {
          targetCategory = "Pantry / Dry Goods";
        } else {
          targetCategory = "Produce";
        }
      }
    }

    const newItem = { id: Date.now().toString(), name: name.trim(), quantity: 1, unit: targetUnit };

    const updated = pantry.map(cat => {
      if (cat.category_name === targetCategory) {
        const itemExists = cat.items.some(
          existing => existing.name.toLowerCase() === name.toLowerCase().trim()
        );
        if (itemExists) return cat;

        const updatedItems = [...cat.items, newItem];
        return { ...cat, items: updatedItems, count: updatedItems.length };
      }
      return cat;
    });

    setPantry(updated);
    setSearchVal('');
    setFilteredSuggestions([]);
  };

  // Adjust quantity of an item, floored at zero
  const updateQuantity = (categoryId: string, itemId: string, amount: number) => {
    const updated = pantry.map(cat => {
      if (cat.id === categoryId) {
        const updatedItems = cat.items.map(item => {
          if (item.id === itemId) return { ...item, quantity: Math.max(0, item.quantity + amount) };
          return item;
        });
        return { ...cat, items: updatedItems };
      }
      return cat;
    });
    setPantry(updated);
  };

  // Change the unit of the selected item and close the modal
  const changeItemUnit = (unit: string) => {
    if (!activeItemToEdit) return;
    const { categoryId, itemId } = activeItemToEdit;
    const updated = pantry.map(cat => {
      if (cat.id === categoryId) {
        const updatedItems = cat.items.map(item => {
          if (item.id === itemId) return { ...item, unit };
          return item;
        });
        return { ...cat, items: updatedItems };
      }
      return cat;
    });
    setPantry(updated);
    setUnitModalVisible(false);
    setActiveItemToEdit(null);
  };

  // Remove an item from the pantry
  const deleteItem = (categoryId: string, itemId: string) => {
    const updated = pantry.map(cat => {
      if (cat.id === categoryId) {
        const filteredItems = cat.items.filter(item => item.id !== itemId);
        return { ...cat, items: filteredItems, count: filteredItems.length };
      }
      return cat;
    });
    setPantry(updated);
  };

  // Count usable ingredients and open the stats modal
  const triggerFindMeals = () => {
    let totalIngredients = 0;
    pantry.forEach(category => {
      category.items.forEach(item => {
        if (item.quantity > 0) totalIngredients += 1;
      });
    });

    const derivedMeals = totalIngredients === 0 ? 0 : Math.max(1, Math.round(totalIngredients * 1.5));
    setDynamicStats({ mealsCount: derivedMeals, ingredientsCount: totalIngredients });
    setMealModalVisible(true);
  };

  // Total items on hand — used to tailor the This or That prompt
  const totalOnHand = pantry.reduce(
    (sum, cat) => sum + cat.items.filter(i => i.quantity > 0).length,
    0
  );

  // ==================================================
  // VIEW RENDER LAYER: RECIPE SUGGESTIONS DASHBOARD
  // ==================================================
  if (currentView === 'meals') {
    const totalMealsToDisplay = dynamicStats.mealsCount || MOCK_MEALS.length;
    const liveMeals = Array.from({ length: totalMealsToDisplay }, (_, index) => {
      const mockItem = MOCK_MEALS[index % MOCK_MEALS.length];
      return { ...mockItem, id: `${mockItem.id}-${index}` };
    });

    const INITIAL_DISPLAY_LIMIT = 4;
    const visibleMeals = showAllMeals
      ? liveMeals
      : liveMeals.slice(0, Math.min(INITIAL_DISPLAY_LIMIT, totalMealsToDisplay));
    const remainingMealsCount = Math.max(0, liveMeals.length - INITIAL_DISPLAY_LIMIT);

    return (
      <SafeAreaView style={layoutStyles.safeArea}>
        <ScrollView style={mealCardStyles.mealsContainerWrapper} showsVerticalScrollIndicator={false}>
          <View style={mealCardStyles.mealsHeaderContainer}>
            <TouchableOpacity
              style={mealCardStyles.closeViewCrossIcon}
              onPress={() => { setShowAllMeals(false); setCurrentView('pantry'); }}
            >
              <Feather name="x" size={15} color={COLORS.darkNavy} />
            </TouchableOpacity>
            <View style={mealCardStyles.mealsHeaderRow}>
              <Text style={mealCardStyles.headerSparkleIcon}>✨</Text>
              <Text style={mealCardStyles.mealsMainHeadingTitle}>Meals You Can Make</Text>
            </View>
            <Text style={mealCardStyles.mealsSubheadingText}>
              {liveMeals.length} {liveMeals.length === 1 ? 'meal' : 'meals'} you can make with ingredients in your pantry.
            </Text>
            {liveMeals.length > 0 && (
              <Text style={mealCardStyles.mealsHighlightWarning}>
                You can use up to <Text style={{ fontWeight: 'bold' }}>{dynamicStats.ingredientsCount} ingredients in your pantry</Text>
              </Text>
            )}
          </View>

          <View style={mealCardStyles.mealsCardsContainerList}>
            {visibleMeals.map((meal) => (
              <MealDisplayCard
                key={meal.id}
                meal={meal}
                dynamicIngredientsCount={dynamicStats.ingredientsCount}
              />
            ))}
          </View>

          <View style={mealCardStyles.mealsFooterActionsLayout}>
            {liveMeals.length > INITIAL_DISPLAY_LIMIT && !showAllMeals && (
              <TouchableOpacity
                style={mealCardStyles.seeFullListOutlineButton}
                onPress={() => setShowAllMeals(true)}
              >
                <Text style={mealCardStyles.seeFullListTextBtnStyles}>
                  See Full List (+{remainingMealsCount} more)
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={mealCardStyles.goBackTextLinkAction}
              onPress={() => { setShowAllMeals(false); setCurrentView('pantry'); }}
            >
              <Text style={mealCardStyles.goBackToPantryLinkText}>Go Back to Pantry</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =============================================
  // VIEW RENDER LAYER: STANDARD PANTRY INVENTORY
  // =============================================
  return (
    <SafeAreaView style={layoutStyles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={layoutStyles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Header */}
          <View style={layoutStyles.titleContainer}>
            <Text style={layoutStyles.headerText}>My Pantry</Text>
            <Text style={layoutStyles.subtitleText}>Add what you have. We'll find meals.</Text>
          </View>

          {/* Search bar with autocomplete */}
          <View style={{ zIndex: 50, elevation: 50, position: 'relative' }}>
            <View style={inputStyles.searchBarContainer}>
              <Feather name="search" size={20} color={COLORS.darkNavy} style={inputStyles.searchIcon} />
              <TextInput
                style={inputStyles.searchInput}
                placeholder="Search or add ingredient..."
                placeholderTextColor="#7F8C8D"
                value={searchVal}
                onChangeText={handleTextChange}
                onSubmitEditing={() => handleAddItem(searchVal)}
              />

              {/* Voice search button */}
              <TouchableOpacity style={inputStyles.voiceButton}>
                <Feather name="mic" size={18} color={COLORS.darkNavy} />
              </TouchableOpacity>
            </View>

            {/* Filtered suggestions dropdown */}
            {filteredSuggestions.length > 0 && (
              <ScrollView
                style={inputStyles.suggestionsContainer}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {filteredSuggestions.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={inputStyles.suggestionRow}
                    onPress={() => handleAddItem(item.name, item.category, item.unit)}
                  >
                    <Text style={inputStyles.suggestionEmoji}>{item.icon}</Text>
                    <View>
                      <Text style={inputStyles.suggestionText}>{item.name}</Text>
                      <Text style={inputStyles.suggestionSubtext}>{item.category}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Quick add buttons for common items */}
          <View style={componentStyles.quickAddSection}>
            <Text style={componentStyles.sectionLabel}>Quick-Add</Text>
            <QuickAddRow onAddItem={(name, cat, unit) => handleAddItem(name, cat, unit)} />
            <Text style={componentStyles.captionText}>Tap a tag to add it to your pantry.</Text>
          </View>

          {/* Category cards with expandable items */}
          <View style={componentStyles.listContainer}>
            {pantry.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                isCollapsed={!!collapsedCategories[category.id]}
                onToggle={() => toggleCategory(category.id)}
                onUpdateQuantity={updateQuantity}
                onOpenUnitModal={(categoryId, itemId) => {
                  setActiveItemToEdit({ categoryId, itemId });
                  setUnitModalVisible(true);
                }}
                onDeleteItem={deleteItem}
              />
            ))}
          </View>

          {/* Primary CTA — meal suggestions from the pantry */}
          <TouchableOpacity style={layoutStyles.primaryActionButton} onPress={triggerFindMeals}>
            <View style={layoutStyles.buttonContent}>
              <Text style={layoutStyles.actionButtonText}>Find Meals with My Pantry</Text>
            </View>
          </TouchableOpacity>

          {/* Secondary path — send them to the quiz instead.
              Uses inline styles so it doesn't depend on new style-sheet keys. */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              marginTop: 8,
              marginBottom: 24,
              marginHorizontal: 20,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: COLORS.goldYellow,
            }}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/thisorthat')}
          >
            <Feather name="shuffle" size={16} color={COLORS.darkNavy} />
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 14,
                color: COLORS.darkNavy,
              }}
            >
              {totalOnHand > 0
                ? 'Not sure? Play This or That'
                : 'Nothing in your pantry? Play This or That'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Unit selection modal */}
      <UnitSelectModal
        visible={unitModalVisible}
        onClose={() => setUnitModalVisible(false)}
        onSelectUnit={changeItemUnit}
      />

      {/* Initial meal count modal before navigating to meals view */}
      <MatchedStatsModal
        visible={mealModalVisible}
        stats={dynamicStats}
        onClose={() => setMealModalVisible(false)}
        onConfirm={() => { setMealModalVisible(false); setCurrentView('meals'); }}
      />
    </SafeAreaView>
  );
}
