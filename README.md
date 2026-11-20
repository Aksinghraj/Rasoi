# Rasoi — plan · cook · shop

Rasoi is an India-first meal planning and smart grocery app built with Expo and React Native. It turns a household's diet, allergies, pantry and budget into a week of meals, one consolidated grocery list, and an honest hand-off to a retailer.

> Rasoi is an original product. It is inspired by the problem space, not by any other app's brand, content or assets. Recipe text, photography sources and pricing in this repository are demo data.

---

## What works

- **Phone or email OTP sign-in** with an on-screen demo code (no SMS/email provider required).
- **Demo kitchen** that seeds a household, pantry, favourites and a generated week so every screen has content.
- **10-step onboarding**: household, diet, allergens, restrictions, dislikes, equipment, budget, meal types, location and review.
- **Recipe discovery**: search, meal-slot filters, sort, filters, pantry mode, quick mode, budget mode, high-protein mode, favourites and "surprise me".
- **Recommendation engine** that scores recipes on diet fit, region, pantry coverage, cooking time, budget, season and protein.
- **7-day planner**: generate a week, regenerate a day or week, add/replace/remove meals, change servings, copy a meal or a day, duplicate a plan, start from a blank week.
- **Ingredient aggregation engine**: unit normalisation, duplicate merging, pantry deduction and pack-size optimisation.
- **Pantry**: add/edit/remove items, expiry warnings, staples, auto-deduct toggle.
- **Consolidated grocery list**: category sections, checked state, pantry-covered lines, extras, retailer comparison and share.
- **Retailer adapter layer** with two truthful modes:
  - **Mode A — sandbox** (`Rasoi Market`): local cart and simulated checkout. Clearly labelled; never places a real order.
  - **Mode B — approved deep link** (BigBasket, Blinkit, Zepto, Swiggy Instamart): prepares the list and opens the retailer search. Prices, stock, payment and delivery stay with the retailer.
- **Cooking mode**: one step at a time, per-step timers, ingredient checklist, resume support and completion history.
- **Custom recipes** with ingredient picker, steps, equipment and estimated nutrition and cost.
- **Preferences and privacy**: diet/allergen/restriction editing, budget, location, language, consent toggles, JSON export and account deletion.
- **Demo admin console**: analytics, recipe verification, ingredient master, retailer status and audit log.
- **Automated engine tests** (25 tests) covering conversions, aggregation, pantry deduction, pack optimisation, allergen safety, planner and adapter honesty.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Expo SDK 54, React Native 0.81, React 19 |
| Language | TypeScript (strict) |
| Routing | Expo Router (file-based) |
| State | React Context + reducer-style updates, persisted to AsyncStorage |
| UI | React Native primitives + a small in-repo design system (`components/ui.tsx`) |
| Icons | `lucide-react-native` |
| Tests | `bun test` |
| Package manager | bun |

No state library, UI kit or backend is required to run the demo.

---

## Getting started

```bash
bun install
bun run dev        # Expo dev server on port 4000
bun run typecheck  # tsc --noEmit
bun test           # engine tests
```

### Demo credentials

On the auth screen choose **Explore the demo kitchen**. The demo user is an admin so the admin console is visible from Profile → Admin.

Real sign-in uses a generated 6-digit OTP shown on screen and valid for five minutes. No message is actually sent; the flow is deterministic for testing.

### Environment

The demo runs with no secrets. A production deployment would add (server-side only):

```
DATABASE_URL=postgres://…
OTP_PROVIDER_KEY=…
RETAILER_CLIENT_ID=…
RETAILER_CLIENT_SECRET=…
```

Never put retailer secrets in the app bundle. Adapters are designed to call a backend proxy.

---

## Project structure

```
app/
  _layout.tsx              AppProvider + auth/onboarding route guards
  index.tsx                session-aware redirect
  auth.tsx                 phone/email OTP + demo kitchen
  onboarding.tsx           10-step onboarding with review
  (tabs)/
    _layout.tsx            5 tabs: Home, Recipes, Plan, Grocery, Profile
    index.tsx              home dashboard
    recipes.tsx            discovery and filters
    plan.tsx               week planner
    grocery.tsx            consolidated shopping list
    profile.tsx            household, settings, account
  recipe/[id].tsx          recipe detail with scaled ingredients
  recipe/create.tsx        custom recipe form
  cook/[id].tsx            cooking mode with timers
  plan/add.tsx             meal picker (add or replace)
  pantry.tsx               pantry management
  checkout/[retailerId].tsx retailer hand-off / sandbox checkout
  preferences.tsx          diet, safety, budget, location
  privacy.tsx              consent, export, deletion, grievance
  admin.tsx                demo admin console
components/
  ui.tsx                   design system primitives
  RecipeCard.tsx           recipe card variants
lib/
  types.ts                 domain model
  theme.ts                 colours, spacing, labels
  categories.ts            category labels/order (engine-safe, no RN import)
  format.ts                INR/date/quantity formatting and validators
  data/                    ingredients, recipes, product catalogue
  engine/                  units, allergens, grocery, planner, recommendation
  retailers/adapters.ts    retailer adapter interface and implementations
  store/AppContext.tsx     persistence, auth, plans, pantry, cooking, audit
tests/engine.test.ts       engine and adapter tests
```

