// app/_layout.tsx
//
// ROOT layout. This is a Stack, not a Tabs.
//
// The previous version put <Tabs> here and listed screens named "index"
// and "two" that didn't exist, while the actual screens lived in
// app/(tabs)/. Expo Router had nothing to render, so the app opened on a
// "route not found" screen instead of Home.
//
// Correct structure:
//   app/_layout.tsx          → Stack (this file) — providers, fonts, splash
//   app/(tabs)/_layout.tsx   → Tabs — the bottom bar
//   app/(tabs)/index.tsx     → Home, and the very first screen in Expo Go
//
// Fonts are also loaded here rather than inside one screen. The styles
// files reference Inter and Playfair Display, and on iOS an unloaded
// font family throws instead of falling back — that was crashing every
// screen except Pantry, which happened to load them itself.

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { useColorScheme } from '@/components/useColorScheme';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <AppProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthAndOnboardingGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="auth" options={{ gestureEnabled: false }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              <Stack.Screen name="randomMeal" />
              <Stack.Screen name="recipe/[id]" />
              <Stack.Screen
                name="modal"
                options={{ presentation: 'modal', headerShown: true, title: 'About BiteWise' }}
              />
            </Stack>
          </AuthAndOnboardingGate>
        </ThemeProvider>
      </AppProvider>
    </AuthProvider>
  );
}

/**
 * The routing spine. In priority order:
 *   1. No session            → /auth (login is the first thing you see,
 *                              every launch — sessions are memory-only)
 *   2. Logged in, no setup   → /onboarding (once per account)
 *   3. Logged in + set up    → the app; /auth and /onboarding are
 *                              unreachable until they sign out
 * Signing out drops the session, and rule 1 bounces the user straight
 * back to the login screen.
 */
function AuthAndOnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const { hydrated, hasOnboarded } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const inAuth = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (!user) {
      if (!inAuth) router.replace('/auth');
      return;
    }
    if (!hydrated) return; // account data still loading from storage

    if (!hasOnboarded && !inOnboarding) {
      router.replace('/onboarding');
    } else if (hasOnboarded && (inAuth || inOnboarding)) {
      router.replace('/');
    }
  }, [initializing, user, hydrated, hasOnboarded, segments, router]);

  return <>{children}</>;
}
