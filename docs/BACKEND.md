# Backend: Supabase accounts and sync

Rasoi works fully offline. Cloud accounts are **optional** and activate only when both public Supabase environment variables are present.

## Modes

| Mode | When | Behaviour |
| --- | --- | --- |
| Device-only | `EXPO_PUBLIC_SUPABASE_URL` or the anon key is missing | Everything is stored in AsyncStorage on this device. The auth and profile screens say cloud sync is off. Phone/email OTP uses the on-screen demo code. |
| Cloud | Both variables are set | Real Supabase Auth sessions, Postgres storage and offline-first sync. |

The app never pretends a cloud feature is available when it is not configured.

## Environment

Add to `.env` (already scaffolded):

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

- Only the **anon** key is public. Never ship the service-role key in the app.
- The URL must be `https://` (or `http://localhost` for local Supabase).
- Config is read by `lib/supabase/config.ts`; an invalid URL or a key shorter than 20 characters is treated as "not configured".

## Apply the schema

The migration lives at `supabase/migrations/0001_init.sql`. Apply it with either:

```bash
# Supabase CLI (linked project)
supabase db push

# or directly
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
```

The migration is idempotent (`create table if not exists`, `create or replace function`) and safe to re-run after a partial failure.

### Tables

`profiles`, `households`, `preferences`, `meal_plans`, `pantry_items`, `grocery_extras`, `custom_recipes`, `favorites`, `orders`, `audit_logs`, `user_settings`.

Every row is scoped by `user_id` (or `id` for `profiles`).

### Authorization

- Row Level Security is enabled on every table.
- Policies allow a signed-in user to select/insert/update/delete only rows where `auth.uid()` matches.
- `profiles.is_admin` is **server-owned**. The `protect_profile_fields` trigger resets `is_admin`, `id`, `email` and `auth_method` on any client update unless the request uses the service role.
- `handle_new_user` creates a profile row whenever Supabase Auth creates a user.
- Grants are given to `authenticated`; access is revoked from `anon`.
- `delete_my_account()` is a security-definer RPC that removes the caller's rows and auth user.

## Auth flows

| Flow | Client entry point | Notes |
| --- | --- | --- |
| Email OTP | `sendEmailCode` → `verifyEmailCode` | Supabase sends the six-digit code. Requires email delivery configured in the Supabase project. |
| Email + password | `signInWithPassword` / `signUpWithPassword` | Sign-up may return `needsConfirmation` when email confirmation is on. |
| Phone OTP | local `requestOtp` / `verifyOtp` | Still a demo code. Wire an SMS provider before production. |
| Demo kitchen | `signInDemo` | Seeded local account; never syncs. |
| Google | — | Not connected. The UI says so instead of faking a sign-in. |

Sessions are persisted with `expo-secure-store` on native devices (chunked because SecureStore has a value-size limit) and AsyncStorage on web. The client refreshes tokens only while the app is in the foreground.

## Offline-first sync

`lib/sync/` contains the whole model:

- `queue.ts` — a single coalesced pending snapshot with capped exponential backoff (2 s → 5 min).
- `rows.ts` — maps `AppData` to flat rows and back. Remote admin flags are ignored on read.
- `engine.ts` — one reconciliation pass:
  - pending local changes → push the complete snapshot, then pull canonical rows;
  - no pending changes and remote has data → adopt the cloud copy;
  - empty cloud account → upload the local kitchen instead of wiping it.
- `repository.ts` — Supabase implementation: chunked `upsert`/delete, all queries scoped by `user_id`, account deletion through the RPC.

A change is queued after a short debounce, pushed, and confirmed by a pull. A content hash prevents a pulled snapshot from being echoed straight back as a push. Failed syncs keep the local data untouched and retry on reconnect or when the app returns to the foreground.

Status is exposed as `cloud.status`: `disabled`, `signed_out`, `connecting`, `syncing`, `synced`, `offline`, `error`. Profile shows the current status, last sync time, pending changes and a manual retry.

## What is not implemented

- Live retailer APIs, prices, stock or cart insertion. Retailer hand-off remains sandbox or deep-link only; see `lib/retailers/adapters.ts`.
- SMS OTP delivery.
- Google OAuth.
- Realtime multi-device conflict resolution beyond last-writer-wins.
- Server-side recipe/ingredient catalogue. Recipes remain bundled with the app.
