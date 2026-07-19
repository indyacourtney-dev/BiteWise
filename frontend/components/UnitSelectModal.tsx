import React from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { AVAILABLE_UNITS } from '../constants/pantryData';
import { modalStyles } from '../styles/modalStyles';

// Props for unit selection modal
interface UnitSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectUnit: (unit: string) => void;
}

// Modal presenting a list of units; selecting one calls `onSelectUnit`
export default function UnitSelectModal({ visible, onClose, onSelectUnit }: UnitSelectModalProps) {
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={modalStyles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={modalStyles.modalContent}>
              <Text style={modalStyles.modalTitle}>Select Unit</Text>
              
              {/* List available units as selectable rows */}
              {AVAILABLE_UNITS.map((unit) => (
                <TouchableOpacity key={unit} style={modalStyles.modalOption} onPress={() => onSelectUnit(unit)}>
                  <Text style={modalStyles.modalOptionText}>{unit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}