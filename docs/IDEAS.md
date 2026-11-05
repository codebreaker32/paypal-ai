# Idea shortlist: PayPal AI Hackathon

Written Nov 6, 2026 IST. Submissions close **Nov 12, 12:00 PT (Nov 13, 01:30 IST)**, so there are about 6 build days.

## What the evidence says

- **The PayPal Agent Toolkit has gaps.** `@paypal/agent-toolkit` covers invoices, orders, refunds, subscriptions, catalog products, shipment tracking, transactions and merchant insights. It has **no Payouts tool**. For disputes it can only **list, get and accept** a claim: there's no tool to submit evidence or contest one. ([repo README](https://github.com/paypal/agent-toolkit))
- **PayPal's agentic strategy is about making merchants reachable by AI agents.** It adopted OpenAI's Agentic Commerce Protocol for ChatGPT checkout ([PayPal, Oct 2025](https://newsroom.paypal-corp.com/2025-10-28-OpenAI-and-PayPal-Team-Up-to-Power-Instant-Checkout-and-Agentic-Commerce-in-ChatGPT)). It launched "Agent Ready" and store sync for existing merchants ([PayPal, Oct 2025](https://newsroom.paypal-corp.com/2025-10-28-PayPal-Launches-Agentic-Commerce-Services-to-Power-AI-Driven-Shopping)). It backs Google's Universal Commerce Protocol ([PayPal IR, 2026](https://investor.pypl.com/news-and-events/news-details/2026/From-Search-to-Checkout-PayPal-Supports-Trusted-AI-Checkout-with-Google/default.aspx)).
- **Most merchants aren't ready for that.** In PayPal's Agentic Commerce Pulse Survey of 498 merchants, about 95% say they can see AI-agent traffic, but only about 20% have catalogs agents can read. *Only secondary coverage is available ([example](https://theoutpost.ai/news-story/pay-pal-reveals-merchants-aren-t-ready-for-ai-shopping-agents-reshaping-commerce-25812/)); PayPal's original release wasn't found. Verify before quoting it in the pitch.*
- **Chargebacks are expensive.** Losses are projected at about $33.8B in 2025, rising to $41.7B by 2028, and third-party fees average $46 per chargeback (Mastercard 2025 State of Chargebacks and Javelin, as summarised by [Mastercard](https://b2b.mastercard.com/news-and-insights/blog/what-s-the-true-cost-of-a-chargeback-in-2025)). The figures for small merchants come from vendor blogs and are unverified.
- **Crowding:** the project gallery isn't published yet, so crowding can't be measured. Treat the example ideas on the Resources page as crowded: shopping agent, agent-to-agent negotiation, receipt-scan bill split, freelancer payment dashboard, payout-on-approval, multi-cause donations, creator tipping, and neighbourhood money pools.

## Scored ideas

Each criterion is scored 1–5, and the criteria are equally weighted. "Fit" is the special-prize fit. "Build" is feasibility in 6 days: E is easy, M is medium, H is hard.

| # | Idea | Tech | Design | Impact | Novelty | Video | **Total** | Crowding | Fit | Build |
|---|---|---|---|---|---|---|---|---|---|---|
| A | **Shelfie: agent-ready shop in 5 minutes** | 5 | 4 | 4 | 4 | 5 | **22** | Low–Med | Agentic Commerce, PayPal + AI, Best Demo | M |
| B | **Dispute Defender: AI that fights PayPal disputes** | 4 | 4 | 5 | 3 | 3 | **19** | Low | Most Impactful, PayPal + AI | M–H |
| C | **Voice invoicing for informal sellers** | 3 | 4 | 5 | 3 | 4 | **19** | Low–Med | Most Impactful, Most Creative | E |
| D | Mandate Guard: spending limits for AI agents | 5 | 3 | 3 | 4 | 3 | 18 | Low | Agentic Commerce | M |
| E | Proof-of-work payouts (vision AI checks a gig task is done, then Payouts) | 4 | 3 | 4 | 3 | 4 | 18 | High | PayPal + AI | M |
| F | Agent-to-agent deal room (negotiate, then settle) | 4 | 3 | 3 | 3 | 4 | 17 | High | Agentic Commerce | M |
| G | Collections copilot for freelancers (reminders, early-pay discounts, payment plans) | 4 | 4 | 4 | 2 | 3 | 17 | Med–High | PayPal + AI | E |
| H | Returns concierge (settles refund requests before they become disputes) | 4 | 4 | 4 | 2 | 3 | 17 | Med | PayPal + AI | E–M |
| I | Creator memberships with an AI concierge | 3 | 4 | 3 | 2 | 3 | 15 | High | none | E |

## Top 3

### A. Shelfie: agent-ready shop in 5 minutes (recommended)
A small seller with no website photographs their menu or price list. AI turns it into a PayPal catalog (Catalog Products API) and publishes an **MCP endpoint** for the shop, so ChatGPT, Claude or any other agent can browse it and buy. Payment goes through PayPal Orders. The seller gets AI order summaries and adds shipment tracking.
- **Why it wins:** it builds PayPal's stated strategy for the long tail of merchants that Agent Ready and store sync don't reach. The demo is memorable: a photo of a bakery menu, then Claude ordering a cake and paying with PayPal, in under a minute.
- **PayPal:** Catalog Products, Orders v2 (create, approve, capture), Webhooks, Shipment Tracking, and the Agent Toolkit on the merchant side.
- **AI:** vision to extract the catalog, the generated MCP server, an agent buyer for the demo, and order summaries.
- **Risk:** judges may see overlap with PayPal's own Agent Ready, so pitch it as covering the merchants with no website at all. Payment approval by a human buyer has to stay in the loop.

### B. Dispute Defender
The agent watches for disputes (webhooks), gathers the order, tracking and messages, writes an evidence package and submits it through the Disputes REST API (`provide-evidence`) after the merchant approves it. That fills the toolkit's gap. A mode that resolves refund requests before they turn into disputes (idea H) can be folded in.
- **Why it wins:** the strongest "real problem for a real audience" story, and it extends PayPal's toolkit.
- **Risk:** creating disputes in the sandbox and moving them through their stages is fiddly, and the demo is less visual.

### C. Voice invoicing for informal sellers
A seller says "Invoice Maria 40 dollars for two dresses" in any language. That produces a PayPal invoice, a QR code and automatic reminders.
- **Why it wins:** Most Impactful and Most Creative, it's the easiest to build, and it uses the toolkit's invoice tools natively.
- **Risk:** PayPal hasn't supported domestic payments in India since 2021, so the target market has to be one where PayPal works (US, LatAm, the Philippines and so on). It's also the least technically deep, so it needs strong design.

## Cheap extra prizes for any of these
- **Render:** host the live demo there. The rules require a hosted demo or run instructions anyway.
- **AG Grid:** use it for the merchant's orders or disputes table.
