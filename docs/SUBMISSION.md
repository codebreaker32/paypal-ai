# Devpost submission draft

A ready-to-paste draft for the Devpost form. Every fact comes from `docs/EVIDENCE.md` (sourced) or from runs recorded in `docs/judge/` and `docs/PROGRESS.md` (verified). Before submitting, fill in the three placeholders marked **TODO** (video, hosted URL if any, repo URL once public), and remove any claim that changed since.

**Before you submit (required by the rules):**
- the repo is **public**, and GitHub shows the MIT licence in the About box;
- the video is under 3 minutes and public on YouTube, with no third-party trademarks or copyrighted music;
- the sandbox credentials a judge needs are in the README, or instructions to get them (the README's Quick start covers this).

---

## Project name
Shelfie

## Elevator pitch (200 characters max)
Snap a photo of your price list. Shelfie turns it into a PayPal shop with an agent door, so any AI assistant can order from you, and the buyer pays on PayPal.

## About the project

### Inspiration
AI assistants have started shopping for people, and PayPal is making merchants reachable by them. But PayPal's agent checkout "is limited to Store Sync customers today", for merchants "using their existing website storefronts" (PayPal Developer blog, Sep 2026). Many small sellers don't have one. In Census data, 47% of US accommodation and food-service employer firms reported having no website (data year 2016). A home baker told Radio IQ she took orders by "text messages and Facebook messages and Instagram DMs ... And then tracking them on a spreadsheet." Those sellers already have the most important asset, a price list. It's on paper.

### What it does
- **Snap.** The seller photographs a chalkboard, whiteboard or printed price list (1 to 4 photos), or tries a sample menu.
- **Claude reads it.** Claude (`claude-sonnet-5-5`, vision with structured output) returns sections, items, sizes and prices. Anything unclear is turned into a plain question the seller answers in one tap: a crossed-out price, "2 for $7", "market price", a blurry line, an item listed twice. Nothing unresolved goes live.
- **Publish to PayPal.** Each item becomes a product in the seller's PayPal catalog through the Catalog Products API. Over 6 measured runs, photo to live shop took 8 to 14 seconds of machine time.
- **The agent door opens.** Every shop gets its own MCP endpoint (`/s/<shop>/mcp`, Streamable HTTP) with four tools: `get_shop_info`, `list_products`, `create_order` and `get_order_status`. Any MCP client can use it. We recorded the Claude Code CLI, with no Shelfie code involved, browsing a shop and placing a real sandbox order.
- **Safe agent orders.** Prices come only from the shop. An agent that sends a `price` gets `INVALID_ARGUMENTS`. Orders are idempotent per `client_request_id`, and order and rate limits apply.
- **PayPal Orders v2.** `create_order` builds the order from the shop's own data, with each line's SKU pointing to its Catalog product, and returns PayPal's approval link. The human always approves on PayPal. Shelfie then captures, confirmed by the return URL, a 15-second status poller, or a webhook once deployed.
- **An AI brief for the seller.** When an order is paid, a Claude agent reads PayPal's own record of it through the PayPal Agent Toolkit (`get_order`) and writes a short prep brief. In our recorded runs it caught a buyer's nut allergy against an almond croissant in the order.
- **Tracking back to PayPal.** The seller adds a carrier and tracking number, and Shelfie adds it to the PayPal transaction with the Agent Toolkit (`create_shipment_tracking`). The buyer's assistant then reads it back with `get_order_status`.
- **Try it without any AI setup.** The shop page has **Order with an assistant**, a Claude agent that is an MCP client of the shop's own door over real HTTP. Its Activity panel shows every call.
- **Seller tools:** a dashboard with orders grouped "to prepare" and "waiting for payment", sold out for today, pause agent orders, a share tab with the door link, and a private owner link instead of an account.

### How we built it
- **Next.js 16** (App Router) and **TypeScript**, one web service with **SQLite** (Render blueprint included). Money is integer cents.
- **PayPal:**
  - REST APIs (OAuth, Catalog Products, Orders v2 create and capture, webhook verification), each call with its own `PayPal-Request-Id`;
  - the **PayPal Agent Toolkit** (`get_order`, `get_shipment_tracking`, `create_shipment_tracking`), allowlisted to those tools, and never exposed to buying agents, because its `create_order` takes prices from the model.
- **Anthropic Claude** via `@anthropic-ai/sdk`:
  - `messages.parse` with a Zod output schema for the menu reading;
  - the beta tool runner for the brief agent and the buyer console.
- **MCP** via `@modelcontextprotocol/sdk`: a stateless Streamable HTTP server, with a fresh server per request, per shop.
- **Tests:** 651 unit tests (Vitest), a Playwright e2e suite, and a **capture gate** that runs the whole money path against the real PayPal sandbox: photo read by Claude → Catalog publish → MCP order → PayPal guest card approval → capture COMPLETED → AI brief → USPS tracking at PayPal → `get_order_status`. Every screen is screenshotted at 390 and 1440 px with an axe (WCAG 2.1 AA) check; the last run had 0 violations. Two whole-codebase correctness reviews, with a skeptic trying to refute each finding, confirmed 27 bugs; all 27 are fixed, with a test each (`docs/reviews/`).

### Challenges we ran into
- **Making AI output safe to publish.** The model reads; deterministic code decides. A normaliser turns the reading into cents, sizes and four review flags, and the seller sees fixed plain sentences rather than the model's own notes.
- **Letting agents buy without letting them set prices.** The door accepts item ids and quantities only, with strict schemas.
- **Sandbox realities.** Our sandbox merchant and buyer are both India accounts, and PayPal blocks wallet payments between them, so we verified payment through PayPal's guest card checkout. Webhooks need a public URL, so a poller confirms payments locally.

### Accomplishments that we're proud of
- A chalkboard becomes an agent-ready PayPal shop in about 10 seconds of machine time.
- An outside assistant (Claude Code) ordered through a shop's door with no Shelfie code involved.
- The full money path is verified end to end on the real sandbox, by an automated test.

### What we learned
Agentic commerce needs a buyer-safe layer between the agent and the payment API: prices from the merchant, idempotent orders, and a human approval step that the agent can't skip.

### What's next
- **Pay each seller directly:** PayPal Partner Referrals onboarding, the seller as the order's payee, and the `PayPal-Auth-Assertion` header for tracking.
- A hosted instance with webhooks, and Postgres for more than one instance.
- Making each shop's door easier for assistants to find.

## Built with
nextjs, typescript, react, tailwindcss, sqlite, paypal-rest-api, paypal-orders-v2, paypal-catalog-products, paypal-agent-toolkit, anthropic-claude, claude-sonnet, model-context-protocol, playwright, vitest, render

## AI tools and models used, and how
Full detail: [`docs/AI_TOOLS.md`](AI_TOOLS.md).

- **Claude `claude-sonnet-5-5`, vision with structured output:** reads the menu photos into items, sizes and prices, with a confidence level and notes.
- **Claude `claude-sonnet-5-5` with the PayPal Agent Toolkit:** an agent that reads PayPal's record of each paid order (`get_order`, `get_shipment_tracking`) and writes the seller's brief.
- **Claude `claude-sonnet-5-5` as an MCP client:** the in-app "Order with an assistant" console, ordering through the shop's own agent door.
- **PayPal Agent Toolkit:** `create_shipment_tracking` for the seller's tracking numbers.
- **MCP server (`@modelcontextprotocol/sdk`):** the per-shop agent door any AI assistant can order through.
- **Built with Claude Code (Claude Opus):** design, planning, implementation by parallel agents, code review, and an independent judge agent scoring each milestone against a fixed rubric.

## Links
- Video: **TODO** (YouTube, public, under 3 minutes; script in [`docs/DEMO.md`](DEMO.md))
- Repo: **TODO** (`https://github.com/codebreaker32/paypal-ai` once public)
- Hosted demo: **TODO** if deployed (Render steps in the README), otherwise "run locally from the README"

## Test credentials for judges
Sandbox only. A judge needs their own free PayPal developer sandbox app and an Anthropic API key (see the README's Quick start). To pay at PayPal's sandbox approval page, choose **Pay with Credit or Debit Card**: country **United States**, PayPal's sandbox test Visa `4012000033330026`, any future expiry (for example 12/30), CVV `123` and any US address. Switch off "Save info & create your PayPal account", then **Pay Now**. No PayPal login is needed.
