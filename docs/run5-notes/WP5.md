# WP5 accounts backend: summary for the coordinator

Written at the regression sweep, 2026-11-08 16:31 IST, after all of WP5 was committed. This section is the whole picture; the
two worker sections below keep the detail (choices the brief left open, and what WP6 needs).

## What was built

API and data only. No screen changes, and guests stay allowed until WP7.

- **Schema:** `accounts`, `sessions`, `payee_changes`, and `shops.account_id` with its index in `addMissingColumns`. No backfill.
- **Passwords:** scrypt with a global hash gate (2 running, 8 queued, then 503 `BUSY`), 15 to 128 characters, a 286-entry
  blocklist, rehash on login.
- **Recovery key:** 100 bits, shown once, hash stored, swapped atomically on use.
- **Sessions:** 32 random bytes in the cookie, SHA-256 in the database, fixed 30 days. `currentAccount`, `requireAccount`,
  `landingPath`, `safeNext`.
- **Authorization:** `getOwnedShop` and `requireOwner` (an owner token never opens an account-owned shop), `listOwnedShops`
  limited to unattached shops, and `claim/[token]` answers 404 for an account-owned shop.
- **Routes:** `api/auth/{signup,login,logout,recover}`, `api/account/recovery-key`, `POST /api/shops` with accounts (401
  `LOGIN_REQUIRED` when guests are off, 409 `SHOP_LIMIT` for a 26th shop), and the password check and `payee_changes` record on a PayPal
  email change.
- **Abuse limits:** per-key rate-limit windows with `peek` and `recordHit`, the SR11 limits, IPv6 buckets by /64.
- **Origin check:** `assertSameOrigin` first in every state-changing handler except `paypal/webhook`. No proxy or middleware.
- **Small pieces:** `client/auth.ts`, `TEST_MODE_LINE`, `TERMS_VERSION`, `supportEmail`, and a dashboard poll that reloads the
  page on a 404.

## Deviations from the brief, with reasons

1. **`guestShopsAllowed()` is false on Render, not a flat true.** SR20 has to pass in WP5, and it says the guest flag is ignored on
   Render. Nothing deploys between WP5 and WP7.
2. **Three small modules the brief does not name.** `auth/password-policy.ts` lets a browser form import the length rules without pulling
   in `node:crypto`. `auth/http.ts` holds the no-store responses and `checkCurrentPassword`, shared by the payee change and the
   recovery key. `db/repos/payee-changes.ts` is the repo for the brief's `payee_changes` table.
3. **"Every Security requirement except SR19 passes here" cannot be met by WP5 alone.** The brief's own table assigns SR22 to
   WP6 AC 8 and SR24 to WP4 AC 15, and the first half of SR21 is the login and logout forms, which WP6 builds. All three need
   screens. See "Not verified" below.
4. **`api/assistant/[slug]` POST has the origin check, though the brief's table lists `/api/assistant/*` as "Public, unchanged".**
   SR2 says every POST under `src/app/api/**` except `paypal/webhook`, and it is the stricter rule. Only the in-app buyer console
   calls that route; external agents use `s/[slug]/mcp`, which is not under `api/`.
5. **SR13's "Login replaces any existing session" means this browser's session only.** Other devices stay logged in, because the
   brief wants a phone at the counter to stay logged in and S1's `Log out of other devices` needs several sessions.

## Edited tests

None. `git diff --name-status 75153e1..HEAD -- tests e2e` shows only added files (24), and `tests/auth/owner.test.ts` is
unchanged and passing.

## Verified at the sweep

The sweep found no regressions and changed no code or tests.

| Check | Result |
|---|---|
| `npm test` | 116 files, 1499 tests, all pass |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `e2e/start.spec.ts`, `e2e/dashboard.spec.ts` | 30 passed, 1 skipped (`Other carrier asks for the carrier name`, a skip that predates this run) |
| `e2e/auth-api.spec.ts`, `e2e/large-upload.spec.ts` | 2 passed |

