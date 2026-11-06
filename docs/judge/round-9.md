# Judge round 9: main 5f7a853, images instead of stand-ins, purposeful motion, colour roles

## What I judged

**Artifacts:**
- The rubric `docs/JUDGING.md` with its three Part C amendments: the 13 banned "warm editorial" patterns, the real-product check against `.scratch/refs/`, and "Images, not stand-ins".
- Round 8's verdict, used only for its top 3 fixes and its scores.
- `screenshots/round-9/`: 96 screens at 390 and 1440, `axe-results.json`, and the README that labels fixture and mocked states. These were taken on bbf7db3. Since then, `git diff --stat bbf7db3 HEAD -- src` is empty: only `scripts/clips/record.ts` and `video/` changed. So the screens show the current UI.
- `screenshots/capture/` (13 files, re-shot by the e2e run in `round-9-tests.txt`), `evidence/illustrations.png`, `docs/reviews/2026-11-06-review-5.md`.
- **The 6 motion recordings** in `recordings/round-9/`. ffprobe: all are 25 fps. `start` is 24.2 s at 1440 and 21.8 s at 390; `shop` is 27.2 s and 20.8 s; `dashboard` is 23.2 s and 23.0 s. I made a 1 fps contact sheet of each one. I also pulled 4 full-resolution mid-animation frames of the start hero (2.6, 3.3, 5.4 and 8.2 s) and a 5 fps burst of `dashboard-390` at 5.4–8.4 s, when the new paid order arrives. All are in `/tmp/judge9/`.
- The reference screenshots (`toast-bakeybabka-1440`, `toast-felipes-390`, `square-bakery-390`, side by side).
- Code paths cited below.

I did not read `PROGRESS.md`, `DECISIONS.md`, commit messages or worker notes.

## What I checked myself

**Build and unit tests.** `npm run build` on HEAD exited 0, including TypeScript. `npm test` gave **1038 passed in 87 files**, exit 0. `round-9-tests.txt` records 1011 on 1e3f998; the difference is the tests that review 5's fixes added.

**Live server.** I ran a production build with `DATABASE_PATH=data/judge9.db UPLOADS_DIR=data/judge9-uploads` on port 3129. `/api/health` returned `{"ok":true}`.

**Seed.** It took 5.3 s and exited 0, with "Marigold Bakehouse is live: 9 items in the PayPal sandbox catalog". It is paid to the sandbox seller's own account (`s•••@business.example.com`). I filtered the owner link out of my output.

**The agent door, live:**
- `tools/list` returned `get_shop_info`, `list_products`, `create_order` and `get_order_status`.
- `list_products {"query":"croissant"}` returned absolute `image_url`s.
- My first two `create_order` calls had the wrong shape, and both were refused with a precise fix. One said "`name` is not a recognised argument", with the hint "Send items: [{ item_id, option_id?, quantity }]…". The other said "`fulfillment`: Expected 'pickup' | 'shipping', received object".
- The corrected call took **1.32 s** and returned **SHF-EVBPB2**, `awaiting_approval`, total 8.50, with a `sandbox.paypal.com` approval link.

**Motion and layout, live with Playwright on my production build** (script in `/tmp/judge9/pw/check.cjs`):
- **Reduced motion on the start page.** With `reducedMotion: 'reduce'`, the hero at 400 ms already shows the final state: the shop, the "Paid" card with **Paid with PayPal**, and the "Payment received" toast. It has **0 elements with opacity between 0 and 1**. Without reduced motion, the same moment shows the paper menu in the viewfinder (`/tmp/judge9/start-rm-compare.png`).
- **Reduced motion on the shop at 390.** After load, **0** sections, list items or headings have opacity below 1, so nothing waits for a scroll.
- **Phone width.** `scrollWidth` is 390 at a 390 viewport.
- **Shop picture.** The only avatar is `data-avatar="cover"`, a detail of the cover, not letters.
- **Section jumps on a phone (fix 2).** I clicked each category tab at 390 with motion on and waited 1.2 s:
  - Breads, Pastries and Cakes each land their heading at **top 64 px**, below the 48 px sticky tabs.
  - Coffee, the last section, lands at 373 px.
  - In every case, `elementFromPoint` on the heading returns the heading itself.
  - The "Order with an assistant" bar sits at 682–844 px, far from the heading.

