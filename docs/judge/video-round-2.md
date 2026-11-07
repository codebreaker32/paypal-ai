# Judge round 2: the demo video (clearer cut)

**Artifact:** `video/out/shelfie-demo.mp4` (render of 7 Nov 2026, 06:34), with `video/project/SCRIPT.md`, `video/shelfie-demo.srt` and `video/project/demo.json`. The previous cut is `video/out/shelfie-demo-v1.mp4`, judged in `docs/judge/video-round.md`. The judge did not read PROGRESS, DECISIONS, commit messages or the workers' video-clarity notes. Scratch files are in `/tmp/vjudge2/`.

## My own checks

| Check | Command / evidence | Result |
|---|---|---|
| Length, format | `ffprobe`: 158.70 s (**2:38.7**), H.264 1920x1080 at 30/1, AAC 48 kHz stereo | **Pass.** 11.3 s under the brief's 2:50 cap, 21.3 s under 3:00. It is 8.1 s shorter than v1 |
| Black frames | `blackdetect=d=0.3:pix_th=0.08` | **Pass.** None |
| Frozen frames | `freezedetect=n=0.001:d=3` | Three holds: **1:14.6–1:22.5** (the Share tab's agent door, 7.9 s with no motion while the door is explained), 2:29.7–2:32.9 (the summary card) and the end card. All of them are on a readable screen with narration over it. The 7.9 s door hold is the longest stretch with nothing moving (see "below the line") |
| Dead air | `silencedetect=n=-45dB:d=2` | Every gap is 2.1–3.0 s. The longest is 3.0 s at 1:35.1–1:38.1 (the end of discovery). The 5.3 s gap from v1 is gone |
| Loudness | `ebur128=peak=true`: **integrated −14.0 LUFS**, LRA 6.1 LU, **true peak −1.0 dBFS** | **Pass.** Fix 2 from round 1 is done. There is no music (`music.enabled: false`), only the Kokoro voice |
| Frames | `fps=1` → 159 frames tiled 5x6 into 6 contact sheets, plus 18 full-size frames (t 9.3, 12, 22, 40, 46, 57.6, 58.6, 64.5, 68.5, 69.5, 75, 87, 94, 116, 125, 134, 140, 155) | I viewed every one-second frame |
| Narration pace | 333 words; 137.7 s of voice; 158.7 s runtime | **Pass overall:** 145 wpm while speaking and 126 wpm across the runtime. Per scene: `dashboard` 162 wpm (30 words in 11.1 s), `review` 155 and `problem` 154 run slightly over 150. Everything else is 138–147 |
| Captions | Full-size frames | **Pass, and larger.** Burned-in white Figtree on a black pill, about 60 px (v1 was about 40 px). Each cue is one line, nothing is clipped, and every cue is centred at the bottom. None covers the UI element its line is about (the v1 collisions at discovery and close are gone) |
| Chapter labels | Frames t46, t75, t116, t134 | **Pass.** A top strip shows `1 Snap your price list — 2 AI shoppers can order — 3 Paid on PayPal`, with the current step filled in pomegranate and "Step N of 3" on the right. It is legible at full size from 0:45.4 to 2:16.5 |
| Focus boxes and labels | Every sheet plus full frames | **Mostly on target**, with four misses: (a) **tamper, 2:12.4–2:16.5, has no box or label at all**; (b) **review, 1:03–1:06**: the "Every item added to PayPal's catalog" box sits on a clipped mid-paragraph line ("to ask about in person. Any AI assistant") instead of the "9 items are in your PayPal catalog" line; (c) **review, 1:08.8–1:10**: the "Live shop, with photos" box stays put while the page scrolls and the assistant panel opens, so it ends up framing half the Breads grid plus the chat and cutting through the "Pastries" heading; (d) paypal 1:55–1:59: the "Paid to Rosa's own PayPal account" label covers the receipt's Total line ($27.00 peeks out as "0"). All the others land: the cold-open order row, "Claude reads the menu", "10 items read, 4 to check", the PayPal email field, the agent door card, "Given only the shop's web address" on the `claude -p` command, "Finds agent door on the page" on the `<link rel="alternate">` line, "Order placed · PayPal link to pay" on Claude Code's answer, "Warns: contains nuts", "Order placed · Approve on PayPal", "Paid" on the dashboard row, "Claude writes Rosa a brief", "Brief flags the nut allergy" |
| Narration vs screen sync | SRT cues against frames | Good, with one miss. **"like two for seven dollars" (0:56.4–0:58.75)** shows the `Cardamom bun 2 for $7` card only until about 0:57.8. Then the card is confirmed, the list moves up, and the cue ends over **"Pain au chocolat $4.75"** (frame t58.6). Everything else lands: "An AI assistant just ordered from it" as the order row and toast appear (0:09), "given only the shop's web address" on the command, "gets back a PayPal link" on the `PayPal link: https://www.sandbox.paypal.com/checkoutnow?...` line, "It warns her…" on the warning, "The buyer approves on PayPal" on PayPal's page, "Rosa's own PayPal account" on the masked payee, "It flags the nut allergy" on the brief's warning |
| Secrets, private data | Frames t12, t64.5, t75, t87, t94, t116, t125 | **Pass.** No owner link is shown (the Share tab only shows the public door and shop links). Emails are masked (`s•••@business.example.com`, `s•••@personal…`), and the PayPal email field is dots. There is no key or password. The only token is the expired one-hour sandbox `checkoutnow?token=…`, which is the product's output. PayPal's page shows the sandbox buyer's default address ("John Doe, 2211 N First St, San Jose"), which is test data |
| Third-party marks | Every sheet | **Pass.** PayPal's own checkout page (1:51–1:54) shows the PayPal logo, PayPal Credit and the sandbox wallet's bank and Visa entries, all inside PayPal's page. Elsewhere, every logo is the Awning mark. "Claude Code" is named as the AI used, which is a tool disclosure, not a competitor |
| Brief: greeting with logo | 0:00–0:03.6 | **Pass.** The lockup plus "Hi there! Welcome to Shelfie.", spoken |
| Brief: payoff by ~0:14 | 0:03.6–0:13.5 | **Pass.** The paper menu, then the dashboard goes from "Nothing to prepare" to a paid $27.00 order with the label "Ordered by an AI assistant · Paid with PayPal" and a toast, done by 0:13.5 |
| Brief: problem, one sourced statistic | 0:14.4–0:36.3 | **Pass.** One statistic: "47% of US accommodation and food-service businesses with employees had no website", sourced on screen as the US Census Bureau ASE (data year 2016). Spoken as "nearly half of food and lodging businesses" |
| Brief: positioning, no other companies | 0:27–0:36 card, and the whole SRT | **Pass.** "Shelfie is for sellers with a paper menu and no website. One photo, and AI shoppers can order and pay." No product or company is named or alluded to. The problem line "they can only buy from shops with a website store" is generic |
| Brief: 3-step roadmap | 0:36.3–0:45.4, then the chapter strip | **Pass.** The three numbered steps appear as they are spoken, and "Step one / two / three" is said at each chapter start |
| Brief: "agent door" plain, "MCP" at most once | SRT cues 28–30 | **Pass.** "an agent door: a special address that AI assistants use to read the menu and order" comes first, and then "MCP" is said once. It also appears on screen in the terminal, which is fine |
| Brief: no jargon | SRT | **Pass.** It never says "capture". "approves", "paid" and "brief" are plain words |
| Brief: close plus thank-you | 2:16.5–2:38.7 | **Pass.** A three-row card (Who it's for / PayPal / AI (Claude)), with each row appearing as it is spoken, then "For Rosa, paper is now enough." Then the end card and a spoken "Thanks for watching!" |
| Product contradictions, overclaims | Frames t9.3, t12, t125, t140 | **No contradiction about the product.** Round 1's cancelled AI order is gone. Claude Code's SHF-FTABWQ sits under "Waiting for payment · Not paid yet $10.00", which matches its narration ("gets back a PayPal link"; Claude Code itself says "It isn't paid yet"). **One small identity mismatch:** the console narration says "Another shopper… **She** has a nut allergy… **She** confirms", but that order's buyer is "**John Doe**" on the cold-open row, the toast, the receipt and the order page (2:09: "Buyer John Doe"). "PayPal runs their catalog" (close) is a slight stretch, but the publish-to-catalog step backs it up |

**Round 1's top 3 fixes:** (1) the cancelled AI order is **done** (it now shows as unpaid, not cancelled); (2) loudness is **done** (−14.0 LUFS, −1.0 dBTP); (3) the caption collisions are **done** (the discovery caption sits below the command, and the close card has no footer). A5 was already 5 and stays 5. The new cut is clearer and shorter.

## A5 Presentation: **5 / 5**

- **The payoff comes first (0:00–0:14):** a greeting, then the paper menu, then a paid AI order landing on Rosa's dashboard. The "wow" is up front, which is what the brief asked for.
- **Problem, audience, why it matters (0:14–0:36):** plain words, one sourced statistic, and a positioning line that stands on its own. The audience ("sellers with a paper menu and no website") is said three times: in the problem, on the close card and in the closing narration.
- **The roadmap makes the structure obvious.** Three steps are spoken over a card, and a persistent "Step N of 3" strip keeps a muted viewer oriented for the whole demo.
- **End to end, all real, in order:**
  - photo → Claude reads → it asks only about uncertain lines → PayPal email → catalog → live shop with photos (0:45–1:10)
  - agent door explained → Claude Code finds it from the URL alone and orders (1:10–1:37)
  - in-page assistant warns about nuts and orders (1:37–1:51)
  - PayPal approval, paid to the seller's own account (1:51–2:00)
  - dashboard with Claude's brief flagging the allergy (2:00–2:12)
  - price tamper refused (2:12–2:16)
  - close (2:16–2:38)
- **Readable without sound, nearly everywhere.** Large captions plus labelled focus boxes carry each beat. The exception is the tamper beat (fix 1).
- **What keeps it from flawless (none drops the score):** the unlabelled tamper beat, one sync slip on "two for seven dollars", two drifting or misplaced boxes, and the "she" / "John Doe" mismatch.

Compared with v1, it gains clarity (roadmap, chapter strip, larger captions, labelled boxes, payoff first) and loses a little proof. The counter-crop and tracking beats are gone. That trade is right for the brief.

## Part C fails in the video

**None.**
- No 2026 banned pattern appears on any screen. The pages and cards are white, the type is Figtree, and the one accent is pomegranate. There are no serif display headlines, mono prices, dotted leaders, receipt edges or highlighter stripes. The cream in the problem scene is the photographed paper menu, not a page background.
- The title cards (greeting, positioning, roadmap, summary, end) each carry real content, so none is an empty hero. The summary card is three ruled rows, not three identical cards.
- There are no stand-ins. Every picture slot is a photo or the Awning mark.
- No placeholder copy appears, and the one statistic is real and sourced.

## Top 3 fixes (one render, no re-recording for 1–3b)

1. **`tamper`, 2:12.4–2:16.5: the beat has no focus box or label, so muted it reads as a wall of JSON.** It is the only beat that breaks "readable without sound", and it is 4.5 s long. Fix:
   - In `demo.json` `tamper`, add a focus box on the `"message": "\`price\` is not accepted; prices are set by the shop."` line (about y 565–595 at 1080p), with the label "Refused: prices are set by the shop".
   - Optionally, first box the request's `"price":0.01` for about 1 s.
   - Raise `holdSec` by about 1.5 s so the label can be read.
2. **`review`, 0:56.4–1:10: one sync slip and two weak boxes.**
   - (a) "like two for seven dollars" ends over **Pain au chocolat $4.75** (from about 0:57.8; frame t58.6). Hold the `Cardamom bun 2 for $7` card through 0:58.8: start that beat's clip segment about 1 s earlier, or freeze its last frame.
   - (b) At 1:03–1:06, the "Every item added to PayPal's catalog" box frames a clipped mid-paragraph line. Retarget it to the "9 items are in your PayPal catalog" line (move it up about 40 px at 1080p and make it two lines tall).
   - (c) At 1:08.8–1:10, the "Live shop, with photos" box stays put while the page scrolls and the chat opens. End the box (or cut the scene) at about 1:08.7.
3. **`console`, 1:37.7–1:51.3: "She has a nut allergy… She confirms" while the order says "John Doe" on four screens** (cold open 0:09–0:13, receipt, the order page at 2:09 "Buyer John Doe"). A careful judge sees two people. The cheapest fix is the narration only: "Another shopper uses the assistant on the shop page. **They** have a nut allergy… **They** confirm, and it places the order." Then re-voice that one scene (`npm run voice`) and re-render. The alternative is to rename the sandbox buyer and re-record, which costs much more.

**Below the line (don't re-render for these alone):**
- The setup clip's door URL reads `marigold-bakehouse-3/mcp` in large type at 1:03–1:06, while every later clip uses `marigold-bakehouse`. This was in round 1 too.
- `door`, 1:14.6–1:22.5: 7.9 s with nothing moving. A slow push-in on the door address, or a second label on the URL ("the door's address"), would keep the eye busy.
- `paypal`, 1:55–1:59: the receipt is cropped on the left ("ld Bakehouse"), and its label covers the Total line.
- `discovery`, 1:26–1:28: the "Given only the shop's web address" label sits on top of the first `curl …/marigold-bakehouse` output line.
- The `dashboard` narration runs at 162 wpm (30 words in 11.1 s). Cutting "from PayPal" or "so she can check before she ships" to "before she ships" brings it under 150.
- The statistic is from data year 2016 and is honestly labelled. Narration drops "with employees". That's acceptable, but the card carries the qualifier and the voice doesn't.
- Claude Code's order stays "Waiting for payment" on the dashboard. That's honest and consistent with its narration, so leave it.

## Verdict

**Ship.** A5 is 5/5, there are no Part C fails, and it meets every item of the human's brief (greeting, payoff by 0:13.5, one sourced statistic, standalone positioning, 3-step roadmap with "Step N of 3", plain "agent door", "MCP" once, no "capture", 145 wpm, larger captions, close plus thank-you, 2:38.7). There are no secrets, no third-party marks beyond PayPal's own checkout and no music. Fixes 1–3 are cheap (overlay edits in `demo.json` plus one re-voiced line) and worth one more render before uploading. Fix 1 matters most, because the tamper beat is the one place a muted viewer gets lost.
