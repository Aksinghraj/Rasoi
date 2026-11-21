/**
 * Offline-first sync queue.
 *
 * The queue is deliberately small: at most one pending snapshot exists at a
 * time because the app always pushes its complete local state. Coalescing every
 * change into one pending snapshot keeps the queue bounded and makes a retry
 * idempotent. Attempts use exponential backoff capped at five minutes.
 */

export interface SyncQueueState {
  pending: boolean;
  pendingSince: string | null;
  attempts: number;
  lastError: string | null;
  lastSyncedAt: string | null;
  nextAttemptAt: string | null;
}

export const emptyQueue: SyncQueueState = {
  pending: false,
  pendingSince: null,
  attempts: 0,
  lastError: null,
  lastSyncedAt: null,
  nextAttemptAt: null,
};

const MAX_BACKOFF_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 2 * 1000;

export function backoffMs(attempts: number): number {
  const safe = Math.max(1, Math.min(20, Math.round(attempts)));
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (safe - 1));
}

export function enqueue(state: SyncQueueState, now: string = new Date().toISOString()): SyncQueueState {
  return {
    ...state,
    pending: true,
    pendingSince: state.pending ? state.pendingSince ?? now : now,
    lastError: null,
    nextAttemptAt: null,
  };
}

export function markSynced(
  state: SyncQueueState,
  now: string = new Date().toISOString(),
): SyncQueueState {
  return {
    pending: false,
    pendingSince: null,
    attempts: 0,
    lastError: null,
    lastSyncedAt: now,
    nextAttemptAt: null,
  };
}

export function markFailed(
  state: SyncQueueState,
  error: string,
  now: string = new Date().toISOString(),
): SyncQueueState {
  const attempts = state.attempts + 1;
  const retryAt = new Date(Date.parse(now) + backoffMs(attempts)).toISOString();
  return {
    pending: true,
    pendingSince: state.pendingSince ?? now,
    attempts,
    lastError: error,
    lastSyncedAt: state.lastSyncedAt,
    nextAttemptAt: retryAt,
  };
}

export function shouldAttempt(
  state: SyncQueueState,
  now: string = new Date().toISOString(),
): boolean {
  if (!state.pending) return false;
  if (!state.nextAttemptAt) return true;
  const retryAt = Date.parse(state.nextAttemptAt);
  if (!Number.isFinite(retryAt)) return true;
  return Date.parse(now) >= retryAt;
}

export function retryDelayMs(
  state: SyncQueueState,
  now: string = new Date().toISOString(),
): number {
  if (!state.nextAttemptAt) return 0;
  const retryAt = Date.parse(state.nextAttemptAt);
  if (!Number.isFinite(retryAt)) return 0;
  return Math.max(0, retryAt - Date.parse(now));
}

export function parseQueue(raw: unknown): SyncQueueState {
  if (typeof raw === 'string') {
    try {
      return parseQueue(JSON.parse(raw));
    } catch {
      return { ...emptyQueue };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...emptyQueue };
  const value = raw as Partial<SyncQueueState>;
  const stringOrNull = (input: unknown): string | null =>
    typeof input === 'string' && Number.isFinite(Date.parse(input)) ? input : null;
  return {
    pending: value.pending === true,
    pendingSince: stringOrNull(value.pendingSince),
    attempts:
      typeof value.attempts === 'number' && Number.isFinite(value.attempts) && value.attempts >= 0
        ? Math.min(100, Math.floor(value.attempts))
        : 0,
    lastError: typeof value.lastError === 'string' ? value.lastError.slice(0, 300) : null,
    lastSyncedAt: stringOrNull(value.lastSyncedAt),
    nextAttemptAt: stringOrNull(value.nextAttemptAt),
  };
}
