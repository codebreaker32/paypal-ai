# Judge round 4: main 85c5648, after the whole-codebase review

**What I judged:**
- All 68 round-4 screenshots (34 pairs at 390 px and 1440 px), `axe-results.json` and the screenshot README, which labels the fixture and mocked states. I looked at `dashboard-loading-390` (new) and `dashboard-orders-390` in full.
- `round-4-tests.txt` (unit, typecheck, lint, the screenshot run and the full e2e run with the real-sandbox capture gate).
- The code-review record `docs/reviews/2026-11-06-whole-codebase.md` (13 confirmed findings, R1 to R13). I spot-checked R6 and R3 in the code and the screenshots.
- `README.md`, `docs/DEMO.md`, the diff stat since round 3 (`6183d15..HEAD`: 28 files in `src`, +494 / −98), and greps for each of round 3's top fixes.
- `gh repo view --json visibility`.

I did not read `PROGRESS.md`, `DECISIONS.md` or commit messages. I scored fixture and mocked states as UI only and took the money evidence from the capture gate.

**What I checked myself (12-minute timebox):**
- **axe:** I counted `axe-results.json`: **68 entries, 0 violations**.
- **R6 (door, high: one buyer could get another buyer's order through a reused `client_request_id`).** `src/lib/orders/service.ts:92` and `:244` now route every key hit through `sameRequestOrConflict` (`:106`), which throws `IDEMPOTENCY_CONFLICT` (`:117`) when items, options, quantities or fulfillment differ. It is covered in `tests/orders/service.test.ts`. Fixed as recorded.
- **R3 (a refused capture left the order stuck and told the seller the money was coming).** `dashboard-orders-390` now shows SHF-B3QB5L with a red **PayPal refused payment** badge in "Waiting for payment", not "Paid". Fixed as recorded, on screen.
- **Round 3's copy nit.** Unnamed orders now read **"No name given · via Claude"** (`dashboard-orders-390`, SHF-B3QB5L, SHF-SW9QEK, SHF-AC97JU; `src/lib/seller/view.ts:42`; `tests/seller/view.test.ts:56`).
- **Dashboard skeleton.** `dashboard-loading-390` shows the skeleton (`(dashboard)/loading.tsx`), labelled **mocked** in the README (the RSC request is held in the browser). That closes the last missing async state from round 3.
- **Repo:** `{"visibility":"PRIVATE"}`.
- **Round 3 fixes 1 and 2, by grep over `src`:** `payee` 0 hits; `qrcode|QRCode|Print counter` 0 hits; `ld+json|agents.txt` 0 hits; `src/app/s/[slug]/` holds only `page.tsx`, `mcp`, `photo` and `not-found.tsx`.

**From the test log (not re-run by me):** `npm test` 51 files, **625 passed**; typecheck and lint exit 0; 68 screenshots passed; full e2e **56 passed, 1 skipped** (the hidden "Other carrier" test). The capture gate: SHF-7SUNB6, PayPal order `1L435977R28460711`, capture `01164370A4783870X` **COMPLETED** for $27.00, a brief that flags the nut allergy, USPS tracker SHIPPED, and `get_order_status` reading the tracking back.

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** | Unchanged in shape, stronger underneath. Catalog Products, Orders v2 with Catalog SKUs, approve and capture (capture gate, `01164370A4783870X` COMPLETED), Agent Toolkit `get_order` for the brief and `create_shipment_tracking` (tracker SHIPPED, read back through MCP). This round closed 13 confirmed correctness findings on the money and door paths, including the toolkit's stale OAuth token (R1), refused captures (R3), repeated capture attempts on a declined card (R4), cross-buyer idempotency (R6, verified above), the unpaid-order cap (R7) and the status-sync throttle (R8). AI: live vision extraction, the buyer-console agent and the brief agent. *Not verified:* the webhook (deploy only) and wallet-login payment. |
| A2 Design | **5** | Round 3's two small things are done: "No name given · via Claude" replaces "Buyer · via Claude", and the dashboard skeleton is shown (`dashboard-loading-390`). A refused capture now has its own state on the dashboard (`dashboard-orders-390`, **PayPal refused payment**) instead of a false "Paid". Every async state in the rubric is now screenshotted. |
| A3 Potential impact | **4** | Audience and pain are unchanged and sourced (`EVIDENCE.md`). **What holds it at 4, for the third round:** the money still goes to the platform. `grep -rn payee src` finds 0 hits, and the README's Limitations line ("One sandbox merchant receives all payments") is unchanged. *Fix:* top fix 1. |
| A4 Innovation | **4** | Nothing changed in what makes the door new or findable. There's still no counter card or QR, no JSON-LD or `<link>` to the door on the shop page, and no agents route (greps above). An assistant reaches a shop only if someone pastes the link. *Fix:* top fix 2. |
| A5 Presentation readiness | **4** | **Better:** `DEMO.md`'s fallback is now true. `SHELFIE_RECORDED_SAMPLES=1` (`src/lib/config.ts:40`) gives an instant, labelled **Recorded reading**, documented in `DEMO.md:10` and `:44` and in the README's env table. The README's clone line is the real URL (`README.md:47`). **Not ready:** no video; the deploy is "**Not yet run.**" (`README.md:116`); the repo is `PRIVATE`. *Fix:* top fix 3. |
| **Total** | **22/25** (unchanged) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **4** | Unchanged: "Prepaid orders from a photo of your price list". The only human way in is still **Order with an assistant**; nothing on paper points a regular at the shop. *Fix:* top fix 2 (the counter card). |
| B2 Implementation | **5** | 625 of 625 unit tests, 56 e2e passed with the real capture gate, typecheck and lint clean. A recorded whole-codebase review with a verifier per finding, 13 fixes, and the one I spot-checked (R6) is in the code with a test. |
| B3 Depth | **4** | More real-world failure handling: refused captures (R3), declined-card retries (R4), duplicate names across sections (R10), the reading timeout budget (R12), rate limits on shop creation and reading (R11) and body caps (R2, R5, R9, R13). The scale path still rests on per-seller payouts, which are unbuilt. *Fix:* top fix 1. |
| B4 Usefulness | **4** | A seller still can't use it this week: the money goes to Shelfie's merchant, there's no hosted instance and nothing for the counter. *Fix:* top fixes 1, 2 and 3. |
| B5 Innovation | **4** | Same as A4: the door isn't discoverable. *Fix:* top fix 2. |
| **Total** | **21/25** (unchanged) | |

## Part C

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One marigold fill per screen, as in round 3; `dashboard-orders-390` keeps actions as outlined per-order buttons (Add tracking, Mark picked up). |
| Loading, success, empty and error states | **Pass** | All of round 3's set, plus the dashboard skeleton (`dashboard-loading`, mocked and labelled) and the refused-capture state on the dashboard. |
| WCAG AA contrast, keyboard, visible focus, alt text | **Pass** | `axe-results.json`: 68 screens, **0 violations** (I counted). |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass** | The screenshot spec asserts no overflow on all 68 screens and passed (`round-4-tests.txt`). `dashboard-orders-390` has full-width 44 px+ buttons. |
| Copy is plain and specific, no jargon, no placeholders | **Pass** | "No name given", "PayPal refused payment", "The buyer hasn't approved on PayPal yet. The link expires at 4:22 AM." Round 3's `git clone <this repo>` placeholder is gone. |
| No generic AI look | **Pass** | Same newsprint, blackboard ink and marigold system; no gradients, glass or emoji. |
| No empty hero, no three identical feature cards | **Pass** | Unchanged from round 3. |
| No lorem or fake stats | **Pass** | Realistic content; fixtures and mocks labelled in the README. |
| Deliberate type pairing, palette and spacing | **Pass** | Playfair Display, Schibsted Grotesk, IBM Plex Mono; unchanged. |
| Tokens defined once and used everywhere | **Pass** | Unchanged from round 3 (tokens in `globals.css`). |
| Type scale and line length | **Pass** | Unchanged. |
| Consistent components, subtle motion | **Pass** | The skeleton uses the same card shapes and paper colour as the loaded dashboard. |

**Part C: 0 fails** (round 3 also had 0).

## Round 3's top 3 fixes

1. **Pay the seller (payee email):** **not done.** `payee` has 0 hits in `src`; no setup field, no `payee.email_address`, no second-merchant capture. **Score:** A3, B3, B4 held at 4. It was not attempted, so it is not a failed approach.
2. **Make the door findable (counter card, JSON-LD, agents route, outside-client proof):** **not done**, apart from its small copy fix ("No name given", done and tested). **Score:** A4, B1, B5 held at 4.
3. **Deploy, record, publish:** **docs part done, human part not done.** Done: the recorded-samples switch and the corrected `DEMO.md` fallback, and the real clone URL. Not done: deploy ("Not yet run"), video, public repo (`PRIVATE`). **Score:** A5 held at 4.

**The score did not go up, for the second round in a row** (22 / 21 / 0 in rounds 2, 3 and 4). No criterion went down, so there's no regression. This round's work went into a correctness review (13 real bugs fixed, one of them high severity on the door), which was worth doing before a public demo but doesn't move a Part A score. The three items that move scores have now been top fixes for two or three rounds without being started. The loop rule asks for a different approach when a fix fails; here the fixes weren't tried, so the change of approach is in sizing: each fix below is cut to the smallest piece that moves one score.

## Top 3 fixes (ranked by Part A gain)

1. **Make the door findable, smallest version first (A4 4 → 5; B1 and B5 4 → 5). Code.**
   - Ship this before the payee work: it needs no new PayPal account and no human step.
   - **Counter card:** a **Print counter card** action on the Share tab (`src/components/dashboard/SharePanel.tsx`): a print-styled page with a locally generated QR code of the shop link, the shop name in Playfair, and "Order ahead with any AI assistant, pay on PayPal". Screenshot it at 390 and 1440.
   - **Machine-readable shop page** (`src/app/s/[slug]/page.tsx`): schema.org JSON-LD (`FoodEstablishment` with `hasMenu`/`Offer` and the door URL) and a `<link rel="alternate">` to the door.
   - **Proof:** give the Claude Code CLI only the shop page URL and record whether it finds the door and orders; add the transcript to `docs/judge/evidence/`.
   - **Video:** a 6-second beat in `DEMO.md`: the card goes on the counter, a phone scans it.
2. **Pay the seller, in the smallest verifiable version (A3 4 → 5; B3 and B4 4 → 5). Code plus one human step.**
   - **Human step first:** create a second sandbox Business account in the Developer Dashboard.
   - **Code:** an optional "PayPal email for payouts" field on the setup "Your shop" card, a `payee_email` column, `payeeEmail?` on `CreatePayPalOrderInput` (`src/lib/paypal/types.ts`) and `purchase_units[0].payee.email_address` in `src/lib/paypal/orders.ts`.
   - **Gate:** a capture-gate variant (`e2e/capture.spec.ts`) asserting PayPal's `GET /v2/checkout/orders/{id}` returns that payee and the capture is COMPLETED. If tracking is refused for another merchant's capture, show "Add tracking in your PayPal account" for payee shops and say so in the README.
   - **Show it:** "Paid to <email>" on the order's PayPal card. Change the README Limitations line only after the gate passes.
3. **Deploy, record, publish (A5 4 → 5). Human steps; the submission blocker whatever the score.**
   - Apply `render.yaml` on Render, run `npm run seed` there, add the webhook and verify `PAYMENT.CAPTURE.COMPLETED` on the HTTPS URL; put the hosted URL at the top of the README and replace "Not yet run".
   - Record the video from `DEMO.md` (use `SHELFIE_RECORDED_SAMPLES=1` if Claude is slow, and say so on screen) and make it public on YouTube.
   - **Make the repo public before 12 Nov 2026, 12:00 PT.** It is `PRIVATE` today; Stage One fails without it.

## Verdict: **ship**

Part A is **22/25** and Part B is **21/25**, both unchanged. There are **0 Part C fails**, which meets the ship bar (no Part C fails and Part A ≥ 20).

The build is safer than in round 3: 13 confirmed bugs fixed (one high on the door), 625 unit tests, 56 e2e tests with a real capture, and every async state now on screen. The next gains are the same three, now sized to start: a door found from the counter and the web (fix 1), money to the seller (fix 2), and the human steps that make the submission valid (fix 3), due 12 Nov, 12:00 PT.
