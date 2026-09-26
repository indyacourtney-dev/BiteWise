// app/_layout.tsx — ROOT layout (Stack). Providers, fonts, splash, auth gate.

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
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
            {/*
              Only declare screens that need custom options.
              Every file/folder in app/ is auto-registered by Expo Router,
              so recipe/[id] doesn't strictly need an entry here —
              declaring routes whose files don't exist is what produced
              the "No route named X exists" warnings.
            */}
            <Stack screenOptions={{ headerShown: false }}>
              {/* auth ⇄ onboarding ⇄ tabs are replace() redirects from the
                  gate, so they fade — a sideways push animation looks wrong
                  for "you've been rerouted". */}
              <Stack.Screen
                name="auth"
                options={{ gestureEnabled: false, animation: 'fade' }}
              />
              <Stack.Screen
                name="onboarding"
                options={{ gestureEnabled: false, animation: 'fade' }}
              />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen
                name="ageCheck"
                options={{ gestureEnabled: false, animation: 'fade' }}
              />
              {/* Pushed screens keep the default slide-from-right + swipe back. */}
              <Stack.Screen name="cookWithPantry" />
              <Stack.Screen name="thisorthat" />
              <Stack.Screen name="planWeek" />
              <Stack.Screen name="recipe/[id]" />
              <Stack.Screen name="decide" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="settings/account" />
              <Stack.Screen name="settings/preferences" />
              <Stack.Screen name="settings/accessibility" />
              <Stack.Screen name="settings/privacy" />
              <Stack.Screen name="settings/about" />
              <Stack.Screen name="shareRecipe" options={{ presentation: 'modal' }} />
              <Stack.Screen name="chat/[roomId]" />
            </Stack>
          </AuthAndOnboardingGate>
        </ThemeProvider>
      </AppProvider>
    </AuthProvider>
  );
}

function AuthAndOnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const { hydrated, hasOnboarded, birthDate, birthDateChecked } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const inAuth = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    const inAgeCheck = segments[0] === 'ageCheck';

    // Defer one tick: on cold launch this effect can run before the root
    // navigator has mounted, and calling replace() that early throws
    // "Attempted to navigate before mounting the Root Layout component."
    const t = setTimeout(() => {
      if (!user) {
        if (!inAuth) router.replace('/auth');
        return;
      }
      if (!hydrated) return; // account data still loading from storage

      if (!hasOnboarded && !inOnboarding) {
        router.replace('/onboarding');
      } else if (hasOnboarded && birthDateChecked && !birthDate && !inAgeCheck) {
        // Age safeguard: accounts from before it existed give their birthday once.
        router.replace('/ageCheck');
      } else if (hasOnboarded && (inAuth || inOnboarding)) {
        router.replace('/');
      }
    }, 0);

    return () => clearTimeout(t);
  }, [initializing, user, hydrated, hasOnboarded, birthDate, birthDateChecked, segments, router]);

  return <>{children}</>;
}
