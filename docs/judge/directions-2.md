# Visual directions, round 2: Storefront vs Feed

## What I judged
- The rubric `docs/JUDGING.md` (Part C and the 6 Nov amendment: 13 banned patterns, 2 or more on one screen fails, and the real-product check) and spec §4b (photo-first storefront).
- All 18 PNGs of each direction (9 screens at 390 and 1440): `direction-storefront/` in worktree `agent-ada03ed765930cfdb` and `direction-feed/` in worktree `agent-a502254ceea18b210`. I cropped and zoomed the details I cite below.
- The references in `.scratch/refs/` (`toast-bakeybabka-order-1440/390`, `toast-bakey-grid-1440-crop`, `toast-felipes-390`, `toast-local-390`, `square-bakery-1440`).
- Round 6's old design (`start-1440`, `shop-1440`, `console-empty-1440`, `dashboard-orders-1440/390`, `order-paid-with-brief-1440`).
- The code: each branch's `src/app/globals.css` (tokens), `layout.tsx` (font), `components/brand/Logo.tsx`, `components/ui/Card.tsx`, `components/dashboard/OrdersPanel.tsx` and `OrderCard.tsx`, the photo fallbacks (`shop/ItemPhoto.tsx` and `shop/Menu.tsx`), the order detail page and `BriefCard.tsx`. Both `axe-results.json` files: 18 screens each, 0 violations.
- I gave the most weight to the in-scope screens: start, shop, shop-no-photos, console and dashboard-orders. I used the receipt, the Menu tab and the order detail to see how well each direction's tokens carry.
- I did not read PROGRESS, DECISIONS, commit messages or worker notes.

What the two directions share: both dropped cream, serifs, mustard, dotted leaders, monospace prices, the highlighter stripe, zig-zag edges and the tag logo. Both use one sans family and a crimson-pink accent. Both have a cover photo, photo cards, a sticky phone order bar, a phone mockup on the start page, a thumbnail order list with status filters, and a new mark.

They differ here:
- **Storefront** is white with near-black buttons and the accent used sparingly (Figtree). It copies the Toast layout closely: horizontal cards with the photo on the right, a 2-column grid on desktop, thumbnail rows on phones, status shown as a dot and text, and a master list beside the order detail.
- **Feed** has a cool mist page, navy surfaces and raspberry buttons (Bricolage Grotesque). It looks more like an Instagram shop: an avatar over the cover, square photo tiles (4 columns on desktop, 2 on phones), a sidebar dashboard, pill status chips, and trimmed order-detail copy.

---

## Direction Storefront

### A2 Design: 4 / 5
- **For:** `shop-1440` sits beside `toast-bakeybabka-order-1440` and `toast-bakey-grid-1440-crop` without embarrassment. It has a rounded cover, a heavy name, a meta line, underline section tabs and 2-column horizontal photo cards with the price at the bottom left. `shop-390` matches spec §4b and `toast-bakeybabka-order-390` exactly: thumbnail rows and a full-width sticky black "Order with an assistant" bar. `dashboard-orders-1440` reads like Toast's or Shopify's admin. It has compact rows, a thumbnail, the ref and buyer, items, the brief, the total, a coloured dot with the status word, and one action per paid row. `order-paid-with-brief-1440` adds the master list on the left, the spec's "detail view". Across all 18 screens the type scale, the pill buttons, the radius and the single accent are consistent.
- **Against, and why it is not a 5:**
  - The wordmark renders as **"shelf ie"**, with a visible gap at the f-i pair, on every screen (zoomed from `start-1440`).
  - The same spacing fault shows in body text: "contain nut s", "bef ore shipping", "coff ees" and "SHF-ZQUT L5" (`dashboard-orders-1440`).
  - The dashboard content starts at x=64 while the header logo is at x=160 (`dashboard-orders-1440`, `dashboard-menu-1440`, `order-paid-with-brief-1440`).
  - Times are truncated to "10:…" (`dashboard-orders-1440`).
  - On phones the item-count badge floats below the thumbnail, detached from it (`dashboard-orders-390`).
  - The order detail still carries all of the old copy.
  - The rotated "PAID" rubber stamp on `receipt-paid-*` is kitsch.

### Part B items the visuals touch
The rubric has no "this is my shop" item; B2 is Implementation. The closest items are B4 Usefulness and B3 Depth.
- **B4 Usefulness: 4.** A baker would share `shop-390` and `shop-1440` today: their own photos lead and the page reads like their store. It is held below 5 by the long agent-door block at the foot of the shop, which a buyer doesn't need, and by the old copy on the order detail.
- **B3 Depth: 4.** The messy cases are designed:
  - `shop-no-photos`: a two-letter monogram on a per-section tint with a "shelf" rule, and an "Mb" tile when there is no cover.
  - "Ask in person", sizes ("S $3.00 L $4.00"), and refused, pending and expired orders (`dashboard-orders`).
  - Long names wrap ("Focaccia – rosemary & sea salt").
  - Truncation hides the times on desktop.