### Data flow

```
UI action
  → AppContext action (validated, pure-ish state update)
  → engine (planner / grocery / recommendation / allergens)
  → state persisted to AsyncStorage (debounced 250 ms)
  → screens re-render from context
```

Engines are pure functions over plain data. That keeps the important logic testable without React Native, which is why `lib/categories.ts` exists separately from `lib/theme.ts`.

### Safety model

- **Allergens, custom exclusions and diet are hard constraints.** A recipe containing them is excluded from recommendations and the planner.
- **Restrictions and dislikes are soft.** Restrictions reduce the score; dislikes are a preference signal. Nothing is ever silently substituted.
- **Pantry is user-declared.** Rasoi never assumes an ingredient is available.
- **No retailer claim is invented.** Sandbox orders are labelled `sandbox_created`; deep-link hand-offs are `handed_off` or `copied`; nothing is called "placed".

---

## Production database schema (PostgreSQL)

The demo uses AsyncStorage. A production backend would use PostgreSQL. Suggested schema:

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  email text unique,
  name text not null,
  auth_method text not null check (auth_method in ('phone','email','demo')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table otp_requests (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  channel text not null check (channel in ('phone','email')),
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  adults int not null default 1,
  children int not null default 0,
  default_servings int not null default 2
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  age_group text not null check (age_group in ('adult','child')),
  diet text
);

create table preferences (
  user_id uuid primary key references users(id) on delete cascade,
  country text not null default 'India',
  state text,
  city text,
  pincode text,
  locality text,
  diet text not null,
  region text,
  restrictions text[] not null default '{}',
  allergens text[] not null default '{}',
  custom_exclusions text[] not null default '{}',
  dislikes text[] not null default '{}',
  equipment text[] not null default '{}',
  budget_daily numeric(10,2) not null,
  budget_weekly numeric(10,2) not null,
  budget_monthly numeric(10,2) not null,
  meal_types text[] not null default '{}',
  cooking_time text not null default 'balanced',
  plan_day text not null default 'monday',
  language text not null default 'en',
  updated_at timestamptz not null default now()
);

create table consents (
  user_id uuid primary key references users(id) on delete cascade,
  analytics boolean not null default false,
  personalisation boolean not null default true,
  offers boolean not null default false,
  retailer_sharing boolean not null default false,
  updated_at timestamptz not null default now()
);

create table notification_settings (
  user_id uuid primary key references users(id) on delete cascade,
  weekly_plan boolean not null default true,
  grocery_reminder boolean not null default true,
  pantry_expiry boolean not null default true,
  cooking_reminder boolean not null default false,
  offers boolean not null default false
);

create table ingredients (
  id text primary key,
  name text not null,
  hindi_name text,
  category text not null,
  dimension text not null check (dimension in ('weight','volume','piece')),
  aliases text[] not null default '{}',
  allergens text[] not null default '{}',
  piece_grams numeric(10,2),
  density numeric(10,4),
  price_per_base numeric(10,4) not null,
  staple boolean not null default false
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references users(id) on delete cascade,
  name text not null,
  description text not null default '',
  cuisine text not null,
  region text not null,
  meal_types text[] not null,
  diet_types text[] not null,
  food_type text not null,
  image_url text,
  prep_minutes int not null,
  cook_minutes int not null,
  difficulty text not null,
  base_servings int not null,
  nutrition jsonb not null,
  tags text[] not null default '{}',
  equipment text[] not null default '{}',
  season text not null default 'all',
  cost_per_serving numeric(10,2) not null,
  curated boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table recipe_ingredients (
  recipe_id uuid not null references recipes(id) on delete cascade,
  position int not null,
  ingredient_id text not null references ingredients(id),
  quantity numeric(10,3) not null,
  unit text not null,
  optional boolean not null default false,
  note text,
  primary key (recipe_id, position)
);

create table recipe_steps (
  recipe_id uuid not null references recipes(id) on delete cascade,
  position int not null,
  text text not null,
  tip text,
  timer_minutes int,
  primary key (recipe_id, position)
);

create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  start_date date not null,
  source text not null check (source in ('generated','manual','demo')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table planned_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references meal_plans(id) on delete cascade,
  meal_date date not null,
  slot text not null check (slot in ('breakfast','lunch','dinner','snack')),
  recipe_id uuid not null references recipes(id),
  servings int not null check (servings > 0),
  cooked boolean not null default false
);

create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  ingredient_id text not null references ingredients(id),
  quantity numeric(10,3) not null,
  unit text not null,
  expires_on date,
  staple boolean not null default false,
  added_at timestamptz not null default now()
);

create table extra_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  category text not null,
  quantity numeric(10,3) not null,
  unit text not null,
  note text,
  added_at timestamptz not null default now()
);

