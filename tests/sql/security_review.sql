-- Rasoi security / migration review
--
-- Runs against a scratch PostgreSQL database that has tests/sql/supabase_shim.sql
-- applied first. Asserts the behaviour of 0001_init.sql and 0002_sync_rpc.sql.
-- Any failed assertion raises and aborts the run (psql ON_ERROR_STOP=1).
--
-- This is a review harness, not app code. It never connects to Supabase.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Assertion helpers (owned by the review role, security invoker so dynamic SQL
-- runs with the caller's privileges and therefore under RLS)
-- ---------------------------------------------------------------------------

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.assert_true(cond boolean, msg text)
returns void
language plpgsql
as $$
begin
  if cond is not true then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
end;
$$;

create or replace function tests.expect_error(stmt text, needle text)
returns void
language plpgsql
as $$
begin
  begin
    execute stmt;
  exception when others then
    if needle is not null and position(needle in sqlerrm) = 0 then
      raise exception 'ASSERTION FAILED: expected error containing "%", got "%"', needle, sqlerrm;
    end if;
    return;
  end;
  raise exception 'ASSERTION FAILED: expected an error but statement succeeded: %', stmt;
end;
$$;

grant execute on function tests.assert_true(boolean, text) to anon, authenticated;
grant execute on function tests.expect_error(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Static checks: RLS, policies, function security, privileges
-- ---------------------------------------------------------------------------

do $$
declare
  tbl text;
  policy record;
  rpc record;
begin
  foreach tbl in array array[
    'profiles','households','preferences','meal_plans','planned_meals',
    'pantry_items','grocery_extras','grocery_lists','custom_recipes',
    'favorites','orders','audit_logs','user_settings'
  ] loop
    perform tests.assert_true(
      (select relrowsecurity from pg_class
        where relnamespace = 'public'::regnamespace and relname = tbl),
      format('RLS must be enabled on public.%s', tbl)
    );
  end loop;

  for policy in
    select * from pg_policies where schemaname = 'public'
  loop
    perform tests.assert_true(
      coalesce(policy.qual, '') like '%auth.uid()%'
      or coalesce(policy.with_check, '') like '%auth.uid()%',
      format('policy %s on %s must be scoped to auth.uid()', policy.policyname, policy.tablename)
    );
  end loop;

  -- Append-only histories must not be mutable at the policy or privilege layer.
  perform tests.assert_true(
    not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename in ('orders','audit_logs') and cmd = 'UPDATE'
    ),
    'orders and audit_logs must not have an UPDATE policy'
  );
  perform tests.assert_true(
    not exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'public'
        and table_name in ('orders','audit_logs')
        and grantee = 'authenticated'
        and privilege_type = 'UPDATE'
    ),
    'authenticated must not hold UPDATE on orders or audit_logs'
  );

  -- The snapshot RPC is invoker-rights and executable only by authenticated.
  select * into rpc from pg_proc where proname = 'apply_user_snapshot';
  perform tests.assert_true(rpc.prosecdef is false, 'apply_user_snapshot must be SECURITY INVOKER');
  perform tests.assert_true(
    not exists (
      select 1 from information_schema.routine_privileges
      where routine_name = 'apply_user_snapshot' and grantee in ('anon', 'public')
    ),
    'apply_user_snapshot must not be executable by anon or public'
  );
  perform tests.assert_true(
    exists (
      select 1 from information_schema.routine_privileges
      where routine_name = 'apply_user_snapshot' and grantee = 'authenticated'
    ),
    'apply_user_snapshot must be executable by authenticated'
  );

  -- Profiles are intentionally not client-deletable; deletion goes through the
  -- security-definer delete_my_account RPC.
  perform tests.assert_true(
    not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and cmd = 'DELETE'
    ),
    'profiles must not have a client DELETE policy'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed auth users (as the review role). The auth trigger must create profiles.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, phone, email_confirmed_at, phone_confirmed_at, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.com', null, now(), null, '{"name":"Alice"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', null, '9876543210', null, now(), '{"name":"Bob"}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'c@example.com', null, null, null, '{}'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd@example.com', null, now(), null, '{}'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'e@example.com', null, now(), null, '{}');

do $$
declare
  uid_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  uid_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  uid_c uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
begin
  -- email-only user, with metadata name
  perform tests.assert_true(
    (select email from public.profiles where id = uid_a) = 'a@example.com',
    'email-only profile must copy email from auth.users'
  );
  perform tests.assert_true(
    (select auth_method from public.profiles where id = uid_a) = 'email',
    'email-only profile must be auth_method email'
  );
  perform tests.assert_true(
    (select name from public.profiles where id = uid_a) = 'Alice',
    'profile name must come from auth metadata when present'
  );
  perform tests.assert_true(
    (select is_admin from public.profiles where id = uid_a) = false,
    'new profiles must never be admin'
  );

  -- phone-only user
  perform tests.assert_true(
    (select phone from public.profiles where id = uid_b) = '9876543210',
    'phone-only profile must copy phone from auth.users'
  );
  perform tests.assert_true(
    (select email from public.profiles where id = uid_b) is null,
    'phone-only profile must not invent an email'
  );
  perform tests.assert_true(
    (select auth_method from public.profiles where id = uid_b) = 'phone',
    'phone-only profile must be auth_method phone'
  );

  -- email sign-up awaiting confirmation: row exists with email, no confirmation
  perform tests.assert_true(
    (select email from public.profiles where id = uid_c) = 'c@example.com',
    'unconfirmed email sign-up must still derive email from auth.users'
  );
  perform tests.assert_true(
    (select auth_method from public.profiles where id = uid_c) = 'email',
    'unconfirmed email sign-up must be auth_method email'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Client-supplied identity on profile INSERT is overwritten from auth.users
-- ---------------------------------------------------------------------------

-- Remove E's auto-created profile so the client INSERT path can be exercised.
delete from public.profiles where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

set role authenticated;
set request.jwt.claims = '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}';

do $$
declare
  uid_e uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
begin
  insert into public.profiles (id, name, email, auth_method, is_admin)
  values (uid_e, 'Eve', 'spoof@example.com', 'demo', true);

  perform tests.assert_true(
    (select email from public.profiles where id = uid_e) = 'e@example.com',
    'client INSERT must not set profile email'
  );
  perform tests.assert_true(
    (select auth_method from public.profiles where id = uid_e) = 'email',
    'client INSERT must not set auth_method'
  );
  perform tests.assert_true(
    (select is_admin from public.profiles where id = uid_e) = false,
    'client INSERT must not grant admin'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Client isolation and profile tampering (run as authenticated user A)
-- ---------------------------------------------------------------------------

set role authenticated;
set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$
declare
  uid_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  uid_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  affected integer;
begin
  perform tests.assert_true(
    (select count(*) from public.profiles) = 1,
    'user A must only see their own profile'
  );
  perform tests.assert_true(
    (select count(*) from public.profiles where id = uid_b) = 0,
    'user A must not read user B profile'
  );

  update public.profiles set name = 'hacked' where id = uid_b;
  get diagnostics affected = row_count;
  perform tests.assert_true(affected = 0, 'user A must not update user B profile');

  -- Identity and role tampering on the caller's own row must be neutralised.
  update public.profiles
     set id = uid_b,
         is_admin = true,
         email = 'attacker@example.com',
         auth_method = 'demo'
   where id = uid_a;

  perform tests.assert_true(
    (select id from public.profiles where id = uid_a) = uid_a,
    'profile id must not be changeable by the client'
  );
  perform tests.assert_true(
    (select email from public.profiles where id = uid_a) = 'a@example.com',
    'profile email must stay derived from auth.users'
  );
  perform tests.assert_true(
    (select auth_method from public.profiles where id = uid_a) = 'email',
    'profile auth_method must stay server-owned'
  );
  perform tests.assert_true(
    (select is_admin from public.profiles where id = uid_a) = false,
    'client must not be able to grant itself admin'
  );

  -- Inserting a profile row for another user is rejected by RLS.
  perform tests.expect_error(
    format(
      'insert into public.profiles (id, name, is_admin) values (%L, %L, true)',
      uid_b, 'mallory'
    ),
    'row-level security'
  );

  -- Cross-user writes on ordinary tables.
  perform tests.expect_error(
    format(
      'insert into public.households (user_id, adults) values (%L, 4)',
      uid_b
    ),
    'row-level security'
  );
end;
$$;

-- Seed B data as the review role so A can attempt to reach it.
reset role;

insert into public.households (user_id, adults, children, default_servings, members)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2, 0, 2, '[]'::jsonb);
insert into public.pantry_items (id, user_id, ingredient_id, quantity, unit)
values ('b-pantry', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rice', 1, 'kg');
insert into public.orders (id, user_id, data)
values ('b-order', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{"v":1}'::jsonb);

set role authenticated;
set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$
declare
  uid_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  affected integer;
begin
  perform tests.assert_true(
    (select count(*) from public.households where user_id = uid_b) = 0,
    'user A must not read user B household'
  );
  perform tests.assert_true(
    (select count(*) from public.pantry_items where user_id = uid_b) = 0,
    'user A must not read user B pantry'
  );
  perform tests.assert_true(
    (select count(*) from public.orders where user_id = uid_b) = 0,
    'user A must not read user B orders'
  );

  update public.households set adults = 9 where user_id = uid_b;
  get diagnostics affected = row_count;
  perform tests.assert_true(affected = 0, 'user A must not update user B household');

  delete from public.pantry_items where user_id = uid_b;
  get diagnostics affected = row_count;
  perform tests.assert_true(affected = 0, 'user A must not delete user B pantry');

  delete from public.orders where user_id = uid_b;
  get diagnostics affected = row_count;
  perform tests.assert_true(affected = 0, 'user A must not delete user B orders');
end;
$$;

-- Every table must reject a cross-user insert and a cross-user delete under
-- RLS, not only the representative tables checked above.
do $$
declare
  uid_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  tbl text;
  stmt text;
  affected integer;
begin
  foreach tbl in array array[
    'preferences','meal_plans','pantry_items','grocery_extras','grocery_lists',
    'custom_recipes','favorites','orders','audit_logs','user_settings'
  ] loop
    stmt := case tbl
      when 'preferences' then
        format('insert into public.preferences (user_id, data) values (%L, ''{}''::jsonb)', uid_b)
      when 'meal_plans' then
        format('insert into public.meal_plans (id, user_id, name, start_date) values (''x'', %L, ''x'', ''2026-01-01'')', uid_b)
      when 'pantry_items' then
        format('insert into public.pantry_items (id, user_id, ingredient_id, quantity, unit) values (''x'', %L, ''rice'', 1, ''kg'')', uid_b)
      when 'grocery_extras' then
        format('insert into public.grocery_extras (id, user_id, name, category, quantity, unit) values (''x'', %L, ''x'', ''other'', 1, ''kg'')', uid_b)
      when 'grocery_lists' then
        format('insert into public.grocery_lists (id, user_id) values (''x'', %L)', uid_b)
      when 'custom_recipes' then
        format('insert into public.custom_recipes (id, user_id, data) values (''x'', %L, ''{}''::jsonb)', uid_b)
      when 'favorites' then
        format('insert into public.favorites (user_id, recipe_id) values (%L, ''x'')', uid_b)
      when 'orders' then
        format('insert into public.orders (id, user_id, data) values (''x'', %L, ''{}''::jsonb)', uid_b)
      when 'audit_logs' then
        format('insert into public.audit_logs (id, user_id, action, detail, actor, at) values (''x'', %L, ''a'', ''d'', ''a'', now())', uid_b)
      when 'user_settings' then
        format('insert into public.user_settings (user_id) values (%L)', uid_b)
    end;
    perform tests.expect_error(stmt, 'row-level security');

    execute format('delete from public.%I where user_id = %L', tbl, uid_b);
    get diagnostics affected = row_count;
    perform tests.assert_true(
      affected = 0,
      format('user A must not delete user B rows from %s', tbl)
    );
  end loop;

  -- Tables with an UPDATE policy must not let A touch B's rows either.
  foreach tbl in array array[
    'profiles','households','preferences','meal_plans','planned_meals',
    'pantry_items','grocery_extras','grocery_lists','custom_recipes','user_settings'
  ] loop
    execute format(
      'update public.%I set updated_at = now() where %I = %L',
      tbl,
      case when tbl = 'profiles' then 'id' else 'user_id' end,
      uid_b
    );
    get diagnostics affected = row_count;
    perform tests.assert_true(
      affected = 0,
      format('user A must not update user B rows in %s', tbl)
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Insert-only history through the legacy-style path
-- ---------------------------------------------------------------------------

do $$
begin
  insert into public.orders (id, user_id, data)
  values ('a-order', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"v":1}'::jsonb);

  -- Legacy client uses upsert(..., ignoreDuplicates: true), i.e. ON CONFLICT DO NOTHING.
  insert into public.orders (id, user_id, data)
  values ('a-order', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"v":2}'::jsonb)
  on conflict (user_id, id) do nothing;

  perform tests.assert_true(
    (select data from public.orders where id = 'a-order' and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      = '{"v":1}'::jsonb,
    'repeated sync must preserve an existing order row'
  );

  -- No UPDATE privilege even if a caller tries to overwrite history.
  perform tests.expect_error(
    'update public.orders set data = ''{"v":3}''::jsonb where id = ''a-order''',
    'permission denied'
  );

  insert into public.audit_logs (id, user_id, action, detail, actor, at)
  values ('a-audit', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x', 'first', 'Alice', now());

  insert into public.audit_logs (id, user_id, action, detail, actor, at)
  values ('a-audit', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x', 'second', 'Alice', now())
  on conflict (user_id, id) do nothing;

  perform tests.assert_true(
    (select detail from public.audit_logs where id = 'a-audit' and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      = 'first',
    'repeated sync must preserve an existing audit log row'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_user_snapshot: ownership enforcement and atomic failure
-- ---------------------------------------------------------------------------

do $$
declare
  uid_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  uid_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  -- Wrong top-level owner is rejected outright.
  perform tests.expect_error(
    format(
      'select public.apply_user_snapshot(%L::jsonb)',
      jsonb_build_object('user_id', uid_b, 'orders', '[]'::jsonb)::text
    ),
    'does not match'
  );

  -- A valid full snapshot for A.
  perform public.apply_user_snapshot(
    jsonb_build_object(
      'user_id', uid_a,
      'profile', jsonb_build_object('name', 'Alice', 'phone', null, 'created_at', '2026-01-01T00:00:00Z'),
      'household', jsonb_build_object('adults', 4, 'children', 1, 'default_servings', 3, 'members', '[]'::jsonb),
      'pantry', jsonb_build_array(
        jsonb_build_object(
          'id', 'pantry-keep', 'ingredient_id', 'rice', 'quantity', 1, 'unit', 'kg',
          'expires_on', null, 'staple', false, 'added_at', '2026-01-01T00:00:00Z'
        )
      ),
      'plans', jsonb_build_array(
        jsonb_build_object(
          'id', 'plan-keep', 'name', 'Keep', 'start_date', '2026-01-01',
          'day_dates', jsonb_build_array('2026-01-01'), 'source', 'manual',
          'created_at', '2026-01-01T00:00:00Z'
        )
      ),
      'plannedMeals', '[]'::jsonb,
      'orders', jsonb_build_array(
        jsonb_build_object('id', 'a-order', 'data', jsonb_build_object('v', 2), 'created_at', '2026-01-01T00:00:00Z')
      ),
      'auditLogs', '[]'::jsonb,
      'favorites', '[]'::jsonb
    )
  );

  perform tests.assert_true(
    (select adults from public.households where user_id = uid_a) = 4,
    'RPC must apply the caller household'
  );
  perform tests.assert_true(
    (select email from public.profiles where id = uid_a) = 'a@example.com',
    'RPC must not let the payload change the profile email'
  );
  perform tests.assert_true(
    (select is_admin from public.profiles where id = uid_a) = false,
    'RPC must not let the payload grant admin'
  );
  perform tests.assert_true(
    (select data from public.orders where id = 'a-order' and user_id = uid_a) = '{"v":1}'::jsonb,
    'RPC must keep orders insert-only (existing row preserved)'
  );

  -- Payload rows claiming another user must still be written as the caller.
  perform public.apply_user_snapshot(
    jsonb_build_object(
      'user_id', uid_a,
      'household', jsonb_build_object(
        'user_id', uid_b, 'adults', 7, 'children', 0, 'default_servings', 2, 'members', '[]'::jsonb
      ),
      'pantry', '[]'::jsonb,
      'plans', '[]'::jsonb,
      'plannedMeals', '[]'::jsonb,
      'orders', '[]'::jsonb,
      'auditLogs', '[]'::jsonb,
      'favorites', '[]'::jsonb
    )
  );
  perform tests.assert_true(
    (select adults from public.households where user_id = uid_a) = 7,
    'RPC must write payload rows under the caller id'
  );
  perform tests.assert_true(
    (select count(*) from public.households where user_id = uid_b) = 0,
    'RPC caller must not gain visibility of another user rows'
  );

  -- Re-seed a plan and pantry, then force a failure after the plan insert.
  perform public.apply_user_snapshot(
    jsonb_build_object(
      'user_id', uid_a,
      'pantry', jsonb_build_array(
        jsonb_build_object(
          'id', 'pantry-keep', 'ingredient_id', 'rice', 'quantity', 1, 'unit', 'kg',
          'expires_on', null, 'staple', false, 'added_at', '2026-01-01T00:00:00Z'
        )
      ),
      'plans', jsonb_build_array(
        jsonb_build_object(
          'id', 'plan-keep', 'name', 'Keep', 'start_date', '2026-01-01',
          'day_dates', jsonb_build_array('2026-01-01'), 'source', 'manual',
          'created_at', '2026-01-01T00:00:00Z'
        )
      ),
      'plannedMeals', '[]'::jsonb,
      'orders', '[]'::jsonb,
      'auditLogs', '[]'::jsonb,
      'favorites', '[]'::jsonb
    )
  );

  -- The plan insert succeeds, then the meal insert violates the plan FK. The
  -- whole function statement must roll back, leaving the previous snapshot.
  perform tests.expect_error(
    format(
      'select public.apply_user_snapshot(%L::jsonb)',
      jsonb_build_object(
        'user_id', uid_a,
        'pantry', jsonb_build_array(
          jsonb_build_object(
            'id', 'pantry-new', 'ingredient_id', 'dal', 'quantity', 1, 'unit', 'kg',
            'expires_on', null, 'staple', false, 'added_at', '2026-01-01T00:00:00Z'
          )
        ),
        'plans', jsonb_build_array(
          jsonb_build_object(
            'id', 'plan-new', 'name', 'New', 'start_date', '2026-01-02',
            'day_dates', jsonb_build_array('2026-01-02'), 'source', 'manual',
            'created_at', '2026-01-01T00:00:00Z'
          )
        ),
        'plannedMeals', jsonb_build_array(
          jsonb_build_object(
            'id', 'meal-new', 'plan_id', 'missing-plan', 'meal_date', '2026-01-02',
            'slot', 'dinner', 'recipe_id', 'x', 'servings', 2, 'cooked', false, 'position', 0
          )
        ),
        'orders', '[]'::jsonb,
        'auditLogs', '[]'::jsonb,
        'favorites', '[]'::jsonb
      )::text
    ),
    'foreign key'
  );
end;
$$;

-- Verify the failed RPC left the previous snapshot intact.
do $$
declare
  uid_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
begin
  perform tests.assert_true(
    exists (select 1 from public.meal_plans where user_id = uid_a and id = 'plan-keep'),
    'failed RPC must leave the previous plan intact'
  );
  perform tests.assert_true(
    not exists (select 1 from public.meal_plans where user_id = uid_a and id = 'plan-new'),
    'failed RPC must not leave a partially inserted plan'
  );
  perform tests.assert_true(
    exists (select 1 from public.pantry_items where user_id = uid_a and id = 'pantry-keep'),
    'failed RPC must leave the previous pantry intact'
  );
  perform tests.assert_true(
    not exists (select 1 from public.pantry_items where user_id = uid_a and id = 'pantry-new'),
    'failed RPC must not leave a partially inserted pantry row'
  );
end;
$$;

-- As the review role, confirm user B was untouched by every RPC call above.
reset role;

do $$
declare
  uid_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  perform tests.assert_true(
    (select adults from public.households where user_id = uid_b) = 2,
    'RPC must not modify another user household'
  );
  perform tests.assert_true(
    (select count(*) from public.pantry_items where user_id = uid_b) = 1,
    'RPC must not modify another user pantry'
  );
  perform tests.assert_true(
    (select count(*) from public.orders where user_id = uid_b) = 1,
    'RPC must not modify another user orders'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Anon cannot execute the RPC or read app tables
-- ---------------------------------------------------------------------------

reset role;
set role anon;
set request.jwt.claims = '{"role":"anon"}';

do $$
begin
  perform tests.expect_error(
    'select public.apply_user_snapshot(''{"user_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'')',
    null
  );
  perform tests.expect_error('select * from public.profiles', 'permission denied');
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- Account deletion removes only the caller
-- ---------------------------------------------------------------------------

set role authenticated;
set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select public.delete_my_account();

reset role;

do $$
begin
  perform tests.assert_true(
    not exists (select 1 from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'delete_my_account must remove the caller'
  );
  perform tests.assert_true(
    exists (select 1 from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    'delete_my_account must not remove another user'
  );
end;
$$;

\echo 'ALL REVIEW CHECKS PASSED'
