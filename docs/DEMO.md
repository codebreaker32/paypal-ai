# Demo script (target 2:45, hard limit 3:00)

_Re-time against the running app before recording. No third-party logos or copyrighted music; the assistant on screen is Shelfie's own buyer console. Timings below are from `docs/EVIDENCE.md` (measured) and `docs/PROGRESS.md`._

## Setup before recording
- `.env` filled (PayPal sandbox app, `ANTHROPIC_API_KEY`). `npm run seed` (publishes Marigold Bakehouse to the sandbox catalog; note the printed owner link) and `npm run dev`.
- Browser 1 (phone frame, 390 px): the Shelfie start page, with the Marigold photo ready to upload, or use **Try a sample menu** (recorded reading, so no wait on Claude).
- Browser 2 (laptop, 1440 px): the seeded shop page `http://localhost:3000/s/marigold-bakehouse`, and the dashboard opened through the owner link.
- Payment is **guest card checkout** on PayPal's page, not a wallet login: country United States, test Visa `4012000033330026`, 12/30, CVV 123, a US address, "Save info & create your PayPal account" switched off, Pay Now. Rehearse it once so the fields are quick.
- MCP Inspector open on `http://localhost:3000/s/marigold-bakehouse/mcp` with a prepared `create_order` call that includes `"price": 0.01`.
- The printed or handwritten Marigold menu (or the photo on a second screen) for the opening shot.

## Shots

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:08 | The handwritten Marigold menu on a counter. | "AI assistants are starting to shop for people. PayPal's agent checkout is for merchants with an existing website store. Rosa doesn't have one. She has this sheet." |
| 0:08–0:22 | Phone: **Snap your price list** → photo → *Reading your menu…*. Cut on the result (reading takes about 6 to 9 s). | "One photo. Claude reads it." |
| 0:22–0:38 | Review: flagged items. Tap **Looks right** on the crossed-out focaccia price. **Publish** → progress → shop live. | "Shelfie only asks about what it isn't sure of. Every item becomes a product in Rosa's PayPal catalog. Photo to live shop: 8 to 14 seconds of machine time." |
| 0:38–0:43 | Live screen: the agent door link and **Watch an AI order from you**. | "And her shop gets an agent door." |
| 0:43–1:30 | **Wow.** Laptop, shop page, **Order with an assistant**. Type: "Two almond croissants and a sourdough, shipped to me." The **Activity** panel shows each tool call: `get_shop_info`, `list_products`, then the assistant reads the order back with the $8 shipping fee. Say "yes" → `create_order` → **Approve on PayPal**. PayPal's page shows the shop's items and total → **Pay with Credit or Debit Card** → the test card → Pay Now → back on Shelfie: receipt **Paid**; the console card reads "Paid · View receipt". | "An assistant that has never seen Rosa's shop finds the items, reads the order back, and hands payment to PayPal. The buyer approves on PayPal, and only then is the money captured." |
| 1:30–1:45 | MCP Inspector: `create_order` with `"price": 0.01` → `INVALID_ARGUMENTS`, "price" is not accepted. | "Agents can't set prices. The server enforces it, not the model." |
| 1:45–2:05 | Dashboard (phone or laptop): the new paid order with its AI brief. Open it: prep list, PayPal order and capture ids, timeline. | "Rosa's dashboard gets a brief written by a Claude agent that reads PayPal's own record of the order through the PayPal Agent Toolkit." |
| 2:05–2:25 | **Add tracking** → carrier + number → saved to PayPal. Laptop assistant: "Where's my order?" → `get_order_status` → the tracking number. | "Tracking goes to PayPal, and the buyer's assistant reads it back." |
| 2:25–2:45 | Architecture card: photo → Claude vision → PayPal Catalog Products → agent door (MCP) → PayPal Orders v2 → capture → Agent Toolkit brief and tracking. | "Shelfie: your price list, open to every AI assistant, paid with PayPal. For the sellers agent commerce hasn't reached yet." |

## Facts we may say (from `docs/EVIDENCE.md`)
- PayPal's agent checkout "is limited to Store Sync customers today", for merchants "using their existing website storefronts" (PayPal Developer blog, Sep 2026).
- 47% of US accommodation and food-service employer firms reported having no website (Census ASE, data year 2016).
- Photo to live shop took 8 to 14 s of machine time over 6 measured runs (reading 6.5 to 9.4 s, publishing 1.5 to 3.7 s). Not including the seller's own review time.
- Never say "95% of merchants see agent traffic"; the source says "at least partial visibility".
- Don't claim webhooks or PayPal wallet-login payments in the demo: neither is verified (see `docs/PROGRESS.md`).

## If something breaks on the day
- If PayPal's sandbox page is slow, cut from **Approve on PayPal** straight to the receipt of an order paid earlier.
- If Claude is slow on reading, use **Try a sample menu** (recorded real reading, no wait).
- The brief takes about 10 s after payment (measured on real orders). Record the dashboard shot after it appears; if Claude is down a labelled template brief is stored instead.
