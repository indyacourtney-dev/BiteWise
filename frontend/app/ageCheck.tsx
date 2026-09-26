// app/ageCheck.tsx — one-time birthday check for accounts made before the
// age safeguard existed. New accounts do this as onboarding step 0.
// The root gate (app/_layout.tsx) sends people here until a birthday is
// saved, and it can't be swiped away.

import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import BirthdayForm from '@/components/BirthdayForm';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';

export default function AgeCheckScreen() {
  const router = useRouter();
  const { birthDate } = useApp();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>BiteWise</Text>
          <Text style={styles.h1} accessibilityRole="header">
            One quick thing
          </Text>
          <Text style={styles.sub}>We added an age check. Tell us your birthday once and you're all set.</Text>
          <BirthdayForm />
          {birthDate ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/')} accessibilityRole="button">
              <Text style={styles.primaryText}>Continue</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  brand: { fontSize: 14, fontWeight: '800', color: COLORS.darkGold, marginBottom: 6 },
  h1: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 30, color: COLORS.darkNavy },
  sub: { fontSize: 15, color: COLORS.textMuted, marginTop: 8, marginBottom: 20, lineHeight: 22 },
  primaryBtn: {
    alignItems: 'center',
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
  },
  primaryText: { color: COLORS.cardWhite, fontSize: 16, fontWeight: '700' },
});
