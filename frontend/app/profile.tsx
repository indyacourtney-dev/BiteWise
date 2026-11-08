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
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Avatar from '@/components/Avatar';
import { SettingsHeader, SettingsRow, SettingsSection, settingsStyles } from '@/components/SettingsUI';
import { Pill } from '@/components/ui';
import { COLORS } from '@/constants/Colors';
import { ALLERGEN_OPTIONS, CUISINE_OPTIONS, DIETARY_OPTIONS, MORE_ALLERGEN_OPTIONS, TASTE_OPTIONS, tasteIdsForTags } from '@/constants/preferenceOptions';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { configured } from '@/lib/supabase';
import { removeAvatar, uploadAvatar } from '@/lib/accountApi';
import { setMyProfileCache, useMyProfile } from '@/hooks/useMyProfile';
import { ageOn } from '@/utils/age';
import { FOCUS_INFO, GOAL_LABELS, dailyTargets, formatHeight, formatWeight, isCompleteGoals } from '@/utils/goals';
import { GOAL_ICONS } from '@/constants/goalIcons';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { preferences, settings, favorites, birthDate } = useApp();
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

  // "Your tastes" at a glance. Never = hard rules; Loves / Less often = soft.
  const allergenLabel = (k: string) => [...ALLERGEN_OPTIONS, ...MORE_ALLERGEN_OPTIONS].find(o => o.key === k)?.label ?? k;
  const never = [
    ...preferences.avoidAllergens.map(allergenLabel),
    ...(preferences.customAllergies ?? []),
    ...preferences.dietary.map(d => DIETARY_OPTIONS.find(o => o.key === d)?.label ?? d.replace(/-/g, ' ')),
    ...(preferences.customAvoid ?? []),
  ];
  const loves = [
    ...tasteIdsForTags(preferences.favoriteTags).map(id => TASTE_OPTIONS.find(o => o.id === id)?.label ?? id),
    ...preferences.cuisines.map(c => CUISINE_OPTIONS.find(o => o.id === c || o.label === c)?.label ?? c),
    ...(preferences.customLoves ?? []),
  ];
  const lessOften = tasteIdsForTags(preferences.dislikedTags).map(id => TASTE_OPTIONS.find(o => o.id === id)?.label ?? id);
  const spice = preferences.spiceTolerance ? `Spice: ${preferences.spiceTolerance}` : null;
  const goalDaily = isCompleteGoals(preferences.goals) ? dailyTargets(preferences.goals, birthDate ? ageOn(birthDate) : 30) : null;

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
            <Avatar url={profile?.avatarUrl} emoji={profile?.avatarEmoji} size={72} label="Your profile photo" />
            <View style={styles.cameraBadge}>
              {busy ? <ActivityIndicator color={COLORS.darkNavy} size="small" /> : <Text style={styles.cameraIcon}>📷</Text>}
            </View>
          </TouchableOpacity>
          <View style={styles.heroText}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email} numberOfLines={1}>
              {[user?.email, preferences.householdSize === 1 ? 'cooking for 1' : `cooking for ${preferences.householdSize}`].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        {error ? <Text style={[settingsStyles.error, styles.center]}>{error}</Text> : null}

        {/* Your tastes at a glance */}
        <View style={styles.tastes}>
          <View style={styles.tastesHead}>
            <Text style={styles.tastesTitle}>Your tastes</Text>
            <TouchableOpacity onPress={() => router.push('/settings/preferences')} accessibilityRole="button" accessibilityLabel="Change your tastes">
              <Text style={styles.tastesChange}>Change</Text>
            </TouchableOpacity>
          </View>
          <TasteRow label="Never" tone="red" items={never} empty="Nothing ruled out" />
          <TasteRow label="Loves" tone="green" items={loves} empty="Tell us what you enjoy" />
          <TasteRow label="Less often" tone="muted" items={[...lessOften, ...(spice ? [spice] : [])]} empty="Nothing to go easy on" />
          <Text style={styles.tastesNote}>“Never” is a hard rule. “Less often” still comes up now and then — the app learns from what you cook.</Text>
        </View>

        {/* Your goal (optional) */}
        {goalDaily && preferences.goals ? (
          <TouchableOpacity style={styles.goalCard} onPress={() => router.push('/settings/goals')} accessibilityRole="button" accessibilityLabel="Change your goal">
            <View style={styles.goalIcon}><FontAwesome name={GOAL_ICONS[preferences.goals.goal]} size={16} color={COLORS.darkNavy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalTitle}>{GOAL_LABELS[preferences.goals.goal]}</Text>
              <Text style={styles.goalLine}>~{goalDaily.calories.toLocaleString('en-US')} cal · {goalDaily.protein} g protein a day · {formatHeight(preferences.goals.heightCm, preferences.goals.units)} · {formatWeight(preferences.goals.weightKg, preferences.goals.units)}</Text>
              <Text style={styles.goalNote}>
                {preferences.goals.focuses?.length ? `Also: ${preferences.goals.focuses.map(f => FOCUS_INFO[f].label.toLowerCase()).join(', ')}` : 'Picks and portion tips lean this way.'}
              </Text>
            </View>
            <Text style={styles.tastesChange}>Change</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.goalCard, styles.goalCardEmpty]} onPress={() => router.push('/settings/goals')} accessibilityRole="button">
            <View style={styles.goalIcon}><FontAwesome name="heartbeat" size={16} color={COLORS.darkNavy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalTitle}>Set a fitness goal</Text>
              <Text style={styles.goalLine}>Lose weight, gain muscle or stay put — meal picks and portions follow. Optional.</Text>
            </View>
            <FontAwesome name="chevron-right" size={13} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}

        <SettingsSection title="Account">
          <SettingsRow icon="user" label="Name, email & password" onPress={() => router.push('/settings/account')} last />
        </SettingsSection>

        <SettingsSection title="Food">
          <SettingsRow icon="cutlery" label="Food preferences" value={spice ?? undefined} onPress={() => router.push('/settings/preferences')} />
          <SettingsRow icon="heart" label="Saved recipes" value={String(favorites.length)} onPress={() => router.push('/favorites')} last />
        </SettingsSection>

        <SettingsSection title="App">
          <SettingsRow icon="universal-access" label="Accessibility" value={textSizeLabel} onPress={() => router.push('/settings/accessibility')} />
          <SettingsRow icon="lock" label="Privacy & data" onPress={() => router.push('/settings/privacy')} last />
        </SettingsSection>

        <SettingsSection title="Help" footer={`BiteWise ${Constants.expoConfig?.version ?? ''} · ${Platform.OS}`}>
          <SettingsRow icon="question-circle" label="Help & how it works" onPress={() => router.push('/help')} />
          <SettingsRow icon="play-circle" label="Take the tour again" onPress={() => router.push('/tour')} />
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

