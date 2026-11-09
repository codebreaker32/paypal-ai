# Judge round 12: run-5-production at ce7d2ac, the production pass

**Verdict: fix.** On the rubric alone this would be **ship** (0 Part C fails, Part A 25/25). But one proposed check, **Proper placing**, fails, and a fail in that table blocks this run's sign-off. The failure is small and a coder can fix it (fix 3).

## What I judged

- `docs/JUDGING.md`, with its Part C amendments, and only the "Rubric additions" section of the production-pass brief.
- `screenshots/round-12/`: README, 102 axe entries, and the images cited below. `screenshots/capture/cart-*` and the capture set.
- All 10 recordings in `recordings/round-12/`, ffprobed (25 fps; 12.6 to 25.4 s). 1 fps contact sheets of `assistant-*` and `press-*`, 0.5 fps sheets of `start-*`, `shop-*` and `dashboard-*`, a 5 fps burst of an assistant open at 1440 and a 10 fps burst of a press at 390. All are in `/tmp/judge12/`.
- `round-12-tests.txt`, `lighthouse-shop-mobile.json`, `round-11.md` for its scores and fixes, the spec, DESIGN, README, SUBMISSION, DEPLOY, and the code cited below.
- `video/out/shelfie-demo.mp4`, 2:39.9 (`ffprobe` 159.9 s), as a 1-frame-per-16-s sheet. **It predates this round's UI** (the top-tab dashboard, no app shell). A5 is scored from it, as instructed.

**Not read:** PROGRESS, DECISIONS, run5-notes, commit messages, `.scratch`, the rest of the brief. Because `.scratch` was off limits, the real-product check compares against what I know of Toast, Square and DoorDash, **not** the reference screenshots earlier rounds used.

The source is unchanged from the start-of-run snapshot: `git diff a0ba708 HEAD -- src tests e2e` is empty. I judged the `.next` build provided, as instructed, and did not rebuild.

## What I checked myself

About 17 minutes of checking on a production server, port 3129, against `data/judge12.db`. The server was stopped by PID, `data/judge12*` deleted, and the tree is clean.

- **Seed:** exit 0, 9 products in the sandbox catalog, paid to the sandbox seller.
- **Unit tests on HEAD:** `npx vitest run`: **2210 passed in 166 files**, exit 0, 42 s.
- **Stranger's journey, at both widths, through the real UI** (`pw/journey.cjs`). Landing → Add your shop → sign up → recovery key → Add your shop → sample → real Claude reading → fix flagged items → **real PayPal publish** → live.
  - 1440 (Marigold sample): review at 21.8 s, live at 33.1 s, `/s/marigold-bakehouse-2`.
  - 390 (Tía Lupe sample): review at 14.7 s, live at 23.6 s, `/s/tia-lupes-tacos`.
  - **A second browser context opens the shop (200) and gets a real 404 on the seller page.** 0 page errors.
