import { UserProfile } from '@/lib/types';
import { normalizeEmail } from '@/lib/auth/validation';

export interface CloudAccount {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  name: string | null;
}

/**
 * Maps a Supabase auth account to the app profile.
 *
 * `isAdmin` is always false: roles are owned by the database, never by the
 * client or by a value the user can supply during sign-up.
 */
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
    isAdmin: false,
  };
}
