# Shelfie: design spec

_Status: approved by the coordinator on 2026-11-06 (session 1). Judge round 0 (`docs/judge/round-0.md`) picked approach 1 (seller-first, Part A 19 / Part B 21) over approach 2 (agent-first, 18 / 19). This spec is approach 1 plus the judge's three fixes and the items it said to take from approach 2 (shipped order with tracking, Inspector tamper, tool-contract polish, `scopeTool`, extraction `problems[]`, sandbox idempotency test). Decisions and reasons: `docs/DECISIONS.md`._

## 1. What it is

**One sentence:** snap a photo of your price list and Shelfie turns it into a PayPal-backed shop with an **agent door**, a link any AI assistant can use to browse your menu and order, with the buyer approving payment on PayPal.

**Audience:** US sellers with a paper, chalkboard or whiteboard price list and no website: home bakers taking weekend preorders, food trucks, market stalls, small cafés, and service price lists (bike repair, salons). USD only.

**Problem:**
- PayPal's agentic-commerce work (ACP checkout in ChatGPT, Agent Ready, store sync, Google UCP; sources in `docs/IDEAS.md`) starts from an existing store or catalog. A chalkboard has neither, so agents can't find or buy from it. *(Our inference from PayPal's announcements; quote PayPal's wording, not ours.)*
- "~95% of merchants see agent traffic but ~20% have agent-readable catalogs" is **unverified** (secondary coverage only). Don't quote it until PayPal's primary source is found.
- Being agent-ready today takes a website, a product feed, a checkout and an MCP server. Shelfie replaces all four with a photo and a review screen.
- Supporting facts with primary sources are collected in `docs/EVIDENCE.md`. Only facts listed there go into the pitch, the README or the video; the persona's pain (orders by DM, unpaid preorders that become no-shows) is labelled as an assumption until a source backs it.

**Positioning against "Agent Ready":** Agent Ready makes existing stores agent-ready; Shelfie makes sellers with *no store* agent-ready.

## 2. Principles
- **AI drafts, the seller decides.** Nothing goes live until the seller publishes; nothing is charged until the buyer approves on PayPal.
- **No jargon in seller UI.** "Agent door", not "MCP endpoint"; "payment received", not "captured". Technical detail lives in an expandable "For developers" section and in the buyer console's Activity panel.
- **Prices come only from the shop.** No agent input can set or change a price.
- **Make the agent visible.** The demo shows every tool call the agent makes, so judges see real MCP traffic, not a chatbot.
- **Phone first:** designed at 390 px, one primary action per screen, touch targets ≥ 44 px.

## 3. Journeys

**Seller (Rosa, home baker, on her phone, about 3 minutes)**
1. `/` → **Snap your price list** (camera or file, 1–4 photos), or **Try a sample menu** (3 originals ship in `public/samples/`).
2. **Reading your menu…** (about 10 s): the photo with a scan animation and plain status lines ("Finding prices", "Checking sizes").
3. **Review:** "10 items · 3 need you". Flagged cards sit on top, each with the line as read ("We read: *2 for $7*") and a one-thumb fix. Shop name, about text and pickup notes are prefilled from the photo; she ticks **Also ship orders** and sets a flat $8 shipping fee. Unresolved items stay off the shop; they never block publishing.
4. **Publish 7 items to PayPal** → per-item progress → **Your shop is live** (share screen): shop link, agent door link with copy buttons, **Watch an AI order from you**, and the owner link (shown once).
5. Later, the dashboard shows **Paid · $26.25 · #SHF-K7F2QX · Ship to Austin, TX** with an AI brief: "Ship 2 almond croissants + 1 sourdough · ⚠ buyer says nut allergy, but almond croissants contain nuts". She packs it, taps **Add tracking**, pastes the USPS number, and it goes to PayPal. Pickup orders get **Mark picked up** instead.

**Buyer through an agent (Dana, uses Claude)**
1. Finds the agent door link (shop page, QR at the stall, Instagram bio) and adds it to her assistant, or taps **Order with an assistant** on the shop page.
2. "Two almond croissants and a sourdough, shipped to me."
3. The agent calls `get_shop_info` → `list_products` → reads the order back with the $8 shipping and total → on "yes" calls `create_order` with item IDs, option IDs and quantities only.
4. Dana opens the PayPal link, sees the shop name, itemised lines, shipping and total, picks her saved address, and approves.
5. PayPal returns her to Shelfie's receipt page, which captures the payment: **Paid. Marigold Bakehouse has your order.**
6. Two days later: "Where's my order?" → `get_order_status` → shipped, with the USPS tracking number (read back from PayPal).

