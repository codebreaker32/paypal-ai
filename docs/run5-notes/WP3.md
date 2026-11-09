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

## Draft and composer

Built: `shop/console-draft.ts` (pure: `draftWithItem` with the exact strings and the 500-character guard, `sendsOnEnter`, `composerHeight`; `tests/components/console-draft.test.ts`), draft state and `openWithDraft` in `useBuyerConsole`, `ConsoleComposer` as an auto-growing `textarea`, and the `[data-order-item]` click delegate in `ShopAssistant`. `e2e/composer.spec.ts` covers the composer at 390 and 1440 and the draft path. Existing tests edited: none. `e2e/assistant-layout.spec.ts` passes unedited (67).

| Where | What | Why |
|---|---|---|
| `useBuyerConsole(slug, { takesOrders, onOpen })` | The hook takes the shop's order state and how to open the console | The brief puts `openWithDraft` in the hook, but `open` and its history stay in `ShopAssistant`. |
| `ConsoleConversation` | Wrapped in `memo`, comparing only `api.state` of the api | The draft moved up beside the conversation; without this every keystroke re-renders every message. |
| `sendsOnEnter` | Also refuses key code 229 | Safari ends the composition before the confirming Enter's keydown, so `isComposing` alone would send it. |
| Composer padding | `py-[11px]` instead of the Textarea's `py-2.5` | One line of 24 px then fills the 48 px control exactly, as the old input did. |
| Start over | Leaves the draft alone | As before: `reset` never cleared what the buyer had typed. |

## For WP3b (cart and sheet)
- The sheet's "Ask the assistant" control: put `data-order-item={item.name}` on it (the `ShopAssistant` delegate calls `openWithDraft`), or call `api.openWithDraft(name)` directly. A tile must not carry the attribute.
- Close the item sheet as part of that press. `show` records `document.activeElement` as the opener and, on phones, pushes `?assistant=1`, so settle the `?item=` history entry first.

- Provide `CartContext` (`shop/cart-context.ts`) from `ShopAssistant`, value `CartApi`: `quantity(itemId)`, `add(itemId, optionId)`, `decrement(itemId)`, `openItem(itemId, opener)`. Until then tile taps and `+` do nothing (inert default).
- `AddControl` shows the `− n +` pill for any item in the order, including items with several options; `decrement` removes from that item's most recent line (the spec does not say which line).
- `feedback('add')` is not called from `AddControl`; both `+` and the sheet's add go through `cart.add`, so fire it there (WP1B's note about one sound per press applies).
- The `+` on a two-or-more option item has `aria-haspopup="dialog"` and opens the sheet through `openItem`; a single-option `+` adds directly.
- Press feedback for the tile comes from `data-stretched-link` on `ItemOpen`, which Tactile routes to the `Pressable`.

## Checkout route (`POST /api/checkout/[slug]`)

Built exactly as addendum section 5 says, server side only: `src/app/api/checkout/[slug]/route.ts` (same-origin, rate limit `checkout:<ip>` before reading the body, strict zod, `priceOrder`, `PRICE_CHANGED` with no PayPal call, `createOrderForShop`, `CHECKOUT_STALE`, 201), `src/lib/orders/checkout.ts` (the zod schema and the buyer-facing copy) and `src/lib/domain/storefront.ts` (the reserved name, the window, `approvalMinutes`). Tests: `tests/api/checkout-route.test.ts`, `tests/checkout/storefront.test.ts`, `tests/checkout/agent-door-name.test.ts`.

| Where | What | Why |
|---|---|---|
| `sameRequestOrConflict` (`service.ts`) | Compares the buyer note too, when one is given | SR27's "changed note on retry". Without it a retry returned the old order with the old note. It also applies to the agent door; an omitted note still matches, so an agent's plain retry is unchanged. |
| Route | Sends `buyerNote: note ?? null` | The addendum says `buyerNote: note`. `null` makes a note dropped on a retried request id a conflict too. |
| Route | `CHECKOUT_STALE` also when `expiresAt` has passed on an order still `awaiting_approval` | The cart lives 24 hours and the client keeps a request id while nothing changes, so a retry can come after the window with the poller not having marked the order. The old link must not be handed back. |
| Route | `PRICE_CHANGED` after create as well as before it | SR27. A retry can return an order stored at an older price. The stale check runs first. |
| `isStorefrontAgentName` | Refuses any name that normalises to the reserved one (case, spacing, punctuation, control characters), and is applied to the MCP client name as well as `?agent=` | `clean()` strips control characters when storing, so `shelfie%00-storefront` would otherwise have become the exact name. |
| 60-minute copy | The receipt, the seller's timeline and action text, and `get_order_status`'s expired message now use `approvalMinutes(agentName)` | SR28's 20-minute window would have made "the link works for 60 minutes" false on these orders. `ReceiptOrder.approvalMinutes` is optional and sent only when it isn't 60, so `GET /api/orders/[ref]` is unchanged for agent orders (`tests/agent/routes.test.ts` passes unedited). |
| Copy | `’` instead of `'` in the addendum's strings | As the rest of the shop's copy. |
| Copy (ours, the addendum gives none) | Shop-wide limit: `{Shop} has a lot of orders waiting for payment right now. Try again in a few minutes. Your items are saved here.` Also `CHECKOUT_STALE`, `IDEMPOTENCY_CONFLICT`, `OPTION_REQUIRED`, `FULFILLMENT_REQUIRED`. | SR28 asks for a shop-wide line that doesn't blame the buyer. |
| `brief.ts` | `buildUserMessage` is now exported | So the `ordered_by_assistant: null` rule has a unit test without a stubbed agent run. |

Existing tests edited: `tests/auth/removal-guard.test.ts` (dropped `shelfie-storefront` and `api/checkout` from SR25's list, as the addendum instructs; the rest of the guard stays).

### For the cart client (WP3b), route contract
- Success: 201 `{ orderRef, number, approvalUrl, totalCents }`. Refusals: `{ error: { code, message, itemId?, scope? } }`. `message` is the buyer's copy from the addendum's table, ready to show; `itemId` is the line to remove for `UNKNOWN_ITEM`, `ITEM_UNAVAILABLE`.
- SR27: new `crypto.randomUUID()` whenever lines, fulfilment or note change, and on `CHECKOUT_STALE`, `IDEMPOTENCY_CONFLICT` (rotate and retry once) and `PRICE_CHANGED` (new total). SR30: check `isPayPalApprovalUrl` before navigating.
- The rate limit (30/hour/IP) and the per-client cap (3 open orders) are live under `SHELFIE_TEST` too, so a cart e2e should vary `X-Forwarded-For` or start its own server.