**axe.** I parsed `round-9/axe-results.json` myself: **96 entries, 0 violations**.

**Repo.** `curl -s -o /dev/null -w '%{http_code}' https://api.github.com/repos/codebreaker32/paypal-ai` returned **404**.

I stopped my server by PID and deleted `data/judge9*`.

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** (held) | **PayPal, live today:** Catalog Products (9 at seed) and Orders v2 through the door (SHF-EVBPB2 in 1.32 s, with a sandbox approval link). **Real captures in this round's suite** (`round-9-tests.txt:6–19`): seller capture `4Y6205416F379294M` COMPLETED with "payee = PAYPAL_SANDBOX_SELLER_EMAIL"; platform capture `44864743LF213222D` COMPLETED with a USPS tracker at PayPal; the Agent Toolkit brief flagging the nut allergy on both. **New AI work in the core flow:** Claude chooses each item's category while it reads the menu, and that category picks the drawing (`src/lib/domain/category.ts`, `src/lib/ai/prompts.ts`; drawings in `evidence/illustrations.png`). |
| A2 Design | **5** (held) | **The human's feedback is visibly delivered:** <br>• **Images:** every picture slot is a photo or a drawing. `shop-no-photos-390` shows the bread, croissant, cake and coffee drawings on section tints, with the menu photo as the avatar. `setup-review-390` shows the focaccia drawing. Dashboard rows show item photos (`dashboard-orders-1440`). The recording's Juniper Loaf Co has a bread-drawing avatar. <br>• **Colour roles:** errors are vermilion (`dashboard-settings-invalid-390`, `receipt-capture-refused-390`). The brief is a slate note with an amber warning (`order-paid-with-brief-1440`). <br>• **Lively:** see the motion section below. <br>The whole set is still coherent: 96 screens, axe 0. |
| A3 Potential impact | **5** (held) | Unchanged and still shown: payment into the seller's own account (seed line above; capture gate seller run). |
| A4 Innovation | **5** (held) | A findable agent door, plus two vision uses (menu reading, snap your counter). The start hero now tells the agentic-commerce story without words: paper menu → live shop → an order card → **Approve $27.00 on PayPal** → Paid (`start-1440.webm` at 0–9 s). |
| A5 Presentation readiness | **4** (held, eighth round) | **What improved:** the product itself demos better. The start hero is a 9-second animated pitch, the console order counts up to $27.00 (`shop-1440.webm` at 15 s), and a paid order arrives with a toast and a highlighted row (`dashboard-1440.webm` at 8–9 s). <br>**Why it doesn't move:** there is still no video. `video/out/` holds only `voices/` and no `shelfie-demo.mp4`. The repo is not public (404), `README.md:143` says "**Not yet run.**", and `SUBMISSION.md:86–88` still has 3 TODOs. A5 asks whether the video makes the problem, audience and stakes clear, and that can't be seen until it exists. <br>**What moves it:** fix 1. |
| **Total** | **24/25** (round 8: 24) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **5** (held) | "Your price list, open to AI shoppers." The start hero now acts it out in one loop (`start-1440.png`). |
| B2 Implementation | **5** (held) | **Run by me:** build 0 and 1038 unit tests passed on HEAD. **Full e2e:** 182 passed and 9 skipped, with both real capture gates (`round-9-tests.txt:20–21`). Review 5 found and fixed motion and avatar bugs, e.g. "`restored` is never cleared on reset" (`docs/reviews/2026-11-06-review-5.md` #4). The gap is the same kind as last round: that e2e ran on 1e3f998, and review 5's fixes touched **36 src files** after it (`git diff --stat 1e3f998 HEAD -- src`). See fix 3. |
| B3 Depth | **5** (held) | The fallback chains handle messy real shops: logo → cover → menu photo → drawing (`src/lib/domain/avatar.ts:29–44`), and a services shop gets bike and tool drawings, not plates (review 5 #2). Reduced motion is honoured, including after load (`use-prefers-reduced-motion.ts`). A failed motion chunk falls back to motion off (review 5 #1). |
| B4 Usefulness | **4** (held) | No hosted instance (`README.md:143`), so no seller can use it this week. *Fix:* fix 2. |
| B5 Innovation | **5** (held) | Same as A4. |
| **Total** | **24/25** (round 8: 24) | |

## Part C

**Screens I viewed.** Each was set beside the Toast and Square references:
- `start-390/1440`
- `shop-first-screen-390`, `shop-1440`, `shop-no-photos-390`
- `dashboard-orders-390/1440`, `order-paid-with-brief-390/1440`
- `setup-review-390`, `setup-failed-390`, `setup-live-390` (full height)
- `receipt-paid-390`, `receipt-capture-refused-390`
- `console-conversation-390`, `dashboard-settings-invalid-390`
- every frame of the 6 contact sheets

**Banned 2026 patterns, per screen** (2 or more fails a screen):

| Screen | Patterns found | Count |
|---|---|---|
| start (390, 1440, and the hero frames) | none. White page, Figtree, a black primary button, floating cards with soft shadows (not hairlines), and one grey line under the button. | 0 |
| shop, shop-first-screen, shop-no-photos | none. The 1440 item tiles have a light border, as Toast's own item cards do (`toast-bakeybabka-1440`). There is no dotted leader, mono price or chip. | 0 |
| dashboard-orders (390, 1440), dashboard recordings | none. Status is a dot plus a word ("● Paid", "⊗ PayPal refused payment"), not a boxed chip. | 0 |
| order-paid-with-brief (390, 1440) | **an icon on most labels** inside the brief card: sparkle on "AI brief by Claude", warning, info, shield on "Allergy", speech bubble on "Buyer's note", envelope on the email. Round 8's grey line "Check before acting" is gone (no match in `src/`). | 1 |
| setup-review, setup-live, setup-failed | none | 0 |
| receipt-paid, receipt-capture-refused | none | 0 |
| console-conversation | none. Mono appears only on tool names (`create_order`), not prices. | 0 |
| dashboard-settings-invalid | none | 0 |

The maximum is 1, on one screen. No screen fails.

**Per screen: text stand-ins for an image.** **None found.**
- **Shop avatar:** a cover detail on `shop-first-screen-390` and `shop-1440` (live: `data-avatar="cover"`), and the menu photo on `shop-no-photos-390` and `setup-live-390`.
- **Juniper Loaf Co:** the bread drawing in the dashboard recordings.
- **Items with no photo:** category drawings (`shop-no-photos-390`, `setup-review-390`).
- **Code:** `ShopAvatar` has no letter branch (`src/components/shop/ShopAvatar.tsx:33–60`).
- **The "Mb" badge (fix 4) is gone.** `shop-first-screen-390` shows a cover-detail square overlapping the cover's bottom edge, clear of item 1. The empty "Your logo" slot in Settings is an add-image upload control, not a stand-in.

**Real-product check.** **Pass on every viewed screen.**
- **Shop:** the 1440 page has the same anatomy as Toast Local's Bakey page (cover band, name, meta line, a primary "Order" action, photo tiles). At 390, the price now sits right under the name, as on `toast-felipes-390`.
- **Dashboard:** a Square/Toast-style order list.
- **Order detail:** an operations app's detail with a side form.
- **Start page:** reads as a product landing page, not a template. The Square for bakeries reference uses a serif headline; Shelfie doesn't.

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One black fill per screen: **Snap your price list** (`start`), **Order with an assistant · PayPal** (`shop-first-screen-390`), **Copy agent door link** (`setup-live-390`), **Try again** (`setup-failed-390`), **Back to shop** (`receipt-capture-refused-390`), **Save** (`dashboard-settings-invalid-390`). The console's primary is PayPal's own blue **Approve $27.00 on PayPal**. |
| Loading, success, empty and error states | **Pass** | Every state from round 8 is still screenshotted. New this round: a shimmer on the shop cover before the image (`shop-1440.webm` at 1 s, a grey block, then the photo at 2 s), and "Writing the brief…" with a spinner on fresh paid rows (`dashboard-390.webm`). |
| WCAG AA contrast, keyboard, visible focus, alt text | **Pass** | `axe-results.json`: 96 screens, **0 violations** (parsed by me). Avatars are `alt=""` `aria-hidden` beside the shop name (`ShopAvatar.tsx:44–56`). |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass** | Live `scrollWidth` is 390 at 390. The 390 buttons are full-height pills. |
| Copy is plain and specific | **Pass** | "Reading took too long. Long menus sometimes do. Try again." "Enter the email you use to log in to PayPal, like rosa@example.com." "You approved it, but PayPal refused to complete the payment, so nothing was charged." |
| No generic AI look | **Pass** | No gradient, glass, glow or emoji. **Fix 1 is done:** pomegranate is the accent only (active tab underline, logo, count badge), errors are vermilion, and the AI brief is a slate note. |
| No empty hero, no three identical feature cards | **Pass** | The start hero is the product acting out its own story, not a slogan block. |
| No lorem or fake stats | **Pass** | Credited Pexels photos and labelled fixtures. Numbers in the capture gate are real sandbox ids. |
| Deliberate type, palette and spacing | **Pass** | Figtree in a heavy display weight with a light body, one accent, separate error and note roles, and the 13 drawings in one line-and-flat style on four tints (`illustrations.png`). |
| Banned 2026 patterns (2+ on a screen fails) | **Pass** | Max 1, on 1 screen (table above). |
| Images, not stand-ins | **Pass** | None found (above). |
| Real-product check | **Pass** | Above. |
| Tokens defined once and used everywhere | **Pass** | Colour roles in `src/app/globals.css`. Motion durations live in one module (`src/components/motion/tokens.ts`). |
| Type scale and line length | **Pass** | The same display, title, body and meta sizes across the new states. |
| Consistent components, purposeful and subtle motion | **Pass** | See the motion section. |

### Motion (from the recordings and my live build)

- **Purposeful: pass.**
  - **Start hero** (`start-1440.webm`). It plays once in about 9 s, then holds:
    - 0–2 s: the paper menu in a camera viewfinder;
    - 3 s: it cross-fades into the live shop;
    - 4 s: the items and the order bar;
    - 5–7 s: a "Ready to pay" card fills line by line;
    - 8 s: **Approve $27.00 on PayPal**;
    - 9 s: **Paid with PayPal**, and "Payment received SHF-K7F2QX · $27.00" slides in.
    The story reads.
  - **Shop.** Sections rise in as they enter the viewport. Tab jumps smooth-scroll to the heading. Console entries stagger in, and the approval card's total counts up ($26.98 at 15 s → $27.00).
  - **Dashboard** (`dashboard-1440.webm` at 8–9 s). A paid order slides in as a toast ("New paid order SHF-FQY387 · $17.00 · Open"), its row is tinted green, the Orders badge goes 3 → 4, and "Paid" counts $54.00 → $59.52 → $70.43 → $71.00 (390 burst, 6.4–7.0 s).
- **Smooth, no reflow: pass, with two small blemishes:**
  1. **On a phone the toast covers the row it announces.** In `dashboard-390.webm` at 8–13 s, the new SHF-YBPVH7 row's green tint peeks above a 90 px black toast that sits on it.
  2. **The "Ready to pay" card appears as an empty white box** for about half a second before its lines fill (`start-1440` frame at 5.4 s).

  A new row pushing the list down is a real content change, not jank. Nothing else jumps.

  The recordings were made on a dev server: Next's "N" indicator shows in the bottom-left of every frame. My reduced-motion and section-jump checks ran on a production build.
- **Not distracting: pass.** The hero runs once and stops, and nothing loops. Motion is transform and opacity only (spec'd in `CLAUDE.md`, and nothing else moves in the frames).
- **Reduced motion respected: pass, verified live.** Under reduce, the start page shows its final state at 400 ms with 0 translucent elements, and the shop has 0 hidden sections after load.

**Part C: 0 fails** (round 8: 0).

### The human's four fixes

| Fix | Done? | Evidence |
|---|---|---|
| 1. The accent is not the error colour; the brief and allergy read as notes | **Done** | Vermilion errors in `dashboard-settings-invalid-390` and `receipt-capture-refused-390`. Slate brief card with an amber warning in `order-paid-with-brief-390`. |
| 2. Phone price close to the name; the sticky bar doesn't cover a heading after a jump | **Done** | Price directly under the name (`shop-first-screen-390`, `shop-no-photos-390`). Headings land at 64 px under the 48 px tabs, with the bar at 682+ px (my live check). |
| 3. No text clipped behind the floating "Ready to pay" card | **Done** | At 1440 the Paid card overlaps only the phone's empty lower area (`start-1440.png`; frames at 5.4 and 8.2 s). At 390 the card sits below the item rows (`start-390.png`). |
| 4. The "Mb" badge is gone | **Done** | The avatar is a cover detail (`shop-first-screen-390`; live `data-avatar="cover"`). |

## Round 8's top 3 fixes

1. **Cut the video, publish it, make the repo public: not done.**
   - The pipeline exists (`video/remotion`, `video/project/demo.json`, `video/shelfie-demo.srt`), but there is no `video/out/shelfie-demo.mp4`.
   - The GitHub API returns 404, and `SUBMISSION.md:86–88` still has 3 TODOs.
   - **A5 held at 4.** The brief says the video comes after this round.
2. **Deploy to Render: not done.** `README.md:143` still says "Not yet run." **B4 held at 4.**
3. **Freeze the code and prove the final commit: partly done. No score moved; it protects A1, A2 and B2.**
   - **Done:**
     - the grey line "Check before acting" is cut (no match in `src/`);
     - the owner link is masked in `setup-live-390` (`/claim/••••••••`);
     - `README.md:13` was repointed at `round-8/`, which is now one round stale.
   - **Not done:** the full e2e ran on 1e3f998, 36 src files before HEAD.

## Top 3 fixes (ranked by Part A gain)

1. **Render, publish and submit the video, and make the repo public (A5 4 → 5; without these the entry fails Stage One).** Due 12 Nov 2026, 12:00 PT.
   - Run `cd video/remotion && npm run voice && npm run render`, check the cut is under 3:00, and upload it public on YouTube.
   - **Open on the start hero.** Its 9-second paper menu → shop → Approve on PayPal → Paid loop is now the best "what is this" shot in the product.
   - Then make the repo public after a history secret scan, confirm the API returns 200 and the licence shows in About, and fill `SUBMISSION.md:86–88`.
2. **Deploy to Render (B4 4 → 5; also helps A5).** Follow `docs/DEPLOY.md`, seed in the service shell, register the webhook, and replace `README.md:143` with the URL and the date it was verified.
3. **Polish what this round added, and prove the final commit (protects A2 and B2; a coder can do all of it in this repo):**
   - **Dashboard at 390:** stop the new-order toast from covering the row it announces (`dashboard-390.webm` at 8–13 s). Lift it above the row, or scroll the highlighted row into view.
   - **Start hero:** make the "an AI assistant orders" beat visible. Show a one-line chat bubble ("2 almond croissants and a sourdough, shipped") on the "Ready to pay" card before its lines, and don't show the card empty (frame at 5.4 s).
   - **`shop-no-photos-390`:** four pastries plus a fruit galette all show the same croissant. Add a tart or pie drawing, or vary the pose within a category.
   - Run `npm run e2e` once on the commit that ships, record it in a tests log, and point `README.md:13` at `round-9/`.

## Verdict: **ship**

Part A is **24/25** and Part B is **24/25** (both held), with **0 Part C fails**. That meets the bar (no Part C fails, Part A ≥ 20) for the fifth straight round. Every item of the human's feedback is visible:
- pictures in every slot, never letters;
- a story hero that reads;
- motion that is purposeful and turns off under reduced motion (checked live);
- separate error and note colours;
- the phone shop fixes.

The motion has two small blemishes (fix 3). As in every round since 5, what holds A5 and B4 is not code. There is no video, no public repo and no hosted URL, so the entry would still fail Stage One as it stands.
