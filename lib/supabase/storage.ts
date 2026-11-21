import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session storage for Supabase.
 *
 * On native platforms the refresh token lives in the OS keychain / keystore via
 * expo-secure-store. SecureStore limits each value to roughly 2 KB, so larger
 * sessions are split into chunks. The web build falls back to AsyncStorage
 * (localStorage), which is the only option a browser gives us.
 */

const CHUNK_SIZE = 1800;
const META_SUFFIX = '__rasoi_meta';

type Backend = 'secure' | 'async';

let backend: Promise<Backend> | null = null;

async function pickBackend(): Promise<Backend> {
  if (Platform.OS === 'web') return 'async';
  try {
    const probe = 'rasoi_storage_probe';
    await SecureStore.setItemAsync(probe, 'ok');
    await SecureStore.deleteItemAsync(probe);
    return 'secure';
  } catch {
    return 'async';
  }
}

function getBackend(): Promise<Backend> {
  if (!backend) backend = pickBackend();
  return backend;
}

async function rawGet(key: string): Promise<string | null> {
  if ((await getBackend()) === 'secure') {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  }
  return AsyncStorage.getItem(key);
}

async function rawSet(key: string, value: string): Promise<void> {
  if ((await getBackend()) === 'secure') {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function rawRemove(key: string): Promise<void> {
  if ((await getBackend()) === 'secure') {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Already absent.
    }
    return;
  }
  await AsyncStorage.removeItem(key);
}

function metaKey(key: string): string {
  return `${key}${META_SUFFIX}`;
}

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

export const supabaseStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const meta = await rawGet(metaKey(key));
      if (meta) {
        const parsed = JSON.parse(meta) as { chunks?: unknown };
        const chunks = typeof parsed.chunks === 'number' ? Math.floor(parsed.chunks) : 0;
        if (chunks > 0 && chunks <= 50) {
          const parts: string[] = [];
          for (let index = 0; index < chunks; index += 1) {
            const part = await rawGet(chunkKey(key, index));
            if (part === null) return null;
            parts.push(part);
          }
          return parts.join('');
        }
      }
      return await rawGet(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.removeItem(key);
      if (value.length <= CHUNK_SIZE) {
        await rawSet(key, value);
        return;
      }
      const chunks = Math.ceil(value.length / CHUNK_SIZE);
      for (let index = 0; index < chunks; index += 1) {
        await rawSet(chunkKey(key, index), value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
      }
      await rawSet(metaKey(key), JSON.stringify({ chunks }));
    } catch {
      // A failed session write must never crash the app. Supabase will simply
      // require a fresh sign-in on the next launch.
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const meta = await rawGet(metaKey(key));
      if (meta) {
        const parsed = JSON.parse(meta) as { chunks?: unknown };
        const chunks = typeof parsed.chunks === 'number' ? Math.floor(parsed.chunks) : 0;
        for (let index = 0; index < Math.min(chunks, 50); index += 1) {
          await rawRemove(chunkKey(key, index));
        }
        await rawRemove(metaKey(key));
      }
      await rawRemove(key);
    } catch {
      // Ignore cleanup failures.
    }
  },
};
