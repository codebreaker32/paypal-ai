# Judge round 10: main 9b76e5a, the Awning logo everywhere, round 9's polish, one tab panel

## What I judged

**Artifacts:**
- The rubric `docs/JUDGING.md`, with its three Part C amendments: the 13 banned "warm editorial" patterns, the real-product check against `.scratch/refs/`, and "Images, not stand-ins".
- Round 9's verdict, used only for its top 3 fixes and its scores.
- **The screenshots** in `screenshots/round-10/`: 96 screens at 390 and 1440, `axe-results.json`, and the README. They were taken on a production build of 498e1f8. `git diff --stat 498e1f8 HEAD -- src tests e2e` is empty, so the screens and the e2e log both describe the code on HEAD.
- `screenshots/capture/`, `evidence/illustrations.png`, `round-10-tests.txt`.
- **The logo files:** `docs/judge/logo-round.md` (refinements only), `docs/judge/logo/final/` (including `sheet.png`), `docs/DESIGN.md` § Logo, `src/app/icon.svg`, `src/app/apple-icon.png`, `src/app/opengraph-image.png`, `public/icons/*`, `public/brand/*` and `video/project/assets/`.
- **The 6 recordings** in `recordings/round-10/`. ffprobe: all are 25 fps. `start` is 23.8 s at 1440 and 22.1 s at 390; `shop` is 24.5 s and 21.0 s; `dashboard` is 22.0 s and 21.2 s.
  - I made 1 fps contact sheets of `start-1440`, `shop-390`, `dashboard-390` and `dashboard-1440`.
  - I took a 5 fps burst of `start-1440` at 4.4–6.0 s, cropped to the order card, and a full frame at 5.6 s.
  - All of these are in `/tmp/judge10/`.
- Code paths cited below.

I did not read `PROGRESS.md`, `DECISIONS.md`, commit messages or worker notes.

## What I checked myself

I worked in a detached worktree of HEAD (`/tmp/judge10-wt`), as the coordinator asked, and ran every heavy command under `nice -n 19`. I didn't run the e2e suite.

- **Build:** `npm run build` exited 0, including TypeScript.
- **Unit tests:** `vitest run` gave **1094 passed in 92 files**, exit 0. `round-10-tests.txt` records 1079 on 498e1f8.
- **Live server:** a production build on port 3129 with its own `DATABASE_PATH` and `UPLOADS_DIR`. `/api/health` returned `{"ok":true}`.
- **Seed:** 6.1 s, exit 0. It printed "Marigold Bakehouse is live: 9 items in the PayPal sandbox catalog", paid to `s•••@business.example.com`. I ran `--reset` once more and wrote the owner link to a file without printing it.
- **The agent door, live:**
  - `tools/list` returned the 4 tools.
  - `list_products {"query":"croissant"}` returned absolute `image_url`s.
  - `create_order` took **2.70 s** and returned **SHF-PLWFRU**: `awaiting_approval`, total 10.00, with a `www.sandbox.paypal.com/checkoutnow` link.
- **Playwright on my build** (`/tmp/judge10/pw/check.cjs`):
  - **Icons in `<head>`:** `<head>` links `icon.svg`, `apple-icon.png`, `opengraph-image.png` and the manifest. The header logo is an SVG labelled "Shelfie". `scrollWidth` is 390 at a 390 px viewport.
  - **The console:** it opens with no robot icon (`.lucide-bot` count 0; `/tmp/judge10/console-live.png`).
  - **Dashboard bug fix (change 3):** after the owner link, the page has exactly **1** `[role=tabpanel]` at 300 ms, 1.5 s and 4 s, with 0 hidden ones. It still has 1 after each click on Menu, Share, Settings and Orders.
  - **Reduced motion:** with `reducedMotion: 'reduce'`, the start page at 400 ms has **0** translucent elements in `main`, and "Paid with PayPal" is visible.
- **axe:** I parsed `round-10/axe-results.json` myself: **96 entries, 0 violations**.
- **Repo:** the GitHub API returns **404**.
- **Clean-up:** I stopped the server by PID (port 3129 is free) and removed the worktree with its `data/`. Nothing was written to `data/` in the main checkout.

