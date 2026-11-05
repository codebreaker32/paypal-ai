# Judge round 0: spec comparison

**Ap1** = `docs/approaches/approach-1.md` (seller-first). **Ap2** = `approach-2.md` (agent-first). Each is scored as the product it would produce if built as written in about 6 hours.

**Spot-checks:** every toolkit action key either spec uses exists in `.scratch/tk/.../agent-toolkit@1.11.0`, and `create_product` accepts `category`. Both specs follow DECISIONS.md: the `FOOD_RETAIL_AND_SERVICE` category, no card capture, and the buyer login listed as needed from a human. Neither is penalised for mentioning `ai@4`.

## Part A

| # | Ap1 | Ap2 |
|---|---|---|
| A1 Tech | **4**: Catalog create/PATCH, Orders create/get/capture, trackers, webhook verify (§5). The brief agent is grounded on toolkit `get_order` (§6). Prices are set on the server and only one caller can capture (§4). *Fix:* capture can't be verified without a buyer login (§11), and the pickup demo shop never uses tracking (§10). | **4**: the same APIs plus webhook registration (§5). A toolkit copilot *writes* tracking after the seller confirms (§5), and orders are bound to a quote (§7). *Fix:* the same capture gap, and the confirm step relies on ai@4 `addToolResult` (§5.2), so it needs redesigning. |
| A2 Design | **4**: one-thumb and no-jargon rules, named fonts and hex values, every state listed (§3). Unsure items never block publishing (§3 issue table). *Fix:* 11 screens and 7 issue codes will spread the polish thin. | **3**: flagged rows *block* publishing (§3). Sellers see "MCP URL" and connect snippets (§2.3). The visual language is vague (§3). The seller gets three interaction models: form, review and copilot. |
| A3 Impact | **3**: a specific audience (§1). Prepaid preorders replace no-show DMs, and buyers with no AI can still order (§2). *Fix:* the pain is a persona assumption and the 95/20 stat is unverified (§1). | **3**: the same audience and a sharper line ("website, feed, checkout, MCP → a photo", §1). The same unverified evidence. Checkout without an agent is out of scope (§11). |
| A4 Innovation | **4**: not a listed example. The "agent door" is a buyer-safe façade over a toolkit whose `create_order` trusts `itemCost` (§5). | **4**: the same concept, with the quote → order step as a twist (§7). The discovery cards (§8) are invisible extras. |
| A5 Presentation | **4**: a split-screen wow ("a shop that didn't exist three minutes ago") with no third-party logos (§10). *Fix:* the wow comes at 1:10, tracking is never shown, and the "$1" tamper goes through chat, so the model, not the server, may be what refuses. | **4**: the wow comes at 0:50, the Inspector tamper proves the server enforces prices, and tracking is shown (§10). *Fix:* the wow needs a deployed connector (§8) and shows Claude-branded UI, which the video rules forbid. 2:05–2:40 is overpacked. |
| **Total** | **19/25** | **18/25** |

## Part B

| # | Ap1 | Ap2 |
|---|---|---|
| B1 Idea | **4**: one line that serves people *and* agents (§1). | **4**: a crisper line, but for agents only (§1). |
| B2 Implementation | **4**: TDD on pure functions, a capture-race test, a sandbox suite, axe and screenshots (§9), and 5 engineers (§12). Three ways to reconcile orders (§4) is one too many. | **3**: equally strong tests (§9), but a bigger scope for 4 engineers: the copilot, `scopeTool`, FTS5, quotes, shipping fees, discovery files and a call log. Track B waits on track A until 2:30 (§12). |
| B3 Depth | **5**: issue codes with one-thumb fixes, skipped lines, column headers, duplicates across pages, market prices (§3, §6). Also the capture claim, the decline loop, expiry, caps and recorded-AI mode (§4, §7, §8). | **4**: problem-specific reshoot tips, a retry on schema errors, `QUOTE_STALE` (§6, §7). The only spec that keeps shops from seeing each other's data on the shared merchant (§5). |
| B4 Usefulness | **4**: usable this week without buyer agents (§2), with sold-out and pause toggles (§3). | **3**: no menu editing after launch (§11). The shipping fee is useful (§2). |
| B5 Innovation | **4**: a buyer agent plus a brief agent grounded in PayPal (§6). | **5**: agents on both sides. The seller's agent writes to PayPal through the toolkit, with a human confirming (§5). |
| **Total** | **21/25** | **19/25** |

