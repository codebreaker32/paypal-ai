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

## Not in this slice (rest of WP6)

`/shops`, `/shops/new`, `/account`, `RecoveryBanner`, real `currentShellAccount()`, `AccountMenu` in the shell, the Frame `WIDE` change and the payee password check in Settings. Until `/shops/new` lands, `Continue` after sign-up and a login with no shops reach the 404 page.