- **Agent door:** `tools/list`; `list_products` on my shop returned 0 `/library/` URLs. **`create_order` with a `price` was refused** ("`price` is not accepted; prices are set by the shop."). A valid order, SHF-V6M2NC, returned a sandbox `approval_url` in **1.67 s**. `agents.txt` and `llms.txt` serve, and `rel="alternate"` is on the shop page.
- **Assistant geometry:** measured at top, middle and end, and through the empty, thinking and streaming states against live Claude (table below).
- **Press response:** computed style sampled by requestAnimationFrame, 390 by real touch through CDP, 1440 by mouse. Button, link, FAQ row, tile `+`, menu tile, order row, nav link and two switches.
- **Cart and item sheet:** add through the sheet at both widths, cart opens, **Approve redirects to `sandbox.paypal.com/checkoutnow`** at both widths. I did not pay; the paid case is `capture/cart-*` and the test log.
- **Sound switch:** footer and Settings, off, reloaded, with an oscillator spy (table below).
- **Screen sweep:** 20 screens at 2 widths (`pw/sweep.cjs`) for H1 size, black buttons, the sandbox sentence, overflow, small targets and lone words.
- **Recent-past evidence read, not re-run:** full e2e **507 passed, 9 skipped**; cart capture `60R68693G22171943` **COMPLETED**, $19.50 to the seller by wallet login with an Agent Toolkit brief. Lighthouse performance 0.91. `axe-results.json`: 102 entries, 0 violations (my parse).
- **Repo:** `api.github.com/repos/codebreaker32/paypal-ai` returns **404**.

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** (held) | Real sandbox: catalog publish live at both widths, door order in 1.67 s, cart capture COMPLETED to the seller (`round-12-tests.txt:541-542`). AI in the core flow: Claude read both samples live and ran a real console turn with `get_shop_info` and `list_products` (`as-390-full.png`). Tamper refused live. |
| A2 Design | **5** (held) | Now a whole product rather than a demo: sign-up, recovery key, a shell with sidebar and tab bar, a four-part landing page, item sheet, cart with the blue PayPal action. Every state is shot (102 screens, axe 0). **Blemishes, listed so they don't hide behind the score:** the phone order bar reads "**View order · 2$8.50**" (fix 3); a lone word on tiles at 390 (fix 3). |
| A3 Potential impact | **5** (held) | A stranger can now sign up and get a live, paid-to-themselves shop in about 30 s, seen at both widths. The honesty is real: the FAQ says "Not yet" to real payments. No hosted instance, which is scored in B4. |
| A4 Innovation | **5** (held) | The findable per-shop agent door, order by Claude Code from the URL alone, server-set prices, photo-to-catalog. Checked live: door, `agents.txt`, `rel="alternate"`. |
| A5 Presentation readiness | **5** (held, **scored from the old video**) | `shelfie-demo.mp4`, 2:39.9, sound-tested in the earlier video rounds. The sheet shows problem, sourced statistic, three steps, Claude Code from the shop's address, the allergy catch, the refused price and the closing card. **It shows the retired dashboard, not this round's shell and landing page**, and it isn't on YouTube. Fix 2. |
| **Total** | **25/25** (round 11: 25) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **5** (held) | The landing H1 says it in one line: "Your price list, open to AI shoppers." |
| B2 Implementation | **5** (held) | 2210 unit tests passed on HEAD (run by me). 507 e2e passed, 9 skipped, with the real cart capture (log). The press, assistant, cart and accounts specs measure behaviour rather than markup (`e2e/tactile.spec.ts`, `e2e/assistant-layout.spec.ts`). |
| B3 Depth | **5** (held) | Flagged lines ("2 for $7", crossed-out price, market price) stop publishing until resolved. Flavour conflicts are handled (`src/lib/library/match.ts:125`), and the citrus cake now gets `cake-whole-2` live, not chocolate. Failed-publish retry, capture holds and rate limits have their own screens. |
| B4 Usefulness | **4** (held) | Self-serve accounts remove the last in-app barrier, but there is still no hosted instance (`README.md:159` "**Not yet run.**"), so no seller can use it this week. *Fix:* fix 1, deploy step. |
| B5 Innovation | **5** (held) | As A4. |
| **Total** | **24/25** (round 11: 24) | |

## Part C

**Banned 2026 patterns, per screen** (2 or more fails a screen). Live or `round-12/`, at 390 and 1440.

| Screen | Patterns found | Count |
|---|---|---|
| Landing | none. White page, Figtree, photos; the four step cards each hold different content. | 0 |
| Shop, item sheet, cart | none | 0 |
| Orders, Menu, Share, Settings, `/shops`, `/account` | none. Status is a dot and a word. The recovery banner is a single warning, not a page background. | 0 |
| Setup review | **small grey sentence under almost every element**: "Example photo, replace with yours" still sits under every row (`setup-review-390`) | 1 |
| Order detail | **icon on most labels** in the brief card (`order-paid-with-brief-390`) | 1 |
| Receipt, auth, help, legal | none | 0 |

