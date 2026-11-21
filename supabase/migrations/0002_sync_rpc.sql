-- Atomic user snapshot apply (Supabase / PostgreSQL)
--
-- The offline client pushes a complete snapshot. Doing that as a series of
-- PostgREST calls can leave a partially replaced account if one call fails
-- after another has already deleted rows. This function applies the whole
-- snapshot in one transaction: either every statement succeeds or nothing
-- changes.
--
-- Ownership is enforced from auth.uid(), never from the payload. Every row is
-- written with the caller's id and every delete is scoped to the caller. The
-- function runs with the caller's privileges (security invoker), so RLS is
-- still enforced as a second layer. It does not use the service role.
--
-- `orders` and `audit_logs` are insert-only. They have no UPDATE policy, so the
-- function inserts with ON CONFLICT DO NOTHING and only removes rows that are
-- absent from the snapshot.
--
-- Apply after 0001_init.sql. The migration is idempotent and safe to re-run.

create or replace function public.apply_user_snapshot(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Snapshot must be a JSON object';
  end if;

  if payload->>'user_id' is distinct from uid::text then
    raise exception 'Snapshot user does not match the signed-in user';
  end if;

  -- -------------------------------------------------------------------------
  -- Singleton rows
  -- -------------------------------------------------------------------------

  if payload->'profile' is not null and payload->'profile' <> 'null'::jsonb then
    -- Email, auth method and admin status are deliberately not taken from the
    -- payload. The protect_profile_fields trigger fills them from the
    -- authoritative auth record on insert and preserves the existing values on
    -- update. Keeping this RPC as security invoker means the caller does not
    -- need direct access to the auth schema.
    insert into public.profiles (
      id, name, phone, email, auth_method, is_admin, created_at, updated_at
    )
    values (
      uid,
      coalesce(nullif(payload->'profile'->>'name', ''), 'Rasoi cook'),
      nullif(payload->'profile'->>'phone', ''),
      null,
      'email',
      false,
      coalesce((payload->'profile'->>'created_at')::timestamptz, now()),
      now()
    )
    on conflict (id) do update
      set name = excluded.name,
          phone = excluded.phone,
          updated_at = now();
  end if;

  if payload->'household' is not null and payload->'household' <> 'null'::jsonb then
    insert into public.households (
      user_id, adults, children, default_servings, members, updated_at
    )
    values (
      uid,
      coalesce((payload->'household'->>'adults')::integer, 2),
      coalesce((payload->'household'->>'children')::integer, 0),
      coalesce((payload->'household'->>'default_servings')::integer, 2),
      coalesce(payload->'household'->'members', '[]'::jsonb),
      coalesce((payload->'household'->>'updated_at')::timestamptz, now())
    )
    on conflict (user_id) do update
      set adults = excluded.adults,
          children = excluded.children,
          default_servings = excluded.default_servings,
          members = excluded.members,
          updated_at = now();
  end if;

  if payload->'preferences' is not null and payload->'preferences' <> 'null'::jsonb then
    insert into public.preferences (user_id, data, updated_at)
    values (
      uid,
      payload->'preferences'->'data',
      coalesce((payload->'preferences'->>'updated_at')::timestamptz, now())
    )
    on conflict (user_id) do update
      set data = excluded.data,
          updated_at = now();
  end if;

  if payload->'settings' is not null and payload->'settings' <> 'null'::jsonb then
    insert into public.user_settings (
      user_id, notifications, consents, auto_deduct_pantry, active_plan_id,
      recent_recipe_ids, verified_recipe_ids, cooking, cooking_history, updated_at
    )
    select
      uid,
      r.notifications,
      r.consents,
      r.auto_deduct_pantry,
      r.active_plan_id,
      r.recent_recipe_ids,
      r.verified_recipe_ids,
      r.cooking,
      r.cooking_history,
      coalesce(r.updated_at, now())
    from jsonb_populate_record(null::public.user_settings, payload->'settings') r
    on conflict (user_id) do update
      set notifications = excluded.notifications,
          consents = excluded.consents,
          auto_deduct_pantry = excluded.auto_deduct_pantry,
          active_plan_id = excluded.active_plan_id,
          recent_recipe_ids = excluded.recent_recipe_ids,
          verified_recipe_ids = excluded.verified_recipe_ids,
          cooking = excluded.cooking,
          cooking_history = excluded.cooking_history,
          updated_at = now();
  end if;

  -- -------------------------------------------------------------------------
  -- Plans and their meals (plans first so the foreign key can resolve)
  -- -------------------------------------------------------------------------

  insert into public.meal_plans (
    id, user_id, name, start_date, day_dates, source, created_at, updated_at
  )
  select
    r.id, uid, r.name, r.start_date, r.day_dates, r.source,
    coalesce(r.created_at, now()), now()
  from jsonb_populate_recordset(
    null::public.meal_plans,
    coalesce(payload->'plans', '[]'::jsonb)
  ) r
  on conflict (user_id, id) do update
    set name = excluded.name,
        start_date = excluded.start_date,
        day_dates = excluded.day_dates,
        source = excluded.source,
        updated_at = now();

  insert into public.planned_meals (
    id, user_id, plan_id, meal_date, slot, recipe_id, servings, cooked,
    position, updated_at
  )
  select
    r.id, uid, r.plan_id, r.meal_date, r.slot, r.recipe_id, r.servings,
    r.cooked, r.position, now()
  from jsonb_populate_recordset(
    null::public.planned_meals,
    coalesce(payload->'plannedMeals', '[]'::jsonb)
  ) r
  on conflict (user_id, id) do update
    set plan_id = excluded.plan_id,
        meal_date = excluded.meal_date,
        slot = excluded.slot,
        recipe_id = excluded.recipe_id,
        servings = excluded.servings,
        cooked = excluded.cooked,
        position = excluded.position,
        updated_at = now();

  delete from public.planned_meals pm
  where pm.user_id = uid
    and not exists (
      select 1
      from jsonb_populate_recordset(
        null::public.planned_meals,
        coalesce(payload->'plannedMeals', '[]'::jsonb)
      ) r
      where r.id = pm.id
    );

  delete from public.meal_plans p
  where p.user_id = uid
    and not exists (
      select 1
      from jsonb_populate_recordset(
        null::public.meal_plans,
        coalesce(payload->'plans', '[]'::jsonb)
      ) r
      where r.id = p.id
    );

  -- -------------------------------------------------------------------------
  -- Working grocery list
  -- -------------------------------------------------------------------------

  if payload->'groceryList' is not null and payload->'groceryList' <> 'null'::jsonb then
    insert into public.grocery_lists (
      id, user_id, plan_id, checked_items, created_at, updated_at
    )
    values (
      coalesce(nullif(payload->'groceryList'->>'id', ''), 'active'),
      uid,
      nullif(payload->'groceryList'->>'plan_id', ''),
      coalesce(payload->'groceryList'->'checked_items', '{}'::jsonb),
      coalesce((payload->'groceryList'->>'created_at')::timestamptz, now()),
      now()
    )
    on conflict (user_id, id) do update
      set plan_id = excluded.plan_id,
          checked_items = excluded.checked_items,
          updated_at = now();
  end if;

  -- -------------------------------------------------------------------------
  -- Replaceable collections
  -- -------------------------------------------------------------------------

  insert into public.pantry_items (
    id, user_id, ingredient_id, quantity, unit, expires_on, staple,
    added_at, updated_at
  )
  select
    r.id, uid, r.ingredient_id, r.quantity, r.unit, r.expires_on, r.staple,
    coalesce(r.added_at, now()), now()
  from jsonb_populate_recordset(
    null::public.pantry_items,
    coalesce(payload->'pantry', '[]'::jsonb)
  ) r
  on conflict (user_id, id) do update
    set ingredient_id = excluded.ingredient_id,
        quantity = excluded.quantity,
        unit = excluded.unit,
        expires_on = excluded.expires_on,
        staple = excluded.staple,
        updated_at = now();

  delete from public.pantry_items item
  where item.user_id = uid
    and not exists (
      select 1
      from jsonb_populate_recordset(
        null::public.pantry_items,
        coalesce(payload->'pantry', '[]'::jsonb)
      ) r
      where r.id = item.id
    );

  insert into public.grocery_extras (
    id, user_id, name, category, quantity, unit, note, added_at, updated_at
  )
  select
    r.id, uid, r.name, r.category, r.quantity, r.unit, r.note,
    coalesce(r.added_at, now()), now()
  from jsonb_populate_recordset(
    null::public.grocery_extras,
    coalesce(payload->'extras', '[]'::jsonb)
  ) r
  on conflict (user_id, id) do update
    set name = excluded.name,
        category = excluded.category,
        quantity = excluded.quantity,
        unit = excluded.unit,
        note = excluded.note,
        updated_at = now();

  delete from public.grocery_extras extra
  where extra.user_id = uid
    and not exists (
      select 1
      from jsonb_populate_recordset(
        null::public.grocery_extras,
        coalesce(payload->'extras', '[]'::jsonb)
      ) r
      where r.id = extra.id
    );

  insert into public.custom_recipes (
    id, user_id, data, created_at, updated_at
  )
  select
    r.id, uid, r.data, coalesce(r.created_at, now()), now()
  from jsonb_populate_recordset(
    null::public.custom_recipes,
    coalesce(payload->'customRecipes', '[]'::jsonb)
  ) r
  on conflict (user_id, id) do update
    set data = excluded.data,
        updated_at = now();

  delete from public.custom_recipes recipe
  where recipe.user_id = uid
    and not exists (
      select 1
      from jsonb_populate_recordset(
        null::public.custom_recipes,
        coalesce(payload->'customRecipes', '[]'::jsonb)
      ) r
      where r.id = recipe.id
    );

  -- -------------------------------------------------------------------------
  -- Insert-only history: orders and audit logs have no UPDATE policy.
  -- Existing ids are preserved exactly as stored; only absent ids are removed.
  -- -------------------------------------------------------------------------

  insert into public.orders (id, user_id, data, created_at, updated_at)
  select
    r.id, uid, r.data, coalesce(r.created_at, now()), now()
  from jsonb_populate_recordset(
    null::public.orders,
    coalesce(payload->'orders', '[]'::jsonb)
  ) r
  on conflict (user_id, id) do nothing;

  delete from public.orders ord
  where ord.user_id = uid
    and not exists (
      select 1
      from jsonb_populate_recordset(
        null::public.orders,
        coalesce(payload->'orders', '[]'::jsonb)
      ) r
      where r.id = ord.id
    );

  insert into public.audit_logs (id, user_id, action, detail, actor, at)
  select
    r.id, uid, r.action, r.detail, r.actor, r.at
  from jsonb_populate_recordset(
    null::public.audit_logs,
    coalesce(payload->'auditLogs', '[]'::jsonb)
  ) r
  on conflict (user_id, id) do nothing;

  delete from public.audit_logs entry
  where entry.user_id = uid
    and not exists (
      select 1
      from jsonb_populate_recordset(
        null::public.audit_logs,
        coalesce(payload->'auditLogs', '[]'::jsonb)
      ) r
      where r.id = entry.id
    );

  -- -------------------------------------------------------------------------
  -- Favourites
  -- -------------------------------------------------------------------------

  insert into public.favorites (user_id, recipe_id, created_at)
  select uid, r.recipe_id, coalesce(r.created_at, now())
  from jsonb_populate_recordset(
    null::public.favorites,
    coalesce(payload->'favorites', '[]'::jsonb)
  ) r
  on conflict (user_id, recipe_id) do nothing;

  delete from public.favorites fav
  where fav.user_id = uid
    and not exists (
      select 1
      from jsonb_populate_recordset(
        null::public.favorites,
        coalesce(payload->'favorites', '[]'::jsonb)
      ) r
      where r.recipe_id = fav.recipe_id
    );
end;
$$;

revoke all on function public.apply_user_snapshot(jsonb) from public;
grant execute on function public.apply_user_snapshot(jsonb) to authenticated;
