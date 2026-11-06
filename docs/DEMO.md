# Demo script (target 2:50, hard limit 3:00)

_Re-time against the running app before recording. No third-party logos or copyrighted music. Every number said on camera comes from `docs/EVIDENCE.md`. Rosa is the owner persona of the seeded demo shop, Marigold Bakehouse._

## The one idea to land
PayPal's agent checkout reaches merchants who already have a website store. Rosa has a sheet of paper. Shelfie turns that sheet into a PayPal shop with an **agent door** that any AI assistant can order through, and the money goes through PayPal Orders v2.

## Setup before recording
- `.env` filled (PayPal sandbox app, `ANTHROPIC_API_KEY`). Run `npm run build && npm start` (a production build has no dev-mode compile pauses on camera). Run `npm run seed` and keep the printed owner link.
- **Browser 1** (phone frame, 390 px): the Shelfie start page. Have the Marigold photo ready to upload, or use **Try a sample menu**. With a key set, a sample is read live by Claude (about 9 s). For an instant reading, start the server with `SHELFIE_RECORDED_SAMPLES=1`: samples then use Claude's saved reading of the photo, and the review shows a **Recorded reading** badge. Your own photo is always read live.
- **Browser 2** (laptop, 1440 px): the seeded shop at `http://localhost:3000/s/marigold-bakehouse`, and the dashboard opened through the owner link.
- **Terminal** (large font): an empty folder holding a copy of `docs/judge/evidence/claude-code-mcp.json` with its URL changed to `http://localhost:3000/s/marigold-bakehouse/mcp`. Paste this command but don't run it yet:
  `claude -p "Order two butter croissants for Saturday pickup from this bakery. Name Sam Lee, sam@example.com. No need to check back with me." --mcp-config claude-code-mcp.json --strict-mcp-config --allowedTools "mcp__marigold-bakehouse__*"`
- **MCP Inspector** open on the same door URL, with a `create_order` call prepared that includes `"price": 0.01`.
- **Payment:** PayPal guest card checkout. Choose country United States, test Visa `4012000033330026`, expiry 12/30, CVV 123 and a US address, switch "Save info & create your PayPal account" off, then Pay Now. Rehearse it once, then **cut the form out of the video** (see 1:20).
- The printed or handwritten Marigold menu (or the photo on a second screen) for the opening shot.

## Shots

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:12 | The handwritten Marigold menu on a counter. On-screen text: *"PayPal's agent checkout: limited to Store Sync customers… with existing website storefronts."* (PayPal Developer blog, Sep 2026). | "AI assistants have started shopping for people. PayPal's agent checkout is built for merchants with a website store. Rosa runs a bakery from her kitchen. She doesn't have a website. She has this sheet." |
| 0:12–0:22 | Phone: **Snap your price list** → photo → *Reading your menu…*. Cut on the result (reading takes about 6–9 s). | "One photo. Claude reads it." |
| 0:22–0:38 | Review: the plain questions ("Printed as “2 for $7”. We set $3.50 each. Is that right?", "A price is crossed out…"). Tap **Looks right**, then **Publish** → the *Adding to PayPal…* progress → live. | "Shelfie only asks about what it isn't sure of. Every item becomes a product in PayPal's catalog. Photo to live shop: about 10 seconds of machine time." |
| 0:38–0:45 | Live step: the agent door link. | "And the shop gets an agent door." |
| 0:45–1:02 | **Any assistant.** Terminal: run the prepared `claude -p …` command. Claude Code calls `get_shop_info` → `list_products` → `create_order` and prints a PayPal approval link (about 18 s; speed it up 2×). | "That's Claude Code, a stranger to this shop, with no Shelfie code. It finds the croissants, orders, and gets a PayPal approval link." |
| 1:02–1:35 | **Wow.** Laptop: the shop page → **Order with an assistant**. Type "Two almond croissants and a sourdough, shipped to me. I have a nut allergy." The **Activity** panel shows each call to the door. The assistant reads the order back with the $8 shipping fee. Say "yes" → `create_order` → **Approve on PayPal**. PayPal's page shows the shop's items and total. **Jump cut** past the card form to the receipt, stamped **PAID**, while the console card turns to "Paid · View receipt". | "Our own buyer console works the same way, for buyers without an assistant. The buyer approves on PayPal, and only then does Shelfie capture the money." |
| 1:35–1:47 | Inspector: `create_order` with `"price": 0.01` → `INVALID_ARGUMENTS`, "`price` is not accepted". | "Agents can't set prices. The server enforces that, not the model." |
| 1:47–2:12 | Dashboard (laptop): the **To prepare** group with its paid subtotal, and the new slip with its AI brief: *"Buyer mentions a nut allergy, but almond croissants contain nuts."* Open the order: the Total, the PayPal order and capture ids, and the timeline. | "Rosa's dashboard gets a brief from a Claude agent that reads PayPal's own record of the order through the PayPal Agent Toolkit, and catches the allergy." |
| 2:12–2:30 | **Add tracking** → USPS + number → *Saved to PayPal*. On the laptop, ask the assistant "Where's my order?" → `get_order_status` → the tracking number. | "Tracking goes to PayPal, and the buyer's assistant reads it back." |
| 2:30–2:50 | Architecture card: photo → Claude vision → PayPal Catalog Products → agent door (MCP) → PayPal Orders v2 → capture → Agent Toolkit brief and tracking. | "Shelfie: prepaid orders from a photo of your price list, through any AI assistant, paid with PayPal. For the sellers agent commerce hasn't reached yet." |

## Facts we may say (from `docs/EVIDENCE.md`)
- PayPal's agent checkout "is limited to Store Sync customers today", for merchants "using their existing website storefronts" (PayPal Developer blog, Sep 2026).
- 47% of US accommodation and food-service employer firms reported having no website (Census ASE, data year 2016).
- A Virginia home baker took orders by "text messages and Facebook messages and Instagram DMs ... And then tracking them on a spreadsheet" (Radio IQ, Jul 2026). This fits as on-screen text over the opening shot.
- Photo to live shop took 8 to 14 s of machine time over 6 measured runs (reading 6.5 to 9.4 s, publishing 1.5 to 3.7 s). This doesn't include the seller's own review time.
- Never say "95% of merchants see agent traffic"; the source says "at least partial visibility".
- Don't claim webhooks, wallet-login payments, a deployed URL, or paying each seller directly. None of these is verified (see `docs/PROGRESS.md`).

## If something breaks on the day
- One caller can hold 3 unpaid orders per shop (the shop as a whole 10), and unpaid orders expire after 60 minutes. Before recording, run `npm run seed -- --cancel-unpaid` (it cancels the demo shop's unpaid rehearsal orders), or the assistant will say "You already have 3 orders waiting for payment".
- If PayPal's sandbox page is slow, cut from **Approve on PayPal** straight to the receipt of an order paid earlier.
- If Claude is slow on reading, cut on the result, or restart with `SHELFIE_RECORDED_SAMPLES=1` and use **Try a sample menu** (Claude's saved reading, instant, labelled **Recorded reading** on screen; say it was recorded).
- If the Claude Code run is slow, show the recorded run in `docs/judge/evidence/outside-client-claude-code.md` (15.9 s of agent time, real approval link) and say it was recorded.
- The brief takes about 10 s after payment (measured on real orders). Record the dashboard shot after it appears. If Claude is down, a labelled template brief is stored instead.