## 4. Screens

| Screen (route) | Purpose | Primary action | States |
|---|---|---|---|
| Start `/` | What Shelfie does, by showing it: a menu photo beside the agent conversation it produces | **Snap your price list** (secondary: **Try a sample menu**, **See a live shop**) | idle; uploading; bad file ("We couldn't open that photo. Try a JPG or PNG"); returning owner → "Open your dashboard" |
| Setup `/shops/[id]/setup` | Reading → Review → Publishing → Live, one route, step by step | Reading: none (Cancel). Review: **Publish N items**. Live: **Copy agent door link** | reading; slow > 20 s; not a menu / unreadable → retake tip for the specific problem (blurry, glare, cropped, not a menu), photos kept; failed → **Try again**; review: all clear / issues (unresolved items stay off, never block) / 0 sellable (disabled with reason) / autosaving; publishing per item; partial failure → **Retry N**; live |
| Shop `/s/[slug]` | Public menu people can read + the agent door | **Order with an assistant** | live; paused banner; sold out; "Ask in person" items; draft/unknown → 404 |
| Buyer console (panel on the shop page, `?assistant=1`) | Watch an AI assistant order through the real agent door | Send / **Approve $X on PayPal** | empty (3 starter prompts); thinking; tool-call entries in an Activity panel (name, arguments, result or error code, ms) that expand to raw MCP JSON; tool error → agent recovers; approval card; paid; no Anthropic key → explains; rate limited |
| Receipt `/o/[ref]` | Tell the buyer what happened | **Back to shop** / **Try PayPal again** | confirming with PayPal; paid; pending; declined; cancelled; expired; unknown |
| Dashboard `/shops/[id]` (tabs **Orders · Menu · Share**) | What to do next | per order card: one action, **Mark picked up** (pickup) or **Add tracking** (shipping) | loading skeleton; empty → **Watch an AI order from you**; groups To prepare → Waiting for payment (collapsed) → Done; new order slides in (dashboard re-reads its own API every 5 s); "Can't reach PayPal" banner; **Pause agent orders** toggle |
| Menu tab | Keep the live menu honest | per item **Sold out today** toggle | sold out; live; in person only |
| Order detail `/shops/[id]/orders/[orderId]` | One order end to end | depends on state | brief generating / ready / fallback (labelled); line items; buyer + ship-to from PayPal; PayPal order and capture IDs; event timeline; tracking form (sending / sent / PayPal error) |

**Review fixes (one thumb each):**

| Issue | Trigger | Fix buttons | If ignored |
|---|---|---|---|
| `MISSING_PRICE` | no amount | decimal keypad | kept off the shop |
| `MARKET_PRICE` ("market price", "MP", "ask", "?") | `price_kind` | **Set today's price** · **Ask in person** | ask in person (listed, not orderable) |
| `CHECK` | low confidence, crossed-out or blurred text, a multi-buy deal ("2 for $7" → "$3.50 each?"), or a price ≤ $0 or > $1,000 | **Looks right** · **Fix** | kept off |
| `DUPLICATE` | same name, different price, across pages | **Merge** · **Keep both** | kept off (exact duplicates auto-merge) |

Text that reads like instructions to an AI is removed automatically and listed under **Lines we skipped** ("Looked like an instruction, not a menu item").

Lines that aren't items (hours, address, "cash only", add-ons like "+$1.5 add guac") go in a collapsed **Lines we skipped** list with the reason; each has **Make it an item**.

## 5. Architecture

One Next.js 16 (App Router, TypeScript) web service, Node runtime for every route handler. SQLite via `better-sqlite3` (`DATABASE_PATH`, default `data/shelfie.db`). Uploaded photos normalised with `sharp` (EXIF rotate, ≤ 1600 px long edge, JPEG q85) and stored on disk under `UPLOADS_DIR` (default `data/uploads/`). A background poller starts from `instrumentation.ts`.