### Part C, per screen

| Screen | Banned patterns seen (where) | Count | Pass/fail | Real product? (beside the refs) |
|---|---|---|---|---|
| start (390, 1440) | none. White page, black pill CTA, sample chips, phone mockup of the real shop | 0 | pass | **Yes.** Reads like a Square or Toast product landing (`square-bakery-1440`): headline, one dark CTA, a real shop in a phone. Flaw: the floating "Order ready" card wraps its own header ("Order / ready", "• Checked with / you") and covers the phone's order bar |
| shop (390, 1440) | none. The item cards have the Toast card treatment (ring and soft shadow), which matches the reference | 0 | pass | **Yes.** Closest of the four candidates (both directions, old and new) to `toast-bakeybabka-order-1440/390`. The cover photo looks soft (upscaled) at 1440 |
| shop-no-photos (390, 1440) | none. The monogram tiles are deliberate, with tints per section | 0 | pass | **Yes.** It reads as a finished page without photos. The tiles are a little "avatar placeholder" at 390, but calm |
| console-empty (390, 1440) | hairline-bordered boxes (the panel, each of the 3 starter prompts, the input) | 1 | pass | **Yes.** A side panel on desktop and a bottom sheet on phones, like a store chat. The 5-line grey intro is still the old text |
| console-conversation (390, 1440) | hairline boxes (activity panel, approval card) | 1 | pass | **Yes.** The PayPal approval card is clear and the activity row is compact |
| receipt-paid (390, 1440) | none on the list. The rotated "PAID" stamp is receipt kitsch next to the banned zig-zag edges | 0 | pass | **Yes**, weakened by the stamp |
| dashboard-orders (390, 1440) | none. Status is a dot and a word, not a chip. Icons only on the two action buttons | 0 | pass | **Yes.** An ops list like Toast's or Shopify's. Flaws: misaligned container, truncated times, the floating count badge at 390, the spacing glitch |
| dashboard-menu (390, 1440) | none | 0 | pass | **Yes.** It is a plain list of toggles, though without thumbnails it is not photo-first yet (out of scope) |
| order-paid-with-brief (390, 1440) | (1) **hairline-bordered box around everything**: six white cards each outlined by the `--shadow-sm` 1 px ring on a white page; (2) **a small grey explanatory sentence under almost every element**: "Written by Claude from PayPal's record…", "Paste it from the label. Spaces are fine.", "From PayPal" ×2, "Name given to the assistant", "Prices come from your menu…", "This demo shop is paid…" | 2 | **FAIL** | **Yes** for the layout (master list plus detail). The copy and the boxes are the old design's |

**Part C fails: 1** (`order-paid-with-brief`, which is out of scope and was still being restyled). The in-scope screens have 0.

**Other Part C items**
- **Hierarchy and one primary action:** pass. Each screen has one black or PayPal-blue primary action (Snap, Order with an assistant, Approve on PayPal, Add tracking or Mark picked up per row).
- **Phone width:** no page-level horizontal scroll is visible. The filter row scrolls inside its own container. **Some targets are small:** the filter pills are `min-h-10`, which is 40 px (`OrdersPanel.tsx:111`). Everything else is visibly 44 px or more.
- **Plain copy:** pass on the in-scope screens. The order detail has too much.
- **Tokens and type scale:** a closed palette, a major-third scale and component tokens (`globals.css`), consistent on all 18 screens. The defect is the Figtree spacing at the f-i and t-s pairs.
- **Photo fallback:** deliberate, not a grey box (`ItemPhoto.tsx`, `shop-no-photos-*`).
- **Desktop uses its width:** shop yes (a 2-column grid and the sidebar), dashboard yes (columns across 1312 px), order detail yes (list, detail and side column).

### Microcopy (against round 6)
Counted from the screenshots and confirmed in the code:
- **Orders list:** the old list had about 61 words of explanation (the pause explainer, the 32-word "Most are waiting…" paragraph and the "hasn't approved…" line). Storefront has about 4 ("Link expires 11:20 AM"), **7 %**.
- **Order detail:** about 86 words in the old design, the same 86 here (identical strings in `BriefCard.tsx:64`, `TrackingForm.tsx:133` and `orders/[orderId]/page.tsx:67,152,187,239`), **100 %**.
- **Dashboard as a whole:** about 90 of 147 words, **61 %. Not under half.**

---

## Direction Feed