Maximum 1, so no screen fails.

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | Sweep: at most one black control per screen at both widths, excluding the hidden skip link. On the 390 assistant view the second is the bar behind the sheet's backdrop. |
| Loading, success, empty and error states | **Pass** | `round-12/`: reading, publishing, retry, failed, counter's four states, console thinking/error/rate-limited, `cart-error`, `dashboard-loading`, receipts. README labels which are mocked. |
| WCAG AA, keyboard, focus, alt | **Pass** | axe: 0 of 102 (my parse), and `e2e/tactile.spec.ts:497` at both widths. Focus ring visible on the composer (`assist-1440-end.png`). Tile alts say "…, example photo". |
| Phone width, targets ≥ 44 px | **Pass** | Sweep: `scrollWidth` equals viewport on all 40 loads. Sound toggle 44×44, switches 48×44. The sub-44 items flagged were form labels beside a ≥44 control. |
| Plain copy, no placeholders | **Pass, with a slip** | Copy is plain. "View order · 2$8.50" is a rendering bug rather than wording (fix 3). |
| No generic AI look | **Pass** | No gradient, glass, glow or emoji. |
| No empty hero, no three identical cards | **Pass** | The hero tells the paper → shop → order story; the four cards differ. |
| No lorem, no fake stats | **Pass** | Fixture orders are labelled in the README. Landing figures are an illustrative order. |
| Deliberate type, palette, spacing | **Pass** | Figtree, one pomegranate accent, PayPal blue only on the PayPal action. |
| Banned 2026 patterns | **Pass** | Max 1. |
| Images, not stand-ins | **Pass** | Photos, examples or drawings in every slot seen; the assistant's avatar is the logo. |
| Real-product check | **Pass** (from memory, see above) | Shop page and item sheet read like Toast or Uber Eats. Orders reads like Square. The "2$8.50" bug is the one thing a designer would stop at. |
| Tokens defined once | **Pass** | `globals.css`, including press durations and scales. |
| Type scale, line length | **Pass** | Seller H1s all 24 px. |
| Consistent components, purposeful motion | **Pass** | One shared Button, one press system (`globals.css:607-660`). Recordings show the hero's single story and the docked assistant sliding in without moving the page's left edge. |

**Part C: 0 fails** (round 11: 0).

## Proposed checks

Measured at 390 and 1440. **A fail here blocks this run's sign-off.**

