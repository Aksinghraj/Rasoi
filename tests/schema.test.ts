import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const MIGRATION = readFileSync(join(ROOT, 'supabase/migrations/0001_init.sql'), 'utf8');
const SYNC_MIGRATION = readFileSync(join(ROOT, 'supabase/migrations/0002_sync_rpc.sql'), 'utf8');

function functionBody(sql: string, name: string, nextMarker: string): string {
  const start = sql.indexOf(`create or replace function public.${name}`);
  const end = sql.indexOf(nextMarker, start);
  return start === -1 ? '' : sql.slice(start, end === -1 ? undefined : end);
}

function createdTables(sql: string): string[] {
  return [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((match) => match[1]);
}

function policiesFor(sql: string, table: string): string[] {
  return [
    ...sql.matchAll(
      new RegExp(`create policy "([^"]+)" on public\\.${table}\\b([^;]*);`, 'g'),
    ),
  ].map((match) => `${match[1]} ${match[2]}`);
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === '.expo') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx|json)$/.test(entry)) files.push(full);
  }
  return files;
}

const APP_TABLES = [
  'profiles',
  'households',
  'preferences',
  'meal_plans',
  'planned_meals',
  'pantry_items',
  'grocery_extras',
  'grocery_lists',
  'custom_recipes',
  'favorites',
  'orders',
  'audit_logs',
  'user_settings',
];

