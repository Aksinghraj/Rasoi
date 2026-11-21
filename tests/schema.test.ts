import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const MIGRATION = readFileSync(join(ROOT, 'supabase/migrations/0001_init.sql'), 'utf8');

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

  test('gives the client read/write policies only for its own rows', () => {
    for (const table of APP_TABLES) {
      const policies = policiesFor(MIGRATION, table);
      expect(policies.some((policy) => policy.startsWith(`${table}_select_own`))).toBe(true);
      expect(policies.some((policy) => policy.startsWith(`${table}_insert_own`))).toBe(true);
      const insert = policies.find((policy) => policy.startsWith(`${table}_insert_own`)) ?? '';
      expect(insert).toContain('with check');
    }
  });

  test('never grants the anon role access to app tables', () => {
    const revoke = MIGRATION.slice(MIGRATION.indexOf('revoke all on'));
    for (const table of APP_TABLES) {
      expect(revoke).toContain(`public.${table}`);
    }
    expect(revoke).toContain('from anon');
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
