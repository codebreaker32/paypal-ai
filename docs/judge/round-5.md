# Judge round 5: main 7a91a65, after review 2

**What I judged:**
- **Screenshots:** the 68 round-5 screenshots (34 pairs at 390 px and 1440 px), `axe-results.json`, and the README there that labels the fixture and mocked states. I looked at `shop-390` and `dashboard-paypal-unreachable-390` in full, and I also looked at `../capture/` and `../../evidence/`.
- **Test log:** `round-5-tests.txt` (unit, typecheck, lint, the full e2e run with the real-sandbox capture gate, and the production screenshot run).
- **Review records:** the new `docs/reviews/2026-11-06-review-2.md` (14 confirmed findings, 5 refuted), checked against the first review (`2026-11-06-whole-codebase.md`). I spot-checked four review-2 fixes in the code and their tests, and ran one of them live (see below).
- **Docs:** the spec (sections 1, 3, 10, 13, 14 and 15), `README.md`, `docs/DEMO.md` and `docs/SUBMISSION.md`.
- **Repo:** `gh repo view --json visibility,licenseInfo`.

I did not read `PROGRESS.md`, `DECISIONS.md` or worker notes. `git log --oneline` showed commit subjects while I looked for the diff base; I didn't use them as evidence. I scored fixture and mocked states as UI only and took the money evidence from the capture gate.

**What I checked myself (about 15 minutes):**
- **My own production build.** `npm run build` exited 0. I started the server with `DATABASE_PATH=data/judge5.db UPLOADS_DIR=data/judge5-uploads PORT=3121 npm start`. When I was done I stopped it (by PID on :3121 only) and deleted `data/judge5*`. `git status` is clean.
- **Seed.** `npm run seed` published **9 real sandbox Catalog products** (`PROD-6BK99876P6257191L` and 8 more) in **4.5 s**.
- **The agent door, with curl:**
  - `initialize` returned `serverInfo.title` "Marigold Bakehouse on Shelfie" with the ordering instructions.
  - `tools/list` returned `get_shop_info, list_products, create_order, get_order_status`.
  - `create_order` (2 × almond croissant, pickup, `client_request_id: judge5-a`) returned **SHF-FFQ6UX**, $10.00, and a real `https://www.sandbox.paypal.com/checkoutnow?token=87026574376207204` link.
  - Sending `"price": 0.01` was refused with `INVALID_ARGUMENTS` at `items[0].price`: "`price` is not accepted; prices are set by the shop."
  - Reusing `judge5-a` with different items returned `IDEMPOTENCY_CONFLICT`.
  - `get_order_status` synced with PayPal and returned `awaiting_approval`, `declined: false` and `capture_refused: false`. Those are the new review-2 fields (C1 and B2), live.
  - `GET` on the door returned **405**.
- **The buyer console with real Claude** (`POST /api/assistant/marigold-bakehouse`):
  - **Turn 1 (4.6 s):** I asked for "2 cardamom buns and a small drip coffee for pickup… yes, go ahead". Claude called `get_shop_info` and then `list_products`, read the order back at $10.00, and asked again: "You said to go ahead before you saw the prices, so can you confirm this total?"
  - **Turn 2, "Yes" (6.0 s):** `create_order` with item and option IDs only. It returned **SHF-L4S7X8**, $10.00, with a sandbox approval link and an `approval` event for the PayPal button.
- **Live Claude vision.** I created a shop from the `ravi-bike-repair` sample and ran `/extract`. `SHELFIE_RECORDED_SAMPLES` is not set in `.env`, and the `extractions` row says `model claude-sonnet-5-5`, `duration_ms 6435`, `status done`.
  - It read 7 services and skipped the header and hours lines with reasons.
  - It flagged "Chain replace $18 + parts" as CHECK ("Printed as “$18 + parts”. We set $18.00. Is that right?").
  - **One miss:** "Kids bike safety check FREE w/ tune-up, else $10" became a plain $10 with no CHECK. The free-with-tune-up condition is silently dropped.