### A2 Design: 4 / 5
- **For:**
  - It has the most character of the four candidates: Bricolage Grotesque, navy surfaces, a raspberry accent and the Instagram-shop pattern of an avatar over the cover (`shop-1440`, `shop-390`).
  - `dashboard-orders-1440` is the strongest operations shell: a left sidebar with shop identity, live state, the pause toggle and navigation, rows aligned with the header, and time in its own right-hand column.
  - `order-paid-with-brief-*` cuts the copy hard ("Claude, from PayPal's record. Check before acting.", "Ship it, then add tracking. It goes to PayPal for the buyer.").
  - Tokens carry well to the receipt and the Menu tab.
- **Against:**
  - It departs from the spec on phones: the shop is a 2-column grid of square tiles, not "rows with thumbnails on phones" (`shop-390`).
  - Rendering glitches: a white notch sticks into the left edge of the dark order card (`shop-1440`, `shop-no-photos-1440`, cropped). The console header has a white corner at top left and a dark tab sticking out below it (`console-conversation-1440`, cropped).
  - The start-page bubble reads "Done. Your total is $19.00 ." with a stray spaced period (`start-1440`, `start-390`).
  - The start-page collage is busy: a dark dot-grid panel, a phone, two floating chat cards covering item names, and two floating item cards (`start-1440`). At 390 the approval card covers the phone's bottom edge.
  - On the phone dashboard, names are truncated first ("Sa…", "Dana Whit…", "No name …") while the ref and "via Shelfie Assistant" stay (`dashboard-orders-390`).
  - On the no-photo shop, giant cropped letters ("A B M", "C S F") outshout the item names and read like alphabet blocks (`shop-no-photos-*`).

### Part B items the visuals touch
Same mapping as above.
- **B4 Usefulness: 4.** The shop page is attractive and shareable. The phone grid shows about 4 items per screen against about 6 rows on Storefront's phone list, and the agent-door block is just as long.
- **B3 Depth: 4.** The messy cases are designed: the type-tile fallback, a dot-grid cover fallback, "Sold out today" and "Ask in person" on the tiles, and refused, pending and expired orders. Long-content handling truncates the wrong field on phones.

### Part C, per screen

| Screen | Banned patterns seen (where) | Count | Pass/fail | Real product? (beside the refs) |
|---|---|---|---|---|
| start (390, 1440) | none on the list. The dark dot-grid panel is a common AI-landing trope | 0 | pass | **Yes**, just: a SaaS-landing collage. Busier than `square-bakery-1440`, with the stray "$19.00 ." and cards covering the phone's items |
| shop (390, 1440) | icons on most labels (Pickup, Shipping, the "Pay with PayPal" shield, the robot, Ask in person, Agent door). Borderline, counted | 1 | pass | **Yes.** An Instagram or Uber Eats store with a square photo grid, but with the white notch glitch on the order card |
| shop-no-photos (390, 1440) | the same header icons | 1 | pass | **Yes**, weakly. The fallback is deliberate, but the giant letters dominate and no real storefront looks like this |
| console-empty (390, 1440) | none (the starter prompts are tinted fills, not boxes) | 0 | pass | **Yes.** The header corner glitch at 1440 |
| console-conversation (390, 1440) | none | 0 | pass | **Yes.** The dark tab under the header looks like a bug |
| receipt-paid (390, 1440) | none | 0 | pass | **Yes.** Clean, with a plain "Paid" pill |
| dashboard-orders (390, 1440) | (1) **boxed status chips everywhere**: a tinted status pill with an icon on every row, plus the "Live, taking orders" pill, count pills beside every heading, the filter pills and the "+1" badges; (2) **an icon on every label**: every nav item, every status chip, every brief line (sparkle), the warning lines and the buttons | 2 | **FAIL** | **Yes** for the shell (sidebar ops app). The chip and icon density is the old dashboard's habit in new colours. At 390 the truncation order is wrong |
| dashboard-menu (390, 1440) | icons on the sidebar nav (one surface, counted under dashboard-orders) | 0 | pass | **Yes** |
| order-paid-with-brief (390, 1440) | none. The white cards on mist have no outline and the copy is trimmed | 0 | pass | **Yes** |

**Part C fails: 1** (`dashboard-orders`, which is **in scope**).

**Other Part C items**
- **Hierarchy and one primary action:** pass. The raspberry primary is used consistently.
- **Phone width:** no page-level horizontal scroll is visible. The filter and category rows scroll inside their containers. The filter pills are `min-h-tap` (44 px). "View your shop" is `min-h-8`, 32 px (`Dashboard.tsx:158`), so it fails the 44 px target.
- **Plain copy:** pass, apart from the stray period.
- **Tokens:** a closed palette and the same scale. One oddity: `--raspberry-800: #b0174a` is lighter than `--raspberry-700` (`globals.css`).
- **Photo fallback:** deliberate (`Menu.tsx` TypeTile).
- **Desktop uses its width:** yes on all three surfaces.

