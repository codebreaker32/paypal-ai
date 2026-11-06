# Video frame check: `video/out/shelfie-demo.mp4` (render of 07 Nov 2026, ~02:50 IST)

**File:** 166.78 s (2:46.8), 1920x1080, H.264 at 30/1 fps, AAC audio. Rendered from `video/project/demo.json` on the final clips (recorded 02:10–02:30 IST on `f073227`, the final Part A/A2/A3 UI, every clip 0 dup / 0 drop).

**Method:** one frame every 2 s (`ffmpeg -vf fps=1/2`), 84 frames, tiled 3x4 into the 7 sheets in [`video-frames/`](video-frames/); I viewed every sheet.

| Check | Result |
|---|---|
| Secrets (keys, tokens, owner links) | None. The owner link shows as `/claim/••••••••` (sheet 3). The only token-like strings are the sandbox order's PayPal approval URL (`checkoutnow?token=…`, a one-hour, sandbox-only approval link that is the product's output) and the sandbox order ids. |
| Private data (emails, logins) | Emails masked: `s•••@business.example.com`, `s•••@personal.example.com`, the PayPal email field shows dots. The PayPal login step itself is not in frame; the PayPal review page shows only the sandbox test buyer's masked instruments (`••••6487`, `••••4160`). |
| Third-party marks | Only PayPal's own checkout page (part of the flow). No reference sites, no other brands. |
| Logo | Only the Awning logo (intro, headers, counter card, architecture card, end card). |
| Captions | One line each, never clipped, never covering the key UI (top placement on UI shots). |
| Example photos | Shown and labelled on the Menu tab in the counter scene ("Example photo, replace with yours"), replaced by Claude's crops on camera. |
| Blemish | ~2:00: the price-tamper clip opens on an empty prompt for a moment (fixed by starting it at 1.6 s). |
