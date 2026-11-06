# Judge round 6: main 9851adb (code), after review 3

## What I judged

**Artifacts:**
- The spec as amended on 6 Nov: line 5, §8a (lines 167–178), §10a (lines 223–227) and §14 (line 256).
- Round 5's verdict, used only to account for its top 3 fixes and to compare scores.
- Screenshots:
  - `screenshots/round-6/`: 82 screens (41 pairs) plus `axe-results.json` and the README that labels fixture and mocked states. I viewed `counter-card-1440`, `review-paypal-email-390`, `order-payment-held-390` and `dashboard-share-390` in full.
  - `screenshots/capture/`: `seller-paypal-wallet-review-1440` and `seller-receipt-paid-1440`.
  - `evidence/discovery-claude-code.md`, with its raw `.jsonl`.
- `round-6-tests.txt`.
- `docs/reviews/2026-11-06-review-3.md`.
- `README.md`, `docs/DEMO.md`, `docs/DEPLOY.md` and `docs/SUBMISSION.md` (the lines cited below).
- The code paths cited below.

I did not read `PROGRESS.md`, `DECISIONS.md`, commit messages or worker notes. `git log` showed subjects while I checked that no code changed after 9851adb (`git diff --stat 9851adb HEAD -- src tests e2e scripts package.json` is empty); I didn't use them as evidence. Fixture and mocked states are scored as UI only. The money evidence comes from the capture gate and from my own live calls.

## What I checked myself (about 22 minutes)

**My own production build.** `npm run build` exited 0 in 32 s. The route list includes `/agents.txt`, `/llms.txt` and `/shops/[id]/card`.
- I started the server with `DATABASE_PATH=data/judge6.db UPLOADS_DIR=data/judge6-uploads PORT=3121 npm start`.
- Afterwards I stopped it by its PID on :3121 (cwd `/home/aman/paypal-ai`) and deleted `data/judge6*`.

**Seed (5.97 s).** 9 real Catalog products (`PROD-95174775U2567592U` and 8 more).
- It printed "Paid to: the sandbox seller's own PayPal account (s•••@business.example.com, PAYPAL_SANDBOX_SELLER_EMAIL)".

**Paying each seller (§8a), live:**
- **Door order to the seller.** `initialize` returned "Marigold Bakehouse on Shelfie". `create_order` (2 × almond croissant, pickup) returned **SHF-SGWZVE**, $10.00, and approval token `2JT49705MS371293E`.
- **PayPal's own record, checked by me.** `GET /v2/checkout/orders/2JT49705MS371293E` with the app's keys, compared in a script so no email or key was printed, gave:
  - status `PAYER_ACTION_REQUIRED`, $10.00, `invoice_id` SHF-SGWZVE;
  - `sku` `PROD-0U4271436T085254H`;
  - **"payee present: True | payee == PAYPAL_SANDBOX_SELLER_EMAIL: True"**.
- **A new shop of my own.**
  - I created a shop from the `ravi-bike-repair` sample.
  - Publishing without an email returned **409 `PAYEE_REQUIRED`** "Add your PayPal email to publish."
  - `rosa@-.-` and `a,b@example.com` each returned **400 `INVALID_PAYEE_EMAIL`**.
  - `"  Ravi.Judge6@Example.com "` was saved trimmed and lower-cased.
  - Publishing then put 5 products in the catalog in 2.0 s (`PROD-1LA32751KE173900J` and 4 more). The 2 CHECK items stayed off.
  - Clearing the email on the live shop (`null`) returned **409** "Your shop needs a PayPal email to take orders…". The same request without the owner cookie returned 404.
  - A console order on that shop, `SHF-UM5D4B` (token `75B60108B2795972W`), has **`payee.email_address` `ravi.judge6@example.com`** on PayPal's record, and its service lines carry no `category`, as §8 says.
