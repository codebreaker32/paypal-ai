# Judge round 3: round 2's fixes, re-checked on main 6183d15

**What I judged:**
- All 66 round-3 screenshots (33 pairs at 390 px and 1440 px), `axe-results.json` and the screenshot README, which labels the fixture and mocked states.
- The real-sandbox shots in `capture/`, which were re-taken in the current design, and the outside-client evidence in `docs/judge/evidence/`.
- `round-3-tests.txt`, the full e2e log (`/tmp/r3-e2e.log`), the README, `DEMO.md`, `EVIDENCE.md`, `AI_TOOLS.md` and `LICENSE`.
- The code diff since round 2 (`863b6c1..HEAD`). I read it only where I needed to check a claim: `normalize.ts`, `review-model.ts`, `SharePanel.tsx`, `CopyButton.tsx`, `page.tsx`, `globals.css` and `e2e/screenshots.spec.ts`.

I scored the fixture and mocked states as UI only. I took the money evidence from the e2e capture gate and from my own run. I didn't read `PROGRESS.md`, `DECISIONS.md` or commit messages.

**What I ran myself.** I used a production build (`npm ci`, `npm run build`, then `PORT=3120 npm start`) with `DATABASE_PATH=data/judge3.db`, and stopped the server afterwards.

- **Seed.** `npm run seed` published 9 real sandbox Catalog products (`PROD-1N7339773G6430838` and others).
- **Agent door, with curl:**
  - `tools/list` returned the 4 tools, each with `additionalProperties: false`.
  - `create_order` with `"price": 0.01` returned `INVALID_ARGUMENTS`: "`price` is not accepted; prices are set by the shop."
  - A `unit_price` sent inside a line was also rejected, at path `items[0].unit_price`.
  - A real `create_order` (2 × butter croissant, 1 × almond croissant, shipping) returned SHF-2LCYQG, $21.50 and `checkoutnow?token=73J71639XG767923M`. The link returned HTTP 200.
  - Sending the same `client_request_id` again returned the same order (idempotent).
  - `get_order_status` said "Waiting for the user to approve… Nothing has been charged."
- **PayPal's own record** (`GET /v2/checkout/orders/73J71639XG767923M`): `PAYER_ACTION_REQUIRED`, USD 21.50 (items 13.50 + shipping 8.00), `custom_id` `ord_t3xibvgfbwl55pyq`, and line SKUs equal to the Catalog ids from my seed (`PROD-0RH35384CP061472A`, `PROD-8K663171YA0780837`). The **payee is the app's own sandbox business account** (`…@business.example.com`).
- **Playwright at 390 px, live Claude.** I tapped **Try a sample menu → Tía Lupe's**.
  - The reading stored model `claude-sonnet-5-5` (not the recorded one) and took 9.1 s: 11 items, 1 needs you.
  - The only card said "Your menu says “?” instead of a price." The horchata is now named **"Horchata"**, with options sm $3.00 and lg $4.50. Round 2's "Horchata sm / lg" double is gone.
  - Publishing 10 items took **4.5 s**, then "Your shop is live". There were no page errors and no horizontal scroll.
- **The buyer console** at 390 px with live Claude, on the seeded shop:
  - I typed "Two almond croissants and a sourdough, shipped to me." It called `get_shop_info` (37 ms) and `list_products` (41 ms), then read the order back with "(contains nuts)", the $8.00 shipping and the $27.00 total.
  - I said "Yes" and it called `create_order` (774 ms): SHF-Y364KA, with an **Approve $27.00 on PayPal** card. PayPal's record of `7FA55550VR882862Y` matches: USD 27.00, with Catalog SKUs.
