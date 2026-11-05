# Judge round 1: the built milestone

**What I judged:** all 50 round-1 screenshots (390 px and 1440 px) and `axe-results.json`; the real-sandbox screenshots in `capture/` and `task7/real-*`; `round-1-unit.txt` and `round-1-static.txt`; `e2e/capture.spec.ts`; the README, spec, `EVIDENCE.md`, `AI_TOOLS.md` and `DEMO.md`; and the code where I needed to check a claim. The fixture states (paid, shipped and expired receipts, dashboard orders, order detail, console replay) are labelled as fixtures in the screenshot README. I scored those as UI only and took the payment evidence from the real-sandbox shots and my own run.

**What I ran myself:**
- `npm test`: 44 files and 518 tests passed.
- `next dev --port 3120` with `DATABASE_PATH=data/judge.db`, then `npm run seed`, which published 9 real sandbox products (`PROD-82U6…` and others).
- `curl` against the agent door:
  - `tools/list` returned the 4 tools.
  - `create_order` with `"price": 0.01` returned `INVALID_ARGUMENTS`: "`price` is not accepted; prices are set by the shop."
  - A bad item returned `UNKNOWN_ITEM` with a hint.
  - GET returned 405, and an unknown shop returned 404.
- A Playwright run at 390 px:
  - **Try a sample menu.** The reading was live Claude (`claude-sonnet-5-5`, 9.4 s, stored in `extractions`). The review loaded in 18.8 s, which includes the dev server compiling.
  - I clicked **Looks right** on one item, then **Publish 7 items to PayPal**. The shop was live 7.1 s later, published to the real sandbox catalog.
  - I checked the dashboard, the Menu tab, the shop, an unknown receipt and an unknown shop (404 "No shop here").
  - No page had horizontal scroll. Keyboard focus showed a 2 px solid ink outline.
- A Playwright run of the buyer console at 1440 px with real Claude. "Two butter croissants for Saturday pickup…" led to `get_shop_info` (90 ms) → `list_products` with query "croissant" → a read-back ("Total: $8.50 … Shall I place it?"). After "Yes, place it." it called `create_order` (1.7 s) → order SHF-2DLF9U → a real `https://www.sandbox.paypal.com/checkoutnow?token=…` approval link.

