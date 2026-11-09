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
Shelfie is for sellers with a paper menu and no website: one photo of the price list, and AI shoppers can order from them and pay with PayPal, straight into the seller's own account.

## About the project

### Inspiration
AI assistants have started shopping for people, and PayPal is making merchants reachable by them. But PayPal's agent checkout "is limited to Store Sync customers today", for merchants "using their existing website storefronts" (PayPal Developer blog, Sep 2026). Many small sellers don't have one. In Census data, 47% of US accommodation and food-service employer firms reported having no website (data year 2016). A home baker told Radio IQ she took orders through text and social-media messages, "and then tracking them on a spreadsheet." Those sellers already have the most important asset, a price list. It's on paper.

**Who it's for:** Shelfie is for sellers with a paper menu and no website: one photo of the price list, and AI shoppers can order from them and pay with PayPal, straight into the seller's own account. Before Shelfie, an AI assistant had no way to buy from them at all.

### What it does
- **Snap.** The seller photographs a chalkboard, whiteboard or printed price list (1 to 4 photos), or tries a sample menu.
- **Claude reads it.** Claude (`claude-sonnet-5-5`, vision with structured output) returns sections, items, sizes and prices. Anything unclear is turned into a plain question the seller answers in one tap: a crossed-out price, "2 for $7", "market price", a blurry line, an item listed twice. Nothing unresolved goes live.
- **Publish to PayPal.** Each item becomes a product in PayPal's catalog through the Catalog Products API. The seller types **Your PayPal email**, the one place they get paid. Over 6 measured runs, photo to live shop took 8 to 14 seconds of machine time.
- **The agent door opens.** Every shop gets its own MCP endpoint (`/s/<shop>/mcp`, Streamable HTTP) with four tools: `get_shop_info`, `list_products`, `create_order` and `get_order_status`. Any MCP client can use it.
- **Assistants can find it on their own.** The public shop page carries schema.org JSON-LD (the menu as offers, `paymentAccepted: PayPal`, an `OrderAction` whose target is the door) and a `<link rel="alternate" title="Agent door (MCP)">`, and `/agents.txt` and `/llms.txt` list every shop that takes orders. For the counter, the Share tab prints a card with a QR code of the shop link: "Order ahead with any AI assistant, pay with PayPal". We gave the Claude Code CLI **only the shop's web address**, with no MCP servers configured: it found the door on the page and placed a real sandbox order in 22.9 seconds.
- **Safe agent orders.** Prices come only from the shop. An agent that sends a `price` gets `INVALID_ARGUMENTS`. Orders are idempotent per `client_request_id`, and order and rate limits apply.
- **PayPal Orders v2, paid to the seller.** `create_order` builds the order from the shop's own data, with each line's SKU pointing to its Catalog product and the seller's email as `purchase_units[0].payee`, and returns PayPal's approval link. The human always approves on PayPal. Shelfie then captures, confirmed by the return URL, a 15-second status poller, or a webhook once deployed. Verified in the sandbox: a US buyer logged in to PayPal, paid a shop, and PayPal's own order record names the seller as payee with the capture COMPLETED. If the email has no PayPal account yet, PayPal holds the money (UNILATERAL) and the seller's order page says so in plain words. The receipt says whose account was paid, with the email masked.
- **An AI brief for the seller.** When an order is paid, a Claude agent reads PayPal's own record of it through the PayPal Agent Toolkit (`get_order`) and writes a short prep brief. In our recorded runs it caught a buyer's nut allergy against an almond croissant in the order.
- **Tracking.** The seller adds a carrier and tracking number, and the buyer's assistant reads it back with `get_order_status`. For the platform-paid demo shop, Shelfie also adds it to the PayPal transaction with the Agent Toolkit (`create_shipment_tracking`). PayPal accepts tracking only from the account that was paid, so for a seller-paid order Shelfie saves it and tells the seller to add it in their own PayPal account too.
- **A storefront where the food is the hero.** The public shop page leads with the shop's cover photo and a grid of 4:3 photo tiles, two across on a phone and up to four on a laptop, with a sticky **Order with an assistant · PayPal** bar on phones. The seller adds a photo per item while reviewing the reading or later on the Menu tab. An item without one shows a labelled example photo, or a drawing of what it is. Photos are re-encoded as WebP with the phone's metadata stripped, and agents get the seller's own photos (`image_url` in `list_products`, `image` in the JSON-LD), never an example.
- **A real cart for buyers who'd rather tap.** A tile opens the item's sheet (options, quantity, the full description), `+` adds a single-option item straight away, and the order opens in a side panel on a laptop or a sheet on a phone. **Approve on PayPal** creates the same PayPal order as the agent door: the server refuses any price it is sent and works out the total from the shop's own prices.
- **Snap your counter.** One more photo, of the display case: Claude finds which menu items are in it and Shelfie crops a photo of each, which the seller keeps or skips. In a live run on a bakery case it found the plain and the almond croissant in 4.7 seconds.
- **Installable on a phone.** Shelfie is a PWA (manifest, icons, iOS meta); Chromium's installability check reports no errors. On purpose there is no offline cache: a stale payment page is worse than none.
- **Try it without any AI setup.** The shop page has **Order with an assistant**, a Claude agent that is an MCP client of the shop's own door over real HTTP. Its Activity panel shows every call.
- **Seller accounts.** Sign up with an email and a password, and run several shops from one login. Shelfie sends no email yet, so a one-time recovery key, shown once at sign-up, is the way back in after a forgotten password.
- **Seller tools:** a seller app (a sidebar on a laptop, a tab bar on a phone) with a compact order list (thumbnails, status filters To prepare · Waiting for payment · Done), sold out for today, pause agent orders, a Share tab with the door link and the counter card, and a Settings tab for the PayPal email.
- **Presses you can hear.** A soft click on each press and a chime on the dashboard when a paid order arrives, generated in the browser with no audio files. One switch per device turns off sound and vibration: in Settings for sellers, in the page footer for everyone else.

