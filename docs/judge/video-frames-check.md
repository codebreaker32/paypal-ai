# Video frame check: `video/out/shelfie-demo.mp4` (render of 09 Nov 2026, ~17:08 IST)

**File:** 159.90 s (2:39.9), 1920x1080, H.264 at 30/1 fps, AAC audio at **-14.0 LUFS integrated, true peak -1.0 dBFS** (`ebur128`). Rendered from `video/project/demo.json` on the clips re-recorded on the new UI (09 Nov, `video/clips/`; `03b` failed and is not used by the cut).

**Render note:** the full render was followed by a re-render of frames 3335 to 3610 (the PayPal scene, whose captions moved to the top so they no longer cover Complete Purchase), spliced into the file with ffmpeg (video re-encoded CRF 18, audio stream copied unchanged). `video/project/demo.json` carries the same `captionPlacement: "top"`, so a fresh full render gives the same picture.

**Method:** one frame every 2 s (`ffmpeg -vf fps=1/2`), 80 frames tiled 4x5 at 480 px wide into 4 sheets, every sheet viewed; plus six full-size frames around the spliced PayPal scene. Sheets were scratch files and are not kept.

| Check | Result |
|---|---|
| Secrets (keys, tokens, owner links) | None. No owner link and no recovery key appear in any frame: the cut stops the setup clip before the Live screen with its "Save your recovery key" banner. The only token-like strings are the sandbox order's PayPal approval URL (`checkoutnow?token=…`, a sandbox approval link that is the product's output) and sandbox order ids. |
| Private data (emails, logins) | Emails masked: `s•••@business.example.com`, `s•••@personal.example.com`; the PayPal email field shows dots. PayPal's login step is not in frame; the checkout page shows only the sandbox test buyer's masked instruments (`••••6487`, `••••4160`) and the sandbox buyer's default address. |
| Third-party marks | Only PayPal's own checkout page (part of the flow). |
| Logo | Only the Awning logo. |
| Captions | Not clipped. On the cold open and at the start of the dashboard scene the caption overlaps the left part of the small "New paid order" toast for a moment; the order row, which the focus box frames, stays clear. |
| Focus boxes | Each frames its subject on the new layout (sidebar, Share rows, shop page, assistant dock, receipt, terminals). Labels sit just above their boxes and briefly cover a neighbouring line (terminal scenes, the receipt's Total row), never the framed line. |
| Known, kept | `localhost:3251` URLs (a local run); the checkout and order pages show the sandbox buyer John Doe's default address. |