- **Capture gate, from the log.** Seller: SHF-ASZZQ3, capture `3P893955RL283505N` COMPLETED, "payee = PAYPAL_SANDBOX_SELLER_EMAIL". Demo shop: SHF-5JAJ48, capture `5P192305RS2006105` COMPLETED, platform payee.
  - The payee assertion is real: `e2e/capture.spec.ts:339` compares PayPal's `purchase_units[0].payee.email_address` with the seller.
  - On screen: `capture/seller-paypal-wallet-review-1440` is PayPal's wallet page, $27.00, Complete Purchase. `capture/seller-receipt-paid-1440` is stamped **PAID** and says "Paid to Marigold Bakehouse's own PayPal account (s•••@business.example.com)".

**The findable door (§10a), live:**
- **Shop page.** `curl /s/marigold-bakehouse` has `<link rel="alternate" type="application/json" title="Agent door (MCP)" href="http://localhost:3121/s/marigold-bakehouse/mcp"/>`.
  - The JSON-LD is `FoodEstablishment`, `paymentAccepted: PayPal`, with a `Menu`, `MenuSection`s and `Offer`s at the shop's prices.
  - Its `potentialAction` is an `OrderAction` whose `EntryPoint.urlTemplate` is the door, and it describes the 4 tools.
- **My services shop** is typed `LocalBusiness`, with `OfferCatalog`s and `Service`s.
- **`/agents.txt`** (200, `text/plain`) and **`/llms.txt`** explain the door, the call order and "No tool accepts a price". After my publish they listed both live shops with their door URLs.
- **Counter card.** `/shops/<draft id>/card` before publishing said "Your counter card is ready once your shop is live." (review 3 fix 1, live). After publishing it has the QR (`aria-label` "QR code that opens localhost:3121/s/ravis-bike-repair"), "Order ahead with any AI assistant, pay with PayPal" and the door URL. Without the cookie: 404.
- **`GET` on the door** returned 405. **Price tamper** (`"price": 0.01`) returned `INVALID_ARGUMENTS` at `items[0].price`: "`price` is not accepted; prices are set by the shop."
- **Outside-client evidence.** I parsed `discovery-claude-code.jsonl`. Its tool calls are, in order:
  1. a curl of the shop page only;
  2. the text "There's an MCP agent door";
  3. `tools/list`;
  4. `get_shop_info` and `list_products`;
  5. `create_order` with ids only.

  The result is SHF-LFMY4J and a sandbox approval link. This matches the `.md`. The prompt gave no door URL, and `--strict-mcp-config` gave no MCP servers.

**AI, live:**
- **Claude vision.** The bike-repair photo was read in **6.6 s**: the `extractions` row says `claude-sonnet-5-5`, 6617 ms, `done`.
  - **Round 5's miss is fixed.** "Kids bike safety check FREE w/ tune-up, else $10" is now **CHECK**: "We set $0.00 for “w/ tune-up”, which looks unusual. Is that right?" It is held off the shop.
  - "Chain replace $18 + parts" is still CHECK.
- **Buyer console** (`POST /api/assistant/ravis-bike-repair`, 6.5 s). Claude called `get_shop_info` → `list_products` → `create_order` (ids only) and returned an `approval` event for $27.00, with the payee being the shop's email (above).
  - **Finding:** my first message ended "Yes, place it." Claude skipped the read-back and streamed its own reasoning to the buyer as a chat bubble: *"The user already said yes to placing it, with a clear total derivable ($27). I'll proceed."*
  - Round 5's run of a similar message read back and asked again. The rule is in the prompt (`src/lib/agent/buyer-console.ts:88`), but nothing enforces it.
  - The buyer still approves on PayPal, so no money moves without consent. But the read-back is the 1:06 shot of `DEMO.md`, and that line is not product copy.

