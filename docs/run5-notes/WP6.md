# WP6 notes: auth screens (first slice)

## Built

- Header: `SiteHeader` (server) reads the account and owner-cookie shops; `HeaderNav` (client) draws the table from the pure `lib/brand/header.ts`. A storage failure only costs the account links.
- `brand/AccountMenu.tsx`: disclosure, `placement` up or down, Esc and outside press close, focus returns to the button, log out with `window.location.replace('/')`.
- `(auth)/layout.tsx`, `/signup`, `/login`, `/recover`, `auth/{fields,SignupForm,LoginForm,RecoverForm,RecoveryKeyStep,AuthProblemText,AuthHeading,use-auth-form}`.
- Pure and tested first: `lib/client/auth-copy.ts` (exact errors by code, checks before sending, password hint), `lib/client/recovery-file.ts`.
- `Field` gains `id` and `liveHint`; `CopyButton` gains `ghost` and `onCopied`; `globals.css` gains `--z-menu` and `--auth-form-w`.

## Deviations and choices

- **Apostrophes are typographic** (`don’t`, `There’s`, `You’ll`), matching the existing app and the server's own messages. The brief's table has straight ones.
- **Two sentences the brief does not list:** `Enter your password.` and `Enter your recovery key.`, for an empty field. Without them an empty login would spend a rate-limit failure on the server.
- **Empty-login email** uses the brief's `Enter your email, like rosa@example.com.`.
- **`/recover`'s header link** is `Have an account? Log in`; the brief lists the two prompts without saying which `/recover` gets.
- **"`/` hidden otherwise"** (logged out, owner cookie) is read as: several owner shops link to `/`, and the link is hidden on `/` itself.
- **`/recover` does not redirect a logged-in visitor**, unlike `/login` and `/signup`: someone who is logged in may still be using a key to reset their password.
- **Key step layout:** Download beside Continue in the first row, Copy and Print as ghost buttons beneath. Four groups of the key in one row from `sm`, 2x2 below.
- `Copy` label: `CopyLabel`'s inline grid gets `align-top`, which removes a 2 px offset against a neighbouring button.

## Tests

- New: `tests/brand/header.test.ts`, `tests/client/auth-copy.test.ts`, `tests/client/recovery-file.test.ts`, `e2e/auth-screens.spec.ts`.
- **No existing test was edited.**
- Verified: `npm test` (1935 passed), `npm run typecheck`, `npm run lint`, `npm run build`, targeted e2e `auth-screens`, `start`, `app-shell`.
- One `app-shell` failure in that batch (`Live: in the shell` at 1440): a 5 s `toHaveURL` on the first compile of `/s/[slug]` while two workers ran. It passed when re-run alone.

## Second slice: /shops, /shops/new, /account, Settings password, shell account

Built:

- `/shops` (`shops/(list)/{layout,page,loading}.tsx`), `components/shops/{ShopRow,RecoveryBanner}.tsx`, `dashboard/shop-status.tsx` (`ShopStatusBadge`, now also used by the shell and the Live step), pure `lib/seller/shop-rows.ts` and `ordersRepo.paidCountsByAccount`.
- `/shops/new` (`StartActions` gains `samples` and `liveLink`), `Frame`'s rule moved to pure `lib/brand/frame.ts` and excludes `new`.
- `/account` with `components/account/RecoverySection.tsx`, `LocalDay` and `lib/domain/day.ts`.
- Settings: `PasswordField` under the email when `payeeChangeNeedsPassword` is true; `PayPal email changed on {date}`.
- `currentShellAccount()` reads the real account. `AccountMenu` is in the shell (up in the sidebar, down in the top bar, `panelClassName` so it fits the 15 rem sidebar). The banner box moved to `app/Banner.tsx`; `RecoveryBanner` is used by the shell's slot and by `/shops`.

Deviations and choices:

- **`/shops` lives in a route group, `shops/(list)/`.** The brief's `shops/loading.tsx` would wrap every `/shops/[id]` page too: Next starts streaming with a 200 at that boundary, so a non-owner would lose the real 404 (`Decisions`, `loading.tsx` row). The group's layout also makes the logged-out and zero-shop redirects real 307s before the skeleton streams.
- **`/account`'s key step replaces the page.** `RecoverySection` takes the rest of the page as `children` and hides it while the key shows, so `RecoveryKeyStep`'s H1 stays the only one. S1 should add its sections inside those children (or beside them, keeping that rule).
- **Banner on `/shops` sits at the top of the content**, where the shell's slot is, rather than between the title and the list.
- **The shell banner stays one slot** (Decisions, Banners): a paused or payee-missing shop shows that banner instead of the recovery one until it clears. Setup steps before Live have no shell, so no banner either.
- **Sidebar trigger is the icon alone**, as the brief's `AccountMenu`; the email is in the panel.
- **Two sentences the brief does not list:** `Enter your Shelfie password to do that.` (the route's own words, shown before sending when the field is empty) and `Enter your password.` on `/account`.
- **Labelled `Current password` on `/account`**; ids `account-current-password` and `payee-current-password`, so no two forms share one.
- A rate-limit failure on the Settings password shows under the password field, since that is what was limited.

To check at merge:

- **`currentShellAccount` has a catch**, like `SiteHeader`: it rethrows Next's signals and otherwise logs and returns null. `tests/app/shell-data.test.ts` ('is null until accounts exist') calls it with no request scope, and the rules forbid editing that test for anything but selectors, routes and copy. **So that test now passes through the catch (it logs one line), and no longer proves anything about accounts.** The real behaviour is in the new `tests/app/shell-account.test.ts`. The coordinator may want to add a `next/headers` mock to the old test, or retire it.

Tests:

- New: `tests/seller/shop-rows.test.ts`, `tests/brand/frame.test.ts`, `tests/app/shell-account.test.ts`, `tests/domain/payee-password.test.ts`, `e2e/accounts.spec.ts` (acceptance 1 to 5 and 7 to 9; 5 and 6 are also in `e2e/auth-screens.spec.ts`). Added cases to my own `tests/client/auth-copy.test.ts`.
- **No existing test was edited.**
- Verified on the final code: `npm test` (1968 passed), typecheck, lint, `npm run build`, targeted e2e `accounts` and `dashboard`. `app-shell`, `auth-screens` and `start` passed before the last change, which only moved press classes.
- **One failure I did not cause:** `e2e/dashboard.spec.ts:345` (Add tracking lands on the form) expects the form at 16 px from the top and gets 72 at 390, which is 16 plus the 56 px top bar. It fails the same way on the base commit 4417376, so it came in with the shell (WP4), and is not fixed here.

## Third slice: e2e/accounts.spec.ts against acceptance 1 to 9

The spec already covered 1 to 4 and 7 to 9. Acceptance 5 and 6 were only in `e2e/auth-screens.spec.ts`, so this slice added them, with a map from acceptance number to test at the top of the file.

Added (new tests only, nothing already in the spec changed):

- **5:** `/login` while logged in is a 307 to `landingPath` for no shops, one published shop, one draft and two shops; a safe `next` wins and a stray one is ignored.
- **6:** `Forgot password?` reached with Tab alone from the top of the page, and Enter opens `/recover`. Every email and password field on `/signup`, `/login` and `/recover` has the required `autocomplete`, and no two forms share an `id` or a `name`.
- **7:** the menu in the public header, and in the shell's top bar at 390 (opens downward). The sidebar case was already there.
- **8:** Download on the sign-up key step clears the banner (the existing test goes through a new key on `/account`), and skipping Download leaves it.

Results, on the code as committed:

- `e2e/accounts.spec.ts`: 25 passed. `e2e/app-shell.spec.ts` and `e2e/auth-api.spec.ts`: 39 passed.
- `npm test`, `npm run typecheck`, `npm run lint`: clean.
- **No product change was needed**, and **no existing test was edited.**

Seen in the logs, not a product bug: a hydration warning on `/shops/new` for `caret-color: transparent` on the photo input. Playwright's screenshot sets that style, and it landed before hydration.

## Review round 1

Stopped for time at 13:25 IST. All findings have a code fix (commit e7dca15), but only part of it was verified.

Fixes:

- **SR23, credentials in the URL before hydration:** `method="post"` on LoginForm, SignupForm, RecoverForm and RecoverySection, so a submit before hydration no longer puts fields in the query string.
- **Password error moving to the email field:** `failureIsPassword` in `PayeeForm` remembers that the last failure was about the password, so retyping no longer opens the email field's guard.
- **`PayPal email changed on` lost between sections:** `onSaved` now also passes the change date, and Dashboard holds it in state.
- **Key step header:** `src/lib/client/started-session.ts` gives `HeaderNav` the account once sign-up or recovery starts a session. `router.refresh()` is not usable: the /signup page redirects a logged-in visitor, which loses the key.
- **Outside click focus:** the selector now ignores `tabindex="-1"` wrappers.
- **ShopRow:** `content-center` on the grid.

Not done or not verified (for the coordinator):

- **`e2e/accounts.spec.ts` and `e2e/app-shell.spec.ts` were NOT run after these fixes.**
- **No regression e2e was added** for any finding, including the JS-off test the security reviewer asked for. These fixes are unproven in a browser.
- TDD was followed only for `started-session` (test seen failing first). The other fixes are component changes with no failing test first.
- `npm run typecheck` and `npm run lint` printed no errors. `npm test` ran, but its pass/fail summary was cut off in the output, so its result is unknown.
- `method="post"` keeps fields out of the URL, but a pre-hydration submit still POSTs to the page, which re-renders it empty. Not tested in a browser here.

No existing test was edited. New test: `tests/client/started-session.test.ts`.

## Review round 1, second pass

All four items were real and are fixed. A failing test came first for each one.

- **Text typed before hydration (`FINDING-LATE-HYDRATION`):** React leaves the DOM alone while hydrating, then its next update writes the empty state over it. `useKeepTypedValue` in `components/auth/fields.tsx` copies what is in the input at mount into state. It covers every `EmailField` and `PasswordField`, plus the recovery key input.
- **A submit before hydration:** the submit button on the three auth forms and on `RecoverySection` is `disabled` until React has hydrated (`ready` from `useAuthForm`), which also blocks Enter. Nothing is sent, the entries stay, and the button enables itself. **Deviation, for the coordinator:** with JavaScript off the button never enables, so `(auth)/layout.tsx` has a `<noscript>` line saying JavaScript is needed. `/account` has no such line. `method="post"` stays as the second guard.
- **Banner after Back (`FINDING-BACK-BANNER`):** `setRecoveryUnsaved` in `shell-store.ts` applies to every shop the tab knows, and it corrects a kept payload for a shop opened later. `RecoveryKeyStep` calls it only after the PATCH succeeds. `RecoverySection` also calls it with `true` when a new key is created, because the server has just set that key to unsaved and the same Back would otherwise hide the warning (SR22).
- **Abandoned payee password:** `PayeeForm` clears the password whenever the field is not needed. The password also goes if the email is briefly invalid during an edit, because the field is hidden then too. Keeping a visible password across a direct email edit is unchanged.
- **`TEST-SHELL-DATA`:** see below.

**Existing test edited:** `tests/app/shell-data.test.ts`. It now mocks `next/headers` with an empty cookie jar, renames the false title `is null until accounts exist`, and adds an assertion that `console.error` is not called. The original assertion stays. This goes beyond selectors and copy because the review asked for it.

**Tests added:** three in `e2e/accounts.spec.ts` (`review round 1`) and a `setRecoveryUnsaved` block in `tests/app/shell-store.test.ts`. With the hydration and banner fixes switched off, their e2e tests failed on the reported symptoms: an empty email field, and banner count 1.

**Results on the final code:** `npm test` 1995 passed. `npm run typecheck` and `npm run lint` clean. `e2e/accounts.spec.ts` and `e2e/app-shell.spec.ts` 73 passed.

**Not tested:** the signup, recover and `/account` forms in the late-hydration case. The e2e test drives `/login` only; the others share the same code. The `<noscript>` line has no test either.
