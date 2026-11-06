# Judge round 7: main 4da78dc (code), after the design reset and review 4

## What I judged

**Artifacts:**
- The spec: §4b (design reset, lines 62–70) and §4c (PWA, lines 72–73). I also used the §4 screen table and §8a/§10a for the regressions I checked.
- `docs/JUDGING.md` with the 6 Nov Part C amendment: 13 banned patterns (a screen with 2 or more fails) and the real-product check.
- Round 6's verdict, used only for its top 3 fixes and its scores.
- `directions-2.md` (Storefront won), for its fix list.
- Screenshots:
  - `screenshots/round-7/`: 87 screens, `axe-results.json` and the README that labels fixture and mocked states. I viewed 47 of them side by side with the references in `.scratch/refs/` (Toast Felipe's 390, Toast Bakey 1440, Square for bakeries 390). The list is in Part C.
  - `screenshots/capture/`: `seller-receipt-paid-1440` and `seller-order-shipped-1440`.
  - `evidence/pwa/`.
- `round-7-tests.txt`, `docs/reviews/2026-11-06-review-4.md`, `docs/ASSETS.md`, `docs/DEMO.md`, `docs/AI_TOOLS.md` row 7, `README.md` and `docs/SUBMISSION.md` (the lines cited below), and the code paths cited below.

I did not read `PROGRESS.md`, `DECISIONS.md`, commit messages or worker notes. `git diff --stat 4da78dc HEAD -- src tests e2e scripts package.json` is empty (HEAD 8d7a033), so the screenshots show the code I ran. Fixture and mocked states are scored as UI only. The money evidence comes from the capture-gate log and my own live calls.

## What I checked myself (about 20 minutes)

**My own production build.** `npm run build` exited 0, including TypeScript.
- I started the server with `DATABASE_PATH=data/judge7.db UPLOADS_DIR=data/judge7-uploads PORT=3127 npm start`.
- Afterwards I stopped it by its PID and deleted `data/judge7*`.

**Tests, run by me:**
- `npm test`: **942 passed in 76 files** (13 s). The log says 947 in 78 files on 5816df1 and review 4 says 957. All pass; the counts differ (see fix 2).
- `npm run lint`: exit 0.
- **PWA test.** `E2E_REUSE_SERVER=1 E2E_PORT=3127 npx playwright test e2e/pwa.spec.ts` against my build gave **1 passed (2.2 s)**: `Page.getInstallabilityErrors` was `[]` in full Chromium.

**Seed (6.9 s).** 9 real Catalog products (`PROD-7V412192RN679683A` and 8 more). It printed "Paid to: the sandbox seller's own PayPal account (s•••@business.example.com…)". The shop shows 10 items with Pexels photos and a cover.

**Payee routing (§8a), live:**
- **Door order.** `initialize` returned "Marigold Bakehouse on Shelfie". `create_order` (2 × almond croissant, pickup) took 2.2 s and returned `awaiting_approval`, $10.00, token `1AM0564539274872R`.
- **PayPal's own record**, compared in a script so no email or key was printed: `PAYER_ACTION_REQUIRED`, $10.00, `invoice_id` SHF-4LEWQS, `sku` `PROD-4JP08206241075607`, and **"payee == PAYPAL_SANDBOX_SELLER_EMAIL: true"**.

**The findable door (§10a), live:**
- `<link rel="alternate" … title="Agent door (MCP)" href="http://localhost:3127/s/marigold-bakehouse/mcp"/>`.
- The JSON-LD is `FoodEstablishment` with an `OrderAction` and `urlTemplate`, and it now carries `image` (the cover URL).
- `/agents.txt` returned 200 `text/plain` and `/llms.txt` returned 200.
- `GET` on the door returned 405.
- `"price": 0.01` returned `INVALID_ARGUMENTS` at `items[0].price`: "`price` is not accepted; prices are set by the shop."
- `list_products` returns an absolute `image_url` for each item (`http://localhost:3127/demo/marigold-bakehouse/country-sourdough-loaf.jpg`).

**Buyer console (round 6's fix 3), live:**
- **Turn 1 (4.8 s).** I sent "Two almond croissants for pickup please. Yes, place it." Claude called `get_shop_info` and `list_products`, then answered: *"Here's your order: 2 × Almond croissant at $5.00 each… They contain nuts… The total is $10.00. Shall I place it? Reply yes to confirm."* It made **no `create_order` call**, and no reasoning text reached the buyer.
- **Turn 2 (5.5 s).** I sent "yes". Claude called `create_order` with ids only (1616 ms), and the console sent an `approval` event, $10.00, order **SHF-G6WXF6**.

**Claude reading a menu, live.** I created a shop from the Marigold sample (owner cookie set). `POST /extract` read it in **9.1 s** and returned the catalog: name, pickup notes and items with `sourceText`.

**Snap your counter, live (new):**
- **The bakery case.** `POST /api/shops/<id>/counter` with `public/samples/counter-case.jpg` took **4.3 s**. It returned 2 proposals: **Butter croissant (high)** and **Almond croissant (medium)**, as 4:3 WebP data URLs. I decoded and viewed both crops. Each is centred on the right pastry: the plain croissants, and the almond-topped one with its icing drizzle.
- **The non-menu photo** (`coffee-and-plant.jpg`, 2.7 s) gave one plausible proposal: Drip coffee (medium).
- **Without the owner cookie** the route returned 404.

**Item photos, live (new):**
- `POST /api/shops/<id>/items/<itemId>/photo` with a JPEG returned `{"photoUrl":"/i/img_….webp"}`.
- `GET` on that URL returned 200 `image/webp`, 1200 × 900, with **no EXIF and no ICC** (read with `sharp`).
- A text file returned **415 `BAD_IMAGE`** "We couldn't open that photo. Try a JPG or PNG." Without the cookie it returned 404.

**PWA, live:**
- `/manifest.webmanifest` has name and short name Shelfie, `start_url` `/`, `display: standalone`, theme and background `#ffffff`, and 192, 512 and maskable 512 icons. All three icons return 200 `image/png`.
- The page has `theme-color`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` and an `apple-touch-icon` (180 px).
- There is no `sw.js`.

**Review 4 fixes, spot-checked in code and tests:**
- **#4 (counter boxes in Claude's image space):** `src/lib/catalog/counter.ts:28–32` (`CLAUDE_MAX_EDGE = 1568`, `CLAUDE_MAX_PIXELS`, `claudeSize`). Tested in `tests/catalog/counter.test.ts:42–56`, and live: my crops are not shifted.
- **#2 (late counter answer dropped):** `src/components/dashboard/menu/CounterSnap.tsx:41,49,54,57` (a run number in a ref; only the current run's answer or error lands). Tested in `e2e/menu-tab.spec.ts:89`.
- **#8 (" · PayPal" only when taking orders):** `src/components/shop/ShopAssistant.tsx:144`. Tested in `tests/components/shop-assistant.test.ts:13–17`.
- **#10 (unique section ids):** `src/components/shop/Menu.tsx:25` (`section-<slug>-<index>`). Tested in `tests/shop/menu-section-id.test.ts:7` ("Coffee & Tea", "Coffee/Tea").

**Tokens.** `grep` for hex colours in `src/components` and `src/app` `.tsx` finds only `#fff` in `Logo.tsx`. There are 3 arbitrary `[3px]`/`[4px]` values. `globals.css` defines 204 custom properties, and the retired fonts (Playfair, Plex) are gone from `src/`.

**axe.** I parsed `axe-results.json` myself: **87 entries, 0 violations**.

**Repo.** `gh repo view --json visibility,licenseInfo` asks for `gh auth login` on this VM. `curl https://api.github.com/repos/codebreaker32/paypal-ai` returns **404**, so the repo is **not public**.

**Deploy, video, submission:**
- `README.md:135` still says "**Not yet run.**"
- `SUBMISSION.md:86–88` still has three **TODO**s.
- A clip recorder is running on this VM, so the video is in progress. There is no video to score.

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** (held) | **PayPal, live today:** Catalog Products (9 at seed), and Orders v2 with SKU, invoice id and **the seller as `payee` on PayPal's own record** (SHF-4LEWQS). **From the capture gate** (`round-7-tests.txt`): captures COMPLETED to the seller (`44T5337155168454R`) and to the platform (`3VY66713JT6351145`, with a USPS tracker at PayPal), plus the Agent Toolkit brief on both. **AI, live today:** menu reading (9.1 s), the tool-running console with the read-back now enforced in code, and new vision work in the core flow. **Snap your counter** turns one display-case photo into item photos: Claude returns ids and pixel boxes in a size it won't rescale (`counter.ts:28–32`), and the server crops them. I viewed the crops and they are right. Already at 5. |
| A2 Design | **5** (held) | **The reset is real.** Put next to Toast and Square, the shop is a photo-first storefront: a cover with the shop mark over it, phone rows with thumbnails, a 2-up card grid with a sticky order card at 1440, and a sticky "Order with an assistant · PayPal" bar (`shop-first-screen-390`, `shop-1440`). The dashboard is an operations list: thumbnails, filters with counts, a dot and a word for status, and an AI brief inline (`dashboard-orders-1440`). The Menu tab is photo-first (`dashboard-menu-1440`). **Every state is on screen:** 87 screens, 0 axe violations, and the designed fallback tile (`shop-no-photos-*`). Rough edges are small: the counter sheet's reading, none-found and error states exist in code (`CounterSnap.tsx:14,113,118`) but aren't screenshotted, and the real-sandbox screenshots are still in the retired design (fix 2). |
| A3 Potential impact | **5** (held) | The money goes to the seller (PayPal's record, live), and the UNILATERAL hold and tracking refusal are handled (`order-payment-held-390`). The photos answer the obvious buyer objection to a chalkboard shop ("what does it look like?"). They cost the seller one photo of the case, not ten (snap your counter, live). Audience and sourced pain are unchanged. |
| A4 Innovation | **5** (held) | The door is findable: JSON-LD `OrderAction`, `rel="alternate"` and `/llms.txt`, all live, plus the outside-client transcript. Snap your counter, where Claude matches a display-case photo to the shop's own menu ids and proposes per-item crops, is a fresh use of vision I haven't seen in seller tools. |
| A5 Presentation readiness | **4** (held) | **Demoable and fast**, measured today: seed 6.9 s, reading 9.1 s, counter 4.3 s, console turns 4.8 s and 5.5 s, and the price tamper is refused instantly. `DEMO.md:25–35` now adds the counter shot (0:33–0:43), timed to 2:50. **Why it doesn't move (sixth round):** there is no video, no deploy (`README.md:135`) and no public repo (GitHub API 404), and `SUBMISSION.md:86–88` still has its TODOs. **What moves it:** fix 1. |
| **Total** | **24/25** (round 6: 24) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **5** (held) | "Snap your price list; any AI assistant can order from you, and you're paid on PayPal." The counter card and the photo storefront make the one sentence visible. |
| B2 Implementation | **5** (held) | **Tests:** 942 unit tests passed and lint 0 (both run by me), the build and typecheck exited 0, and the PWA e2e passed on my build. **Full e2e:** 160 passed and 3 skipped on an idle VM, with both capture gates against the real sandbox (`round-7-tests.txt`). That run is on 5816df1, before review 4's 10 fixes (fix 2). **Review 4:** the 4 fixes I spot-checked are in the code with tests, and #4 also held live. The `settle()` timeout is fixed (`e2e/helpers.ts:28`). |
| B3 Depth | **5** (held) | **Messiness handled:** the upload decoder is shared, photos are WebP with metadata stripped, and bad images get a 415. Counter proposals are limited to known ids, with low confidence and tiny boxes dropped (`AI_TOOLS.md` row 7). The read-back is enforced in code, not trusted to the prompt (`buyer-console.ts:172,287`). No service worker caches payment pages (§4c). The path to scale is unchanged. |
| B4 Usefulness | **4** (held) | A seller gets a real-looking shop, photos from one snap, a phone app icon and payouts to their own PayPal. **What holds it:** no hosted instance, so no real seller can use it this week (`README.md:135`). *Fix:* fix 1. |
| B5 Innovation | **5** (held) | Same as A4. |
| **Total** | **24/25** (round 6: 24) | |

## Part C

**Screens I viewed** (round-7 set, side by side with the references):
- `start` and `start-photos-ready`, `start-bad-file`;
- `shop`, `shop-first-screen`, `shop-no-photos`;
- the setup screens: `setup-review`, `setup-reading`, `setup-publishing`, `setup-live`, `setup-failed`, `setup-retake`, `review-paypal-email`;
- the dashboard screens: `dashboard-orders`, `dashboard-menu`, `dashboard-menu-counter`, `dashboard-share`, `dashboard-settings`, `dashboard-empty`, `dashboard-loading`, `dashboard-paypal-unreachable`;
- the order screens: `order-paid-with-brief`, `order-shipped-with-tracking`, `order-payment-held`;
- the console screens: `console-empty`, `console-conversation`, `console-error`;
- the receipts: `receipt-paid`, `receipt-capture-refused`;
- `counter-card`.

Most were viewed at both widths. The rest are covered by the same components and the axe file.

**Banned 2026 patterns, per screen** (2 or more fails a screen):

| Screen | Patterns found | Count |
|---|---|---|
| start (390, 1440) | none: white page, Figtree, black primary, one helper line | 0 |
| shop, shop-first-screen, shop-no-photos | none. The 1440 item cards have a light ring, but the header, tabs and sections are not boxed. Prices are Figtree, not mono. | 0 |
| setup-review (390, 1440) | **a small grey sentence under almost every block**: "Tap your photo to compare…", "Fix these, or leave them…", "Each becomes a product in your PayPal catalog.", "Headings, hours and notes that aren't things to buy.", "Your counter, your window or your best tray", "Buyers pay straight into this PayPal account…", "Changes save as you go". The flagged cards are outlined; the ready list and the shop fields aren't. | 1 |
| setup-live | **a grey sentence under each block** (agent door, See it work, owner link). The owner link is mono, but it is a URL, not a price. | 1 |
| dashboard-share | **a grey sentence under each of the 3 headings** | 1 |
| order-paid-with-brief, order-shipped-with-tracking | **grey explainer lines**: "Claude, from PayPal's record. Check before acting.", "Ship it, then add tracking…", the demo-account footnote. Allergy and Timing are two tinted request tags, not status chips everywhere. Status is a dot and a word. | 1 |
| dashboard-orders, dashboard-menu, dashboard-menu-counter, settings, empty, loading, unreachable | none. Status is a dot and a word, the rows are divided rather than boxed, and the filters are tinted pills. | 0 |
| setup-reading, publishing, failed, retake, review-paypal-email | none | 0 |
| console (empty, conversation, error) | none. The starter prompts are tinted fills, and the mono text is tool names in the Activity panel. | 0 |
| receipts (paid, capture-refused) | none. No stamp, no zig-zag edge, prices in Figtree. | 0 |
| counter-card | none. The cover strip, shop name, QR and the new mark. | 0 |

**Not counted, but stale:** `screenshots/capture/` (files dated 08:50–08:52, before the reset) still shows the retired Menu-board design.
- `seller-receipt-paid-1440` has 7 banned patterns: cream page, Playfair serif display, mustard button, tag-icon logo, mono prices, zig-zag receipt edge and a PAID stamp.
- `seller-order-shipped-1440` has 6.
- The current code can't render them (no Playfair or Plex in `src/`; `globals.css:238–241` is Figtree plus a system mono). So I judge them as stale evidence, not as product screens. They are the only real-sandbox screenshots on file (fix 2).

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One black fill per screen: **Snap your price list** (`start-390`), **Order with an assistant · PayPal** (`shop-first-screen-390`), **Copy agent door link** (`setup-live-390`, `dashboard-share-390`), **Add tracking** per paid order (`dashboard-orders-390`), **Send tracking to PayPal** (`order-paid-with-brief-1440`), **Print card** (`counter-card-1440`). PayPal's blue is used only on **Approve $27.00 on PayPal**. |
| Loading, success, empty and error states | **Pass** | Reading, publishing, publish-retry, failed and retake. Console empty, thinking, error and rate-limited. Dashboard loading, empty and PayPal-unreachable. Brief-writing and tracking-error. Receipts for every state. The empty filters say "Nothing waiting for payment." (review 4 #3). Snap your counter has reading, none-found and error in code (`CounterSnap.tsx:14,113,118`); only its proposals state is screenshotted, and that one is mocked. |
| WCAG AA contrast, keyboard, visible focus, alt text | **Pass** | `axe-results.json`: 87 screens, **0 violations** (parsed by me). On the live shop, 11 of 12 `<img>` have alt text, and the twelfth is the decorative cover with `alt=""`. |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass** | The screenshot spec's overflow check passed on all 87. The filter pills are now full height (`dashboard-orders-390`; directions-2 fix 4). The bars and buttons are full width at 390. |
| Copy is plain and specific, no jargon, no placeholders | **Pass** | "This doesn't look like a price list. Your photos are saved.", "Printed as “2 for $7”. We set $3.50 each. Is that right?", "PayPal didn't complete the payment… nothing was charged." The leaked console reasoning from round 6 is gone (live, above). |
| No generic AI look | **Pass** | White, near-black and one pomegranate accent (`#c21a4b`) on the mark, the tabs and the counts. No gradient, glass or emoji. |
| No empty hero, no three identical feature cards | **Pass** | Start shows a real shop in action (a phone with the Marigold shop and a "Ready to pay" card) beside one action. |
| No lorem or fake stats | **Pass** | Real Pexels photos, each credited with its page and photographer (`docs/ASSETS.md`, 14 links). Fixtures are labelled in the README. |
| Deliberate type, palette and spacing | **Pass** | One family (Figtree, `geometricPrecision`) in a heavy display weight with a light body, a system mono only for ids, tool names and URLs, and one accent. The spec chose one modern sans on purpose (§4b). |
| Banned 2026 patterns (2+ on a screen fails) | **Pass** | No screen has more than 1 (table above). The one that recurs is grey explainer lines, on 4 screens. A second pattern on any of them would fail it. |
| Real-product check | **Pass** | Next to the references, a designer would take each viewed screen for a real product. Shop 390 and 1440 read like Toast's store page and DoorDash item rows. The dashboard reads like a Square or Toast order list. Setup reads like Square onboarding. The receipt and order detail read like a commerce app. The weakest is `shop-no-photos`: a wall of pastel two-letter tiles is passable as a placeholder state, but it's the screen most likely to look generated. |
| Tokens defined once and used everywhere | **Pass** | 204 custom properties in `globals.css`. No hex colours in components except `#fff` in the logo, and 3 arbitrary px values. |
| Type scale and line length | **Pass** | Display, title, body and meta sizes are consistent on every screen. The body column is held to about 480 px on setup and receipts. |
| Consistent components, subtle motion | **Pass** | The same row, dot-status, tinted-pill and sheet shapes on the shop, dashboard, setup and console. Motion is the progress bar and spinners, under reduced motion in the shots. |

**Part C: 0 fails** (round 6: 0, under the old Part C; this is the first round under the amended Part C).

**Directions-2's fix list (Storefront), checked against the round-7 shots:**
- **1. Done:** the order detail is on a sunken panel with no ring, and the paste hint and "From PayPal" labels are gone.
- **2. Done:** the wordmark and body text have no broken spacing, and the mark is a viewfinder framing a loaf.
- **3. Done:** the header and content start at the same x at 1440.
- **4. Done:** the time sits in its own column, the pills are 44 px and there is no floating badge.
- **5. Done:** the console intro is one sentence, with tinted prompts.
- **6. Done:** "Ready to pay" is in one line. It still overlaps the phone's edge, but the phone's bar is visible.
- **7. Done:** the avatar sits over the cover, "PayPal" is on the bar, and "Connect your own assistant" is collapsed.
- **8. Done:** no stamp, the Menu tab has thumbnails, and the order items have thumbnails.

All 6 take-from-loser items are in, except take 2 (the sidebar shell). That was offered as an alternative to fix 3, which was done instead.

## Round 6's top 3 fixes

1. **Publish, deploy and record: not done.**
   - The repo is not public (GitHub API 404).
   - `README.md:135` "Not yet run."
   - `SUBMISSION.md:86–88` TODOs.
   - No video; the clip recorder is running.
   - **A5 held at 4, B4 held at 4.** This is the sixth round without it, and the same approach (listing it as fix 1) has not worked. A different approach is in fix 1 below.
2. **Clean full e2e run and a robust `settle()`: done.**
   - `e2e/helpers.ts:28` caps `networkidle` at 10 s and waits for load, fonts and images.
   - An idle-VM run gave 160 passed and 3 skipped (`round-7-tests.txt`).
   - **No score moved** (it protects B2 at 5). The run is on 5816df1, not on the final 4da78dc.
3. **Enforce the read-back and stop streaming reasoning: done**, verified live.
   - Code: `buyer-console.ts:172` and `readBackRefusal` at `:287`, which returns `READ_BACK_FIRST`. `lastAnswer` at `:324` ignores text from a message that called a tool.
   - Tested at `tests/agent/buyer-console.test.ts:537,562`.
   - My "…Yes, place it." got a read-back with the total and "Shall I place it?" with no order, and no reasoning was shown. "yes" then placed SHF-G6WXF6.
   - **No score moved** (A2 was already 5). The `DEMO.md` 1:08 wow shot is now safe.

## Top 3 fixes (ranked by Part A gain)

1. **Publish, deploy and record (A5 4 → 5, B4 4 → 5; without it the entry fails Stage One).** Due 12 Nov 2026, 12:00 PT, 6 days away.
   - **Change of approach:** this is blocked on the human's accounts, not on code, so stop listing it as worker work. The coordinator hands the human one 20-minute checklist today and holds other rounds until it's done:
     1. `gh auth login`. Run a secret scan (`git log -p | grep -iE 'secret|sk-ant|client_secret'` on the full history). Make the repo public. Confirm `gh repo view --json visibility,licenseInfo` shows `PUBLIC` and `mit`.
     2. Create the Render service from `render.yaml` with the env vars, including `PAYPAL_SANDBOX_SELLER_EMAIL`. Run `npm run seed` in its shell and register the webhook.
     3. From this VM, curl the hosted `/s/marigold-bakehouse` for `rel="alternate"` and `/llms.txt` for the https door.
   - **Docs:** replace `README.md:135` with the URL and the date it was verified, and fill in `SUBMISSION.md:86–88`.
   - **Video:** cut the clips into the `DEMO.md` cut (≤ 2:50) and post it public on YouTube.
2. **Re-shoot the real-sandbox evidence in the new design, and re-run the full e2e on the final commit (protects A1, A2 and A5; no new Part A points).**
   - `docs/judge/screenshots/capture/` is the only real-money proof on screen, and it shows the retired design: 7 banned patterns on `seller-receipt-paid-1440`. A judge who opens it sees a different product from the video.
   - Run `SHELFIE_SCREENSHOTS=1 npx playwright test e2e/capture.spec.ts` (it writes to `docs/judge/screenshots/capture`, `capture.spec.ts:55–57`) on 4da78dc or later, once the recorder is idle.
   - In the same window, run `npm run e2e` and record the unit count you get. I got 942 in 76 files; the docs say 947 and 957.
3. **README screenshots, the counter's states, and fewer grey lines (protects A2 and A5).**
   - **README:** it has no images at all (`grep png README.md` is empty). Add 4 from `round-7/` (`shop-first-screen-390`, `shop-1440`, `dashboard-orders-1440`, `console-conversation-1440`) under the opening paragraph. Judges read the README before running anything.
   - **Counter states:** screenshot the counter sheet's *Finding your items…*, "We couldn't match any items. Try a closer photo." and its error state. Add one shot taken from a real Claude answer, not mocked.
   - **Grey lines:** cut about half of them on `setup-review`, `setup-live` and `dashboard-share`. Drop "Changes save as you go", "Each becomes a product in your PayPal catalog." and the Share sub-lines, because the headings already say it. Grey explainer lines are the one banned pattern that recurs, and they are one pattern away from a fail on 4 screens.

## Verdict: **ship**

Part A is **24/25** and Part B is **24/25** (both held), with **0 Part C fails** under the amended Part C. The rubric's ship bar (no Part C fails and Part A ≥ 20) is met.

The design reset worked. Next to the Toast and Square references, every screen I viewed reads as a real product, and none has more than one of the 13 banned patterns. The new work runs live on my build:
- snap your counter, with correctly centred crops in 4.3 s;
- item photos, as WebP with metadata stripped;
- an installable PWA (the Chromium installability check passed against my build).

Every earlier feature still works live: the seller as payee on PayPal's record, the findable door, price tamper refused, and the console, whose read-back is now enforced in code.

"Ship" here is a rubric verdict, not a submission. The entry would still fail Stage One today: the repo is not public and there is no video. Fix 1 is due before 12 Nov 2026, 12:00 PT.