**Review 3 fixes, spot-checked in code and tests:**
- **Pass 1 #1 (no card for a draft):** `src/app/shops/[id]/card/page.tsx:30` (`shop.status === 'draft' ? null : qrSvg(...)`). Tested in `tests/discovery/card-page.test.ts:49` and `e2e/discovery.spec.ts:130`, and live (above).
- **Pass 1 #2 and pass 2 #3–4 (payee email rules):** `src/lib/domain/payee.ts` (`LOCAL_PART`, 64/63 limits, `TOP_LABEL` with `xn--`). Tested in `tests/domain/payee.test.ts:19–28` (limits and punycode accepted) and `:49–78` (`a,b@x.y`, `"<x>"@a.b`, `rosa@-.-`, 65-character name part, 64-character label, `xn--` edge cases refused), and live (two 400s above).
- **Pass 1 #3 (alternate link follows `takesOrders`):** `src/app/s/[slug]/page.tsx:128,135`. Tested in `e2e/discovery.spec.ts:76`.
- **Pass 1 #7 (one `canBePaid` rule):** `src/lib/domain/payee.ts` (last line). The SQL copy is checked against it in `tests/discovery/index-file.test.ts:63`.
- **§8a mismatch rule:** `src/lib/orders/service.ts:536–538` compares PayPal's payee, lower-cased, before capture. Tested in `tests/orders/service.test.ts:662,686,709` (sent and kept; case-insensitive; missing payee fails without capture).

**axe.** I parsed `axe-results.json` myself: **82 entries, 0 violations**.

**Repo.** `gh repo view --json visibility,licenseInfo` could not run: `gh` on this VM asks for `gh auth login`. `curl https://api.github.com/repos/codebreaker32/paypal-ai` without a token returns **404**, so the repo is still **not public**. `LICENSE` is MIT (round 5 saw GitHub detect it).

**Deploy, video, submission:**
- `README.md:133` still says "**Not yet run.**"
- `docs/SUBMISSION.md:82–84` still has three **TODO**s (video, repo, hosted demo).
- A clip recorder is running on this VM (`ffmpeg` writing `video/clips/08-dashboard-brief.mp4` in a worktree), so the video is in progress. There is no video to score.