I stopped the server afterwards.

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** | PayPal is central and verified end to end in the sandbox. **Catalog Products:** my seed and publish runs created real `PROD-…` ids. **Orders v2:** create, get and capture. **Agent Toolkit:** `get_order` drives the brief agent, and `create_shipment_tracking` adds tracking. `e2e/capture.spec.ts` checks Shelfie's stored capture against PayPal's own `GET /v2/checkout/orders` (`COMPLETED`, matching `custom_id` and amount). It also checks `GET /v1/shipping/trackers` (`SHIPPED`, USPS) and `get_order_status` returning the tracking number. `capture/order-shipped-1440.png` shows the real ids `75W32351N60467447` and `0PA340251W097094T`. AI does real work at three points in the core flow: vision extraction (`messages.parse` + zod), the toolkit-grounded brief agent (the gate asserts `briefSource === 'agent'` with an `allergy` request), and the buyer console, an MCP client over real HTTP that I watched place a real order. Server-enforced prices, a CAS state machine, capture claims and request ids round it out. *Not yet verified:* the webhook path (deployed only) and wallet-login payment. |
| A2 Design | **4** | A coherent product with a distinct, warm look: Fraunces and Public Sans, paper and tomato colours, and a palette tied to handwritten menus. States shown include start (idle, photos ready, bad file, returning owner), setup (reading, retake with a specific tip, failed, review, live), 6 receipt states, the dashboard (empty, orders grouped To prepare / Waiting / Done, menu, share) and order detail (brief, tracking, buyer from PayPal, timeline, PayPal ids). **Rough edges:** (1) The review card shows raw model notes as written: `setup-review-*`: *"Deal "2 for $7": $3.50 each?. Multi-buy deal; unit price is 350 cents. Matched by row position."*. (2) At 390 px the order card header crushes: `dashboard-orders-390` breaks "SHF-/3FSEKE" across two lines, and "Buyer · via / Claude · / 11:13 PM" stacks into 4 lines beside a long badge. (3) The shop page's connect tabs clip "Inspect…" at 390 px with no scroll cue (`shop-390`). (4) Headings mix straight and curly apostrophes ("didn't", "couldn't" vs "didn’t"). (5) "Go to Shelfie" on `receipt-unknown` is a smaller, icon-less button unlike every other receipt. (6) Several async states exist in code but appear in no screenshot: publishing progress, partial failure → Retry, console thinking / rate-limited / tool-error recovery, "Writing the brief…", the tracking PayPal error and the "Can't reach PayPal" banner. *Fix:* top fix 1. |
| A3 Potential impact | **4** | The audience is specific (US home bakers, food trucks, market stalls and repair shops with no website). The gap is evidenced from primary sources (`EVIDENCE.md`): PayPal's agent checkout "is limited to Store Sync customers today… existing website storefronts". 47% of US food-service employer firms reported having no website (Census ASE 2016). Only 15% of cottage-food producers sell online (IJ 2017). The build closes that gap: about 10 s of machine time from photo to live shop (measured over 6 runs, and 7 s for publish in my run). **Missing:** the seller's pain is still unsourced (`EVIDENCE.md` 5b, "Not found"), and every shop's money goes to one Shelfie merchant (README Limitations), so a real seller can't be paid yet. *Fix:* top fix 3. |
| A4 Innovation | **4** | "Agent Ready for sellers with no store" is a sharp, credible angle that isn't on the listed examples. A photo becomes a PayPal catalog plus a per-shop MCP door that is seconds old. The agent door is a buyer-safe layer over a toolkit whose `create_order` trusts model prices, and the brief agent reads PayPal's own record. Many agentic-commerce entries will ship "an MCP server for a store", though, so the novelty rests on the photo-to-door step and the storeless audience. *Fix:* open the video on the contrast: a chalkboard becomes a door any assistant can order through in about 10 s, while Store Sync needs an existing storefront. Add one shot of a third-party MCP client (Inspector or Claude Code) ordering from the deployed door, so judges see that the door isn't tied to Shelfie's own console. |
| A5 Presentation readiness | **4** | `DEMO.md` is a 2:45 script. The wow (0:43), the Inspector tamper (1:30, which I reproduced) and tracking read back by the buyer's assistant (2:05) are all real, demoable paths. The start page makes the concept clear in one screen (`start-1440`). **Not ready:** no video is recorded. There's no hosted URL, so judges must create their own PayPal app and Anthropic key to try it. The guest-card checkout inside the wow segment means about 15 form fields on screen. The repo is still **private** (`gh repo view` → `"visibility":"PRIVATE"`), and it must be public by the deadline. *Fix:* top fix 2. |
| **Total** | **21/25** | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **4** | One sentence works: "Snap your price list; any AI assistant can order from it, paid with PayPal". The start page shows it at a glance. Sellers will want the result (orders), but demand from AI-assistant shoppers for local bakeries is still a bet. *Fix:* lead with the seller benefit (prepaid orders from a photo) and treat the agent door as the mechanism. |
| B2 Implementation | **5** | It runs: I seeded, read live, published and ordered through Claude → MCP → PayPal. 518 unit tests pass (my run), and typecheck and lint are clean (`round-1-static.txt`). The capture gate verifies money and tracking against PayPal's own records. The code is clean: a pure state machine, a `PayPalPort` with a fake, a composition root, `scopeTool` tenant checks, and a closed token palette with no raw hex in components (grep). |
| B3 Depth | **4** | Real messiness is handled: four issue flags, deals turned into a suggested unit price, crossed-out prices, market price → "Ask in person", duplicates, retake tips from `problems[]`, a timeout failure with photos kept, and injection lines dropped. On the money side: capture claim, decline loop, expiry, open-order and rate caps, idempotent `client_request_id`, and a labelled template brief if Claude fails. **Gap:** the scale path, per-seller payouts through Partner Referrals, is only one line in the README. *Fix:* top fix 3. |
| B4 Usefulness | **4** | Day-to-day controls are there: sold-out today, pause agent orders, pickup or flat shipping, an AI brief that catches "nut allergy, but almond croissants contain nuts", one-tap tracking, and an "Order with an assistant" console so buyers without their own AI can order. It isn't usable this week by a real seller, because payouts go to Shelfie's merchant and there's no hosted instance. *Fix:* top fixes 2 and 3. |
| B5 Innovation | **4** | Agents work on both sides: any MCP client buys, and a seller-side Claude agent reads PayPal's record through the toolkit. Prices are enforced by the server, not the model. *Fix:* same as A4. |
| **Total** | **21/25** | |

