# Progress

_Last updated: 2026-11-06 10:50 IST (session 7)_

## Current phase
**Session 7 (10:39–11:08 IST, a short run).** Done:
- **done, merged (`c32d337`):** session 6's noted follow-up. Orders the shop cancels (`npm run seed -- --cancel-unpaid`) no longer claim "the buyer cancelled on PayPal". `cancelOrder` records the cancel's source (`cancel_url` for PayPal's cancel link, `seller` from the seed). The seller's order page (action card and timeline), the buyer's receipt (`cancelledByShop` on `GET /api/orders/[ref]`) and `get_order_status` read it. TDD: 5 new tests. **670 unit tests pass; typecheck and lint are clean.**
- **Verified on a running app** (dev server on port 3171, a throwaway seeded database, the real sandbox): an order through the door (SHF-CWXB7G, PayPal `2LN13155YE638222B`, $9.00) → `npm run seed -- --cancel-unpaid` cancelled it → the receipt API said `cancelledByShop: true`, the receipt page said "cancelled by the shop before payment", `get_order_status` said "The shop cancelled this order before payment", and the seller order page showed "The shop cancelled it before the buyer paid" with the timeline line "Cancelled by the shop before payment" (no "buyer cancelled" text). The throwaway database was deleted.
- **Not run this session:** the full e2e suite and a judge round (a 29-minute run; the change touches only the copy of cancelled orders and one optional argument, and no money path).

**Session 6 (09:07–~10:40 IST).** Done:
- **done:** a secret scan of the full git history and the working tree before the repo goes public: no `.env` value, PayPal access token, bearer header or owner claim link anywhere (0 hits). GitHub detects the MIT license.
- **done, merged:** review 2 (`docs/reviews/2026-11-06-review-2.md`) over the areas session 5's review didn't cover. Wave 1 had four areas (setup, seller dashboard, buyer side, a security sweep); wave 2 had two lenses (runtime lifecycle and data integrity, cross-surface consistency). A skeptic tried to refute every finding: **14 confirmed, 5 refuted.** The 9 wave-1 fixes are merged (641 unit tests pass; typecheck and lint are clean):
  - X1: on Render the rate-limit key is `CF-Connecting-IP`, because the rightmost `X-Forwarded-For` entry there is a shared Cloudflare edge address (unit-tested; **unverified until deployed**);
  - S1: photos over 50 MP are refused before any pixels are decoded, and uploads decode one at a time (a decompression bomb could have run a 512 MB instance out of memory);
  - S2: review accepts only prices the door can sell (over $0, up to the $500 order cap);
  - S3: an item removed during publish stays removed;
  - S4: a reading keeps at most 10 sizes per item;
  - S5: a retake whose reading fails goes to "try again" with every saved page;
  - D1: the "Can't reach PayPal" banner now appears during an outage;
  - B1: a reload mid-reply keeps the PayPal approval card;
  - B2: `get_order_status` reports `capture_refused`, so the console card shows a refused payment.
- **done, merged:** the 5 wave-2 fixes (651 unit tests pass; typecheck and lint are clean):
  - L1: with no `APP_URL`, the app URL follows the port the server bound, and `.env.example` no longer pins it to 3000;
  - L2: the poller retries every 15 s if PayPal keys arrive after boot, and the unpaid-order caps ignore orders past their expiry;
  - C1: a declined card reads the same on the door (`declined`), the seller page ("Card declined") and the receipt;
  - C3: the console card re-checks every 3 s while it says "Confirming with PayPal";
  - C6: buyer copy says "the address you give PayPal", which fits guest card checkout.
- **Verified:** the full e2e suite on main with wave 1 merged. The capture gate passed (SHF-YZ3EVV → PayPal `4CH44248N9892281R` → capture `5LL32704TR754451L` COMPLETED, $27.00). 2 shop-page tests at 1440 px timed out while fixers loaded the CPUs; on merged main `e2e/shop.spec.ts` alone passed 24/24.
- **Verified:** the full e2e suite on main with both waves merged (09:52 IST): **56 passed, 1 skipped**. The capture gate passed: SHF-GG6GDJ → PayPal `3EH35781PT3793628` → capture `3HK74446UV304740E` COMPLETED ($27.00). The brief flagged the nut allergy, the USPS tracker was SHIPPED, and `get_order_status` read it back. `npm run screenshots:prod`: 68/68 on a production build, axe 0 violations (`docs/judge/screenshots/round-5/`).
- **Judge round 5: ship, no score change** (Part A 22, Part B 21, 0 Part C fails; `docs/judge/round-5.md`). The judge ran its own production build. It checked the seed (9 real Catalog products), the door by curl (an order, a price tamper refused, `IDEMPOTENCY_CONFLICT`, the new `declined` and `capture_refused` fields), two real Claude console turns, a live Claude reading, and the S1 guard (a 56 MP PNG refused with 413 in 0.15 s). Its top fixes are the same three human-gated items, now framed as "amend the spec first" for the door findability and payee items (see "Needs from human").
- **done, after round 5:** the judge's one in-scope miss. A live reading turned "Kids bike safety check FREE w/ tune-up, else $10" into a plain $10 with no question. A condition in `deal_text`, or an ", else $10" clause in the printed line, now asks the seller. No card changed on the 61 recorded sample and fixture items.
- **done, after round 5:** `code-review` (high) over this session's own changes found 10 items; 8 are fixed and 2 kept with reasons (table at the end of `docs/reviews/2026-11-06-review-2.md`). A $0 item price is refused at input, but a $0 shipping fee is still allowed. Publish skips an item changed mid-run. The outage banner counts only transient failures. There is one shared `cardDeclined` rule. `--cancel-unpaid` asks PayPal first. The caps use the service clock. The console's confirm poll stops after 2 minutes. **665 unit tests pass; typecheck and lint are clean.**
- **Verified on the final main (10:30 IST):** 665 unit tests pass; typecheck and lint are clean. The full e2e suite gave **56 passed, 1 skipped** (5.0 min). The capture gate passed: SHF-KJZT97 → PayPal `4FG358017Y8333738` → capture `13D896174A6799217` COMPLETED ($27.00). The brief flagged the nut allergy, the USPS tracker was SHIPPED, and `get_order_status` read it back. `npm run screenshots:prod` re-took `docs/judge/screenshots/round-5/`: 68/68, axe 0 violations; 30 PNGs changed against the judged take, each by 0.41% of pixels or less.
- **Verified: a fresh-clone README walkthrough** (a local clone of main, Node 22, only the 3 keys copied in, `APP_URL` left commented out). Every step passed:
  - `npm install` and `npm ci`;
  - 665 unit tests, typecheck and lint;
  - `npm run seed` (9 real Catalog products in 3.6 s) and `--cancel-unpaid`;
  - `npm run dev -- --port 3141` and a production `npm start -- -p 3141`, both showing the door at `:3141`;
  - the README's door curl, and `create_order` returning a real `sandbox.paypal.com` approval link that loads.

  Fixed from it: `package-lock.json` still had the scaffold's name, so `npm install` dirtied the tree. The README now explains the seed's port, its 9 of 10 items, and what `--cancel-unpaid` does (rehearsal orders now read "cancelled by the shop"; done in session 7).
- **Verified (L1 in production mode):** `next start -p 3131` with no `APP_URL`, on a throwaway seeded database, put the door at `http://localhost:3131/s/marigold-bakehouse/mcp` on the shop page (3 places). The seed, which runs outside the server, still prints `:3000`. The throwaway database was deleted afterwards.
- **done:** `npm run seed` now reports the demo shop's unpaid orders, and `npm run seed -- --cancel-unpaid` cancels rehearsal orders before a recording (one caller can hold 3 unpaid orders per shop). DEMO.md and the README say so.

**Session 5 (from 07:14 IST; capped at 120 min, so it ends by ~09:14 IST).** Running:
- **done, merged:** the milestone code review over `885caa3..63c114c` (`code-review`, high) found 10 candidates; the fixer confirmed and fixed 9 and skipped 1 (CopyRow → CopyButton isn't a clean swap):
  - keeping one of two copies of an item ("listed twice") now clears only that flag, so the kept item's own unusual-price or deal question still gets its card;
  - a card keeps its stored explanation when today's normaliser has none;
  - `screenshots:prod` refuses `..` paths, has no default output folder and deletes nothing if the server never starts;
  - after a copy, the button's name keeps the link ("Agent door link copied");
  - more crossed-out wordings ("cross-out", "strikes", "scored out") and method talk ("matched to", "reading order") are caught;
  - the waiting group's subtotal says "Not paid yet", which is true for approved and payment-pending orders too;
  - the console keeps its scroller in a ref, with a page-scroll fallback.
  586 unit tests pass on main; typecheck and lint are clean.
- **done, merged:** the Claude Code outside-client proof re-run on current main (order SHF-KTZ39C → PayPal `17R81429KU459414P`, `PAYER_ACTION_REQUIRED`, $8.50, `custom_id` matches), with dashboard and order screenshots at 1440 and 390 px in the current design;
- **done, merged:** a fresh-clone walkthrough of the README from GitHub (Node 22), the way a judge would follow it. Every command worked: install, test, typecheck, lint, seed, dev, build and start, the agent door by curl, a live Claude reading, publish, and a console order up to the PayPal link. The README fixes:
  - the flow tells you to choose **Both** for delivery, because a new shop is pickup-only and steps 7–8 need a shipped order;
  - the real button labels;
  - a working agent-door curl with the `Accept` header;
  - the unused buyer-login variables are marked as unused;
  - wallet-login paying is stated as unverified;
  - a **Path to scale** section, marked as not built.
- **done:** five tests left a SQLite file in `/tmp` on every run; they now use `tests/helpers/temp-db.ts`, which deletes them.
- **done:** `docs/judge/screenshots/round-3/` (66/66 passed on a production build, 0 axe violations) and `docs/judge/round-3-tests.txt` (586 unit tests, typecheck and lint clean).
- **Judge round 3: ship** (Part A 22, Part B 21, 0 Part C fails; `docs/judge/round-3.md`). No score moved and none dropped. The fresh judge checked these itself:
  - the seed, two price tampers rejected, an idempotent `create_order`, and PayPal's own order record (SKUs match the Catalog products);
  - a live Tía Lupe reading (9.1 s, with "Horchata" sizes as options);
  - a console order through the door;
  - 586 unit tests, and the full e2e run.
- **Round-3 fixes done (in scope):**
  - `SHELFIE_RECORDED_SAMPLES=1`, so the samples read instantly for a demo even with a key (checked on a production build: 2.6 s, `recorded:claude-sonnet-5-5`);
  - DEMO.md's fallback lines;
  - the real clone URL;
  - the stale screenshot lines;
  - unnamed orders read "No name given";
  - `npm run screenshots` no longer overwrites a committed set.

  588 unit tests pass; typecheck and lint are clean.
- **Not done, needs the human:** fix 1 (pay each seller: a second sandbox Business account) and fix 3 (deploy, video, public repo). Fix 2 (QR counter card and machine-readable discovery) is a spec non-goal; see "Needs from human".
- **done:** `docs/SUBMISSION.md`, a Devpost draft built from verified facts only (pitch, features, how it's built, AI tools, a test-card box), with TODOs for the video, the public repo URL and a hosted URL.
- **done, merged:** the dashboard loading skeleton (`(dashboard)/loading.tsx`) is now a screenshot, `dashboard-loading` at 390 and 1440 px. The test holds the page's RSC navigation request in the browser, on a production build. The whole spec passed: 68/68 with 0 axe violations. The PNGs and the note are in `docs/judge/screenshots/` (the round-3 folder is unchanged). Every async state now has a screenshot.
- **done:** a whole-codebase correctness review workflow. Four area reviewers covered orders and capture, the PayPal client, the agent door and console, and setup and seller auth; each area's findings were checked by a skeptic that tried to refute them. **13 confirmed (1 high, 6 medium, 6 low) and 3 refuted**, written up in `docs/reviews/2026-11-06-whole-codebase.md`.
- **done, merged: all 13 confirmed review findings are fixed** (statuses and commits in `docs/reviews/2026-11-06-whole-codebase.md`). 625 unit tests pass; typecheck and lint are clean.
  - a reused `client_request_id` with different content gets `IDEMPOTENCY_CONFLICT` and no longer returns another buyer's order;
  - one caller can hold 3 unpaid orders per shop (atomic, and the shop-wide 10 is kept);
  - concurrent status calls share one PayPal sync; return-URL syncs are throttled, and a webhook approval older than the last declined capture doesn't capture again;
  - the toolkit rebuilds on a 401 and retries once, which fixes tracking failing after the token expires. **Verified against a real sandbox 401.**
  - a refused capture is shown plainly to the seller and becomes `failed` on VOIDED, 404 or expiry;
  - the same item name and price in two sections stay two items;
  - menu reading has a 180 s overall deadline inside the stale window;
  - per-address limits on new shops, retakes and live readings;
  - JSON and webhook bodies are capped at 64 KB.

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

**Also merged after round 2:**
- **round-3 fixes A:** size words left out of item names when sizes are options; the start sub-line leads with the seller's outcome; one filled primary on the Share tab; "Retry 2 items"; an original non-menu photo for the retake fixture;
- **the capture gate re-run on main** (real sandbox, passed), with `capture/` screenshots in the current design.

- **round-3 fix B:** Tailwind now scans only `src/` (`source("..")`), so writes in `docs/`, `e2e/` or `tests/` no longer rebuild the dev server. The judge's one-time reload loop was **not reproduced** in 5 fresh first starts, so this isn't claimed as its fix.
  - Checked after the merge with `npm run screenshots:prod` on main: 66/66 passed, 0 axe violations.
  - Pixel diffs against round 2 are 0.006–0.42%, which is fixture order numbers and times changing between runs.

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
- **Full e2e suite on main after all 13 review fixes were merged (08:53 IST):** 56 passed and 1 skipped (the hidden "Other" carrier) in 5.6 min, with real Claude and the real sandbox. The capture gate passed: order SHF-7SUNB6 → PayPal order `1L435977R28460711` → capture `01164370A4783870X` COMPLETED ($27.00). The brief flagged the nut allergy, the USPS tracker `9400111179393520752942` was SHIPPED at PayPal, and `get_order_status` read it back.
- **Full e2e suite on main after the session-5 merges (07:43 IST):** 56 passed and 1 skipped (the hidden "Other" carrier) in 6.5 min, with real Claude and the real sandbox. The capture gate passed in 1.4 min: order SHF-GW9P2M → PayPal order `72E098971B1748300` → capture `9AS032720T739521X` COMPLETED ($27.00). The brief flagged the nut allergy, the USPS tracker was SHIPPED at PayPal, and `get_order_status` read it back.
- **Capture gate re-run on main after the direction-A merge (session 4, 07:02 IST), passed in 2.3 min, with screenshots refreshed in the current design (`docs/judge/screenshots/capture/`):** order SHF-28CLQE → PayPal order `8UL03058RN6568620` → capture `0PJ97777YU143884P` COMPLETED ($27.00). The Claude brief flagged the nut allergy. The USPS tracker `9400111179392836896326` was SHIPPED at PayPal, and `get_order_status` read it back.
- **Outside MCP client (session 4, re-run in session 5 on current main):** the Claude Code CLI (2.1.318, headless, `--mcp-config docs/judge/evidence/claude-code-mcp.json --strict-mcp-config`), with only the shop's agent door loaded, called `get_shop_info` → `list_products` → `create_order`. The session-5 run produced order SHF-KTZ39C, PayPal order `17R81429KU459414P` (`PAYER_ACTION_REQUIRED`, $8.50) and a real approval link (session 4's run: SHF-A8PD7A, `3RG62077NC717421B`). The dashboard shows it "via Claude Code". It ran on localhost, not a deployed URL.
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

## Next steps
1. **Every lever left for Part A needs the human** (judge rounds 3, 4 and 5 agree; no score has moved since round 2):
   - make the repo public, record the video, and deploy;
   - a decision on amending the spec so the door findability work (counter card with QR, JSON-LD, `<link rel="alternate">`) is in scope;
   - a second sandbox Business account, plus a spec line, for paying each seller.
2. Until then, the in-scope work is hardening and demo readiness. Two whole-codebase reviews and two diff reviews have now been run and fixed. The next highest-value check would be a fresh-clone README walkthrough after this session's `.env.example` change (`APP_URL` is now commented out; the app follows the bound port).
3. If the human says yes to the spec amendment, judge round 5's top fix 2 has the plan: a print counter card from the Share tab, JSON-LD and a door `<link>` on the shop page, and a recorded Claude Code run given only the shop URL. About an hour; it touches no money path.

## Needs from human
- **Decision: amend the spec so "make the door findable" can be built?** (Judge round 5 says to amend spec §14 first, because its own buyer journey at line 36 already relies on a "QR at the stall".) Judge round 3's only code-doable lever for Innovation (A4), Idea (B1) and B5 is:
  - a printable counter card with a QR code of the shop link ("Order ahead with any AI assistant, pay on PayPal");
  - schema.org JSON-LD and a `<link>` to the agent door on the shop page;
  - an `agents.txt`;
  - a recorded run of Claude Code given only the shop URL.

  The spec lists QR codes and discovery cards as **non-goals**, and the run brief says not to add features beyond the spec, so it isn't built. It's about an hour of work and touches no money path. Say so in the next run's brief to have it built.
- Optional: about 1,300 stray SQLite files from earlier unit-test runs (`/tmp/shelfie-{instr,route,webhook,seller-routes,console-key}-*.db*`). The tests no longer create them; deleting the old ones was blocked by the session's permission rules, so `rm` them by hand if you like.
- **Before 12 Nov 12:00 PT, required for the submission:**
  - make the GitHub repo **public** (it's private now, as the run brief requires);
  - record the under-3-minute demo video from `docs/DEMO.md` and post it publicly on YouTube;
  - submit on Devpost.
- **GitHub About section** (it's empty today; GitHub already detects the MIT license). Suggested description: "Snap a photo of a price list: Claude builds a PayPal catalog and an agent door (MCP) any AI assistant can order through, paid with PayPal Orders v2." Suggested topics: `paypal`, `mcp`, `claude`, `agentic-commerce`, `nextjs`.
- **Before recording the video:** run `npm run seed -- --cancel-unpaid` to clear rehearsal orders on the demo shop (one caller can hold 3 unpaid orders).
- **Deploy (optional but valuable):**
  - apply `render.yaml` on Render (a paid instance for the persistent disk), paste the secrets, and run `npm run seed` in Render Shell;
  - create the PayPal webhook for `https://<service>.onrender.com/api/paypal/webhook` and set `PAYPAL_WEBHOOK_ID`; that verifies the webhook path;
  - put the URL at the top of the README.
  - check the rate-limit key on Render (review 2, X1): two phones on different networks should not share the console's limit. The fix reads `CF-Connecting-IP` when `RENDER` is set; it is unit-tested but has never run on Render.
- **To pay each seller directly (judge round 2, top fix 1):** a second **US sandbox Business** account, created in the PayPal Developer Dashboard. Its email would be set as `payee.email_address` on a shop's orders, and the payment and tracking verified against it. Not built in this run, because it can't be verified without that account.
- (Resolved in session 3.) From 04:52 IST on 6 Nov, `git push` failed with `remote: fatal error in commit_refs`. The REST API still accepted writes, so `.scratch/api-push.py` (gitignored) rebuilt the 15 commits through the Git Data API with identical SHAs and moved `main`. Plain `git push` worked again from 05:05 IST. If it fails again, run `python3 -I .scratch/api-push.py ~/paypal-ai codebreaker32/paypal-ai main`.
- Optional: a **US** sandbox personal (buyer) account, to show paying with a PayPal wallet login in the demo. The current buyer and the merchant are both India accounts, so wallet payments between them are blocked. Guest card checkout works without it.
- Optional: single-quote `PAYPAL_SANDBOX_BUYER_PASSWORD` in `.env`. It contains `#`, and dotenv cuts the value there.
