// app/auth.tsx
//
// The front door. Three modes on one screen:
//   login  — email + password
//   signup — username, email, password + confirm, with the guardrail
//            checklist turning green live as the user types
//   verify — "check your email" holding state after signup, with resend
//
// The gate in app/_layout.tsx sends every logged-out user here, and the
// session is memory-only (lib/supabase.ts), so this is the first thing
// anyone sees on every single launch — by design.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import {
  validateEmail,
  validateUsername,
  validatePassword,
  passwordChecks,
} from '../utils/validation';

type Mode = 'login' | 'signup' | 'verify';

export default function AuthScreen() {
  const { signIn, signUp, resendVerification, configured } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const checks = useMemo(() => passwordChecks(password), [password]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const handleLogin = async () => {
    setError(null);
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    if (!password) return setError('Password is required.');

    setBusy(true);
    try {
      await signIn({ email, password });
      // Success: the gate sees the session and routes onward.
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async () => {
    setError(null);
    const usernameErr = validateUsername(username);
    if (usernameErr) return setError(usernameErr);
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    const passwordErr = validatePassword(password);
    if (passwordErr) return setError(passwordErr);
    if (password !== confirm) return setError('Passwords don’t match.');

    setBusy(true);
    try {
      await signUp({ email, username, password });
      switchMode('verify');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setBusy(true);
    try {
      await resendVerification(email);
      setNotice('Verification email sent again — check spam too.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Setup warning so an unconfigured checkout fails loudly and
              helpfully instead of with a network error. */}
          {!configured && (
            <View style={styles.configBox}>
              <FontAwesome name="wrench" size={14} color="#8C5A0B" />
              <Text style={styles.configText}>
                Auth backend isn’t configured yet. Open frontend/lib/supabase.ts and
                paste the project keys — steps are in SETUP-AUTH.md.
              </Text>
            </View>
          )}

          {/* ================= VERIFY ================= */}
          {mode === 'verify' ? (
            <View style={styles.verifyWrap}>
              <Text style={styles.verifyEmoji}>{'📫'}</Text>
              <Text style={styles.h1Center}>Check your email</Text>
              <Text style={styles.subCenter}>
                We sent a verification link to{'\n'}
                <Text style={styles.bold}>{email.trim().toLowerCase()}</Text>
                {'\n\n'}Tap the link, then come back and log in.
              </Text>

              {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity style={styles.primaryBtn} onPress={() => switchMode('login')} activeOpacity={0.9}>
                <Text style={styles.primaryBtnText}>Go to login</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={handleResend} disabled={busy} activeOpacity={0.7}>
                <Text style={styles.linkText}>Resend the email</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.h1}>
                {mode === 'login' ? 'Welcome back 👋' : 'Create your account'}
              </Text>
              <Text style={styles.sub}>
                {mode === 'login'
                  ? 'Log in to get cooking.'
                  : 'One quick account so your pantry and tastes follow you.'}
              </Text>

              {/* ---- USERNAME (signup only) ---- */}
              {mode === 'signup' && (
                <>
                  <Text style={styles.fieldLabel}>Username</Text>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="3–20 letters, numbers, underscores"
                    placeholderTextColor={COLORS.inactiveGray}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              {/* ---- EMAIL ---- */}
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@school.edu"
                placeholderTextColor={COLORS.inactiveGray}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* ---- PASSWORD ---- */}
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'signup' ? 'Make it strong' : 'Your password'}
                  placeholderTextColor={COLORS.inactiveGray}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <FontAwesome
                    name={showPassword ? 'eye-slash' : 'eye'}
                    size={17}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* ---- LIVE GUARDRAIL CHECKLIST (signup only) ---- */}
              {mode === 'signup' && (
                <View style={styles.checklist}>
                  {checks.map(c => (
                    <View key={c.label} style={styles.checkRow}>
                      <FontAwesome
                        name={c.ok ? 'check-circle' : 'circle-o'}
                        size={14}
                        color={c.ok ? '#2E9E5B' : COLORS.inactiveGray}
                      />
                      <Text style={[styles.checkText, c.ok && styles.checkTextOk]}>
                        {c.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* ---- CONFIRM (signup only) ---- */}
              {mode === 'signup' && (
                <>
                  <Text style={styles.fieldLabel}>Confirm password</Text>
                  <TextInput
                    style={styles.input}
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Type it again"
                    placeholderTextColor={COLORS.inactiveGray}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {confirm.length > 0 && confirm !== password && (
                    <Text style={styles.mismatchText}>Passwords don’t match yet.</Text>
                  )}
                </>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* ---- SUBMIT ---- */}
              <TouchableOpacity
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
                onPress={mode === 'login' ? handleLogin : handleSignup}
                disabled={busy}
                activeOpacity={0.9}
              >
                {busy ? (
                  <ActivityIndicator color={COLORS.cardWhite} />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {mode === 'login' ? 'Log in' : 'Create account'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* ---- MODE TOGGLE ---- */}
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>
                  {mode === 'login'
                    ? 'New here? Create an account'
                    : 'Already have an account? Log in'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },

  brandRow: { alignItems: 'center', marginBottom: 6 },
  logo: { width: 230, height: 170 },
  brand: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.darkGold,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  h1: { fontSize: 28, fontWeight: '700', color: COLORS.darkNavy, lineHeight: 36 },
  h1Center: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.darkNavy,
    textAlign: 'center',
    marginTop: 12,
  },
  sub: { fontSize: 15, color: COLORS.textMuted, marginTop: 8, marginBottom: 22, lineHeight: 22 },
  subCenter: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginTop: 12,
    lineHeight: 23,
    textAlign: 'center',
  },
  bold: { fontWeight: '700', color: COLORS.darkNavy },

  configBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#FFF7E6',
    borderWidth: 1,
    borderColor: COLORS.goldYellow,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  configText: { flex: 1, fontSize: 13, color: '#8C5A0B', lineHeight: 18 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkNavy,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.darkNavy,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyeBtn: {
    width: 48,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  checklist: { marginTop: 12, gap: 7 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkText: { fontSize: 13, color: COLORS.textMuted },
  checkTextOk: { color: '#2E9E5B', fontWeight: '600' },

  mismatchText: { fontSize: 12, color: COLORS.redAccent, marginTop: 8 },
  errorText: {
    fontSize: 13,
    color: COLORS.redAccent,
    marginTop: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  noticeText: { fontSize: 13, color: '#2E9E5B', marginTop: 14, fontWeight: '600', textAlign: 'center' },

  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.darkNavy,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 22,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: COLORS.cardWhite, fontSize: 16, fontWeight: '700' },

  linkBtn: { alignItems: 'center', paddingVertical: 16 },
  linkText: { fontSize: 14, color: COLORS.darkGold, fontWeight: '700' },

  verifyWrap: { alignItems: 'center' },
  verifyEmoji: { fontSize: 56 },
});
