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
    <AppProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
<<<<<<< HEAD
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="randomMeal" />
          <Stack.Screen name="recipe/[id]" />
          <Stack.Screen
            name="modal"
            options={{ presentation: 'modal', headerShown: true, title: 'About BiteWise' }}
          />
        </Stack>
=======
        <OnboardingGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen name="randomMeal" />
            <Stack.Screen
              name="modal"
              options={{ presentation: 'modal', headerShown: true, title: 'About BiteWise' }}
            />
          </Stack>
        </OnboardingGate>
>>>>>>> 81deafd (Add first-launch onboarding with taste preferences and persistence)
      </ThemeProvider>
    </AppProvider>
  );
}

/**
 * First-launch redirect. Once saved state has loaded (`hydrated`), any
 * user who hasn't finished setup gets sent to /onboarding; a user who
 * HAS finished can never wander back into it (e.g. via a stale deep
 * link). Rendering children while unhydrated is fine — the redirect
 * fires the moment storage resolves, which is near-instant.
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { hydrated, hasOnboarded } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const inOnboarding = segments[0] === 'onboarding';

    if (!hasOnboarded && !inOnboarding) {
      router.replace('/onboarding');
    } else if (hasOnboarded && inOnboarding) {
      router.replace('/');
    }
  }, [hydrated, hasOnboarded, segments, router]);

  return <>{children}</>;
}