## The logo (change 1)

| Check | Result | Evidence |
|---|---|---|
| Refinement 1: close the print | **Done** | `icon.svg`: the print is a closed rectangle `M8 24H56V60H8Z` with a window `12 28 → 52 48`. Its chin is 12 units against 4-unit sides (3×; the round asked for ≥ 2.5×), and a paper gap of rows 12–24 sits under the awning. `sheet.png`, row 1. |
| Refinement 2: one custom wordmark detail, no half-circle dot | **Done** | The f's crossbar runs on over the i as a shelf, with a pomegranate print as the dot (`sheet.png`, last row; `opengraph-image.png`). |
| Refinement 3: a heavier wordmark | **Done** | The 32 px lockup's letters now match the mark's posts (`sheet.png`, "Site header" row; `start-1440.png` header). |
| Refinement 4: mono and dark files | **Done** | `public/brand/{mark,wordmark,lockup}-mono.svg` use `currentColor`, and there are `-reverse` files. `src/app/icon.svg` has `@media (prefers-color-scheme:dark){.k{fill:#fff}}`. |
| Refinement 5: maskable icon inside the safe zone | **Done** | `app-icon-maskable.svg` is `translate(107.05) scale(4.65)`. The awning's corner is at about 184 px from the centre, against the 205 px safe radius (about 4% margin). `icon-maskable-512.png` viewed. |
| 16 and 32 px, one colour | **Pass** | `sheet.png` at 16, 32 and ×4: the scallops and the window still read, on light and on ink. The one-colour row reads on white, ink and pomegranate. |
| Everywhere Shelfie's identity appears | **Pass** | <br>• **Header:** every screen (`start-1440`, `dashboard-orders-390`, `shop-1440`). <br>• **Favicon:** `src/app/icon.svg`, served live. <br>• **PWA icons:** `public/icons/` (192, 512, maskable). <br>• **Apple touch icon:** `src/app/apple-icon.png`. <br>• **Counter card:** the lockup at the bottom right (`counter-card-1440`). <br>• **Open Graph image:** viewed. <br>• **README:** `README.md:3` uses `public/brand/lockup.svg`. <br>• **Video end card:** `video/project/assets/{lockup,mark}.svg`, used by `video/remotion/src/scenes/Card.jsx:24–26`. <br>• **Console avatar:** `LogoMark` in `BuyerConsole.tsx:223` (replies) and `:407` (Thinking…), and `ShopAssistant.tsx:101` (`console-conversation-390`). |
| No stock icon stands for Shelfie | **Pass** | No lucide `Bot` or `Store` icon is imported in `src` (grep). Live, the console has 0 `.lucide-bot`. The mark is drawn from the app's own paths (`logo-paths.ts`). |
| `DESIGN.md` § Logo | **Pass** | `DESIGN.md:17–28` covers the mark, wordmark, lockup, clear space, minimum sizes (16 px mark, about 80 px lockup), colour versions, where it appears, and don'ts. The don'ts include "no robot or other stock icon standing for Shelfie". |

**Blemishes, for fix 3:**
1. **`src/app/apple-icon.png` (180 px) puts the mark almost edge to edge.** The art is 4..60 of 64, so it sits about 11 px from each edge. iOS rounds the corners with a radius of about 40 px, so the awning's top corners will be shaved. The maskable icon was given padding; the apple icon wasn't.
2. **Stale identity text from the old mark:**
   - `CLAUDE.md` still describes "The mark (a viewfinder framing a loaf)".
   - `CLAUDE.md` tells you to regenerate the icons from `public/brand/glyph.svg`, which no longer exists.
   - `StorePreview.tsx:32` has the comment "like the brand mark's".
