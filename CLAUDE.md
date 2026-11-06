# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

**Shelfie** (idea A in docs/IDEAS.md): snap a photo of a price list → Claude reads it → PayPal catalog → a per-shop MCP "agent door" any AI assistant can order through → PayPal Orders v2 (approve + capture) → seller dashboard with AI briefs and tracking.
Spec: `docs/superpowers/specs/2026-11-06-shelfie-design.md`. Plan: `docs/superpowers/plans/2026-11-06-shelfie.md`. Progress: `docs/PROGRESS.md`. Decisions: `docs/DECISIONS.md`. Rubric (never edit): `docs/JUDGING.md`.

## Commands

```bash
npm install                 # Node >= 22
cp .env.example .env        # fill PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY, ANTHROPIC_API_KEY
npm run dev                 # http://localhost:3000
npm run build && npm start  # production
npm test                    # unit tests (Vitest), no network
npm run test:sandbox        # real PayPal sandbox calls (needs .env)
npm run test:ai             # real Claude extraction on public/samples (needs ANTHROPIC_API_KEY)
npm run typecheck && npm run lint
npm run e2e                 # Playwright (starts the app on port 3100; E2E_PORT overrides, E2E_REUSE_SERVER=1 attaches to a running one)
npm run screenshots:prod -- <dir>  # every judged screen (390/1440 + axe) against a production build
npm run seed                # publish the demo shop (-- --reset recreates it; -- --cancel-unpaid cancels its unpaid rehearsal orders); prints the owner link once; paid to PAYPAL_SANDBOX_SELLER_EMAIL when set, else the platform account
# photo -> live timing against a running app (see the header of the script for the DATABASE_PATH setup):
DATABASE_PATH=data/measure/m.db BASE_URL=http://localhost:3109 npx tsx scripts/measure-photo-to-live.ts [runs]
```

## Architecture

