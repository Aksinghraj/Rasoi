import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, InfoBanner, Txt } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import { completeEmailConfirmation, getCloudSession } from '@/lib/auth/cloud';
import { useApp } from '@/lib/store/AppContext';
import {
  AuthCallbackParams,
  hasCallbackPayload,
  parseAuthCallbackUrl,
} from '@/lib/supabase/redirect-url';

type Phase = 'working' | 'failed' | 'confirmed';

const NO_PAYLOAD_MESSAGE =
  'This page confirms email links. Open the link from your confirmation email, or sign in with your password.';

/**
 * Email confirmation landing page.
 *
 * Supabase redirects here after the person clicks the link in their inbox. The
 * link is redeemed with the same PKCE flow the app signs up with, then the app
 * routes into the kitchen. Expired, already-used and wrong-browser links get a
 * clear message instead of a dead end, and an account that is already signed in
 * is treated as success rather than as an error.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { refreshCloudSession, state } = useApp();
  // `useURL` covers both the cold-start deep link and links delivered while the
  // app is already running; `getInitialURL` alone misses the second case.
  const nativeUrl = Linking.useURL();
  const [phase, setPhase] = useState<Phase>('working');
  const [message, setMessage] = useState('Confirming your email…');
  const startedRef = useRef(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(
    (text: string) => {
      setPhase('confirmed');
      setMessage(text);
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      navTimerRef.current = setTimeout(() => router.replace('/(tabs)'), 900);
    },
    [router],
  );

  const settle = useCallback(
    async (params: AuthCallbackParams) => {
      if (startedRef.current) return;
      startedRef.current = true;

      const existing = await getCloudSession();
      const alreadySignedIn = existing.ok && Boolean(existing.data);

      if (!hasCallbackPayload(params)) {
        if (alreadySignedIn) {
          finish('You are already signed in. Opening your kitchen…');
          return;
        }
        setPhase('failed');
        setMessage(NO_PAYLOAD_MESSAGE);
        return;
      }

      const result = await completeEmailConfirmation(params);
      if (!result.ok) {
        // A used or expired link still means the account may be confirmed and
        // this browser may already hold a session. Do not show a scary error.
        if (alreadySignedIn) {
          finish('You are already signed in. Opening your kitchen…');
          return;
        }
        const demoNote =
          state.user?.authMethod === 'demo'
            ? ' You are still in the demo kitchen until a real sign-in succeeds.'
            : '';
        setPhase('failed');
        setMessage(
          (result.error ?? 'We could not confirm this link. Sign in with your password to continue.') +
            demoNote,
        );
        return;
      }

      // Make the root provider adopt the session before navigating, so the
      // route guard does not bounce the person back to sign-in.
      const adopted = await refreshCloudSession();
      if (!adopted) {
        const persisted = await getCloudSession();
        if (!persisted.ok || !persisted.data) {
          setPhase('failed');
          setMessage(
            'Your email is confirmed, but the app could not open your session. Sign in with your password.',
          );
          return;
        }
      }

      finish('Email confirmed. Opening your kitchen…');
    },
    [finish, refreshCloudSession, state.user?.authMethod],
  );

  // Web: the code/tokens arrive in the address bar. Strip them immediately so
  // the one-time secret is not left in history.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const params = parseAuthCallbackUrl(`${window.location.search}${window.location.hash}`);
    window.history.replaceState(null, '', window.location.pathname);
    void settle(params);
  }, [settle]);

  // Native: process the first URL that actually carries a payload. A bare app
  // URL (or the initial base URL) is ignored until the deep link arrives.
  useEffect(() => {
    if (Platform.OS === 'web' || !nativeUrl || startedRef.current) return;
    const params = parseAuthCallbackUrl(nativeUrl);
    if (!hasCallbackPayload(params)) return;
    void settle(params);
  }, [nativeUrl, settle]);

  // If no deep link ever arrives, stop spinning and offer a way forward.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      if (startedRef.current) return;
      void settle(parseAuthCallbackUrl(null));
    }, 2500);
    return () => clearTimeout(timer);
  }, [settle]);

  useEffect(
    () => () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    },
    [],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Txt variant="h1">rasoi.</Txt>
          {phase === 'working' ? <ActivityIndicator color={colors.forest} /> : null}
          <Txt variant="body" color={colors.inkSoft} style={{ textAlign: 'center' }}>
            {message}
          </Txt>
        </View>

        {phase === 'failed' ? (
          <>
            <InfoBanner message={message} tone="orange" />
            <Button label="Go to sign in" onPress={() => router.replace('/auth')} />
          </>
        ) : null}

        {phase === 'confirmed' ? (
          <Button label="Continue" onPress={() => router.replace('/(tabs)')} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
