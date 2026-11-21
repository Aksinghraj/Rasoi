# Rasoi — Android closed-beta QA report

Scope: Phase 2.1 reliability and Android compatibility pass over the existing app. The Phase 2 visual redesign, navigation, routes and data flows are preserved. No new dependencies were added.

## Verification performed

| Check | Command | Result |
| --- | --- | --- |
| TypeScript (strict) | `bun run typecheck` | Passes with no errors |
| Automated tests | `bun test` | 55 pass, 0 fail (174 assertions) |
| Storage shape review | manual code audit | Malformed or partial persisted state now falls back safely |
| Retailer claim review | manual code audit | No live price, stock, serviceability or cart claim is introduced |

Physical-device checks still required before calling the build beta-ready: Android font scaling at 200%, keyboard overlap on the auth/onboarding/recipe forms, back gesture behaviour, image loading on a slow network, and retailer deep-link hand-off on a device without the retailer app installed.

## Defects confirmed and fixed

### Accounts and roles

- A self-service OTP sign-in could resume the seeded demo account and inherit `isAdmin`. Sign-in now resumes only an account created through the same self-service channel (`matchesExistingAccount`), and resumption always sets `isAdmin: false`.
- Email accounts were matched case-sensitively and stored unnormalised. Email identifiers are now trimmed and lower-cased on creation and matching.
- `updateProfile` merged an arbitrary patch, so a caller could change `id`, `authMethod`, `createdAt` or `isAdmin`. Updates now pass through `sanitizeProfilePatch`, which only accepts a valid name, phone and email.
- Admin rights remain reachable only through the explicit "Explore the demo kitchen" path.

### Persistence and reliability

- Persisted state was trusted blindly. A partial or hand-edited AsyncStorage document could crash a screen (`days` missing, `meals` not an object, `checkedItems` not a map, a session without a user). Rehydration now validates the top-level shape, clears a session that does not match its user, normalises household counts and members, drops malformed pantry items, extras, custom recipes and planned meals, coerces array fields, rebuilds preferences with defaults, and filters checked-item and notification/consent keys to booleans.
- A hand-edited document could set `isAdmin: true` on a self-service account. Rehydration now grants admin only when the stored auth method is `demo` and the flag is true.
- A debounced write could be lost when Android backgrounded the app. State is now also flushed on `background`/`inactive` and on provider unmount.

### Dates

- `isValidISODate` was imported but missing, breaking typecheck. It is implemented and validates real calendar days (rejects `2026-02-30`).
- Week-start changes, blank-plan creation, generated plans, adding meals, copying a day, duplicating a plan and pantry expiry now reject invalid dates instead of silently producing a bad week.
- Duplicating a plan now shows an inline error for an invalid start date instead of closing the sheet and jumping to an empty week.

### Planner

- Opening the Plan tab after selecting a different plan in Profile could keep the previous week window. The tab now follows the active plan when it changes externally, while still allowing free week browsing.
- Starting cooking mode from a planned meal or from a scaled recipe detail now carries the chosen servings into the cooking session instead of always using household defaults.

### Grocery and custom recipes

- Adding the same extra item twice created duplicate grocery rows. Extras now merge by name and unit, incrementing quantity; empty names and non-positive quantities are ignored.
- Adding the same ingredient twice to a custom recipe created duplicate lines. It now increments the existing line.
- Custom recipe steps filtered empty text before mapping, which misaligned timers and tips with the wrong step. Steps are now cleaned as objects so each timer and tip stays attached to its own text.
- Custom recipe submission accepted zero/negative ingredient quantities. It now requires a quantity above zero, and nutrition divides by a safe serving count.
- An unmatched grocery list rendered `₹0` as an estimate. The basket now shows "No estimate yet" with an explanation, hides the budget progress bar, and the shared text says the estimate is not available.

### Retailers and consent

- An unknown retailer id threw during render. The checkout screen now resolves the adapter inside a guard and shows the existing "Retailer not found" empty state.
- Deep-link hand-off ignored the retailer-sharing consent. Hand-off and per-item search are disabled while consent is off, with an inline explanation and an explicit "Allow retailer hand-off" action. Manual share remains available because it does not send data to a retailer.
- No retailer claim was added or strengthened; sandbox and deep-link copy remains explicit about what Rasoi can and cannot confirm.

### Android layout and input

- The tab bar used a fixed height and bottom padding, which clips under the Android navigation bar with edge-to-edge enabled. Height and padding now include the safe-area inset.
- Bottom sheets now pad for the navigation-bar inset, use `height` keyboard avoidance on Android, and dismiss the keyboard on drag.
- Recipe detail and the meal picker now respect the bottom safe area; the meal picker's absolute footer is offset by the inset so its action is never under the system bar.
- Status bar content is light on the dark auth and cooking screens, and the root stays dark elsewhere.
- Long forms and list screens use `keyboardDismissMode="on-drag"`; fields keep `keyboardShouldPersistTaps`.
- Raw `Text` elements in shared primitives (banner copy, helper/error text, stepper values, avatar initials, section actions) and the splash/not-found screens now cap font scaling, and text inputs cap scaling so large system fonts cannot overflow the field.
- Small icon and stepper controls carry `hitSlop`, and shared chips, compact buttons and toggle rows meet a 44 px touch target. `app.json` declares edge-to-edge, predictive back and `resize` keyboard mode for Android.

## Regression coverage added

`tests/engine.test.ts` now also covers:

- demo-admin accounts cannot be resumed through OTP;
- same-channel matching with normalised phone/email;
- profile patches cannot change identity, role or auth method, and reject malformed contact details;
- real-calendar ISO date validation, including duplicate-plan start dates;
- duplicate extras merging by name and unit, different units staying separate, and blank/non-positive extras being ignored;
- custom recipe steps keeping each timer and tip attached to its own text, and non-positive ingredient quantities being rejected;
- serving counts never becoming zero, negative or NaN;
- unknown retailer ids failing safely, and deep-link hand-off requiring retailer-sharing consent;
- unmatched grocery lists never print a rupee estimate.

## Manual device checklist

1. Sign in with phone and email OTP; sign out; confirm the demo admin is not resumed by OTP.
2. Rotate-free small screen (360 × 640) and large screen: onboarding, planner, grocery and profile scroll without clipped footers.
3. Set system font size to largest: headings stay readable, buttons do not overflow.
4. Focus each form field: the keyboard does not cover the primary action; dragging dismisses it.
5. Background and kill the app mid-plan edit; reopen and confirm the last change persisted.
6. Open a grocery list with no catalogue matches: no `₹0` estimate is shown.
7. Turn off retailer sharing in Privacy, open checkout for a deep-link retailer, confirm hand-off is blocked until consent is granted.
8. Open an unknown retailer URL directly; confirm the "Retailer not found" state appears instead of a crash.
9. Open a planned meal and start cooking; confirm the cooking session uses the planned servings.
10. Complete a sandbox checkout and confirm the copy still says no real order was placed.
