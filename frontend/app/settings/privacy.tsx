// app/settings/privacy.tsx — Settings → Privacy & data.

import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SettingsHeader, SettingsSection, settingsStyles as s } from '@/components/SettingsUI';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { deleteMyAccount, exportMyData } from '@/lib/accountApi';
import { useMyProfile } from '@/hooks/useMyProfile';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { preferences, settings, favorites, pantry, grocery, history, birthDate, mealPlan } = useApp();
  const { profile } = useMyProfile();

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = () =>
    exportMyData({ email: user?.email, profile, birthDate, preferences, settings, favorites, pantry, grocery, mealPlan, history })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not share your data'));

  const deleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount();
      // Clear what this phone saved for the account, then sign out.
      const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(`@bitewise/${user.id}/`));
      if (keys.length) await AsyncStorage.multiRemove(keys);
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete your account');
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <SettingsHeader title="Privacy & data" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <SettingsSection title="What BiteWise keeps">
          <View style={s.padded}>
            <Text style={s.message}>
              <Text style={{ fontWeight: '700', color: COLORS.textDark }}>On your account (Supabase): </Text>
              your email and password (encrypted), birthday (only you can see it; it decides whether
              recipes made with alcohol are shown), display name, profile photo, favorites, pantry, grocery
              list, chat messages and any recipes you share. Your pantry and list are also kept on this phone
              so they work offline.
            </Text>
            <Text style={s.message}>
              <Text style={{ fontWeight: '700', color: COLORS.textDark }}>On this phone only: </Text>
              your food preferences, allergies, meal plan, meal history and these settings.
            </Text>
            <Text style={s.message}>BiteWise doesn't sell your data or show ads.</Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Your data" footer="Shares a copy of your profile, preferences, favorites, pantry, grocery list and history as text you can save.">
          <View style={s.padded}>
            <TouchableOpacity style={s.button} onPress={download} accessibilityRole="button">
              <Text style={s.buttonText}>Download my data</Text>
            </TouchableOpacity>
          </View>
        </SettingsSection>

        <SettingsSection
          title="Delete account"
          footer="Permanently deletes your login, profile, photo, favorites and chat messages. Recipes you shared stay for others, without your name. This can't be undone."
        >
          <View style={s.padded}>
            <Text style={s.message}>Type DELETE to confirm.</Text>
            <TextInput style={s.input} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters"
              placeholder="DELETE" placeholderTextColor={COLORS.inactiveGray} accessibilityLabel="Type DELETE to confirm" />
            <TouchableOpacity
              style={[s.button, s.dangerButton, (confirmText !== 'DELETE' || deleting) && { opacity: 0.5 }]}
              onPress={deleteAccount}
              disabled={confirmText !== 'DELETE' || deleting}
              accessibilityRole="button"
              accessibilityLabel="Permanently delete my account"
            >
              {deleting ? <ActivityIndicator color={COLORS.cardWhite} /> : <Text style={[s.buttonText, s.dangerButtonText]}>Delete my account</Text>}
            </TouchableOpacity>
            {error ? <Text style={s.error} accessibilityLiveRegion="assertive">{error}</Text> : null}
          </View>
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}
