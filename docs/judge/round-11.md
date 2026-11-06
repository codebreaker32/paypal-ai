# Judge round 11: main a7b6851, real photos for products (Part A3)

## What I judged

**Artifacts:**
- The rubric `docs/JUDGING.md`, with its three Part C amendments: the 13 banned "warm editorial" patterns, the real-product check against `.scratch/refs/` (Toast Bakey/Felipe's/Local, Square bakery), and "Images, not stand-ins".
- Round 10's verdict, used only for its top 3 fixes and its scores.
- **The screenshots** in `screenshots/round-11/`: 96 screens at 390 and 1440, `axe-results.json`, and the README. They were taken on a production build of `ca56b2d`. `git diff --stat ca56b2d HEAD -- src tests e2e` is empty, so they describe HEAD.
- **The 6 recordings** in `recordings/round-11/` (all 25 fps; `start` 23.1 s / 21.4 s, `shop` 22.9 s / 19.6 s, `dashboard` 20.4 s / 20.5 s at 1440 / 390). I made 1 fps contact sheets of `start-1440`, `shop-390`, `shop-1440` and `dashboard-390`, a 5 fps burst of `start-1440` at 4.6–6.4 s cropped to the order card, and a full frame at 7 s. All are in `/tmp/judge11/`.
- **The example-photo library:** all 167 files in `public/library/`, as four numbered contact sheets (`/tmp/judge11/sheet0–3.png`), plus full-size views of the 6 that show people or bikes up close. `src/lib/library/{catalog,match,picture}.ts`, `src/components/shop/ExampleNote.tsx`.
- **The rendered demo video** `video/out/shelfie-demo.mp4` (new since round 10): ffprobe 1920×1080 with audio, **2:42**. I made a 1-frame-per-6-s contact sheet (`/tmp/judge11/cs-video.png`) and read the whole of `shelfie-demo.srt`.
- **The e2e log** `/tmp/e2e/round-11-tests.txt`, still running when I looked (see below).
- Code paths cited below.

I did not read `PROGRESS.md`, `DECISIONS.md`, commit messages or worker notes.

## What I checked myself

I worked in a detached worktree of HEAD (`/tmp/judge11-wt`) and ran every heavy command under `nice -n 19`. I didn't run the e2e suite.

- **Build:** `npm run build` exited 0, including TypeScript.
- **Unit tests:** `vitest run` gave **1157 passed in 98 files**, exit 0 (round 10: 1094 in 92).
- **Live server:** a production build on port 3129 with its own `DATABASE_PATH` and `UPLOADS_DIR` under `/tmp/judge11`. `/api/health` returned `{"ok":true}`.
- **Seed:** 5.5 s, exit 0. "Marigold Bakehouse is live: 9 items in the PayPal sandbox catalog", paid to `s•••@business.example.com`. I didn't print the owner link.
- **A shop with no seller photos, live** (Playwright, `/tmp/judge11/pw/check.cjs`):
  - I tapped the **Tía Lupe's Tacos** sample on the start page. Review after **11.1 s**. It showed **11** "Example photo, replace with yours" lines, and every thumbnail was a `/library/` photo (al pastor, carnitas, chicken, mushroom tacos, guacamole, elote, two different burritos, horchata, a pink soda, agua fresca).
  - I published it to the real sandbox ("10 items are in your PayPal catalog, plus 1 to ask about in person").
  - **Shop page `/s/tia-lupes-tacos` at 390:** 11 `[data-example-note]` buttons. Every note's computed **opacity is 0 at rest**. After a tap it is **1**, and on hover at 1440 it is **1** (`live-shop-tap.png`: a small dark "Example photo" pill in the photo's corner). The alt texts say "Al pastor, example photo". `scrollWidth` is 390.
  - **JSON-LD on that page: no `/library/` URL.** Its only `image` is the shop's own menu photo, `/s/tia-lupes-tacos/photo/1`.
  - **Agent door:** `list_products` on `/s/tia-lupes-tacos/mcp` returned **0** `/library/` strings and no `image_url` for the example-only items. On the seeded Marigold shop it returns the seller's own photos (`/demo/marigold-bakehouse/…jpg`). So agents never get an example photo. Unit tests cover both (`tests/mcp/tools.test.ts`, `tests/discovery/jsonld.test.ts`).
  - **Menu tab of a new shop:** "Example photo, replace with yours" under the agua fresca row, with a small add-photo badge on the thumbnail (`live-tia2-menu-390.png`).
  - **Ravi's Bike Repair** sample: 7 example notes, all bike photos (chain, kids' bike, tyre, brakes, workshop, two wheels).
  - **Marigold sample, read live by Claude in 18.7 s:** "Olive oil citrus cake – 8"" got **`cake-whole-3`, "A round chocolate cake cut into wedges"**. The recorded screenshots (`setup-review-*`, `shop-no-photos-*`) show the same chocolate cake. This is the one poor match I found (see fix 2).
