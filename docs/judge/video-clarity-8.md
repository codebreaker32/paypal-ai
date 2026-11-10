# Video clarity test 8 (render of 10 Nov 2026, 2:40.3: run 8's fresh script, slides and every clip re-recorded)

Same method as tests 1 to 7. A fresh subagent was told to read only the burned-in captions (`video/shelfie-demo.srt`) and one frame every 2 s (80 frames on 4 sheets), and then answered the questions.

| # | Question | Tester's answer (condensed) | Verdict |
|---|---|---|---|
| 1 | What is Shelfie? | A food seller photographs a paper price list and gets a live shop. Any AI assistant (through the MCP "agent door"), the shop page, or the shop's own assistant can order from it, and payment goes through PayPal. | Right |
| 2 | Who is it for? | Small food sellers who run on paper with no website: home bakers, market stalls (Rosa, Marigold Bakehouse). | Right |
| 3 | Uniquely for / what's new | AI shoppers can buy from the shop through one address that works with any assistant. Claude Code finds that address from the link alone. The shop sets the prices, so an AI can't make one up. Paper to live shop in minutes. | Right |
| 4 | PayPal's role | Each item becomes a PayPal catalog product. Checkout and payment happen on PayPal. The money goes into the seller's own PayPal account. The brief uses the PayPal Agent Toolkit. | Right |
| 5 | AI's role | Claude reads the menu and turns doubts into questions. The shop assistant takes orders and warns about allergens. Claude writes a brief for each paid order that flags the nut allergy. Claude Code acts as an outside shopper. | Right |
| 6 | Steps | 16 steps, from the problem and the statistic through sign-up, snap, review, publish, the agent door, Claude Code's order, the cart, the assistant, PayPal, the dashboard brief, the refused price, the diagram and the end card. | Right |
| - | Greeting / thank-you | "Hi there! Welcome to Shelfie." / "Thanks for watching!" | Right |

**Result: pass (6/6). No answer is wrong.**

**Named and left as they are:**
- The statistic's spoken wording is shorter than the card, which adds "with employees".
- 10 items are read but 9 are published.
- The demo shop's dashboard already has orders.
- "Rosa" is only spoken.
- The home hero's example shop is not the demo shop.
- The terminal text is dense.
- The $12.75 cart is not paid.

**Privacy check (same tester, plus my own look at all 80 frames):**
- No logins, passwords, recovery keys, owner links or API keys appear.
- Emails are masked.
- Only sandbox identifiers appear: the sandbox checkout token, PayPal's order and transaction IDs, PayPal's sandbox buyer John Doe and its saved sandbox funding.
- Third-party marks appear only as PayPal's official logo and on PayPal's own checkout pages (which include a Visa card icon). Claude is named in text.