| Check | Result | Evidence |
|---|---|---|
| **Assistant placement** | **Pass** | **1440:** top 0, right 1440, bottom 900 at scrollY 0, 787 and 1751 (`pw/assistant.cjs`; `assist-1440-end.png` with the composer inside, footer visible behind). **390:** top edge **12 px** in empty, thinking, every streaming sample and full; composer bottom 832, in view every time. Never starts mid-screen. Frames: `cs-assistant-*`, `burst-assist-1440`. |
| **Felt response** | **Pass** | First computed-style change after pointerdown: **mouse 4-19 ms; touch 114-132 ms** on button, text link, FAQ row, `+`, tile, order row, nav link. **Switch:** the button doesn't move and its thumb flexes at **104 ms** on touch (`press-switch`). No layout width change: `Save` 130 → 130 px while "Saving…" at 1440, 350 px full width at 390; `Send` holds its width with the spinner (`as-390-thinking.png`). Hover lift only on `Pressable`, used on rows that navigate or open (`Menu.tsx`, `OrderCard.tsx`). **Navigation held at 2.5 s:** bar visible by ~300 ms (602 px at 1440, 163 px at 390), creeping at 1200 ms. |
| **Felt response: sound switch** | **Pass** | **Footer, both widths:** on → off, `aria-pressed=false`, survives reload, and **0 oscillator starts** on a press after reload (1 when on). **Settings, both widths:** the switch goes off and stays off after reload. |
| **A real front door** | **Pass** | Logged out, first screen at 390 and 1440 offers `Add your shop` and `Log in` (`landing-*-first.png`). Stranger's journey above, both widths. No demo login: no "demo" text in `src/app/(auth)`. Example shop: **3** appearances (hero story, step 1's photo, "See an example shop"); it is named once in the page text. |
| **No slide screens** | **Pass** | Seller H1s 24 px on Orders, Menu, Share, Settings, Card, Live, Order, Shops, Account, Add a shop; `StepHeader.tsx:54` for review. I read "working screens" as seller and setup screens: buyer status and auth pages keep 30-40 px H1s. At most one black button. No grey box holding only a heading and buttons (the Menu's "Photos in one go" has a sentence, so it is the closest). Every seller screen has the shell, or a header with logo and account menu (`account-menu-1440`). Landing has exactly 4 parts. |
| **Proper placing** | **FAIL** | **Passes:** 2 complete photos above the bar at 390 on the demo shop and my shop (photos end at 746, bar at 767); 3 complete photos at 1440 (end at 892 of 900, name and price below the fold); no hole (a lone last tile becomes a full-width row, `after-add-390.png`, Focaccia and Drip coffee); seller lists share the row system. **Fails on "no text wraps alone onto its own line at 390 px":** item names break to a single word. "Country sourdough / **loaf**" (`s-shop-390.png`, on the phone's first screen of my live shop) and "Olive oil citrus cake – / **8"**" (`cs-assistant-390.png`, in `assistant-390.webm`, demo shop). Computed `text-wrap` on those `h4`s is `wrap`: `globals.css:695-699` balances only `h1`-`h3`, and the tile name is an `h4` (`Menu.tsx:86`). |
| **Honest claims** | **Pass** | Sentence present on all 20 screens at both widths in the sweep (footer or sidebar), including receipt, cart page and setup. No pricing claim found (grep and read). "Not yet", "doesn't send email yet" and "can't reset it for you yet" state today's limits and promise no date, so I pass them; the owner may prefer them without "yet". The footer's "Open source on GitHub" link is a 404 until the repo is public. |

**Failed: Proper placing. Sign-off is blocked until it passes.**

## Round 11's top fixes

1. **Publish and submit: not done.** GitHub API still 404. `SUBMISSION.md:92-94` still has 3 TODOs. Not on YouTube. No score moved.
2. **Example photos, tidy the copy: mostly done.**
   - **Done:** the citrus cake gets `cake-whole-2`, live, with flavour logic in `match.ts:93-134`; the hero's bun is $3.50; the Menu tab's count is pluralised (`src/lib/seller/shell-view.ts:55`, so no more "1 items").
   - **Not done:** "Example photo, replace with yours" still sits under every row of the review, so that screen keeps its 1 banned pattern.
   - Scores held; A2 and B3 were already 5, and this protects them.
3. **Deploy to Render: not done.** `README.md:159` still says "Not yet run". B4 held at 4.

## Top 3 fixes (ranked by Part A gain)

Fix 3 comes last on Part A gain but should be done **first in time**: it alone blocks sign-off.

1. **Human: publish and submit (protects all of Part A: without it the entry fails Stage One).** Due 12 Nov 2026, 12:00 PT.
   - Secret-scan the history, make `codebreaker32/paypal-ai` public, confirm the API returns 200 and the LICENSE shows in About (this also makes the footer's GitHub link work).
   - Upload the re-recorded video to YouTube as public, fill `SUBMISSION.md:92-94`.
   - Deploy per `docs/DEPLOY.md`, update `README.md:159` (B4 4 → 5).
2. **Later in run: re-record and re-render the video on this round's UI (protects A5 at 5).** The current cut shows the retired dashboard and no sign-up. Do it before fix 1's upload, on a build that includes fix 3.
3. **Coder: stop lone words and fix the order bar (unblocks sign-off, protects A2).**
   - Add `h4` to the `text-wrap: balance` rule at `globals.css:695-699` (or `text-balance` at `Menu.tsx:86`), then re-check at 390: "Country sourdough loaf", 'Olive oil citrus cake – 8"'. Add an e2e assertion that no tile name ends on a one-word line.
   - `ShopAssistant.tsx:390-392`: `[&>span]:flex` styles the Button's outer layer, but the two spans sit in an inner plain `<span>` (computed `display: block`), so the gap never applies. Wrap the two spans in one `flex items-baseline gap-2` element so the bar reads "View order · 2   $8.50".
   - While there: one "Example photo, replace with yours" above the review list instead of under every row.

## Verdict: **fix**

Part A **25/25** (held), Part B **24/25** (held), **0 Part C fails**, so the rubric's ship bar is met. **Proposed check "Proper placing" fails, and that blocks this run's sign-off.**

**This round delivered, and I saw working:** a stranger signing up and publishing a real sandbox shop in about 30 s at both widths; an assistant that stays put at every scroll position and state; presses that answer inside 150 ms; a sound switch that persists; and a real cart reaching PayPal. What's left is one CSS rule and one label bug for a coder, the video re-record, and the human's publish and deploy steps.

## Recheck of Proper placing

**Result: PASS.** Scope was this one check only. Measured with Playwright on a production build of the current source, freshly seeded demo shop (`/s/marigold-bakehouse`, 10 tiles, 9 of them published to the PayPal sandbox), at 390x844 (mobile, touch) and 1440x900.

| Part of the check | Measured | Result |
|---|---|---|
| At least two complete photos on a phone's first screen | Country sourdough loaf and Seeded rye photos: top 619, bottom 746. The order bar starts at 767, so both end 21 px above it and have loaded. The third photo is off screen. Their names sit behind the bar (name bottoms 802 and 778), as in the original round. | Pass |
| One complete row on desktop | First row is all 3 Breads tiles (the section has 3 in a 4-column grid): photos 691 to 892 of 900, none cut. Only 8 px to spare. Names and prices fall below the fold (924), so I read "complete row" as complete photos, as the original round did. | Pass |
| No hole from a lone last item on a phone | Breads (3 tiles): last tile Focaccia is 350 px of a 350 px grid. Coffee (1 tile): Drip coffee is 350 of 350. Pastries (4) and Cakes (2) end in two 169 px tiles. Hole on the right of each last row: 0 px in all four sections. No sideways scroll (`scrollWidth` 390). | Pass |
| Seller lists share one row system | Menu and Share at 390 and 1440 render `[data-slot="panel-list"]` with the same row metrics (`min-height` 72 px, padding 20 px / 16 px). No other list markup in those tabs except the app's own navigation. A fresh shop has no orders, so Orders was read from source only: `OrdersPanel.tsx:141,158,165` and the shops list `(list)/page.tsx:31` use the same `PanelList`. | Pass |
| No text wraps alone onto its own line at 390 | Word-by-word line measurement of every text block on the page, by client rects. Tile names, all now `text-wrap: balance`: **"Country / sourdough loaf"** and **'Olive oil citrus / cake – 8"'** (both named in round 12), and "Focaccia – / rosemary & sea salt". The other 7 names fit on one line. No tile name ends on a one-word line at 390, nor at 360, 375 or 412. | Pass |
| Order bar after adding items | Added two items at 390: the bar reads **"View order · 2   $19.50"**. The count's text ends at 269.7 px and the total starts at 277.7 px, a visible **8 px** gap on one line, nothing truncated (`display: flex` on the spans' parent). Screenshot confirms. | Pass |

**Descriptions.** No description's last line is a single word on the shop page, so there is no fail here. The two descriptions the demo shop has, "(caraway, sunflower)" and "contains nuts!", each fit on one line at 390. Since the seeded shop has no two-line description, I also swapped 17 test descriptions into a tile at its real 169 px width (in the browser only, nothing stored): none left a lone word on the last visible line. "Pretty" holds the two-line cases ("Sourdough starter, flour, / salt, water"), and longer text clamps at two full lines.

**One thing flagged by the measurement, not a fail.** The only block whose last line is one word is the `claude mcp add` command in the shop page's agent door: it breaks to "claude mcp add --transport http / marigold-bakehouse / http://localhost:3129/s/marigold-bakehouse/mcp". The URL can't fit on a line with anything else (`overflow-wrap: anywhere` on a `pre`), and the block is a copyable command inside a `<details>` that is closed by default. It is a code snippet, not running text, so I don't count it against the check. The same command appears on the seller's Share tab, with the same reasoning.

The item sheet at 390 has no wrapped text in the case I opened (Seeded rye).

**Round 12's Proper placing failure is fixed; this check no longer blocks sign-off on these grounds.** I did not re-score anything else in this round.
