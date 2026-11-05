# Shelfie

**Snap a photo of your price list. Shelfie turns it into a PayPal-backed shop with an "agent door": a link any AI assistant can use to browse your menu and order, with the buyer approving payment on PayPal.**

Built for the PayPal AI Hackathon. PayPal **sandbox** only. Licensed MIT ([LICENSE](LICENSE)).

## The problem

PayPal's agent-commerce tools start from an existing store. Agent Ready is for "existing PayPal merchants", and its agent checkout "is limited to Store Sync customers today", for merchants "using their existing website storefronts" ([sources](docs/EVIDENCE.md)). A home baker, food truck, market stall or repair shop with a chalkboard and no website is invisible to AI shopping assistants. In the US Census data we cite, 47% of accommodation and food-service employer firms reported having no website (data year 2016).

Shelfie is for those sellers. Photograph the price list, and about 8 to 14 seconds of machine time later (measured, see [docs/EVIDENCE.md](docs/EVIDENCE.md)) the shop is live: its items are products in a PayPal catalog, and it has its own MCP endpoint that Claude Code or any MCP client can order through.

## How it works

1. **Snap.** The seller photographs a paper, chalkboard or whiteboard price list (1 to 4 photos), or tries a sample menu.
2. **Claude reads it.** `claude-sonnet-5-5` (vision, structured output) returns items, sizes and prices. Anything unclear (crossed-out price, "2 for $7", "market price", blur) is flagged for a one-tap fix. Unresolved items stay off the shop.
3. **Publish to PayPal.** Each item becomes a product through the PayPal **Catalog Products API**.
4. **The agent door opens.** `POST /s/<slug>/mcp` speaks MCP (Streamable HTTP). Prices come only from the shop; an agent cannot send one.
5. **An agent orders.** `create_order` builds a **PayPal Orders v2** order from the shop's own data and returns the approval link. The human approves on PayPal (guest card checkout works), and Shelfie **captures** the payment. Confirmation arrives by the return URL, a **webhook** (deployed only) or a 15 s poller.
6. **AI brief.** For each paid order a Claude agent reads PayPal's own record through the **PayPal Agent Toolkit** (`get_order`, `get_shipment_tracking`) and writes the seller a short prep brief.
7. **Tracking.** The seller adds a carrier and tracking number; Shelfie sends it to PayPal with the Agent Toolkit's `create_shipment_tracking`.
8. **Read back.** The buyer's assistant calls `get_order_status` and sees the tracking number.

The in-app **buyer console** ("Order with an assistant") is a Claude agent that is an MCP client of the shop's own agent door over real HTTP, so you can try everything without any external AI setup. Details: [docs/AI_TOOLS.md](docs/AI_TOOLS.md).

## Features

**Seller**
- Photo to draft menu, with review flags (missing price, market price, check, duplicate) resolved in one tap
- Publish to the PayPal catalog, with progress
- A shop page and an agent door per shop
- Dashboard: orders, order detail, an AI brief per paid order (a labelled template if Claude is unavailable)
- Add tracking to PayPal; mark items sold out for today; pause agent orders
- A private owner link instead of an account

**Buyer or agent**
- MCP tools with server-enforced prices and strict input schemas (a `price` argument is rejected)
- Idempotent orders (`client_request_id`), order limits, rate limits
- PayPal approval link, then a receipt page (Paid, cancelled, expired)
- Pickup or flat-fee shipping; a note for the seller (allergies, timing)

## Quick start

Requirements: Node.js 22 or newer, npm, a free PayPal developer account, an Anthropic API key.

```bash
git clone <this repo> shelfie && cd shelfie
npm install
cp .env.example .env
```

Fill in `.env`. No credentials are committed; here is how to get yours.

| Variable | How to get it |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET_KEY` | [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → **Sandbox** → Create App. Use the app's Client ID, and its **Secret** as `PAYPAL_SECRET_KEY`. |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API keys. Without it, sample menus still work (recorded reading), but your own photos, order briefs and the buyer console do not. |
| `APP_URL` (optional) | Public base URL for PayPal return links and the agent door. Default `http://localhost:3000`. |
| `PAYPAL_WEBHOOK_ID` (optional) | Only once deployed on a public HTTPS URL: the webhook id from your PayPal app. Locally the 15 s poller confirms payments. |
| `PAYPAL_SANDBOX_BUYER_EMAIL`, `PAYPAL_SANDBOX_BUYER_PASSWORD` (optional) | A sandbox Personal account, only for the wallet-login variant of the end-to-end tests. Single-quote the password in `.env` if it contains `#`. Not needed to pay (see below). |
| `DATABASE_PATH`, `UPLOADS_DIR` (optional) | Defaults `data/shelfie.db` and `data/uploads`. |

```bash
npm run seed   # optional: publishes the demo shop "Marigold Bakehouse" to your PayPal sandbox catalog
npm run dev    # http://localhost:3000
```

