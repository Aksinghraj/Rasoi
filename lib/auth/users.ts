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

export function createSelfServiceUser(
  channel: SelfServiceChannel,
  identifier: string,
  createdAt = new Date().toISOString(),
): UserProfile {
  return {
    id: uid('user'),
    name: channel === 'email' ? identifier.split('@')[0].replace(/[._-]/g, ' ') : 'Rasoi cook',
    phone: channel === 'phone' ? identifier.replace(/\D/g, '').slice(-10) : undefined,
    email: channel === 'email' ? identifier : undefined,
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
