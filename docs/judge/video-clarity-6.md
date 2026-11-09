# Video clarity test 6 (render of 9 Nov 2026, 2:39.9: re-recorded on the production-pass UI)

Same method: a fresh subagent with no project context, only the transcript and a frame every 2 s.

| # | Question | Tester's answer (condensed) | Verdict |
|---|---|---|---|
| 1 | What is Shelfie? | "A web service that turns one photo of a paper price list into an online shop that AI assistants can order from and that takes payment through PayPal", with an agent door and an orders dashboard with AI briefs | Right |
| 2 | Who is it for? | "Sellers with a paper menu and no website" (Rosa's home bakery) | Right |
| 3 | Uniquely for / what's new | AI assistants could only buy from shops with a website store; now one photo makes the shop orderable by any AI assistant, and the money goes to her own PayPal account | Right |
| 4 | PayPal's role | Holds the catalog, runs checkout, pays the seller directly; the order source for the brief; sandbox | Right |
| 5 | AI's role | Claude reads the photo and flags doubts, is the shop's assistant (warns about nuts, orders), writes the brief; Claude Code is an outside AI shopper | Right |
| 6 | Steps | 13 steps, from the photo through review, publish, live shop, Claude Code's order, the second shopper, PayPal, the dashboard and brief, to the refused price | Right |
| - | Greeting / thank-you | "Hi there! Welcome to Shelfie." / "Thanks for watching!" | Right |

**Result: pass (6/6, none vague). No answer is wrong.**

**Confusions the tester named, for the next render:** a red focus callout covers the terminal lines where Claude Code finds the door (a real overlap, fixable); captions touch the toast's `Open` link; "10 items" becoming "Publish 9 items" is not explained; "One photo, and AI shoppers can order and pay" while a person approves payment; sandbox appears only in small print; the setup's shipping setting changes off camera; the outside agent's order stays unpaid while the cold open's paid order is the shop's own assistant; localhost addresses; the price refusal is a typed curl; the cardamom bun's example photo looks like a glass of tea. Narration stays per the brief; these are notes, not fails. The tester also said it could not see why this beats other tools: the owner ruled out naming other products.
