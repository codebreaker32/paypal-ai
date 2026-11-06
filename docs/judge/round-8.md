# Judge round 8: main 306dab8, after round 7's fixes and the raw demo clips

## What I judged

**Artifacts:**
- The rubric `docs/JUDGING.md`, including the 6 Nov Part C amendment (13 banned "warm editorial" patterns, where a screen with 2 or more fails, and the real-product check).
- Round 7's verdict, used only for its top 3 fixes and its scores.
- Screenshots:
  - `screenshots/round-8/`: 96 screens at 390 and 1440, `axe-results.json`, and the README that labels fixture and mocked states.
  - `screenshots/capture/`: 13 files dated 12:29–12:31 today.
  - The README's 4 images in `docs/images/`.
- **The raw demo clips** in `video/clips/` (12 MP4s) and their `README.md`.
- `round-8-tests.txt`, `docs/reviews/` (no new review since review 4), `docs/DEMO.md`, `README.md` and `docs/SUBMISSION.md` (the lines cited below), and the code paths cited below.

I did not read `PROGRESS.md`, `DECISIONS.md`, commit messages or worker notes.

**What changed since round 7's code (4da78dc).** `git diff --stat 4da78dc HEAD -- src tests e2e scripts package.json` shows 11 files:
- copy cuts in `ReviewStep`, `LiveStep`, `ShopDetails` and `SharePanel`;
- the pre-hydration photo-pick fix in `PhotoPicker` and `CounterSnap`;
- the screenshot spec and the clip recorder.

## What I checked myself

**Build and static checks:**
- `npm run build` exited 0, including TypeScript.
- `npm run lint` exited 0.
- `npm test` gave **942 passed in 76 files**. This now matches `round-8-tests.txt:28`, which also explains the 957: that is `vitest run` including the sandbox and AI suites.

**Live server.** I ran `DATABASE_PATH=data/judge8.db UPLOADS_DIR=data/judge8-uploads PORT=3128 npm start`. `/api/health` returned `{"ok":true}`.

**Seed (3.8 s, exit 0).** It created **9 real Catalog products** (`PROD-8AD49433EH465902G` and 8 more) and printed "Marigold Bakehouse is live: 9 items in the PayPal sandbox catalog". I kept the owner link out of my output.

**The agent door, live:**
- `initialize` returned `serverInfo.title` "Marigold Bakehouse on Shelfie".
- `list_products {"query":"almond"}` returned the item with an absolute `image_url` and the `data_notice`.
- `create_order` with `"price": 0.01` returned `isError: true`, `INVALID_ARGUMENTS` at `items[0].price`: "`price` is not accepted; prices are set by the shop."
- A real `create_order` (2 × almond croissant, pickup) took **1.69 s** and returned SHF-NZRYRA, `awaiting_approval`, $10.00.

**PayPal's own record of that order.** I fetched it with a script that compares values without printing them. It showed `PAYER_ACTION_REQUIRED`, 10.00 USD, invoice `SHF-NZRYRA`, SKU `PROD-5BK742224A680390W`, and **`payee == PAYPAL_SANDBOX_SELLER_EMAIL: true`**.

**Discovery, live:**
- The shop page has `<link rel="alternate" type="application/json" title="Agent door (MCP)" href="…/s/marigold-bakehouse/mcp"/>`.
- `/agents.txt` returned 200 `text/plain` and `/llms.txt` returned 200.
- `GET` on the door returned 405.

**e2e on the final code, partly.** The full run in `round-8-tests.txt` is on 68a2c64. Since then, 8 files have changed, including `ReviewStep.tsx` (+43/−30) and `PhotoPicker.tsx`. So I restarted my build with `SHELFIE_TEST=1` and ran the affected specs against it with `E2E_REUSE_SERVER=1`:
- `e2e/setup-review.spec.ts`: **8 passed**.
- `e2e/menu-tab.spec.ts` (6 tests) did not run here, and it is not an app failure. Its fixtures refuse any database but `data/e2e.db` (`e2e/task8-fixtures.ts:20–21`), and I may only write `data/judge8*`. So the pre-hydration test (`menu-tab.spec.ts:126`) is unverified by me.