3. **The console greeting says "Hi! I'm Claude"** (`BuyerConsole.tsx:378`) next to the Shelfie mark. That's honest, but every later reply has the Shelfie avatar while the dashboard calls the source "via Shelfie Assistant". It's a small identity wobble, not a fail.

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** (held) | **Live today:** Catalog Products (9 at seed) and Orders v2 through the door (SHF-PLWFRU, sandbox approval link). <br>**Real captures on the shipping code** (`round-10-tests.txt:5–21`): <br>• seller run: capture `07P86156C5779452P` COMPLETED, "payee = PAYPAL_SANDBOX_SELLER_EMAIL"; <br>• platform run: capture `4NY97926FL846392D` COMPLETED, with PayPal tracker `…-9400111179398915710985 USPS SHIPPED`; <br>• the Agent Toolkit brief flags the nut allergy on both runs. <br>Claude reads the menu, picks categories (and now bread variants by name), writes briefs and runs the console. |
| A2 Design | **5** (held) | **The new logo is coherent and everywhere.** See the logo table: all 5 refinements are done, it reads at 16 px and in one colour, and the dated "red rounded square" app-icon look is gone. <br>**Round 9's polish is visible:** <br>• the phone toast sits below the row it announces (`dashboard-390.webm` at 7–8 s); <br>• the hero card opens on the buyer's request, not blank (frame at 5.6 s); <br>• breads vary: the boule cross on the sourdough and the scored loaf on the rye (`shop-no-photos-390`; `illustrations.png` has bread, boule, baguette and focaccia). <br>One tab panel, live. 96 screens, axe 0. |
| A3 Potential impact | **5** (held) | Payment goes into the seller's own account. Seen today in the seed line and the seller capture above. |
| A4 Innovation | **5** (held) | A findable agent door, two vision uses, and the story hero. The hero now shows the agentic beat as a buyer chat bubble ("2 almond croissants and a sourdough, shipped") before the order card fills (`start-1440.png`). |
| A5 Presentation readiness | **4** (held, ninth round) | **What improved:** the video now has its brand pieces (lockup title card, `Card.jsx:24–26`), and the in-product story reads better (chat bubble → Ready to pay → Paid). <br>**Why it doesn't move:** there is no rendered video. `video/out/` holds only `voices/`. The repo is 404, `README.md:145` says "**Not yet run.**", and `SUBMISSION.md:86–88` has 3 TODOs. A5 is about whether the video makes the problem, audience and stakes clear, and I can't see a video. <br>**What moves it:** fix 1. |
| **Total** | **24/25** (round 9: 24) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **5** (held) | "Your price list, open to AI shoppers." The OG image now says it beside the logo. |
| B2 Implementation | **5** (held) | **Run by me:** build 0 and 1094 unit tests passed on HEAD. **Full e2e on the shipping src:** 185 passed, 9 skipped and 0 failed on 498e1f8, which has no src, test or e2e diff to HEAD. Both real captures COMPLETED (`round-10-tests.txt:2`). **Round 9's gap is closed.** The bug fix has a frame-level test: "exactly one tab panel is ever in the page: on load and at every frame of quick tab switches" (`round-10-tests.txt`, test 15). I confirmed it live. |
| B3 Depth | **5** (held) | The fallback chains still hold (logo → cover → menu photo → drawing). Drawings now vary by name inside a category (boule, baguette, focaccia; bun, tart, pain). |
| B4 Usefulness | **4** (held) | No hosted instance (`README.md:145`), so no seller can use it this week. *Fix:* fix 2. |
| B5 Innovation | **5** (held) | Same as A4. |
| **Total** | **24/25** (round 9: 24) | |

## Part C

**Screens I viewed, each beside the Toast and Square references:**
- `start-1440`
- `shop-1440`, `shop-no-photos-390`
- `dashboard-orders-390`, `order-paid-with-brief-390`
- `console-conversation-390`, `counter-card-1440`
- the OG image and the icons
- my live console and dashboard
- every frame of the 4 contact sheets

**Banned 2026 patterns, per screen** (2 or more fails a screen):

| Screen | Patterns found | Count |
|---|---|---|
| start (1440, and the hero frames) | none. White page, Figtree, black primary button, soft-shadow cards. The single grey line under the button is not "under almost every element". | 0 |
| shop-1440, shop-no-photos-390 | none. The light item-card border is Toast's own pattern (`toast-bakeybabka-1440`). No leaders, no mono prices, no chips. | 0 |
| dashboard-orders-390 (and its recordings) | none. Status is a dot plus a word. | 0 |
| order-paid-with-brief-390 | **an icon on most labels** in the brief card (sparkle, warning, info, shield, speech bubble, envelope), unchanged from round 9. The two "Allergy" / "Timing" tags are not chips "everywhere". | 1 |
| console-conversation-390 | none. Mono is only on the tool name `create_order`. | 0 |
| counter-card-1440 | none | 0 |