**The e2e failures, re-run by me** (with the clip recorder still using about 1.3 CPUs, load average 5.3–5.9 on 4 CPUs):
- `E2E_PORT=3122 npx playwright test e2e/shop.spec.ts e2e/discovery.spec.ts` gave **33 passed, 1 failed (3.3 m)**.
- The failure is `shop.spec.ts:222` "1440 px replays a real order conversation": `page.waitForLoadState: Test timeout of 60000ms exceeded` in `settle()` (`e2e/helpers.ts:24`). It is the same test and the same `networkidle` wait the log names.
- Run alone right after, under the same load, it **passed in 15.8 s**.
- **My reading:** a load-sensitive wait in the test helper, not a product bug. Every assertion that ran passed, and the screen is in the 82-shot production set. It is still a flaky test, and there is no clean full run on record (fix 2).

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** (held) | **PayPal, seen live today:** Catalog Products (9 + 5 created by me), and Orders v2 with SKUs **and a per-seller `payee`** on PayPal's own record (SHF-SGWZVE, SHF-UM5D4B). There is also the publish gate, and the payee check before capture (`service.ts:536–538`). **From the capture gate:** a wallet-login payment captured COMPLETED into the seller's account (`3P893955RL283505N`, checked at `capture.spec.ts:339`), and guest card into the platform's (`5P192305RS2006105`, with the USPS tracker at PayPal), plus the Agent Toolkit brief on both. **AI, live today:** Claude vision (6.6 s, now flags the conditional price) and the tool-running console (ids-only `create_order`). PayPal is now central in a second way: the money goes to the seller. Already at 5. |
| A2 Design | **5** (held) | **Every new state is on screen:** Your PayPal email with its error and the disabled Publish reason (`review-paypal-email-390`), Settings valid, invalid and demo, the draft card, the printable card (`counter-card-1440`), a held payment ("PayPal is holding this payment… No PayPal account uses rosa@exmaple.com yet…", `order-payment-held-390`) and paid-to-seller receipts. **Share tab:** it keeps one primary action and adds a Counter card block (`dashboard-share-390`). Review 3 closed 13 coherence gaps (for example "Not taking orders online yet." whenever the door would refuse). **One live rough edge:** the console's leaked reasoning bubble. It holds A2 at 5 only because it is model output on one path, not a missing state; see fix 3. |
| A3 Potential impact | **5** (4 → 5) | **What held it at 4 for four rounds is gone.** The money now goes to the seller, not the platform: I saw it on PayPal's own records (SHF-SGWZVE, SHF-UM5D4B) and in the capture gate (COMPLETED to the seller). **The real-world failure modes are handled in the product:** a mistyped email (UNILATERAL hold, explained with a Settings link, `order-payment-held-390`), and PayPal refusing platform tracking (saved in Shelfie, with "add it in your PayPal account too"). The audience and the sourced pain are unchanged (`EVIDENCE.md`). |
| A4 Innovation | **5** (4 → 5) | **The door is now findable, not just reachable.** Live on my build: `<link rel="alternate">`, a schema.org `OrderAction` → `EntryPoint` at the door, `/agents.txt` and `/llms.txt`, and a counter card with a QR code. The outside-client run shows Claude Code with no MCP config and only the shop URL finding the door from the page head and ordering (SHF-LFMY4J; transcript checked). A paper menu → a PayPal-paid MCP door that a stranger's assistant discovers from a QR code is a concept I haven't seen elsewhere, and it works. |
| A5 Presentation readiness | **4** (held) | **Demoable and fast**, measured today: seed 6.0 s, reading 6.6 s, publish 2.0 s, a console turn 6.5 s, price tamper refused instantly. `DEMO.md` (lines 24–33) now has the "Found, not handed" shot and the paid-to-Rosa receipt, timed to 2:50. **Why it doesn't move:** there is still no video, no deploy (`README.md:133`) and no public repo (GitHub API 404), and `SUBMISSION.md:82–84` still has its TODOs. **New risk:** the 1:06 read-back shot depends on the model honouring a prompt rule it skipped in my run (fix 3). *What moves it:* fix 1. |
| **Total** | **24/25** (round 5: 22) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **5** (4 → 5) | "Snap your price list; any AI assistant can order from you, and you're paid on PayPal." Round 5 held it at 4 because nothing on paper pointed a regular at the door (spec line 38, "QR at the stall"). That now exists: `counter-card-1440`, and live on my shop. |
| B2 Implementation | **5** (held) | **Tests:** 868 unit tests (log); typecheck and lint 0. **Real sandbox:** both capture gates passed, and my own build ran payee orders against PayPal live. **Reviews:** 3 recorded reviews; the 5 review-3 fixes I spot-checked are in the code with tests, and 2 also held live. **e2e:** the full e2e on a loaded VM had 9 failures, all `networkidle` timeouts in `e2e/helpers.ts:24`. My re-run of the shop and discovery specs gave 33 of 34, and the one failure passed alone in 15.8 s. The clean idle run is still missing (fix 2). |
| B3 Depth | **5** (4 → 5) | **Both of round 5's holds are fixed.** Per-seller payouts are built and verified: the email rules are RFC-limited with punycode, each order keeps a snapshot of its payee, a different payee is a mismatch that is never captured, and UNILATERAL holds and tracking refusals are handled. The conditional price "FREE w/ tune-up, else $10" is now CHECK, live. The path to scale (Partner Referrals, merchant id as payee, platform fee) is stated in `README.md:226–229` and spec §8a. |
| B4 Usefulness | **4** (held) | A seller now gets paid into their own PayPal account and has a card for the counter. **What holds it:** there is no hosted instance, so a real seller can't use it this week; it runs on `localhost` (`README.md:133`). *Fix:* fix 1 (deploy). |
| B5 Innovation | **5** (4 → 5) | Same as A4: discovery by JSON-LD `OrderAction`, `rel="alternate"` and `/llms.txt`, proven with an outside assistant that wasn't given the door. |
| **Total** | **24/25** (round 5: 21) | |