- **Review-2 S1 (image decompression bomb), live:** I uploaded a 16000×3500 PNG (56 MP, 170 KB) to `POST /api/shops`. It came back **HTTP 413 `PHOTO_TOO_LARGE`** in **0.15 s**: "That photo is too big for us to read…" Fixed as recorded.
- **Review-2 fixes spot-checked in code and tests:**
  - **X1 (Render rate-limit key):** `src/lib/http/client-ip.ts:10` uses `CF-Connecting-IP` only when `RENDER` is set; `tests/http/client-ip.test.ts:28–43` covers on-Render, the blank header and off-Render spoofing. Fixed in code; the record says (`review-2.md:55`) it is not verified on a real deploy, because there is none.
  - **S1:** `src/lib/uploads.ts:48` sets a 50 MP cap and `:67` checks the header before decoding. `:68` passes `limitInputPixels`, and `:51–58` serialise decodes through a module-level promise chain (`setup.ts:49` still calls `Promise.all`, but the chain makes those decodes run one at a time). Tested by `tests/catalog/uploads.test.ts:70` and `uploads-serial.test.ts:40`.
  - **C1 (declined card shown the same everywhere):** `src/lib/mcp/tools.ts:325–339` and `:393` and `src/lib/seller/view.ts:121–132` use the receipt's rule. Tested in `tests/mcp/tools.test.ts` and `tests/seller/view.test.ts`.
  - **D1 (the "Can't reach PayPal" banner):** `src/lib/seller/health.ts:14–16` with `src/lib/orders/service.ts:270–304`. `tests/seller/health.test.ts:13` checks that the banner shows while poller reads fail and clears once PayPal answers again. On screen: `dashboard-paypal-unreachable-390` ("We can't reach PayPal right now… Nothing is lost.").
  - **C6 (shipping copy):** `shop-390` and my curl of the live shop page both say "to the address you give PayPal".
- **axe.** I parsed `axe-results.json` myself: **68 entries, 0 violations**.
- **Repo.** `{"licenseInfo":{"key":"mit"…},"visibility":"PRIVATE"}`.
- **Round 4's top fixes, checked with grep and curl:**
  - `grep -rn payee src` gave **0** hits.
  - A grep for `ld+json|rel="alternate"|qrcode|QRCode|counter card` over `src` gave **0** files.
  - My curl of the live shop page found **0** `ld+json` or `rel="alternate"` tags.
  - `src/app/s/[slug]/` still holds only `page.tsx`, `mcp`, `photo` and `not-found.tsx`.
  - `README.md:116` still says "**Not yet run.**", and `README.md:196` still says "One sandbox merchant receives all payments".
  - `docs/SUBMISSION.md:78–80` still has **TODO** for the video, the repo URL and the hosted demo.