### How we built it
- **Next.js 16** (App Router) and **TypeScript**, one web service with **SQLite** (Render blueprint included). Money is integer cents.
- **PayPal:**
  - REST APIs (OAuth, Catalog Products, Orders v2 create with a per-seller `payee` and capture, webhook verification), each call with its own `PayPal-Request-Id`. Before capturing, Shelfie checks PayPal's record of the order (amount, `custom_id` and payee) against its own;
  - the **PayPal Agent Toolkit** (`get_order`, `get_shipment_tracking`, `create_shipment_tracking`), allowlisted to those tools, and never exposed to buying agents, because its `create_order` takes prices from the model.
- **Anthropic Claude** via `@anthropic-ai/sdk`:
  - `messages.parse` with a Zod output schema for the menu reading;
  - the beta tool runner for the brief agent and the buyer console.
- **MCP** via `@modelcontextprotocol/sdk`: a stateless Streamable HTTP server, with a fresh server per request, per shop.
- **Accounts:** passwords hashed with scrypt, server-side sessions, and a one-time recovery key.
- **Tests:** more than 2,100 unit tests (Vitest), a Playwright e2e suite, and a **capture gate** that runs the whole money path against the real PayPal sandbox three times. The seller gate: photo read by Claude → Catalog publish with the seller's PayPal email → MCP order → the buyer **logs in to PayPal** and pays → capture COMPLETED with PayPal's record naming the seller as payee → AI brief → tracking → `get_order_status`. The demo-shop gate: guest card → capture COMPLETED → USPS tracking at PayPal. The cart gate: a buyer adds from the shop page → wallet login → capture COMPLETED to the seller → the cart empties → AI brief. Every screen is screenshotted at 390 and 1440 px with an axe (WCAG 2.1 AA) check; the last run had 0 violations. Two whole-codebase correctness reviews, with a skeptic trying to refute each finding, confirmed 27 bugs, and all 27 are fixed; a third review covered the seller payouts and the findable door (`docs/reviews/`).

### Challenges we ran into
- **Making AI output safe to publish.** The model reads; deterministic code decides. A normaliser turns the reading into cents, sizes and four review flags, and the seller sees fixed plain sentences rather than the model's own notes.
- **Letting agents buy without letting them set prices.** The door accepts item ids and quantities only, with strict schemas.
- **Paying the seller, not the platform, without onboarding.** We tested each case in the sandbox before building it: a seller's email as `payee` captures COMPLETED into their account when the buyer logs in to PayPal; an email with no PayPal account is still accepted but held (UNILATERAL); PayPal refuses tracking from the platform on the seller's capture; and guest card checkout is declined on a seller-paid order. The product follows those facts: a held payment is explained to the seller, tracking for seller-paid orders is saved in Shelfie, and guest card checkout is used only on the platform-paid demo shop.
- **Letting an assistant find a shop it was never told about.** A door is only useful if assistants can reach it from the link a regular already has. The shop page itself says where the door is, in markup an agent reads (JSON-LD and `<link rel="alternate">`), and a seller's own text can't forge a door line in `/llms.txt`.
- **Sandbox realities.** Webhooks need a public URL, so a poller confirms payments locally.

### Accomplishments that we're proud of
- A chalkboard becomes an agent-ready PayPal shop in about 10 seconds of machine time.
- An outside assistant (Claude Code), given only the shop's web address, found the door and ordered, with no Shelfie code involved.
- The full money path is verified end to end on the real sandbox, by an automated test, twice over: paid by PayPal login into a seller's own account, and by guest card into the demo shop.

### What we learned
Agentic commerce needs a buyer-safe layer between the agent and the payment API: prices from the merchant, idempotent orders, and a human approval step that the agent can't skip.