## Part C

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | Each screen has one filled tomato or PayPal button: Snap, Read my menu, Publish N items, Copy agent door link, Order with an assistant, Approve on PayPal, Send tracking to PayPal, and the empty-state "Watch an AI order from you". Secondary actions are outlined or links. The hero's blue "Approve $19.00" is a non-interactive picture (`OrderPreview.tsx`, `pointer-events-none`, inside a captioned `figure`). |
| Every async action has loading, success, empty and error states | **Pass** (with gaps in evidence) | Seen: reading → review / retake / failed; photos ready / bad file; dashboard empty and orders; receipt awaiting, paid, refused, cancelled, expired and unknown; console empty and conversation. Present in code but not screenshotted: `Publishing.tsx` (progress and Retry), console 429 and error (`BuyerConsole.tsx:136`), "Writing the brief…" (`BriefCard.tsx:46`), the dashboard skeleton (`(dashboard)/loading.tsx`), "Can't reach PayPal" (`OrdersPanel.tsx`) and `TrackingForm.tsx`. Add these to round 2's screenshots. |
| WCAG AA contrast, keyboard, visible focus, alt text | **Pass** | axe with wcag2a/aa/21a/21aa reported **0 violations on all 50 screens** (`axe-results.json`). My Tab run showed `outline: 2px solid rgb(31,26,23)`. There's a skip link. The spec fails the test on serious or critical findings. |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass** | `scrollWidth − innerWidth = 0` on the start, review, live, dashboard, menu, shop and receipt screens in my 390 px run, and the screenshot spec asserts it on every screen. Switches use `min-h-tap min-w-tap` (44 px, `Switch.tsx`). The only sub-44 px hits were inline text links, radios inside full-card labels, and the sr-only skip link. The clipped tab strip on `shop-390` is contained (`overflow-x-auto`), so there's no page scroll. |
| Copy is plain and specific, no jargon, no placeholders | **Fail** | The seller-facing review card shows model reasoning and units: *"$3.50 each?. Multi-buy deal; unit price is 350 cents. Matched by row position."* (`setup-review-390/1440`). The text comes from `src/lib/ai/samples/marigold-bakehouse.json` (notes at lines 57, 95, 114, 133 and 171, plus the warning at line 10, "matching… was done by row position"). The `"?."` comes from `normalize.ts:125` joining details with `'. '`. This is the recorded reading every keyless judge sees, on the screen the demo dwells on. Live Claude was cleaner in my run ("Deal "2 for $7": $3.50 each?"), but nothing in the prompt guarantees that. |
| No generic AI look | **Pass** | Paper and tomato with Fraunces, no purple or blue gradients (the only gradients are the reading scan line and the skeleton shimmer, both token-based), no glass and no glow. Icons are Lucide; there are no emoji. |
| No empty hero, no three identical feature cards | **Pass** | The hero is the product itself: a real menu photo beside the agent conversation it produces, labelled "Example". The three sample cards are working entry points with distinct photos. |
| No lorem or fake stats | **Pass** | Content is realistic. Fixture data is labelled in the screenshot README. Every stat in the README traces to `EVIDENCE.md`, and the 95% claim was reworded to "at least partial visibility". |
| Deliberate type pairing, palette and spacing | **Pass** | Fraunces (display) and Public Sans (UI) via `next/font`. The palette is defined in `globals.css` (paper, ink, tomato and AA status hues), with a 4 px spacing base and a named `tap`, gutter and section rhythm. |
| Tokens defined once and used everywhere | **Pass** | Three layers in `globals.css`. `--color-*: initial` removes Tailwind's palette, and `--text-*`/`--radius-*` are closed too. A grep for raw hex or `rgb(` in `src/components` and `src/app` .tsx files found nothing. |
| Type scale and line length | **Pass** | A major-third scale from 16 px (smallest step 13 px) and `--container-measure: 36rem`. Body copy stays within about 75 characters at 1440 px (review and receipts). |
| Consistent components, subtle motion | **Pass** | Cards, badges, buttons and status chips are the same across the setup, dashboard and receipt screens. Motion uses duration tokens and `motion-reduce`. Minor issues: the "Go to Shelfie" button style and the 390 px order-card header (A2). |