- **axe:** I parsed `round-11/axe-results.json`: **96 entries, 0 violations**.
- **Repo:** `api.github.com/repos/codebreaker32/paypal-ai` returns **404**. `docs/SUBMISSION.md:86–88` still has 3 TODOs. `README.md:145` still says "**Not yet run.**"
- **Clean-up:** I stopped the server by PID (port 3129 is free) and removed the worktree. Nothing was written to `data/` in the main checkout.

**The e2e log** (`/tmp/e2e/round-11-tests.txt`, "Full e2e on 9acb4cc"; `git diff 9acb4cc HEAD -- src tests e2e` is empty): when I looked, about 75 of 194 tests had passed and **0 had failed**. Both real captures were **COMPLETED**:
- seller `02R25066NX9894350`, "payee = PAYPAL_SANDBOX_SELLER_EMAIL";
- platform `0D019101RG800492T`, with PayPal tracker `…-9400111179399740384419 USPS SHIPPED`.

Both Agent Toolkit briefs flagged the nut allergy. The run hadn't finished, so I can't speak for the rest.

## Real photos for products (Part A3)

| Check | Result | Evidence |
|---|---|---|
| Order: seller's photo → kept counter crop → example → drawing | **Pass** | `src/lib/library/picture.ts` `pictureOf`. The seeded shop shows its own photos with no note (`shop-1440`, `dashboard-menu-390`). The Tía Lupe shop shows examples. Unit tests: `tests/library/picture.test.ts`, `fallback.test.ts`. |
| Claude picks the example while reading; unpicked items match by name | **Pass** | `schemas.ts:33` `example_photo`, with a prompt that lists the library as "id: what it shows" (`prompts.ts:25–28`). `match.ts:133` falls back to name, description and section tags. Two burritos got two different photos (`avoid`). |
| Seller is told, in review and on the Menu tab | **Pass** | "Example photo, replace with yours" under every example row (`setup-review-390/1440`, live Menu tab). |
| Buyer sees only a small note on hover, focus or tap | **Pass** | Opacity 0 at rest and 1 on tap and hover, measured live. It is never an always-on badge. The alt text still tells a screen-reader user. |
| Seller's own photos carry no note | **Pass** | `shop-1440` and the seeded shop: no `[data-example-note]` on own photos. |
| No examples to agents or JSON-LD | **Pass** | Live, above. |
| No brands, logos or faces | **Pass, with one nit** | I looked at all 167 photos on the sheets and opened the 6 riskiest at full size. **People:** `kids-bike-1` is a child seen from behind in a helmet; `bike-repair-4` has a figure far back through a shop window; `tote-2`/`tote-3` are cropped at the shoulders; the rest are hands. None shows an identifiable face. **Brands:** no wordmark is readable anywhere. **The nit:** `bike-repair-3` has a small triangular frame decal on the down tube; it's not legible as a brand at tile size. |
| Matches are good | **Mostly** | Tacos, breads, croissants, bike parts and drinks all match well. **One poor match:** the Marigold "Olive oil citrus cake" shows a chocolate cake (`cake-whole-3`), live and in the screenshots. A buyer would expect chocolate. The three `cake-whole-*` photos share identical tags (`catalog.ts:461–490`), so the variant is chosen by hash, not by flavour; a lemon tart (`cake-whole-2`) sits unused beside it. Smaller: the "Seasonal fruit galette" gets a fruit tart (close enough). |

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** (held) | **Real captures on the shipping src**, both COMPLETED (e2e log above), with the Agent Toolkit brief. Catalog Products live: 9 at seed, plus 10 from my Tía Lupe shop. Claude now does one more real job in the core flow: it chooses each item's example photo while reading the menu, from a library it is shown in the prompt. Agents still get only true data. |
| A2 Design | **5** (held) | **A shop with no photos now looks like a real shop.** `shop-no-photos-1440` and my live Tía Lupe page read like the Toast references, with photo tiles instead of drawings. The honesty design is right: a quiet seller-side line, a hover/tap pill for buyers, nothing for agents. 96 screens, axe 0. **Blemishes, none a fail:** <br>• the chocolate photo on a citrus cake; <br>• "**1 items** · 0 with photos" on the Menu tab (`MenuPanel.tsx:187`, seen live); <br>• the hero's cardamom bun is **$4.50** (`StorePreview.tsx:17`), but the shop and the menu say $3.50. |
| A3 Potential impact | **5** (held) | Payment still goes into the seller's own account (seed line, seller capture). Example photos remove the main reason a paper-menu seller's shop looked unfinished, with no photo shoot needed. |
| A4 Innovation | **5** (held) | The findable agent door, two vision uses, and now Claude matching menu lines to a credited photo library. |
| A5 Presentation readiness | **5** (4 → 5) | **There is now a video I can judge.** `video/out/shelfie-demo.mp4` is 1920×1080 with narration, **2:42** long. <br>• **Problem and audience:** "Rosa bakes from her kitchen. She has no website, just this sheet of paper", a sourced home-baker quote, and the 2016 Census website figure. <br>• **End to end:** snap → review ("two for seven dollars") → PayPal catalog → snap your counter → counter card → **Claude Code ordering from the shop URL alone** (the wow moment) → the in-page console catching the nut allergy → PayPal approval → "lands in Rosa's own PayPal account" → "agents can't set prices. The server checks that" → dashboard, Agent Toolkit brief, tracking → the architecture card and the Awning end card. <br>**Still to do, and not optional:** it isn't on YouTube, the repo is 404, and SUBMISSION has 3 TODOs (fix 1). The score is for readiness; Stage One needs these done. |
| **Total** | **25/25** (round 10: 24) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **5** (held) | "Your price list, open to AI shoppers." The video's last line says it: "For Rosa, a sheet of paper is now enough." |
| B2 Implementation | **5** (held) | **Run by me:** build 0, and **1157** unit tests passed on HEAD. **e2e:** about 75 of 194 had passed with 0 failures, including both real captures, when I looked. The library has its own tests (catalogue ↔ files ↔ sizes ↔ ASSETS credits, matching, fallback, and no library URLs to agents). |
| B3 Depth | **5** (held) | The picture chain now has four honest tiers, and it handles the edges: two items avoid sharing a photo, and a bike part with no matching photo keeps its drawing. The one gap is flavour conflicts within a photo type (fix 2). |
| B4 Usefulness | **4** (held) | Example photos make a seller's first shop sellable the same minute. But there is still no hosted instance (`README.md:145`), so no seller can use it this week. *Fix:* fix 3. |
| B5 Innovation | **5** (held) | Same as A4. |
| **Total** | **24/25** (round 10: 24) | |