**From the test log (not re-run by me):**
- `npm test`: 53 files, **651 passed**. Typecheck and lint exit 0.
- Full e2e: **56 passed, 1 skipped** (the hidden "Other carrier" test).
- Capture gate: SHF-GG6GDJ, PayPal order `3EH35781PT3793628`, capture `3HK74446UV304740E` **COMPLETED** for $27.00. The USPS tracker is SHIPPED, `get_order_status` reads the tracking back, and the brief flags the nut allergy.
- Screenshots: 68 passed on a production build, axe 0.

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** | **PayPal, seen live today:** Catalog Products (9 created by my seed), Orders v2 with catalog SKUs (SHF-FFQ6UX and SHF-L4S7X8, real approval links) and `get_order_status` syncing with PayPal. **PayPal, from the capture gate:** approve and capture (`3HK74446UV304740E` COMPLETED), the Agent Toolkit brief, and `create_shipment_tracking` read back through MCP. **AI, live today:** Claude vision on a real photo (6.4 s, with a CHECK flag on an ambiguous price) and the tool-running buyer agent (read-back, then `create_order` with IDs only). Review 2 added 14 more confirmed fixes on top of round 4's 13. Live, the door and the console now report the declined and refused states (C1, B2) consistently, and the decompression-bomb guard holds (S1). *Not verified:* the webhook (deploy only) and wallet-login payment. |
| A2 Design | **5** | Every async state in the rubric is still on screen (68 screens). New on screen this round: the "Can't reach PayPal" banner now appears during a real outage pattern, not only in a fixture of stale stamps (`dashboard-paypal-unreachable-390`, and D1 covered by `health.test.ts:13`). Shipping copy fits guest checkout ("the address you give PayPal", `shop-390`). Behind the scenes: a retake whose reading fails now lands on the try-again step (S5), the approval card survives a reload (B1), and the "Confirming with PayPal" card resolves itself (C3). |
| A3 Potential impact | **4** | Audience and pain are unchanged and sourced (`EVIDENCE.md`). **What holds it at 4, for the fourth round:** the money still goes to the platform's merchant. `grep payee src` finds 0 hits, and `README.md:196` is unchanged. *Fix:* top fix 3. |
| A4 Innovation | **4** | The door is no more findable than in round 4. There's no counter card or QR, no JSON-LD or `<link rel="alternate">` on the shop page (0 hits in my curl of the live page), and no agents route. An assistant still reaches a shop only if a person pastes the link. *Fix:* top fix 2. |
| A5 Presentation readiness | **4** | **Demoable and fast**, measured today: seed 4.5 s, live reading 6.4 s, console turns 4.6 s and 6.0 s, price tamper refused instantly. `DEMO.md` is timed to 2:50. **Not ready:** no video; the deploy is "Not yet run" (`README.md:116`); the repo is `PRIVATE`; `SUBMISSION.md:78–80` has three TODOs. *Fix:* top fix 1. |
| **Total** | **22/25** (unchanged) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **4** | Unchanged: "Prepaid orders from a photo of your price list". The spec's own buyer journey starts with "Finds the agent door link (shop page, **QR at the stall**, Instagram bio)" (spec line 36), but nothing on paper exists to point a regular at the door. *Fix:* top fix 2. |
| B2 Implementation | **5** | 651 of 651 unit tests, 56 e2e tests with the real capture gate, typecheck and lint clean. My own production build ran the whole buyer path live against the sandbox and Claude. Two recorded reviews (27 confirmed fixes, each with a skeptic pass). The four I spot-checked (X1, S1, C1, D1) are in the code with tests, and S1 also held live. |
| B3 Depth | **4** | More real-world mess handled this round: decompression bombs (S1, live 413 in 0.15 s), prices the door could never sell (S2), menus with more than 10 sizes (S4), edits made during publish (S3), PayPal outages surfacing (D1), declined cards stated the same everywhere (C1), and poller recovery when keys arrive late (L2). **Two things hold it at 4.** The scale path still rests on per-seller payouts, which are unbuilt. And conditional prices slip through: today's live reading turned "FREE w/ tune-up, else $10" into a plain $10 with no CHECK. *Fix:* top fix 3, plus a normalize rule or prompt line that flags conditional prices ("free with", "else", "w/") as CHECK, with one sample-based test. |
| B4 Usefulness | **4** | A seller still can't use it this week. The money goes to Shelfie's merchant, there's no hosted instance, and nothing goes on the counter. *Fix:* top fixes 1, 2 and 3. |
| B5 Innovation | **4** | Same as A4: the door isn't discoverable by an agent that wasn't handed the link. *Fix:* top fix 2. |
| **Total** | **21/25** (unchanged) | |