**axe.** I parsed `round-8/axe-results.json` myself: **96 entries, 0 violations**.

**Repo.** `curl -s -o /dev/null -w '%{http_code}' https://api.github.com/repos/codebreaker32/paypal-ai` returned **404**, so the repo is **not public**.

**The demo clips.** `ffprobe` on all 12:
- Every clip is 1920x1080 at `30/1`.
- Lengths: 01 10.0 s, 02 19.2 s, 03 42.0 s, 03b 26.8 s, 04 12.3 s, 05 47.6 s, 06 47.5 s, 06b 26.2 s, 07 17.3 s, 08 24.5 s, 09 32.4 s and 10 15.0 s. That is **320 s of raw footage for a 170 s cut**.
- I extracted and viewed 31 frames into `/tmp/judge8/`. These included both ends of the PayPal login cut (06's last frame, 06b at 0.1 s), 03 while the email is typed, and 05 at 10, 30 and 46 s.
- **No sandbox login, owner token or key is visible in any frame I viewed:**
  - the PayPal email field is drawn as dots (`03-review-publish-25`);
  - the owner link shows `/claim/••••••••` (`03-review-publish-41`);
  - "Paid to" shows `s•••@business.example.com` (`08-dashboard-brief-20`) and the buyer `s•••@personal.example.com` (`09-tracking-10`);
  - 06 ends on PayPal's empty login page and 06b starts on the review page.

I stopped both servers by PID, deleted `data/judge8*`, and removed the `test-results/` folder my e2e run created. `git status` was clean before I wrote this file.

## Part A

| # | Score | Evidence |
|---|---|---|
| A1 Technological implementation | **5** (held) | **PayPal, live today:** Catalog Products (9 at seed), and Orders v2 with SKU, invoice id and the seller as `payee` on PayPal's own record (SHF-NZRYRA). **From the capture gate on 68a2c64** (`round-8-tests.txt:6–19`): seller capture `9RX261380T155022Y` COMPLETED with "payee = PAYPAL_SANDBOX_SELLER_EMAIL"; platform capture `1TK16972JJ957364J` COMPLETED with a USPS tracker at PayPal; the Agent Toolkit brief on both, flagging the nut allergy. **The clips show it on real services:** a live Claude reading (02), live counter crops (03b, "about 3.5 s"), Claude Code ordering from the URL alone (05), and a paid $27.00 order with PayPal order `59S52578CM472772V` and capture `66272875295764339` (06b, 08). |
| A2 Design | **5** (held) | **Round 7's rough edges are gone.** The counter sheet has all its states on screen: reading (`dashboard-menu-counter-reading-1440`, the photo with *Finding your items…*), none-found (`-none-390`), error (`-error-390`, in red: "We couldn't look at that photo just now. Try again in a moment.") and a **live** Claude answer (`-live-390/1440`, two croissant crops with Replace/Skip). The real-sandbox screenshots are in the current design (`capture/seller-receipt-paid-1440`, `seller-order-shipped-1440`). 96 screens, 0 axe violations. The clips show one coherent product from phone setup to laptop dashboard. |
| A3 Potential impact | **5** (held) | Payment into the seller's own account is verified live (PayPal's record above) and on camera ("Paid to Marigold Bakehouse's own PayPal account", 06b). The audience and the sourced pain are unchanged (`DEMO.md` "Facts we may say"). |
| A4 Innovation | **5** (held) | A door assistants find from the shop page, live today (`rel="alternate"`, `/llms.txt`). Clip 05 shows Claude Code with `MCP servers configured: none` reading the `<link rel="alternate">` and ordering (SHF-JH58AZ). Snap your counter is the second fresh use of vision. |
| A5 Presentation readiness | **4** (held, seventh round) | **What's new:** raw clips for every `DEMO.md` shot. They are clean 1920x1080 at 30 fps with no leaked secrets, on real services, and the wow moments are on film: Claude Code finding the door (05), the console's nut-allergy read-back → Approve $27.00 → Paid (06/06b), and the $0.01 tamper refused (07). **Why it doesn't move:** A5 asks whether the video "makes clear the problem, the audience and why it matters", and all of that lives in narration and on-screen text that don't exist yet. 320 s of raw footage still has to become 2:50 with a voice-over, the 0:00 quote card and the 2× on 05. There is no public YouTube video. The repo is not public (404), `README.md:143` says "**Not yet run.**", and `SUBMISSION.md:86–88` still has 3 TODOs. **What moves it:** fix 1. |
| **Total** | **24/25** (round 7: 24) | |