Security requirements, each checked against the test that names it:

| Requirement | Evidence |
|---|---|
| SR1 | `tests/http/same-origin.test.ts`, `tests/api/large-upload.test.ts`, `e2e/large-upload.spec.ts` (14 MB through a real server) |
| SR2, SR16 | `tests/auth/route-guard.test.ts` (AST, per exported handler; exempts only `paypal/webhook`) |
| SR3 | `tests/http/same-origin.test.ts` |
| SR4 | `tests/auth/next-path.test.ts` |
| SR5, SR6, SR7 | `tests/auth/password.test.ts`; 503 and `Retry-After` in `tests/api/auth-routes.test.ts` |
| SR8, SR9 | `tests/api/auth-routes.test.ts`, and `tests/api/shops-accounts.test.ts` for the password check |
| SR10 | `tests/http/rate-limit.test.ts` (the 15-minute caller over 10,000 keys), `tests/http/client-ip-ipv6.test.ts` |
| SR11 | `tests/auth/limits.test.ts`, `tests/api/auth-routes.test.ts` |
| SR12 | `tests/auth/recovery.test.ts`, `tests/api/auth-routes.test.ts` |
| SR13, SR14 | `tests/auth/session.test.ts`, `tests/api/auth-routes.test.ts`; SR13 also `e2e/auth-api.spec.ts` |
| SR15 | `tests/auth/account-owner.test.ts` |
| SR17, SR18 | `tests/api/shops-accounts.test.ts`; SR17 also `e2e/auth-api.spec.ts` |
| SR20 | `tests/auth/guest.test.ts`, `tests/auth/limits.test.ts` |
| SR23 | `tests/auth/no-logging.test.ts`, `tests/auth/no-logging-routes.test.ts`, the no-store header in `tests/api/auth-routes.test.ts` |
| SR25 | `tests/auth/removal-guard.test.ts` |

Other WP5 acceptance items:

- A migrated old database gains `shops.account_id` and its index, and its shops stay unattached (`tests/db/accounts-schema.test.ts`).
- Existing shops keep working through owner cookies, and an account's session does not open them
  (`tests/auth/account-owner.test.ts`).
- Another account gets 404 on an owner page and an owner API route; these tests exercise one of each, and the per-handler
  guarantee is the SR16 AST guard (`tests/auth/account-owner.test.ts`, `tests/api/shops-accounts.test.ts`).
- A valid session opens its own shop with no owner cookie (`tests/auth/account-owner.test.ts`).
- The login gate's 401 is tested with `guestShopsAllowed` stubbed false (`tests/api/shops-accounts.test.ts`).

## Not verified

- **SR19:** not in WP5 (S1). No code and no test yet. The brief says delete cannot ship without it.
- **SR21, first half:** `window.location.replace` appears only in a comment in `client/auth.ts` until WP6's forms exist. The second
  half (`requireOwner` stays in every page) is covered by SR16.
- **SR22:** needs WP6's banner (WP6 AC 8).
- **SR24:** needs WP4's HTML (WP4 AC 15). The API side holds: `POST /api/shops` returns no owner link with a session (SR17), and the
  claim route is a 404 for an account-owned shop (`tests/auth/account-owner.test.ts`).
- **The surface table's page rows** (`/shops`, `/shops/new`, `/account`, `/login`, `/signup`, `/recover`): those pages do not
  exist yet. `requireAccount` and `landingPath` are unit-tested, but no page calls `requireAccount`.
- **Guests off for real:** exercised only with `guestShopsAllowed` stubbed false. The flip is WP7.
- **`__Host-` cookie and `secure`, and the Render-only switches:** unit-tested only, because localhost is plain http.
- **Not run in this sweep:** the full e2e (the coordinator's), `e2e/setup.spec.ts` (it passed in the routes worker's earlier run),
  `npm run build`, `npm run test:sandbox`, `npm run test:ai`.

## Expected until WP6 and WP7 merge