## Part C

**Screens I viewed, each beside the Toast and Square references:**
- `shop-no-photos-1440/390`, `setup-review-1440/390`
- `dashboard-menu-390`, `dashboard-orders-1440`, `order-paid-with-brief-390`
- my live Tía Lupe review, shop (390, scrolled; 1440 hover) and Menu tab
- every frame of the 4 contact sheets and the video sheet

**Banned 2026 patterns, per screen** (2 or more fails a screen):

| Screen | Patterns found | Count |
|---|---|---|
| shop-no-photos (1440, 390), live Tía Lupe shop | none. White page, Figtree, photo tiles, light card border (Toast's own). The buyer's note is hidden until asked. | 0 |
| setup-review (1440, 390) | **a small grey sentence under almost every element.** "Example photo, replace with yours" now sits under all 10 rows, on top of the "We read…" and "Is that right?" lines. The action buttons carry icons, but labels and section heads don't, so I don't count "an icon on every label". This is the screen closest to failing. | 1 |
| dashboard-menu-390, live Menu tab | none | 0 |
| dashboard-orders-1440 | none. Status is a dot and a word, except "PayPal refused payment", which uses an error icon. | 0 |
| order-paid-with-brief-390 | **an icon on most labels** in the brief card (unchanged since round 9) | 1 |
| start (frames) | none | 0 |

The maximum is 1, so no screen fails.

**Text stand-ins for an image: none found.** Every item slot has a photo (the seller's or an example) or a drawing. The shop picture is the cover detail or the menu photo, and the assistant is the logo mark. The review's empty **Logo** slot is an add-photo button in an upload control, not a stand-in for a picture.

**Real-product check: pass on every viewed screen.**
- **No-photo shop:** this now looks closer to Toast Local and Square's bakery than round 10's drawings did. A designer would take it for a real storefront.
- **Example pill:** like Instagram's or Uber Eats' small photo overlays. Small and dark, and only on demand.
- **Review:** a Square-style item import checklist.

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One black fill per screen: **Snap your price list**, **Order with an assistant**, **Snap your counter**, **Send tracking to PayPal**. The review's primary is **Publish 6 items to PayPal**. |
| Loading, success, empty and error states | **Pass** | All re-shot in `round-11/` (reading, publishing, retry, failed, counter reading/none/error/live, console thinking/error/rate-limited). |
| WCAG AA, keyboard, focus, alt text | **Pass** | 96 axe entries, 0 violations (my parse). The example note is a focusable button with an `aria-label` and a focus-visible outline (`ExampleNote.tsx:13–23`). The alt text says "example photo". |
| Phone width, targets ≥ 44 px | **Pass** | Live `scrollWidth` is 390. The note's button covers the whole photo, so it's a big target. |
| Plain, specific copy | **Pass, with a slip** | "Example photo, replace with yours" is plain. "**1 items**" (`MenuPanel.tsx:187`) is a grammar slip, and only shows with one listed item. |
| No generic AI look | **Pass** | No gradient, glass, glow or emoji. |
| No empty hero, no three identical cards | **Pass** | |
| No lorem or fake stats | **Pass** | Fixtures are labelled in the README. The library photos are credited one by one in `docs/ASSETS.md`. Small mismatch: the hero's bun price (A2). |
| Deliberate type, palette and spacing | **Pass** | Unchanged. The example pill uses ink at 80%, not the accent. |
| Banned 2026 patterns | **Pass** | Max 1 (table above). |
| Images, not stand-ins | **Pass** | None found. |
| Real-product check | **Pass** | Above. |
| Tokens defined once | **Pass** | `globals.css`. The pill uses `--duration-fast`. |
| Type scale and line length | **Pass** | |
| Consistent components, purposeful and subtle motion | **Pass** | See below. |

### Motion

- **Purposeful: pass.**
  - **Start** (`start-1440`): the menu in the viewfinder (0–2 s) → the live shop (3 s) → "Order with an assistant" fades as the chat bubble card rises (4.6–5.2 s) → "Ready to pay" with lines typing in (5.4–6.4 s) → "Paid with PayPal" and the payment toast. One story, played once.
  - **Shop** (`shop-390`): tab jumps, the console sheet rises over a dimmed shop, activity entries stagger, and it ends on the "Approve $27.00 on PayPal" card.
  - **Dashboard** (`dashboard-390`): the new paid row slides in tinted green, the count goes 3 → 4, Paid counts $54.00 → $71.00, and the toast sits below the row it announces.
  - **The example pill:** an opacity-only fade (`transition-opacity`, `--duration-fast`). No layout shift.
- **Smooth, no reflow: pass.** The order card reserves its height while lines type, so nothing jumps.
- **Not distracting: pass.** Nothing loops.
- **Round 10's blemish is fixed:** the recordings are now from a production build. There is no "N" dev badge in any frame I looked at (`start-7s.png`).

**Part C: 0 fails** (round 10: 0).

## Round 10's top 3 fixes

1. **Render and upload the video, make the repo public, submit: half done.**
   - **Done:** the video is rendered, 2:42, and opens on the problem and ends on the Awning lockup card. **A5 4 → 5.**
   - **Not done:** it isn't on YouTube, the GitHub API returns 404, and `SUBMISSION.md:86–88` still has 3 TODOs.
2. **Deploy to Render: not done.** `README.md:145` still says "Not yet run." **B4 held at 4.**
3. **Finish the logo roll-out: mostly done. No score moved, since A2 was already 5; it protects it.**
   - **Done:** `apple-icon.png` is padded on white (viewed); CLAUDE.md's make-icons command now uses `public/brand/mark.svg`; the recordings are from a production build.
   - **Left:**
     - `README.md:15` still points at `round-10/`;
     - `StorePreview.tsx:32` still says "like the brand mark's" about the viewfinder corners;
     - the console greeting (`BuyerConsole.tsx:378`) is unchanged ("Hi! I'm Claude").

## Top 3 fixes (ranked by Part A gain)

1. **Publish and submit: upload the video, make the repo public, fill SUBMISSION (protects A5 at 5; without it the entry fails Stage One).** Due 12 Nov 2026, 12:00 PT.
   - Upload `video/out/shelfie-demo.mp4` to YouTube as **public**.
   - Run a secret scan over the git history, then make `codebreaker32/paypal-ai` public. Confirm the API returns 200 and the LICENSE shows in About.
   - Fill `docs/SUBMISSION.md:86–88` and point `README.md:15` at `round-11/`.
2. **Stop example photos contradicting the item, and tidy the copy (protects A2 and B3; it's the first thing a judge sees after tapping the Marigold sample).**
   - In `src/lib/library/catalog.ts`, give the `cake-whole-*` variants (and any other mixed-flavour type) flavour tags, such as `chocolate` on `cake-whole-1`/`-3` and `lemon`/`citrus` on `cake-whole-2`.
   - In `match.ts`, prefer a variant whose flavour words appear in the item's name, and drop one whose flavour conflicts (chocolate vs citrus/lemon/vanilla/olive oil).
   - Add one prompt line: "never choose a photo whose description names a flavour the item doesn't have".
   - Add a unit test: "Olive oil citrus cake" never gets a chocolate photo. Re-record the Marigold fixture's `example_photo`s, and re-shoot `setup-review` and `shop-no-photos`.
   - **While there:**
     - pluralise "items" in `MenuPanel.tsx:187`;
     - set the hero's cardamom bun to $3.50 (`StorePreview.tsx:17`) so it matches the shop;
     - on the review, put "Example photo, replace with yours" once above the list (or keep only the thumbnail badge plus a single explainer), so the grey line under each row doesn't become a second banned pattern.
3. **Deploy to Render (B4 4 → 5; also gives judges a URL that needs no setup).**
   - Follow `docs/DEPLOY.md`, run `npm run seed` in the service shell, and register the webhook.
   - Replace `README.md:145` with the URL and the date it was verified, and fill SUBMISSION's hosted-demo line.

## Verdict: **ship**

Part A is **25/25** (up from 24) and Part B is **24/25** (held), with **0 Part C fails**. That meets the bar (no Part C fails and Part A ≥ 20) for the seventh straight round.

**This round delivered:**
- **Real example photos** in every empty item slot: 167 credited Pexels photos with no faces or brands, chosen by Claude while it reads the menu.
- **Honesty, done right:**
  - the seller sees a plain note;
  - buyers see a pill only when they hover or tap;
  - agents and JSON-LD never get an example photo (checked live).
- **A rendered demo video** that tells the problem, the audience and the end-to-end flow in 2:42.

**What still holds the entry back is not code:** the video isn't on YouTube, the repo isn't public, and there is no hosted URL. The one product flaw worth fixing before the deadline is the chocolate photo on the citrus cake.