- **Tests.** `npm test`: 49 files and 586 tests passed.
- **The full e2e run** (`/tmp/r3-e2e.log`): **56 passed, 1 skipped** (the "Other carrier" test, which is hidden until it's verified in the sandbox), exit 0 in 390 s. The run includes the real-sandbox capture gate: capture `9AS032720T739521X` COMPLETED at PayPal for $27.00, a Claude brief that catches the nut allergy, USPS tracker `…-9400111179393091999227` SHIPPED, and `get_order_status` reading the tracking back.
- **Repo.** `gh repo view`: `"visibility":"PRIVATE"`, and the licence is detected as MIT.
- **Not re-tested.** The dev-server reload loop from round 2. `globals.css` now scopes Tailwind's scan with `@import "tailwindcss" source("..")`, but I judged on a production build, as asked.

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** | Unchanged and re-verified today. **PayPal:** Catalog Products (my seed: 9 real products). Orders v2 create, with SKUs linking each line to its Catalog product (PayPal's own record of my two orders). Approve and capture (e2e capture gate, capture `9AS032720T739521X` COMPLETED). Agent Toolkit `get_order` for the brief and `create_shipment_tracking` (tracker SHIPPED, read back through MCP). **Prices and retries are enforced by the server:** both price tampers are rejected, and the idempotent `client_request_id` returned the same order. **AI does real work in the core flow:** live vision extraction (9.1 s, plain flags), the buyer-console agent ordering over the real door, and the brief agent. A third-party client (the Claude Code CLI) ordered through the door; it was re-run on the current design (`evidence/outside-client-claude-code.md`, PayPal order `17R81429KU459414P`). *Not verified:* the webhook (deploy only) and wallet-login payment. |
| A2 Design | **5** | Still reads like a shipped product, and round 2's nits are fixed. The Share tab has one filled primary, **Copy agent door link** (`dashboard-share-390`). The retry button says **Retry 2 items** (`setup-publish-retry-390`). `setup-retake-390` now shows a coffee cup and a plant, not a menu. The capture and outside-client shots are in the menu-board design (`capture/order-shipped-1440`, `evidence/outside-client-dashboard-390`), so they match a video recorded today. The waiting group now says "Not paid yet" and explains "Payment pending" (`dashboard-orders-1440`). **Small things left** (none is a broken state): unnamed orders still read "Buyer · via Claude" (`dashboard-orders-390`, SHF-V53MEP); the dashboard skeleton is still not shown. |
| A3 Potential impact | **4** | The audience and pain stay specific and sourced (`EVIDENCE.md`: Store Sync wording, 47% of food-service firms with no website, three verified seller quotes). The demo solves taking a prepaid order from a paper menu. **What holds it at 4:** the money still goes to the platform. PayPal's record of my order names the app's own sandbox business account as payee. `grep -rn "payee\|partner-referrals\|merchant_id\|PayPal-Auth-Assertion" src` finds 0 hits. README Limitations: "One sandbox merchant receives all payments". The README's "Path to scale" says "None of this is built or verified." *Fix:* top fix 1. |
| A4 Innovation | **4** | Round 2's story fix is done. `DEMO.md` opens on the contrast (0:00–0:12: Store Sync's "existing website storefronts" against Rosa's sheet of paper) and has the Claude Code shot (0:45–1:02). The start page's sub-line leads with the outcome. The score didn't move, because what holds it back is in the product, not the story. The agent door, once built, is a standard MCP commerce server (stores with an MCP endpoint already exist). The new part is the onboarding, and the pitch's claim that these sellers are "invisible to AI shopping assistants" is only half addressed. Nothing makes the door findable: there's no QR or printable card for the stall (the spec's journey mentions "QR at the stall"), no machine-readable shop page (`curl /s/marigold-bakehouse` shows no JSON-LD or `<link>` to the door), and no well-known route. An assistant reaches the shop only if someone pastes the link. *Fix:* top fix 2. This is a different approach from round 2's: product, not script. |
| A5 Presentation readiness | **4** | **Ready:** `DEMO.md` is a crisp 2:50 path. It opens on the problem and audience, shows an outside assistant, has the console wow with a jump cut past the card form, the Inspector tamper, the allergy-catching brief and tracking read-back. I reproduced each beat today: tamper, console order, publish in 4.5 s. **Not ready:** no video exists; the README still says the deploy is "**Not yet run.**"; the repo is `PRIVATE`. **Docs error in the script:** `DEMO.md` says the sample menu "uses a recorded real reading with no wait on Claude", and offers it as the fallback if Claude is slow. With `ANTHROPIC_API_KEY` set, the sample is read live (`setup.ts:150`, `recorded = !deps.hasAiKey && sample !== null`; my run stored `claude-sonnet-5-5` and took 9.1 s), so that fallback doesn't exist as written. *Fix:* top fix 3. |
| **Total** | **22/25** (unchanged) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **4** | The sub-line is now the seller's outcome: "Prepaid orders from a photo of your price list" (`start-390`). That was round 2's B1 fix. It's held at 4 because the only way a human buyer can order is through an AI chat. The shop page's only order action is **Order with an assistant** (`shop-390`). A baker whose regulars don't use assistants won't want it at once. *Fix:* in top fix 2, the counter card makes the paper menu itself the way in ("scan to order with any assistant"), which answers "but my customers don't use AI". |
| B2 Implementation | **5** | It runs from a clean `npm ci` and production build. I ran 586 of 586 unit tests, and the full e2e run passed 56 with 1 skip, including the real capture gate. The new code is small and tested: `withoutSizeWords` in `normalize.ts` with guards (only when every variant has a label, never empties the name), tests at `tests/ai/normalize.test.ts:374–390`; `duplicateUpdates` in `review-model.ts`, with `tests/components/duplicate-card.test.ts`; and the `tempDbPath()` test helper. |
| B3 Depth | **4** | More real-world messiness is handled. Sizes are stripped from names (verified live). A "listed twice" card keeps the item's own question for its next card. Crossed-out wording now covers "cross-out", "scored out" and "scratched out". The scale path is now a proper README section, but it is explicitly unbuilt, and per-seller payouts are the core of it. *Fix:* top fix 1. |
| B4 Usefulness | **4** | Day-to-day tools are there: sold out today, pause, the brief, one-tap tracking and the Share tab. A real seller still can't use it this week: the money goes to Shelfie's merchant, there's no hosted instance, and there's no QR for the counter. *Fix:* top fixes 1, 2 and 3. |
| B5 Innovation | **4** | Agents on both sides, server-enforced prices, and a proven outside client. The gap is the same as A4: the door isn't discoverable. *Fix:* top fix 2. |
| **Total** | **21/25** (unchanged) | |

## Part C

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One marigold fill per screen: Snap your price list, Publish 6 items to PayPal, Copy agent door link (now on the Share tab too, `dashboard-share-390`), Order with an assistant, Retry 2 items and Back to shop. PayPal blue appears only on Approve (`console-conversation-390`). |
| Loading, success, empty and error states | **Pass** | **Loading:** `setup-reading`, `setup-publishing`, `console-thinking`, `order-brief-writing`. **Empty:** `dashboard-empty`, `console-empty`. **Error:** `start-bad-file`, `setup-retake`, `setup-failed`, `setup-publish-retry`, `console-rate-limited`, `console-error`, `order-tracking-error`, `dashboard-paypal-unreachable`, and the capture-refused, expired and cancelled receipts. **Success:** live, paid, shipped. Only the dashboard skeleton is not shown, and the README says so. |
| WCAG AA contrast, keyboard, visible focus, alt text | **Pass** | `axe-results.json`: 66 screens and **0 violations** (I counted). The skip link is the only element under 44 px, and it is visually hidden until focused. |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass** | The screenshot spec asserts no overflow on all 66 screens. My Playwright run measured 0 px overflow on `/`, `/s/tia-lupes-tacos`, `/s/marigold-bakehouse`, a receipt `/o/…` and the console. Apart from the skip link and the hidden file input, no button, link, tab or switch is under 44 px tall. |
| Copy is plain and specific, no jargon, no placeholders | **Pass** | Review cards: "Printed as “2 for $7”. We set $3.50 each. Is that right?" and "Your menu says “?” instead of a price." (from my live read too). The reading note "Prices are printed without a $ sign; we read them as dollars." is plain. **Retry 2 items** fixes round 2's nit. *Nits:* unnamed orders show "Buyer · via Claude", and the README has a `git clone <this repo>` placeholder. Both are covered in the fixes below. |
| No generic AI look | **Pass** | Newsprint paper, blackboard ink and a marigold highlighter. No gradients, glass, glow or emoji; Lucide icons. |
| No empty hero, no three identical feature cards | **Pass** | The hero is the product: the menu photo, the assistant's read-back with the nut warning, Approve, and Payment received (`start-1440`). The three sample cards are real entry points with distinct photos. |
| No lorem or fake stats | **Pass** | The content is realistic, and the fixtures are labelled. The retake fixture now shows a non-menu photo (`setup-retake-390`). |
| Deliberate type pairing, palette and spacing | **Pass** | Playfair Display for menu titles, Schibsted Grotesk for the UI and IBM Plex Mono for money, all through `next/font`. The palette comes from menu boards, on a 4 px base with named steps. |
| Tokens defined once and used everywhere | **Pass** | A grep for raw hex or `rgb(` in `src/components` and `src/app` `.tsx` finds **0** hits. The tokens live in `globals.css`. |
| Type scale and line length | **Pass** | A clear display/body/meta scale. Body copy stays within the measure (`setup-review-1440`). |
| Consistent components, subtle motion | **Pass** | The perforated receipt slip, the badges and the buttons are the same on start, the console, the dashboard, order detail and receipts. `CopyButton` gained `label` and `primary` props instead of a one-off button. |

**Part C: 0 fails** (round 2 also had 0).

## Round 2's top 3 fixes

1. **Route each shop's money to the seller:** **not done.** Only its sub-item was done.
   - **Done:** size words are stripped from names (`normalize.ts` `withoutSizeWords`, and verified live: "Horchata" with sm/lg).
   - **Not started:** the "Your PayPal email" field, `payee.email_address` and a second sandbox Business account in a capture test. The grep finds 0 hits, PayPal's record of my order names the app's account as payee, and the README Limitations line is unchanged.
   - **Score:** A3, B3 and B4 held at 4. The approach wasn't tried, so it isn't a failed approach. It stays at the top of the list, cut down to the smallest version that can be verified (below).
2. **Make the story land without a deploy:** **done.**
   - `DEMO.md` is rewritten: it opens on the contrast, adds a Claude Code shot and jump-cuts past the card form.
   - `capture/*` and `evidence/*` were re-taken in the current design.
   - The retake fixture uses `coffee-and-plant.jpg`.
   - The start page's sub-line is now the outcome, and the Share tab has a filled primary.
   - **Score:** A4, A5 and B1 held at 4. It closed the Part C nits and made the video ready to record, but the A4 gap turned out to be in the product (discoverability), not the script. Next time takes a different approach (fix 2 below).
3. **Deploy, record and publish:** **not done.**
   - The README says "Not yet run", there's no video, and `gh repo view` shows `PRIVATE`.
   - These are human steps outside the build run.
   - **Score:** A5 held at 4.

**The score did not go up this round** (22 / 21 / 0, the same as round 2). No criterion went down, so there's no regression to fix. The work done was polish and story, which round 2 expected to move A4. The changes that move scores (the payee, findability, the deploy and the video) are still open.

## Top 3 fixes (ranked by Part A gain)

1. **Pay the seller, in the smallest version that can be verified (A3 4 → 5; also B3 and B4 4 → 5). Code.**
   - **Setup (`src/components/setup/ShopDetails.tsx`):** add an optional "PayPal email for payouts" field to the "Your shop" card, with a `payee_email` column in `schema.sql` and the shop repo.
   - **PayPal client:** add `payeeEmail?: string` to `CreatePayPalOrderInput` (`src/lib/paypal/types.ts`). When it's set, send `purchase_units[0].payee.email_address` from the order body builder in `src/lib/paypal/orders.ts`.
   - **The capture gate (`e2e/capture.spec.ts`):** add a variant whose shop has a second sandbox Business account as payee (creating that account is a human step in the Developer Dashboard).
     - Assert that PayPal's `GET /v2/checkout/orders/{id}` returns that `payee.email_address` and that the capture is COMPLETED.
     - Then try `create_shipment_tracking` (`src/lib/seller/actions.ts`). If PayPal refuses tracking for another merchant's capture, show "Add tracking in your PayPal account" for payee shops, and say so in the README. Don't block the fix on it.
   - **Show it to the seller:** "Paid to <email>" on the order's PayPal card and on the live step.
   - **README:** change "One sandbox merchant receives all payments" to "Payments go to the seller's PayPal email when one is set (verified in the sandbox); otherwise to the app's merchant". Change it only after the payee capture passes.
2. **Make the door findable from the paper menu and the web (A4 4 → 5; B5 and B1 4 → 5; supports A3). Code.** This is a different approach from round 2's story fix.
   - **Counter card:** add a **Print counter card** action to the dashboard Share tab (`src/components/dashboard/SharePanel.tsx`) and the live step (`LiveStep.tsx`).
     - It's a print-styled page with a QR code of the shop link, generated locally (for example with the `qrcode` package), the shop name in Playfair, and "Order ahead with any AI assistant, pay on PayPal".
     - The seller tapes it next to the chalkboard. The loop closes: a photo of the paper becomes a shop, and the shop goes back on the paper.
   - **Machine-readable shop page (`src/app/s/[slug]/page.tsx`):**
     - Add schema.org JSON-LD: a `Store` or `FoodEstablishment` with a `hasMenu`/`Offer` list and the agent-door URL.
     - Add a `<link rel="alternate">` to the door.
     - Add a plain-text route an agent can read (for example `/s/[slug]/agents.txt`) that says how to connect.
   - **Prove it with an outside client.** Give the Claude Code CLI **only the shop page URL** (no `--mcp-config`) and record whether it finds the door and orders. Add the transcript to `docs/judge/evidence/`, the way the existing outside-client run was recorded.
   - **Video:** add a 6-second beat to `DEMO.md`: the card goes on the counter and a phone scans it.
   - **Small copy fix while there:** show unnamed orders as "No name given · via Claude" instead of "Buyer · via Claude" (the `'Buyer'` fallback in `src/lib/seller/view.ts:42`).
3. **Deploy, record, publish (A5 4 → 5). Mostly human steps; this is the submission blocker whatever the score.**
   - **Human steps:**
     - Apply `render.yaml` on Render, then run `npm run seed` in its shell.
     - Add the PayPal webhook and verify `PAYMENT.CAPTURE.COMPLETED` on the HTTPS URL.
     - Record the video from `DEMO.md` and make it public on YouTube.
     - **Make the repo public before 12 Nov 2026, 12:00 PT.** It is `PRIVATE` today, and Stage One will fail without it.
   - **Docs, doable now:**
     - Correct `DEMO.md`'s "Setup before recording" and "If something breaks" lines. With a key set, a sample menu is read live (about 9 s), so the instant recorded reading isn't available as a fallback. Either say "cut on the result", or add an explicit switch for recorded samples and document it.
     - In the README, replace `git clone <this repo>` with the real URL.
     - Put the hosted URL and the test-card box at the top of the README.
     - Update the stale lines "into docs/judge/screenshots/round-1/" and "The judged round-2 set was made this way".

## Verdict: **ship**

Part A is **22/25** and Part B is **21/25**, both unchanged. There are **0 Part C fails**. That meets the ship bar: no Part C fails and Part A ≥ 20.

The build is solid and verified end to end today:
- the real capture gate passed;
- my own seed, door orders and price tampers worked;
- the live Claude reading and console order worked;
- 586 unit tests and 56 e2e tests pass.

The next highest-value gains:
- **Money to the seller** (fix 1). This is the last gap between "a demo that takes orders" and "a tool a baker would use this week".
- **A door that can be found from the chalkboard and the web** (fix 2). This makes the novelty real rather than only well told.
- **The human steps** (fix 3): deploy, video and a public repo. Without them the submission isn't valid. The deadline is 12 Nov, 12:00 PT.
