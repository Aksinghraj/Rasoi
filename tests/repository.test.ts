import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseSyncRepository } from '@/lib/sync/repository';
import {
  AuditRow,
  emptyRemoteSnapshot,
  OrderRow,
  RemoteSnapshot,
} from '@/lib/sync/rows';

const USER_ID = '11111111-1111-4111-8111-111111111111';

type Row = Record<string, any>;
type RowMap = Record<string, Row[]>;

interface UpsertCall {
  table: string;
  rows: Row[];
  options?: { onConflict?: string; ignoreDuplicates?: boolean };
}

interface DeleteCall {
  table: string;
  column: string;
  values: string[];
}

interface Op {
  kind: 'select' | 'upsert' | 'delete' | 'rpc';
  table?: string;
}

type Filter =
  | { type: 'eq'; column: string; value: string }
  | { type: 'in'; column: string; values: string[] };

interface FakeOptions {
  existing?: RowMap;
  rpcError?: { message: string; code?: string } | null;
  failUpsertTable?: string;
}

function cloneStore(source: RowMap): RowMap {
  return JSON.parse(JSON.stringify(source)) as RowMap;
}

function tableKey(table: string, row: Row): string {
  if (table === 'profiles') return String(row.id);
  if (table === 'households' || table === 'preferences' || table === 'user_settings') {
    return String(row.user_id);
  }
  if (table === 'favorites') return `${row.user_id}:${row.recipe_id}`;
  return `${row.user_id}:${row.id}`;
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) =>
    filter.type === 'eq'
      ? row[filter.column] === filter.value
      : filter.values.includes(String(row[filter.column] ?? '')),
  );
}

function createFakeClient(options: FakeOptions = {}) {
  const upserts: UpsertCall[] = [];
  const deletes: DeleteCall[] = [];
  const ops: Op[] = [];
  const rpcCalls: { name: string; params: Record<string, any> }[] = [];
  const store = cloneStore(options.existing ?? {});

  function from(table: string) {
    const filters: Filter[] = [];
    let action: 'select' | 'delete' | 'upsert' = 'select';
    let payload: Row[] = [];
    let upsertOptions: UpsertCall['options'];

    const builder = {
      select(_columns?: string) {
        action = 'select';
        return builder;
      },
      delete() {
        action = 'delete';
        return builder;
      },
      upsert(rows: Row[], opts?: UpsertCall['options']) {
        action = 'upsert';
        payload = rows;
        upsertOptions = opts;
        return builder;
      },
      eq(column: string, value: string) {
        filters.push({ type: 'eq', column, value });
        return builder;
      },
      in(column: string, values: string[]) {
        filters.push({ type: 'in', column, values });
        return builder;
      },
      then(resolve: (value: any) => void, reject: (reason?: any) => void) {
        try {
          if (action === 'select') {
            ops.push({ kind: 'select', table });
            const data = (store[table] ?? [])
              .filter((row) => matches(row, filters))
              .map((row) => ({ id: row.id ?? row.recipe_id }));
            resolve({ data, error: null });
            return;
          }

          if (action === 'delete') {
            const inFilter = filters.find((filter) => filter.type === 'in');
            deletes.push({
              table,
              column: inFilter && inFilter.type === 'in' ? inFilter.column : '',
              values: inFilter && inFilter.type === 'in' ? inFilter.values : [],
            });
            ops.push({ kind: 'delete', table });
            store[table] = (store[table] ?? []).filter((row) => !matches(row, filters));
            resolve({ data: null, error: null });
            return;
          }

          ops.push({ kind: 'upsert', table });
          upserts.push({ table, rows: payload, options: upsertOptions });

          if (options.failUpsertTable === table) {
            resolve({
              data: null,
              error: { message: `write rejected for ${table}`, code: '42501' },
            });
            return;
          }

          if ((table === 'orders' || table === 'audit_logs') && !upsertOptions?.ignoreDuplicates) {
            throw new Error(`${table} upsert must not require UPDATE permission`);
          }

          const existing = store[table] ?? [];
          for (const row of payload) {
            const key = tableKey(table, row);
            const index = existing.findIndex((stored) => tableKey(table, stored) === key);
            if (index === -1) {
              existing.push({ ...row });
            } else if (!upsertOptions?.ignoreDuplicates) {
              existing[index] = { ...existing[index], ...row };
            }
          }
          store[table] = existing;
          resolve({ data: null, error: null });
        } catch (error) {
          reject(error);
        }
      },
    };

    return builder;
  }

  const client = {
    rpc(name: string, params: Record<string, any>) {
      ops.push({ kind: 'rpc' });
      rpcCalls.push({ name, params });
      return Promise.resolve(
        options.rpcError ? { data: null, error: options.rpcError } : { data: null, error: null },
      );
    },
    from,
  };

  return {
    client: client as unknown as SupabaseClient,
    upserts,
    deletes,
    ops,
    rpcCalls,
    store,
  };
}

