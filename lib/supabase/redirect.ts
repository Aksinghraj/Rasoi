import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import {
  AUTH_CALLBACK_PATH,
  appBaseUrlFromEnv,
  callbackUrlForBase,
  isAcceptableBaseUrl,
} from '@/lib/supabase/redirect-url';

/**
 * The URL Supabase should send a person back to after they confirm their email.
 *
 * - Web: the origin the app is actually served from, so the preview host and a
 *   production domain both work without hardcoding either.
 * - Native with `EXPO_PUBLIC_APP_URL`: the public HTTPS app URL, which is what
 *   makes a confirmation link opened from Gmail on Android land somewhere real.
 * - Native without it: the app's own deep link (`rasoi://auth/callback`), which
 *   is the production Android path once the scheme is allowlisted in Supabase.
 */
export function resolveAuthCallbackUrl(): string | null {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    const origin = window.location?.origin;
    if (!origin || !isAcceptableBaseUrl(origin)) return null;
    return callbackUrlForBase(origin);
  }

  const appUrl = appBaseUrlFromEnv();
  if (appUrl) return callbackUrlForBase(appUrl);

  try {
    return Linking.createURL(AUTH_CALLBACK_PATH);
  } catch {
    return null;
  }
}