function TasteRow({ label, tone, items, empty }: { label: string; tone: 'red' | 'green' | 'muted'; items: string[]; empty: string }) {
  const color = { red: COLORS.redText, green: COLORS.green, muted: COLORS.textMuted }[tone];
  const pillTone = { red: 'red' as const, green: 'green' as const, muted: 'blue' as const }[tone];
  const unique = Array.from(new Set(items)).slice(0, 8);
  return (
    <View style={styles.tasteRow}>
      <Text style={[styles.tasteLabel, { color }]}>{label}</Text>
      <View style={styles.tastePills}>
        {unique.length === 0
          ? <Text style={styles.tasteEmpty}>{empty}</Text>
          : unique.map(t => <Pill key={t} label={t} tone={pillTone} />)}
        {items.length > 8 ? <Text style={styles.tasteEmpty}>+{items.length - 8} more</Text> : null}
      </View>
    </View>
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 8 },
  heroText: { flex: 1, gap: 2 },
  goalCard: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardWhite, borderRadius: 18, borderWidth: 1, borderColor: COLORS.borderLight, padding: 14 },
  goalCardEmpty: { backgroundColor: COLORS.lightYellow, borderColor: COLORS.yellowBorder },
  goalIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.goldYellow, alignItems: 'center', justifyContent: 'center' },
  goalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  goalLine: { fontSize: 12.5, lineHeight: 17, color: COLORS.textMuted, marginTop: 2 },
  goalNote: { fontSize: 11.5, color: COLORS.textGold, fontWeight: '600', marginTop: 3 },
  tastes: { marginTop: 18, backgroundColor: COLORS.cardWhite, borderRadius: 18, borderWidth: 1, borderColor: COLORS.borderLight, padding: 16, gap: 12 },
  tastesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tastesTitle: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  tastesChange: { fontSize: 13, fontWeight: '700', color: COLORS.textGold },
  tasteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tasteLabel: { width: 72, fontSize: 12, fontWeight: '700', paddingTop: 5 },
  tastePills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tasteEmpty: { fontSize: 12, color: COLORS.textMuted, paddingTop: 4 },
  tastesNote: { fontSize: 12, lineHeight: 17, color: COLORS.textMuted },
  cameraBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.goldYellow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.background,
  },
  cameraIcon: { fontSize: 15 },
  name: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: COLORS.darkNavy },
  email: { fontSize: 13, color: COLORS.textMuted },
  center: { textAlign: 'center', marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,42,58,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 36 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy, textAlign: 'center', marginBottom: 8 },
  sheetBtn: { paddingVertical: 15, alignItems: 'center', borderRadius: 12, backgroundColor: COLORS.cardWhite, marginTop: 8 },
  sheetBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.darkNavy },
});