function orderRow(id: string): OrderRow {
  return {
    id,
    user_id: USER_ID,
    data: {
      id,
      retailerId: 'sandbox',
      retailerName: 'Sandbox',
      mode: 'A',
      status: 'sandbox_created',
      total: 0,
      itemCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      note: '',
      items: [],
    },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function auditRow(id: string): AuditRow {
  return {
    id,
    user_id: USER_ID,
    action: 'order.created',
    detail: `Order ${id}`,
    actor: 'Meera',
    at: '2026-01-01T00:00:00.000Z',
  };
}

function snapshotWith(overrides: Partial<RemoteSnapshot>): RemoteSnapshot {
  return { ...emptyRemoteSnapshot, ...overrides };
}

const MISSING_RPC = {
  message: 'Could not find the function public.apply_user_snapshot(payload) in the schema cache',
  code: 'PGRST202',
};

describe('sync repository', () => {
  test('applies the whole snapshot through one transactional RPC', async () => {
    const fake = createFakeClient();
    const repo = new SupabaseSyncRepository(fake.client, USER_ID);

    await repo.push(
      snapshotWith({ orders: [orderRow('o1')], auditLogs: [auditRow('a1')] }),
    );

    expect(fake.rpcCalls).toHaveLength(1);
    expect(fake.rpcCalls[0].name).toBe('apply_user_snapshot');
    expect(fake.rpcCalls[0].params.payload.user_id).toBe(USER_ID);
    expect(fake.rpcCalls[0].params.payload.orders).toHaveLength(1);
    expect(fake.rpcCalls[0].params.payload.auditLogs).toHaveLength(1);
    expect(fake.upserts).toHaveLength(0);
    expect(fake.deletes).toHaveLength(0);
  });

  test('repeated legacy syncs keep existing order and audit ids without updates', async () => {
    const fake = createFakeClient({
      existing: { orders: [orderRow('o1')], audit_logs: [auditRow('a1')] },
      rpcError: MISSING_RPC,
    });
    const repo = new SupabaseSyncRepository(fake.client, USER_ID);
    const snapshot = snapshotWith({
      orders: [orderRow('o1'), orderRow('o2')],
      auditLogs: [auditRow('a1'), auditRow('a2')],
    });

    await repo.push(snapshot);
    await repo.push(snapshot);

    const orderUpserts = fake.upserts.filter((call) => call.table === 'orders');
    const auditUpserts = fake.upserts.filter((call) => call.table === 'audit_logs');
    expect(orderUpserts).toHaveLength(2);
    expect(auditUpserts).toHaveLength(2);
    expect(orderUpserts.every((call) => call.options?.ignoreDuplicates === true)).toBe(true);
    expect(auditUpserts.every((call) => call.options?.ignoreDuplicates === true)).toBe(true);

    expect(fake.store.orders.map((row) => row.id).sort()).toEqual(['o1', 'o2']);
    expect(fake.store.audit_logs.map((row) => row.id).sort()).toEqual(['a1', 'a2']);
  });

  test('legacy replacement writes rows before deleting stale ids', async () => {
    const fake = createFakeClient({
      existing: { orders: [orderRow('old')] },
      rpcError: MISSING_RPC,
    });
    const repo = new SupabaseSyncRepository(fake.client, USER_ID);

    await repo.push(snapshotWith({ orders: [orderRow('new')] }));

    const orderOps = fake.ops.filter((op) => op.table === 'orders').map((op) => op.kind);
    expect(orderOps).toEqual(['select', 'upsert', 'delete']);
    expect(fake.store.orders.map((row) => row.id)).toEqual(['new']);
  });

  test('legacy replacement does not delete when a write is rejected', async () => {
    const fake = createFakeClient({
      existing: { orders: [orderRow('old')] },
      rpcError: MISSING_RPC,
      failUpsertTable: 'orders',
    });
    const repo = new SupabaseSyncRepository(fake.client, USER_ID);

    await expect(repo.push(snapshotWith({ orders: [orderRow('new')] }))).rejects.toThrow(
      'write rejected for orders',
    );

    expect(fake.deletes.filter((call) => call.table === 'orders')).toHaveLength(0);
    expect(fake.store.orders.map((row) => row.id)).toEqual(['old']);
  });

  test('falls back when PostgreSQL reports an undefined function', async () => {
    const fake = createFakeClient({
      rpcError: {
        message: 'function public.apply_user_snapshot(payload => jsonb) does not exist',
        code: '42883',
      },
    });
    const repo = new SupabaseSyncRepository(fake.client, USER_ID);

    await repo.push(snapshotWith({ orders: [orderRow('o1')] }));

    expect(fake.upserts.some((call) => call.table === 'orders')).toBe(true);
    expect(fake.store.orders.map((row) => row.id)).toEqual(['o1']);
  });

  test('does not silently fall back on authorization errors', async () => {
    const fake = createFakeClient({
      rpcError: { message: 'new row violates row-level security policy', code: '42501' },
    });
    const repo = new SupabaseSyncRepository(fake.client, USER_ID);

    await expect(repo.push(snapshotWith({}))).rejects.toThrow('row-level security');
    expect(fake.upserts).toHaveLength(0);
    expect(fake.deletes).toHaveLength(0);
  });

  test('does not silently fall back on genuine database errors', async () => {
    const fake = createFakeClient({
      rpcError: {
        message: 'insert or update on table "planned_meals" violates foreign key constraint',
        code: '23503',
      },
    });
    const repo = new SupabaseSyncRepository(fake.client, USER_ID);

    await expect(repo.push(snapshotWith({}))).rejects.toThrow('foreign key');
    expect(fake.upserts).toHaveLength(0);
    expect(fake.deletes).toHaveLength(0);
  });

  test('does not fall back on transport failures', async () => {
    const fake = createFakeClient({
      rpcError: { message: 'TypeError: Failed to fetch' },
    });
    const repo = new SupabaseSyncRepository(fake.client, USER_ID);

    await expect(repo.push(snapshotWith({}))).rejects.toThrow('Failed to fetch');
    expect(fake.upserts).toHaveLength(0);
    expect(fake.deletes).toHaveLength(0);
  });
});