- `requireOwner`'s redirect to `/login?next=…` and the `next` values the auth routes return (`/shops/new`, `/shops`) lead to a 404,
  because those pages are WP6's.
- Settings cannot change the PayPal email on a published account-owned shop until WP6 sends `currentPassword` (403 `PASSWORD_REQUIRED`).
  No such shop can be made through the UI before WP6.

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

## Review fixes (14 findings, 2 failed acceptance items)

Each root cause has a failing test first, in `tests/auth/limits-reserve.test.ts`, `tests/api/auth-races.test.ts` and `tests/api/shops-races.test.ts`. The race tests hold a hash open with a deferred promise, so the interleaving is exact.

- **Hash-gate starvation.** `reservePasswordCheck` (in `rate-limit.ts`) counts attempts before the hash: 30 per account and 30 per address per hour (raised in round 2 below), right or wrong, shared by the recovery-key route and the PayPal email change. SR11's 10 failures per account per 15 minutes is unchanged. A 429 or a 503 does no hash and costs neither bucket (the 503 since round 2).
- **Failure reservations (SR11).** `reserveLogin`, `reserveRecovery` and `reservePasswordCheck` count the failure before the hash and return a release function. A right answer releases it; so does anything that checked no guess (503 BUSY, a server error, a weak new password in recovery). A lost login race stays counted. `allowLogin`, `recordLoginFailure` and the rest stay exported: `reserve*` is built on them and `tests/auth/limits.test.ts` covers them.
- **Login race.** `startSessionIfPasswordUnchanged` creates the session in one transaction that re-reads the account and requires the verified hash, else 401 `BAD_CREDENTIALS`.
- **Rotation and payee change racing recovery.** Both write only if the row still holds the verified password hash. A lost race is 403 `PASSWORD_WRONG`.
- **Rehash.** `setPasswordHash` writes only if the row still holds the verified hash.
- **25-shop cap (SR17).** `assertUnderShopLimit` runs in the same transaction as `shops.create` in `createDraftShop`. The route keeps its early call so an over-limit request is not read. A refused request has written nothing to disk.
- **Stale shop row (SR18).** The PATCH transaction re-reads the shop. When the patch touches `payeeEmail`: the password rule is applied to the fresh row (403 `PASSWORD_REQUIRED`), a moved status or email is refused with 409 `SHOP_CHANGED`, and the password hash must be unchanged. `old_masked` comes from the fresh row. A patch of other fields is not refused because the email moved. A shop deleted while the body was arriving is 404.
- **Test guards.** See below. `route.tsx` under `api/shops/[id]` is now scanned too.

### Deviations

- `setPasswordHash` and `replaceRecoveryHash` take the verified hash as an **optional** argument, not a required one. `tests/db/accounts-repo.test.ts` calls both with three arguments, and this run may edit tests only for selectors, routes and copy. The three-argument form still writes unconditionally, so it is a foot-gun: both production callers pass the hash. Adding the argument to those two test calls would let the coordinator make it required.
- New error code `409 SHOP_CHANGED` (`This shop changed while you were saving. Reload the page and try again.`). The brief allows a 409 here; it did not name a code.

### Known limit

If two logins with the same old-format password race on the rehash, one wins the compare-and-set and the other gets 401 until it retries. This can only happen after the scrypt parameters change, and a retry succeeds.

### For the screens (WP6)

- `checkCurrentPassword` now takes the client address as a third argument (`clientIp(req)`), and the caller must write with a compare-and-set on `account.passwordHash`. S1's password routes need both.
- Settings should treat 409 `SHOP_CHANGED` like any other save error: show the message, and reload to pick up the new email.
- The current-password attempt limit is 30 per account and 30 per address per hour, enough for one change on each of 25 shops with 5 to spare.

### Edited tests (guards only, as the review asked; no assertion removed)

