# Judge round 2: fixes from round 1 and the new visual direction

**What I judged:**
- All 66 round-2 screenshots (33 pairs at 390 px and 1440 px), `axe-results.json` and the screenshot README, which labels the fixture and mocked states.
- The real-sandbox shots in `capture/` and `task7/real-*`, and the outside-client evidence in `docs/judge/evidence/`.
- `round-2-tests.txt`, the README, `EVIDENCE.md`, `DEMO.md` and `directions.md`.
- The code diff since round 1, read only where I needed to check a claim (`prompts.ts`, `normalize.ts`, the Marigold sample, `layout.tsx`).

I scored the fixture and mocked states as UI only. I took the money evidence from the real-sandbox shots and from my own run.

**What I ran myself** (port 3120 with `DATABASE_PATH=data/judge2.db`; stopped afterwards):
- `npm run seed` published 9 real sandbox products (`PROD-87D49904DH391532V` and others).
- `curl` against the agent door:
  - `tools/list` returned the 4 tools.
  - `create_order` with `"price": 0.01` returned `INVALID_ARGUMENTS`: "`price` is not accepted; prices are set by the shop."
  - A real `create_order` (2 × butter croissant, pickup) returned SHF-MVVTCT, $8.50 and a live `https://www.sandbox.paypal.com/checkoutnow?token=29N92714C57469945`.
- Playwright at 390 px: **Try a sample menu → Tía Lupe's** with live Claude. The review page loaded in 14.8 s on a dev server: 11 items, 1 needs you.
  - The only flag read "Your menu says "?" instead of a price.", which is plain.
  - Skipped lines were labelled "Heading" and "Opening hours". There were no cents and no method talk.
