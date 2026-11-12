# Video clarity test 9 (render of 12 Nov 2026, 2:47.6: run 18, every clip re-recorded on the final UI)

Same method as tests 1 to 8. A fresh subagent (an Explore agent, which gets no CLAUDE.md or repo context) read only the burned-in captions (`video/shelfie-demo.srt`) and one frame every 2 s (84 frames on 21 sheets of 2x2). It was not allowed to open any other file. Then it answered the questions.

| # | Question | Tester's answer (condensed) | Verdict |
|---|---|---|---|
| 1 | What is Shelfie? | A web app that turns a small seller's paper price list into an online shop AI assistants can buy from. Claude reads the photo, the items become products in the seller's PayPal catalog, and the shop gets a page, a counter card and an MCP "agent door". Buyers pay through PayPal, and the seller sees paid orders with a Claude-written brief. | Right |
| 2 | Who is it for? | Small sellers who run on paper with no website: home bakers, market stalls (Rosa, Marigold Bakehouse), backed by the 47% Census statistic. Buyers order through the page, Shelfie's assistant or their own AI. | Right |
| 3 | Uniquely for / what's new | One photo becomes a live shop, and unclear items become questions instead of guesses. Every shop has an agent door that any outside AI can find and order from: Claude Code found it from the link alone. The server enforces the shop's prices (the $0.01 call is refused). Claude writes a brief that flags risks like the nut allergy. The money goes into the seller's own PayPal account. | Right |
| 4 | PayPal's role | The commerce backbone. It holds the catalog (each item becomes a PayPal product), takes the payment (approval link, the buyer pays on PayPal's checkout) and pays the seller directly into her own account. Claude reads the order from PayPal through the Agent Toolkit for the brief. | Right |
| 5 | AI's role | Claude reads the menu and turns doubts into questions. AI shoppers order: Shelfie's own assistant (allergen warning, plain-word steps with the tool calls a tap away) and outside agents like Claude Code through the door. Claude writes the seller's brief after payment. | Right |
| 6 | Steps | 21 steps, from the greeting and the problem through the statistic, the home page and its chat, sign-up, snap, review, publish, the agent door, Claude Code's order, Browse and the cart, the assistant's order, PayPal, the dashboard brief, the refused price, the diagram and the end card. | Right |
| - | Greeting / thank-you | "Hi there! Welcome to Shelfie." / "Thanks for watching!" | Right |

**Result: pass (6/6). No answer is wrong.**

**Named and left as they are** (most also in test 8):
- The title chain has four cards while the narration says three steps (the chain splits step 1 into "snap" and "live shop").
- The opening paper menu is a café board, not a bakery menu.
- The statistic's spoken wording is shorter than the card.
- 10 items are read but 9 are published.
- The buyer keeps the almond croissants after the warning (with an allergy note), so the brief flags it. That is the point of the scene.
- Count-ups show in-between totals in some stills.
- The home hero's example shop (Sweet Bakes) is not the demo shop.
- Claude Code's own order stays unpaid.
- Browse also lists non-food shops.
- The tamper shot sits under the "Get paid on PayPal" step.
- The sandbox is named only in the footer.

**Privacy check** (a second agent looked at all 84 frames, and I looked at the sheets myself):
- No logins, passwords, recovery keys, owner links or API keys appear. The sign-up email, password and PayPal email are drawn as dots. Every other email is masked (`r•••@example.com`, `s•••@business.example.com`, `s•••@personal.example.com`).
- Only sandbox identifiers appear: the checkout token, PayPal's order and transaction ids, PayPal's sandbox buyer John Doe and its masked sandbox funding sources. Claude Code's tool-result paths show a throwaway local session id, with the home folder shown as `~`.
- Third-party marks appear only as PayPal's official logo and on PayPal's own checkout page (its bank and Visa card icons). Claude is named in text.

**Technical:** 167.6 s (2:47.6), 1920x1080, 30 fps, H.264 + AAC. Loudness -14.0 LUFS integrated, true peak -0.9 dBFS. ffmpeg `blackdetect` (0.1 s, pix_th 0.05) found no black frames. Captions are burned in, and the SRT is `video/shelfie-demo.srt`.
