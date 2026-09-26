// app/profile.tsx — Profile & settings (the 👤 button on Home).
//
// Tap the photo to take / choose / remove a profile picture (stored in
// Supabase Storage, shown in chat and on Home). Everything else lives in
// sub-pages under app/settings/.

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

import Avatar from '@/components/Avatar';
import { SettingsHeader, SettingsRow, SettingsSection, settingsStyles } from '@/components/SettingsUI';
import { COLORS } from '@/constants/Colors';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { configured } from '@/lib/supabase';
import { removeAvatar, uploadAvatar } from '@/lib/accountApi';
import { setMyProfileCache, useMyProfile } from '@/hooks/useMyProfile';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { preferences, settings, favorites } = useApp();
  const { profile } = useMyProfile();

  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = profile?.username || preferences.name || 'BiteWise cook';

  const pick = async (from: 'camera' | 'library') => {
    setSheet(false);
    setError(null);
    if (!user) return;
    try {
      const perm = from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(`BiteWise needs permission to use your ${from === 'camera' ? 'camera' : 'photos'}. You can allow it in your phone's Settings.`);
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6,
      };
      const result = from === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;

      setBusy(true);
      const asset = result.assets[0];
      const url = await uploadAvatar(user.id, asset.uri, asset.mimeType ?? 'image/jpeg');
      if (profile) setMyProfileCache({ ...profile, avatarUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your photo');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setSheet(false);
    if (!user) return;
    setBusy(true);
    try {
      await removeAvatar(user.id);
      if (profile) setMyProfileCache({ ...profile, avatarUrl: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove your photo');
    } finally {
      setBusy(false);
    }
  };

  const textSizeLabel = { 1: 'Default', 1.15: 'Large', 1.3: 'Larger', 1.5: 'Largest' }[settings.textScale];

  return (
    <SafeAreaView style={settingsStyles.safeArea} edges={['top']}>
      <SettingsHeader title="Profile & settings" />
      <ScrollView contentContainerStyle={[settingsStyles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        {/* Who you are */}
        <View style={styles.hero}>
          <TouchableOpacity
            onPress={() => (configured ? setSheet(true) : setError('Photos need the Supabase backend.'))}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={profile?.avatarUrl ? 'Change profile photo' : 'Add a profile photo'}
          >
            <Avatar url={profile?.avatarUrl} emoji={profile?.avatarEmoji} size={96} label="Your profile photo" />
            <View style={styles.cameraBadge}>
              {busy ? <ActivityIndicator color={COLORS.darkNavy} size="small" /> : <Text style={styles.cameraIcon}>📷</Text>}
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{displayName}</Text>
          {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
          <Text style={styles.stats}>❤️ {favorites.length} favorite{favorites.length === 1 ? '' : 's'}</Text>
          {error ? <Text style={[settingsStyles.error, styles.center]}>{error}</Text> : null}
        </View>

        <SettingsSection title="Account">
          <SettingsRow icon="user" label="Name, email & password" onPress={() => router.push('/settings/account')} last />
        </SettingsSection>

        <SettingsSection title="Food">
          <SettingsRow
            icon="cutlery"
            label="Food preferences"
            value={[
              preferences.avoidAllergens.length + (preferences.customAllergies?.length ?? 0) > 0 ? 'allergies set' : '',
              preferences.dietary.length ? `${preferences.dietary.length} diet${preferences.dietary.length === 1 ? '' : 's'}` : '',
            ].filter(Boolean).join(' · ') || undefined}
            onPress={() => router.push('/settings/preferences')}
            last
          />
        </SettingsSection>

        <SettingsSection title="App">
          <SettingsRow icon="universal-access" label="Accessibility" value={textSizeLabel} onPress={() => router.push('/settings/accessibility')} />
          <SettingsRow icon="lock" label="Privacy & data" onPress={() => router.push('/settings/privacy')} last />
        </SettingsSection>

        <SettingsSection title="About" footer={`BiteWise ${Constants.expoConfig?.version ?? ''} · ${Platform.OS}`}>
          <SettingsRow icon="info-circle" label="How BiteWise picks meals" onPress={() => router.push('/settings/about')} last />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow icon="sign-out" label="Sign out" onPress={signOut} danger last />
        </SettingsSection>
      </ScrollView>

      {/* Photo options */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setSheet(false)} accessibilityLabel="Close">
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Profile photo</Text>
            {Platform.OS !== 'web' ? (
              <SheetButton label="📸  Take photo" onPress={() => pick('camera')} />
            ) : null}
            <SheetButton label="🖼️  Choose from library" onPress={() => pick('library')} />
            {profile?.avatarUrl ? <SheetButton label="🗑️  Remove photo" onPress={remove} danger /> : null}
            <SheetButton label="Cancel" onPress={() => setSheet(false)} muted />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function SheetButton({ label, onPress, danger, muted }: { label: string; onPress: () => void; danger?: boolean; muted?: boolean }) {
  return (
    <TouchableOpacity style={styles.sheetBtn} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.sheetBtnText, danger && { color: COLORS.redAccent }, muted && { color: COLORS.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 8, gap: 4 },
  cameraBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.goldYellow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.background,
  },
  cameraIcon: { fontSize: 15 },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.darkNavy, marginTop: 10 },
  email: { fontSize: 14, color: COLORS.textMuted },
  stats: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  center: { textAlign: 'center', marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,42,58,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 36 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy, textAlign: 'center', marginBottom: 8 },
  sheetBtn: { paddingVertical: 15, alignItems: 'center', borderRadius: 12, backgroundColor: COLORS.cardWhite, marginTop: 8 },
  sheetBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.darkNavy },
});
