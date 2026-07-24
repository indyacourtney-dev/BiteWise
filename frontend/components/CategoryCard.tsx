import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/Colors';
import { componentStyles } from '../styles/componentStyles';
import PantryItemRow from './PantryItemRow';

// Props for the category card and its item actions
interface CategoryCardProps {
  category: { id: string; emoji: string; category_name: string; count: number; items: any[] };
  isCollapsed: boolean;
  onToggle: () => void;
  onUpdateQuantity: (catId: string, itemId: string, amt: number) => void;
  onOpenUnitModal: (catId: string, itemId: string) => void;
  onDeleteItem: (catId: string, itemId: string) => void;
}

// Display a pantry category with collapsible item rows
export default function CategoryCard({ category, isCollapsed, onToggle, onUpdateQuantity, onOpenUnitModal, onDeleteItem }: CategoryCardProps) {
  return (
    <View style={componentStyles.categoryCard}>
      <TouchableOpacity style={componentStyles.categoryHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={componentStyles.categoryTitleGroup}>
          <Text style={componentStyles.categoryEmoji}>{category.emoji}</Text>
          <Text style={componentStyles.categoryTitle}>{category.category_name} ({category.count})</Text>
        </View>
        {/* Show collapse/expand icon */}
        <Feather name={isCollapsed ? "chevron-down" : "chevron-up"} size={18} color={COLORS.darkNavy} />
      </TouchableOpacity>

      {/* Render item rows only when the category is expanded */}
      {!isCollapsed && category.items.map((item) => (
        <PantryItemRow
          key={item.id}
          item={item}
          categoryId={category.id}
          onUpdateQuantity={onUpdateQuantity}
          onOpenUnitModal={onOpenUnitModal}
          onDeleteItem={onDeleteItem}
        />
      ))}
    </View>
  );
}