The maximum is 1, on one screen, so no screen fails.

**Text stand-ins for an image, per screen: none found.**
- **Shop pictures:** a cover detail (`shop-1440`) or the menu photo (`shop-no-photos-390`).
- **Items with no photo:** drawings, which now vary by name.
- **Juniper Loaf Co** (`dashboard-390.webm`): focaccia and croissant drawings on its rows.
- **The assistant:** the logo mark, which is a drawn image, not letters.

**Real-product check: pass on every viewed screen.**
- **Shop:** the same anatomy as Toast Local's Bakey page.
- **Dashboard:** a Square-style order list.
- **Counter card:** reads like a Square or Toast QR table tent.
- **The logo:** at header size it sits as calmly as Toast's or Square's wordmarks. Its awning echoes the "shop" glyph genre, but the closed print and the shelf-f make it its own.

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One black fill per screen: **Snap your price list**, **Order with an assistant**, **Print card**, **Send tracking to PayPal**. The console's primary is PayPal blue **Approve $27.00 on PayPal**. |
| Loading, success, empty and error states | **Pass** | All the round-9 states are re-shot in `round-10/` (loading, empty, error, rate-limited, publishing, retry, counter states). "Writing the brief…" shows on fresh rows (`dashboard-390.webm`). |
| WCAG AA, keyboard, focus, alt text | **Pass** | 96 axe entries, 0 violations (my parse). The header logo has an accessible name, "Shelfie". |
| Phone width, targets ≥ 44 px | **Pass** | Live `scrollWidth` is 390. `start.spec` has a "≥ 44 px" test, which passed. |
| Plain, specific copy | **Pass** | "Nothing is charged until you approve on PayPal." "Prints 5 × 7 inches on letter or A4 paper. Cut along the edge." |
| No generic AI look | **Pass** | No gradient, glass, glow or emoji. The mark replaces the generic robot. |
| No empty hero, no three identical cards | **Pass** | The hero is the product's own story. |
| No lorem or fake stats | **Pass** | Fixtures are labelled in `round-10/README.md`. |
| Deliberate type, palette and spacing | **Pass** | Figtree with a drawn wordmark, one pomegranate accent shared by the logo's awning and the i-dot, and separate error and note roles. |
| Banned 2026 patterns | **Pass** | Max 1 (table above). |
| Images, not stand-ins | **Pass** | None found. |
| Real-product check | **Pass** | Above. |
| Tokens defined once | **Pass** | `globals.css`. The logo paths are generated once into `logo-paths.ts`. |
| Type scale and line length | **Pass** | Unchanged scale across screens. |
| Consistent components, purposeful and subtle motion | **Pass** | See the motion section. |

### Motion

- **Purposeful: pass.**
  - **Start hero** (`start-1440.webm`, 1 fps sheet):
    - 0–2 s: the paper menu in the viewfinder;
    - 3 s: the live shop;
    - 4 s: the order bar;
    - 5 s: the order card opens on the buyer's line "2 almond croissants and a sourdough, shipped";
    - 5.6–6.4 s: "Ready to pay" and the lines type in;
    - 7–8 s: "Paid with PayPal", then the "Payment received SHF-K7F2QX · $27.00" toast.
    The story reads, and now shows *who* ordered.
  - **Shop** (`shop-390.webm`): tab jumps, the console's activity entries stagger in, and the total counts up ($26.87 → $27.00).
  - **Dashboard** (`dashboard-390.webm` at 6–8 s): the new SHF-MDNK5G row is tinted green, the count goes 3 → 4, "Paid" counts $54.00 → $69.20 → $71.00, and a toast arrives.