## Part B

| # | Score | Evidence |
|---|---|---|
| B1 Idea | **5** (held) | "Snap your price list; any AI assistant can order from you; you're paid on PayPal." Clip 10's architecture card says it in one line: "Prepaid orders from a photo of your price list, through any AI assistant, paid into your own PayPal account." |
| B2 Implementation | **5** (held) | **Run by me:** build and typecheck 0, lint 0, 942 unit tests passed, and `setup-review.spec` 8/8 on my HEAD build. **Full e2e:** 173 passed and 3 skipped with both real capture gates (`round-8-tests.txt:21–24`). That run is on 68a2c64, before 306dab8's pre-hydration fix and the review-step copy commit (see fix 3). |
| B3 Depth | **5** (held) | The messiness is visible on camera, not just in tests. Clip 03 answers 4 real reading questions: a crossed-out price, "2 for $7" → $3.50, a hard-to-read item, and market price → ask in person. The latest fix handles a photo picked before hydration, a real phone race (`PhotoPicker.tsx` `usePickedBeforeHydration`). |
| B4 Usefulness | **4** (held) | Everything a seller needs works locally, but no seller can use it this week: there is no hosted instance (`README.md:143`), and every clip shows `localhost:3251`. *Fix:* fix 2. |
| B5 Innovation | **5** (held) | Same as A4. |
| **Total** | **24/25** (round 7: 24) | |

## Part C

**Screens I viewed.** I put each next to the references in `.scratch/refs/` (Toast store pages, Toast Local, Square for bakeries):
- **round-8 set:** `setup-review-390/1440`, `setup-live-390/1440`, `dashboard-share-390/1440`, all 5 counter screens (`dashboard-menu-counter`, `-reading`, `-none`, `-error`, `-live`), `shop-first-screen-390`, `shop-1440`, `shop-no-photos-390`, `dashboard-orders-1440`, `order-paid-with-brief-390`, `receipt-paid-390`, `start-390`.
- **capture set:** `seller-receipt-paid-1440`, `seller-order-shipped-1440`.
- **clips:** 31 frames covering every product screen in the clips.

**Banned 2026 patterns, per screen** (2 or more fails a screen):

| Screen | Patterns found | Count |
|---|---|---|
| setup-review (390, 1440) | **Was 1, now 0.** The grey lines left are "Fix these, or leave them: they stay off your shop until you do." and the email hint. The ready list, "Your shop" and the cover box have none. Each question card's grey text is the question itself ("Printed as “2 for $7”. We set $3.50 each. Is that right?"), not an explainer. The 4 outlined question cards are the only boxes. | 0 |
| setup-live | **Was 1, now 0.** Two grey lines under 5 blocks ("Give it to any AI assistant…", "Keep it private…"). | 0 |
| dashboard-share | **Was 1, now 0.** One grey line ("Give it to any AI assistant to order from you."). Your shop link and the Counter card have none. | 0 |
| counter sheet (reading, none, error, live, proposals) | none: one photo or crops, one line of state, Use/Replace/Skip, Done | 0 |
| order-paid-with-brief, capture `seller-order-shipped-1440` | **grey explainer lines** (still): "Claude, from PayPal's record. Check before acting." (`BriefCard.tsx:64`), "Ship it, then add tracking here…" (`orders/[orderId]/page.tsx:68`), "PayPal only lets the account that was paid add tracking…". The Allergy/Timing tags and "Saved in Shelfie" are 3 small tags, not chips everywhere. | 1 |
| capture `seller-receipt-paid-1440` | none. Round 7 counted 7 on the retired version; it now has a check mark, a sunken summary and prices in Figtree. | 0 |
| shop, shop-first-screen, shop-no-photos, dashboard-orders, receipt-paid, start | none (unchanged from round 7) | 0 |

