# Production pass: addendum (owner decisions, 8 Nov 2026)

The owner reviewed the brief's open questions and said they want both a real cart and literal click sounds. **This file overrides `2026-11-08-production-pass.md` wherever they conflict.** Record both as "human decision, 8 Nov" in docs/DECISIONS.md.

## What this overrides in the brief
| Brief says | Now |
|---|---|
| Decisions: "Cart: Not built. A tile tap drafts into the assistant." | Build the cart and item sheet below. A tile tap opens the item sheet. The assistant stays available, and an "Ask the assistant" path stays in the item sheet (it drafts `I’d like the {name}` as the brief's "Tile to draft" describes, never auto-sending). |
| Decisions: "Sound: one order chime, no tap sounds" and "Haptics: seller area only" | Must-have, see **Click sounds**. S2 is promoted from should-have to must-have, and it is part of WP1's feedback system or a new WP1b. |
| WP3 tile: stretched button drafting into the assistant; WP3 acceptance 5 and 6 | Use the tile, states and tap target in **Tile** below. Keep the brief's grid, ratios, spacing, first screen and every other WP3 acceptance item. Replace 5 and 6 with: a tile tap opens the sheet; `+` adds with no sheet for single-option items; sold-out, ask-in-person and not-taking-orders tiles have no add control but still open the sheet. |
| WP2/WP3: `[data-order-bar]` and hero CTA only open the assistant | With an empty cart, keep the brief's design exactly. With items, use **Phone bar** below, and from 1024 px open the cart in the same right-edge dock as the assistant: one dock, one panel at a time, same viewport anchoring and the same WP2 acceptance on geometry. |
| Cut list and "Out of scope": cart and checkout, item sheet, quick add, tap sounds, header sound toggle, `Play it` | In scope. Still out of scope: live chime, sliding tabs and the other items on that list. |
| SR25 bans `shelfie-storefront` and `api/checkout` | Remove those two from the static guard. Keep the rest of SR25. |
| S2 acceptance: zero `AudioContext` on `/`, `/s/*`, `/o/*` | Replaced by the rule below: no `AudioContext` before the first user gesture, on any page. |
| Rubric addition "Felt response" | Unchanged, and judge also checks the sound off switch works and persists. |

Add the cart and sheet as **WP3b, must-have, immediately after WP3**. Build order is otherwise unchanged.

## Click sounds (must-have)
The owner said touching buttons feels silent and wants literal sound.
- **Every real press makes a soft tick:** every button, link, tab, switch, add control, stepper and row, on all pages, buyer and seller. Fire from the existing delegated `Tactile` listener at the moment `data-pressed` is applied. Never on hover, focus or scroll, and not for disabled controls.
- **Sound:** generated with `OscillatorNode` and `GainNode`, no audio files. `tick`: sine sliding 1400 to 900 Hz, 45 ms, peak gain 0.04, attack 6 ms, exponential decay, at most once per 60 ms. Also the `order` chime on the seller side as in S2 (E5 then A5 at +90 ms, octave partial at 25%, peak gain 0.14, about 450 ms, once per poll batch, at most once per 1.2 s).
- **Add to order** plays a slightly warmer tick (sine 900 to 650 Hz, 60 ms, peak gain 0.05).
- **Off switch, default on.** One boolean covering sound and vibration, key `shelfie:feedback:v1`, per device, in try/catch, read with `useSyncExternalStore`. Sellers: the Settings section `Sound and vibration` from S2. Buyers and logged-out visitors: a 44 px icon button in the footer, `Volume2`/`VolumeX`, `aria-pressed`, `aria-label="Sound"`. It must be reachable on every public page.
- **Rules:** no `AudioContext` before the first `pointerdown` or `keydown`; create or resume it then. `navigator.audioSession.type='ambient'` when present, in try/catch. Sound is never the only feedback: every press still has its visual response. System volume always governs. If audio fails, nothing else breaks.
- **Vibration:** the S2 patterns, on the same switch, seller and buyer, on `add to order`, `flip`, `success`, `error` and `order` only.
- **Acceptance:** with a spy on oscillator starts: one tick per press on a button, link, tab and switch at 390 and 1440; none on hover; none on a disabled control; none when the switch is off, and the setting survives a reload; zero `AudioContext` created before the first gesture; `a11y()` passes with the footer toggle.

## Cart security requirements (additions to the brief's table)
| # | Requirement | Test |
|---|---|---|
| SR26 | `POST /api/checkout/[slug]` is same-origin checked (SR2), rate-limited before reading the body, and strict zod refuses any price field. Totals always come from `priceOrder`. | Unit: price field gives 400; other-shop item refused; over-limit request does no pricing work |
| SR27 | Critique defect 14: the client uses a new `crypto.randomUUID()` whenever lines, fulfilment or note change. `IDEMPOTENCY_CONFLICT` maps to rotate and retry. After create, if `order.totalCents !== expectedTotalCents`, answer `PRICE_CHANGED`. | Unit, including a changed note on retry |
| SR28 | Critique defect 15: a 20-minute approval window for `shelfie-storefront` orders. Branch on `max_open_orders` versus `max_open_orders_per_client`, with separate copy for the shop-wide case that doesn't blame the buyer. | Unit on the window; e2e or unit on both copies |
| SR29 | Critique defect 21: `shelfie-storefront` is treated as null in `registerShopTools`, so an agent can't pose as the storefront. | Unit with `?agent=shelfie-storefront` |
| SR30 | The client navigates only after `isPayPalApprovalUrl` passes. The cart stores only `{itemId,optionId,qty}`; client totals are display-only. | Unit |

Seller-paid orders are paid by PayPal wallet login; guest card works only on the platform-paid demo shop. The cart's real capture test must use the US sandbox buyer login, and it joins the WP8 capture gate as one more real payment.

---
The design below is from the original cards specification and is the spec for WP3b. Where it conflicts with the table at the top of this file, the table wins.

### 2. Item tile

Structure of `li[data-menu-item]`, in order:

1. Photo in a `relative overflow-hidden rounded-(--photo-radius) aspect-[4/3] bg-surface-sunken` wrapper.
2. `h4` holding the item button.
3. Price row.
4. Description.

There is no card background or shadow. Update `DESIGN.md` to match.

**New tokens in `globals.css`:** `--tile-gap-x: .75rem`, then `1rem` from 640 px. `--tile-gap-y: 1.25rem`, then `1.75rem`. `--add-hit: 2.75rem`. `--add-face: 2.25rem`.

**Spacing:** photo to name 8 px, name to price 2 px, price to description 4 px. Section gap 40 px, then 56 px. Heading to grid 12 px, then 16 px.

**Truncation**

| Element | Rule |
|---|---|
| Name | 16/24 bold, clamped to 2 lines |
| Price, 1 or 2 options | Shown in full, for example `S $3.00  L $4.00` |
| Price, 3 or more options | `From $3.00 · 3 options` |
| Description | 14/20 `ink-muted`, clamped to 2 lines, so allergy notes stay visible |

The sheet always shows the full text.

**Tap target.** Put a `<button aria-haspopup="dialog" class="block w-full text-left -my-2.5 py-2.5 after:absolute after:inset-0">` inside the `h4`, so the whole tile opens the sheet and the button box is at least 44 px. Put the clamp on an inner span, not the button. Focus shows on the `::after`. The add control sits above it with `z-10`. Do not give the photo wrapper a z-index.

`Menu.tsx` stays a server module, because `menuSections` and `sectionId` are called or imported outside the client. Only `ItemOpen` and `AddControl` are client islands. Their `useCart()` returns an inert default with no provider, because `tests/components/example-photos.test.ts` renders `Menu` alone.

**Tile states**

| State | Photo | Text | Control |
|---|---|---|---|
| Orderable, 1 option | Normal | Name, price, description | "+" in the bottom-right corner, 6 px inset, 44 px hit, 36 px white face, adds 1 with no sheet |
| Orderable, 2+ options | Normal | Same | Same "+", opens the sheet |
| In order | Normal | Same | White pill `− 2 +`, 116 px. Keep the "+" button mounted so focus stays. When qty reaches 0, focus moves to "+" |
| Sold out | `dim` | Muted name and price | No control. White pill bottom-left, `Sold out today`, ink, bold |
| Ask in person | Normal | `Ask in person` replaces the price | No control |
| Shop not taking orders | Normal | Prices shown | No control |
| Example photo | Normal | Unchanged | Tile note fades in on hover or focus. It becomes a non-interactive `<span data-example-note>` and keeps the `opacity-0` and `group-hover/tile:opacity-100` classes. The sheet states it visibly |

All states still open the sheet. Seller menu order is kept, and sold-out items do not move.

**Motion:** the tile press uses `Pressable lift={false}`. The photo scales to 1.03 on hover, using transform only, and not under reduced motion.


### 4. Item sheet

Add an optional `media` prop to `src/components/ui/sheet.tsx`, full-bleed above the content, with the close button overlaid: 44 px and solid white. The console's use of the sheet does not change.

- **Phone:** bottom sheet at `max-h-[90dvh]`.
- **From 640 px:** centred dialog at 32rem.
- **Content:** 4:3 photo, name in `type-title`, price, full description, then controls.
- **Example photos:** caption `Example photo. The shop hasn't added its own yet.`
- **Options:** radio rows at least 48 px tall under the visible legend `Choose one`. The first is preselected.
- **Quantity:** stepper labelled `How many`, 1 to 20.
- **Footer:** primary `Add to order · $6.00`. Adding closes the sheet.
- **Unavailable items:** the footer is one plain line with no button: `Sold out today.`, or `Ask in person: the shop sets this price on the day.`, or `Not taking orders right now.`

**History:** opening uses `pushState` to `?item=<id>`, and Back closes the sheet. Close, Esc and backdrop call `history.back()`. A direct load of `?item=<id>` opens the sheet, and closing it uses `replaceState` to remove the parameter. An unknown id opens nothing and removes the parameter.

**Focus:** focus the sheet's title (`tabIndex={-1}`) on open, and return it to the opener on close.

### 5. Cart and checkout

**State.** `CartProvider` lives inside `ShopAssistant`. Each line stores only `{itemId, optionId, qty}`. Persist to `localStorage` as `shelfie:cart:<slug>` with a 24-hour TTL, all in try/catch, restored after hydration.

Join lines to the server-rendered menu on every load. Drop anything no longer orderable and show one line: `Seeded rye is sold out today, so we took it out.` Client totals are display-only.

Compute `orderable` on the server. Do not import `src/lib/orders/pricing.ts` into client code, because it pulls in the database repos.

**Route: `POST /api/checkout/[slug]`** (`runtime = 'nodejs'`). Rate-limit before reading the body, reusing `CREATE_ORDER_RATE` with the key `checkout:<ip>`. Read via `readJsonLimited`. Validate with a strict zod schema, so any price field is a 400:

```ts
{ lines:[{itemId,optionId?,quantity:1..20}] /*1..15*/, fulfillment?, note?:max280, expectedTotalCents:int, requestId:8..64 }
```

Steps:

1. Run `priceOrder`.
2. If the total differs from `expectedTotalCents`, answer 409 `PRICE_CHANGED` with no PayPal call.
3. Call `createOrderForShop` with `agentName: STOREFRONT_AGENT_NAME` (`'shelfie-storefront'`), `clientRequestId: requestId`, `clientKey: ip` and `buyerNote: note`.
4. If the stored order is not `awaiting_approval`, answer 409 `CHECKOUT_STALE`. The client rotates `requestId` and retries once.
5. Answer 201 `{orderRef, number, approvalUrl, totalCents}`.

The client checks `isPayPalApprovalUrl` before navigating. PayPal, the return URL, the poller, the webhook, payee snapshot and receipt are unchanged.

The `created` event keeps source `mcp`, with `agentName` in its detail, to avoid rebuilding the table for a CHECK constraint. Nothing reads that source.

`agentLabel('shelfie-storefront')` returns `your shop page`, giving "via your shop page". `src/lib/ai/brief.ts:145` sends `null` for these orders.

**Cart view**, shared by the desktop panel and the phone sheet:

- Lines with a 48 px thumb, name, option, stepper and line total.
- `Pickup` and `Shipping · $8.00` segments when the shop offers both, with Pickup preselected.
- Pickup notes, or `PayPal asks for your address.`
- `Note for the shop` (optional, placeholder `Allergies, timing`). This feeds the AI brief.
- Items, Shipping, Total in tabular figures.
- `paypal` button: `Approve $27.00 on PayPal`.
- One line: `You review and pay on PayPal. Nothing is charged until you approve.`

**States**

| State | Behaviour and copy |
|---|---|
| Empty (desktop) | `Your order`, then `Add something from the menu and it shows up here.` |
| In flight | Button `loading`, label `Opening PayPal…`, controls disabled |
| Over the order cap | Button disabled, inline `This shop takes online orders up to $500.00.` |
| `PRICE_CHANGED` | `Prices changed. Check your total, then try again.` plus `router.refresh()` |
| `ITEM_UNAVAILABLE`, `UNKNOWN_ITEM` | Remove the line, `{Item} is no longer available, so we took it out.` |
| `SHOP_NOT_ACCEPTING_ORDERS` | `{Shop} isn't taking orders right now. Your items are saved here.` |
| `TOO_MANY_OPEN_ORDERS` | `You have orders waiting for payment here. Pay one, or try again in an hour.` |
| `RATE_LIMITED` | `You've tried a lot in the last hour. Try again later.` |
| `PAYPAL_UNAVAILABLE` | `We can't reach PayPal right now. Your order is saved here. Try again in a moment.` |

Errors use `role="alert"` under the button. A single polite status region announces changes, for example `Almond croissant added. 3 items, $19.00.`

**After PayPal.** Save `pendingOrderRef` before redirecting. `src/app/o/[ref]/Receipt.tsx` clears the cart only when that ref matches and the status is `paid`, `payment_pending` or `fulfilled`. A cancelled or expired order keeps the cart.

**Phone bar**, keeping `data-order-bar`:

- Empty cart: exactly today's button.
- With items: a secondary `Assistant` pill (accessible name `Order with an assistant`) beside the primary `View order · 3   $19.00`. Text is 16 px.
- The order button opens the cart sheet with `?order=1` history.