describe('database schema', () => {
  test('creates every user-owned table', () => {
    const tables = createdTables(MIGRATION);
    for (const table of APP_TABLES) {
      expect(tables).toContain(table);
    }
  });

  test('enables row level security on every table', () => {
    for (const table of APP_TABLES) {
      expect(MIGRATION).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  test('scopes every policy to the authenticated user', () => {
    for (const table of APP_TABLES) {
      const policies = policiesFor(MIGRATION, table);
      expect(policies.length).toBeGreaterThanOrEqual(3);
      for (const policy of policies) {
        expect(policy).toContain('auth.uid()');
      }
    }
  });

  test('keeps orders and audit logs insert-only at the policy layer', () => {
    for (const table of ['orders', 'audit_logs']) {
      const policies = policiesFor(MIGRATION, table);
      expect(policies.some((policy) => policy.startsWith(`${table}_select_own`))).toBe(true);
      expect(policies.some((policy) => policy.startsWith(`${table}_insert_own`))).toBe(true);
      expect(policies.some((policy) => policy.startsWith(`${table}_delete_own`))).toBe(true);
      expect(policies.some((policy) => policy.includes('for update'))).toBe(false);
    }
  });

  test('gives the client read/write policies only for its own rows', () => {
    for (const table of APP_TABLES) {
      const policies = policiesFor(MIGRATION, table);
      expect(policies.some((policy) => policy.startsWith(`${table}_select_own`))).toBe(true);
      expect(policies.some((policy) => policy.startsWith(`${table}_insert_own`))).toBe(true);
      const insert = policies.find((policy) => policy.startsWith(`${table}_insert_own`)) ?? '';
      expect(insert).toContain('with check');
    }
  });

  test('every UPDATE policy re-checks ownership with WITH CHECK', () => {
    for (const table of APP_TABLES) {
      for (const policy of policiesFor(MIGRATION, table)) {
        if (!policy.includes('for update')) continue;
        expect(policy).toContain('with check');
      }
    }
  });

  test('never grants the anon role access to app tables', () => {
    const revoke = MIGRATION.slice(MIGRATION.indexOf('revoke all on'));
    for (const table of APP_TABLES) {
      expect(revoke).toContain(`public.${table}`);
    }
    expect(revoke).toContain('from anon');
  });

  test('revokes UPDATE privilege from append-only tables', () => {
    expect(MIGRATION).toContain(
      'revoke update on public.orders, public.audit_logs from authenticated;',
    );
  });
});

describe('authorization assumptions', () => {
  test('pins admin, identity and email fields for client writes', () => {
    expect(MIGRATION).toContain('create or replace function public.protect_profile_fields()');
    expect(MIGRATION).toContain('new.is_admin := false;');
    expect(MIGRATION).toContain('new.is_admin := old.is_admin;');
    expect(MIGRATION).toContain('new.id := old.id;');
    expect(MIGRATION).toContain('new.email := old.email;');
    expect(MIGRATION).toContain('new.auth_method := old.auth_method;');
    expect(MIGRATION).toContain("coalesce(auth.role(), 'anon') <> 'service_role'");
  });

  test('attaches the profile guard to insert and update', () => {
    expect(MIGRATION).toMatch(
      /create trigger profiles_protect_fields\s+before insert or update on public\.profiles/,
    );
  });

  test('creates a profile for each new auth user without client input', () => {
    expect(MIGRATION).toContain('create or replace function public.handle_new_user()');
    expect(MIGRATION).toMatch(/after insert on auth\.users/);
    expect(MIGRATION).toContain('on conflict (id) do nothing');
  });

  test('deletes only the caller in the account-deletion function', () => {
    expect(MIGRATION).toContain('create or replace function public.delete_my_account()');
    expect(MIGRATION).toContain('delete from auth.users where id = current_user_id;');
    expect(MIGRATION).toContain('grant execute on function public.delete_my_account() to authenticated;');
    expect(MIGRATION).toContain('revoke all on function public.delete_my_account() from public;');
  });

  test('keeps plan meals owned and cascaded from their plan', () => {
    expect(MIGRATION).toMatch(
      /foreign key \(user_id, plan_id\)\s+references public\.meal_plans \(user_id, id\)\s+on delete cascade/,
    );
  });

  test('derives profile identity from auth.users, not from JWT claims', () => {
    const body = functionBody(
      MIGRATION,
      'protect_profile_fields()',
      'drop trigger if exists profiles_protect_fields',
    );
    expect(body).toContain('from auth.users');
    expect(body).toContain('new.email := account_email;');
    expect(body).toContain('new.phone := coalesce(new.phone, account_phone);');
    expect(body).not.toContain('auth.jwt()');
  });

  test('profile creation is server-owned and ignores client identity fields', () => {
    const handleNewUser = functionBody(
      MIGRATION,
      'handle_new_user()',
      'drop trigger if exists on_auth_user_created',
    );
    expect(handleNewUser).toContain('new.email');
    expect(handleNewUser).toContain('new.phone');
    expect(handleNewUser).toContain(
      "case when new.phone is not null and new.email is null then 'phone' else 'email' end",
    );
    expect(handleNewUser).toContain('on conflict (id) do nothing');
  });

  test('clients cannot grant themselves admin on insert or update', () => {
    const body = functionBody(
      MIGRATION,
      'protect_profile_fields()',
      'drop trigger if exists profiles_protect_fields',
    );
    expect(body).toContain('new.is_admin := false;');
    expect(body).toContain('new.is_admin := old.is_admin;');
    expect(body).toContain('new.id := old.id;');
    expect(body).toContain('new.email := old.email;');
    expect(body).toContain('new.auth_method := old.auth_method;');
  });
});

describe('transactional snapshot RPC', () => {
  test('applies a complete snapshot in one caller-scoped function', () => {
    expect(SYNC_MIGRATION).toContain(
      'create or replace function public.apply_user_snapshot(payload jsonb)',
    );
    expect(SYNC_MIGRATION).toContain('uid uuid := auth.uid();');
    expect(SYNC_MIGRATION).toContain(
      "if payload->>'user_id' is distinct from uid::text then",
    );
    expect(SYNC_MIGRATION).toContain(
      "raise exception 'Snapshot user does not match the signed-in user'",
    );
    expect(SYNC_MIGRATION).toContain('security invoker');
    expect(SYNC_MIGRATION).not.toContain('security definer');
  });

  test('does not require direct auth.users access or trust payload identity', () => {
    expect(SYNC_MIGRATION).not.toContain('auth.users');
    const profileInsert = SYNC_MIGRATION.slice(
      SYNC_MIGRATION.indexOf('insert into public.profiles'),
      SYNC_MIGRATION.indexOf('if payload->\'household\''),
    );
    expect(profileInsert).toContain("'email',");
    expect(profileInsert).toContain('false,');
    expect(profileInsert).not.toContain("payload->'profile'->>'email'");
    expect(profileInsert).not.toContain("payload->'profile'->>'is_admin'");
  });

  test('scopes every delete to the signed-in user', () => {
    const deletes = [...SYNC_MIGRATION.matchAll(/delete from public\.\w+[\s\S]*?;/g)].map(
      (match) => match[0],
    );
    expect(deletes.length).toBeGreaterThan(0);
    for (const statement of deletes) {
      expect(statement).toContain('uid');
    }
  });

  test('keeps orders and audit logs insert-only', () => {
    for (const table of ['orders', 'audit_logs']) {
      const insert = SYNC_MIGRATION.slice(
        SYNC_MIGRATION.indexOf(`insert into public.${table}`),
        SYNC_MIGRATION.indexOf(`delete from public.${table}`),
      );
      expect(insert).toContain('on conflict (user_id, id) do nothing');
      expect(insert).not.toContain('do update');
    }
  });

  test('grants execution only to authenticated', () => {
    expect(SYNC_MIGRATION).toContain(
      'revoke all on function public.apply_user_snapshot(jsonb) from public;',
    );
    expect(SYNC_MIGRATION).toContain(
      'grant execute on function public.apply_user_snapshot(jsonb) to authenticated;',
    );
  });
});

describe('client secret hygiene', () => {
  test('no application file reads a service-role key', () => {
    const offenders = walk(join(ROOT, 'lib'))
      .concat(walk(join(ROOT, 'app')))
      .concat(walk(join(ROOT, 'components')))
      .filter((file) => /SERVICE_ROLE|service_role_key/i.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  test('only the public anon key is read from the environment', () => {
    const source = readFileSync(join(ROOT, 'lib/supabase/config.ts'), 'utf8');
    const reads = [...source.matchAll(/env\.(EXPO_PUBLIC_\w+|SUPABASE_\w+|DATABASE_URL)/g)].map(
      (match) => match[1],
    );
    expect(new Set(reads)).toEqual(new Set(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']));
  });

  test('.gitignore excludes local env files and .env.example is committed', () => {
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^\.env\*\.local$/m);
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
    expect(example).toContain('EXPO_PUBLIC_SUPABASE_URL=');
    expect(example).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY=');
  });
});