**Screens with 1 pattern dropped from 4 to 1** (the order detail). No screen has 2.

| Item | Result | Evidence |
|---|---|---|
| Clear hierarchy, one primary action | **Pass** | One black fill per screen: **Copy agent door link** (`setup-live`, `dashboard-share`), **Publish 9 items to PayPal** (clip 03), **Snap your counter** (`dashboard-menu`), **Back to shop** (`receipt-paid`), **Order with an assistant · PayPal** (`shop-first-screen-390`). On the counter sheet, **Use** is per crop, with Done as a quiet full-width button. |
| Loading, success, empty and error states | **Pass** | Round 7's gap is closed: the counter's reading, none-found, error and live states are all screenshotted (above). The other states are unchanged: setup reading, publishing, retry, failed and retake; console thinking, error and rate-limited; dashboard loading, empty and PayPal-unreachable; every receipt state. |
| WCAG AA contrast, keyboard, visible focus, alt text | **Pass** | `axe-results.json`: 96 screens, **0 violations** (parsed by me). The README images carry full alt text (`README.md:9,11`). |
| Phone width: no horizontal scroll, targets ≥ 44 px | **Pass** | The overflow check passed on all 96. The counter sheet's buttons are full height at 390 (`dashboard-menu-counter-live-390`). |
| Copy is plain and specific | **Pass** | "We couldn't match any items. Try a closer photo." "Keep it private: anyone with it can run your shop." "Printed as “2 for $7”. We set $3.50 each. Is that right?" |
| No generic AI look | **Pass** | White, near-black and one pomegranate accent, in the clips too. No gradient, glass or emoji. |
| No empty hero, no three identical feature cards | **Pass** | Start shows a real shop on a phone beside one action (`start-390`). Clip 10's eight architecture boxes are a diagram, not a feature-card wall. |
| No lorem or fake stats | **Pass** | Real Pexels photos, credited. Fixtures are labelled in the screenshot README. Every number in the clips comes from a real sandbox run. |
| Deliberate type, palette and spacing | **Pass** | Figtree in a heavy display weight with a light body. Mono only for URLs, ids and tool names. One accent. |
| Banned 2026 patterns (2+ on a screen fails) | **Pass** | Max 1, on 1 screen (table above). |
| Real-product check | **Pass** | Next to the references, every viewed screen reads as a real product: Toast's store page (`shop-1440`, `shop-first-screen-390`), a Square or Toast order list (`dashboard-orders-1440`), Square onboarding (`setup-review`), and an operations app's photo sheet (the counter sheet). In clip 06, the same shop with the console beside it looks like a shipped commerce product. |
| Tokens defined once and used everywhere | **Pass** | No change since round 7: the diff since 4da78dc touches copy and one hook, not styles. |
| Type scale and line length | **Pass** | Same display, title, body and meta sizes across all new screens. |
| Consistent components, subtle motion | **Pass** | The counter sheet uses the same Sheet, pill and row shapes as the rest. Motion is the spinner and the reading scan line (clip 02). |

**Part C: 0 fails** (round 7: 0).

**Not a Part C item, but a cut-room note on the clips.** In 02 and 03 the phone frame is about 480 px of the 1920 px width, so on YouTube its text will be small. 05 at about 30 s shows two refused tool calls and a `/home/aman/.claude/projects…` path. Both are fixed in the edit (fix 1).

## Round 7's top 3 fixes

