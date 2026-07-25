// styles/thisOrThatStyles.ts
import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/pantryData';

export const thisOrThatStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkNavy,
    opacity: 0.5,
    marginBottom: 8,
  },
  prompt: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkNavy,
    marginBottom: 20,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionButton: {
    flex: 1,
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  orDivider: {
    width: 36,
    alignItems: 'center',
  },
  orText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkNavy,
    opacity: 0.4,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 8,
  },
  skipText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkNavy,
    opacity: 0.6,
  },
});
