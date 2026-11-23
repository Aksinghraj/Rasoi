import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import {
  AUTH_CALLBACK_PATH,
  appBaseUrlFromEnv,
  callbackUrlForBase,
  nativeRedirectUrlFromEnv,
  resolveWebCallbackBase,
} from '@/lib/supabase/redirect-url';

/**
 * The URL Supabase should send a person back to after they confirm their email.
 *
 * - Web: the public origin the app is actually served from. A localhost origin
 *   falls back to `EXPO_PUBLIC_APP_URL`, because a link emailed to a phone that
 *   points at localhost is unreachable.
 * - Native: an explicit `EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL` when a build is
 *   deliberately pointed at the HTTPS preview, otherwise the app's own deep
 *   link (`rasoi://auth/callback`). The temporary web preview URL is never used
 *   for production native builds, so the two paths stay separate.
 */
export function resolveAuthCallbackUrl(): string | null {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    const base = resolveWebCallbackBase(window.location?.origin, appBaseUrlFromEnv());
    return base ? callbackUrlForBase(base) : null;
  }

  const nativeRedirect = nativeRedirectUrlFromEnv();
  if (nativeRedirect) return nativeRedirect;

  try {
    return Linking.createURL(AUTH_CALLBACK_PATH);
  } catch {
    return null;
  }
}