- **Smooth, no reflow: pass.**
  - **Round 9's blemish 1 is fixed.** At 7 and 8 s the toast sits at about 765–835 px, *below* the green row at about 650–740 px. `dashboard.spec.ts:148`, "on a phone, the toast never covers the row it announces", passed.
  - **Round 9's blemish 2 is mostly fixed.** The card is never empty: it appears with the chat bubble (burst frame 4). For about 0.6 s, the lower two-thirds of the card is still blank while the lines type (frame at 5.6 s). It is reserved space, so nothing reflows. It is minor and I don't count it as a fail.
  - **The recordings were again made on a dev server.** Next's "N" badge is in the corner of every frame. My live checks used a production build.
- **Not distracting: pass.** The hero plays once and holds, and nothing loops.
- **Reduced motion respected: pass, verified live.** Under reduce, the start page at 400 ms has 0 translucent elements and shows "Paid with PayPal". `shop.spec` passed its reduced-motion tests, 171 and 172.

**Part C: 0 fails** (round 9: 0).

## Round 9's top 3 fixes

1. **Render, publish and submit the video, and make the repo public: not done.**
   - There is no `video/out/shelfie-demo.mp4` (only `voices/`), and the GitHub API returns 404. `SUBMISSION.md:86–88` still has 3 TODOs.
   - The brief says the video is rendered after this round, and the lockup title card is wired.
   - **A5 held at 4.**
2. **Deploy to Render: not done.** `README.md:145` still says "Not yet run." **B4 held at 4.**
3. **Polish and prove the final commit: done. No score moved, since A2 and B2 were already 5; it protects them.**
   - The toast clears its row on a phone (recording and e2e).
   - The hero card opens on the buyer's line.
   - Pastries and breads vary by name.
   - Full e2e ran on 498e1f8, which has no src, test or e2e diff to HEAD.
   - The one leftover: `README.md:15` still points at `round-9/`.

## Top 3 fixes (ranked by Part A gain)

1. **Render and upload the video, make the repo public, and submit (A5 4 → 5; without these the entry fails Stage One).** Due 12 Nov 2026, 12:00 PT.
   - `cd video/remotion && npm run voice && npm run render`. Check the cut is under 3:00, then upload it public on YouTube.
   - Open on the start hero and end on the Awning lockup card.
   - Make the repo public after a secret scan of its history. Confirm the API returns 200 and the licence shows in About.
   - Fill `SUBMISSION.md:86–88`.
2. **Deploy to Render (B4 4 → 5; also helps A5).**
   - Follow `docs/DEPLOY.md`, seed in the service shell, and register the webhook.
   - Replace `README.md:145` with the URL and the date it was verified.
3. **Finish the logo roll-out (protects A2; a coder can do it in this repo in minutes):**
   - **`src/app/apple-icon.png`:** pad the mark to about 80% on its white tile, as the maskable icon is, so iOS's rounded corners don't shave the awning.
   - **`CLAUDE.md`:** replace the "viewfinder framing a loaf" description and the `make-icons … public/brand/glyph.svg` command, since that file is gone. Fix the stale comment at `StorePreview.tsx:32`.
   - **The console greeting** (`BuyerConsole.tsx:378`) sits beside the Shelfie mark. Consider "Hi! I'm Shelfie's assistant (Claude)" so the avatar and the name agree.
   - **`README.md:15`:** point it at `round-10/`.
   - **Recordings:** re-record the motion clips on a production build, so the "N" dev badge is gone. This matters if any frame goes into the video.

## Verdict: **ship**

Part A is **24/25** and Part B is **24/25** (both held), with **0 Part C fails**. That meets the bar (no Part C fails and Part A ≥ 20) for the sixth straight round.

**This round delivered:**
- **The logo:** the Awning is in every identity slot, with all five refinements, and it is legible at 16 px and in one colour.
- **The assistant's avatar:** now the Shelfie mark, not a robot.
- **Round 9's motion blemishes:** fixed.
- **Breads:** now vary by name.
- **The dashboard bug:** the duplicate tab panel is gone (checked live).
- **Proof on the shipping code:** a full e2e run.

What still holds A5 and B4 is not code: there is no rendered video, no public repo and no hosted URL.