## Part C

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One marigold fill per screen. **Copy agent door link** on `dashboard-share-390`, where Print counter card is outlined. **Print card** on `counter-card-1440`. Publish on `review-paypal-email-390` (disabled, with its reason). |
| Loading, success, empty and error states | **Pass** | Round 5's full set is re-shot, plus the new flows: `dashboard-settings-invalid`, `review-paypal-email` (error), `order-payment-held`, `receipt-paid-to-seller` and the draft card (live and in `e2e/discovery.spec.ts:130`). Mocked and fixture states are labelled in the README. |
| WCAG AA contrast, keyboard, visible focus, alt text | **Pass** | `axe-results.json`: 82 screens, **0 violations** (parsed by me). The QR has `role="img"` and an `aria-label` naming the URL it opens. |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass** | The screenshot spec's overflow assertion passed on all 82 screens (`round-6-tests.txt`, screenshots:prod, 82 passed). `review-paypal-email-390` and `dashboard-share-390` have full-width tall controls. |
| Copy is plain and specific, no jargon, no placeholders | **Pass** | "Add your PayPal email to publish.", "Buyers pay straight into this PayPal account.", "PayPal is holding this payment… Don't hand over or ship until it shows Paid.", "Your counter card is ready once your shop is live." The console's leaked "derivable" line is live model output on one path, not product copy (fix 3). |
| No generic AI look | **Pass** | Same newsprint, ink and marigold system. The counter card is a printed-menu frame with a tape strip, with no gradient, glass or emoji. |
| No empty hero, no three identical feature cards | **Pass** | The Share tab's three blocks have different content and actions (door / shop link / counter card), not a feature-card row. |
| No lorem or fake stats | **Pass** | Realistic content; fixtures labelled (`rosa@example.com`, `E2E` ids). |
| Deliberate type pairing, palette and spacing | **Pass** | Playfair Display for the card's shop name and headings, Schibsted Grotesk body, IBM Plex Mono for URLs, prices and order numbers (`counter-card-1440`, `order-payment-held-390`). |
| Tokens defined once and used everywhere | **Pass** | The new screens use the same token classes (`max-w-card`, `min-h-tap`, `bg-warn-soft`, `type-meta`; `card/page.tsx`). |
| Type scale and line length | **Pass** | `type-display`, `type-lead`, `type-meta` and `max-w-measure` on the card page. |
| Consistent components, subtle motion | **Pass** | The Settings field, the held-payment card and the paid-to line reuse the existing card, badge and timeline shapes. |

**Part C: 0 fails** (round 5: 0).

## Round 5's top 3 fixes

1. **Publish, deploy and record: not done.**
   - The repo is not public (GitHub API 404 without a token; `gh` is not logged in here).
   - `README.md:133` "Not yet run."
   - `SUBMISSION.md:82–84` TODOs.
   - No video; a clip recorder is running, so it is in progress.
   - **A5 held at 4, B4 held at 4.** This is the fifth round without it.
2. **Make the door findable, after amending the spec: done.**
   - Spec line 5 and §10a, and §14 no longer excludes it.
   - Live: JSON-LD with `OrderAction`, `rel="alternate"`, `/agents.txt`, `/llms.txt` and the counter card with QR.
   - The outside-client transcript is checked.
   - **A4 4 → 5, B1 4 → 5, B5 4 → 5.**
3. **Pay the seller (payee email), after amending the spec: done.**
   - Spec §8a and §14.
   - Live: payee on PayPal's record for two of my orders, the publish gate, validation, and the clear guard.
   - Gate: COMPLETED into the seller's account by wallet login.
   - Round 5's conditional-price note is also fixed live.
   - **A3 4 → 5, B3 4 → 5.** B4 held: no hosted instance.

