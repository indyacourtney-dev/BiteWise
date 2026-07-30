import { StyleSheet, Platform } from 'react-native';
import { COLORS } from '../constants/Colors';

export const layoutStyles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: COLORS.lightBlueBg 
  },
  container: { 
    flex: 1, 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? 10 : 0 
  },
  titleContainer: { 
    alignItems: 'center', 
    marginVertical: 25 
  },
  headerText: { 
    fontFamily: 'PlayfairDisplay_600SemiBold', 
    fontSize: 34, 
    color: COLORS.darkNavy, 
    marginBottom: 4 
  },
  subtitleText: { 
    fontFamily: 'Inter_400Regular', 
    fontSize: 14, 
    color: '#5B6C80' 
  },
  primaryActionButton: { 
    backgroundColor: COLORS.yellowAccent, 
    borderRadius: 8, 
    height: 50, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 40, 
    elevation: 3 
  },
  buttonContent: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  starEmoji: { 
    fontSize: 14, 
    marginRight: 8 
  },
  actionButtonText: { 
    fontFamily: 'Inter_700Bold', 
    fontSize: 14, 
    color: COLORS.darkNavy 
  }
});