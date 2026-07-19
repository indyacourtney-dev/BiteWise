import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/pantryData';
import { componentStyles } from '../styles/componentStyles';

// Props for a single pantry item row
interface PantryItemRowProps {
  item: { id: string; name: string; quantity: number; unit: string };
  categoryId: string;
  onUpdateQuantity: (catId: string, itemId: string, amt: number) => void;
  onOpenUnitModal: (catId: string, itemId: string) => void;
  onDeleteItem: (catId: string, itemId: string) => void;
}

// Renders one row inside a category: name, quantity controls, unit selector, delete
export default function PantryItemRow({ item, categoryId, onUpdateQuantity, onOpenUnitModal, onDeleteItem }: PantryItemRowProps) {
  return (
    <View style={componentStyles.itemRow}>
      {/* Item name */}
      <Text style={componentStyles.itemName}>{item.name}</Text>

      <View style={componentStyles.itemControls}>
        {/* Decrease quantity button */}
        <TouchableOpacity style={componentStyles.controlButton} onPress={() => onUpdateQuantity(categoryId, item.id, -1)}>
          <Text style={componentStyles.controlBtnText}>−</Text>
        </TouchableOpacity>

        {/* Current quantity */}
        <Text style={componentStyles.quantityText}>{item.quantity}</Text>

        {/* Increase quantity button */}
        <TouchableOpacity style={componentStyles.controlButton} onPress={() => onUpdateQuantity(categoryId, item.id, 1)}>
          <Text style={componentStyles.controlBtnText}>+</Text>
        </TouchableOpacity>

        {/* Unit selector opens modal to change unit */}
        <TouchableOpacity 
          style={componentStyles.unitSelector} 
          onPress={() => onOpenUnitModal(categoryId, item.id)}
        >
          <Text style={componentStyles.unitSelectorText}>{item.unit}</Text>
          <Feather name="chevron-down" size={10} color={COLORS.darkNavy} />
        </TouchableOpacity>

        {/* Delete item button */}
        <TouchableOpacity onPress={() => onDeleteItem(categoryId, item.id)}>
          <Feather name="trash-2" size={16} color={COLORS.redAccent} style={componentStyles.trashIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}