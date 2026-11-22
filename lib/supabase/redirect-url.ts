/**
 * Redirect helpers for email confirmation.
 *
 * Pure functions with no React Native imports so they can be unit tested and
 * reused by both the web and native builds. The callback URL is never hardcoded
 * to a preview host: the web build derives it from `window.location.origin` and
 * native builds read an explicit public URL (or fall back to the app scheme).
 */

export const AUTH_CALLBACK_PATH = '/auth/callback';

type EnvLike = Record<string, string | undefined>;

export interface AuthCallbackParams {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

export const emptyCallbackParams: AuthCallbackParams = {
  code: null,
  tokenHash: null,
  type: null,
  accessToken: null,
  refreshToken: null,
  error: null,
  errorCode: null,
  errorDescription: null,
};

/** https anywhere, or plain http on localhost for local development only. */
export function isAcceptableBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Reads the optional public app URL used to send email confirmation links to a
 * reachable host. Expo only inlines `EXPO_PUBLIC_*` values referenced statically.
 */
export function appBaseUrlFromEnv(env: EnvLike = {
  EXPO_PUBLIC_APP_URL: process.env.EXPO_PUBLIC_APP_URL,
}): string | null {
  const value = env.EXPO_PUBLIC_APP_URL?.trim();
  if (!value) return null;
  if (!isAcceptableBaseUrl(value)) return null;
  return value.replace(/\/+$/, '');
}

export function callbackUrlForBase(base: string): string {
  return `${base.replace(/\/+$/, '')}${AUTH_CALLBACK_PATH}`;
}

/**
 * Merges query and hash parameters. Supabase returns PKCE codes in the query
 * string but reports errors (and implicit-flow tokens) in the URL fragment.
 */
export function parseAuthCallbackUrl(url: string | null | undefined): AuthCallbackParams {
  if (!url) return { ...emptyCallbackParams };
  const [beforeHash, rawHash = ''] = url.split('#');
  const queryIndex = beforeHash.indexOf('?');
  const rawQuery = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';

  const merged = new URLSearchParams(rawQuery);
  const hash = new URLSearchParams(rawHash);
  hash.forEach((value, key) => merged.set(key, value));

  const pick = (key: string): string | null => {
    const value = merged.get(key);
    return value && value.trim() ? value.trim() : null;
  };

  return {
    code: pick('code'),
    tokenHash: pick('token_hash'),
    type: pick('type'),
    accessToken: pick('access_token'),
    refreshToken: pick('refresh_token'),
    error: pick('error'),
    errorCode: pick('error_code'),
    errorDescription: pick('error_description'),
  };
}

/** True when the URL carries something the callback route can act on. */
export function hasCallbackPayload(params: AuthCallbackParams): boolean {
  return Boolean(
    params.code ||
      params.tokenHash ||
      (params.accessToken && params.refreshToken) ||
      params.error ||
      params.errorCode,
  );
}
