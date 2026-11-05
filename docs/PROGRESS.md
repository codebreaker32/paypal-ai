# Progress

_Last updated: 2026-11-06 04:26 IST (session 2)_

## Current phase
Build, wave 3 of 3 (session 2). Wave 2 is merged: setup flow (Task 6), shop page + buyer console + receipt (Task 7), dashboard + AI brief + tracking + webhook (Task 8), each reviewed and fixed. Lint cleanup and measured photo-to-live timings (Task 9c) are merged. Running now: Task 9a (capture gate e2e: agent order → PayPal guest checkout → Paid → brief → tracking → `get_order_status`) and Task 9b (demo seed, full-flow e2e, round-1 screenshots with axe). Next: judge round 1 and the visual-direction round in parallel, then docs (README, AI_TOOLS, DEMO).

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
- **Full paid path through the app (session 2, Task 7 fix round):** buyer console order over the real MCP door → PayPal guest card checkout → our return URL → capture → receipt **Paid** → the console card switches to "Paid · View receipt".
- **Photo → live shop, measured (Task 9c):** 6 real runs (3 sample photos × 2) uploading the photo, real Claude reading, real PayPal Catalog publish: 8–14 s machine time (reading 6.5–9.4 s, publish 1.5–3.7 s). Table in `docs/EVIDENCE.md`.
- Unit tests: 482 pass on main; typecheck and lint clean.
- Task 7 (session 2, real sandbox): the buyer console ordered from a live shop over the real MCP door and got a real PayPal approval link ($27.00); PayPal's own "Cancel and return" link landed on our cancelled receipt.
- Task 8 (session 1 worker): AI order brief written 3× by the Claude brief agent calling the Agent Toolkit's `get_order` on real sandbox orders (~10 s each).

## Unverified
- Capture through the app's own return URL and a Playwright test (the capture gate, wave 3). Capture itself is verified (see Verified).
- Paying with a PayPal wallet login: the sandbox merchant and the `.env` buyer are both India accounts, and PayPal blocks IN-to-IN wallet payments ("This seller doesn't accept payments in your currency").
- Webhooks (no public URL on the VM).

## Next steps
Running at 04:26 IST in their own worktrees (ledger `.superpowers/sdd/2026-11-06-shelfie/progress.md` has paths, briefs and report files). If a session ends mid-run, a fresh worker resumes in the same worktree from its brief and report:
- Task 9a, capture gate e2e (`e2e/capture.spec.ts`, guest checkout).
- Task 9b: seed with a reserved slug, `e2e/flow.spec.ts`, and `e2e/screenshots.spec.ts` with axe → `docs/judge/screenshots/round-1/`.
- Task 11: fixes from the milestone code review (8 findings).

After they land:
1. Review, merge, then run judge round 1 on main with the round-1 screenshots, plus the two visual-direction workers (A "Menu board", B "Counter ledger"; brief `.superpowers/sdd/2026-11-06-shelfie/visual-directions.md`) in parallel.
2. The judge compares the two directions; merge the winner; judge round 2. Work through the top-3 fixes until the verdict is "ship".
3. A final whole-branch code review, then add the capture gate and `npm run screenshots` to the README once they're on main.

## Needs from human
- Optional: a **US** sandbox personal (buyer) account, to show paying with a PayPal wallet login in the demo. The current buyer and the merchant are both India accounts, so wallet payments between them are blocked. Guest card checkout works without it.
- Optional: single-quote `PAYPAL_SANDBOX_BUYER_PASSWORD` in `.env`. It contains `#`, and dotenv cuts the value there.
