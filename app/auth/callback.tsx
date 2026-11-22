import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, InfoBanner, Txt } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import { completeEmailConfirmation } from '@/lib/auth/cloud';
import {
  AuthCallbackParams,
  emptyCallbackParams,
  hasCallbackPayload,
  parseAuthCallbackUrl,
} from '@/lib/supabase/redirect-url';

type Phase = 'working' | 'confirmed' | 'failed';

/**
 * Email confirmation landing page.
 *
 * Supabase redirects here after the person clicks the link in their inbox. The
 * link is redeemed with the same PKCE flow the app signs up with, then the app
 * routes into the kitchen. Expired, already-used and wrong-browser links get a
 * clear message instead of a dead end.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('working');
  const [message, setMessage] = useState('Confirming your email…');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const readParams = async (): Promise<AuthCallbackParams> => {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined') return { ...emptyCallbackParams };
        return parseAuthCallbackUrl(`${window.location.search}${window.location.hash}`);
      }
      const initial = await Linking.getInitialURL().catch(() => null);
      return parseAuthCallbackUrl(initial);
    };

    (async () => {
      const params = await readParams();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Do not leave the one-time code or tokens in the address bar/history.
        window.history.replaceState(null, '', window.location.pathname);
      }

      if (!hasCallbackPayload(params)) {
        setPhase('failed');
        setMessage('This page confirms email links. Open the link from your confirmation email, or sign in with your password.');
        return;
      }

      const result = await completeEmailConfirmation(params);
      if (!result.ok) {
        setPhase('failed');
        setMessage(result.error ?? 'We could not confirm this link. Sign in with your password to continue.');
        return;
      }

      setPhase('confirmed');
      setMessage('Email confirmed. Opening your kitchen…');
      // The auth listener in AppContext adopts the session and starts syncing.
      setTimeout(() => router.replace('/(tabs)'), 700);
    })();
  }, [router]);

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
