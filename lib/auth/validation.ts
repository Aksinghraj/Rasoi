export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isSixDigitCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

/**
 * Returns a user-facing problem, or null when the password is acceptable.
 * Supabase also enforces its own minimum; this is the fast client-side check.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password.length > 72) return 'Use 72 characters or fewer.';
  if (!/[A-Za-z]/.test(password)) return 'Add at least one letter.';
  if (!/\d/.test(password)) return 'Add at least one number.';
  return null;
}

/** Maps provider errors to copy a person can act on. */
export function mapCloudAuthError(message: string | null | undefined): string {
  const text = (message ?? '').toLowerCase();
  if (!text) return 'Sign-in failed. Check your connection and try again.';
  if (text.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (text.includes('email not confirmed')) return 'Confirm your email from the code we sent, then sign in.';
  if (text.includes('user already registered')) return 'That email already has an account. Sign in instead.';
  if (text.includes('password should be at least')) return 'Use a longer password (at least 8 characters).';
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Too many attempts. Wait a minute, then try again.';
  }
  if (text.includes('token has expired') || text.includes('expired')) {
    return 'That code expired. Request a fresh one.';
  }
  if (text.includes('invalid token') || text.includes('otp')) {
    return 'That code is not valid. Check the six digits and try again.';
  }
  if (text.includes('signups not allowed')) return 'New sign-ups are disabled for this project.';
  if (text.includes('network') || text.includes('fetch') || text.includes('failed to fetch')) {
    return 'You appear to be offline. Your kitchen is saved on this device and will sync later.';
  }
  return 'Sign-in failed. Check your connection and try again.';
}

/**
 * Copy for a confirmation link that could not be redeemed.
 *
 * These links are single-use and time limited, and a PKCE link opened in a
 * different browser cannot present its code verifier. None of that is a
 * security failure: the account still exists and the password still works.
 */
export function mapConfirmationError(message: string | null | undefined): string {
  const text = (message ?? '').toLowerCase();
  if (!text) return 'We could not confirm this link. Sign in with your password to continue.';
  if (text.includes('code verifier') || text.includes('pkce') || text.includes('flow state')) {
    return 'This link was opened in a different browser or device than the one you signed up on. Your email is confirmed — sign in with your password.';
  }
  if (text.includes('expired')) {
    return 'That confirmation link has expired. Sign in with your password, or request a new confirmation email.';
  }
  if (text.includes('already') || text.includes('used') || text.includes('consumed')) {
    return 'That confirmation link was already used. Sign in with your password to continue.';
  }
  if (text.includes('invalid') || text.includes('not found') || text.includes('missing')) {
    return 'That confirmation link is not valid. Open the newest email and try again.';
  }
  if (isNetworkError(text)) {
    return 'You appear to be offline. Reconnect, then open the confirmation link again.';
  }
  return mapCloudAuthError(message);
}

/** Copy for `error`/`error_code` values Supabase puts in the callback URL. */
export function describeAuthLinkError(
  errorCode: string | null | undefined,
  description: string | null | undefined,
): string {
  const code = (errorCode ?? '').toLowerCase();
  const detail = (description ?? '').toLowerCase();
  if (code === 'otp_expired' || detail.includes('expired')) {
    return 'That confirmation link has expired. Sign in with your password, or request a new confirmation email.';
  }
  if (code === 'access_denied' || detail.includes('already')) {
    return 'That confirmation link was already used or is no longer valid. Sign in with your password to continue.';
  }
  return mapConfirmationError(description ?? errorCode ?? null);
}

/** True when the Supabase error indicates a transport problem rather than bad input. */
export function isNetworkError(message: string | null | undefined): boolean {
  const text = (message ?? '').toLowerCase();
  return (
    text.includes('network') ||
    text.includes('fetch') ||
    text.includes('timeout') ||
    text.includes('offline') ||
    text.includes('connection')
  );
}
