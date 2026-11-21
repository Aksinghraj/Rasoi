import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { UserProfile } from '@/lib/types';
import {
  isNetworkError,
  isValidEmail,
  mapCloudAuthError,
  normalizeEmail,
  passwordProblem,
} from '@/lib/auth/validation';

export interface CloudResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
  /** Password sign-up succeeded but the email still needs confirmation. */
  needsConfirmation?: boolean;
  /** The failure was a transport problem, so the local queue should retry. */
  offline?: boolean;
}

export interface CloudAccount {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  name: string | null;
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

export function cloudAccountToProfile(account: CloudAccount, fallbackName?: string): UserProfile {
  const email = account.email ? normalizeEmail(account.email) : undefined;
  const fallback = email ? email.split('@')[0].replace(/[._-]/g, ' ') : 'Rasoi cook';
  return {
    id: account.id,
    name: account.name ?? (fallbackName?.trim() || fallback),
    email,
    phone: account.phone ?? undefined,
    authMethod: account.phone && !account.email ? 'phone' : 'email',
    createdAt: account.createdAt,
    // Roles are owned by the server. A self-service account is never admin.
    isAdmin: false,
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
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { shouldCreateUser: true },
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
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
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
