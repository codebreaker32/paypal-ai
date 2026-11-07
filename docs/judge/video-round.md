# Judge round: the demo video

> **Superseded (7 Nov 2026, run 4):** this round judged the first cut, now `video/out/shelfie-demo-v1.mp4`. The clearer cut is judged in [`video-round-2.md`](video-round-2.md) (A5 5, ship), with first-viewer clarity tests in [`video-clarity-1.md`](video-clarity-1.md) and [`video-clarity-2.md`](video-clarity-2.md). All three fixes below were done in the v1 cut.

**Artifact:** `video/out/shelfie-demo.mp4` (render of 7 Nov 2026), with `video/project/SCRIPT.md`, `video/shelfie-demo.srt` (byte-identical to `video/out/shelfie-demo.srt`) and `video/project/demo.json`. The judge did not read PROGRESS, DECISIONS or commit messages. It used the coordinator's `video-frames-check.md` only as a list of claims to check.

## My own checks

| Check | Command / evidence | Result |
|---|---|---|
| Length, format | `ffprobe`: 166.78 s (2:46.8), H.264 1920x1080 at 30/1, AAC 48 kHz stereo, 166.78 s | **Pass.** 13.2 s under the 3:00 limit |
| Black frames | `blackdetect=d=0.3:pix_th=0.08` over the whole file | **Pass.** None |
| Frozen frames | `freezedetect=n=0.001:d=3` | Holds at 1:11.3–1:14.4 (the counter card), **1:26.5–1:30.6** (Claude Code's answer), 1:52.8–1:56.9 (the receipt), 2:29.7–2:32.9 and 2:38.7–2:42.2 (the architecture card), then the end card. All are deliberate holds on a readable screen. None is a stall |
| Dead air | `silencedetect=n=-45dB:d=2` | The scene gaps are 2.3–3.8 s each. The longest is **5.3 s at 1:25.6–1:30.9**: the discovery scene's `holdSec: 4` plus the cut |
| Loudness | `ebur128`: **integrated −25.8 LUFS**, LRA 5.8 LU. `volumedetect`: max −6.7 dB | **Too quiet.** YouTube normalises loud uploads down to about −14 LUFS but does not raise quiet ones, so the narration will play about 12 dB below a typical video. There's no music (`music.enabled: false`), so there are no third-party music rights to worry about |
| Contact sheets | `fps=1,scale=480,tile=5x6` → 6 sheets in `/tmp/vjudge/`, plus 25 full-size frames at chosen moments | I viewed every one-second frame |
| Narration vs screen sync | SRT cue times checked against frames at those times | Good throughout. "two for seven dollars" lands on the `Cardamom bun 2 for $7` card (0:37–0:40). "Rosa adds her PayPal email" plays over the dotted email field. "Claude finds each item in it, and crops her own" plays over the two croissant crops. "hands back a PayPal approval link" (1:23.4–1:26.5): the `approval_url` line appears at about 1:24.5. "warns that they contain nuts" plays over the warning. "lands in Rosa's own PayPal account" plays over the receipt's "Paid to Marigold Bakehouse's own PayPal account (s•••@business.example.com)". "It catches the nut allergy" plays over the brief's two warnings. "the buyer's assistant reads it back" plays over `get_order_status` and the USPS number |
| Captions fit and legible | Full-size frames t3, t37, t78, t84, t103, t109, t114, t126, t136, t143, t150 | Every cue is one line, large (about 40 px Figtree on a dark pill) and never clipped. **Two scenes put the caption on top of on-screen text that matters** (see fix 3) |
| Secrets, private data | Frames t53.5, t88, t109, t114, t136 | **Pass.** The owner link shows as `/claim/••••••••`. Emails are masked (`s•••@business…`, `s•••@personal…`) and the PayPal email field shows dots. No API key, client secret or password appears. The only token is the one-hour sandbox `checkoutnow?token=…` approval link, which is the product's output |
| Third-party marks | Every sheet | **Pass.** The only one is PayPal's own checkout page (1:47–1:50: PayPal logo, PayPal Credit, and the sandbox wallet's "Visa ••••4160" inside PayPal's own page). There are no other brands. All logos are the Awning mark |
| Stand-ins (emoji, initials, text tiles) | Every sheet | **Pass.** Every picture slot is a photo: the logo, cover, menu photos, the labelled example photos and Claude's crops |
| Cuts | Every sheet | Clean. Two blemishes: at 1:57–1:59 the paypal scene's last beat (`videoStartSec: 21.3`) opens on the shop page with the "Marigold Bakehouse" h1 cut off by the top edge. And the setup clip's shop is `marigold-bakehouse-3` (0:53, visible for about 1 s) while every later clip uses `marigold-bakehouse` |
| Product contradictions, overclaims | Frames t126, t136 | **One contradiction.** The order Claude Code places at 1:14–1:30 (SHF-NUY2DL, "Sam · via an AI assistant") shows on Rosa's dashboard at 2:05–2:21 under **Done, $10.00 struck through, "Cancelled"**. It also shows in the order page's side list as "Cancelled". The scripted claims are hedged and sourced: "nearly half" matches the on-screen 47%, "In our tests… 8 to 14 seconds of machine time", and both quotes carry a source and date |

**Where I disagree with the coordinator's frame check:**
- It says the captions are "never covering the key UI". At 1:14.6–1:19 the discovery caption covers the `claude -p "There's a bakery I like at http://localhost:3251/s/marigold-bakehouse…"` command while the narrator says "given nothing but the shop's web address". At 2:27–2:42 the close caption sits over the architecture card's footer sentence.
- It missed the cancelled Claude Code order.
- It did not check loudness.

## A5 Presentation: **5 / 5**

- **Problem, audience, why it matters (0:00–0:27):** these are clear and evidenced. AI assistants shop, but PayPal's agent checkout serves website stores (quoted and sourced on screen). Rosa bakes from her kitchen with a sheet of paper. A home baker's real quote and a Census figure back that up. The beat closes on "An assistant can't order from a sheet of paper", over the very menu that becomes the shop.
- **End to end, all real, in order:**
  - photo → Claude reads → it asks only about the uncertain "2 for $7" → PayPal email → publish to PayPal's catalog → live shop (0:27–0:54)
  - Claude crops the display case (0:54–1:06)
  - counter card (1:06–1:14)
  - **Claude Code, given only the URL, finds the agent door and orders** (1:14–1:30)
  - the in-page console warns about nuts and orders (1:30–1:47)
  - the buyer approves on PayPal, the payment is captured and paid to the seller's own account (1:47–1:59)
  - price tamper refused by the server (1:59–2:05)
  - the paid order lands live on the dashboard with Claude's Agent Toolkit brief catching the allergy (2:05–2:21)
  - tracking is read back by the assistant (2:21–2:27)
  - architecture card and close (2:27–2:46)
- **Wow moments:** the agent finding the door on its own, "not ours" over the masked payee, and the brief's allergy warning. Each one is shown, not just claimed.
- **Pacing:** 389 words in 2:46.8 never feels rushed, and the holds let the key screens be read.
- **What keeps it from being flawless (none drops the score):** the cancelled AI order, quiet audio, two caption collisions and 5.3 s of dead air. These are the fixes below.

## Part C fails in the video

**None.**
- No 2026 banned pattern appears on any screen in the video. That means no cream background, serif display type, mono prices, dotted leaders or receipt edges.
- There are no stand-ins, and every image slot is a real photo.
- Copy is plain, with no placeholders.
- The one screen that isn't a product screen (the architecture card) uses the product's own tokens.

## Top 3 fixes (worth a re-render)

1. **The AI order the video just showed off sits as "Cancelled" on Rosa's dashboard (2:05–2:21, scenes `dashboard` and `tracking`, clips 08/09).** SHF-NUY2DL, the order Claude Code placed at 1:14–1:30, shows under Done with "$10.00" struck through and "Cancelled". It also appears as "Cancelled" in the order page's side list at 2:15. A judge reads that as the agent-commerce order failing. Fix: re-record clips 06 → 06b → 08 → 09 (`npm run clips -- --only 06`, and so on) with that order left alive. Either don't run `npm run seed -- --cancel-unpaid` between clip 05 and clip 08, so it waits under "Waiting for payment", or better, pay its approval link with the sandbox buyer first, so "To prepare" holds two paid orders from two different assistants. Then re-render. No narration change is needed.
2. **The narration is about 12 dB quieter than YouTube's level (integrated −25.8 LUFS, peaks −6.7 dB) across the whole video.** YouTube won't raise it, so judges hear a faint voice next to other entries. Fix: normalise the final mix to −14 LUFS with true peak ≤ −1 dBTP. Either:
   - add a step after the render: `ffmpeg -i shelfie-demo.mp4 -af loudnorm=I=-14:TP=-1:LRA=7 -c:v copy -c:a aac -b:a 192k out.mp4`, two-pass for accuracy;
   - or make the gain part of `npm run render`, so later renders keep it.

   Check with `ebur128` afterwards.
3. **Two captions cover text the viewer should read.**
   - (a) **`discovery`, 1:14.6–1:19:** `captionPlacement: "top"` puts "given nothing but the shop's web address." right over the `claude -p "There's a bakery I like at http://localhost:3251/s/marigold-bakehouse…"` command, hiding the URL the line is about. Set `discovery.captionPlacement` to `"bottom"`. The terminal's lower half is empty for the first 9 s, and the late overlap is only Claude's closing "The link goes to PayPal's sandbox…" lines. In the same scene, cut `holdSec` from 4 to 2.5. That trims the video's longest dead air (5.3 s at 1:25.6–1:30.9) while the approval link still holds for about 3.5 s.
   - (b) **`close`, 2:27.3–2:42.8:** the bottom caption lies over the architecture card's footer sentence "Prepaid orders from a photo of your price list, through any AI assistant, paid into your own PayPal account". Two lines of text collide through the whole closing statement. The footer repeats the narration, so delete that `<p>` (line 81 of `video/architecture.html`) and re-record clip 10 (`npm run clips -- --only 10-`).

**Below the line (don't re-render for these alone):**
- At 1:57–1:59 the `paypal` scene's last beat (`atSec 9.6`, `videoStartSec 21.3`) opens on the shop page with its h1 cut by the top edge. A later `videoStartSec`, or `holdSec` 2 → 1, would hide it.
- The setup clip's `marigold-bakehouse-3` slug shows at 0:53.
- `localhost:3251` URLs show throughout. They're honest for a local run, but a deployed URL would read better if one exists before the final recording.

## Verdict

**Ship.** It is under 3 minutes, shows the whole product working end to end and makes the problem, the audience and the stakes clear. It has no secrets, no third-party marks beyond PayPal's own checkout and no music. Fixes 1–3 are polish worth one more render before uploading to YouTube.