```
src/
  app/                       pages + route handlers
  components/                UI built only from design tokens
  lib/
    config.ts                env parsing; names missing vars, never prints values
    db/                      connection, schema.sql, repos/*
    domain/                  types.ts, money.ts (cents ↔ "4.50")
    paypal/                  client.ts (REST: OAuth cache, typed errors, request IDs), catalog.ts, orders.ts,
                             webhooks.ts, categories.ts, toolkit.ts (Agent Toolkit wrapper), fake.ts (test double)
    ai/                      anthropic.ts, extract.ts, normalize.ts (pure), brief.ts (order-brief agent), prompts.ts
    orders/                  state.ts (pure), pricing.ts (pure), service.ts (create, sync, capture claim), poller.ts
    mcp/                     server.ts (createShopServer), tools.ts, errors.ts
    agent/                   buyer-console.ts (Claude + MCP client over HTTP)
tests/                       vitest unit tests + fixtures; tests/sandbox (real PayPal, skipped without creds)
e2e/                         Playwright flows + screenshots (390 px, 1440 px)
scripts/                     seed-demo.ts, sandbox-smoke.ts
```

**Libraries:** `next@16`, `react@19`, Tailwind CSS v4 (tokens as CSS variables), `@anthropic-ai/sdk` (`messages.parse` + `zodOutputFormat`; beta `toolRunner` + `betaTool`), `zod@3.25`, `@paypal/agent-toolkit@1.11.0` (ai-sdk entry, used only as a tool provider; tools adapted with `zod-to-json-schema`), `@modelcontextprotocol/sdk@1.32`, `better-sqlite3`, `sharp`, `qrcode`. Tests: `vitest`, `@playwright/test`, `@axe-core/playwright`.

## 6. Data model (SQLite, money in integer cents)

```
shops(id 'shp_'+16, slug UNIQUE, name, about, kind 'food'|'goods'|'services', fulfillment 'pickup'|'shipping'|'both',
      pickup_notes, shipping_fee_cents DEFAULT 0, status 'draft'|'live'|'paused', order_cap_cents DEFAULT 50000, owner_token_hash, menu_photo_paths JSON,
      created_at, published_at)
extractions(id, shop_id, status 'running'|'done'|'failed', model, raw_json, image_quality, warnings_json,
      skipped_lines_json, error, duration_ms, created_at)
items(id 'itm_'+12, shop_id, section, name, description, source_text, confidence, issues_json,
      kind 'PHYSICAL'|'SERVICE', status 'draft'|'live'|'in_person'|'removed', sold_out BOOL, sort,
      paypal_product_id, published_at, updated_at)
variants(id 'var_'+12, item_id, label NULL, price_cents NULL, sort)        -- ≥ 1 per item
orders(id 'ord_'+16 (capability), number 'SHF-'+6, shop_id, status, fulfillment, buyer_name, buyer_note,
      agent_name, client_request_id, items_cents, shipping_cents, total_cents, paypal_order_id UNIQUE, approval_url, expires_at,
      capture_claimed_at, capture_id, payer_name, payer_email, ship_to_json, brief_json, brief_source
      'agent'|'template', paid_at, fulfilled_at, last_checked_at, created_at, updated_at,
      UNIQUE(shop_id, client_request_id))
order_items(order_id, item_id, variant_id, name, label, unit_cents, qty, paypal_product_id)
order_events(id, order_id, type, source 'mcp'|'return_url'|'cancel_url'|'webhook'|'poller'|'seller',
      detail_json, created_at)
trackers(order_id, carrier, tracking_number, paypal_status, created_at, UNIQUE(order_id, tracking_number))
webhook_events(id PK (PayPal event id), event_type, resource_id, verified, received_at)
assistant_sessions(id, shop_id, messages_json (append-only Claude message params), events_json, created_at, updated_at)
```

## 7. Order state machine

`transition(status, event) → { next, effects[] }` is pure. `advanceOrder()` is the only writer of `orders.status`, using compare-and-set (`UPDATE … WHERE id=? AND status=?`).