- **Next.js 16 App Router + TypeScript**, one web service (Render-ready). `cacheComponents` is off: every page reads per-request SQLite/cookies. Route handlers that touch SQLite/sharp/PayPal use `export const runtime = 'nodejs'`. In Next 16, `params`/`searchParams`/`cookies()` are async (await them); read `node_modules/next/dist/docs/` before using an unfamiliar API.
- **SQLite** via `better-sqlite3` (`src/lib/db`, schema in `schema.sql`, plain-function repos in `src/lib/db/repos`). Money is integer cents (`src/lib/domain/money.ts`).
- **Domain contracts** in `src/lib/domain/types.ts` and `src/lib/paypal/types.ts` (`PayPalPort`; `createFakePayPal()` for tests).
- **PayPal**: our typed REST client for money paths (orders, capture, catalog publish, webhook verify) with per-call `PayPal-Request-Id`; `@paypal/agent-toolkit` for seller-side tools (brief agent reads `get_order`/`get_shipment_tracking`; tracking via `create_shipment_tracking`). Sandbox only.
- **Claude** via `@anthropic-ai/sdk`, model `claude-sonnet-5-5`: `messages.parse` + `zodOutputFormat` for menu extraction; beta `toolRunner` for the brief agent and the in-app buyer console. Never send `temperature`, forced `tool_choice`, or `thinking: disabled`.
- **MCP agent door**: `POST /s/[slug]/mcp`, stateless `WebStandardStreamableHTTPServerTransport`, fresh `McpServer` per request.
- **Orders**: pure state machine + compare-and-set writes (`src/lib/orders/`); paid via return URL, webhook (deployed only) or the 15 s poller. The buyer's receipt view is `src/lib/orders/receipt.ts` (page `/o/[ref]`).
- **Paying each seller** (spec §8a): every order sets `purchase_units[0].payee.email_address` from the shop's PayPal email (`shops.payee_email`, snapshotted on `orders.payee_email`; rules in `src/lib/domain/payee.ts`). Only the demo shop (`marigold-bakehouse`) may have none and is then paid to the platform account. Seller-paid orders are paid by PayPal wallet login (verified with the US sandbox buyer, `e2e/paypal-buyer.ts` `payWithPayPalLogin`); guest card checkout works only on platform-paid orders. PayPal refuses platform tracking on a seller's capture, so their tracking is saved in Shelfie only. A payee email with no PayPal account leaves the capture PENDING (`UNILATERAL`), shown to the seller.
- **Routes**: the seller dashboard is the `src/app/shops/[id]/(dashboard)` route group (tabs Orders · Menu · Share · Settings); setup is `shops/[id]/setup`; the printable counter card is `shops/[id]/card`; the owner link is `/claim/[token]`; discovery (spec §10a) is JSON-LD + `<link rel="alternate">` on `/s/[slug]` and `/agents.txt`, `/llms.txt` (`src/lib/discovery/`); the buyer console API is `/api/assistant/[slug]`. Rate-limit keys use `src/lib/http/client-ip.ts` (rightmost `X-Forwarded-For`). JSON and webhook bodies are read through `src/lib/http/read-body.ts` (64 KB cap, 413). Setup rate limits (`allowSetup`) are skipped when `SHELFIE_TEST` is set. `SHELFIE_RECORDED_SAMPLES=1` makes sample menus use their recorded reading even with a key (demo recording).
- **Photos**: `items.photo_url` / `shops.cover_url` hold a site-relative URL or null. Bundled demo photos are `public/demo/<shop-slug>/` (map in `src/lib/demo/photos.ts`, credits in `docs/ASSETS.md`; only `npm run seed` applies them). Sellers upload through `POST`/`DELETE /api/shops/[id]/items/[itemId]/photo` and `/api/shops/[id]/cover` (`src/lib/catalog/photos.ts`: the menu upload's decoder, WebP, `${UPLOADS_DIR}/items/`), served by `GET /i/[file]`. Agents get absolute URLs (`image_url` in `list_products`, `image` in the JSON-LD).
- **Services**: `src/lib/services.ts` is the composition root (db, PayPal client or fake, toolkit, Anthropic).
- **Seller auth**: per-shop httpOnly cookie with an owner token (hash stored), `src/lib/auth/owner.ts`.
- **Tests** live in `tests/` (unit), `tests/sandbox` and `tests/ai-live` (network), `e2e/` (Playwright).

## Context: PayPal AI Hackathon

This project is an entry for the PayPal AI Hackathon ("Build what's next with PayPal and AI", https://paypalaihackathon.devpost.com/). There are no tracks or set problem statements.

**Hard requirement:** the project must *meaningfully* use **both** PayPal (in the free sandbox environment) and AI. Judging Stage One is a pass/fail check that the project fits the theme and really uses the PayPal APIs/SDKs. PayPal has to be central to the project, not a payment button bolted on.

### Key dates (Pacific Time)
- Submission period: Oct 1, 2026 to **Nov 12, 2026, 12:00 pm PT** (hard deadline; the submission can't be edited after it)
- Judging: Dec 1–15, 2026. Winners are announced around Dec 21, 2026.

### Submission checklist (every item is required)
- A working prototype that judges can run: either complete setup and run instructions in the repo, or a hosted demo URL. Mockups and static prototypes are disqualifying.
- A **public** GitHub/GitLab/Bitbucket repo with all source, assets and run instructions, and an **open-source LICENSE file** that GitHub detects (it shows in the About section).
- The repo README must include any sandbox test account credentials and API keys the judges need, or instructions for getting them.
- A text description of the features, plus a list of the AI tools/models used and how each one is used.
- A demo video **under 3 minutes**, public on YouTube, showing the project working end to end. No third-party trademarks or copyrighted music.
- All materials in English.

### Judging criteria (Stage Two, equally weighted)
Technological Implementation (thorough, non-trivial use of PayPal and AI) · Design (a complete, coherent product, not just a technical PoC) · Potential Impact (a specific real problem for a real audience) · Innovation · Presentation (the video shows the project working end to end and makes clear the problem, the audience and why it matters).

### Prizes worth targeting
Overall prizes are 1st $12k, 2nd $8k and 3rd $5k. There are also $5k awards for Most Creative, Most Impactful, Best Demo Delivery, **Best Use of PayPal + AI** and **Best Use of Agentic Commerce**. Sponsor prizes: AG Grid ($5k/$2k/$1k), APIMatic, Bryntum, Channel3 and Render (credits). Sponsor tools are optional: AG Grid, APIMatic, Astropods, Bryntum, Channel3, Elastic, KERNEL, Postman, Render, Zapier.

### PayPal building blocks
- Core: REST API, JavaScript SDK v6, Checkout, the Developer Dashboard and sandbox accounts.
- Capabilities: Pay Later, Subscriptions, Invoicing, Payouts, Disputes, Donations, Webhooks.
- AI/agents: the PayPal Agent Toolkit (`paypal/agent-toolkit` on GitHub) and the PayPal MCP server. These are the most direct route to "Best Use of Agentic Commerce" and "PayPal + AI".
- Always use sandbox credentials. Keep the client ID and secret in env vars and commit a `.env.example`.
