import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AppProvider, useApp } from '@/lib/store/AppContext';
import { colors } from '@/lib/theme';

function RootNavigator() {
  const { state, hydrated } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const group = segments[0];
    const inAuth = group === 'auth';
    const inOnboarding = group === 'onboarding';

    if (!state.session && !inAuth) {
      router.replace('/auth');
      return;
    }
    if (state.session && !state.preferences && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }
    if (state.session && state.preferences && (inAuth || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [hydrated, state.session, state.preferences, segments, router]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.mint, fontSize: 34, fontWeight: '800', letterSpacing: -1 }}>rasoi.</Text>
        <Text style={{ color: colors.mintStrong, fontSize: 13, marginTop: 6 }}>plan · cook · shop</Text>
        <ActivityIndicator color={colors.mint} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="recipe/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cook/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="plan/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pantry" />
        <Stack.Screen name="checkout/[retailerId]" />
        <Stack.Screen name="preferences" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  return (
    <AppProvider>
      <RootNavigator />
    </AppProvider>
  );
}
