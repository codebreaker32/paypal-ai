# Shelfie

**Snap a photo of your price list. Shelfie turns it into a PayPal-backed shop with an _agent door_: a link any AI assistant can use to browse your menu and order, with the buyer approving payment on PayPal.**

Built for the PayPal AI Hackathon. PayPal **sandbox** only.

> PayPal's agent-commerce tools reach sellers who already have a store: Agent Ready is for "existing PayPal merchants", and its agent checkout "is limited to Store Sync customers today" ([sources](docs/EVIDENCE.md)). Shelfie is for the sellers with a chalkboard instead: home bakers, food trucks, market stalls, repair shops.

## What it does

1. **Snap.** The seller photographs a paper, chalkboard or whiteboard price list (1–4 photos).
2. **Claude reads it.** Items, sizes and prices come back as a draft menu. Anything unclear (a crossed-out price, "2 for $7", "market price", a blurred line) is flagged with a one-tap fix. Unresolved items simply stay off the shop.
3. **Publish to PayPal.** Every item becomes a product in the seller's **PayPal catalog** (Catalog Products API).
4. **The agent door opens.** The shop gets its own **MCP endpoint**. Claude, ChatGPT, Claude Code or any MCP client can list products and place an order. Prices come only from the shop.
5. **PayPal checkout.** `create_order` builds a **PayPal Orders v2** order and returns the approval link. The buyer approves on PayPal; Shelfie captures the payment (return URL, webhook, or a polling fallback).
6. **Seller dashboard.** Paid orders arrive with an **AI brief** written by a Claude agent that reads PayPal's own record through the **PayPal Agent Toolkit** ("⚠ buyer says nut allergy, but almond croissants contain nuts"). Shipped orders get tracking added to PayPal, which the buyer's agent can read back.

AI tools and models used, and how: [docs/AI_TOOLS.md](docs/AI_TOOLS.md).

## Run it locally

**Requirements:** Node.js 22+, npm, a PayPal developer account (free), an Anthropic API key.

```bash
git clone <this repo> shelfie && cd shelfie
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET_KEY` | [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → **Sandbox** → create an app (Merchant). `PAYPAL_SECRET_KEY` is the app's client secret. |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `PAYPAL_SANDBOX_BUYER_EMAIL`, `PAYPAL_SANDBOX_BUYER_PASSWORD` (optional) | developer.paypal.com → Testing Tools → Sandbox Accounts → the **Personal** account → View/Edit. Used to approve payments on PayPal's sandbox page and by the end-to-end capture test. |

```bash
npm run dev          # http://localhost:3000
```

Then: **Try a sample menu** → review → **Publish** → on the live screen, **Watch an AI order from you** → approve on PayPal with the sandbox buyer → the order appears on the dashboard, paid, with its AI brief.

### Connect a real AI assistant to a shop's agent door
The shop page shows the URL (`http://localhost:3000/s/<shop>/mcp`).
- **Claude Code:** `claude mcp add --transport http <shop> http://localhost:3000/s/<shop>/mcp`
- **Claude Desktop:** add a server that runs `npx mcp-remote http://localhost:3000/s/<shop>/mcp`
- **MCP Inspector:** `npx @modelcontextprotocol/inspector` → Streamable HTTP → the URL
- **Claude / ChatGPT custom connectors** need a public HTTPS URL (deploy, or a tunnel).

## Tests

```bash
npm test               # unit tests, no network
npm run test:sandbox   # real PayPal sandbox calls (needs .env)
npm run test:ai        # real Claude extraction on the sample menus
npm run e2e            # Playwright end-to-end (approves on PayPal if the sandbox buyer is set)
```

## How it's built
Next.js 16 (App Router, TypeScript), SQLite (`better-sqlite3`), `@anthropic-ai/sdk` (Claude Sonnet 5.5), `@paypal/agent-toolkit`, `@modelcontextprotocol/sdk`. One web service. Design spec: [docs/superpowers/specs/2026-11-06-shelfie-design.md](docs/superpowers/specs/2026-11-06-shelfie-design.md).

| PayPal API | Used for |
|---|---|
| OAuth 2.0 client credentials | every call |
| Catalog Products `POST /v1/catalogs/products` | one product per menu item on publish |
| Orders v2 create / get / capture | agent orders; `PayPal-Request-Id` on every write |
| Shipment tracking (Agent Toolkit `create_shipment_tracking`) | seller adds tracking |
| Orders get + tracking get (Agent Toolkit, by a Claude agent) | the seller's AI order brief |
| Webhooks + `verify-webhook-signature` | faster payment updates once deployed |

## Limitations (hackathon scope)
- All shops are paid into one sandbox merchant account. Per-seller onboarding (PayPal Partner Referrals) is the path to production.
- USD only. No refunds/disputes UI, tax, or per-address shipping rates (one flat fee).
- Seller sign-in is a private owner link stored in a cookie, not an account.
- Webhooks need a public URL; locally, the return URL and a 15-second poller confirm payments.

## License
[MIT](LICENSE)
