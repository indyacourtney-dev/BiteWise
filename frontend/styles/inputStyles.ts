import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/pantryData';

export const inputStyles = StyleSheet.create({
  searchBarContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.white, 
    borderRadius: 8, 
    borderWidth: 1.5, 
    borderColor: '#D5DBDB', 
    height: 48, 
    paddingHorizontal: 12 
  },
  searchIcon: { 
    marginRight: 8 
  },
  searchInput: { 
    flex: 1, 
    fontFamily: 'Inter_400Regular', 
    fontSize: 14, 
    color: COLORS.darkNavy, 
    height: '100%' 
  },
  suggestionsContainer: { 
    position: 'absolute', 
    top: 52, 
    left: 0, 
    right: 0, 
    backgroundColor: COLORS.white, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#BDC3C7', 
    maxHeight: 204, 
    zIndex: 999, 
    elevation: 5 
  },
  suggestionRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F2F3F4' 
  },
  suggestionEmoji: { 
    fontSize: 18, 
    marginRight: 10 
  },
  suggestionText: { 
    fontFamily: 'Inter_600SemiBold', 
    fontSize: 13, 
    color: COLORS.darkNavy 
  },
  suggestionSubtext: { 
    fontFamily: 'Inter_400Regular', 
    fontSize: 10, 
    color: '#7F8C8D' 
  },
  voiceButton: { 
    padding: 4 
  }
});