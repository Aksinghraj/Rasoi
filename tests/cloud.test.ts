import { describe, expect, test } from 'bun:test';
import { isSupabaseConfigured, readSupabaseConfig } from '@/lib/supabase/config';
import {
  isNetworkError,
  isSixDigitCode,
  isValidEmail,
  mapCloudAuthError,
  normalizeEmail,
  passwordProblem,
} from '@/lib/auth/validation';
import {
  backoffMs,
  emptyQueue,
  enqueue,
  markFailed,
  markSynced,
  parseQueue,
  retryDelayMs,
  shouldAttempt,
} from '@/lib/sync/queue';
import {
  emptyRemoteSnapshot,
  fromRemoteSnapshot,
  hasRemoteData,
  toRemoteSnapshot,
} from '@/lib/sync/rows';
import { describeSyncError, runSync } from '@/lib/sync/engine';
import { createEmptyData, defaultPreferences } from '@/lib/store/defaults';
import { AppData, UserProfile } from '@/lib/types';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function sampleState(overrides: Partial<AppData> = {}): AppData {
  const user: UserProfile = {
    id: USER_ID,
    name: 'Meera',
    email: 'meera@example.com',
    authMethod: 'email',
    createdAt: '2026-01-01T00:00:00.000Z',
    isAdmin: false,
  };
  return {
    ...createEmptyData(),
    user,
    session: { userId: USER_ID, method: 'email', signedInAt: '2026-01-01T00:00:00.000Z' },
    household: {
      adults: 2,
      children: 1,
      defaultServings: 3,
      members: [{ id: 'm1', name: 'Meera', ageGroup: 'adult' }],
    },
    preferences: { ...defaultPreferences, city: 'Pune' },
    pantry: [
      { id: 'p1', ingredientId: 'rice', quantity: 2, unit: 'kg', staple: true, addedAt: '2026-01-01T00:00:00.000Z' },
    ],
    favorites: ['paneer-butter-masala'],
    ...overrides,
  };
}

function fakeRepo(initial = emptyRemoteSnapshot) {
  let stored = initial;
  const calls: string[] = [];
  return {
    calls,
    get stored() {
      return stored;
    },
    repo: {
      async push(snapshot: typeof stored) {
        calls.push('push');
        stored = snapshot;
      },
      async pull() {
        calls.push('pull');
        return stored;
      },
      async deleteAccount() {
        calls.push('delete');
        stored = emptyRemoteSnapshot;
      },
    },
  };
}

describe('supabase config', () => {
  test('reads a valid https configuration and trims trailing slashes', () => {
    const config = readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co/',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'x'.repeat(40),
    });
    expect(config).toEqual({ url: 'https://demo.supabase.co', anonKey: 'x'.repeat(40) });
  });

  test('rejects missing, insecure or short values', () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(
      readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: 'http://evil.example.com', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'x'.repeat(40) }),
    ).toBeNull();
    expect(
      readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'short' }),
    ).toBeNull();
  });

  test('allows localhost for development', () => {
    expect(
      readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'y'.repeat(30) }),
    ).not.toBeNull();
    expect(isSupabaseConfigured({})).toBe(false);
  });
});

describe('auth validation', () => {
  test('normalizes and validates emails', () => {
    expect(normalizeEmail('  Meera@Example.COM ')).toBe('meera@example.com');
    expect(isValidEmail('meera@example.com')).toBe(true);
    expect(isValidEmail('meera@example')).toBe(false);
    expect(isValidEmail('not an email')).toBe(false);
  });

  test('checks six digit codes', () => {
    expect(isSixDigitCode('123456')).toBe(true);
    expect(isSixDigitCode('12345')).toBe(false);
    expect(isSixDigitCode('12345a')).toBe(false);
  });

  test('reports password problems', () => {
    expect(passwordProblem('short')).toBe('Use at least 8 characters.');
    expect(passwordProblem('abcdefgh')).toBe('Add at least one number.');
    expect(passwordProblem('12345678')).toBe('Add at least one letter.');
    expect(passwordProblem('abcdefg1')).toBeNull();
  });

  test('maps provider errors to actionable copy', () => {
    expect(mapCloudAuthError('Invalid login credentials')).toBe('Email or password is incorrect.');
    expect(mapCloudAuthError('User already registered')).toContain('already has an account');
    expect(mapCloudAuthError('Failed to fetch')).toContain('offline');
    expect(mapCloudAuthError('')).toContain('Sign-in failed');
  });

  test('detects transport failures', () => {
    expect(isNetworkError('TypeError: Failed to fetch')).toBe(true);
    expect(isNetworkError('network request failed')).toBe(true);
    expect(isNetworkError('Invalid login credentials')).toBe(false);
  });
});

