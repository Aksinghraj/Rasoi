/**
 * Redirect helpers for email confirmation.
 *
 * Pure functions with no React Native imports so they can be unit tested and
 * reused by both the web and native builds. The callback URL is never hardcoded
 * to a preview host:
 * - the web build derives it from the public page origin, falling back to
 *   `EXPO_PUBLIC_APP_URL` only when the page itself is on localhost;
 * - native builds use an explicit native redirect override or the app scheme,
 *   never the temporary web preview URL.
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

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** True for a URL the phone cannot reach from a confirmation email. */
export function isLoopbackBaseUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * Picks the base URL a web build should send people back to.
 *
 * A public page origin always wins. When the page is opened on localhost, a
 * link emailed to a phone would point at the phone itself, so the configured
 * public app URL is used instead. If neither is usable the localhost origin is
 * kept so local development still round-trips.
 */
export function resolveWebCallbackBase(
  origin: string | null | undefined,
  configuredAppUrl: string | null | undefined,
): string | null {
  const cleanOrigin = origin?.trim().replace(/\/+$/, '') ?? '';
  const cleanConfigured = configuredAppUrl?.trim().replace(/\/+$/, '') ?? '';
  const originOk = isAcceptableBaseUrl(cleanOrigin);
  const configuredOk = isAcceptableBaseUrl(cleanConfigured);

  if (originOk && !isLoopbackBaseUrl(cleanOrigin)) return cleanOrigin;
  if (configuredOk) return cleanConfigured;
  if (originOk) return cleanOrigin;
  return null;
}

export const NATIVE_REDIRECT_ENV = 'EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL';

function isAcceptableNativeRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    if (['rasoi:', 'exp:', 'exps:'].includes(url.protocol)) return true;
    return isAcceptableBaseUrl(value);
  } catch {
    return false;
  }
}

/**
 * Optional explicit native redirect, kept separate from the temporary web
 * preview. A production build leaves this unset and falls back to the app
 * scheme. When set, it must be a full URL (for example
 * `rasoi://auth/callback`); an https base has the callback path appended.
 */
export function nativeRedirectUrlFromEnv(env: EnvLike = {
  EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL: process.env.EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL,
}): string | null {
  const value = env.EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL?.trim();
  if (!value) return null;
  if (!isAcceptableNativeRedirect(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return value.includes(AUTH_CALLBACK_PATH) ? value.replace(/\/+$/, '') : callbackUrlForBase(value);
    }
  } catch {
    return null;
  }
  return value;
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
