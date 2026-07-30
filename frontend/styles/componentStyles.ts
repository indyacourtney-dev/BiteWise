import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/Colors';

export const componentStyles = StyleSheet.create({
  quickAddSection: { 
    marginTop: 20, 
    marginBottom: 25, 
    zIndex: 1 
  },
  sectionLabel: { 
    fontFamily: 'Inter_700Bold', 
    fontSize: 15, 
    color: COLORS.darkNavy, 
    marginBottom: 10 
  },
  quickAddRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  quickAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#D9E4F1',
  },
  pillText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.darkNavy,
  },
  captionText: { 
    fontFamily: 'Inter_400Regular', 
    fontSize: 11, 
    color: '#5B6C80' 
  },
  listContainer: { 
    marginBottom: 25 
  },
  categoryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#D9E4F1',
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EDF4FE',
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#D9E4F1',
  },
  categoryTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  categoryTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: COLORS.darkNavy,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2EDFC',
  },
  itemName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: COLORS.darkNavy,
    flex: 1,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: '#E2EDFC',
    width: 24,
    height: 24,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: COLORS.darkNavy,
  },
  quantityText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: COLORS.darkNavy,
    width: 24,
    textAlign: 'center',
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D8EC',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 8,
    marginRight: 12,
  },
  unitSelectorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: COLORS.darkNavy,
    marginRight: 4,
  },
  trashIcon: {
    padding: 4,
  },
});