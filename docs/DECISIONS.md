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

## Session 1 — product approach round (2026-11-06 ~01:35 IST)
- **Product approach: approach 1 (seller-first) wins.** Judge round 0 scored it Part A 19 / Part B 21 vs approach 2's 18 / 19 (`docs/judge/round-0.md`). Reason: better design discipline, fits the build window, usable even when buyers have no AI of their own.
- **Taken from approach 2:** shipped order with flat shipping fee + tracking read back by the agent; MCP Inspector tamper test (server-enforced prices); `outputSchema`/`hint`/next-call/`did_you_mean` tool contracts; `scopeTool` ownership checks on toolkit calls; extraction `problems[]` + one schema retry; sandbox idempotency + MCP-over-HTTP tests. Reason: the judge's take-from-loser list.
- **Left behind:** seller copilot, `prepare_cart` quotes, agent.json/llms.txt/JSON-LD, FTS search, blocking publish on flags. Reason: judge's leave-behind list; scope.
- **Judge fix 2 applied:** issue codes cut from seven to four (`MISSING_PRICE`, `MARKET_PRICE`, `CHECK`, `DUPLICATE`; instruction-like text is skipped automatically); menu edits after launch, `update_product` rename, QR code and seller-page poll-on-read dropped. `get_order_status` keeps a 5 s-throttled sync because the agent's "did it go through?" must be fresh.
- **`FULFILLMENT_REQUIRED` error added.** A shop offering both pickup and shipping must be told which one; guessing would charge the wrong total.
- **No streaming extraction.** One `messages.parse` call (~8–15 s) with a progress screen. Reason: structured-output streaming adds partial-JSON handling for little demo value.
- **Probe 2026-11-06 01:24 IST:** full order body (brand_name, GET_FROM_FILE, sku, custom_id, invoice_id) → 200 `PAYER_ACTION_REQUIRED`; same `PayPal-Request-Id` twice → same order id; `PATCH /v1/catalogs/products/{id}` → 204.
- **zod 3.25** for the whole app. Reason: the toolkit ships zod-3 schemas, and both `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk` accept `^3.25`.
- **Execution method: subagent-driven, in waves.** Wave 0 (scaffold, contracts) by the coordinator; wave 1 (PayPal, AI, orders, MCP, design foundation) and wave 2 (setup flow, shop page + console, dashboard) as parallel workers in git worktrees; wave 3 (seed, e2e, screenshots) by the coordinator. Reason: the brief asks for parallel workers; frozen contracts in wave 0 keep them independent.
- **Pitch evidence (judge fix 3):** only facts in `docs/EVIDENCE.md` marked verified go into the pitch. Lead with PayPal's own words: Agent Ready is for "existing PayPal merchants" and WebMCP agent checkout "is limited to Store Sync customers today" for merchants "using their existing website storefronts". Say "nearly 95% have at least partial visibility of agent traffic", never "95% see agent traffic". Reason: primary sources found; the earlier secondary-coverage wording was inaccurate.

## Session 2 — wave 2 reviews (2026-11-06 IST)
- **Owner link stays visible on the Live step for the owner.** The spec said "shown once"; re-showing it to the cookie holder adds no exposure because they already hold the same token. Spec §3/§11 wording amended.
- **Webhook failures are retried by PayPal, not swallowed.** A webhook whose order sync fails now returns 503 without keeping the dedupe record. Reason: the poller only re-checks orders from the last 3 hours, and `PAYMENT.CAPTURE.COMPLETED` for a pending payment can arrive days later.
- **Publishing survives a dropped connection.** Progress events can no longer break the publish run, and a re-publish of a fully published draft shop finalises it. Reason: a phone that locks mid-publish must not strand a shop in draft.
- **"Other" carrier hidden until verified.** Agent Toolkit 1.11.0 drops `carrier_name_other`, which PayPal needs for `OTHER`.
