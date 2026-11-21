import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from '@/lib/supabase/config';
import { supabaseStorage } from '@/lib/supabase/storage';

let client: SupabaseClient | null = null;
let appStateBound = false;

/**
 * Returns the shared Supabase client, or null when the build has no cloud
 * configuration. Callers must handle null and keep the app usable offline.
 */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const config = readSupabaseConfig();
  if (!config) return null;

  client = createClient(config.url, config.anonKey, {
    auth: {
      storage: supabaseStorage,
      storageKey: 'rasoi.auth.session',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    global: {
      headers: { 'x-application-name': 'rasoi-mobile' },
    },
  });

  if (!appStateBound) {
    appStateBound = true;
    // Refresh tokens only while the app is in the foreground, as Supabase
    // recommends for React Native.
    AppState.addEventListener('change', (state) => {
      if (!client) return;
      if (state === 'active') {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    });
  }

  return client;
}

export function resetSupabaseClient(): void {
  client = null;
}
