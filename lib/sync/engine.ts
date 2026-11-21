import { AppData } from '@/lib/types';
import { isNetworkError } from '@/lib/auth/validation';
import {
  RemoteSnapshot,
  fromRemoteSnapshot,
  hasRemoteData,
  toRemoteSnapshot,
} from '@/lib/sync/rows';

export interface SyncRepository {
  push(snapshot: RemoteSnapshot): Promise<void>;
  pull(): Promise<RemoteSnapshot>;
  deleteAccount(): Promise<void>;
}

export interface SyncRunOptions {
  repo: SyncRepository;
  local: AppData;
  userId: string;
  /** True when the device holds changes that have not reached the cloud yet. */
  pending: boolean;
  now?: string;
}

export interface SyncRunResult {
  ok: boolean;
  error?: string;
  offline?: boolean;
  pushed: boolean;
  pulled: boolean;
  state?: AppData;
  snapshot?: RemoteSnapshot;
}

/**
 * One reconciliation pass.
 *
 * - With pending local changes, the device is the last writer: push the local
 *   snapshot, then read the canonical rows back.
 * - Without pending changes, adopt the cloud copy when it holds kitchen data.
 * - When the account is brand new and empty, upload the local kitchen instead
 *   of wiping it.
 */
export async function runSync(options: SyncRunOptions): Promise<SyncRunResult> {
  const { repo, local, userId, pending } = options;
  const now = options.now ?? new Date().toISOString();
  const snapshot = toRemoteSnapshot(local, userId, now);

  try {
    if (pending) {
      await repo.push(snapshot);
      const remote = await repo.pull();
      return {
        ok: true,
        pushed: true,
        pulled: true,
        snapshot: remote,
        state: fromRemoteSnapshot(remote, local),
      };
    }

    const remote = await repo.pull();
    if (!hasRemoteData(remote)) {
      await repo.push(snapshot);
      return { ok: true, pushed: true, pulled: false, snapshot, state: local };
    }

    return {
      ok: true,
      pushed: false,
      pulled: true,
      snapshot: remote,
      state: fromRemoteSnapshot(remote, local),
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error ?? '');
    return {
      ok: false,
      error: describeSyncError(error),
      offline: isNetworkError(raw),
      pushed: false,
      pulled: false,
    };
  }
}

export function describeSyncError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const text = raw.toLowerCase();

  if (code === '42P01' || text.includes('does not exist') || text.includes('schema cache')) {
    return 'The cloud database is not set up yet. Apply supabase/migrations/0001_init.sql, then try again.';
  }
  if (code === '42501' || text.includes('row-level security') || text.includes('permission denied')) {
    return 'The cloud rejected this change because it is not allowed for your account.';
  }
  if (text.includes('jwt') || text.includes('refresh token') || text.includes('session')) {
    return 'Your cloud session expired. Sign in again to resume syncing.';
  }
  if (isNetworkError(raw)) {
    return 'You are offline. Your changes are saved on this device and will sync automatically.';
  }
  return raw ? `Sync failed: ${raw.slice(0, 200)}` : 'Sync failed. Your changes are still saved on this device.';
}
