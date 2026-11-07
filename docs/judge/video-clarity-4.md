# Video clarity test 4 (render 4 of 7 Nov 2026, 2:37.9)

Same method: a fresh subagent with no project context, only the transcript and 79 frames (one every 2 s).

| # | Question | Tester's answer (condensed) | Verdict |
|---|---|---|---|
| 1 | What is Shelfie? | "Turns one photo of a shop's paper price list into a live online shop with an agent door; AI assistants can read the menu and order, buyers pay through PayPal" | Right |
| 2 | Who is it for? | "Sellers who have a paper menu and no website (Rosa's small bakery)" | Right |
| 3 | Uniquely for / what's new | "Sellers with no website store. Before, AI shopping assistants could only buy from shops that had a website store. Now one photo makes the shop orderable by any AI assistant, and the money goes straight into the seller's own PayPal account" | Right |
| 4 | PayPal's role | "Holds the catalog, runs checkout (the buyer approves $27 on PayPal's page), pays the seller directly into her own PayPal account" | Right |
| 5 | AI's role | "Claude reads the menu and flags only what it's unsure of; is the in-page assistant that warns about nuts and orders (Claude Code orders separately as an outside AI shopper); writes Rosa a brief that flags the allergy" | Right |
| 6 | Steps | Hook → problem → three steps → Step 1 → Step 2 (Claude Code; second shopper warned, **confirms**, order placed) → Step 3 (PayPal, paid to her account, dashboard, brief, price refused) → recap, end card | Right |
| - | Greeting / thank-you | "Hi there! Welcome to Shelfie." / "Thanks for watching!" | Right |

**Result: pass (6/6, none vague).** Test 3's issue is fixed: the tester now sees the shopper confirm.

**Most confusing moment it named:** the price-tamper terminal arrives with no setup ("unclear who sent it"). Fixed in render 5: the line is now "One more thing: if an AI tries to set its own price, the shop refuses." No secrets; no third-party logos outside PayPal's checkout page.
