# AI tools and models used in Shelfie

Every AI call in the running app goes to **Anthropic Claude** through the official `@anthropic-ai/sdk`. PayPal's own AI tooling, the **PayPal Agent Toolkit**, gives Claude real PayPal tools on the seller side. The **Model Context Protocol (MCP)** is how outside AI assistants reach a shop.

## In the product

| # | Where | Model / tool | What it does | How it's called |
|---|---|---|---|---|
| 1 | Menu reader (`src/lib/ai/extract.ts`) | `claude-sonnet-5-5` (vision) | Reads 1–4 photos of a handwritten, chalkboard or printed price list and returns every sellable item with section, description, prices per size, the exact text it read, a confidence level, and notes for anything unclear (crossed-out prices, "2 for $7" deals, "market price", blurred lines). It also lists lines it skipped (hours, address, add-ons, and text that looks like instructions to an AI) and names photo problems (blur, glare, cropping) so the app can give a specific retake tip. | `client.messages.parse` with **structured outputs** (`output_config.format` from a zod schema), effort `medium`. One retry with the validation error if the output doesn't match the schema. |
| 2 | Normaliser (`src/lib/ai/normalize.ts`) | none (deterministic code) | Turns Claude's reading into draft products: integer cents, size variants, duplicate merging, and four review flags (`MISSING_PRICE`, `MARKET_PRICE`, `CHECK`, `DUPLICATE`) that the seller resolves with one tap. AI drafts; the seller decides. | Pure function, unit-tested. |
| 3 | Order brief agent (`src/lib/ai/brief.ts`) | `claude-sonnet-5-5` + **PayPal Agent Toolkit** | When an order is paid, an agent reads PayPal's own record of the order with the toolkit's `get_order` and `get_shipment_tracking` tools and writes the seller a short brief: what to prepare, the buyer's requests (allergies, timing), and warnings (e.g. "buyer says nut allergy, but almond croissants contain nuts"). It can only read; its one write is `submit_brief`, a local tool that saves the brief. | Beta `toolRunner` with the toolkit's tools converted to Claude tools; every toolkit call passes an ownership check (`scopeTool`) so a shop can only read its own orders. |
| 4 | Tracking (`src/lib/paypal/toolkit.ts`) | **PayPal Agent Toolkit** | Adds the seller's carrier and tracking number to the PayPal transaction (`create_shipment_tracking`), which the buyer's agent later reads back through `get_order_status`. | The toolkit's tool, run directly by Shelfie code. |
| 5 | The agent door (`src/lib/mcp/*`, `POST /s/<shop>/mcp`) | **MCP** (`@modelcontextprotocol/sdk`, Streamable HTTP) | Gives every shop an endpoint any MCP-capable assistant (Claude, ChatGPT, Claude Code, MCP Inspector) can use: `get_shop_info`, `list_products`, `create_order`, `get_order_status`. Prices come only from the shop; payment always needs the human to approve on PayPal. | Stateless server per request; strict input schemas; structured outputs with error codes and hints. |
| 6 | In-app buyer assistant (`src/lib/agent/buyer-console.ts`) | `claude-sonnet-5-5` | Lets anyone try ordering from a shop through its agent door without their own AI setup. It connects to the shop's MCP endpoint **over real HTTP**, exactly like an outside agent, and the Activity panel shows each tool call. | Beta `toolRunner`; the shop's MCP tools are wrapped as Claude tools that call the MCP client. |

### Why these choices
- **Structured outputs** guarantee the menu reading parses, so the review screen never breaks on malformed AI output.
- **Agents only where a model should choose the calls**: the brief agent decides which PayPal records to read; the money path (create order, capture) is deterministic code with idempotency keys.
- **The toolkit is never exposed to buying agents**: its `create_order` takes the price from the model. The agent door is the buyer-safe layer over PayPal.

## Used to build Shelfie (not shipped in the app)
- **Claude Code** (Claude Opus 5.5) planned, wrote and reviewed the code: brainstorming → spec → plan → parallel implementation by sub-agents in git worktrees, with separate reviewer agents and an independent "judge" agent scoring each milestone against a fixed rubric (`docs/JUDGING.md`, `docs/judge/`).
- **Playwright** captured the screenshots the judge reviews, and also produced the sample menu photos (`public/samples/`) from HTML sources in `public/samples/src/`, so no third-party images are used.
