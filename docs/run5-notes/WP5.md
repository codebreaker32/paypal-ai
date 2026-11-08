# WP5 core modules: notes for the coordinator

Scope of this worker: schema, repos, password, recovery, sessions, origin check, next path, rate limits, and the small
constants. Route handlers, `owner.ts`, `client/auth.ts` and the wiring of `assertSameOrigin` are not part of it.

## Deviations from the brief

1. **`guestShopsAllowed()` returns false on Render, not a flat true, until WP7.** WP5 says it "returns true until WP7",
   but SR20 must pass in WP5 and says the guest flag is ignored on Render. It returns true everywhere except on Render.
   No deploy lands between WP5 and WP7, so nothing changes in practice. WP7's flip is the last line of
   `src/lib/auth/guest.ts`, as its comment says; `tests/auth/guest.test.ts` stays valid before and after the flip.
2. **One extra module, `src/lib/auth/password-policy.ts`.** The SR6 rules and the length limits live there so a browser
   form (WP6's live hint) can import `MIN_PASSWORD_LENGTH` and `passwordLength` without pulling in `node:crypto`.
   `password.ts` re-exports all of it, so `@/lib/auth/password` is still the one import for server code.

## Choices the brief left open

- Login "replaces any existing session" means this browser's own session (the cookie it sent). The account's other
  devices stay logged in: the brief's phone at the counter, and S1's `Log out of other devices` needs several sessions.
- `shops.account_id` sits before `published_at` in `CREATE TABLE`, so `tests/db/migrate.test.ts` passes unedited: its
  regex needs `payee_email` to stay last, directly after a bare comma.
- `endSession` clears the cookie with `set(name, '', fullOptions)`, not `jar.delete`: a `__Host-` cookie cleared without
  `Secure` is ignored by the browser, which would leave the seller logged in on https.
- `safeNext` parses against a fixed internal base, so every absolute URL is refused, including one on our own host.
- `clientIp` also folds IPv4-mapped IPv6 addresses into the IPv4 address, so one client has one bucket.
- The recovery key is compared after removing dashes and also whitespace, so a key pasted with a line break still works.

## For the route work

- SR8: the limit helpers in `src/lib/rate-limit.ts` never hash. Call `allowSignup`, `allowLogin`, `allowRecovery` or
  `allowPasswordCheck` before any function in `password.ts`, then `recordLoginFailure`, `recordRecoveryFailure` or
  `recordPasswordFailure` after a failed check. They take a normalised or raw email; keys hold only its hash.
- SR9: `dummyVerify(password)` is the hash for an unknown email.
- SR5: after a successful login, `if (needsRehash(account.passwordHash)) accounts.setPasswordHash(...)`.
- SR12: `redeemRecoveryKey` in `recovery.ts` is the whole recovery; the route adds the limits and `startSession`.
- Catch `HashBusyError` and return `busyResponse()` (503 `BUSY`, `Retry-After: 5`).
- `requireOwner` should use `loginPath('/shops/<id>')` from `next-path.ts` and `RETURNING_COOKIE` from `session.ts`.
- `createShopFromPhotos` and `createShopFromSample` take `accountId` as an optional third argument.
- A full `SHOP_LIMIT` check can use `shops.listByAccount(db, id).length`.

## Tests

No existing test file was edited. New: `tests/db/{accounts-schema,accounts-repo}.test.ts`,
`tests/auth/{password,recovery,session,next-path,guest,limits,constants,no-logging}.test.ts`,
`tests/http/{same-origin,rate-limit,client-ip-ipv6}.test.ts`.

SR1's unit part (no proxy or middleware file) is in `tests/http/same-origin.test.ts`; its 14 MB upload check needs the
routes. SR2's per-handler AST test, SR8's over-limit-performs-no-hash test and SR9, SR15 to SR18 belong with the routes.

# WP5 routes and authorization: notes for the coordinator

Scope of this worker: `owner.ts`, every route of the brief's table, the shops routes, `client/auth.ts`, `client/api.ts`, the wiring of
`assertSameOrigin`, and the static guards. No existing test file was edited.

## Deviations from the brief

None that change a rule. The brief's tables are silent on a few cases, chosen as below.

## Choices the brief left open

- `POST` and `PATCH /api/account/recovery-key` answer 401 `LOGIN_REQUIRED` with no session (the table lists no such error; the same code as `POST /api/shops`).
- `POST /api/account/recovery-key` with a wrong password answers 403 `PASSWORD_WRONG` (the table lists only `PASSWORD_REQUIRED`); missing is `PASSWORD_REQUIRED`, matching the payee rule. WP6's copy: `That password doesn't match.`
- Login: a malformed email or a missing password is 401 `BAD_CREDENTIALS` and still runs the dummy hash (the table has no 400 for login, and SR9 wants one answer).
- Recovery: an unparsable email goes on with an empty email, so it is 401 `BAD_RECOVERY` and still hashes (SR12). `WEAK_PASSWORD` (400) is checked before the hash and says nothing about the account.
- SR8: login and recovery read the (64 KB capped) body first, because their limits need the email. Every limit still runs before any hash. Sign-up counts the address before reading anything.
- SR18: `payee_changes` is written for a published or paused shop (account-owned or unattached) when the email actually changes to a non-null value. A draft's first email is not a "change", so Settings doesn't show `PayPal email changed on` for a seller who only filled in setup. `old_masked` is null only for the demo shop going from no email to one.
- `checkCurrentPassword` (in `auth/http.ts`) is shared by the payee change and the recovery key. WP6/S1's password routes can use it too.
- Server `message` strings on 429 follow WP6's copy table for login and sign-up (`Too many tries...`). Other refusals use `error.code`; forms should map by code where the copy differs.
- `POST /api/shops` checks the session (401) and the shop count (409) before the per-address rate limit and before reading the body, so neither costs a request's bytes. `LOGIN_REQUIRED` maps to `StartError` kind `login_required`, `SHOP_LIMIT` to `shop_limit`.
- A logged-in seller who adds a shop while guests are allowed still gets an account-owned shop with no owner cookie.
- `claim/[token]` answers an account-owned shop exactly like an unknown token (404, sets nothing), so a token proves nothing about it (SR15).
- `api/assistant/[slug]` POST now has the same-origin check: only the in-app buyer console calls it. The agent door is `s/[slug]/mcp`, not under `api/`, so external agents are unaffected.
- `isGone` (a poll answered 404) in `components/dashboard/api.ts`: the dashboard poll reloads the page; the page then redirects to login or 404.

## For the screens (WP6)

- `client/auth.ts`: `signup`, `login`, `logout`, `recover`, `createRecoveryKey`, `markRecoverySaved`. Failures are `ApiError` with the route's `code`. Finish login and logout with `window.location.replace` (SR21).
- `dashboard/api.ts` `setPayeeEmail` needs a `currentPassword` parameter added (WP6's Settings change). The route takes it next to `payeeEmail`: 403 `PASSWORD_REQUIRED` shows the field, 403 `PASSWORD_WRONG` is `That password doesn't match.`
- `payeeChanges.latest(db, shopId)` is what `PayPal email changed on {date}` reads (`changedAt`, ISO).

## Tests

No existing test file was edited.
New: `tests/auth/{account-owner,route-guard,removal-guard,no-logging-routes}.test.ts`, `tests/api/{auth-routes,shops-accounts,large-upload}.test.ts`, `tests/client/{auth,api-accounts}.test.ts`, `e2e/{large-upload,auth-api}.spec.ts`.

- `e2e/large-upload.spec.ts` sends the 14 MB photo through a real server (SR1). `e2e/auth-api.spec.ts` checks cookies, the session-owned shop, logout, the `/login?next=` redirect and recovery through real Next.
- Targeted e2e run: `start`, `setup`, `dashboard` all pass with the same-origin check in place (32 passed, 1 pre-existing skip).