- **A dev-server reload loop I saw once.** On the first `next dev` start against a freshly created `data/judge2.db`, every page reloaded in a loop: 40 navigations in 6 s on `/` and 27 on `/s/marigold-bakehouse`. The console logged "[Fast Refresh] rebuilding" each time.
  - A restart with the DB in `/tmp` showed 2 navigations in 6 s.
  - A second restart, again with `data/judge2.db` (`npm run dev`), also showed 2.
  - I couldn't reproduce it, so I haven't scored it. It's worth a check, because the README tells judges to run `npm run dev` with the database inside the project (`data/`).

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** | Unchanged and re-verified. Several PayPal APIs are verified end to end in the sandbox. My seed created real Catalog products. My `create_order` produced a real Orders v2 approval link. `capture/order-shipped-1440.png` shows real capture and tracker ids (`75W32351N60467447`, `0PA340251W097094T`). **New:** a third-party client, the Claude Code CLI (`evidence/outside-client-claude-code.md`), ordered through the door with `--strict-mcp-config`. PayPal's own `GET /v2/checkout/orders/3RG62077NC717421B` shows `PAYER_ACTION_REQUIRED`, USD 8.50 and the matching `custom_id`. The dashboard shows "via Claude Code" (`outside-client-dashboard-1440.png`). AI does real work in the core flow: live extraction (verified again above), the brief agent and the buyer console. *Not verified:* the webhook (deploy only) and wallet-login payment. |
| A2 Design | **5** (was 4) | Every round-1 rough edge is fixed, and the product now looks like it shipped. **Identity:** a menu-board direction tied to the subject. Playfair Display, Schibsted Grotesk and IBM Plex Mono for money. One marigold accent, dotted-leader menus (`shop-1440/390`, `setup-review-*`), order slips with perforated edges (`dashboard-orders-*`) and a stamped PAID receipt (`receipt-paid-390`). **Round-1 defects:** the 390 order card now has the reference and amount on one line with the badge below (`dashboard-orders-390`). The order `h1` breaks after "Order" (`order-paid-with-brief-390`). Connect tabs wrap (`shop-390`). "Go to Shelfie" is a full primary button with an icon (`receipt-unknown-390`). Apostrophes are curly ("couldn’t", "didn’t", "doesn’t"). The `setup-live-390` gutters are 20/20. The console opens with the Activity header visible (`console-conversation-1440`). **States:** the 6 async states that round 1 found missing are now shown: `setup-publishing`, `setup-publish-retry`, `console-thinking`, `console-rate-limited`, `console-error`, `order-brief-writing`, `order-tracking-error` and `dashboard-paypal-unreachable`. Each one is specific: "PayPal said: Tracking number is invalid for carrier USPS.", "We can’t reach PayPal right now… Nothing is lost.", "7 of 9 added to PayPal" with per-item reasons. The directions judge's take-from-loser items are in: group subtotals ("Paid $43.50", "Not charged yet $83.00"), the amount in the slip header, a display-size order Total, and right-aligned review prices. **Small things left:** see the Part C notes. None is a broken state. |
| A3 Potential impact | **4** | **Better evidenced.** `EVIDENCE.md` 5b now has three fetched and verified press quotes. V1 is a Virginia home baker taking orders "by text messages and Facebook messages and Instagram DMs … tracking them on a spreadsheet" (Radio IQ, Jul 2026). V2 is a no-show that "never paid" (TODAY, Nov 2024). V3 is a food truck relying on P2P apps. Caveats are stated honestly (V2 is a storefront bakery). The audience and the Store Sync gap stay specific and sourced. **Still holding it at 4:** the build doesn't pay the seller. README Limitations: "One sandbox merchant receives all payments". `grep payee\|merchant_id\|partner-referrals src` finds nothing. The demo solves ordering, but not a real seller getting their money. *Fix:* top fix 1. |
| A4 Innovation | **4** | The concept is the same: a photo becomes a PayPal catalog plus a per-shop MCP door, for sellers with no store. It is now more credible, because a stranger's client (Claude Code) ordered through it with no Shelfie code involved. The novelty still has to be explained to a judge who has seen "an MCP server for a store". Neither the product nor the script yet leads with the contrast (Store Sync needs a storefront; this needs a photo). `DEMO.md` is unchanged since round 1 and doesn't include the Claude Code shot. *Fix:* top fix 2. |
| A5 Presentation readiness | **4** | **Ready:** `DEMO.md` gives a 2:45 path. The wow at 0:43 and the Inspector tamper at 1:30 both work (I reproduced the tamper). The start page explains the concept in one screen (`start-1440`). `render.yaml` and a README "Deploy to Render" section now exist. **Not ready:** the README marks the deploy "**Not yet run.**" There's no video. `gh repo view` → `"visibility":"PRIVATE"`. The wow segment still contains PayPal's guest-card form (`DEMO.md:9`, about 15 fields). The real-sandbox evidence shots (`capture/*`, `evidence/outside-client-*`) are in the **old** Fraunces/tomato look, so they won't match a video recorded on the current UI. *Fix:* top fixes 2 and 3. |
| **Total** | **22/25** (was 21) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **4** | One sentence still works: "Your price list, open to AI shoppers" (`start-*`). The hero now ends on a "Payment received" slip, which shows the seller's outcome. The headline still leads with the mechanism (AI shoppers) rather than the benefit (prepaid orders from a photo), and buyer-side demand for AI ordering from bakeries is still a bet. *Fix:* in top fix 2, make the sub-line the seller's outcome. |
| B2 Implementation | **5** | It runs. `round-2-tests.txt`: 48 files and 573 tests pass, typecheck and lint exit 0, and 66 screenshot tests pass against a production build. I seeded, read live, and created a real order through the door. The new code is tested (`tests/ai/normalize.test.ts` +202 lines, `health-route`, `publish-progress`, `record-samples`). The structure is clean: the issue copy is built in `normalize.ts` from fixed sentences, with model notes kept separate. |
| B3 Depth | **4** | More real-world messiness is handled and shown: partial publish failure with per-item reasons and Retry, a stalled poller banner, a PayPal tracking rejection, rate limiting and an assistant failure mid-turn. Deals, crossed-out prices, "?" and market prices all become owner questions. **Gaps:** the scale path (per-seller payouts) is still one README line. Live reading kept "Horchata sm / lg" as the item name while also splitting sm/lg into options, so the size words appear twice. *Fix:* top fix 1. |
| B4 Usefulness | **4** | The seller has what they need day to day: sold out today, pause, the brief with an allergy catch, one-tap tracking and a share tab. A real seller still can't use it this week, because payments go to Shelfie's merchant and there's no hosted instance. *Fix:* top fixes 1 and 3. |
| B5 Innovation | **4** | Agents on both sides: any MCP client buys (now proven with Claude Code), and a seller-side agent reads PayPal's record. Prices are enforced by the server. The same framing gap as A4. |
| **Total** | **21/25** | |

