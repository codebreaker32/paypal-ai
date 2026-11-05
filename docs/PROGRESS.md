# Progress

_Last updated: 2026-11-06 03:36 IST (session 2)_

## Current phase
Build, wave 2 of 3 (session 2). Task 8 (dashboard, AI brief, tracking, webhook) is reviewed, fixed and merged. Task 6 (setup flow) and Task 7 (shop page, buyer console, receipt) are in review fix rounds. A spike is investigating the sandbox buyer approval blocker (below). Next: merge Tasks 6 and 7, then wave 3 (seed, e2e incl. the capture gate, screenshots), judge round 1, visual-direction round.

## Done
- Product approach round: approach 1 (seller-first) won judge round 0 (Part A 19, Part B 21 vs 18/19). Final spec `docs/superpowers/specs/2026-11-06-shelfie-design.md`; plan `docs/superpowers/plans/2026-11-06-shelfie.md`.
- Task 0: Next.js 16 scaffold, SQLite schema + repos, domain contracts, PayPal port + fake, owner auth, MIT LICENSE, `.env.example`, sample menu photos (19 unit tests pass; typecheck, lint, build clean).
- Brainstorming questions answered and logged in `docs/DECISIONS.md`.
- Sandbox probe (real calls): OAuth, Catalog Products create, Orders create with approval link, capture-before-approval error, webhooks list.
- Spike: Claude `claude-sonnet-5-5` structured-output extraction of a generated menu photo (11/11 items correct, 7.4 s).
- Spike: PayPal Agent Toolkit tools (`get_order`, `list_products`, `get_shipment_tracking`) execute against the sandbox.

## Verified (ran it)
- `npm run test:sandbox` (PayPal client): product create, order create → PAYER_ACTION_REQUIRED + approval link, same request id → same order, capture before approval → ORDER_NOT_APPROVED, Agent Toolkit `get_order` on a real order, toolkit error for a non-existent order (5/5).
- MCP agent door over real HTTP with the MCP SDK client (unit/route tests with a fake PayPal); 217 unit tests pass on main.
- Menu reader on the 4 sample photos with real Claude (`npm run test:ai`, 4/4): Marigold 10 items in 10.3 s, Tía Lupe 9.5 s, Ravi 7.3 s, blurry photo → "unreadable" with a retake tip in 4.3 s.
- PayPal sandbox OAuth, `POST /v1/catalogs/products`, `POST /v2/checkout/orders` → `PAYER_ACTION_REQUIRED` + `payer-action` link.
- Claude vision extraction via `@anthropic-ai/sdk` `messages.parse`.
- **Approval + capture on the real sandbox (session 2 spike):** order `3K582170DV477391D` built with the app's `createPayPalClient` + `buildOrderBody` (shipping order, $18.25), approved on PayPal's approval page via guest card checkout (country US, PayPal sandbox test Visa `4012000033330026`), then `captureOrder` → order COMPLETED, capture `9BV852348L665241F` COMPLETED.
- Task 7 (session 2, real sandbox): the buyer console ordered from a live shop over the real MCP door and got a real PayPal approval link ($27.00); PayPal's own "Cancel and return" link landed on our cancelled receipt.
- Task 8 (session 1 worker): AI order brief written 3× by the Claude brief agent calling the Agent Toolkit's `get_order` on real sandbox orders (~10 s each).

## Unverified
- Capture through the app's own return URL and a Playwright test (the capture gate, wave 3). Capture itself is verified (see Verified).
- Paying with a PayPal wallet login: the sandbox merchant and the `.env` buyer are both India accounts, and PayPal blocks IN-to-IN wallet payments ("This seller doesn't accept payments in your currency").
- Webhooks (no public URL on the VM).

## Next steps
1. Review and merge wave 1; write `src/lib/services.ts` (composition root).
2. Wave 2: setup flow (upload → review → publish), shop page + buyer console + receipt, dashboard + brief + tracking + webhook.
3. Wave 3: seed, e2e, screenshots, judge round 1.

## Needs from human
- Optional: a **US** sandbox personal (buyer) account, to show paying with a PayPal wallet login in the demo. The current buyer and the merchant are both India accounts, so wallet payments between them are blocked. Guest card checkout works without it.
- Optional: single-quote `PAYPAL_SANDBOX_BUYER_PASSWORD` in `.env`. It contains `#`, and dotenv cuts the value there.
