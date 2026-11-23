import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { resolveAuthCallbackUrl } from '@/lib/supabase/redirect';
import type { AuthCallbackParams } from '@/lib/supabase/redirect-url';
import { cloudAccountToProfile, CloudAccount } from '@/lib/auth/profile';
import { UserProfile } from '@/lib/types';
import {
  describeAuthLinkError,
  isNetworkError,
  isValidEmail,
  mapCloudAuthError,
  mapConfirmationError,
  normalizeEmail,
  passwordProblem,
} from '@/lib/auth/validation';

export type { CloudAccount } from '@/lib/auth/profile';
export { cloudAccountToProfile } from '@/lib/auth/profile';

export interface CloudResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
  /** Password sign-up succeeded but the email still needs confirmation. */
  needsConfirmation?: boolean;
  /** The failure was a transport problem, so the local queue should retry. */
  offline?: boolean;
}

const NOT_CONFIGURED =
  'Cloud sign-in is not configured in this build. Your kitchen stays on this device.';

function fail<T = undefined>(message: string, offline = false): CloudResult<T> {
  return { ok: false, error: message, offline };
}

function accountFromUser(user: User): CloudAccount {
  const name =
    typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
      ? user.user_metadata.name.trim()
      : null;
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    createdAt: user.created_at ?? new Date().toISOString(),
    name,
  };
}

export function cloudUserToProfile(user: User, fallbackName?: string): UserProfile {
  return cloudAccountToProfile(accountFromUser(user), fallbackName);
}

export async function getCloudSession(): Promise<CloudResult<Session | null>> {
  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return fail(mapCloudAuthError(error.message), isNetworkError(error.message));
    return { ok: true, data: data.session ?? null };
  } catch (error) {
    return fail(mapCloudAuthError(error instanceof Error ? error.message : null), true);
  }
}

export async function sendEmailCode(email: string): Promise<CloudResult<{ email: string }>> {
  if (!isValidEmail(email)) return fail('Enter a valid email address.');
  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);
  try {
    // Without this, Supabase sends the link to the project's Site URL (often
    // `/`) and the authorization code is never exchanged, so no session is
    // created and the app keeps showing whatever local session it had.
    const emailRedirectTo = resolveAuthCallbackUrl() ?? undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { shouldCreateUser: true, emailRedirectTo },
    });
    if (error) return fail(mapCloudAuthError(error.message), isNetworkError(error.message));
    return { ok: true, data: { email: normalizeEmail(email) } };
  } catch (error) {
    return fail(mapCloudAuthError(error instanceof Error ? error.message : null), true);
  }
}

export async function verifyEmailCode(email: string, token: string): Promise<CloudResult<CloudAccount>> {
  if (!isValidEmail(email)) return fail('Enter a valid email address.');
  if (!/^\d{6}$/.test(token.trim())) return fail('Enter the six-digit code.');
  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: token.trim(),
      type: 'email',
    });
    if (error) return fail(mapCloudAuthError(error.message), isNetworkError(error.message));
    if (!data.user) return fail('That code did not create a session. Request a fresh one.');
    return { ok: true, data: accountFromUser(data.user) };
  } catch (error) {
    return fail(mapCloudAuthError(error instanceof Error ? error.message : null), true);
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<CloudResult<CloudAccount>> {
  if (!isValidEmail(email)) return fail('Enter a valid email address.');
  if (!password) return fail('Enter your password.');
  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error) return fail(mapCloudAuthError(error.message), isNetworkError(error.message));
    if (!data.user) return fail('Sign-in did not return an account.');
    return { ok: true, data: accountFromUser(data.user) };
  } catch (error) {
    return fail(mapCloudAuthError(error instanceof Error ? error.message : null), true);
  }
}

export async function signUpWithPassword(
  email: string,
  password: string,
  name?: string,
): Promise<CloudResult<CloudAccount>> {
  if (!isValidEmail(email)) return fail('Enter a valid email address.');
  const problem = passwordProblem(password);
  if (problem) return fail(problem);
  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);
  try {
    const emailRedirectTo = resolveAuthCallbackUrl() ?? undefined;
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        emailRedirectTo,
        data: name?.trim() ? { name: name.trim().slice(0, 60) } : undefined,
      },
    });
    if (error) return fail(mapCloudAuthError(error.message), isNetworkError(error.message));
    if (!data.user) return fail('Sign-up did not return an account.');
    if (!data.session) {
      return {
        ok: true,
        needsConfirmation: true,
        data: accountFromUser(data.user),
      };
    }
    return { ok: true, data: accountFromUser(data.user) };
  } catch (error) {
    return fail(mapCloudAuthError(error instanceof Error ? error.message : null), true);
  }
}

