# Video frame check: `video/out/shelfie-demo.mp4` (final render, 07 Nov 2026, ~03:15 IST)

**File:** 165.30 s (2:45.3), 1920x1080, H.264 at 30/1 fps, AAC audio at **-14.0 LUFS integrated, true peak -1.0 dBFS** (`ebur128`). Rendered from `video/project/demo.json` on the final clips: 01–04 and 07 recorded 02:10–02:30 IST on `f073227` (the final Part A/A2/A3 UI), 05, 06, 06b, 08, 09 and 10 re-taken ~03:00 IST for the video round's fixes; every clip 0 dup / 0 drop.

**Video round fixes, checked in these frames:** Claude Code's order (SHF-FTABWQ) shows as *Waiting for payment* / *Waiting for approval* on the dashboard and the order page's list, never *Cancelled* (sheet 6); the discovery captions sit at the bottom, clear of the command and its shop URL (sheet 4); the architecture card has no footer sentence under the closing captions (sheet 7); the tamper scene opens on the typed command (sheet 6); the PayPal scene stays on the receipt (sheet 5).

**Method:** one frame every 2 s (`ffmpeg -vf fps=1/2`), 84 frames, tiled 3x4 into the 7 sheets in [`video-frames/`](video-frames/); I viewed every sheet.

| Check | Result |
|---|---|
| Secrets (keys, tokens, owner links) | None. The owner link shows as `/claim/••••••••` (sheet 3). The only token-like strings are the sandbox order's PayPal approval URL (`checkoutnow?token=…`, a one-hour, sandbox-only approval link that is the product's output) and the sandbox order ids. |
| Private data (emails, logins) | Emails masked: `s•••@business.example.com`, `s•••@personal.example.com`, the PayPal email field shows dots. The PayPal login step itself is not in frame; the PayPal review page shows only the sandbox test buyer's masked instruments (`••••6487`, `••••4160`). |
| Third-party marks | Only PayPal's own checkout page (part of the flow). No reference sites, no other brands. |
| Logo | Only the Awning logo (intro, headers, counter card, architecture card, end card). |
| Captions | One line each, never clipped, never covering the key UI (top placement on UI shots). |
| Example photos | Shown and labelled on the Menu tab in the counter scene ("Example photo, replace with yours"), replaced by Claude's crops on camera. |
| Known, kept | `localhost:3251` URLs (a local run), and the setup clip's new shop is `marigold-bakehouse-3` while later clips use the seeded `marigold-bakehouse` (each take starts a new shop from the sample). |
