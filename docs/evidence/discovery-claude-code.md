# Claude Code finds the agent door from the shop URL alone, and orders

**When:** 2026-11-06 07:04:29 to 07:04:54 UTC (22.9 s of agent time, 6 turns, from the run's `result` event).
**What it shows:** an AI assistant that was given **only the public shop page URL** (no door URL, no MCP configuration, no project files) found the shop's agent door on the page, spoke MCP to it, and placed a real PayPal sandbox order. The earlier proof ([outside-client-claude-code.md](outside-client-claude-code.md)) handed Claude Code the door through `--mcp-config`; this one doesn't.
**Raw transcript:** [discovery-claude-code.jsonl](discovery-claude-code.jsonl) (Claude Code `stream-json`, unedited; checked for secrets: none of the `.env` values appear in it).

## Setup

A production build of main at commit `2d09bae` (Task 10 merged: JSON-LD, `<link rel="alternate">`, `/agents.txt`, `/llms.txt`, the counter card), on port 3301, with a new, empty database. The demo shop was seeded into it (9 products published to the PayPal sandbox catalog).

```bash
DATABASE_PATH=data/discovery/build.db npm run build
PORT=3301 DATABASE_PATH=data/discovery/d.db UPLOADS_DIR=data/discovery/uploads APP_URL=http://localhost:3301 npm start
PORT=3301 DATABASE_PATH=data/discovery/d.db UPLOADS_DIR=data/discovery/uploads APP_URL=http://localhost:3301 npm run seed
```

Before the run, the page served what the assistant would find:

```
$ curl -s http://localhost:3301/s/marigold-bakehouse | grep -o '<link rel="alternate"[^>]*>'
<link rel="alternate" type="application/json" title="Agent door (MCP)" href="http://localhost:3301/s/marigold-bakehouse/mcp"/>
$ (the page's application/ld+json) → @type FoodEstablishment, paymentAccepted PayPal,
  potentialAction OrderAction → target.urlTemplate http://localhost:3301/s/marigold-bakehouse/mcp
$ curl -s http://localhost:3301/llms.txt  → lists "Marigold Bakehouse … Agent door: http://localhost:3301/s/marigold-bakehouse/mcp"
```

## The run

Claude Code 2.1.318 in `--bare` mode: no hooks, plugins, memory or CLAUDE.md discovery. It ran from an empty folder outside the repo (`/tmp/shelfie-discovery`), so no project file could mention the door. `--strict-mcp-config` with no config means **no MCP servers**. Its environment held only `PATH`, `HOME` and `ANTHROPIC_API_KEY`, and the only pre-approved tool was `curl` (`Bash(curl:*)`; `WebFetch` was allowed too, but `--bare` didn't offer it). The model was `claude-opus-5-5` (the init event).

```bash
cd /tmp/shelfie-discovery   # empty
claude --bare -p "<prompt>" --strict-mcp-config --allowedTools WebFetch "Bash(curl:*)" \
  --output-format stream-json --verbose --no-session-persistence
```

The prompt, in full:

> There's a bakery I like at http://localhost:3301/s/marigold-bakehouse . Please order two almond croissants for pickup, under the name Sam. Any total under $15 is fine with me, so you don't need to check back: place the order and give me the PayPal link to pay.

What it did (tool calls from the transcript, in order):

1. `curl -s http://localhost:3301/s/marigold-bakehouse | head -c 5000`: the shop page's first 5,000 characters. They contain the `<head>` with `<link rel="alternate" type="application/json" title="Agent door (MCP)" href=".../mcp">` (at character 1,153 of the page). The only door URL in what it read is that link's. Its next line: *"There's an MCP agent door. Let me explore it."*
2. A combined `cd /tmp; curl … | grep potentialAction; curl …/mcp` was refused by the permission rule (only plain `curl` was pre-approved). It retried with plain curl.
3. `POST …/mcp` `tools/list` (JSON-RPC over HTTP): the four tools, `get_shop_info`, `list_products`, `create_order`, `get_order_status`.
4. `tools/call get_shop_info`, then `tools/call list_products {"query":"almond"}`: Marigold Bakehouse, pickup or shipping, the almond croissant at $5.00 with its item and option ids.
5. It checked the user's limit (*"2 × $5.00 = $10.00 with pickup and no shipping fee. That's under your $15 limit, so I'll place the order."*), then `tools/call create_order` with `items: [{ item_id, option_id, quantity: 2 }]`, `fulfillment: "pickup"`, `buyer_name: "Sam"` and a `client_request_id`. No price was sent.
6. The door answered `SHF-LFMY4J`, `awaiting_approval`, total `10.00`, `approval_url: https://www.sandbox.paypal.com/checkoutnow?token=38C29533C7243501S`.

Its final answer to the user gave the PayPal link, the order number, the items and total, the 60-minute expiry ("Nothing is charged until you approve on PayPal"), the pickup notes from `get_shop_info`, and it noticed the link is PayPal's sandbox.

## Checked afterwards

- **PayPal's own record** (`GET /v2/checkout/orders/38C29533C7243501S` with the app's keys): `PAYER_ACTION_REQUIRED`, $10.00, `invoice_id` SHF-LFMY4J, `custom_id` = Shelfie's order id `ord_kkpvw6n3vpiauqql`, one line "2x Almond croissant" with `sku` = its Catalog product `PROD-6SW84682FL444074M`.
- **Shelfie's database:** one order, SHF-LFMY4J, `awaiting_approval`, buyer "Sam", $10.00, one `created` event from the door (`mcp`). curl sends no client name, so the order is attributed to "an AI assistant".

## Limits

- It ran on localhost, not a deployed URL. A hosted assistant (Claude.ai, ChatGPT) needs the deployed HTTPS URL (`docs/DEPLOY.md`).
- The assistant spoke MCP with curl (JSON-RPC over HTTP), because it had no MCP client configured; that is the point of the test. With an MCP client it would add the same URL (`claude mcp add --transport http …`, which the page and `/llms.txt` also show).
- The payment was not completed in this run; paying and capturing are covered by the capture gate.
