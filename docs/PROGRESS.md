# Progress

_Last updated: 2026-11-06 01:20 IST (session 1)_

## Current phase
Brainstorming → product approach round (two competing specs being written, then judged).

## Done
- Brainstorming questions answered and logged in `docs/DECISIONS.md`.
- Sandbox probe (real calls): OAuth, Catalog Products create, Orders create with approval link, capture-before-approval error, webhooks list.
- Spike: Claude `claude-sonnet-5-5` structured-output extraction of a generated menu photo (11/11 items correct, 7.4 s).
- Spike: PayPal Agent Toolkit tools (`get_order`, `list_products`, `get_shipment_tracking`) execute against the sandbox.

## Verified (ran it)
- PayPal sandbox OAuth, `POST /v1/catalogs/products`, `POST /v2/checkout/orders` → `PAYER_ACTION_REQUIRED` + `payer-action` link.
- Claude vision extraction via `@anthropic-ai/sdk` `messages.parse`.

## Unverified
- Order capture after buyer approval (needs a sandbox buyer login; see below).
- Webhooks (no public URL on the VM).

## Next steps
1. Judge the two approach specs, pick a winner, write the final spec.
2. Write the implementation plan (subagent-driven).
3. Build the core flow.

## Needs from human
- `PAYPAL_SANDBOX_BUYER_EMAIL` and `PAYPAL_SANDBOX_BUYER_PASSWORD` in `.env` (a sandbox **personal** account from developer.paypal.com → Sandbox accounts) so capture can be tested end to end. Sandbox card capture isn't available on this merchant (`PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`).
