# Judge: visual directions A ("Menu board") vs B ("Counter ledger")

Inputs: `docs/JUDGING.md` (A2 and Part C), both screenshot sets (50 PNGs each, 390 and 1440), both `axe-results.json`, `globals.css`, `layout.tsx`, `docs/DESIGN.md` and components in each worktree, plus the round-1 baseline. Both directions show the same raw model note on the review card ("…350 cents. Matched by row position."). That copy is being fixed on main, so it doesn't count for or against either direction.

- **A** = `.claude/worktrees/agent-aca97641d8c3cd051`, screenshots `docs/judge/screenshots/direction-a/`
- **B** = `.claude/worktrees/agent-aa0f57521bd15d15a`, screenshots `docs/judge/screenshots/direction-b/`

Mechanical checks, both run by me:
- **axe:** 0 violations on all 50 screens in both directions. The least-passing screen still passed 18 rules.
- **Raw colour values:** `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(" src/components src/app --include=*.tsx` finds 0 hits in A and 0 in B.
- **Em and en dashes:** none visible in either. The only hit is a React `key` fallback in `ItemLists.tsx`.
- **Straight apostrophes:** they appear only in code comments in both.
- **Horizontal scroll:** both screenshot specs assert `scrollWidth − innerWidth` on every screen (`e2e/screenshots.spec.ts:212`).

## 1. A2 Design

| | Score | Evidence |
|---|---|---|
| **A: Menu board** | **4** | A complete product with a strong identity tied to the subject. Newsprint paper, blackboard ink and one marigold accent, with Playfair Display (justified in `DESIGN.md`: "the subject is literally a printed menu"), Schibsted Grotesk and IBM Plex Mono for every amount. The motif carries through every screen: the marigold highlighter on "AI shoppers." (`start-1440`); the public shop as a real menu with dotted leaders and italic section heads (`shop-1440`, `shop-390`); order slips with perforated bottoms on the dashboard (`dashboard-orders-1440`); a printed Items receipt (`order-paid-with-brief-1440`); and a rubber-stamp **PAID** receipt (`receipt-paid-1440/390`). Every round-1 rough edge is fixed: the 390 order-card header (`dashboard-orders-390`), curly apostrophes ("couldn’t", "didn’t" in `receipt-unknown-*` and `setup-failed-1440`), wrapping connect tabs (`shop-390`) and a full primary "Go to Shelfie" with an icon (`receipt-unknown-390/1440`). **Holding it at 4:** (1) at 390 the order-detail `h1` breaks the reference across lines, "Order SHF - / UY3KH6" (`order-paid-with-brief-390`, `order-shipped-with-tracking-390`), which is the same class of defect round 1 flagged; (2) on `setup-live-390` the cards run to x≈386, so the right gutter is 4 px against 20 px on the left; (3) the async states missing in round 1 (publishing progress, console thinking or rate-limited, "Writing the brief…", tracking error, "Can't reach PayPal") still appear in no screenshot. *Fix:* section 5. |
| **B: Counter ledger** | **4** | Clean, coherent and strongest on money. Cool ledger paper and graphite text, with cash green as both the accent and "money in". Archivo, IBM Plex Sans and IBM Plex Mono, with tabular figures. The dashboard is a real ledger: ORDER / ITEMS / STATUS / AMOUNT columns, right-aligned amounts and group subtotals, "Paid $43.50" and "Not charged yet $83.00" (`dashboard-orders-1440`). At 390 each order card's amount sits beside the reference (`dashboard-orders-390`). Order detail has a right-aligned **TOTAL $27.00** (`order-paid-with-brief-1440/390`), and totals are double-underlined (`receipt-paid-*`). All round-1 rough edges are fixed (`dashboard-orders-390`, `shop-390`, `receipt-unknown-*`), and I found no 390 layout defects. **Holding it at 4:** the same async states are unshown. The look is also generic fintech admin, and the seller's own shop reads as a hairline spreadsheet rather than their menu (`shop-1440`). *Fix:* screenshot the missing async states, and give the shop page a seller-owned treatment. |

