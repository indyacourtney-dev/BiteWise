import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/Colors';

export const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    width: '80%',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: COLORS.darkNavy,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F3F4',
    alignItems: 'center',
  },
  modalOptionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.darkNavy,
  },

  // Matched State Layouts
  mealModalCard: {
    backgroundColor: COLORS.white,
    width: '85%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    elevation: 5,
  },
  closeModalCross: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  sparkleIconTop: {
    fontSize: 28,
    marginBottom: 8,
  },
  mealModalHeaderTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: COLORS.darkNavy,
    textAlign: 'center',
  },
  mealModalHeaderSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 20,
    textAlign: 'center',
  },
  outerRingVisual: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: COLORS.yellowAccent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEFDEB',
    marginBottom: 20,
  },
  ringBigNumber: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 40,
    color: COLORS.darkNavy,
    lineHeight: 40,
  },
  ringLabelTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: COLORS.darkNavy,
  },
  ringLabelSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#7F8C8D',
  },
  horizontalDividerModal: {
    width: '100%',
    height: 1,
    backgroundColor: '#EAECEE',
    marginBottom: 16,
  },
  ingredientStatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F9F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  leafIconLayout: {
    marginRight: 12,
  },
  ingredientSummaryMainText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: COLORS.darkNavy,
  },
  boldIngredientModalCount: {
    fontFamily: 'Inter_700Bold',
  },
  ingredientSummarySubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#7F8C8D',
  },
  modalSeeMealsButton: {
    backgroundColor: COLORS.darkNavy,
    width: '100%',
    height: 46,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  seeMealsButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: COLORS.white,
  },
  maybeLaterButtonLayout: {
    paddingVertical: 6,
  },
  maybeLaterTextStyles: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#7F8C8D',
  },
});