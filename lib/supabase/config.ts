export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

type EnvLike = Record<string, string | undefined>;

function isAcceptableUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Reads the public Supabase configuration.
 *
 * Only the anon key is ever shipped to the client. Authorization is enforced by
 * Postgres Row Level Security, not by hiding a key.
 */
export function readSupabaseConfig(env: EnvLike = process.env as EnvLike): SupabaseConfig | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  if (!isAcceptableUrl(url)) return null;
  if (anonKey.length < 20) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}

export function isSupabaseConfigured(env?: EnvLike): boolean {
  return readSupabaseConfig(env) !== null;
}
