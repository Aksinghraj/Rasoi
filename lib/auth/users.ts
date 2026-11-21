import { uid } from '@/lib/format';
import { UserProfile } from '@/lib/types';

/**
 * Authentication boundary.
 *
 * In this demo build users are created locally after OTP verification. In the
 * production backend the same profile shape is created by the server, which is
 * also the only place that may assign `isAdmin`. Nothing a client submits can
 * promote an account.
 */

export type SelfServiceChannel = 'phone' | 'email';

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * A self-service sign-in may only resume an account created through the same
 * self-service channel. The seeded demo admin must never be resumed by an OTP
 * sign-in: that would hand admin rights to anyone entering the demo number.
 */
export function matchesExistingAccount(
  user: UserProfile | null | undefined,
  channel: SelfServiceChannel,
  identifier: string,
): boolean {
  if (!user || user.authMethod !== channel) return false;
  if (channel === 'phone') return Boolean(user.phone) && user.phone === normalizePhone(identifier);
  return Boolean(user.email) && normalizeEmail(user.email as string) === normalizeEmail(identifier);
}

/**
 * Only presentation fields can be changed from the client. Identity, auth
 * method and role are owned by the account store and are never taken from a
 * caller-supplied patch.
 */
export function sanitizeProfilePatch(user: UserProfile, patch: Partial<UserProfile>): UserProfile {
  const next: UserProfile = { ...user, isAdmin: user.isAdmin === true };
  if (typeof patch.name === 'string' && patch.name.trim().length >= 2) {
    next.name = patch.name.trim().slice(0, 60);
  }
  if (typeof patch.phone === 'string') {
    const phone = normalizePhone(patch.phone);
    if (/^[6-9][0-9]{9}$/.test(phone)) next.phone = phone;
  }
  if (typeof patch.email === 'string') {
    const email = normalizeEmail(patch.email);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) next.email = email;
  }
  return next;
}

export function createSelfServiceUser(
  channel: SelfServiceChannel,
  identifier: string,
  createdAt = new Date().toISOString(),
): UserProfile {
  return {
    id: uid('user'),
    name: channel === 'email' ? identifier.split('@')[0].replace(/[._-]/g, ' ') : 'Rasoi cook',
    phone: channel === 'phone' ? identifier.replace(/\D/g, '').slice(-10) : undefined,
    email: channel === 'email' ? normalizeEmail(identifier) : undefined,
    authMethod: channel,
    createdAt,
    // Self-service sign-up must never grant admin. Roles come from the server.
    isAdmin: false,
  };
}

/**
 * The seeded demo account is the only admin in this build. It exists purely so
 * the demo admin console is reachable and is not a sign-up path.
 */
export function createDemoUser(createdAt = new Date().toISOString()): UserProfile {
  return {
    id: uid('user'),
    name: 'Aarav Mehta',
    phone: '9876543210',
    authMethod: 'demo',
    createdAt,
    isAdmin: true,
  };
}