`npm run seed` prints the shop URL, the agent door URL, an "Order with an AI" link and, the first time only, an **owner link** (`/claim/<token>`) that opens the seller dashboard. `npm run seed -- --reset` recreates the shop with a new owner link. Open `http://localhost:3000` first; "Try a sample menu" needs no seeding.

### Paying in the sandbox

On PayPal's approval page choose **Pay with Credit or Debit Card**, country **United States**, card `4012000033330026` (PayPal sandbox test Visa), any future expiry (for example 12/30), CVV `123`, any US address. Switch **off** "Save info & create your PayPal account", then **Pay Now**. This guest checkout needs no PayPal login.

Paying with a sandbox Personal account login also works when that buyer is in a different country from the sandbox merchant; PayPal blocks some same-country wallet payments (for example India to India). We have verified guest card checkout, not wallet login.

## Try the whole flow in 5 minutes

1. Open `http://localhost:3000`. Tap **Try a sample menu** (or **Snap your price list** with your own photo).
2. Review the flagged items, then **Publish**. The shop goes live.
3. On the live screen tap **Watch an AI order from you** (or open the shop page and use **Order with an assistant**). Type "Two almond croissants and a sourdough, shipped to me."
4. Watch the Activity panel show each tool call. Say yes to the read-back, then **Approve on PayPal** and pay with the test card above.
5. You return to the receipt, marked **Paid**.
6. Open the seller dashboard (the browser that created the shop already has access; otherwise use the owner link). The order shows its AI brief.
7. Open the order and **Add tracking** (carrier and number).
8. Back in the assistant: "Where's my order?" It calls `get_order_status` and reads the tracking back.

## Connect a real AI assistant to a shop's agent door

The MCP URL is `http://localhost:3000/s/<slug>/mcp` (Streamable HTTP, POST only, stateless).

- **Claude Code:** `claude mcp add --transport http <slug> http://localhost:3000/s/<slug>/mcp`
- **MCP Inspector:** `npx @modelcontextprotocol/inspector`, choose Streamable HTTP, paste the URL. Call `create_order` with an extra `"price": 0.01`: the server rejects it with `INVALID_ARGUMENTS`.
- **Claude.ai, ChatGPT and other hosted assistants** need a public HTTPS URL, so deploy the app first and set `APP_URL`.

Tools:

| Tool | What it does |
|---|---|
| `get_shop_info` | Shop name, pickup and shipping options, shipping fee, limits, whether it is taking orders |
| `list_products` | Items with `item_id`, `option_id` and price; optional `query` and `section` filters; in-person-only items are marked not orderable |
| `create_order` | Item ids, option ids and quantities only, plus fulfillment, buyer name and note, `client_request_id`; returns `order_ref` and the PayPal `approval_url` |
| `get_order_status` | Status, total, paid time and shipping tracking for an `order_ref` |

## Tests

```bash
npm test               # unit tests (Vitest), no network
npm run test:sandbox   # real PayPal sandbox calls; needs PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY
npm run test:ai        # real Claude on the sample photos; needs ANTHROPIC_API_KEY
npm run e2e            # Playwright; starts the app on port 3100 (set E2E_PORT to change)
npm run typecheck && npm run lint
```

## Architecture

```
photo --> Claude vision --> review --> PayPal Catalog Products
                                            |
AI assistant --MCP--> /s/<slug>/mcp --> orders service --> PayPal Orders v2 (create, approve, capture)
                                            |                       |
                               SQLite (cents, CAS state)    return URL / webhook / 15 s poller
                                            |
           dashboard <-- brief agent (Agent Toolkit get_order) + tracking (create_shipment_tracking)
```

- One Next.js 16 App Router service (TypeScript). SQLite via `better-sqlite3`; money is integer cents.
- Orders move through a pure state machine with compare-and-set writes, so the return URL, webhook and poller can race safely.
- `src/lib/services.ts` is the composition root. `PayPalPort` has a fake for unit tests.
- Our typed REST client does the money paths with a `PayPal-Request-Id` per call. The Agent Toolkit is the seller-side layer and is never exposed to buying agents.
- Design spec: [docs/superpowers/specs/2026-11-06-shelfie-design.md](docs/superpowers/specs/2026-11-06-shelfie-design.md).

## Limitations (hackathon scope)

- One sandbox merchant receives all payments. Per-seller onboarding (PayPal Partner Referrals) is the path to production.
- USD only; no refunds or disputes UI; no tax; one flat shipping fee, no per-address rates.
- Menu edits after launch are limited to sold-out and pause; products are not renamed in PayPal.
- Sold-out is a toggle, not stock counts. Pickup time is a free-text note.
- No seller accounts or passwords (owner link), no MCP OAuth, no ACP/UCP adapters, no email or SMS.
- Webhooks need a public URL and are not verified end to end; the 15 s poller covers local runs.
- Paying with a PayPal wallet login is unverified (guest card checkout is verified).

## Built with

PayPal REST APIs and `@paypal/agent-toolkit`; Anthropic Claude `claude-sonnet-5-5` via `@anthropic-ai/sdk`; `@modelcontextprotocol/sdk` (TypeScript); Next.js 16; SQLite. MIT licensed.