| From | Event | To (+ effects) | Triggered by |
|---|---|---|---|
| — | `created` | `awaiting_approval` | MCP `create_order` (PayPal returned `PAYER_ACTION_REQUIRED`) |
| `awaiting_approval` | `paypal_approved` | `approved` + `capture` | return URL · webhook `CHECKOUT.ORDER.APPROVED` · poller · `get_order_status` |
| `approved` | `capture_completed` | `paid` + `brief` | holder of the capture claim |
| `approved` | `capture_pending` | `payment_pending` | capture returned `PENDING` |
| `payment_pending` | `capture_completed` / `capture_denied` | `paid` + `brief` / `failed` | webhook `PAYMENT.CAPTURE.COMPLETED`/`DENIED` · poller |
| `approved` | `capture_declined` | `awaiting_approval` | 422 `INSTRUMENT_DECLINED` (buyer re-approves with the same link) |
| `approved` | `mismatch` | `failed` (no capture) | PayPal amount or `custom_id` differs from ours |
| `approved` | `capture_denied` | `failed` | PayPal reports the order COMPLETED with a DECLINED/FAILED capture |
| `awaiting_approval` | `cancelled` / `expired` | `cancelled` / `expired` | cancel URL / 60 min without approval |
| `paid` | `fulfilled` | `fulfilled` | Mark picked up, or tracking added |

Repeated events are logged and ignored. Expired or cancelled orders are never captured.

**Capture claim:** `UPDATE orders SET capture_claimed_at=now WHERE id=? AND status='approved' AND (capture_claimed_at IS NULL OR capture_claimed_at < now-30s)`. Only the caller whose update changed a row captures. Capture uses `PayPal-Request-Id: cap-<paypalOrderId>`; 422 `ORDER_ALREADY_CAPTURED` → GET and reconcile; 422 `ORDER_NOT_APPROVED` → stay `awaiting_approval`.

**Three ways to "paid", all through `syncOrder(orderId, source)`:**
1. **Return URL** `/api/paypal/return?o=<ref>` (primary on localhost) → sync → redirect to `/o/<ref>`.
2. **Webhook** `/api/paypal/webhook`: verified with `POST /v1/notifications/verify-webhook-signature` (`PAYPAL_WEBHOOK_ID`), deduped by event ID, order re-fetched from PayPal (payload never trusted). Only reachable once deployed; tested with recorded payloads.
3. **Polling fallback:** the poller (every 15 s, non-terminal orders < 3 h old, plus the expiry sweep). The agent's `get_order_status` also syncs a non-terminal order that hasn't been checked in the last 5 s, so "did it go through?" gets a fresh answer. Seller pages and the receipt only read SQLite.

## 8. PayPal (sandbox `https://api-m.sandbox.paypal.com`)

