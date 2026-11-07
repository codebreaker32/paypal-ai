# Video clarity test 1 (cut of 7 Nov 2026, 2:38.7)

**Method:** a fresh subagent with no project context read only the transcript (the burned-in captions, from `video/out/shelfie-demo.srt`) and 79 frames, one every 2 s, and answered the six questions in one line each. Its answers are compared with the intended ones below.

| # | Question | Intended | Tester's answer (condensed) | Verdict |
|---|---|---|---|---|
| 1 | What is Shelfie? | One photo of a paper price list becomes a shop AI assistants can order from, paid with PayPal | "One photo of a paper price list or menu: Claude reads it, it becomes a live shop with its items in PayPal's catalog; AI assistants or the shop's chat can order, buyers pay through PayPal" | Right |
| 2 | Who is it for? | Small sellers (home bakers) with a paper menu and no website | "Small sellers who have a paper menu and no website (Rosa's bakery), backed by the 47% statistic" | Right |
| 3 | Uniquely for, what's new | Sellers with no website: AI assistants used to buy only from shops with a website store; now they can order from them | "Sellers with no website. Before, AI shopping assistants could only buy from shops with a web store; now one photo lets AI assistants find the shop, order, and pay the seller directly into her own PayPal account" | Right |
| 4 | PayPal's role | Catalog, checkout (buyer approves on PayPal), money straight to the seller's own account | "Holds the catalog, runs checkout (buyer approves on PayPal), pays the money straight into the seller's own PayPal account" | Right |
| 5 | AI's role | Reads the menu; assistants order through the agent door (in-page one warns about nuts); writes the brief | "Reads the photo and asks only what it's unsure of; powers the shop's ordering assistant (nut warning); Claude Code orders by itself through the agent door; writes the seller a brief that flags the allergy" | Right |
| 6 | Steps | photo → read → question → PayPal email → catalog, live → Claude Code finds the door and orders → in-page assistant → approve on PayPal → paid to Rosa → dashboard + brief → price lock → close | The same sequence, frame by frame (greeting, teaser, problem, pitch, three steps, summary, end card) | Right |
| - | Greeting / thank-you | "Hi there! Welcome to Shelfie." / "Thanks for watching!" | Both found and quoted | Right |

**Result: pass (6/6 right, none vague).**

## Issues the tester raised, and what was done
- **The agent-door scene showed the counter-card print page, with the "agent door" box around its Print button** (the most confusing stretch). Fixed: the scene now holds on the Share tab's "Your agent door" address (the clip's 3.0–5.0 s at 0.15×), boxed.
- **Two orders read as one** (Claude Code's $10 order vs the $27 paid order). Fixed in the narration: "Another shopper uses the assistant on the shop page."
- **The assistant warns about nuts, then the order still has almond croissants.** Fixed: "It warns her that the almond croissants contain nuts. She confirms, and it places the order."
- **"Live shop, with photos" box framed empty header space;** fixed (it frames the cover and the name). **"Brief flags the nut allergy" box was empty after the page scrolled;** fixed (the beat holds at 0.25× on the warning before the scroll).
- Not changed, with reasons: "MCP" is said once with its plain explanation, as the brief asks; the terminal output is dense but the labels ("Given only the shop's web address", "Finds the agent door on the page", "Order placed · PayPal link to pay") carry it; the sandbox approval link and sandbox order ids are the product's output and expire (as in the previous cut's judged frames); the buyer address is the PayPal sandbox's test address; Claude, the Census Bureau and USPS are named as facts, not as competitors; the "Paid" label over "To prepare" is minor.
- Secrets: none (no password, key or full email; emails masked; owner link never shown).
