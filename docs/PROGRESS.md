# Progress

_Last updated: 2026-11-06 01:53 IST (session 1)_

## Current phase
Build, wave 1 of 3 (subagent-driven, parallel worktrees): PayPal client, menu reader, orders + MCP agent door, design system + Start page. Ledger: `.superpowers/sdd/2026-11-06-shelfie/progress.md` (local only).

## Done
- Product approach round: approach 1 (seller-first) won judge round 0 (Part A 19, Part B 21 vs 18/19). Final spec `docs/superpowers/specs/2026-11-06-shelfie-design.md`; plan `docs/superpowers/plans/2026-11-06-shelfie.md`.
- Task 0: Next.js 16 scaffold, SQLite schema + repos, domain contracts, PayPal port + fake, owner auth, MIT LICENSE, `.env.example`, sample menu photos (19 unit tests pass; typecheck, lint, build clean).
- Brainstorming questions answered and logged in `docs/DECISIONS.md`.
- Sandbox probe (real calls): OAuth, Catalog Products create, Orders create with approval link, capture-before-approval error, webhooks list.
- Spike: Claude `claude-sonnet-5-5` structured-output extraction of a generated menu photo (11/11 items correct, 7.4 s).
- Spike: PayPal Agent Toolkit tools (`get_order`, `list_products`, `get_shipment_tracking`) execute against the sandbox.

## Verified (ran it)
- PayPal sandbox OAuth, `POST /v1/catalogs/products`, `POST /v2/checkout/orders` → `PAYER_ACTION_REQUIRED` + `payer-action` link.
- Claude vision extraction via `@anthropic-ai/sdk` `messages.parse`.

## Unverified
- Order capture after buyer approval (needs a sandbox buyer login; see below).
- Webhooks (no public URL on the VM).

## Next steps
1. Review and merge wave 1; write `src/lib/services.ts` (composition root).
2. Wave 2: setup flow (upload → review → publish), shop page + buyer console + receipt, dashboard + brief + tracking + webhook.
3. Wave 3: seed, e2e, screenshots, judge round 1.

## Needs from human
- `PAYPAL_SANDBOX_BUYER_EMAIL` and `PAYPAL_SANDBOX_BUYER_PASSWORD` in `.env` (a sandbox **personal** account from developer.paypal.com → Sandbox accounts) so capture can be tested end to end. Sandbox card capture isn't available on this merchant (`PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`).
