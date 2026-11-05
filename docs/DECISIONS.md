# Decisions

One line per decision, with the reason. Newest at the bottom of each section.

## Session 1 — brainstorming (2026-11-06 IST)

Brainstorming questions were answered by the coordinator from CLAUDE.md, docs/IDEAS.md and the run brief (nobody is available to answer during the run).

- **Path: architectural.** New project with no existing code, so full spec → plan → build.
- **Audience:** small sellers with no website (home bakers, food trucks, market stalls, cafés, repair/salon price lists) in PayPal-supported markets. Reason: it is the long tail PayPal's "Agent Ready"/store sync can't reach because they need an existing store.
- **Buyer:** an AI agent (Claude, ChatGPT or any MCP client) acting for a human; the human always approves payment on PayPal. Reason: keeps a human in the payment loop, which judges and PayPal expect.
- **Currency: USD only in v1.** Reason: sandbox account is US, and the Agent Toolkit's `create_order` only accepts USD.
- **Prices live in Shelfie, products live in PayPal.** Catalog Products API has no price field, so each extracted item becomes a PayPal product (ID stored) and its price is stored locally; order line items carry the PayPal product ID as `sku`. Reason: that is how the API is designed.
- **PayPal product category:** map to a small allowlist of valid enum values with `FOOD_RETAIL_AND_SERVICE` as the default. Reason: probe showed `BAKERY`/`RESTAURANT` are rejected (400 `INVALID_PARAMETER_VALUE`) while `FOOD_RETAIL_AND_SERVICE` or no category succeed.
- **One platform sandbox merchant.** All shops are paid into the sandbox business account behind `PAYPAL_CLIENT_ID`. Reason: per-seller onboarding (Partner Referrals) needs PayPal partner approval; it is documented as the path to scale, not built.
- **Seller auth: no accounts.** Creating a shop sets a private owner token in an httpOnly cookie (plus a one-time "owner link" to recover it). Reason: hackathon judges must be able to run the flow in seconds; passwords add nothing to the demo.
- ~~AI SDK pinned to `ai@4` + `@ai-sdk/anthropic@1`.~~ **Superseded (01:35 IST):** spike showed `ai@4`'s `generateObject` fails on `claude-sonnet-5-5` (`tool_choice: type "tool" and "any" are not supported for this model`).
- **All Claude calls use the official `@anthropic-ai/sdk`.** Extraction uses `client.messages.parse` with `output_config.format = zodOutputFormat(schema)` (structured outputs); agents use the SDK's beta `toolRunner` with `betaTool` (JSON Schema). Reason: spike on the Marigold menu photo returned all 11 items correctly in 7.4 s, and the Claude API skill requires the official SDK.
- **The PayPal Agent Toolkit is used as a tool provider for Claude, not via the Vercel AI SDK.** Its `getTools()` objects (`description`, zod-3 `parameters`, `execute`) are converted to `betaTool`s (`zod-to-json-schema`) so a Claude agent runs the toolkit's real PayPal tools. Reason: keeps the toolkit's tested PayPal calls while avoiding the incompatible `ai@4` model layer. The suggested Vercel AI SDK is dropped for this reason.
- **MCP transport: `WebStandardStreamableHTTPServerTransport`** from `@modelcontextprotocol/sdk@1.32`, stateless, inside a Next.js route handler. Reason: it accepts a web `Request` and returns a `Response`, so the whole app stays one Next.js web service for Render.
- **Capture verification:** sandbox card capture is unavailable (`PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`) and `.env` has no sandbox buyer login, so capture can only be verified with a buyer login. Capture code is tested against recorded payloads and the live `ORDER_NOT_APPROVED` path; full capture goes on "Needs from human".
- **Models:** `claude-sonnet-5-5` for menu-photo extraction (vision); summaries and the in-app demo buyer agent also use `claude-sonnet-5-5` unless a judge round shows a need to change. Reason: one model keeps setup simple; Sonnet is fast enough.

## Sandbox probe results (2026-11-06 01:15 IST, real calls)
- OAuth client-credentials: 200.
- `POST /v1/catalogs/products`: 201 without category or with `FOOD_RETAIL_AND_SERVICE`; 400 with `BAKERIES`, `BAKERY`, `RESTAURANT`.
- `POST /v2/checkout/orders` (paypal payment source, `experience_context`): 200, status `PAYER_ACTION_REQUIRED`, links `self,payer-action`.
- Capture before approval: 422 `ORDER_NOT_APPROVED`.
- Card payment source: 422 `PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`.
- `GET /v1/notifications/webhooks`: 200.
