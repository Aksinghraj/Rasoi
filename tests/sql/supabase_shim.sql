-- Minimal Supabase-compatible shim for local PostgreSQL verification.
-- Creates the roles and auth helpers the Rasoi migrations expect. This is a
-- test harness only and is not part of the app schema.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  phone text,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Supabase reads the request JWT from this GUC. Tests set it per transaction.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.jwt() ->> 'role', ''),
    'anon'
  );
$$;

grant usage on schema auth to anon, authenticated, service_role;
-- In Supabase the client roles cannot read auth.users directly. Only the
-- service role can; the profile trigger reads it through SECURITY DEFINER.
grant select on auth.users to service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