## Part C: all items n/a (spec)

Risks the specs create:
- **One primary action:** Ap1's dashboard cards have two actions each, and Share shows four things. Ap2's dashboard has two primary actions.
- **Async states:** Ap2 gives none for `/` or the shop page.
- **Contrast and keyboard:** Ap1's tomato on paper is about 4.8:1 (passes). Sage and amber have no hex values, and amber text on paper usually fails. "See photo" pinch-zoom and the bottom sheet need keyboard and focus-trap paths. Ap2's amber rows carry the same risk.
- **390 px:** raw MCP JSON in tool chips or the Activity panel will scroll sideways unless it wraps (both, §8).
- **Plain copy:** **at risk in Ap2**, which shows sellers "MCP URL" and "Connected · 6 tools". Ap1 bans that jargon.
- **No empty hero:** **at risk in Ap2**, whose `/` is a pitch hero.
- **Deliberate choices:** **at risk in Ap2**, which names no fonts or colours.
- **Type scale:** **at risk in both**, since neither defines one.
- **Generic AI look:** both chat surfaces need deliberate styling.
- **Tokens and fake stats:** both specs are fine.

## Winner: Ap1 (seller-first)

**Ap1:** A 19/25, B 21/25. **Ap2:** A 18/25, B 19/25. Ap1 wins on design discipline, fit to 6 hours and usefulness. Ap2 has the better demo arc and MCP contract.

**Take from Ap2:**
1. **A shipped order in the demo (§2, §5, §10):** per-order `fulfillment`, with a flat `shipping_fee_cents` in the `breakdown`. The video then shows tracking added to PayPal and read back by the agent's `get_order_status`.
2. **The Inspector tamper (§10, 1:55):** send a raw `create_order` with `price: 0.01` and show the error, instead of the chat "make it $1".
3. **Tool contracts (§7):** an `outputSchema` on every tool, a `hint` in errors, the next call named in each description, and `did_you_mean` on `UNKNOWN_ITEM`.
4. **The `scopeTool` ownership check (§5):** the brief agent's toolkit reads reject IDs the shop doesn't own. Drop `products.list` from Ap1's allowlist.
5. **Extraction (§6):** a `problems[]` enum for specific retake tips, and one retry on schema failure with the error included.
6. **Sandbox tests (§9):** the same request ID twice returns the same order, and the full MCP flow runs over HTTP against `next start`.
7. **Build plan (§12):** freeze `lib/contracts.ts` at hour 0.

**Leave behind:** the copilot, agent.json, llms.txt and JSON-LD, FTS5 search, `prepare_cart`, and blocking publish on flags.

## Top 3 fixes to Ap1, ranked by Part A gain

1. **Make the demo prove the whole core flow (A5 4→5, A1 4→5).**
   - Rewrite §10 so the wow lands by 0:50 (one fix, not three).
   - Show a shipped order with its tracking.
   - Run the tamper through the Inspector.
   - In §12, make the sandbox buyer login an hour-0 blocker and the Playwright capture test the 4:00 gate.
2. **Cut scope and polish fewer screens (A2 4→5).**
   - Drop menu edits, the `update_product` rename path, the QR code and poll-on-read.
   - Fold the 7 issue codes into 4.
   - Replace §6's `compatFetch`/ai@4 with `messages.parse` + `toolRunner`, with MCP tools wrapped as `betaTool`s.
   - Add a type scale and status colours that pass AA.
3. **Evidence the pain (A3 3→4).**
   - Replace the §1 persona assumption with 2–3 real seller quotes or a primary source.
   - Verify the wording behind "Agent Ready starts from a store".
   - Time photo → live shop on the sample menus.

## Verdict: **fix**

Part A is 19, under the 20 needed to ship, and Part C can't pass until there is a UI. Build Ap1 with the three fixes and the items taken from Ap2. No rethink is needed.