## 2. Part C

| Item | A | B |
|---|---|---|
| Clear hierarchy, one primary action | **Pass.** Each screen has one marigold fill: Snap your price list (`start-*`), Publish 6 items to PayPal (`setup-review-*`), Copy agent door link (`setup-live-*`), Order with an assistant (`shop-*`), Send tracking to PayPal (`order-paid-with-brief-*`), Back to shop / Go to Shelfie (receipts). PayPal blue is kept for Approve (`receipt-awaiting-approval-390`, `console-conversation-*`). | **Pass.** The same structure with cash-green fills (same screens), and PayPal blue only on Approve. |
| Loading, success, empty and error states | **Pass** (gaps in evidence). Seen: `setup-reading`, `setup-retake`, `setup-failed`, `start-bad-file`, `start-photos-ready`, `dashboard-empty`, `console-empty`, and receipts awaiting, paid, refused, cancelled, expired and unknown. Publishing, console thinking or 429, "Writing the brief…" and the PayPal error banners exist in code but are still not screenshotted. | **Pass** (same gaps). Behaviour is identical. |
| WCAG AA, keyboard, focus, alt | **Pass.** axe: 0 violations on 50 screens. Text on marigold is ink (`--color-on-accent: ink-900`), and the accent is never used as text. Focus uses `--color-focus: ink-900`. | **Pass.** axe: 0 violations on 50 screens. White on cash-600, and focus uses `--color-focus: cash-700`. |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass**, with a defect. The spec asserts no overflow, and buttons are full-width `min-h-tap`. However, `setup-live-390` cards break the right gutter (4 px against 20 px), which is visible but doesn't cause a page scroll. | **Pass.** Gutters are symmetric at 16 px on every 390 screen I checked. |
| Plain, specific copy | **Pass**, excluding the model note that is being fixed on main. The copy is shared with B, and "Nothing is charged until you approve on PayPal" is plain. | **Pass**, on the same basis. |
| No generic AI look | **Pass.** No gradients, glass, glow or emoji. Icons are Lucide (an existing project dependency). | **Pass.** None of the banned tells. The green-on-off-white fintech look is safe rather than sloppy. |
| No empty hero, no three identical cards | **Pass.** The hero is the product: a real menu photo, the assistant's conversation and a PAID slip (`start-1440`). The three sample cards are working entry points with distinct photos. | **Pass.** Same hero and same sample cards. |
| No lorem, no fake stats | **Pass.** Fixtures are labelled in the screenshot README. | **Pass.** |
| Deliberate type pairing, palette and spacing | **Pass.** Playfair (menu serif: roman titles, italic menu sections), Schibsted Grotesk (UI) and Plex Mono (money, receipts). This moves off Fraunces, which the taste skill bans as a default, to a serif with a stated reason. The newsprint, blackboard and marigold palette is tied to menu boards. Spacing is on a 4 px base with named tap, gutter and section tokens. | **Pass.** Archivo (display), Plex Sans (UI) and Plex Mono (references). Cash green means money received. Strict 4 px grid. |
| Tokens defined once, used everywhere | **Pass.** Three layers in `globals.css`, with `--color-*`, `--text-*` and `--radius-*` set to `initial`. 0 raw hex values in `.tsx`. The only arbitrary value is the logo size, `text-[1.625rem]` (`Logo.tsx:9`). | **Pass.** Same three layers, 0 raw hex values and 0 arbitrary text sizes. |
| Type scale and line length | **Pass.** Major third from 16 px (smallest step 13 px), and `--container-measure: 36rem`. Body copy stays within about 75 characters (`setup-live-1440`, `receipt-paid-1440`). | **Pass.** 2 px steps up to 20 px, then a minor third. Same measure. |
| Consistent components, subtle motion | **Pass.** The receipt-slip motif (dashed rules, perforated edge, mono totals) is the same on start, console, dashboard, order detail and receipts. Duration tokens and `motion-reduce` are used. | **Pass.** Ruled panels, uppercase stamps and double-ruled totals are consistent everywhere. Same motion tokens. |