### Microcopy (against round 6)
- **Orders list:** about 4 of 61 words, **7 %**.
- **Order detail:** about 37 of 86, **43 %** (`BriefCard.tsx:64`, `orders/[orderId]/page.tsx:67`; the paste hint, "From PayPal" and "Prices come from…" are gone).
- **Dashboard as a whole:** about 41 of 147, **28 %. Under half: yes.**

---

## Winner: **Storefront**
Storefront is the better base to carry across. Of the four candidates (both directions, old and new), it passes the real-product check most convincingly: `shop-1440` and `shop-390` are near pixel-level siblings of the Toast references. It is also the only one that builds the spec's phone layout as written (thumbnail rows and a full-width sticky bar).
Its in-scope screens pass Part C with 0 banned patterns. Feed fails on the in-scope dashboard because it carried the old dashboard's habit of a chip and an icon on everything.
Storefront's restraint gives a quiet system that a seller's own photos can lead: black primary buttons, the accent kept to the logo, tabs and counts, and status as a dot and a word. Feed's navy panels, dot grids and giant letters compete with the photos.
Storefront's problems are mechanical and cheap to fix: the copy and outline on one out-of-scope screen, a font-spacing bug, container alignment and truncation. Feed's are structural: the phone grid, chip density and several render glitches.

## Take from the loser (Feed)
1. **The order-detail copy, verbatim** (`BriefCard.tsx:64` and `orders/[orderId]/page.tsx:66-67`). Drop the paste hint, both "From PayPal" labels and "Prices come from your menu…". This brings the dashboard under half the old text.
2. **The desktop dashboard shell:** a left sidebar with shop identity, live state, the pause toggle and Orders · Menu · Share · Settings, aligned to the header's left edge (`dashboard-orders-1440`). Keep Storefront's phone tabs.
3. **Time in its own right-hand column under the total**, never truncated. On phones the buyer's name never truncates before the ref and "via …" (copy the 1440 layout, not Feed's 390 priority).
4. **Starter prompts as tinted fills, not hairline boxes**, and Feed's one-sentence greeting in place of the 5-line console intro (`console-empty-*`).
5. **"PayPal" on the sticky phone order bar** (`shop-390`), so a buyer sees how they'll pay before tapping.
6. **The shop avatar over the cover** when a cover exists (`shop-1440`). Storefront shows its "Mb" tile only when there is no cover, so a shop with photos loses its identity mark.

## Fix in the winner before the carry-across (ranked)
1. **order-paid-with-brief (both widths):** apply take 1, and drop the 1 px ring from cards on this page: put it on a `surface-sunken` page or use borderless sections with dividers. This clears the only Part C fail.
2. **Every screen: fix the Figtree spacing.** The wordmark reads "shelf ie", and the body text breaks into "nut s", "bef ore", "coff ees" and "SHF-ZQUT L5" (`dashboard-orders-1440`). Check `tracking-display` and `tracking-tight` and font-feature or ligature settings on the logo and the small text. Re-check in headless Chrome at 1x. While there, make the mark legible at 24–28 px: the jar and bun currently read as a generic "user" glyph.
3. **dashboard-orders, dashboard-menu and order detail at 1440:** one container. The content starts at x=64 while the header starts at x=160. Either align both or take Feed's sidebar shell (take 2).
4. **dashboard-orders:**
   - Never truncate the time (take 3).
   - Anchor the count badge to the thumbnail's corner at 390, where it now floats below the thumbnail, and make its meaning clear (for example "×3", or drop it).
   - Raise the filter pills from `min-h-10` to `min-h-tap` (44 px).
5. **console-empty (both widths):** cut the intro to one sentence and restyle the starter prompts (take 4).
6. **start-1440:** the floating "Order ready" card wraps its header into four lines and covers the phone's order bar. Widen it, or shorten it to "Ready to pay", and keep the phone's bar visible.
7. **shop (both widths):**
   - Use a sharper cover crop: the bakery cover looks upscaled at 1440.
   - Add "PayPal" to the sticky bar (take 5) and the avatar over the cover (take 6).
   - Collapse the agent-door block (URL and 4 client tabs) behind a single "Connect your own assistant" disclosure so the food stays the page.
8. **Carry-across:**
   - receipt-paid: drop the rotated "PAID" rubber stamp for a plain status line.
   - dashboard-menu: add item thumbnails and the photo control, so the Menu tab is photo-first like the shop.
   - order-paid-with-brief-390: the Country sourdough thumbnail is missing.
