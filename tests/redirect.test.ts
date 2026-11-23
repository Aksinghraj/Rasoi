import { describe, expect, test } from 'bun:test';
import {
  AUTH_CALLBACK_PATH,
  appBaseUrlFromEnv,
  callbackUrlForBase,
  hasCallbackPayload,
  isAcceptableBaseUrl,
  isLoopbackBaseUrl,
  nativeRedirectUrlFromEnv,
  parseAuthCallbackUrl,
  resolveWebCallbackBase,
} from '@/lib/supabase/redirect-url';
import { describeAuthLinkError, mapConfirmationError } from '@/lib/auth/validation';

describe('confirmation redirect url', () => {
  test('builds a callback url from a base and keeps a single slash', () => {
    expect(callbackUrlForBase('https://rasoi.example.com')).toBe(
      `https://rasoi.example.com${AUTH_CALLBACK_PATH}`,
    );
    expect(callbackUrlForBase('https://rasoi.example.com/')).toBe(
      `https://rasoi.example.com${AUTH_CALLBACK_PATH}`,
    );
  });

  test('accepts https and localhost but rejects other plain http hosts', () => {
    expect(isAcceptableBaseUrl('https://app.example.com')).toBe(true);
    expect(isAcceptableBaseUrl('http://localhost:4000')).toBe(true);
    expect(isAcceptableBaseUrl('http://127.0.0.1:4000')).toBe(true);
    expect(isAcceptableBaseUrl('http://localhost.evil.com')).toBe(false);
    expect(isAcceptableBaseUrl('http://app.example.com')).toBe(false);
    expect(isAcceptableBaseUrl('not a url')).toBe(false);
  });

  test('reads EXPO_PUBLIC_APP_URL and trims trailing slashes', () => {
    expect(appBaseUrlFromEnv({ EXPO_PUBLIC_APP_URL: 'https://preview.example.com/' })).toBe(
      'https://preview.example.com',
    );
    expect(appBaseUrlFromEnv({})).toBeNull();
    expect(appBaseUrlFromEnv({ EXPO_PUBLIC_APP_URL: 'http://insecure.example.com' })).toBeNull();
  });

  test('detects loopback origins that a phone cannot reach', () => {
    expect(isLoopbackBaseUrl('http://localhost:4000')).toBe(true);
    expect(isLoopbackBaseUrl('http://127.0.0.1:4000')).toBe(true);
    expect(isLoopbackBaseUrl('https://4000-preview.e2b.app')).toBe(false);
    expect(isLoopbackBaseUrl(null)).toBe(false);
  });

  test('uses the public web origin and never falls back to localhost when a public URL exists', () => {
    expect(resolveWebCallbackBase('https://4000-preview.e2b.app', 'https://other.example.com')).toBe(
      'https://4000-preview.e2b.app',
    );
    expect(resolveWebCallbackBase('http://localhost:4000', 'https://4000-preview.e2b.app/')).toBe(
      'https://4000-preview.e2b.app',
    );
    expect(resolveWebCallbackBase('http://127.0.0.1:4000', 'https://4000-preview.e2b.app')).toBe(
      'https://4000-preview.e2b.app',
    );
    expect(resolveWebCallbackBase('http://localhost:4000', null)).toBe('http://localhost:4000');
    expect(resolveWebCallbackBase(null, 'http://insecure.example.com')).toBeNull();
  });

  test('keeps the native redirect separate from the web preview URL', () => {
    expect(nativeRedirectUrlFromEnv({})).toBeNull();
    expect(
      nativeRedirectUrlFromEnv({ EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL: 'rasoi://auth/callback' }),
    ).toBe('rasoi://auth/callback');
    expect(
      nativeRedirectUrlFromEnv({ EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL: 'https://preview.example.com' }),
    ).toBe(`https://preview.example.com${AUTH_CALLBACK_PATH}`);
    expect(
      nativeRedirectUrlFromEnv({
        EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL: 'https://preview.example.com/auth/callback',
      }),
    ).toBe('https://preview.example.com/auth/callback');
    expect(
      nativeRedirectUrlFromEnv({ EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL: 'javascript:alert(1)' }),
    ).toBeNull();
  });
});

describe('callback parameter parsing', () => {
  test('reads a PKCE code from the query string', () => {
    const params = parseAuthCallbackUrl('https://app.example.com/auth/callback?code=abc123');
    expect(params.code).toBe('abc123');
    expect(hasCallbackPayload(params)).toBe(true);
  });

  test('reads a token hash and type for cross-device links', () => {
    const params = parseAuthCallbackUrl(
      'https://app.example.com/auth/callback?token_hash=h456&type=signup',
    );
    expect(params.tokenHash).toBe('h456');
    expect(params.type).toBe('signup');
  });

  test('reads errors Supabase puts in the fragment', () => {
    const params = parseAuthCallbackUrl(
      'https://app.example.com/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(params.error).toBe('access_denied');
    expect(params.errorCode).toBe('otp_expired');
    expect(params.errorDescription).toContain('expired');
    expect(hasCallbackPayload(params)).toBe(true);
  });

  test('reads implicit-flow tokens from the fragment', () => {
    const params = parseAuthCallbackUrl(
      'https://app.example.com/auth/callback#access_token=at&refresh_token=rt&type=signup',
    );
    expect(params.accessToken).toBe('at');
    expect(params.refreshToken).toBe('rt');
  });

  test('treats an empty or bare url as no payload', () => {
    expect(hasCallbackPayload(parseAuthCallbackUrl(null))).toBe(false);
    expect(hasCallbackPayload(parseAuthCallbackUrl('https://app.example.com/auth/callback'))).toBe(false);
  });
});

describe('confirmation error copy', () => {
  test('explains a link opened in another browser without failing security', () => {
    const message = mapConfirmationError('PKCE code verifier not found in storage');
    expect(message).toContain('different browser or device');
    expect(message).toContain('sign in with your password');
  });

  test('handles expired and already-used links', () => {
    expect(mapConfirmationError('Email link is invalid or has expired')).toContain('expired');
    expect(mapConfirmationError('Token has already been used')).toContain('already used');
  });

  test('maps provider error codes from the callback fragment', () => {
    expect(describeAuthLinkError('otp_expired', null)).toContain('expired');
    expect(describeAuthLinkError('access_denied', null)).toContain('already used');
  });
});
