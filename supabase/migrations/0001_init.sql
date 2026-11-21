-- Rasoi cloud schema (Supabase / PostgreSQL)
--
-- Every table is scoped to the signed-in auth user and protected by Row Level
-- Security. The client is never trusted to set its own role: a trigger pins
-- `is_admin` to false for client writes, and only the demo entry point can
-- present an admin console locally.
--
-- Apply with: supabase db push
-- or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Rasoi cook' check (char_length(name) between 1 and 80),
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  email text,
  auth_method text not null default 'email' check (auth_method in ('email', 'phone', 'demo')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Roles and identity are server-owned. A client may only change presentation
-- fields (name, phone). Email mirrors the auth record and is not editable here.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'anon') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.email := auth.jwt() ->> 'email';
      new.auth_method := case
        when (auth.jwt() ->> 'phone') is not null and (auth.jwt() ->> 'email') is null then 'phone'
        else 'email'
      end;
    else
      new.id := old.id;
      new.is_admin := old.is_admin;
      new.created_at := old.created_at;
      new.email := old.email;
      new.auth_method := old.auth_method;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before insert or update on public.profiles
  for each row execute function public.protect_profile_fields();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A profile row is created the moment an auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone, auth_method)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'Rasoi cook'), '@', 1)),
    new.email,
    new.phone,
    case when new.phone is not null and new.email is null then 'phone' else 'email' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Household and preferences
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  user_id uuid primary key references auth.users (id) on delete cascade,
  adults integer not null default 2 check (adults between 0 and 30),
  children integer not null default 0 check (children between 0 and 30),
  default_servings integer not null default 2 check (default_servings between 1 and 50),
  members jsonb not null default '[]'::jsonb check (jsonb_typeof(members) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.households enable row level security;

drop policy if exists "households_select_own" on public.households;
create policy "households_select_own" on public.households
  for select using ((select auth.uid()) = user_id);
drop policy if exists "households_insert_own" on public.households;
create policy "households_insert_own" on public.households
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "households_update_own" on public.households;
create policy "households_update_own" on public.households
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "households_delete_own" on public.households;
create policy "households_delete_own" on public.households
  for delete using ((select auth.uid()) = user_id);

drop trigger if exists households_touch_updated_at on public.households;
create trigger households_touch_updated_at
  before update on public.households
  for each row execute function public.touch_updated_at();

create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.preferences enable row level security;

drop policy if exists "preferences_select_own" on public.preferences;
create policy "preferences_select_own" on public.preferences
  for select using ((select auth.uid()) = user_id);
drop policy if exists "preferences_insert_own" on public.preferences;
create policy "preferences_insert_own" on public.preferences
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "preferences_update_own" on public.preferences;
create policy "preferences_update_own" on public.preferences
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "preferences_delete_own" on public.preferences;
create policy "preferences_delete_own" on public.preferences
  for delete using ((select auth.uid()) = user_id);

drop trigger if exists preferences_touch_updated_at on public.preferences;
create trigger preferences_touch_updated_at
  before update on public.preferences
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Plans, pantry, grocery extras
-- ---------------------------------------------------------------------------

create table if not exists public.meal_plans (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  start_date date not null,
  days jsonb not null default '[]'::jsonb check (jsonb_typeof(days) = 'array'),
  source text not null default 'manual' check (source in ('generated', 'manual', 'demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists meal_plans_user_start_idx on public.meal_plans (user_id, start_date desc);

alter table public.meal_plans enable row level security;

drop policy if exists "meal_plans_select_own" on public.meal_plans;
create policy "meal_plans_select_own" on public.meal_plans
  for select using ((select auth.uid()) = user_id);
drop policy if exists "meal_plans_insert_own" on public.meal_plans;
create policy "meal_plans_insert_own" on public.meal_plans
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "meal_plans_update_own" on public.meal_plans;
create policy "meal_plans_update_own" on public.meal_plans
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "meal_plans_delete_own" on public.meal_plans;
create policy "meal_plans_delete_own" on public.meal_plans
  for delete using ((select auth.uid()) = user_id);

drop trigger if exists meal_plans_touch_updated_at on public.meal_plans;
create trigger meal_plans_touch_updated_at
  before update on public.meal_plans
  for each row execute function public.touch_updated_at();

create table if not exists public.pantry_items (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  ingredient_id text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'tbsp', 'tsp', 'cup')),
  expires_on date,
  staple boolean not null default false,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists pantry_items_user_idx on public.pantry_items (user_id);

alter table public.pantry_items enable row level security;

drop policy if exists "pantry_items_select_own" on public.pantry_items;
create policy "pantry_items_select_own" on public.pantry_items
  for select using ((select auth.uid()) = user_id);
drop policy if exists "pantry_items_insert_own" on public.pantry_items;
create policy "pantry_items_insert_own" on public.pantry_items
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "pantry_items_update_own" on public.pantry_items;
create policy "pantry_items_update_own" on public.pantry_items
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "pantry_items_delete_own" on public.pantry_items;
create policy "pantry_items_delete_own" on public.pantry_items
  for delete using ((select auth.uid()) = user_id);

drop trigger if exists pantry_items_touch_updated_at on public.pantry_items;
create trigger pantry_items_touch_updated_at
  before update on public.pantry_items
  for each row execute function public.touch_updated_at();

create table if not exists public.grocery_extras (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'tbsp', 'tsp', 'cup')),
  note text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.grocery_extras enable row level security;

drop policy if exists "grocery_extras_select_own" on public.grocery_extras;
create policy "grocery_extras_select_own" on public.grocery_extras
  for select using ((select auth.uid()) = user_id);
drop policy if exists "grocery_extras_insert_own" on public.grocery_extras;
create policy "grocery_extras_insert_own" on public.grocery_extras
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "grocery_extras_update_own" on public.grocery_extras;
create policy "grocery_extras_update_own" on public.grocery_extras
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "grocery_extras_delete_own" on public.grocery_extras;
create policy "grocery_extras_delete_own" on public.grocery_extras
  for delete using ((select auth.uid()) = user_id);

drop trigger if exists grocery_extras_touch_updated_at on public.grocery_extras;
create trigger grocery_extras_touch_updated_at
  before update on public.grocery_extras
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Custom recipes, favourites, orders, audit log
-- ---------------------------------------------------------------------------

create table if not exists public.custom_recipes (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.custom_recipes enable row level security;

drop policy if exists "custom_recipes_select_own" on public.custom_recipes;
create policy "custom_recipes_select_own" on public.custom_recipes
  for select using ((select auth.uid()) = user_id);
drop policy if exists "custom_recipes_insert_own" on public.custom_recipes;
create policy "custom_recipes_insert_own" on public.custom_recipes
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "custom_recipes_update_own" on public.custom_recipes;
create policy "custom_recipes_update_own" on public.custom_recipes
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "custom_recipes_delete_own" on public.custom_recipes;
create policy "custom_recipes_delete_own" on public.custom_recipes
  for delete using ((select auth.uid()) = user_id);

drop trigger if exists custom_recipes_touch_updated_at on public.custom_recipes;
create trigger custom_recipes_touch_updated_at
  before update on public.custom_recipes
  for each row execute function public.touch_updated_at();

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
  for select using ((select auth.uid()) = user_id);
drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own" on public.favorites
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own" on public.favorites
  for delete using ((select auth.uid()) = user_id);

create table if not exists public.orders (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.orders enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using ((select auth.uid()) = user_id);
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "orders_delete_own" on public.orders;
create policy "orders_delete_own" on public.orders
  for delete using ((select auth.uid()) = user_id);

create table if not exists public.audit_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  detail text not null,
  actor text not null,
  at timestamptz not null,
  primary key (user_id, id)
);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own" on public.audit_logs
  for select using ((select auth.uid()) = user_id);
drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "audit_logs_delete_own" on public.audit_logs;
create policy "audit_logs_delete_own" on public.audit_logs
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Singleton settings (grocery checks, consents, notifications, cooking)
-- ---------------------------------------------------------------------------

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notifications jsonb not null default '{}'::jsonb check (jsonb_typeof(notifications) = 'object'),
  consents jsonb not null default '{}'::jsonb check (jsonb_typeof(consents) = 'object'),
  auto_deduct_pantry boolean not null default true,
  active_plan_id text,
  recent_recipe_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(recent_recipe_ids) = 'array'),
  verified_recipe_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(verified_recipe_ids) = 'array'),
  checked_items jsonb not null default '{}'::jsonb check (jsonb_typeof(checked_items) = 'object'),
  cooking jsonb,
  cooking_history jsonb not null default '[]'::jsonb check (jsonb_typeof(cooking_history) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select using ((select auth.uid()) = user_id);
drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own" on public.user_settings
  for delete using ((select auth.uid()) = user_id);

drop trigger if exists user_settings_touch_updated_at on public.user_settings;
create trigger user_settings_touch_updated_at
  before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------

-- Supabase does not let the anon/authenticated key delete from auth.users, so
-- deletion runs in a security-definer function that only acts on the caller.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Grants (RLS still restricts every row to its owner)
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.households,
  public.preferences,
  public.meal_plans,
  public.pantry_items,
  public.grocery_extras,
  public.custom_recipes,
  public.favorites,
  public.orders,
  public.audit_logs,
  public.user_settings
to authenticated;

revoke all on
  public.profiles,
  public.households,
  public.preferences,
  public.meal_plans,
  public.pantry_items,
  public.grocery_extras,
  public.custom_recipes,
  public.favorites,
  public.orders,
  public.audit_logs,
  public.user_settings
from anon;