Round 5's change of approach worked for fixes 2 and 3. Amending the spec first unblocked work that had sat untouched for three rounds. Part A rose 22 → 24 and Part B 21 → 24. Nothing went down.

## Top 3 fixes (ranked by Part A gain)

1. **Publish, deploy and record (A5 4 → 5, B4 4 → 5; without it the entry fails Stage One).** This is the only Part A point left. Due 12 Nov 2026, 12:00 PT.
   - **Repo:** make it public after a last secret scan, run `gh auth login` on this VM, and confirm that `gh repo view --json visibility,licenseInfo` shows `PUBLIC` and `mit`.
   - **Deploy:** apply `render.yaml` and set `PAYPAL_SANDBOX_SELLER_EMAIL` so the hosted demo shop is seller-paid. Run `npm run seed` there and register the webhook. Then:
     - curl the hosted `/s/marigold-bakehouse` for the `rel="alternate"` link and `/llms.txt` for the HTTPS door;
     - add that door as a Claude.ai custom connector and place one order, which proves §10's hosted path.
   - **Docs:** replace `README.md:133` "Not yet run." with the URL and the date it was verified, and fill in `SUBMISSION.md:82–84`.
   - **Video:** finish the clips into the `DEMO.md` cut (≤ 2:50) and post it on YouTube, public. Re-run the "Found, not handed" shot against the hosted URL if it is up.
2. **Get a clean full e2e run (protects A1 and B2 at 5; no new Part A points).** The only full run this round had 9 `networkidle` timeouts under the recorder's load (`round-6-tests.txt`).
   - Once the clip recording ends, run `npm run e2e` on an idle VM and append the summary to the test log.
   - Make `settle()` robust to a CPU-starved browser. `e2e/helpers.ts:24` waits on `waitForLoadState('networkidle')` with the 60 s default. Wait on the screen's own ready locator plus the existing `document.fonts.ready` and finite-animation waits, or cap `networkidle` at 10 s and continue. Then a loaded VM can't fail a test whose requests all finished in 0.3 s (the log's own trace).
3. **Enforce the read-back in the buyer console and stop streaming the model's reasoning (protects A2 and A5; the `DEMO.md` 1:06 shot depends on it).** In my live run, "…Yes, place it." produced `create_order` with no read-back. The buyer also saw *"The user already said yes to placing it, with a clear total derivable ($27). I'll proceed."*
   - **Enforce it in code** in `src/lib/agent/buyer-console.ts`. The console's `create_order` proxy refuses with a tool error ("Read the order back with its total and wait for a yes first") unless the session holds an assistant text, sent after the latest `list_products` result, that names the total the order would have. Claude then reads back and asks, every time.
   - **Hide the reasoning.** Don't stream text blocks that come before a tool call in the same assistant message as chat bubbles: show them in the Activity panel, or drop them.
   - **Test:** add one unit test with a scripted runner (a pre-authorised "yes" → refused → read-back) and one live check in `tests/ai-live`.

## Verdict: **ship**

Part A is **24/25** (up from 22) and Part B is **24/25** (up from 21), with **0 Part C fails**. The rubric's ship bar (no Part C fails and Part A ≥ 20) is met.

This round fixed the two things that held the score for four rounds:
- **Each shop is paid into its own PayPal account.** I saw the payee on PayPal's own record for orders I placed, and the capture gate shows it COMPLETED.
- **An assistant can find a shop's door from the page alone.** I saw JSON-LD, `rel="alternate"`, `/llms.txt` and the QR counter card live, and checked the outside-client transcript.

"Ship" here is a rubric verdict, not a submission. The entry would still fail Stage One today: the repo is not public and there is no video. Fix 1 is due before 12 Nov 2026, 12:00 PT.