create table retailers (
  id text primary key,
  name text not null,
  mode text not null check (mode in ('A','B','C')),
  status text not null check (status in ('sandbox','deeplink','manual')),
  deep_link_base text,
  minimum_order numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0
);

create table retailer_products (
  id text primary key,
  retailer_id text not null references retailers(id),
  ingredient_id text not null references ingredients(id),
  name text not null,
  brand text,
  pack_size numeric(10,3) not null,
  pack_unit text not null,
  price numeric(10,2) not null,
  mrp numeric(10,2),
  in_stock boolean not null default true,
  verified_at timestamptz not null
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  retailer_id text not null references retailers(id),
  mode text not null,
  status text not null check (status in ('sandbox_created','handed_off','copied','failed')),
  total numeric(10,2) not null default 0,
  item_count int not null default 0,
  note text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table cooking_sessions (
  user_id uuid primary key references users(id) on delete cascade,
  recipe_id uuid not null references recipes(id),
  servings int not null,
  step_index int not null default 0,
  checked_ingredients text[] not null default '{}',
  started_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  detail text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create index planned_meals_plan_date on planned_meals(plan_id, meal_date);
create index pantry_items_user on pantry_items(user_id);
create index retailer_products_lookup on retailer_products(retailer_id, ingredient_id);
create index audit_logs_user_created on audit_logs(user_id, created_at desc);
```

Notes:

- Money is stored as `numeric`, never floating point.
- Ingredient quantities are normalised to a canonical base unit before storage where possible.
- `orders` records what actually happened, including `copied` and `handed_off`, so the product never overstates a transaction.

---

## API specification

All endpoints are JSON over HTTPS and authenticated with a session bearer token. Errors use `{ "error": { "code": string, "message": string } }`.

### Auth

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/otp` | Request an OTP for phone or email |
| POST | `/auth/verify` | Verify OTP and create a session |
| POST | `/auth/signout` | Revoke the current session |
| DELETE | `/account` | Delete the account and all owned data |

### Profile and preferences

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | User, household, preferences, consents |
| PATCH | `/me` | Update name/email |
| PUT | `/household` | Replace household and members |
| PATCH | `/preferences` | Patch diet, allergens, restrictions, budget, location |
| PATCH | `/consents` | Update consent flags |
| PATCH | `/notifications` | Update notification settings |
| GET | `/export` | Full JSON data export |

### Recipes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/recipes?query=&mealType=&diet=&maxTime=&maxCost=` | Search and filter |
| GET | `/recipes/recommended` | Ranked recommendations with reasons |
| GET | `/recipes/:id` | Recipe detail |
| POST | `/recipes` | Create a custom recipe |
| DELETE | `/recipes/:id` | Delete an owned custom recipe |
| POST | `/recipes/:id/favorite` | Toggle favourite |
| POST | `/recipes/:id/verify` | Admin: toggle verification |

### Plans

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/plans` | List plans |
| POST | `/plans` | Create an empty or generated plan |
| GET | `/plans/:id` | Plan with days and meals |
| PATCH | `/plans/:id` | Rename, set start date, activate |
| DELETE | `/plans/:id` | Delete plan |
| POST | `/plans/:id/meals` | Add a meal to a date and slot |
| PATCH | `/plans/:id/meals/:mealId` | Change servings or replace recipe |
| DELETE | `/plans/:id/meals/:mealId` | Remove meal |
| POST | `/plans/:id/regenerate` | Regenerate a day or the week |
| POST | `/plans/:id/copy` | Duplicate to a new start date |

### Pantry and grocery

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/pantry` | List pantry items |
| POST | `/pantry` | Add item |
| PATCH | `/pantry/:id` | Update quantity, expiry, staple |
| DELETE | `/pantry/:id` | Remove item |
| GET | `/grocery?planId=` | Aggregated list with pantry deduction and pricing |
| POST | `/extras` | Add an extra item |
| DELETE | `/extras/:id` | Remove an extra |
| PATCH | `/checked` | Persist checked-off keys |

### Retailers

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/retailers` | List retailers and modes |
| GET | `/retailers/:id/serviceability?pincode=` | Serviceability check |
| POST | `/retailers/:id/carts` | Create a cart (sandbox or server proxy) |
| POST | `/retailers/:id/carts/:cartId/checkout` | Initiate checkout |
| GET | `/retailers/:id/orders/:orderId` | Order status |
| POST | `/orders` | Record a hand-off or copied list |

The mobile adapter interface (`lib/retailers/adapters.ts`) maps one-to-one onto these endpoints. Sandbox responses are returned by the server in development; deep-link mode returns `501 Not Supported` for cart and checkout.

### Admin

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/analytics` | Counts, basket value, activity |
| GET | `/admin/users` | User list |
| GET | `/admin/audit` | Audit log |
| GET | `/admin/ingredients` | Ingredient master |
| GET | `/admin/retailers` | Retailer health |

---

## Retailer integration

The app deliberately separates **what it can honestly do** from **what the retailer controls**.

### Mode A — sandbox

`SandboxRetailerAdapter` keeps carts in memory for the session, prices lines from the deterministic demo catalogue and simulates checkout. Every response carries a note stating that nothing was ordered and no payment was taken. Order records use status `sandbox_created`.

### Mode B — approved deep link

`DeepLinkRetailerAdapter` supports only `getDeepLink(query)`. Cart and checkout calls throw `RetailerNotSupportedError`, which the UI surfaces instead of pretending to work. Opening a link records a `handed_off` order; sharing the list records `copied`.

### Mode C — manual

A plain shopping list the user takes to any shop. No retailer API is involved.

### Adding a real retailer API

1. Add a server route that holds OAuth2 client credentials and calls the retailer API.
2. Implement `RetailerAdapter` against that route; keep the same capability flags.
3. Only set `capabilities.cart` and `capabilities.checkout` to `true` when the live API is actually verified end to end.
4. Keep `getServiceability` and `getPricing` truthful; return `null`/throw when the data is not available.
5. Never store retailer secrets in the app. The adapter must talk to your backend.
6. Add contract tests for 401, 429, out-of-stock and partial-match responses.

---

## Testing

```bash
bun test
```

Covered:

- weight, volume, piece and spoon conversions, including density and piece weights
- merging the same ingredient across recipes (paneer 200 g + 250 g = 450 g)
- pantry deduction and pantry-covered status
- auto-deduct off behaviour
- pack optimisation never buying below the required quantity
- allergen, vegan, custom-exclusion and dairy-free blocking
- planner servings add/update
- deep-link adapters refusing unsupported operations
- sandbox cart/checkout never claiming a real order

Type checking:

```bash
bun run typecheck
```

---

## Privacy and compliance notes

- Consent is explicit and separate for personalisation, analytics, offers and retailer sharing.
- Data is stored locally in this build; the privacy screen explains exactly what is stored and where.
- Account deletion removes all local data immediately.
- JSON export is available in-app.
- The grievance contact is a placeholder (`grievance@rasoi.example`) and must be replaced before launch.
- Deep-link mode does not place orders. Consumer-facing copy must never imply otherwise.
- Allergen filtering is a safety aid, not a medical guarantee. Packaging and restaurant cross-contamination must still be checked by the user.

---

## Delivery phases

| Phase | Scope |
| --- | --- |
| 1. Foundations | Design system, domain types, ingredient/recipe data, auth, onboarding, local persistence |
| 2. Planning | Recommendation engine, 7-day planner, servings, regeneration, copy/duplicate |
| 3. Shopping | Aggregation, pantry deduction, pack optimisation, grocery list, extras, sharing |
| 4. Retailer layer | Adapter interface, sandbox mode, deep-link mode, truthful order records |
| 5. Cooking & profile | Cooking mode, timers, custom recipes, preferences, privacy, admin |
| 6. Hardening | Engine tests, typecheck, accessibility passes, error/empty/loading states |
| 7. Production | Postgres + API, real OTP, server-side retailer proxy, observability, DPDP review |

---

## Known limitations

- Recipe content and product prices are demo data. They are not live prices and must not be presented as such.
- The OTP is displayed on screen for testing; a production build needs an SMS/email provider and server-side verification.
- Sandbox carts are in-memory for the session and are not persisted across app restarts.
- Nutrition for custom recipes is an estimate derived from category averages.
- Only English and a partial Hindi label are provided; full localisation is future work.