**Part C fails: A 0, B 0.**

Anti-slop notes (from the `design-taste-frontend-v2-experimental` audit; none rises to a fail):
- **A:** the paper is near the skill's "warm paper" family, but the accent is marigold rather than brass or oxblood, and the ink is green-black rather than espresso, both with a stated reason. Metadata lines use two middle dots ("Dana Whitfield · via Claude · 12:14 AM").
- **B:** uppercase tracked stamps are everywhere: LIVE, TAKING ORDERS, PAID, CHECK THIS, ALLERGY, TIMING, TOTAL, column heads and a "PAYPAL SANDBOX" nav label. The shop menu draws a hairline under every row (`shop-1440`), the "spec table" tell.

## 3. Winner

**Direction A ("Menu board").** It is the only one that makes a home baker feel "this is my shop": the public page reads as their own menu, and orders arrive as kitchen slips. It also gives the 3-minute video moments a judge will remember (the highlighted hero and the stamped PAID receipt). Its money moments are already clear (mono amounts, receipt totals, PayPal blue reserved for approval), and B's ledger strengths are easy to graft on.

## 4. Take from the loser (B into A)

1. **Dashboard group subtotals** (`dashboard-orders-1440`, B's `Subtotal` in `src/components/dashboard/OrdersPanel.tsx`). Put "Paid $43.50" right-aligned on A's "To prepare" header row, and "Not charged yet $83.00" on "Waiting for payment". Use A's mono `type-price`.
2. **Amount in the order-slip header on phones** (`dashboard-orders-390`). At 390, show the slip's total beside `SHF-…` in the top row, so money is visible before the AI brief. Keep A's "Total" footer line as the receipt line.
3. **Order detail TOTAL block** (`order-paid-with-brief-1440/390`). Replace A's small inline "$27.00 · placed by Claude" with B's labelled, right-aligned "Total $27.00" at display size, and keep "Placed by Claude, 12:12 AM" as the sub-line.
4. **Review "Ready for PayPal" rows with a price column** (`setup-review-1440`). Right-align each price before "Edit", as B does, instead of placing it under the name. Ideally use A's own dotted-leader menu row from `shop-1440`, so the catalog the seller checks looks like the menu buyers will see.

## 5. Fix in the winner before merge

1. **`order-paid-with-brief-390`, `order-shipped-with-tracking-390`:** the `h1` splits the reference, "Order SHF - / UY3KH6". *Fix:* add `whitespace-nowrap` to the `{order.number}` span in `src/app/shops/[id]/orders/[orderId]/page.tsx:316`, so the line breaks after "Order" if anywhere, and re-shoot both.
2. **`setup-live-390`:** the Agent door, See it work, Shop link, For developers and Your owner link cards span x≈20 to 386, so the right gutter is 4 px against 20 px on the left. B's identical grid is symmetric, so a grid child's min-content width is wider than the column in A's fonts. *Fix:* add `min-w-0` to the grid children in `src/components/setup/LiveStep.tsx` (`LinkCard` and the two `Card`s under the `grid … lg:grid-cols-12` at line 159), or use `grid-cols-[minmax(0,1fr)]` below `lg`, and re-shoot.
3. **`console-conversation-1440` (and the top strip of `-390`):** the sheet opens scrolled so far down that the "Activity · 1 call to the agent door" header is hidden or clipped under the sheet title (B shows it fully in the same state). In a video it looks cut off. *Fix:* after a reply, scroll so the start of the latest turn (the activity card) is aligned to the top of the log, or add `scroll-padding-top` equal to the header height.
4. **Missing async-state screenshots, which are what holds A2 at 4:** add A-styled captures of publishing progress, partial failure → Retry, console thinking, rate-limited and tool-error, "Writing the brief…", the tracking PayPal error and the "Can't reach PayPal" banner to `e2e/screenshots.spec.ts`. Check that they use the slip and stamp language, not plain spinners.
