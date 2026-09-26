// app/settings/account.tsx — Settings → Name, email & password.

import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsHeader, SettingsSection, settingsStyles as s } from '@/components/SettingsUI';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { COLORS } from '@/constants/Colors';
import { formatBirthDate } from '@/utils/age';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { changeEmail, changePassword, updateDisplayName } from '@/lib/accountApi';
import { setMyProfileCache, useMyProfile } from '@/hooks/useMyProfile';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { preferences, updatePreferences, birthDate } = useApp();
  const { profile } = useMyProfile();

  const [name, setName] = useState(profile?.username || preferences.name || '');
  const [nameStatus, setNameStatus] = useState<Status>(null);
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<Status>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwStatus, setPwStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<'name' | 'email' | 'pw' | null>(null);

  const run = async (which: 'name' | 'email' | 'pw', fn: () => Promise<string>, set: (s: Status) => void) => {
    setBusy(which);
    set(null);
    try {
      set({ kind: 'ok', text: await fn() });
    } catch (e) {
      set({ kind: 'error', text: e instanceof Error ? e.message : 'Something went wrong' });
    } finally {
      setBusy(null);
    }
  };

  const saveName = () => run('name', async () => {
    if (!user) throw new Error('Not signed in');
    await updateDisplayName(user.id, name);
    updatePreferences({ name: name.trim() });
    if (profile) setMyProfileCache({ ...profile, username: name.trim() });
    return 'Saved. This is the name on Home and in chat.';
  }, setNameStatus);

  const saveEmail = () => run('email', async () => {
    if (email.trim().toLowerCase() === user?.email) throw new Error('That\'s already your email.');
    await changeEmail(email);
    setEmail('');
    return 'Check your inbox: we sent a confirmation link. Your email changes after you tap it '
      + '(Supabase may also ask you to confirm from your current address).';
  }, setEmailStatus);

  const savePassword = () => run('pw', async () => {
    if (next !== confirm) throw new Error('The new passwords don\'t match.');
    await changePassword(user?.email ?? '', current, next);
    setCurrent(''); setNext(''); setConfirm('');
    return 'Password changed.';
  }, setPwStatus);

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <SettingsHeader title="Account" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          <SettingsSection title="Display name" footer="Shown on Home, next to your chat messages, and on recipes you share.">
            <View style={s.padded}>
              <TextInput style={s.input} value={name} onChangeText={setName} maxLength={40}
                placeholder="Your name" placeholderTextColor={COLORS.inactiveGray} accessibilityLabel="Display name" />
              <Button label="Save name" onPress={saveName} busy={busy === 'name'} disabled={!name.trim()} />
              <StatusText status={nameStatus} />
            </View>
          </SettingsSection>

          <SettingsSection
            title="Birthday"
            footer="Locked once saved, because it decides whether recipes made with alcohol are shown (21+). If it's wrong, contact the BiteWise team."
          >
            <View style={[s.padded, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <FontAwesome name="lock" size={15} color={COLORS.textMuted} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.darkNavy }} accessibilityLabel={`Birthday ${birthDate ? formatBirthDate(birthDate) : 'not set'}, locked`}>
                {birthDate ? formatBirthDate(birthDate) : 'Not set yet'}
              </Text>
            </View>
          </SettingsSection>

          <SettingsSection title="Email" footer={`Current: ${user?.email ?? 'unknown'}`}>
            <View style={s.padded}>
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="New email address"
                placeholderTextColor={COLORS.inactiveGray} keyboardType="email-address" autoCapitalize="none"
                autoComplete="email" textContentType="emailAddress" accessibilityLabel="New email address" />
              <Button label="Change email" onPress={saveEmail} busy={busy === 'email'} disabled={!email.trim()} />
              <StatusText status={emailStatus} />
            </View>
          </SettingsSection>

          <SettingsSection title="Password" footer="At least 8 characters.">
            <View style={s.padded}>
              <TextInput style={s.input} value={current} onChangeText={setCurrent} placeholder="Current password"
                placeholderTextColor={COLORS.inactiveGray} secureTextEntry autoComplete="current-password"
                textContentType="password" accessibilityLabel="Current password" />
              <TextInput style={s.input} value={next} onChangeText={setNext} placeholder="New password"
                placeholderTextColor={COLORS.inactiveGray} secureTextEntry autoComplete="new-password"
                textContentType="newPassword" accessibilityLabel="New password" />
              <TextInput style={s.input} value={confirm} onChangeText={setConfirm} placeholder="Confirm new password"
                placeholderTextColor={COLORS.inactiveGray} secureTextEntry autoComplete="new-password"
                textContentType="newPassword" accessibilityLabel="Confirm new password" />
              <Button label="Change password" onPress={savePassword} busy={busy === 'pw'}
                disabled={!current || !next || !confirm} />
              <StatusText status={pwStatus} />
            </View>
          </SettingsSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Button({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[s.button, (disabled || busy) && { opacity: 0.5 }]} onPress={onPress}
      disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={label}>
      {busy ? <ActivityIndicator color={COLORS.darkNavy} /> : <Text style={s.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function StatusText({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <Text style={status.kind === 'ok' ? s.success : s.error} accessibilityLiveRegion="polite">
      {status.text}
    </Text>
  );
}