**Part C: 1 fail** (plain copy).

## Round 0's top 3 fixes

1. **Make the demo prove the whole core flow:** **done.**
   - `DEMO.md` lands the wow at 0:43, runs the tamper through the Inspector at 1:30 (I confirmed `INVALID_ARGUMENTS` live) and shows tracking at 2:05.
   - `e2e/capture.spec.ts` is the real-sandbox gate, using guest card checkout instead of a buyer login.
   - Score: A1 4 → 5. A5 held at 4, because no video or hosted URL exists yet.
2. **Cut scope and polish fewer screens:** **done.**
   - The QR code, menu edits and renames were cut.
   - The issue codes are down to four.
   - Extraction uses `messages.parse` and the agents use `toolRunner`.
   - There is a type scale, and the AA status colours give 0 axe violations.
   - Score: A2 held at 4. The remaining gap is seller copy and unseen states, not scope, so this round's fix 1 takes a different approach.
3. **Evidence the pain:** **partly done.**
   - `EVIDENCE.md` adds primary sources (PayPal newsroom and dev blog, Census, IJ) and the measured 8–14 s from photo to live shop.
   - No seller quotes were found (5b).
   - Score: A3 3 → 4.

## Top 3 fixes (ranked by Part A gain)

1. **Make the seller copy plain and close the polish gaps (A2 4 → 5; clears the only Part C fail).**
   - In `normalize.ts`, build `issueDetail` from fixed seller sentences per issue: "Printed as 2 for $7. We set $3.50 each. Is that right?". Keep the raw model `note` only under "Notes from the reading", and stop the `join('. ')` "?." bug.
   - Tell the extractor in `prompts.ts` to write notes for a shop owner, with no cents and no method talk.
   - Re-record `samples/marigold-bakehouse.json`.
   - Keep order numbers on one line and move the badge below the header on 390 px order cards.
   - Use curly apostrophes everywhere, and give the shop's connect tabs a scroll cue or let them wrap.
   - Screenshot the six missing async states listed under Part C.
2. **Deploy, then record the video (A5 4 → 5).**
   - Deploy to Render with a persistent disk. This is also a sponsor-prize route.
   - Put the HTTPS URL and a "pay with this test card" box in the README.
   - Verify the webhook end to end on the deployed URL.
   - Show one external MCP client (Claude Code `claude mcp add` or the Inspector) ordering from the live door.
   - Record the under-3-minute video from `DEMO.md`, and cut the guest-card typing to a 3-second jump.
   - Make the repo public before 12 Nov 12:00 PT.
3. **Pay the seller, not Shelfie, and evidence the pain (A3 4 → 5; also B3 and B4).**
   - In the sandbox, onboard each shop's PayPal account at publish with Partner Referrals (`/v2/customer/partner-referrals`).
   - Set `purchase_units[].payee.merchant_id` on its orders, and add tracking with `PayPal-Auth-Assertion`.
   - Keep the single-merchant path as the fallback so the verified capture gate keeps passing.
   - If time is short, at least show the onboarding link and payee in the demo, and say so in the README.
   - Add 2–3 sourced seller voices (forums or interviews) for the DM-order and no-show pain to `EVIDENCE.md` 5b.

## Verdict: **fix**

Part A is 21/25 (above the 20 needed) and Part B is 21/25, but one Part C fail (plain copy) blocks **ship**. That fix is small (fix 1). After it, the build qualifies to ship. Fixes 2 and 3 are the remaining Part A gains before the 12 Nov deadline, and fix 2 includes making the repo public, which the submission requires.
