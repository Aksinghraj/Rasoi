# Backend: Supabase accounts and sync

Rasoi works fully offline. Cloud accounts are **optional** and activate only when both public Supabase environment variables are present.

## Modes

| Mode | When | Behaviour |
| --- | --- | --- |
| Device-only | `EXPO_PUBLIC_SUPABASE_URL` or the anon key is missing | Everything is stored in AsyncStorage on this device. The auth and profile screens say cloud sync is off. Phone/email OTP uses the on-screen demo code. |
| Cloud | Both variables are set | Real Supabase Auth sessions, Postgres storage and offline-first sync. |

The app never pretends a cloud feature is available when it is not configured.

## Exact setup steps

1. **Create the project.** In the Supabase dashboard choose *New project*, pick a region close to your users and set a database password you store in your own password manager.
2. **Copy the client keys.** Go to *Project settings → API*. Copy:
   - *Project URL* → `EXPO_PUBLIC_SUPABASE_URL`
   - *Project API keys → anon public* → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   Do **not** copy the `service_role` key into the app.
3. **Configure email auth.** Go to *Authentication → Providers → Email*:
   - Enable *Email*.
   - For one-time codes, enable *Email OTP* (Supabase sends the six-digit code used by `sendEmailCode`).
   - For password accounts, decide whether *Confirm email* is on. If it is, `signUpWithPassword` returns `needsConfirmation` and the user must confirm before signing in.
   - Under *Authentication → URL Configuration*:
     - **Site URL**: the public HTTPS origin of the app (for example the current preview origin). Never leave this as `http://localhost:4000`, because Supabase falls back to the Site URL when a redirect is not allowlisted.
     - **Redirect URLs**: add the exact callback URL, `<origin>/auth/callback`. Add one entry per environment (preview, staging, production) plus `rasoi://auth/callback` for the production Android deep link.
   - Supabase silently ignores an `emailRedirectTo` that is not allowlisted and sends the link to the Site URL instead. That is the usual reason a phone shows `localhost:4000`.
4. **Apply the schema.** Either:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
   or paste `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_sync_rpc.sql`, into the *SQL editor* and run them in that order. Both migrations are idempotent and safe to re-run. `0002` is what makes sync atomic; without it the app uses the documented legacy fallback.
5. **Create `.env`.** Copy the template and fill in the two public values:
   ```bash
   cp .env.example .env
   ```
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   ```
6. **Restart the Expo dev server** so the new `EXPO_PUBLIC_*` values are inlined.
7. **Verify.** Open the app → *Sign in* → choose *Password* or an email one-time code. Then open *Profile*: the sync card should read **Synced to the cloud** with a recent timestamp. In the Supabase dashboard, *Table editor* should show rows in `profiles`, `households`, `preferences`, `meal_plans`, `planned_meals` and `grocery_lists`.
8. **Confirm isolation.** Sign in as a second account and check that neither account can see the other's rows. RLS is the enforcement point; the app also scopes every query by `user_id`.

### Environment rules

- Only the **anon** key is public. Never ship the service-role key in the app.
- The URL must be `https://` (or `http://localhost` for local Supabase).
- Config is read by `lib/supabase/config.ts`; an invalid URL or a key shorter than 20 characters is treated as "not configured".
- `.env` is git-ignored; `.env.example` is committed with placeholders.

### Tables

| Table | Purpose | Key |
| --- | --- | --- |
| `profiles` | name, phone, email, auth method, admin flag | `id` (= auth user) |
| `households` | adults, children, default servings, members | `user_id` |
| `preferences` | diet, allergens, budget, location, equipment | `user_id` |
| `meal_plans` | plan name, start date, ordered day dates | `(user_id, id)` |
| `planned_meals` | one row per meal: plan, date, slot, recipe, servings, cooked | `(user_id, id)` |
| `pantry_items` | ingredient, quantity, unit, expiry, staple | `(user_id, id)` |
| `grocery_extras` | manual grocery additions | `(user_id, id)` |
| `grocery_lists` | working list state (checked items, active plan) | `(user_id, id)` |
| `custom_recipes` | user-created recipes | `(user_id, id)` |
| `favorites` | saved recipe ids | `(user_id, recipe_id)` |
| `orders` | retailer hand-off / sandbox order records | `(user_id, id)` |
| `audit_logs` | per-account activity trail | `(user_id, id)` |
| `user_settings` | notifications, consents, cooking state | `user_id` |