### What's next
- **Onboard each seller with PayPal Partner Referrals:** the payee becomes the seller's merchant id instead of an email, Shelfie can confirm the account before the first order, add tracking on the seller's behalf (`PayPal-Auth-Assertion`) and take a platform fee.
- A hosted instance with webhooks, and Postgres for more than one instance.
- Listing shops in the places assistants already look for merchants.

## Built with
nextjs, typescript, react, tailwindcss, sqlite, paypal-rest-api, paypal-orders-v2, paypal-catalog-products, paypal-agent-toolkit, anthropic-claude, claude-sonnet, model-context-protocol, playwright, vitest, render

## AI tools and models used, and how
Full detail: [`docs/AI_TOOLS.md`](AI_TOOLS.md).

- **Claude `claude-sonnet-5-5`, vision with structured output:** reads the menu photos into items, sizes and prices, with a confidence level and notes.
- **Claude `claude-sonnet-5-5` with the PayPal Agent Toolkit:** an agent that reads PayPal's record of each paid order (`get_order`, `get_shipment_tracking`) and writes the seller's brief.
- **Claude `claude-sonnet-5-5`, vision with structured output (snap your counter):** finds the shop's menu items in a photo of the display case and gives a box around each, which Shelfie crops into item photos the seller keeps or skips. The answer can only name item ids from the menu.
- **Claude `claude-sonnet-5-5` as an MCP client:** the in-app "Order with an assistant" console, ordering through the shop's own agent door.
- **PayPal Agent Toolkit:** `create_shipment_tracking` adds tracking numbers to PayPal for orders paid to the platform account (the demo shop); PayPal accepts tracking only from the account that was paid.
- **MCP server (`@modelcontextprotocol/sdk`):** the per-shop agent door any AI assistant can order through, advertised on the shop page (JSON-LD, `<link rel="alternate">`) and in `/agents.txt` and `/llms.txt`.
- **Claude Code CLI as an outside assistant (testing only):** given only a shop's web address and no MCP configuration, it found the door and placed a real sandbox order (`docs/judge/evidence/discovery-claude-code.md`).
- **Built with Claude Code (Claude Opus):** design, planning, implementation by parallel agents, code review, and an independent judge agent scoring each milestone against a fixed rubric.

## Links
- Video: **TODO** (YouTube, public, under 3 minutes; script in [`docs/DEMO.md`](DEMO.md))
- Repo: **TODO** (`https://github.com/codebreaker32/paypal-ai` once public)
- Hosted demo: **TODO** if deployed (Render steps in the README), otherwise "run locally from the README"

## Testing instructions
The README's [Quick start](../README.md#quick-start) has every step; in short:

1. `git clone`, `npm install`, `cp .env.example .env`, and fill in three keys: a free PayPal **sandbox** app's client id and secret (developer.paypal.com → Apps & Credentials → Sandbox → Create App) and an Anthropic API key.
2. `npm run seed` publishes the demo shop, Marigold Bakehouse, to your sandbox catalog and prints its owner link, which opens that shop's seller dashboard without an account. `npm run dev` starts the app on http://localhost:3000.
3. **Seller:** tap **Add your shop** and sign up (any email address, a password of 15 or more characters; about 15 seconds). Save the recovery key, tap **Continue**, then pick a sample menu (or upload a photo of any price list). Claude reads it, you answer its questions, type your PayPal email, and **Publish**.
4. **Buyer:** open a shop and use **Order with an assistant**, add items to the cart and tap **View order**, or point any MCP client at the shop's agent door (`/s/<shop>/mcp`; the README has a `curl` example). Or give an assistant only the shop's URL: the page tells it where the door is.
5. **Pay** on PayPal's sandbox page (below), then watch the receipt turn **Paid** and the order appear in the seller dashboard with its AI brief. Add tracking, and ask the assistant "Where's my order?".

`npm test` runs the unit tests with no network. `npm run e2e` runs the browser tests, including the capture gate against the real sandbox.

## Test credentials for judges
Sandbox only, and no credentials are committed: a judge needs their own free PayPal developer sandbox app and an Anthropic API key (above). There is no shared Shelfie login: a judge signs up. Two ways to pay at PayPal's sandbox approval page:

- **The demo shop with only the app keys** is paid to your app's own sandbox account. Choose **Pay with Credit or Debit Card**: country **United States**, PayPal's sandbox test Visa `4012000033330026`, any future expiry (for example 12/30), CVV `123` and any US address. Switch off "Save info & create your PayPal account", then **Pay Now**. No PayPal login is needed.
- **A shop paid to a seller's own account** (any shop you publish, or the demo shop with `PAYPAL_SANDBOX_SELLER_EMAIL` set): in the developer dashboard, Testing Tools → Sandbox Accounts, use a **US Business** account's email as the shop's PayPal email, and pay by logging in with a **US Personal** account (**View/Edit account** shows each one's password). The sandbox declines guest cards on seller-paid orders.
