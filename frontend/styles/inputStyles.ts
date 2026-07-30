import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/Colors';

export const inputStyles = StyleSheet.create({
  searchBarContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.white, 
    borderRadius: 8, 
    borderWidth: 1.5, 
    borderColor: '#C7D8EC', 
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
    borderColor: '#A9BDD3', 
    maxHeight: 204, 
    zIndex: 999, 
    elevation: 5 
  },
  suggestionRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2EDFC' 
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
    color: '#5B6C80' 
  },
  voiceButton: { 
    padding: 4 
  }
});