- `tests/auth/route-guard.test.ts`: `handlersIn` takes optional source text so the guard can test itself. It now throws on binding patterns and `export *`. The `routes.POST` regex became a stricter AST check, `assertSameOrigin` must resolve to its real import, and there is a new check for `route.js` and `route.jsx` files.
- `tests/auth/removal-guard.test.ts`: the mention check also tests each file's path.
- `tests/http/same-origin.test.ts`: the no-proxy list also names the `.js` files.

Each guard was run against real forbidden files (`api/auth/demo/route.ts`, `api/checkout/route.ts`, `src/proxy.js`, a `route.js`), which it caught; they were then removed.

### Verified

`npm test` (1559 passed), `npm run typecheck`, `npm run lint`, and targeted e2e `auth-api`, `start` and `dashboard` (31 passed, 1 pre-existing skip).

## Review round 2 fixes (4 findings, 4 failed acceptance items)

Failing test first for each, in `tests/auth/limits-reserve.test.ts`, `tests/api/auth-races.test.ts` and `tests/api/shops-races.test.ts`.

- **Attempt cap below the shop limit.** `passwordAttemptsAccount` is now 30 per hour (was 10), and `passwordAttemptsIp` stays 30. A test keeps both above `MAX_SHOPS_PER_ACCOUNT`, so raising the shop limit fails it. SR11's failure limit is unchanged and still stops guessing.
- **A 503 cost attempts.** `reservePasswordCheck` now returns a reservation: called, it hands back the failure (right password); `.notChecked()` hands back the failure and both attempts (no hash ran). Both are safe to repeat.
- **429 wording.** Recovery says `Too many tries. Wait an hour and try again.` (every recovery limit is hourly, and the email-wide one has nothing to do with the connection). The current-password check says `Too many tries. Wait up to an hour and try again.` (15 minutes for failures, an hour for attempts). Sign-up and login keep the strings the brief's WP6 copy table dictates. WP6 has no /recover 429 row, so if it maps 429 by code it should use this message.
- **PATCH after the session ended.** `ownershipCheck` (`auth/owner.ts`) reads the cookies before the body, and the PATCH transaction runs its check on the row: an ended session gets 404 and writes nothing, on drafts and on non-email patches too. It runs after the password compare, so a lost recovery race on a password path stays 403 `PASSWORD_WRONG`. Reproduced first with the reviewer's harness (now `recover 200, patch 404`, email unchanged).

### Not changed

- **SR18 (shown in Settings), SR21 (first half), SR22, and so AC1's literal "every SR except SR19".** The review itself finds these need screens. The brief assigns them to WP6 (lines 662, 668, 676) and WP5's section says "API only; no screen changes" (line 612), so building them here would break that rule. The backends are done: `payeeChanges.latest`, `client/auth.ts`, `recoverySavedAt`. WP6 must close all three; the coordinator should check them after that merge.
- **The same in-flight window on the other owner handlers.** `items` (PATCH, POST), `orders/[orderId]/tracking`, `extract`, `counter`, item photos, and cover and logo also check the owner before reading the body, so a request opened before a recovery can still land. The finding named only `PATCH /api/shops/[id]`, the route that holds the PayPal email and the pause switch, and none of these can touch either. Left as is for scope; the coordinator can ask for the same re-check there. `ownershipCheck` works for any of them.

### Edited tests (the limit the review asked to raise; no assertion removed)

These three files are this package's own tests from the previous review round. Each edit moves the literal from the old cap to the new one:

- `tests/auth/limits-reserve.test.ts`: `counts a correct password as an attempt` now uses 30, and `a request refused by the account limit charges the address nothing` fills the account from another address, because the two caps are now equal.
- `tests/api/auth-races.test.ts`: `after 30 correct rotations` (was 10).
- `tests/api/shops-races.test.ts`: `after 30 correct changes` (was 10).

### Verified

`npm test` (119 files, 1572 passed), `npm run typecheck`, `npm run lint`, and targeted e2e `auth-api`, `large-upload`, `start`, `dashboard` (32 passed, 1 pre-existing skip).