## Part C

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One marigold fill per screen: **Order with an assistant** on `shop-390`. On `dashboard-paypal-unreachable-390` the per-order actions are outlined (Add tracking, Mark picked up). |
| Loading, success, empty and error states | **Pass** | The full round-4 set is re-shot on a production build (`setup-reading`, `setup-publishing`, `setup-publish-retry`, `console-thinking`, `console-error`, `console-rate-limited`, `dashboard-loading`, `dashboard-empty`, `order-tracking-error`, `receipt-*`). Mocked and fixture states are labelled in the README. |
| WCAG AA contrast, keyboard, visible focus, alt text | **Pass** | `axe-results.json`: 68 screens, **0 violations** (I parsed it). |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass** | The screenshot spec asserts no overflow on all 68 screens and passed (`round-5-tests.txt`). `shop-390` has full-width Copy buttons and a tall primary button. |
| Copy is plain and specific, no jargon, no placeholders | **Pass** | Examples: "We can't reach PayPal right now… Nothing is lost.", "the address you give PayPal", "No name given · via Claude", and the 413 message "That photo is too big for us to read. Take it again at your camera's normal size". `SUBMISSION.md` TODOs are not product UI. |
| No generic AI look | **Pass** | Same newsprint, blackboard-ink and marigold system; no gradients, glass or emoji. |
| No empty hero, no three identical feature cards | **Pass** | `shop-390` opens on the shop name, the original photo and the fulfilment options, not a slogan hero. |
| No lorem or fake stats | **Pass** | Realistic content; fixtures labelled. |
| Deliberate type pairing, palette and spacing | **Pass** | Playfair Display headings, Schibsted Grotesk body, IBM Plex Mono prices and order numbers (`shop-390`, `dashboard-paypal-unreachable-390`). |
| Tokens defined once and used everywhere | **Pass** | Unchanged from round 4 (tokens in `globals.css`). |
| Type scale and line length | **Pass** | Unchanged. |
| Consistent components, subtle motion | **Pass** | The banner, order cards and badges match the round-4 shapes. |

**Part C: 0 fails** (round 4 also had 0).

## Round 4's top 3 fixes

1. **Make the door findable (counter card, JSON-LD, `<link rel="alternate">`, outside-client proof): not done.**
   - Evidence: 0 hits for `ld+json|rel="alternate"|qrcode|QRCode|counter card` in `src`, and 0 in my curl of the live shop page.
   - Score: A4, B1 and B5 held at 4.
   - **New finding:** the spec itself lists "QR codes, discovery cards (agent.json, llms.txt, JSON-LD)" as out of scope (spec §14, line 236), while its buyer journey (line 36) relies on a "QR at the stall". If the workers are following §14, this fix can't land without a spec change. See top fix 2.
2. **Pay the seller (payee email): not done.**
   - Evidence: `payee` has 0 hits in `src`, and `README.md:196` is unchanged.
   - Score: A3, B3 and B4 held at 4.
   - Spec §14 also scopes out "per-seller PayPal onboarding". The `payee` field is a much smaller step than Partner Referrals, and the spec should say so.
3. **Deploy, record, publish: not done.**
   - Evidence: `README.md:116` still says "Not yet run", the repo is `PRIVATE`, there's no video, and `SUBMISSION.md:78–80` still has the TODOs.
   - Done in the meantime: X1 prepares the Render rate-limit key, L1 makes `APP_URL` follow the bound port, and the seed gained `--cancel-unpaid` to clear rehearsal orders.
   - Score: A5 held at 4.

**No score has moved for three rounds** (Part A 22 and Part B 21 in rounds 2 to 5). Nothing went down, so there's no regression to fix. Review 2 was real work: 14 confirmed bugs fixed with tests, and one (S1) I confirmed live. But it is hardening, and hardening doesn't move a Part A score that is already 5 (A1, A2) or held back by something else (A3, A4, A5).

The loop rule asks for a different approach when a fix doesn't move the score. Round 4's change was to cut each fix to its smallest piece, and it didn't get the fixes started. This round's change has two parts:
- Fix 1 is the one with a hard deadline, so it now comes first.
- Fixes 2 and 3 start with a one-line spec amendment, so that §14 no longer excludes them.

