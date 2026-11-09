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