Every row is scoped by `user_id` (or `id` for `profiles`). Plan days are stored as flat `planned_meals` rows so they can be queried and counted; `meal_plans.day_dates` preserves blank days in the week.

### Authorization

- Row Level Security is enabled on every table.
- Every table has separate select and insert policies using `auth.uid() = user_id` (or `= id` for `profiles`); inserts also use `with check`.
- Most tables also have update and delete policies. `favorites` has no update policy, and `orders` and `audit_logs` are **insert-only**: they have select, insert and delete policies but deliberately no update policy, and the `UPDATE` table privilege is revoked from `authenticated` as well.
- `planned_meals` is additionally constrained to a plan the same user owns through a composite foreign key.
- The client never checks a role to authorize a write; the database decides.
- `profiles.is_admin` is **server-owned**. The `protect_profile_fields` trigger forces `is_admin = false` on insert and preserves the existing value on update unless the request uses the service role.
- Profile identity comes from the authoritative `auth.users` row, not from client input and not from `auth.jwt()`. The sign-up trigger may run before a JWT exists, so `protect_profile_fields` reads `email` and `phone` from `auth.users` by `new.id`. On insert it overwrites any client-supplied email and authentication method; on update it restores `id`, `email`, `auth_method`, `is_admin` and `created_at` from the existing profile row.
- `handle_new_user` creates a profile row from the `NEW` `auth.users` record whenever Supabase Auth creates a user.
- Grants are given to `authenticated`; access is revoked from `anon`.
- `delete_my_account()` is a security-definer RPC that removes the caller's rows and auth user.
- `apply_user_snapshot(payload jsonb)` is a security-invoker RPC that applies one complete account snapshot in a single transaction. It derives ownership from `auth.uid()`, rejects a payload whose `user_id` does not match, writes every row with the caller's id and scopes every delete to the caller. RLS remains active as a second layer; no service-role key is used.

## Auth flows

| Flow | Client entry point | Notes |
| --- | --- | --- |
| Email OTP | `sendEmailCode` → `verifyEmailCode` | Supabase sends the six-digit code. Requires email delivery configured in the Supabase project. |
| Email + password | `signInWithPassword` / `signUpWithPassword` | Sign-up may return `needsConfirmation` when email confirmation is on. |
| Phone OTP | local `requestOtp` / `verifyOtp` | Still a demo code. Wire an SMS provider before production. |
| Demo kitchen | `signInDemo` | Seeded local account; never syncs. |
| Google | — | Not connected. The UI says so instead of faking a sign-in. |

Sessions are persisted with `expo-secure-store` on native devices (chunked because SecureStore has a value-size limit) and AsyncStorage on web. The client refreshes tokens only while the app is in the foreground.

### Email confirmation callback

`signUpWithPassword` passes `emailRedirectTo` built by `lib/supabase/redirect.ts`:

- **Web** uses the page's public origin, falling back to `EXPO_PUBLIC_APP_URL` when the page is opened on localhost, then appends `/auth/callback`.
- **Native** uses `EXPO_PUBLIC_NATIVE_AUTH_REDIRECT_URL` when explicitly set, otherwise the app scheme (`rasoi://auth/callback` via `Linking.createURL`). The web preview URL is never used for production native builds.

