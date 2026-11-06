# Progress

_Last updated: 2026-11-06 06:56 IST (session 4)_

## Current phase
**Session 4 (from 05:24 IST; capped at 120 min, so it ends by ~07:24 IST).** Merged to main (`0c5791e`, 573 unit tests, typecheck and lint clean, pushed):
- **Visual direction A "Menu board"** won the direction round (`docs/judge/directions.md`: A2 4 vs 4, 0 Part C fails for both). The judge's fixes and its take-from-B list were done on top:
  - the order number never splits;
  - the live-step gutter is fixed;
  - the console scroll keeps the latest turn's Activity card in view;
  - the dashboard shows group subtotals;
  - phone slips show the total next to the order number;
  - order detail has a Total block;
  - the review list uses menu rows;
  - the publish bar shows refused items apart.
- **Round-1 fix 1a:** plain seller copy on the review cards (fixed sentences, notes with method talk filtered out, samples re-recorded with the real model).
- **Round-1 fix 2 (the parts allowed in this run):**
  - `render.yaml` (validated against Render's schema), `GET /api/health`, the `RENDER_EXTERNAL_URL` fallback, and a README deploy section (not yet run);
  - **the Claude Code CLI ordered through the agent door** as an outside MCP client and got a real PayPal approval link (`docs/judge/evidence/outside-client-claude-code.md`).
- **8 more async states screenshotted:** publishing, retry, console thinking / rate-limited / error, brief writing, tracking error, PayPal unreachable.
- **Milestone code review** (25c80c2..885caa3): 7 findings, all fixed.
- **EVIDENCE 5b:** 3 verified seller voices.

**Judge round 2: ship.** Part A 22 (up from 21; A2 4 → 5), Part B 21, 0 Part C fails (`docs/judge/round-2.md`, 66 screens with 0 axe violations from one production-build run).

**Running:**
- the round-3 workers (r3a: copy, Share tab, retake photo, size words; r3b: the dev reload loop);
- the capture gate re-run on the real sandbox, for new-look `capture/` screenshots.

**Done in docs:** `docs/DEMO.md` now opens on the Store Sync contrast and adds the Claude Code beat; `npm run screenshots:prod` runs the screenshots against a production build.

**Session 3 (04:55–05:24 IST):** judge round 1 scored Part A 21, Part B 21, with 1 Part C fail (raw AI notes on the review card). Verdict: **fix**. Session 3 then started the five workers above.

Session 2 ended with:
The core flow is built, reviewed and verified end to end on the real sandbox. All of wave 3 is merged:
- the capture gate;
- the demo seed;
- the full-flow e2e;
- the round-1 screenshots (50 screens, 0 axe violations);
- the measured timings;
- the submission docs;
- fixes from the milestone code review.

Next: judge round 1, the visual-direction round, then the judge loop until the verdict is "ship".

## Done
- Product approach round: approach 1 (seller-first) won judge round 0 (Part A 19, Part B 21 vs 18/19). Final spec `docs/superpowers/specs/2026-11-06-shelfie-design.md`; plan `docs/superpowers/plans/2026-11-06-shelfie.md`.
- Task 0: Next.js 16 scaffold, SQLite schema + repos, domain contracts, PayPal port + fake, owner auth, MIT LICENSE, `.env.example`, sample menu photos (19 unit tests pass; typecheck, lint, build clean).
- Brainstorming questions answered and logged in `docs/DECISIONS.md`.
- Sandbox probe (real calls): OAuth, Catalog Products create, Orders create with approval link, capture-before-approval error, webhooks list.
- Spike: Claude `claude-sonnet-5-5` structured-output extraction of a generated menu photo (11/11 items correct, 7.4 s).
- Spike: PayPal Agent Toolkit tools (`get_order`, `list_products`, `get_shipment_tracking`) execute against the sandbox.

## Verified (ran it)
- **Outside MCP client (session 4):** the Claude Code CLI (2.1.318, headless, `--mcp-config docs/judge/evidence/claude-code-mcp.json --strict-mcp-config`), with only the shop's agent door loaded, called `get_shop_info` → `list_products` → `create_order`. That produced order SHF-A8PD7A, PayPal order `3RG62077NC717421B` (`PAYER_ACTION_REQUIRED`, $8.50) and a real approval link. The dashboard shows it "via Claude Code". It ran on localhost, not a deployed URL.
- **Re-recorded samples (session 4):** all three sample readings were recorded again with real `claude-sonnet-5-5` and the owner-facing prompt. Item names and prices are identical, and Marigold still shows 10 items, 4 needing the seller.
- **Capture gate re-run on main after the Task 11 fixes (session 3, ~05:10 IST), passed in 3.5 min:** order `SHF-7D5KQN` → PayPal order `18424242KV221112J` → capture `7L534834RM8417808` COMPLETED ($27.00). The Claude brief flagged the nut allergy against the almond croissants. USPS tracker `9400111179392174599760` SHIPPED at PayPal, and `get_order_status` read it back.
- **Capture gate, end to end on the real sandbox (`e2e/capture.spec.ts`, passed twice in a row):** a new shop from the sample photo read live by Claude → published to the PayPal Catalog → an MCP client over HTTP calls `get_shop_info` → `list_products` → `create_order` (shipped, nut-allergy note) → PayPal guest card checkout → our return URL captures → receipt **Paid** → the stored capture id matches PayPal's own order record (COMPLETED) → the order brief is written by the Claude agent → USPS tracking from the order page exists at PayPal (SHIPPED) → `get_order_status` returns the tracking number. Example run: order `9SS11373NT603413P`, capture `3K941065XR757601S`.
- `npm run test:sandbox` (PayPal client): product create, order create → PAYER_ACTION_REQUIRED + approval link, same request id → same order, capture before approval → ORDER_NOT_APPROVED, Agent Toolkit `get_order` on a real order, toolkit error for a non-existent order (5/5).
- MCP agent door over real HTTP with the MCP SDK client (unit/route tests with a fake PayPal); 217 unit tests pass on main.
- Menu reader on the 4 sample photos with real Claude (`npm run test:ai`, 4/4): Marigold 10 items in 10.3 s, Tía Lupe 9.5 s, Ravi 7.3 s, blurry photo → "unreadable" with a retake tip in 4.3 s.
- PayPal sandbox OAuth, `POST /v1/catalogs/products`, `POST /v2/checkout/orders` → `PAYER_ACTION_REQUIRED` + `payer-action` link.
- Claude vision extraction via `@anthropic-ai/sdk` `messages.parse`.
- **Approval + capture on the real sandbox (session 2 spike):** order `3K582170DV477391D` built with the app's `createPayPalClient` + `buildOrderBody` (shipping order, $18.25), approved on PayPal's approval page via guest card checkout (country US, PayPal sandbox test Visa `4012000033330026`), then `captureOrder` → order COMPLETED, capture `9BV852348L665241F` COMPLETED.
- **Full paid path through the app (session 2, Task 7 fix round):** buyer console order over the real MCP door → PayPal guest card checkout → our return URL → capture → receipt **Paid** → the console card switches to "Paid · View receipt".
- **Photo → live shop, measured (Task 9c):** 6 real runs (3 sample photos × 2) uploading the photo, real Claude reading, real PayPal Catalog publish: 8–14 s machine time (reading 6.5–9.4 s, publish 1.5–3.7 s). Table in `docs/EVIDENCE.md`.
- Unit tests: 573 pass on main (session 4); typecheck and lint clean. Full e2e suite (minus the capture gate): 103 passed, 1 skipped (Task 9b run). `e2e/flow.spec.ts` covers sample menu → review → publish → shop → console order → approval link, with real Claude and the real sandbox.
- `npm run seed` on a fresh DB publishes the Marigold Bakehouse demo shop (9 real sandbox products) at the reserved slug `marigold-bakehouse`; a second run changes nothing.
- Round-1 screenshots: 50 screens (390 and 1440 px), axe WCAG 2.1 A/AA, 0 violations (`docs/judge/screenshots/round-1/axe-results.json`).
- Task 7 (session 2, real sandbox): the buyer console ordered from a live shop over the real MCP door and got a real PayPal approval link ($27.00); PayPal's own "Cancel and return" link landed on our cancelled receipt.
- Task 8 (session 1 worker): AI order brief written 3× by the Claude brief agent calling the Agent Toolkit's `get_order` on real sandbox orders (~10 s each).

## Unverified
- Paying with a PayPal wallet login: the sandbox merchant and the `.env` buyer are both India accounts, and PayPal blocks IN-to-IN wallet payments ("This seller doesn't accept payments in your currency").
- Webhooks (no public URL on the VM).
- The Render deploy: `render.yaml` validates against Render's schema, but it has never been deployed (out of scope for this run).
- The dashboard loading skeleton has no screenshot.

## Next steps
1. Merge the round-3 workers once they're reviewed. Their reports are `.superpowers/sdd/2026-11-06-shelfie/s4-r3a-report.md` and `s4-r3b-report.md`.
   - **r3a:** size words left out of item names when the sizes are options, a start sub-line that leads with the seller's outcome, one filled primary on the Share tab, "Retry 2 items", and a non-menu photo for the retake fixture.
   - **r3b:** the dev-server reload loop the round-2 judge saw once.
2. Re-run the capture gate with `SHELFIE_SCREENSHOTS=1` (real sandbox) so `docs/judge/screenshots/capture/` shows the current design. Re-shoot the outside-client dashboard evidence too.
3. A final whole-branch code review. Then judge round 3 with `npm run screenshots:prod -- docs/judge/screenshots/round-3`.
4. Each round after that takes the next-highest gain from the judge's top 3, limited to what can be done in code and docs in this run.

## Needs from human
- **Before 12 Nov 12:00 PT, required for the submission:**
  - make the GitHub repo **public** (it's private now, as the run brief requires);
  - record the under-3-minute demo video from `docs/DEMO.md` and post it publicly on YouTube;
  - submit on Devpost.
- **Deploy (optional but valuable):**
  - apply `render.yaml` on Render (a paid instance for the persistent disk), paste the secrets, and run `npm run seed` in Render Shell;
  - create the PayPal webhook for `https://<service>.onrender.com/api/paypal/webhook` and set `PAYPAL_WEBHOOK_ID`; that verifies the webhook path;
  - put the URL at the top of the README.
- **To pay each seller directly (judge round 2, top fix 1):** a second **US sandbox Business** account, created in the PayPal Developer Dashboard. Its email would be set as `payee.email_address` on a shop's orders, and the payment and tracking verified against it. Not built in this run, because it can't be verified without that account.
- (Resolved in session 3.) From 04:52 IST on 6 Nov, `git push` failed with `remote: fatal error in commit_refs`. The REST API still accepted writes, so `.scratch/api-push.py` (gitignored) rebuilt the 15 commits through the Git Data API with identical SHAs and moved `main`. Plain `git push` worked again from 05:05 IST. If it fails again, run `python3 -I .scratch/api-push.py ~/paypal-ai codebreaker32/paypal-ai main`.
- Optional: a **US** sandbox personal (buyer) account, to show paying with a PayPal wallet login in the demo. The current buyer and the merchant are both India accounts, so wallet payments between them are blocked. Guest card checkout works without it.
- Optional: single-quote `PAYPAL_SANDBOX_BUYER_PASSWORD` in `.env`. It contains `#`, and dotenv cuts the value there.
