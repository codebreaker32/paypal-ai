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
