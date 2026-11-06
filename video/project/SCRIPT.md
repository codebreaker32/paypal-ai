# Shelfie demo video: script

_Generated from `demo.json` by `video/remotion/scripts/script-md.mjs`; do not edit by hand. Voice: Kokoro-82M `af_heart` (lang `a`, speed 1). Every spoken claim comes from `docs/DEMO.md` ("Facts we may say" or its shot table)._

**Runtime 2:38.8** (158.80 s): 132.34 s of narration (365 words), the rest is the 0.45 s breath after each line, per-scene holds for the screen (`holdSec`), the end card and 1 transition(s).

| Scene | Beat | Starts | Narration (s) | Scene (s) |
|---|---|---|---|---|
| problem | 1 | 0:00.0 | 21.39 | 22.43 |
| snap | 2 | 0:22.4 | 5.33 | 7.27 |
| review | 2 | 0:29.7 | 18.23 | 19.67 |
| counter | 2 | 0:49.4 | 5.88 | 7.33 |
| card | 2 | 0:56.7 | 7.78 | 8.23 |
| discovery | 3 | 1:04.9 | 11.68 | 16.13 |
| console | 4 | 1:21.1 | 13.92 | 16.87 |
| paypal | 4 | 1:37.9 | 9.09 | 11.53 |
| tamper | 4 | 1:49.5 | 4.68 | 6.13 |
| dashboard | 5 | 1:55.6 | 14.37 | 15.83 |
| tracking | 5 | 2:11.4 | 3.92 | 6.37 |
| close | 6 | 2:17.8 | 16.07 | 17.50 |
| end | 6 | 2:34.8 | - | 4.00 |

## Beat 1: The problem: who it's for and why now

### problem (21.39 s voice, 22.44 s scene)

**Screen:** Clip 01: the handwritten Marigold menu on a counter, zooming in slowly.

> AI assistants have started shopping for people. But PayPal's agent checkout is built for merchants with a website store. Rosa bakes from her kitchen. She has no website. She has this sheet of paper. In a US Census survey, 47 percent of food and lodging businesses had no website. An assistant can't order from a sheet of paper.

On-screen text: "PayPal's agent checkout “is limited to Store Sync customers today”, for merchants “using their existing website storefronts”." (PayPal Developer blog, Sep 2026)

On-screen text: "47% of US accommodation and food-service employer firms reported having no website." (US Census Bureau, Annual Survey of Entrepreneurs (data year 2016))

## Beat 2: Snap a paper menu; the shop goes live with photos

### snap (5.33 s voice, 7.28 s scene)

**Screen:** Clip 02: phone, Snap your price list, the Marigold photo, Reading your menu, then Check your menu (cut on the result).

> Shelfie starts with one photo. Rosa snaps her price list, and Claude reads it.

### review (18.23 s voice, 19.68 s scene)

**Screen:** Clip 03: the review questions (“2 for $7”, set $3.50 each), Looks right, Your PayPal email (drawn as dots), Publish, Adding to PayPal, Your shop is live.

> Shelfie only asks about what it isn't sure of, like a price written as two for seven dollars. Rosa adds her PayPal email, so buyers pay her directly. Every item becomes a product in PayPal's catalog. In our tests, photo to live shop took 8 to 14 seconds of machine time.

### counter (5.88 s voice, 7.33 s scene)

**Screen:** Clip 03b: laptop, Menu tab, Snap your counter, the display-case photo, Finding your items, the two croissant crops, Use on each, the thumbnails fill in.

> One more photo, of her display case. Claude finds each item in it, and crops its photo.

### card (7.78 s voice, 8.23 s scene)

**Screen:** Clip 04: Share tab, Print counter card, the card with the QR code and the agent door.

> The shop gets an agent door, and a card for the counter. Regulars scan it, or give the shop's link to their own assistant.

## Beat 3: Claude Code, given only the shop's URL, finds the agent door and orders

### discovery (11.68 s voice, 16.13 s scene)

**Screen:** Clip 05 (sped up about 2x): Claude Code in an empty folder, given only the shop URL; it fetches the page, finds the agent door, calls get_shop_info, list_products, create_order, and prints a PayPal approval link.

> This is Claude Code, given nothing but the shop's web address. The page tells it where the agent door is. It reads the menu, places the order, and hands back a PayPal approval link.

## Beat 4: The buyer approves on PayPal

### console (13.92 s voice, 16.87 s scene)

**Screen:** Clip 06: the shop page, Order with an assistant, the nut-allergy request, the Activity panel, the warning that almond croissants contain nuts, the confirmation, create_order, Approve on PayPal.

> Buyers without an assistant get one right on the shop page. This buyer wants almond croissants, and mentions a nut allergy. The assistant warns that they contain nuts. The buyer confirms, and it places the order.

### paypal (9.09 s voice, 11.54 s scene)

**Screen:** Clip 06b (after the login, which is cut): PayPal's review page with the total, Complete Purchase, the receipt: Paid, paid to Marigold Bakehouse's own PayPal account (masked).

> The buyer logs in to PayPal and approves. Shelfie captures the payment, and the money lands in Rosa's own PayPal account, not ours.

### tamper (4.68 s voice, 6.13 s scene)

**Screen:** Clip 07: terminal, create_order with a price of 0.01 is refused: INVALID_ARGUMENTS, prices are set by the shop.

> And agents can't set prices. The server checks that, not the model.

## Beat 5: The seller's dashboard: paid, the AI brief, tracking

### dashboard (14.37 s voice, 15.82 s scene)

**Screen:** Clip 08: the dashboard's Orders tab, To prepare, the new order paid with its AI brief and the nut-allergy warning; the order page with Paid to (masked), the PayPal order and transaction ids, the timeline.

> Rosa's dashboard shows the order as paid. A Claude agent reads PayPal's record of the order through the PayPal Agent Toolkit, and writes her a brief. It catches the nut allergy, so she can check with the buyer before shipping.

### tracking (3.92 s voice, 6.37 s scene)

**Screen:** Clip 09: Add tracking, USPS and a number, Saved; then in the console, Where's my order?, get_order_status, the tracking number.

> She adds tracking, and the buyer's assistant reads it back.

## Beat 6: Why it matters, and close

### close (16.07 s voice, 17.52 s scene)

**Screen:** Clip 10: the architecture card: photo, Claude vision, PayPal catalog, agent door found from the shop page, PayPal Orders v2 paid to the seller, capture, Agent Toolkit brief.

> Shelfie turns a paper price list into a shop that any AI assistant can find, order from, and pay with PayPal. The money goes straight to the seller. Agent shopping shouldn't be only for shops with a website. For Rosa, a sheet of paper is enough.

### end (4 s, no voice)

**Screen:** End card: the Shelfie mark, name and line. No narration.

Card: **Shelfie**, "Your price list, open to AI shoppers.", "Built with PayPal Orders v2, the PayPal Agent Toolkit and Claude"

