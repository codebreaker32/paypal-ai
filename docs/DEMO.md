# Demo script (target 2:50, hard limit 3:00)

_Re-time against the running app before recording. No third-party logos or copyrighted music. Every number said on camera comes from `docs/EVIDENCE.md` or a verified run in `docs/PROGRESS.md`. Rosa is the owner persona of the seeded demo shop, Marigold Bakehouse. Raw screen clips of each shot (1920x1080, 30 fps) are listed in `video/clips/README.md`; record them with `npm run clips`._

## The one idea to land
PayPal's agent checkout reaches merchants who already have a website store. Rosa has a sheet of paper. Shelfie turns that sheet into a PayPal shop with an **agent door** that any AI assistant can find and order through, and the money goes straight into **Rosa's own PayPal account** through PayPal Orders v2.

## Setup before recording
- `.env` filled: the PayPal sandbox app, `ANTHROPIC_API_KEY`, `PAYPAL_SANDBOX_SELLER_EMAIL` (a US sandbox Business account: Rosa's PayPal) and `PAYPAL_SANDBOX_BUYER_EMAIL` / `_PASSWORD` (a US sandbox Personal account: the buyer).
- Run `npm run build && npm start` (a production build has no dev-mode compile pauses on camera). Run `npm run seed` and keep the printed owner link. The seed prints `Paid to: the sandbox seller's own PayPal account (…)`: the demo shop is then paid like any seller's shop. Run `npm run seed -- --cancel-unpaid` to clear rehearsal orders (one caller can hold 3 unpaid orders).
- **Browser 1** (phone frame, 390 px): the Shelfie start page. Use **Try a sample menu**, or have the Marigold photo ready to upload. With a key set, a sample is read live by Claude (about 9 s). For an instant reading, start the server with `SHELFIE_RECORDED_SAMPLES=1`: samples then use Claude's saved reading, and the review shows a **Recorded reading** badge.
- **Browser 2** (laptop, 1440 px): the seeded shop at `http://localhost:3000/s/marigold-bakehouse`, and the dashboard opened through the owner link.
- **Terminal** (large font) in an **empty folder outside the repo** (so Claude Code reads no project files). Paste this but don't run it yet:
  `claude -p "There's a bakery I like at http://localhost:3000/s/marigold-bakehouse . Please order two almond croissants for pickup, under the name Sam. Any total under \$15 is fine, so you don't need to check back: place the order and give me the PayPal link." --strict-mcp-config --allowedTools "Bash(curl:*)"`
  It has no MCP servers configured: it gets **only the shop URL**.
- A second terminal with the price-tamper `curl` ready (see 1:42), or MCP Inspector on the door URL with a `create_order` call that includes `"price": 0.01`.
- **Payment:** log in on PayPal's page as the sandbox buyer and click **Complete Purchase**. Rehearse once; on camera, **cut out the login typing** (it shows the sandbox login).
- For 0:33, a photo of a display case with croissants (`public/samples/counter-case.jpg`, a Pexels photo credited in `docs/ASSETS.md`); the demo shop's Menu tab already has photos, so remove two items' photos first (tap a photo → **Remove**) to show them filled in.
- The printed counter card (Share tab → **Print counter card**) and the handwritten Marigold menu for the opening and 0:38 shots.

## Shots

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:10 | The handwritten Marigold menu on a counter. On-screen text: *"PayPal's agent checkout: limited to Store Sync customers… with existing website storefronts."* (PayPal Developer blog, Sep 2026). | "AI assistants have started shopping for people. PayPal's agent checkout is built for merchants with a website store. Rosa bakes from her kitchen. She doesn't have a website. She has this sheet." |
| 0:10–0:19 | Phone: **Snap your price list** → photo → *Reading your menu…*. Cut on the result (about 6–9 s). | "One photo. Claude reads it." |
| 0:19–0:33 | Review: the plain questions ("Printed as “2 for $7”. We set $3.50 each. Is that right?"). Tap **Looks right**. Type **Your PayPal email** (Rosa's; clip `03` draws it as dots, since it is the sandbox seller's login). **Publish** → *Adding to PayPal…* → live. | "Shelfie only asks about what it isn't sure of. Rosa adds her PayPal email, so buyers pay her directly. Every item becomes a product in PayPal's catalog. Photo to live shop: about 10 seconds of machine time." |
| 0:33–0:43 | **Snap your counter.** Laptop: the dashboard's **Menu** tab → **Snap your counter** → the display-case photo → *Finding your items…* (3.5–7 s measured) → Claude's proposed photos, one per item it found (the croissants) → **Use** on each → the rows' thumbnails fill in. | "One more photo, of her display case. Claude finds each item in it and crops its photo; Rosa keeps the ones she likes." |
| 0:43–0:50 | Laptop: Share tab → **Print counter card** → the card: shop name, "Order ahead with any AI assistant, pay with PayPal", the QR code. Then the printed card next to the till. | "The shop gets an agent door, and a card for the counter. Regulars scan it, or just give the shop's link to their assistant." |
| 0:50–1:08 | **Found, not handed.** Terminal: run the prepared `claude -p …`. It fetches the shop page, says *"There's an MCP agent door"*, calls `get_shop_info` → `list_products` → `create_order`, and prints a PayPal link (about 23–30 s; speed it up 2×). The recorded clip (`05`) runs it with `--bare` and pipes Claude Code's stream through `scripts/clips/claude-steps.mjs`, so each tool call is one readable line. | "That's Claude Code, given nothing but the shop's web address. The page tells it where the agent door is. It orders, and gets a PayPal approval link." |
| 1:08–1:42 | **Wow.** Laptop: the shop page, photo first (the cover, the shop's mark, photo cards) → **Order with an assistant**. Type "Two almond croissants and a sourdough, shipped to me. I have a nut allergy." The **Activity** panel shows each call to the door. The assistant reads the order back with the $8 shipping. It also warns that almond croissants contain nuts; say "Yes, the almond croissants. Please place it, with a note about my nut allergy." → `create_order` → **Approve on PayPal** → PayPal's login page. **Jump cut** past the login (clip `06` ends before it, `06b` starts after it) to PayPal's review with the total → **Complete Purchase** (cut PayPal's *Thanks for using PayPal* wait), then the receipt: **Paid.** *"Paid to Marigold Bakehouse's own PayPal account (s•••@…)"*. **Back to the assistant**: the console card turns to "Paid · View receipt". | "Our own buyer console works the same way, for buyers without an assistant. The buyer approves on PayPal, Shelfie captures, and the money lands in Rosa's PayPal account, not ours." |
| 1:42–1:52 | Terminal: `create_order` with `"price": 0.01` → `INVALID_ARGUMENTS`, "`price` is not accepted; prices are set by the shop". | "Agents can't set prices. The server enforces that, not the model." |
| 1:52–2:14 | Dashboard (laptop): the order list on **To prepare**, with its paid subtotal, and the new order's row with a thumbnail and its AI brief: *"Buyer mentions a nut allergy, but almond croissants contain nuts."* Open the order: **Paid to** Rosa's PayPal email (masked in the clip: it is the sandbox seller's login), the PayPal order and transaction ids, the timeline. | "Rosa's dashboard gets a brief from a Claude agent that reads PayPal's own record of the order through the PayPal Agent Toolkit, and catches the allergy." |
| 2:14–2:30 | **Add tracking** → USPS + number → *Saved*. In the console, "Where's my order?" → `get_order_status` → the tracking number. | "She adds tracking, and the buyer's assistant reads it back." |
| 2:30–2:50 | Architecture card (`video/architecture.html`, clip `10`): photo → Claude vision → PayPal Catalog Products → agent door (MCP), found from the shop page → PayPal Orders v2, paid to the seller → capture → Agent Toolkit brief. | "Shelfie: prepaid orders from a photo of your price list, through any AI assistant, paid into your own PayPal account. For the sellers agent commerce hasn't reached yet." |

## Facts we may say (from `docs/EVIDENCE.md` and verified runs)
- PayPal's agent checkout "is limited to Store Sync customers today", for merchants "using their existing website storefronts" (PayPal Developer blog, Sep 2026).
- 47% of US accommodation and food-service employer firms reported having no website (Census ASE, data year 2016).
- A Virginia home baker took orders by "text messages and Facebook messages and Instagram DMs ... And then tracking them on a spreadsheet" (Radio IQ, Jul 2026). This fits as on-screen text over the opening shot.
- Photo to live shop took 8 to 14 s of machine time over 6 measured runs (reading 6.5 to 9.4 s, publishing 1.5 to 3.7 s). This doesn't include the seller's own review time.
- Claude Code, given only the shop URL, found the door and ordered in 22.9 s (`docs/judge/evidence/discovery-claude-code.md`).
- Payments go to the seller's own PayPal account, verified in the sandbox with a US buyer paying a US seller by PayPal login (`docs/PROGRESS.md`).
- Never say "95% of merchants see agent traffic"; the source says "at least partial visibility".
- Don't claim webhooks or a deployed URL: neither is verified. Don't say tracking goes to PayPal for Rosa's orders: PayPal accepts tracking only from the account that was paid, so Shelfie saves it and tells her to add it in PayPal too.

## If something breaks on the day
- One caller can hold 3 unpaid orders per shop (the shop as a whole 10), and unpaid orders expire after 60 minutes. Before recording, run `npm run seed -- --cancel-unpaid`, or the assistant will say "You already have 3 orders waiting for payment".
- If PayPal's sandbox page is slow, cut from **Approve on PayPal** straight to the receipt of an order paid earlier.
- If PayPal says "This seller doesn't accept payments in your currency", the buyer and seller sandbox accounts are in countries PayPal won't pair (India to India is one). Use the US accounts.
- If Claude is slow on reading, cut on the result, or restart with `SHELFIE_RECORDED_SAMPLES=1` and use **Try a sample menu** (Claude's saved reading, instant, labelled **Recorded reading**; say it was recorded).
- If the Claude Code run is slow or goes another way, show the recorded run in `docs/judge/evidence/discovery-claude-code.md` (22.9 s, real approval link) and say it was recorded.
- The brief takes about 10 s after payment. Record the dashboard shot after it appears. If Claude is down, a labelled template brief is stored instead.
- To show tracking reaching PayPal itself, unset `PAYPAL_SANDBOX_SELLER_EMAIL` and re-run the seed: the demo shop is then paid to Shelfie's own account, where the Agent Toolkit adds the tracker (and guest card checkout works).
