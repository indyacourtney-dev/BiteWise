import React from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/pantryData';
import { modalStyles } from '../styles/modalStyles';

// Props for the meal-match modal
interface MatchedStatsModalProps {
  visible: boolean;
  stats: { mealsCount: number; ingredientsCount: number };
  onClose: () => void;
  onConfirm: () => void;
}

// Modal shown after meal matching is triggered
export default function MatchedStatsModal({ visible, stats, onClose, onConfirm }: MatchedStatsModalProps) {
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={modalStyles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={modalStyles.mealModalCard}>
              {/* Close button in top corner */}
              <TouchableOpacity style={modalStyles.closeModalCross} onPress={onClose}>
                <Feather name="x-circle" size={24} color={COLORS.darkNavy} />
              </TouchableOpacity>

              {/* Modal header text */}
              <Text style={modalStyles.sparkleIconTop}>✨</Text>
              <Text style={modalStyles.mealModalHeaderTitle}>We found meals</Text>
              <Text style={modalStyles.mealModalHeaderSub}>you can make with your pantry!</Text>

              {/* Summary of matched meals */}
              <View style={modalStyles.outerRingVisual}>
                <Text style={modalStyles.ringBigNumber}>{stats.mealsCount}</Text>
                <Text style={modalStyles.ringLabelTitle}>Meals</Text>
                <Text style={modalStyles.ringLabelSub}>you can make</Text>
              </View>

              <View style={modalStyles.horizontalDividerModal} />

              {/* Ingredient usage summary */}
              <View style={modalStyles.ingredientStatContainer}>
                <Feather name="check-square" size={18} color="#2ECC71" style={modalStyles.leafIconLayout} />
                <View>
                  <Text style={modalStyles.ingredientSummaryMainText}>
                    You'll use up to <Text style={modalStyles.boldIngredientModalCount}>{stats.ingredientsCount} Ingredients</Text>
                  </Text>
                  <Text style={modalStyles.ingredientSummarySubtext}>from your pantry</Text>
                </View>
              </View>

              {/* Button to proceed to meal suggestions */}
              <TouchableOpacity style={modalStyles.modalSeeMealsButton} onPress={onConfirm}>
                <Text style={modalStyles.seeMealsButtonText}>See Meals</Text>
              </TouchableOpacity>

              {/* Button to close modal without navigating */}
              <TouchableOpacity style={modalStyles.maybeLaterButtonLayout} onPress={onClose}>
                <Text style={modalStyles.maybeLaterTextStyles}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}