import React from 'react';
import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { QUICK_ADDS } from '../constants/pantryData';
import { componentStyles } from '../styles/componentStyles';

// Props for quick-add row: callback when a badge is tapped
interface QuickAddRowProps {
  onAddItem: (name: string, category: string, unit: string) => void;
}

// Horizontal scrollable row of common item badges for fast adding
export default function QuickAddRow({ onAddItem }: QuickAddRowProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={componentStyles.quickAddRow}>
      {QUICK_ADDS.map((item) => (
        <TouchableOpacity 
          key={item.id} 
          style={componentStyles.quickAddPill} 
          onPress={() => onAddItem(item.name, item.category, item.unit)}
        >
          {/* Badge label with emoji and name */}
          <Text style={componentStyles.pillText}>{item.icon}  {item.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}