## Top 3 fixes (ranked by Part A gain)

All three are worth +1 on Part A. Fix 1 comes first because without it no Part A score counts: Stage One is pass/fail and a private repo fails it. Today is 6 Nov; the deadline is **12 Nov 2026, 12:00 PT**.

1. **Publish, deploy and record (A5 4 → 5; it also unblocks Stage One). Mostly human steps.**
   - **Make the repo public now** (`gh repo edit --visibility public` after a last secret scan), and confirm the About box shows MIT.
   - **Deploy:** apply `render.yaml` on Render, run `npm run seed` there, and register the webhook at `https://<service>.onrender.com/api/paypal/webhook`. Verify one `PAYMENT.CAPTURE.COMPLETED` delivery, and confirm X1 by sending 21 console turns from two networks.
   - **Update the docs:** replace `README.md:116` "Not yet run" with the URL and the date it was verified, and fill in `SUBMISSION.md:78–80`.
   - **Record** `DEMO.md` against the production build (the turn times I measured fit its 2:50). Put it on YouTube, public, under 3:00.
2. **Make the door findable, after amending the spec (A4 4 → 5; B1 and B5 4 → 5). Code, no human step.**
   - **Spec first:** move "QR codes" and "discovery cards (JSON-LD)" out of §14 and into §4 and §10, so the work matches the journey at line 36.
   - **Counter card:** a **Print counter card** action in `src/components/dashboard/SharePanel.tsx`. It opens a print-styled page with a locally generated QR code of the shop link, the shop name in Playfair, and "Order ahead with any AI assistant, pay on PayPal". Screenshot it at 390 px and 1440 px.
   - **Machine-readable shop page** (`src/app/s/[slug]/page.tsx`): schema.org `FoodEstablishment` (or `LocalBusiness` for service menus) JSON-LD with `hasMenu`/`Offer` and the door URL, plus `<link rel="alternate" type="application/json" href=".../mcp">`.
   - **Proof:** give the Claude Code CLI only the shop page URL (not the door), and save the transcript in `docs/judge/evidence/`. It should show whether the assistant finds the door from the page and orders.
3. **Pay the seller, smallest verifiable version, after amending the spec (A3 4 → 5; B3 and B4 4 → 5). Code plus one human step.**
   - **Spec:** a line in §8 saying the per-shop `payee.email_address` is in scope and Partner Referrals stays the scale path.
   - **Human step:** create a second sandbox Business account in the Developer Dashboard.
   - **Code:**
     - an optional "PayPal email for payouts" field on the setup "Your shop" card;
     - a `payee_email` column;
     - `payeeEmail?` on `CreatePayPalOrderInput` (`src/lib/paypal/types.ts`);
     - `purchase_units[0].payee.email_address` in `src/lib/paypal/orders.ts`.
   - **Gate:** a capture-gate variant asserting that `GET /v2/checkout/orders/{id}` returns that payee and the capture is COMPLETED. If tracking is refused for the other merchant's capture, show "Add tracking in your PayPal account" for payee shops.
   - **Show it** as "Paid to <email>" on the order's PayPal card. Change `README.md:196` only after the gate passes.

## Verdict: **ship**

Part A is **22/25** and Part B is **21/25**, both unchanged. There are **0 Part C fails**, so the rubric's ship bar (no Part C fails and Part A ≥ 20) is met.

The product is safer than in round 4: 27 confirmed bugs fixed over two reviews, 651 unit tests and 56 e2e tests with a real capture. Today I saw the whole buyer path work on a production build: real Catalog products, a real Claude reading of a photo, a real Claude agent ordering through the door with a read-back, and real PayPal approval links.

"Ship" here is a rubric verdict, not a submission: the entry would fail Stage One today, because the repo is private and there is no video. Top fix 1 is due before 12 Nov 2026, 12:00 PT.
