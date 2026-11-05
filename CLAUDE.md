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
npm run e2e                 # Playwright (starts the app)
npm run seed                # publish the demo shop
```

## Architecture

- **Next.js 16 App Router + TypeScript**, one web service (Render-ready). `cacheComponents` is off: every page reads per-request SQLite/cookies. Route handlers that touch SQLite/sharp/PayPal use `export const runtime = 'nodejs'`. In Next 16, `params`/`searchParams`/`cookies()` are async (await them); read `node_modules/next/dist/docs/` before using an unfamiliar API.
- **SQLite** via `better-sqlite3` (`src/lib/db`, schema in `schema.sql`, plain-function repos in `src/lib/db/repos`). Money is integer cents (`src/lib/domain/money.ts`).
- **Domain contracts** in `src/lib/domain/types.ts` and `src/lib/paypal/types.ts` (`PayPalPort`; `createFakePayPal()` for tests).
- **PayPal**: our typed REST client for money paths (orders, capture, catalog publish, webhook verify) with per-call `PayPal-Request-Id`; `@paypal/agent-toolkit` for seller-side tools (brief agent reads `get_order`/`get_shipment_tracking`; tracking via `create_shipment_tracking`). Sandbox only.
- **Claude** via `@anthropic-ai/sdk`, model `claude-sonnet-5-5`: `messages.parse` + `zodOutputFormat` for menu extraction; beta `toolRunner` for the brief agent and the in-app buyer console. Never send `temperature`, forced `tool_choice`, or `thinking: disabled`.
- **MCP agent door**: `POST /s/[slug]/mcp`, stateless `WebStandardStreamableHTTPServerTransport`, fresh `McpServer` per request.
- **Orders**: pure state machine + compare-and-set writes; paid via return URL, webhook (deployed only) or the 15 s poller.
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
