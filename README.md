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
git clone https://github.com/codebreaker32/paypal-ai.git shelfie && cd shelfie
npm install
cp .env.example .env
```

Fill in `.env`. No credentials are committed; here is how to get yours.

| Variable | How to get it |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET_KEY` | [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → **Sandbox** → Create App. Use the app's Client ID, and its **Secret** as `PAYPAL_SECRET_KEY`. |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API keys. Without it, sample menus still work (recorded reading), but your own photos, order briefs and the buyer console do not. |
| `APP_URL` (optional) | Public base URL for PayPal return links and the agent door. Default `http://localhost:<port>`, the port the server runs on (normally 3000); on Render, the service's own URL (`RENDER_EXTERNAL_URL`). |
| `SHELFIE_RECORDED_SAMPLES` (optional) | Set to `1` and the sample menus use Claude's saved reading of the sample photo even when a key is set: instant, for recording a demo. Your own photos are always read live. |
| `PAYPAL_WEBHOOK_ID` (optional) | Only once deployed on a public HTTPS URL: the webhook id from your PayPal app. Locally the 15 s poller confirms payments. |
| `PAYPAL_SANDBOX_BUYER_EMAIL`, `PAYPAL_SANDBOX_BUYER_PASSWORD` (optional) | Leave empty. A sandbox Personal account for a future wallet-login test; no test or app path uses them today (the end-to-end tests pay by guest card). Not needed to pay (see below). |
| `DATABASE_PATH`, `UPLOADS_DIR` (optional) | Defaults `data/shelfie.db` and `data/uploads`. |

```bash
npm run seed   # optional: publishes the demo shop "Marigold Bakehouse" to your PayPal sandbox catalog
npm run dev    # http://localhost:3000
```

`npm run seed` does not need the server running. It prints the shop URL, the agent door URL, an "Order with an AI" link and, the first time only, an **owner link** (`/claim/<token>`) that opens that shop's seller dashboard. `npm run seed -- --reset` recreates the shop with a new owner link. The menu has 10 items and 9 go to PayPal: the market-price galette stays "ask in person". The links assume port 3000; if your server runs on another port, run `PORT=<port> npm run seed` or change the port in the link. Each run also says how many of the shop's orders are waiting for payment; `npm run seed -- --cancel-unpaid` asks PayPal about each one and cancels those nobody approved (one caller can hold 3 unpaid orders per shop). Those rehearsal orders then read "cancelled by the shop" on the seller page, the receipt and `get_order_status`. Open `http://localhost:3000` first; "Try a sample menu" needs no seeding.

### Paying in the sandbox

On PayPal's approval page choose **Pay with Credit or Debit Card**, country **United States**, card `4012000033330026` (PayPal sandbox test Visa), any future expiry (for example 12/30), CVV `123`, any US address. Switch **off** "Save info & create your PayPal account", then **Pay Now**. This guest checkout needs no PayPal login.

Paying by logging in with a sandbox Personal account is unverified. Our sandbox merchant and buyer are both India accounts, and PayPal blocked that same-country wallet payment; a buyer in another country may work. We have verified guest card checkout only.

Payments land in the sandbox Business account that owns your app (listed under Sandbox Accounts in the developer dashboard). Log in to [sandbox.paypal.com](https://www.sandbox.paypal.com) with it to see them.

## Try the whole flow in 5 minutes

1. Open `http://localhost:3000`. Under **Try a sample menu**, tap **Marigold Bakehouse** (or **Snap your price list** with your own photo). With an `ANTHROPIC_API_KEY` Claude reads the sample photo live; without one you get the recorded reading.
2. Resolve each flagged item with one tap. Under **How do people get their order?** choose **Both** and enter a **Flat shipping fee** (for example 8): a new shop is pickup-only, and steps 7 and 8 need a shipped order. Then tap **Publish N items to PayPal**. The shop goes live (about 10 s).
3. On the live screen tap **Watch an AI order from you** (or open the shop page and use **Order with an assistant**). Type "Two almond croissants and a sourdough, shipped to me."
4. Watch the Activity panel show each tool call. Say yes to the read-back, then **Approve $… on PayPal** and pay with the test card above.
5. You return to the receipt, marked **Paid**.
6. Open the seller dashboard with **Open your dashboard** on the live screen (the browser that created the shop already has access; on another device use the owner link shown on the live screen, not the seed's). The order shows its AI brief.
7. Open the order and **Add tracking** (carrier and number).
8. Back in the assistant: "Where's my order?" It calls `get_order_status` and reads the tracking back.

## Connect a real AI assistant to a shop's agent door

The MCP URL is `http://localhost:3000/s/<slug>/mcp` (Streamable HTTP, POST only, stateless). The seeded demo shop's slug is `marigold-bakehouse`; a shop you publish from a sample gets its own slug (for example `marigold-bakehouse-2`), shown on its live screen.

- **curl:** a plain JSON-RPC POST works without an `initialize` call. The `Accept` header is required (without it the server answers 406; a GET answers 405).

  ```bash
  curl -s -X POST http://localhost:3000/s/marigold-bakehouse/mcp \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_products","arguments":{}}}'
  ```
- **Claude Code:** `claude mcp add --transport http <slug> http://localhost:3000/s/<slug>/mcp`. To try it without changing your Claude Code settings, pass a config file for one run instead. For example, `claude -p "<your order>" --mcp-config docs/judge/evidence/claude-code-mcp.json --strict-mcp-config --allowedTools "mcp__marigold-bakehouse__*"`. We ran this against the demo shop: Claude Code placed a real sandbox order and returned its PayPal link. The config points at port 3143, so edit the URL for your port. Transcript: [docs/judge/evidence/outside-client-claude-code.md](docs/judge/evidence/outside-client-claude-code.md).
- **MCP Inspector:** `npx @modelcontextprotocol/inspector`, choose Streamable HTTP, paste the URL. Call `create_order` with an extra `"price": 0.01`: the server rejects it with `INVALID_ARGUMENTS`.
- **Claude.ai, ChatGPT and other hosted assistants** need a public HTTPS URL, so deploy the app first ([Deploy to Render](#deploy-to-render)).

Tools:

| Tool | What it does |
|---|---|
| `get_shop_info` | Shop name, pickup and shipping options, shipping fee, limits, whether it is taking orders |
| `list_products` | Items with `item_id`, `option_id` and price; optional `query` and `section` filters; in-person-only items are marked not orderable |
| `create_order` | Item ids, option ids and quantities only, plus fulfillment, buyer name and note, `client_request_id`; returns `order_ref` and the PayPal `approval_url` |
| `get_order_status` | Status, total, paid time and shipping tracking for an `order_ref` |

## Deploy to Render

**Not yet run.** `render.yaml` validates against Render's published Blueprint schema, and the app's Render fallback is unit-tested, but nobody has deployed it yet.

`render.yaml` is a Render Blueprint for one Node web service, `shelfie`, with a 1 GB persistent disk mounted at `/var/data`. The SQLite database and uploaded menu photos live on that disk.

- **A persistent disk needs a paid instance type.** The Blueprint uses Starter (`0.5c-512mb`). The free type has no disk, so the database would be wiped on every deploy and restart.
- With a disk, each deploy has a few seconds of downtime, and the service runs as one instance.

1. Push the repo to GitHub, or fork it.
2. In the Render Dashboard choose **New → Blueprint**, connect the repo and pick the branch. Render reads `render.yaml`.
3. Render asks for the secret values once, when it creates the Blueprint. Paste these:

   | Key | Value |
   |---|---|
   | `PAYPAL_CLIENT_ID` | Your sandbox app's Client ID (see [Quick start](#quick-start)) |
   | `PAYPAL_SECRET_KEY` | Your sandbox app's Secret |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key |
   | `PAYPAL_WEBHOOK_ID` | Leave it empty for now (step 6) |

   `render.yaml` sets the rest: `NODE_VERSION=22`, `PORT=10000`, `DATABASE_PATH=/var/data/shelfie.db` and `UPLOADS_DIR=/var/data/uploads`. Don't set `APP_URL`. The app uses `RENDER_EXTERNAL_URL` (`https://<service>.onrender.com`), which Render sets for you. Set `APP_URL` only if you add a custom domain.
4. Click **Apply**. Render builds with `npm ci && npm run build` and starts with `npm start`. It sends traffic only after `GET /api/health` returns `{"ok":true}`.
5. Open `https://<service>.onrender.com`. Payments are already confirmed through the return URL and the 15 s poller.
6. Add the webhook:
   1. Open [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → **Sandbox** → your app → **Add Webhook**.
   2. Set the URL to `https://<service>.onrender.com/api/paypal/webhook`.
   3. Select the events `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.DENIED`, then save.
   4. Copy the **Webhook ID**. In Render, open the service → **Environment**, set `PAYPAL_WEBHOOK_ID` and save. The service redeploys.

   Until `PAYPAL_WEBHOOK_ID` is set, the deployed webhook answers 503 (PayPal retries it), and the poller still confirms payments. Render prompts for secret values only when it creates the Blueprint, so change them later on the **Environment** page.
7. Open the service → **Shell** and run `npm run seed`. This publishes the demo shop, Marigold Bakehouse, to your sandbox catalog. It prints the shop link, the agent door link and, this one time only, the owner link. Keep the owner link private.
8. Any hosted assistant can now use the agent door at `https://<service>.onrender.com/s/marigold-bakehouse/mcp`.

## Tests

```bash
npm test               # unit tests (Vitest), no network
npm run test:sandbox   # real PayPal sandbox calls; needs PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY
npm run test:ai        # real Claude on the sample photos; needs ANTHROPIC_API_KEY
npm run e2e            # Playwright; starts the app on port 3100 (set E2E_PORT to change)
npm run typecheck && npm run lint
```

Two Playwright specs are worth knowing by name:

```bash
# The capture gate: the whole money path against the real PayPal sandbox, no mocks. A new shop is read by
# Claude and published to the PayPal catalog; an MCP client orders over the agent door; PayPal guest card
# checkout approves; Shelfie captures; the receipt says Paid; PayPal reports the order COMPLETED; the
# Claude brief is written; USPS tracking is added at PayPal; get_order_status reads it back. ~2 minutes.
E2E_PORT=3110 DATABASE_PATH=data/e2e-capture.db npx playwright test e2e/capture.spec.ts

# Every screen at 390 px and 1440 px with an axe (WCAG 2.1 A/AA) check, into data/screenshots/ (gitignored;
# SCREENSHOTS_DIR picks another folder). No PayPal or Claude calls.
npm run screenshots

# The same 68 screens against a production build (next build + next start), which avoids dev-mode compile
# pauses: a fresh e2e database, one run. The judged sets (round 2 onwards) were made this way. The folder is
# required and is replaced, so pick a new one or a /tmp path.
npm run screenshots:prod -- /tmp/shelfie-shots
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

- One sandbox merchant receives all payments. Per-seller onboarding (PayPal Partner Referrals) is the path to production; see [Path to scale](#path-to-scale).
- USD only; no refunds or disputes UI; no tax; one flat shipping fee, no per-address rates.
- Menu edits after launch are limited to sold-out and pause; products are not renamed in PayPal.
- Sold-out is a toggle, not stock counts. Pickup time is a free-text note.
- No seller accounts or passwords (owner link), no MCP OAuth, no ACP/UCP adapters, no email or SMS.
- Webhooks need a public URL and are not verified end to end; the 15 s poller covers local runs.
- Paying with a PayPal wallet login is unverified (guest card checkout is verified).

## Path to scale

**None of this is built or verified.** Today every shop's payments go to one sandbox merchant, the account that owns the app's PayPal credentials. The planned path:

- **Seller onboarding:** each seller links their own PayPal account through Partner Referrals (`POST /v2/customer/partner-referrals`), and Shelfie stores their merchant id. Live use needs PayPal to approve Shelfie as a partner.
- **Orders:** `create_order` names that seller as the purchase unit's `payee`, so the money goes to the seller, not to Shelfie.
- **Seller-side calls:** tracking and refunds made on a seller's behalf send a `PayPal-Auth-Assertion` header for that merchant.
- **Webhooks:** events are matched to the merchant they name, instead of one app-wide webhook for one merchant.
- **Storage:** SQLite on one disk moves to Postgres, so the service can run as more than one instance.

## Built with

PayPal REST APIs and `@paypal/agent-toolkit`; Anthropic Claude `claude-sonnet-5-5` via `@anthropic-ai/sdk`; `@modelcontextprotocol/sdk` (TypeScript); Next.js 16; SQLite. MIT licensed.