## Part C

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One marigold fill per screen: Snap your price list, Read my menu, Publish 6 items to PayPal, Copy agent door link, Order with an assistant, Send tracking to PayPal, Retry 2, Back to shop and Go to Shelfie. PayPal blue appears only on Approve (`receipt-awaiting-approval-1440`, `console-conversation-*`). *Note:* the dashboard Share tab has no filled action (`dashboard-share-390`: two outlined Copy buttons and an outlined "Watch an AI order"). |
| Loading, success, empty and error states | **Pass** | Now evidenced, not just in code. **Loading:** `setup-reading`, `setup-publishing` (6/9 with spinners), `console-thinking` and `order-brief-writing` ("Claude is reading PayPal’s record… about 10 seconds"). **Empty:** `dashboard-empty` and `console-empty`. **Error:** `start-bad-file`, `setup-retake`, `setup-failed`, `setup-publish-retry`, `console-rate-limited`, `console-error`, `order-tracking-error`, `dashboard-paypal-unreachable`, and the capture-refused, expired and cancelled receipts. **Success:** live, paid and shipped. Only the dashboard skeleton isn't shown (the README says so). |
| WCAG AA contrast, keyboard, visible focus, alt text | **Pass** | `axe-results.json`: **0 violations on all 66 screens** (I counted). Text on marigold is ink. Focus is `--color-focus: ink-900` (directions check). Photos have captions ("Your photo, to compare with what we read."). |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass** | The screenshot spec asserts `scrollWidth − innerWidth` on every screen, and all 66 passed. I found no overflow or clipping in any 390 shot. Gutters are symmetric (`setup-live-390`). Buttons are full width at 390, and switches are `min-h-tap`. |
| Copy is plain and specific, no jargon, no placeholders | **Pass** (was Fail) | The review card now reads "Printed as “2 for $7”. We set $3.50 each. Is that right?", "A price is crossed out. We set $8.00. Is that right?" and "Hard to read in the photo. Are the name and price right?" (`setup-review-*`). `prompts.ts` adds a rule that notes are for the owner: dollars, no field names, no "matched by row position". The Marigold sample now says "The $7 is crossed out; we used $8." There's no "?." and no cents. My live Tía Lupe read was plain too. *Nits:* "Retry 2" would read better as "Retry 2 items". Orders with no name show "Buyer · via Claude". |
| No generic AI look | **Pass** | Newsprint paper, blackboard ink and a marigold highlighter. No purple or blue gradients, no glass and no glow. Lucide icons and no emoji. |
| No empty hero, no three identical feature cards | **Pass** | The hero is the product: the real menu photo, the assistant's read-back with a nut warning, Approve, and "Payment received" (`start-1440`). The three sample cards are working entry points with distinct photos. |
| No lorem or fake stats | **Pass** | Realistic content, and fixtures are labelled in the README. *Note for the video:* the `setup-retake` fixture shows the Marigold price list under "This doesn’t look like a price list". It's only a test fixture, but on camera it would look wrong. |
| Deliberate type pairing, palette and spacing | **Pass** | `layout.tsx` loads Playfair Display (menu titles, italic sections), Schibsted Grotesk (UI) and IBM Plex Mono (prices and receipts) through `next/font`. The palette is tied to menu boards, on a 4 px base with named tap, gutter and section steps. |
| Tokens defined once and used everywhere | **Pass** | A grep for raw hex or `rgb(` in `src/components` and `src/app` `.tsx` files finds 0 hits. The three token layers in `globals.css` are closed (`--color-*: initial`). |
| Type scale and line length | **Pass** | A clear display/body/meta scale. Body copy stays within the 36 rem measure (`setup-review-1440`, `receipt-awaiting-approval-1440`). |
| Consistent components, subtle motion | **Pass** | The receipt-slip motif is the same on start, the console, the dashboard, order detail and receipts. Badges and buttons match across flows. Motion uses duration tokens and `motion-reduce`. |

**Part C: 0 fails** (round 1 had 1).

## Round 1's top 3 fixes

1. **Make the seller copy plain and close the polish gaps:** **done.**
   - The issue copy is fixed sentences (`normalize.ts:141–170`), the prompt rule is added (`prompts.ts`), the samples are re-recorded, and the "?." bug is gone.
   - Every listed layout nit is fixed: the 390 order card, curly apostrophes, wrapping tabs and the "Go to Shelfie" button.
   - 8 async states were screenshotted. Only the dashboard skeleton is missing.
   - Score: A2 4 → 5, and the only Part C fail is cleared.
