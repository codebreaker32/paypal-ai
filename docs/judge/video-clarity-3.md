# Video clarity test 3 (render 3 of 7 Nov 2026, 2:37.9, after video judge round 2's fixes)

Same method: a fresh subagent with no project context, only the transcript and 79 frames (one every 2 s).

| # | Question | Tester's answer (condensed) | Verdict |
|---|---|---|---|
| 1 | What is Shelfie? | "A service that turns one photo of a small seller's paper price list into a live online shop: items go into PayPal's catalog, AI assistants can read the menu and order through an agent door, buyers pay on PayPal" | Right |
| 2 | Who is it for? | "Sellers with a paper menu and no website, such as Rosa's bakery" (with the Census 47% card) | Right |
| 3 | Uniquely for / what's new | "Small sellers with only a paper menu. Before, AI shopping assistants could only buy from shops with a website store. Now, after one photo, AI assistants can find the shop, order and pay, and the money goes to the seller's own PayPal account" | Right |
| 4 | PayPal's role | "Holds the catalog, runs checkout (the buyer approves on PayPal), pays the money straight into the seller's own PayPal account" | Right |
| 5 | AI's role | "Claude reads every item and price and asks only what it isn't sure of; AI assistants (Claude Code and the in-page assistant) order through the agent door, the in-page one warns about the allergy; Claude writes the seller a brief that flags the allergy" | Right |
| 6 | Steps | Hook → problem → pitch → three steps → Step 1 (photo, read, "2 for $7", masked PayPal email, 9 items to PayPal, live shop) → Step 2 (agent door, Claude Code orders from only the URL, a second shopper warned about nuts orders $27) → Step 3 (PayPal checkout, paid to the seller's own account, dashboard, brief) → price refused → recap, end card | Right |
| - | Greeting / thank-you | "Hi there! Welcome to Shelfie." / "Thanks for watching!" | Right |

**Result: pass (6/6, none vague).**

## Issues raised, and what was done
- **"They confirm" is said but not shown** (the cut jumped from the nut warning to the placed order). Fixed in render 4: a beat on the buyer's own message, "Yes, the almond croissants. Please place it, with a note about my nut allergy.", boxed and labelled "They confirm the order".
- Not changed (minor, or the product's real output): labels sitting over neighbouring lines in dense screens (terminal, receipt total, "To prepare" heading), captions over footers, the 10 → 9 item count (explained on screen), dense terminal flags, localhost URLs, sandbox checkout token and test address. No secrets; no third-party logos outside PayPal's checkout page.