describe('sync queue', () => {
  test('coalesces pending changes without resetting the first timestamp', () => {
    const first = enqueue(emptyQueue, '2026-01-01T00:00:00.000Z');
    expect(first.pending).toBe(true);
    expect(first.pendingSince).toBe('2026-01-01T00:00:00.000Z');
    const second = enqueue(first, '2026-01-01T00:05:00.000Z');
    expect(second.pendingSince).toBe('2026-01-01T00:00:00.000Z');
    expect(second.attempts).toBe(0);
  });

  test('applies capped exponential backoff on failures', () => {
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(2)).toBe(4000);
    expect(backoffMs(20)).toBe(5 * 60 * 1000);
    expect(backoffMs(999)).toBe(5 * 60 * 1000);

    const failed = markFailed(emptyQueue, 'offline', '2026-01-01T00:00:00.000Z');
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe('offline');
    expect(shouldAttempt(failed, '2026-01-01T00:00:01.000Z')).toBe(false);
    expect(shouldAttempt(failed, '2026-01-01T00:00:02.000Z')).toBe(true);
    expect(retryDelayMs(failed, '2026-01-01T00:00:00.000Z')).toBe(2000);
  });

  test('markSynced clears pending state', () => {
    const synced = markSynced(markFailed(emptyQueue, 'boom'), '2026-01-02T00:00:00.000Z');
    expect(synced.pending).toBe(false);
    expect(synced.attempts).toBe(0);
    expect(synced.lastSyncedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  test('parses only safe queue shapes', () => {
    expect(parseQueue('not json').pending).toBe(false);
    expect(parseQueue({ pending: 'yes', attempts: -3, nextAttemptAt: 'soon' })).toEqual(emptyQueue);
    const parsed = parseQueue({
      pending: true,
      pendingSince: '2026-01-01T00:00:00.000Z',
      attempts: 2.9,
      lastError: 'x'.repeat(400),
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
      nextAttemptAt: 'bad',
    });
    expect(parsed.pending).toBe(true);
    expect(parsed.attempts).toBe(2);
    expect(parsed.lastError?.length).toBe(300);
    expect(parsed.nextAttemptAt).toBeNull();
  });
});

describe('remote snapshot mapping', () => {
  test('scopes every row to the user and never uploads admin rights', () => {
    const state = sampleState({ user: { ...sampleState().user!, isAdmin: true } });
    const snapshot = toRemoteSnapshot(state, USER_ID, '2026-02-01T00:00:00.000Z');
    expect(snapshot.profile?.id).toBe(USER_ID);
    expect(snapshot.profile?.is_admin).toBe(false);
    expect(snapshot.household?.user_id).toBe(USER_ID);
    expect(snapshot.pantry[0].user_id).toBe(USER_ID);
    expect(snapshot.favorites[0]).toEqual({ user_id: USER_ID, recipe_id: 'paneer-butter-masala' });
  });

  test('round-trips kitchen data without losing values', () => {
    const state = sampleState();
    const snapshot = toRemoteSnapshot(state, USER_ID);
    const restored = fromRemoteSnapshot(snapshot, createEmptyData());
    expect(restored.user?.id).toBe(USER_ID);
    expect(restored.user?.email).toBe('meera@example.com');
    expect(restored.household?.defaultServings).toBe(3);
    expect(restored.preferences?.city).toBe('Pune');
    expect(restored.pantry[0].ingredientId).toBe('rice');
    expect(restored.favorites).toEqual(['paneer-butter-masala']);
    expect(restored.session?.userId).toBe(USER_ID);
  });

  test('detects whether the cloud already holds data', () => {
    expect(hasRemoteData(emptyRemoteSnapshot)).toBe(false);
    expect(hasRemoteData(toRemoteSnapshot(sampleState(), USER_ID))).toBe(true);
  });
});

describe('sync engine', () => {
  test('pushes then pulls when local changes are pending', async () => {
    const { repo, calls } = fakeRepo();
    const local = sampleState();
    const result = await runSync({ repo, local, userId: USER_ID, pending: true });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(['push', 'pull']);
    expect(result.pushed).toBe(true);
    expect(result.pulled).toBe(true);
    expect(result.state?.pantry.length).toBe(1);
  });

  test('uploads the local kitchen when the cloud account is empty', async () => {
    const handle = fakeRepo();
    const local = sampleState();
    const result = await runSync({ repo: handle.repo, local, userId: USER_ID, pending: false });
    expect(handle.calls).toEqual(['pull', 'push']);
    expect(result.pushed).toBe(true);
    expect(result.pulled).toBe(false);
    expect(handle.stored.pantry.length).toBe(1);
    expect(result.state).toBe(local);
  });

  test('adopts the cloud copy when there are no pending changes', async () => {
    const remoteState = sampleState({ favorites: ['remote-pick'] });
    const { repo, calls } = fakeRepo(toRemoteSnapshot(remoteState, USER_ID));
    const result = await runSync({
      repo,
      local: sampleState({ favorites: ['local-pick'] }),
      userId: USER_ID,
      pending: false,
    });
    expect(calls).toEqual(['pull']);
    expect(result.pushed).toBe(false);
    expect(result.pulled).toBe(true);
    expect(result.state?.favorites).toEqual(['remote-pick']);
  });

  test('reports offline failures without losing the local state', async () => {
    const repo = {
      async push(): Promise<never> {
        throw new TypeError('Failed to fetch');
      },
      async pull(): Promise<never> {
        throw new TypeError('Failed to fetch');
      },
      async deleteAccount(): Promise<void> {},
    };
    const result = await runSync({ repo, local: sampleState(), userId: USER_ID, pending: true });
    expect(result.ok).toBe(false);
    expect(result.offline).toBe(true);
    expect(result.state).toBeUndefined();
  });

  test('describes schema and permission errors', () => {
    expect(describeSyncError(new Error('relation "plans" does not exist'))).toContain('not set up yet');
    expect(describeSyncError(new Error('new row violates row-level security policy'))).toContain('not allowed');
    expect(describeSyncError(new Error('Failed to fetch'))).toContain('offline');
  });
});
