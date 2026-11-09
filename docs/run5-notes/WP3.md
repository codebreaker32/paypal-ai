# WP3 notes: first screen, grid and item tile

Built: the First screen table (`s/[slug]/page.tsx`: cover `h-32`/`sm:h-44`/`lg:h-60`, name in `type-display`, about 16/18, price list in the avatar's row under 640 px); `shop/menu-grid.css` (the brief's CSS, verbatim); the addendum's Item tile in `shop/Menu.tsx` (server module), `shop/ItemOpen.tsx` and `shop/AddControl.tsx` (the only client islands), `shop/cart-context.ts` (`useCart()`, inert with no provider), `shop/tile.ts` (pure: `tilePrice`, `orderableOptions`), `shop/ExampleNote.tsx` (now a server-safe span). Tokens `--tile-gap-x/y`, `--add-hit`, `--add-face` in `globals.css`. `docs/DESIGN.md` updated.

Existing tests edited: none. Tests added: `tests/components/menu-tile.test.ts`, `e2e/tiles.spec.ts` (WP3 acceptance 1, 2, 3, 4, 8, the state table, paused shop, the price list row).

## Deviations

| Where | What | Why |
|---|---|---|
| Intro grid | At 56rem+ of page width the about text and the pickup/shipping lines share one row (three grid columns) | With them stacked at 1440x900 the first row of photos ended at 982 px; the brief's acceptance 4 needs it above 900. The table's lines stay "right of pickup and shipping" as asked. |
| `Cover` | `lg:pt-4` instead of `sm:pt-6` at `lg` | Same acceptance, 8 px. |
| Intro→menu gap | `gap-8`, `@[56rem]/shop:gap-6`; tabs→sections `gap-4` | Same acceptance. The brief set no value for these. |
| Paused banner | Now sits under the name row, above the about text | The about and pickup lines share a row at 56rem+, so the banner has to come first. |
| Section gap | 40 px, then 56 px at a **viewport** width of 56rem (`min-[56rem]:`), not the page's container | The brief's 56rem step sits exactly where a dock at 1440 crosses it, and it would change the gap between the anchor and the heading under it (`e2e/assistant-layout.spec.ts` A15). Tracks still follow the container. |
| `keepPlace` (`ShopAssistant.tsx`) | Holds the anchor at its middle, not its top | With photo tiles a row's height changes with the track count (9 px at 1440 docked); both A15 tests need the shift shared between that tile and the heading under it. The anchor element is unchanged. |
| `@container/shop` div | `transition-none` | Under reduced motion the global 0.01 ms transition on the Intro gap landed a frame late, after `keepPlace` read the layout. |
| `--tile-gap-*` | Root tokens are from 640 px as the addendum says, but `.menu-grid` sets its own by container (the brief's verbatim CSS) | Both instructions kept; the grid uses its local value, root tokens are free for WP3b. |
| No-cover shops | The price list link stays below the pickup lines at every width | With no avatar over a cover there is no avatar row for it to join. |
| Copy | `Some photos are examples, not the shop’s own.` uses `’` | As the rest of the page's copy. |

## For WP3b (cart and sheet)

- Provide `CartContext` (`shop/cart-context.ts`) from `ShopAssistant`, value `CartApi`: `quantity(itemId)`, `add(itemId, optionId)`, `decrement(itemId)`, `openItem(itemId, opener)`. Until then tile taps and `+` do nothing (inert default).
- `AddControl` shows the `− n +` pill for any item in the order, including items with several options; `decrement` removes from that item's most recent line (the spec does not say which line).
- `feedback('add')` is not called from `AddControl`; both `+` and the sheet's add go through `cart.add`, so fire it there (WP1B's note about one sound per press applies).
- The `+` on a two-or-more option item has `aria-haspopup="dialog"` and opens the sheet through `openItem`; a single-option `+` adds directly.
- Press feedback for the tile comes from `data-stretched-link` on `ItemOpen`, which Tactile routes to the `Pressable`.