1. **Publish, deploy and record: partly done, not enough to move a score.**
   - **Done:** raw clips for every shot, checked above.
   - **Not done:** the repo is still private (GitHub API 404), `README.md:143` still says "Not yet run.", `SUBMISSION.md:86–88` still has 3 TODOs, and there is no cut or public video.
   - The human hand-off checklist lives in PROGRESS, which I don't read.
   - **A5 and B4 held at 4** for the seventh round.
2. **Re-shoot the capture screenshots and run the full e2e on the final commit: mostly done.**
   - **Capture screenshots:** all 13 re-shot in the Storefront design (12:29–12:31). The receipt went from 7 banned patterns to 0.
   - **Full e2e:** 173 passed and 3 skipped with both real capture gates (`round-8-tests.txt:21–24`).
   - **Unit counts:** reconciled at 942 and 957 (`:27–28`).
   - **The gap:** the e2e ran on 68a2c64, and HEAD is 306dab8, 8 files later. I covered `setup-review` (8/8 on HEAD) but could not run `menu-tab`.
   - **No score moved** (it protects A1, A2 and B2).
3. **README screenshots, the counter's states, fewer grey lines: done.**
   - **README:** 4 images with alt text under the opening paragraph (`README.md:7–13`). Its link still points at `round-7/` (`:13`).
   - **Counter states:** all 4, one of them live.
   - **Grey lines:** cut on review, live and Share, so screens carrying a banned pattern went from 4 to 1.
   - **No score moved** (A2 was already 5). The Part C margin is wider.

## Top 3 fixes (ranked by Part A gain)

1. **Cut the video, publish it, and make the repo public (A5 4 → 5; without the video and the public repo the entry fails Stage One).** Due 12 Nov 2026, 12:00 PT.
   - **The cut.** The clips are ready, so the remaining work is editing:
     - Trim 03 (42 s) to its 14 s slot on the answer taps and the live screen.
     - Run 05 at 2× and cut its refused `tools/list`/`sed` lines and the `/home/…` path (about 0:28–0:31).
     - Join 06 and 06b and cut PayPal's wait, to fit 34 s.
     - Zoom the phone in 02 and 03 to about 150%.
     - Add the `DEMO.md` voice-over, the 0:00 quote card and captions.
   - **Publish.** Upload the video public on YouTube. Then make the repo public after a history secret scan, and confirm `curl …/repos/codebreaker32/paypal-ai` returns 200 and the licence shows in About.
   - **Docs.** Fill in `SUBMISSION.md:86–88`.
2. **Deploy to Render (B4 4 → 5; also helps A5).** Follow `README.md:141–174`, run the seed in the service shell, register the webhook, and replace `README.md:143` with the URL and the date it was verified. A hosted https door lets the video and the judges try a real "any assistant" order without a local setup, and drops `localhost` from what they see.
3. **Freeze the code and prove the final commit (protects A1, A2 and B2).** Run `npm run e2e` once on the commit that ships, and record it in a tests log. The pre-hydration test (`menu-tab.spec.ts:126`) has not run in any recorded full suite. While there:
   - Point `README.md:13` at `round-8/`.
   - Cut one of the order detail's grey lines (`BriefCard.tsx:64` or `orders/[orderId]/page.tsx:68`), the last screen with a banned pattern.
   - Mask the e2e owner link in `setup-live-390/1440` as the clips do. It is a throwaway localhost token, but it reads like a leaked secret in a public repo.

## Verdict: **ship**

Part A is **24/25** and Part B is **24/25** (both held), with **0 Part C fails**. The rubric's bar (no Part C fails and Part A ≥ 20) is met for the fourth straight round.

This round closed round 7's design and evidence gaps:
- the real-sandbox screenshots are in the current design;
- every counter state is on screen, one of them live;
- the grey-line pattern is down to one screen;
- the README shows the product.

The new raw clips show the whole flow on real services with no secret on screen.

What's left is not code. A5 and B4 have not moved in seven rounds because nothing has been published. Today there is still no public repo, no hosted URL and no cut video, so the entry would fail Stage One as it stands. Fix 1 is due before 12 Nov 2026, 12:00 PT.
