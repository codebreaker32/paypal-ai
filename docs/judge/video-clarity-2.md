# Video clarity test 2 (render 2 of 7 Nov 2026, 2:38.7)

Same method as test 1: a fresh subagent with no project context, given only the transcript and 79 frames (one every 2 s).

| # | Question | Tester's answer (condensed) | Verdict |
|---|---|---|---|
| 1 | What is Shelfie? | "A web app that turns one photo of a paper price list into a live shop with photos; AI assistants can order through a per-shop agent door, and buyers pay on PayPal" | Right |
| 2 | Who is it for? | "Small sellers, like Rosa's bakery, with a paper menu and no website" | Right |
| 3 | Uniquely for / what's new | "Sellers with a paper menu and no website. Before, AI shopping assistants could only buy from shops with a website store. Now one photo puts them in PayPal's catalog, any AI assistant can order, and the money goes to the seller's own PayPal account" | Right |
| 4 | PayPal's role | "Holds the catalog, runs checkout (the buyer approves on PayPal), pays the seller directly into her own account" | Right |
| 5 | AI's role | "Claude reads the menu and asks only about uncertain items; powers the shop-page assistant that warns about the allergy; Claude Code finds the agent door and orders; Claude reads the paid order from PayPal and writes a brief that flags the allergy" | Right |
| 6 | Steps | Hook → problem and statistic → three steps → Step 1 (photo, read, "2 for $7", PayPal email, publish 9 items, live shop) → Step 2 (agent door on the Share tab, Claude Code orders from only the URL, a second shopper with a nut allergy is warned and orders) → Step 3 (PayPal checkout, paid to Rosa's own account, dashboard, brief) → price refused → summary, end card | Right |
| - | Greeting / thank-you | "Hi there! Welcome to Shelfie." / "Thanks for watching!" | Right |

**Result: pass (6/6, none vague).** Test 1's fixes worked: the tester now reads the two orders as two shoppers and the door scene as the Share tab.

## Issues raised, and what was done
- Fixed (render 3): the "Her PayPal email" box sat on the Publish button (now on the email field); the "Order placed · Approve on PayPal" box was shifted left of the order card (now on it); the "Every item added to PayPal's catalog" box framed the next page's paragraph (the beat now plays "Adding your menu to PayPal" filling to "All 9 items are in PayPal", boxed).
- Not changed: dense terminal output (the labels carry it, and showing a real agent run is the point); MCP explained only as "an open standard" (the human capped MCP at one mention, with the plain explanation "a special address … to read the menu and order" given the line before); the sandbox approval token, buyer test address and session path are sandbox or local artifacts, not secrets; localhost URLs (no deploy exists, so it would be dishonest to show another); 10 → 9 items ("plus 1 to ask about in person" is on screen).
