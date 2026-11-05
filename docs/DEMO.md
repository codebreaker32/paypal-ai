# Demo script (target 2:45, hard limit 3:00)

_Draft from the spec (§13) and `docs/EVIDENCE.md`. Re-time it against the running app before recording. No third-party logos or copyrighted music; the assistant on screen is Shelfie's own buyer console._

## Setup before recording
- `npm run seed` (publishes Marigold Bakehouse to the PayPal sandbox) and `npm run dev`.
- Browser 1 (phone frame, 390 px): Shelfie start page, logged-out.
- Browser 2 (laptop, 1440 px): the Marigold shop page, ready to open **Order with an assistant**.
- A sandbox **personal** buyer logged in to sandbox.paypal.com in browser 2 (so approval is one click).
- MCP Inspector open on `http://localhost:3000/s/marigold-bakehouse/mcp` with a prepared `create_order` call that includes `"price": 0.01`.
- The printed Marigold menu (or the photo on a second screen) for the opening shot.

## Shots

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:08 | The handwritten Marigold menu on a counter. | "AI assistants are starting to shop for people. PayPal is making stores ready for them, but its agent checkout is for merchants with an existing website. Rosa doesn't have one. She has this sheet." |
| 0:08–0:20 | Phone: **Snap your price list** → photo → *Reading your menu…* | "One photo. Claude reads it." |
| 0:20–0:35 | Review: "10 items · 4 need you". Tap **Looks right** on the crossed-out focaccia price. Publish → "Adding to PayPal… 7/7". | "Shelfie only asks about what it isn't sure of. Every item becomes a product in Rosa's PayPal catalog." |
| 0:35–0:40 | Live screen: agent door link. | "And her shop gets an agent door." |
| 0:40–1:30 | **Wow.** Laptop: **Order with an assistant**. Type: "Two almond croissants and a sourdough, shipped to me." The Activity panel lights up: `get_shop_info` → `list_products` → the assistant reads the order back with $8 shipping → "yes" → `create_order` → **Approve on PayPal** → PayPal sandbox page shows *Marigold Bakehouse*, the items and total → Pay → back on Shelfie: **Paid**. | "An assistant that has never seen Rosa's shop finds the items, reads the order back, and hands the payment to PayPal. The buyer approves on PayPal, and only then is the money taken." |
| 1:30–1:45 | MCP Inspector: `create_order` with `"price": 0.01` → `INVALID_ARGUMENTS: "price" is not accepted; prices are set by the shop`. | "Agents can't set prices. The server enforces it, not the model." |
| 1:45–2:05 | Phone: dashboard. New order card "Paid · Ship to Austin, TX" with the AI brief: "⚠ buyer says nut allergy, but almond croissants contain nuts". Open it: prep list, PayPal order and capture ids, timeline. | "Rosa's dashboard gets a brief written by a Claude agent that reads PayPal's own record of the order through the PayPal Agent Toolkit." |
| 2:05–2:25 | **Add tracking** → USPS + number → "Sent to PayPal". Laptop assistant: "Where's my order?" → `get_order_status` → tracking number. | "Tracking goes to PayPal, and the buyer's assistant can read it back." |
| 2:25–2:45 | Architecture card: photo → Claude vision → PayPal Catalog Products → agent door (MCP) → PayPal Orders v2 → capture → Agent Toolkit brief + tracking. | "Shelfie: your price list, open to every AI assistant, paid with PayPal. For the sellers agent commerce hasn't reached yet." |

## Facts we may say (from `docs/EVIDENCE.md`)
- PayPal's agent checkout "is limited to Store Sync customers today", for merchants "using their existing website storefronts" (PayPal Developer blog, Sep 2026).
- 47% of US accommodation and food-service employer firms reported having no website (Census ASE, data year 2016).
- Never say "95% of merchants see agent traffic"; the source says "at least partial visibility".

## If something breaks on the day
- Capture needs the sandbox buyer login; if PayPal's sandbox is slow, cut from **Approve** straight to the receipt page of an order paid earlier.
- If Claude is slow on extraction, use the Marigold sample (same flow, recorded reading if no API key).
