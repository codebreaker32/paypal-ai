# Video frame check: `video/out/shelfie-demo.mp4` (final render of 9 Nov 2026, 20:30 IST)

**File:** 159.90 s (2:39.9), 1920x1080, H.264 at 30/1 fps, AAC audio at **-14.0 LUFS integrated, true peak -1.0 dBFS** (`ebur128`), no black frames (`blackdetect`). One full render from the committed `video/project/demo.json`, nothing spliced. Clips 03, 04, 06, 06b and 08 were re-recorded after S3 to S6; `03b` is not used by the cut.

**Method:** one frame every 2 s (80 frames), six to a sheet at 960 px wide, every sheet viewed on the session's first render. The second and third renders moved two captions; the frames that changed were viewed at 960 px or larger, and every other frame compared by PSNR (no difference above the threshold of 38 dB; the third render has no changed sampled frame against the second).

| Check | Result |
|---|---|
| Secrets (keys, tokens, owner links) | None. No owner link and no recovery key appears. The only token-like strings are the sandbox PayPal approval URL (`checkoutnow?token=…`, the product's output) and sandbox order ids. |
| Private data (emails, logins) | Emails masked: `s•••@business.example.com`, `s•••@personal.example.com`; the PayPal email field shows dots. PayPal's login step is not in frame; the checkout page shows only the sandbox test buyer's masked instruments and default address. |
| Third-party marks | Only PayPal's own checkout page. |
| Logo | Only the Awning logo. |
| Captions | Not clipped. They touch the left part of the small `New paid order` toast on the cold open and at the start of the dashboard scene; the framed order row stays clear. |
| Focus boxes | Each frames its subject on the current layout. The discovery label now sits below its box, so the lines where Claude Code finds the door are visible. Labels briefly cover a neighbouring line in the terminal scenes and the receipt's Total row, never the framed line. |
| Known, kept | `localhost:3251` URLs (a local run); the sandbox buyer John Doe's default address on the checkout and order pages. |