/**
 * A link can be opened after the account was already confirmed in another tab
 * or on another device. If this browser already holds a session, that is a
 * success, not an error worth alarming the person about.
 */
async function sessionIfAlreadySignedIn(
  supabase: SupabaseClient,
): Promise<CloudResult<CloudAccount> | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return { ok: true, data: accountFromUser(data.session.user) };
  return null;
}

/**
 * Confirms the session was written to the shared client storage, not just
 * returned in memory. A storage failure must not look like a signed-in app.
 */
async function persistedSessionResult(
  supabase: SupabaseClient,
  fallbackUser?: User,
): Promise<CloudResult<CloudAccount>> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? fallbackUser;
  if (!data.session || !user) {
    return fail(
      'Your email is confirmed, but the session could not be saved on this device. Sign in with your password.',
    );
  }
  return { ok: true, data: accountFromUser(user) };
}

function isAlreadyConfirmedError(message: string | null | undefined): boolean {
  const text = (message ?? '').toLowerCase();
  return (
    text.includes('already') ||
    text.includes('used') ||
    text.includes('consumed') ||
    text.includes('email confirmed')
  );
}

/**
 * Redeems the parameters Supabase appends to the confirmation redirect.
 *
 * Three shapes are supported, because which one arrives depends on the email
 * template and on whether the link was opened in the same browser:
 * - `code` — the PKCE authorization code, exchanged for a session;
 * - `token_hash` + `type` — verified directly, so it works when the email is
 *   opened on a different device from the one that signed up;
 * - `access_token` + `refresh_token` — the implicit-flow fragment.
 */
export async function completeEmailConfirmation(
  params: AuthCallbackParams,
): Promise<CloudResult<CloudAccount>> {
  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  try {
    if (params.error || params.errorCode) {
      const existing = await sessionIfAlreadySignedIn(supabase);
      if (existing) return existing;
      return fail(describeAuthLinkError(params.errorCode, params.errorDescription ?? params.error));
    }

    if (params.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) {
        if (isAlreadyConfirmedError(error.message)) {
          const existing = await sessionIfAlreadySignedIn(supabase);
          if (existing) return existing;
        }
        return fail(mapConfirmationError(error.message), isNetworkError(error.message));
      }
      if (!data.user) return fail('The confirmation link did not return an account. Sign in instead.');
      return persistedSessionResult(supabase, data.user);
    }

    if (params.tokenHash) {
      const type = (params.type ?? 'signup') as 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change';
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: params.tokenHash,
        type,
      });
      if (error) {
        if (isAlreadyConfirmedError(error.message)) {
          const existing = await sessionIfAlreadySignedIn(supabase);
          if (existing) return existing;
        }
        return fail(mapConfirmationError(error.message), isNetworkError(error.message));
      }
      if (!data.user) return fail('The confirmation link did not return an account. Sign in instead.');
      return persistedSessionResult(supabase, data.user);
    }

    if (params.accessToken && params.refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
      });
      if (error) {
        if (isAlreadyConfirmedError(error.message)) {
          const existing = await sessionIfAlreadySignedIn(supabase);
          if (existing) return existing;
        }
        return fail(mapConfirmationError(error.message), isNetworkError(error.message));
      }
      if (!data.user) return fail('The confirmation link did not return an account. Sign in instead.');
      return persistedSessionResult(supabase, data.user);
    }

    const existing = await sessionIfAlreadySignedIn(supabase);
    if (existing) return existing;

    return fail(
      'This confirmation link is missing its sign-in code. Open the newest confirmation email and try again.',
    );
  } catch (error) {
    return fail(mapConfirmationError(error instanceof Error ? error.message : null), true);
  }
}

export async function signOutCloud(): Promise<CloudResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: true };
  try {
    const { error } = await supabase.auth.signOut();
    if (error && !/session|not found/i.test(error.message)) {
      return fail(mapCloudAuthError(error.message), isNetworkError(error.message));
    }
    return { ok: true };
  } catch {
    // Local sign-out still proceeds; the refresh token is cleared by Supabase.
    return { ok: true };
  }
}

export async function deleteCloudAccount(): Promise<CloudResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: true };
  try {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return fail(mapCloudAuthError(error.message), isNetworkError(error.message));
    await supabase.auth.signOut();
    return { ok: true };
  } catch (error) {
    return fail(mapCloudAuthError(error instanceof Error ? error.message : null), true);
  }
}

export function subscribeToCloudAuth(
  handler: (session: Session | null) => void,
): (() => void) | null {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    handler(session);
  });
  return () => data.subscription.unsubscribe();
}