`app/auth/callback.tsx` reads the code/tokens from the URL, redeems them with the existing PKCE client, verifies that the session was persisted, asks the root provider to adopt it, and only then routes into the app. Expired, invalid, already-used and already-confirmed links resolve to an explanatory screen or a normal signed-in session; they never crash or loop. Because PKCE stores the code verifier in the browser that started sign-up, a link opened in a different browser is confirmed on the server but cannot create a session there; the screen tells the person to sign in with their password. To make cross-device confirmation create a session, change the *Confirm signup* email template to link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`; the callback already supports that shape.

## Offline-first sync

`lib/sync/` contains the whole model:

- `queue.ts` — a single coalesced pending snapshot with capped exponential backoff (2 s → 5 min).
- `rows.ts` — maps `AppData` to flat rows and back. Remote admin flags and remote demo mode are ignored on read, so the demo admin stays local-only.
- `engine.ts` — one reconciliation pass:
  - pending local changes → push the complete snapshot, then pull canonical rows;
  - no pending changes and remote has data → adopt the cloud copy;
  - empty cloud account → upload the local kitchen instead of wiping it.
- `repository.ts` — Supabase implementation. `push()` first calls `apply_user_snapshot` so the whole snapshot lands in one transaction. If the RPC is missing (an older deployment that has only applied `0001_init.sql`), it falls back to the legacy per-table path: chunked writes followed by stale-id deletes, all queries scoped by `user_id`.
- `orders` and `audit_logs` never require UPDATE permission. The RPC uses `ON CONFLICT (user_id, id) DO NOTHING`; the legacy path uses `ignoreDuplicates: true`. An id that already exists remotely is preserved instead of being overwritten, and only ids absent from the snapshot are deleted.

A change is queued after a short debounce, pushed, and confirmed by a pull. A content hash prevents a pulled snapshot from being echoed straight back as a push. Failed syncs keep the local data untouched and retry on reconnect or when the app returns to the foreground.

### Sync atomicity and known limitation

With `0002_sync_rpc.sql` applied, a push is a single RPC and is therefore all-or-nothing: a rejected row rolls back the whole snapshot, including deletes.

If the RPC is not present, the fallback path is **not** atomic. Each table now writes its replacement rows before deleting stale ids, which prevents an individual table from being emptied by a failed write, but a failure between tables can still leave the account partially updated (for example, plans replaced but pantry items not yet). Apply `0002_sync_rpc.sql` to remove this risk. The app does not use the service-role key in either path.

Status is exposed as `cloud.status`: `disabled`, `signed_out`, `connecting`, `syncing`, `synced`, `offline`, `error`. Profile shows the current status, last sync time, pending changes and a manual retry.

## What is not implemented

- Live retailer APIs, prices, stock or cart insertion. Retailer hand-off remains sandbox or deep-link only; see `lib/retailers/adapters.ts`.
- SMS OTP delivery.
- Google OAuth.
- Realtime multi-device conflict resolution beyond last-writer-wins.
- Server-side recipe/ingredient catalogue. Recipes remain bundled with the app.

## Verification status

### What was executed in this workspace

The migrations were applied to a **local PostgreSQL 15.20** database with a small Supabase-compatible shim (`tests/sql/supabase_shim.sql`) that provides the `anon`, `authenticated` and `service_role` roles plus `auth.users`, `auth.uid()`, `auth.role()` and `auth.jwt()`. This is a stand-in for the Supabase runtime, **not** a live Supabase project.

Commands used:

```bash
createdb rasoi_review
psql -d rasoi_review -f tests/sql/supabase_shim.sql
psql -d rasoi_review -f supabase/migrations/0001_init.sql
psql -d rasoi_review -f supabase/migrations/0002_sync_rpc.sql
psql -d rasoi_review -f tests/sql/security_review.sql
```

Verified in that database:

- Both migrations apply cleanly, and **re-running `0001` then `0002` succeeds** (idempotent in this order).
- `apply_user_snapshot` is `SECURITY INVOKER` (`prosecdef = false`), executable by `authenticated` only, and not executable by `anon` or `public`. It works while `authenticated` has **no direct `SELECT` on `auth.users`** (the shim grants that only to `service_role`), matching Supabase's model; the profile trigger reads the auth record through its `SECURITY DEFINER` function.
- RLS is enabled on all 13 tables, and every policy's `USING`/`WITH CHECK` expression is scoped to `auth.uid()`.
- `orders` and `audit_logs` have no UPDATE policy and no UPDATE privilege for `authenticated`; repeated inserts with an existing id preserve the original row (`ON CONFLICT DO NOTHING`, including the legacy `ignoreDuplicates` shape).
- Profile creation from `auth.users` produces the right `email`, `phone`, `auth_method` and `is_admin = false` for email-only, phone-only and unconfirmed-email sign-ups.
- Client INSERT of a profile with spoofed `email`/`auth_method`/`is_admin`, and client UPDATE that tries to change `id`/`email`/`auth_method`/`is_admin`, are overwritten by the trigger.
- Cross-user inserts and deletes are blocked by RLS on every table, and cross-user updates on every table that has an UPDATE policy. Cross-user reads were spot-checked on `profiles`, `households`, `pantry_items` and `orders`. The RPC rejects a payload whose `user_id` differs from `auth.uid()`.
- Rows in an RPC payload that name another user are written under the caller's id; user B's data was unchanged after every RPC call.
- A failed RPC (foreign-key violation after the plan insert) rolled back the whole snapshot: the previous plan and pantry rows remained and no partial rows were left behind.
- `delete_my_account()` removed only the caller.
- `bun run typecheck` passes and `bun test` passes (115 tests). The client fallback is covered by unit tests with a fake Supabase client, not by the local database.

`tests/sql/security_review.sql` is a manual review harness; it is not part of `bun test` and needs a PostgreSQL server plus the shim above.

### What still requires a real Supabase project

These checks could **not** be executed here and must not be assumed to pass until run against a disposable Supabase project:

- The real GoTrue sign-up path and the actual `auth.role()`/JWT claims visible to the `auth.users` insert trigger (the shim approximates these).
- Whether the migration role in your project can read `auth.users` inside the security-definer trigger, and whether `authenticated` has `USAGE` on the `auth` schema plus `EXECUTE` on `auth.uid()`.
- PostgREST/`supabase-js` behaviour, including `.upsert(..., { ignoreDuplicates: true })` and RPC error codes (`PGRST202`) used by the legacy fallback.
- Hosted database differences (extensions, `pgcrypto`, role ownership, connection pooler settings).
- Email confirmation links, OTP delivery and phone/SMS delivery.
- Real multi-device concurrency and last-writer-wins behaviour.

Known limitations that remain after review:

- The RPC expects a **complete** snapshot: an absent collection key is treated as an empty collection and will delete that user's rows. The client always sends the full snapshot, but a hand-written partial payload would be destructive to the caller's own data.
- A profile's `email`/`auth_method` are derived at creation and preserved on client update. If the underlying auth email changes later, the profile row is not refreshed automatically.
- If `0002_sync_rpc.sql` is not applied, the legacy per-table path is still not atomic across tables (documented above).
- The demo admin remains local-only and is never uploaded; device-only mode does not call Supabase at all.

## Live project probe

The configured project (`ycktpapzhetlvakunena.supabase.co`) was probed from this workspace with the public publishable key only; no service-role key was used and no accounts or rows were created.

Verified against the live project:

- `GET /auth/v1/health` → `200` (GoTrue reachable).
- `GET /rest/v1/profiles` with the publishable key → `401 / 42501 permission denied for table profiles`, which confirms the table exists and `anon` is denied, as the migration intends.
- `POST /rest/v1/rpc/apply_user_snapshot` with the publishable key → `401 / 42501 permission denied for function apply_user_snapshot`, which confirms `0002_sync_rpc.sql` is applied and execution is not available to `anon`.
- `POST /auth/v1/token?grant_type=password` with a deliberately invalid account → `400 invalid_credentials`, which confirms the email/password provider is reachable.
- `@supabase/supabase-js` accepts the publishable key as the client API key (`Invalid login credentials` rather than an API-key error).

Not verified from this workspace:

- A **successful** email sign-in, because that needs a real mailbox, OTP or confirmed password account.
- A **successful** `apply_user_snapshot` round trip, because that needs an authenticated session for a real account.
- Phone OTP and Google OAuth, which still have no provider configured.

`delete_my_account` is reachable with the publishable key and returns `Not signed in` (`P0001`) because `auth.uid()` is null. It therefore cannot delete anything without a session, but the live project's function grants differ from the explicit `authenticated`-only grant in `0001_init.sql` (Supabase default function privileges grant `EXECUTE` to `anon`). Re-running `0001_init.sql` after adding `revoke all on function public.delete_my_account() from anon;` would tighten that if desired.