2. **Deploy, then record the video:** **partly done.**
   - The outside MCP client was shown (Claude Code CLI, verified against PayPal's record). `render.yaml` and a deploy guide exist.
   - The deploy was not run ("Not yet run"). There's no HTTPS URL, no webhook verification and no video, and the repo is still private.
   - All of these were out of scope for this run.
   - Score: A5 held at 4. The outside-client run strengthens A1 and A4 credibility but didn't move their scores.
3. **Pay the seller, not Shelfie, and evidence the pain:** **half done.**
   - The seller voices were added: 3 verified press quotes, with honest caveats.
   - Partner Referrals or payee routing was not started.
   - Score: A3 held at 4. The evidence half was needed but isn't enough while the money still goes to the platform. The next attempt takes a smaller route (fix 1 below), not the full onboarding flow again.

## Top 3 fixes (ranked by Part A gain; fixes in code and docs first)

1. **Route each shop's money to the seller (A3 4 → 5; also B3 and B4 4 → 5). Code.** This is a different approach from round 1's full onboarding.
   - Add an optional "Your PayPal email" field to the Your shop card at setup.
   - When it's set, send `purchase_units[0].payee.email_address` on Orders v2 create. Keep the single-merchant path as the fallback, so the capture gate keeps passing.
   - Show "Paid to <email>" on the order's PayPal card and on the receipt.
   - Add a variant of `e2e/capture.spec.ts` that pays a shop with a second sandbox Business account as payee. Check PayPal's `GET /v2/checkout/orders/{id}` for `payee.email_address`, and check that `create_shipment_tracking` still succeeds for that capture.
   - If the sandbox refuses payee routing or the tracking call, fall back to a sandbox Partner Referrals link (`POST /v2/customer/partner-referrals`) at publish, plus `PayPal-Auth-Assertion`. Say plainly in the README which one is verified.
   - Remove the "one sandbox merchant receives all payments" line only once a payee capture is verified.
   - Also strip size words from item names when the sizes are split into options (the "Horchata sm / lg" case).
2. **Make the story land without a deploy (A4 4 → 5, and readiness for A5). Code and docs.**
   - Rewrite `DEMO.md`. Open on the contrast: Store Sync needs an existing storefront, while here a chalkboard becomes an agent door in about 10 s. Add an 8-second shot of the Claude Code CLI ordering from the door (the run in `evidence/` is already proven). Cut the guest-card typing to a jump. Alternatively, create US sandbox Business and Personal accounts in the Developer Dashboard so wallet login works and replaces the 15-field form; that is a human step in the dashboard.
   - Re-run `e2e/capture.spec.ts` and the outside-client run on current main, so `capture/*` and `evidence/*` show the shipped design rather than the old tomato/Fraunces one.
   - Swap the `setup-retake` fixture photo for a non-menu image.
   - On the start page, make the sub-line the seller's outcome, for example "Prepaid orders from a photo of your price list", with the AI door as the mechanism (B1).
   - Give the dashboard Share tab one filled primary ("Copy agent door link").
3. **Deploy, record and publish (A5 4 → 5). A human and deploy step, not code.**
   - Apply `render.yaml` on Render and run `npm run seed` in its shell.
   - Set the PayPal webhook and verify `PAYMENT.CAPTURE.COMPLETED` on the HTTPS URL.
   - Put the URL and a "pay with this test card" box at the top of the README.
   - Record the under-3-minute video from the revised `DEMO.md` and make it public on YouTube.
   - **Make the repo public before 12 Nov 12:00 PT.** The submission requires it, and it is currently `PRIVATE`.

## Verdict: **ship**

Part A is **22/25** (up from 21; A2 4 → 5) and Part B is **21/25**. There are **0 Part C fails**. That meets the ship bar: no Part C fails and Part A ≥ 20.

The next highest-value gains are:
- Paying the seller instead of the platform (fix 1). This is the last real gap between "a demo that takes orders" and "a tool a baker would use this week".
- Making the novelty legible in the script and evidence (fix 2).
- The deploy, the video and making the repo public (fix 3). These are required for the submission, but they are human steps outside this build run.