**Two clients, on purpose.** Money-moving calls use Shelfie's typed REST client: they need a `PayPal-Request-Id` per call, `sku`, `custom_id`, `invoice_id`, `brand_name`, `shipping_preference` and PayPal's issue codes, which the toolkit's `create_order` doesn't support (it also takes `itemCost` from the model, so it's never exposed to buyer agents). The Agent Toolkit is Shelfie's **seller-side PayPal layer**: a Claude agent uses its read tools to write the order brief, and Shelfie runs its write tools directly for tracking and catalog edits.

| When | Call | Via | Idempotency / notes |
|---|---|---|---|
| Any | `POST /v1/oauth2/token` | REST | cached until 60 s before expiry; refreshed once on 401 |
| Publish, per item (3 at a time) | `POST /v1/catalogs/products` `{name ≤127, type, description ≤256, category}` | REST | `PayPal-Request-Id: pub-<itemId>`; skipped if `paypal_product_id` set; category `FOOD_RETAIL_AND_SERVICE` for food shops, omitted otherwise |
| Agent orders | `POST /v2/checkout/orders` | REST | `PayPal-Request-Id: ord-<orderId>`; body built only from DB rows (below) |
| Sync / receipt / status | `GET /v2/checkout/orders/{id}` | REST | read |
| Capture | `POST /v2/checkout/orders/{id}/capture` | REST | `cap-<paypalOrderId>` + capture claim |
| Order brief | `GET /v2/checkout/orders/{id}`, `GET /v1/shipping/trackers` | toolkit `get_order`, `get_shipment_tracking`, called **by the brief agent** | read-only tools only |
| Add tracking | `POST /v1/shipping/trackers-batch` (`transaction_id` = capture ID) | toolkit `create_shipment_tracking` | `UNIQUE(order_id, tracking_number)` checked first |
| Webhook | `POST /v1/notifications/verify-webhook-signature` | REST | dedupe by event ID |

**Order body** (from DB only): intent `CAPTURE`; one purchase unit with `custom_id` = order id, `invoice_id` = `SHF-…` number, `description` = "<shop> order #<number>", `amount` with `breakdown.item_total` and, for shipping orders, `breakdown.shipping` = the shop's flat fee, `items[]` with `name` (+ variant label), `sku` = PayPal product ID, `unit_amount`, `quantity`, `category` `PHYSICAL_GOODS` for products (omitted for services); `payment_source.paypal.experience_context` with `brand_name` = shop name, `user_action: PAY_NOW`, `shipping_preference` `NO_SHIPPING` (pickup) or `GET_FROM_FILE` (shipping), `return_url`/`cancel_url` → Shelfie. Verified in the sandbox on 2026-11-06 (same request ID twice returns the same order).

**Toolkit allowlist:** `{ orders: { get }, shipment: { create, get } }` only. **Quirks** (from reading 1.11.0): results are JSON strings (parsed by our wrapper into typed results/errors); the OAuth token is cached without expiry (wrapper rebuilds the instance every 30 min); list tools stay disabled because all shops share one sandbox merchant.

**Tenant safety on the shared merchant:** every toolkit call is wrapped by `scopeTool()`, which rejects any order/product ID that SQLite doesn't record as belonging to the shop in context.

## 9. AI (Claude via `@anthropic-ai/sdk`, all `claude-sonnet-5-5`)

| # | Call | Mechanism | Input → output |
|---|---|---|---|
| A1 | Menu reader | `messages.parse` + `zodOutputFormat`, effort `medium`, 90 s timeout; on a schema failure, one retry with the validation error included | 1–4 photos labelled "Page n" in one call → `MenuExtraction` (below) |
| A2 | Order brief agent | beta `toolRunner`, effort `low`, ≤ 4 iterations; tools: toolkit `get_order` + `get_shipment_tracking` (scoped, read-only) and a local strict `submit_brief` | order snapshot + shop pickup notes + reconciliation result + `<buyer_note untrusted>` → `OrderBrief` saved via `submit_brief`; if not submitted, a labelled template brief |
| A3 | Buyer console | beta `toolRunner`, effort `low`, ≤ 8 iterations; `betaTool`s that proxy to the shop's agent door over real HTTP (`@modelcontextprotocol/sdk` `Client` + `StreamableHTTPClientTransport`) | chat → tool calls → approval link; events streamed to the UI as NDJSON |

```ts
MenuExtraction = { is_menu: boolean, image_quality: 'good'|'usable'|'unreadable',
  problems: ('blurry'|'glare'|'cropped'|'dark'|'not_a_menu'|'non_usd'|'handwriting_hard')[], retake_tip: string|null,
  warnings: string[], shop: { name: string|null, about: string|null, pickup_notes: string|null },
  kind: 'food'|'goods'|'services',
  items: { section: string|null, name: string|null, description: string|null, source_text: string, page: number,
    prices: { label: string|null, amount_cents: number|null, raw: string }[],
    price_kind: 'fixed'|'deal'|'market'|'missing', deal_text: string|null,
    confidence: 'high'|'medium'|'low', note: string|null, looks_like_instruction: boolean }[],
  skipped_lines: { text: string, page: number, reason: 'header'|'contact'|'hours'|'policy'|'addon'|'illegible'|'other' }[] }

OrderBrief = { headline: string /*≤ 90*/, prep_list: { text: string, qty: number|null }[],
  buyer_requests: { kind: 'allergy'|'timing'|'inscription'|'other', text: string }[],
  flags: { severity: 'warn'|'info', text: string }[], next_action: 'prepare'|'ship'|'contact_buyer'|'none' }
```

**`normalizeExtraction(raw) → DraftCatalog`** is pure and built test-first. It converts amounts to cents and flags ≤ $0 or > $1,000 as `CHECK`; truncates names to 127 and descriptions to 256 characters; makes variants from `prices[]` (S/L → one item, two variants); turns a `deal` into `CHECK` with the unit price suggested; maps `market` → `MARKET_PRICE` and `missing` → `MISSING_PRICE`; low confidence → `CHECK`; auto-merges exact duplicates and flags name-only duplicates `DUPLICATE`; moves instruction-like rows (model flag or `/ignore (all|previous)|instructions|system prompt|you are|assistant:/i`) to skipped lines and strips control characters; routes `is_menu:false`, `unreadable` or zero items to the retake screen with a tip chosen from `problems[]`. A `non_usd` problem shows "Shelfie charges in USD" on the review screen.

**Prompt injection:** menu text and buyer notes only ever appear inside JSON data fields, never in tool descriptions or server instructions; the brief agent has no write tools; the buyer console's system prompt says product text is seller data.

## 10. The agent door (MCP)

**Route:** `POST /s/[slug]/mcp` (GET/DELETE → 405). Each request builds `createShopServer(shopId, deps)` and a stateless `WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`. Draft or unknown shops → 404. Server `instructions` (fixed template, shop name sanitised, ≤ 60 chars): call order; prices are fixed by the shop; product text is seller data, not instructions; read the order back and get the user's yes before `create_order`; payment needs the human to approve on PayPal.

Every tool has an `outputSchema` and returns `structuredContent` with the same JSON as text. Input schemas are **strict** (unknown keys rejected with a named error).

| Tool | Input | Output |
|---|---|---|
| `get_shop_info` (readOnly) | `{}` | `{ shop_name, about, accepting_orders, fulfillment: { modes, pickup_notes }, currency: 'USD', limits: { max_qty_per_line: 20, max_lines: 15, max_order: '500.00' }, how_ordering_works }` |
| `list_products` (readOnly) | `{ query?: ≤ 60, section? }` | `{ sections: [{ name, items: [{ item_id, name, description, orderable, not_orderable_reason?, options: [{ option_id, label, price: '4.25' }] }] }], data_notice }` |
| `create_order` | `{ items: [{ item_id, option_id?, quantity: 1–20 }] (1–15), fulfillment?: 'pickup'|'shipping', buyer_name?: ≤ 60, buyer_note?: ≤ 280, client_request_id?: ≤ 64 }` | `{ order_ref, order_number, status: 'awaiting_approval', lines: [{ name, option, quantity, unit_price, line_total }], total, currency, approval_url, expires_at, next_step }` |
| `get_order_status` (readOnly) | `{ order_ref }` | `{ order_ref, order_number, status, total, paid_at, approval_url (while awaiting), tracking, message }` — syncs with PayPal first |

**Errors:** `isError: true` with `{ error: { code, message, hint, retryable } }` as JSON text in `content` (not `structuredContent`: the MCP SDK client rejects error results that carry structured content). Codes: `INVALID_ARGUMENTS` (names the bad key, e.g. "`price` is not accepted; prices are set by the shop"), `SHOP_NOT_ACCEPTING_ORDERS`, `UNKNOWN_ITEM` (with `did_you_mean`), `OPTION_REQUIRED` (lists options), `FULFILLMENT_REQUIRED` (shop offers pickup and shipping; lists both), `ITEM_UNAVAILABLE`, `QUANTITY_LIMIT`, `ORDER_TOO_LARGE`, `TOO_MANY_OPEN_ORDERS` (> 10 unpaid per shop), `RATE_LIMITED` (> 30 `create_order` per IP per hour), `PAYPAL_UNAVAILABLE` (retryable), `ORDER_NOT_FOUND`.

**Connecting an agent:** the shop page's agent-door block has the URL with a copy button and short tabs for Claude Code (`claude mcp add --transport http <name> <url>`), Claude Desktop (`npx mcp-remote <url>`), and Claude/ChatGPT custom connectors (needs the deployed HTTPS URL). Every tool description says what to call next.

**On localhost:** the buyer console reaches the door over real HTTP at `APP_URL`, exactly like an external agent. MCP Inspector and Claude Code also work against localhost. PayPal returns the buyer's browser to localhost, so the full flow needs no public URL.

## 11. Seller auth
Creating a shop sets an httpOnly `shelfie_owner` cookie holding a random owner token (only its SHA-256 hash is stored). Owner routes require it. The live screen shows a one-time owner link `/claim/<token>` to open the dashboard on another device. No passwords (hackathon scope; documented).

## 12. Testing
- **Unit (Vitest, test-first):** `normalizeExtraction` (every issue code, cents parsing, variants, deals, cross-page duplicates, truncation, `ODD_TEXT`, not-a-menu, unreadable); `priceOrder` (unknown/removed/in-person/sold-out items, options, caps, snapshots); PayPal client with injected `fetch` (token cache + 401 refresh, request-ID headers, order body snapshot, payer-action link, 422 issue mapping using recorded sandbox payloads); toolkit wrapper (string parsing, errors, scope check); state machine (full transition table, a webhook after the return URL, a two-caller capture-claim race on in-memory SQLite); MCP via `InMemoryTransport.createLinkedPair()` against `createShopServer` with a fake PayPal (schemas, `price` rejected, every error code, idempotent `client_request_id`, paused shop, `get_order_status` capturing on APPROVED); one route test sending web `Request`s (initialize → `tools/list`); webhook (bad signature → 400, duplicate ignored, payload not trusted).
- **Sandbox (`npm run test:sandbox`, skipped without creds):** create product; create order → `PAYER_ACTION_REQUIRED` + link; same `PayPal-Request-Id` twice → same order; capture before approval → still awaiting; toolkit `get_order`; full MCP flow over HTTP against `next start` (initialize → list → create_order → approval link).
- **Capture gate:** `e2e/capture.spec.ts` approves as the sandbox buyer and expects **Paid**, then adds tracking and expects `get_order_status` to return it. It runs as soon as `PAYPAL_SANDBOX_BUYER_EMAIL/PASSWORD` exist; until then capture, the brief on a real paid order and tracking are reported as **unverified**.
- **AI (`npm run test:ai`):** extraction on the 3 sample photos with tolerant assertions (known items at known prices; market-price item flagged).
- **E2E (Playwright):** sample menu → review → publish → shop page → console order → approval link. With `PAYPAL_SANDBOX_BUYER_EMAIL/PASSWORD`, Playwright approves on PayPal and expects **Paid**.
- **Screenshots:** every screen at 390 px and 1440 px into `docs/judge/screenshots/round-N/`, with axe checks.

## 13. Demo (under 3 minutes)
| Time | Shot |
|---|---|
| 0:00 | Handwritten menu on a counter. "AI assistants are starting to shop for people. Rosa doesn't have a store. She has this sheet." |
| 0:08 | Phone: snap → reading → "3 need you" → one fix (the crossed-out price) → Publish → "products in your PayPal catalog" + agent door |
| 0:40 | **Wow:** an assistant that has never seen Rosa uses a door that is 30 seconds old: "two almond croissants and a sourdough, shipped to me". The Activity panel shows `get_shop_info` → `list_products` → read-back → `create_order` → PayPal approval → **Paid** |
| 1:35 | Tamper: MCP Inspector sends `create_order` with `price: 0.01` → `INVALID_ARGUMENTS`: prices are set by the shop. The server enforces it, not the model |
| 1:50 | Dashboard: the paid order with the AI brief "⚠ nut allergy, but almond croissants contain nuts", grounded in PayPal's own record by the toolkit-powered brief agent |
| 2:10 | **Add tracking** → PayPal tracker created → in the assistant, "where's my order?" → `get_order_status` returns the USPS number |
| 2:35 | Architecture card: Claude vision → Catalog Products → agent door (MCP) → Orders v2 → capture → Agent Toolkit brief + tracking. "For the sellers PayPal's Agent Ready can't reach." |

## 14. Out of scope
Per-seller PayPal onboarding (Partner Referrals is the path to scale; one sandbox merchant receives all payments), non-USD, refunds and disputes UI, tax and per-address shipping rates (one flat fee only), menu edits after launch other than sold-out and pause, renaming products in PayPal, QR codes, discovery cards (agent.json, llms.txt, JSON-LD), stock counts (sold-out toggle only), pickup time slots (free-text note), checkout without an assistant, seller accounts and passwords, MCP OAuth, ACP/UCP adapters, email/SMS, a quote/cart step (the agent reads the order back instead), streaming extraction rows, a free-form seller copilot.

## 15. Risks
| Risk | Mitigation |
|---|---|
| Capture can't be verified without a sandbox buyer login | Needs from human; recorded payloads; live `ORDER_NOT_APPROVED` path; Playwright approval script ready to run |
| External agents can't reach localhost | Console uses real HTTP; Inspector and Claude Code work locally; Render for hosted connectors |
| Vision misreads prices | confidence + source text + photo zoom; publishing blocked until fixed |
| Prompt injection from menus or notes | data-only placement, flags, brief agent read-only |
| Agent spam / Anthropic spend | caps, open-order limit, per-IP rate limits, expiry, pause toggle; console limited per IP |
| Data leaking between shops on the shared merchant | `scopeTool` ownership checks; list tools disabled |
| "Isn't this Agent Ready?" | Agent Ready starts from a store; Shelfie starts from a photo |
| SQLite on Render's ephemeral disk | persistent disk, or seed on boot |
