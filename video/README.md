# Demo video pipeline

Shelfie's demo video (under 3:00, 1920x1080, 30 fps, H.264 + AAC) is built from three things:

| Part | Where | Made by |
|---|---|---|
| The script: scenes, narration, which clip each scene plays, on-screen facts | [`project/demo.json`](project/demo.json) (demoday's manifest schema) | by hand; the transcript with measured lengths is [`project/SCRIPT.md`](project/SCRIPT.md) (generated) |
| The voice-over: one MP3 and one word-timings file per scene | `project/audio/<scene>.mp3`, `<scene>.words.json` (committed, about 2 MB) | Kokoro-82M on the CPU, [`voice/kokoro_tts.py`](voice/kokoro_tts.py) |
| The screen clips, one per shot of [`docs/DEMO.md`](../docs/DEMO.md) | `project/clips/*.mp4` (gitignored) | `npm run clips` at the repo root ([`clips/README.md`](clips/README.md)) records into `video/clips/`; the render hard-links each clip it needs from there into `project/clips/` when it is not there yet (an edited clip already in `project/clips/` is kept) |

[`remotion/`](remotion/) composes them: demoday's Remotion template, restyled in the Shelfie brand ([`docs/DESIGN.md`](../docs/DESIGN.md): white page, ink `#111214`, one pomegranate accent `#c21a4b`, Figtree embedded in the bundle, no gradients, glow or glass), with captions burned in from the word timings.

The render step normalises the mix to -14 LUFS integrated with true peak at or below -1 dBTP (two ffmpeg `loudnorm` passes, the video stream copied; `--no-loudnorm` skips it).

Outputs (in `out/`, gitignored): `out/shelfie-demo.mp4`, `out/poster.png`, `out/shelfie-demo.srt`. The SRT is also written to [`shelfie-demo.srt`](shelfie-demo.srt), which is committed.

## Setup

```bash
# Remotion (its own package; the app's node_modules are not used)
cd video/remotion && npm ci

# Kokoro-82M, once (Python 3.12; the venv is about 1.6 GB with CPU-only torch, the model and voices about 0.3 GB)
python3 -m venv video/.venv
video/.venv/bin/pip install --extra-index-url https://download.pytorch.org/whl/cpu torch "kokoro==0.9.4" soundfile   # tested: torch 2.15.0+cpu, kokoro and misaki 0.9.4
# the model and voices download into HF_HOME on first use (video/models/, gitignored)
```

`ffmpeg` and `ffprobe` must be on the PATH. No API key and no network service is used: the voice is synthesised locally, nothing is sent to fal.ai or ElevenLabs.

## Regenerate the voice

```bash
cd video/remotion
npm run voice        # every changed line -> ../project/audio/, durations into demo.json, then SCRIPT.md and the SRT
npm run voice:pick   # the same two sentences in four voices -> ../out/voices/ (af_heart, am_michael, bf_emma, bm_george)
```

`npm run voice` runs `../.venv/bin/python -I ../voice/kokoro_tts.py ../project/demo.json` with `HF_HOME=../models`; set `KOKORO_PYTHON` and `HF_HOME` to use a venv elsewhere (absolute paths, e.g. from a git worktree to the main checkout's `video/.venv/bin/python` and `video/models`). One line only: `python -I ../voice/kokoro_tts.py ../project/demo.json --line review`. A line is re-spoken only when its text, voice, speed or model changes (`--force` re-speaks it anyway). It synthesises a little faster than real time on this VM's CPU (the voice pick: 8 s of speech in 6 to 7 s).

The voice is set in `demo.json`: `"voice": { "provider": "kokoro", "voice": "af_heart", "lang": "a", "speed": 1 }` (`lang` "a" is American English, "b" British). Each scene's `durationSec` is its measured narration + 0.45 s (`pacing.breathSec`) + the transition after it + its `holdSec` (extra screen time after the line). If the cut runs long, cut words, not speed.

The words files have demoday's `tts.mjs` shape (`{ text, voice, model, timestamps: [{ text, startSec, endSec }] }`), from Kokoro's own token timestamps, so demoday's tools read them unchanged.

## Render

```bash
cd video/remotion
npm run render                                  # the whole video, the poster and the SRT
npm run render:animatic                         # clips not recorded yet drawn as labelled placeholders -> ../out/animatic.mp4
node scripts/render.mjs --only problem,snap     # a test cut of some scenes -> ../out/test-problem+snap.mp4 (+ .png, .srt)
node scripts/render.mjs --frames 0-449 --out ../out/test.mp4 --no-poster
npm run studio                                  # Remotion Studio on the current demo.json
npm run srt                                     # only the subtitles
npm run script                                  # only SCRIPT.md
```

A full render takes several minutes; run one render at a time (and never beside a clip recording or a full e2e run). `--concurrency` defaults to 2 render tabs.

## demo.json, what Shelfie adds to demoday's schema

- `screen` on each scene: the shot it plays over (DEMO.md's shot table and the clip). Placeholders and SCRIPT.md show it.
- `beat`: the story beat (1 to 6) it belongs to.
- `holdSec`: screen time after the line ends, added to `durationSec` by the voice step.
- `onScreen`: sourced facts or quotes over the footage, `{ text, source, from, to, extraSec }`; `from` / `to` are spoken phrases (matched in the scene's word timings), or give `fromSec` / `toSec`.
- `captionPlacement: "top"` puts that scene's captions at the top (when the screen's bottom edge matters).
- To fit a long clip to its line: `videoStartSec` and `playbackRate` on the scene, or demoday's `beats` (`[{ "atSec": 0, "shot": "screen", "videoStartSec": 2 }, { "atSec": 4, "shot": "screen", "videoStartSec": 14, "playbackRate": 2 }]`) for jump cuts. A clip shorter than its scene holds its last frame.
- `poster: { scene, atSec }`: the poster frame (default: the end card, 2 s in).
- `slide: "title" | "end"` on a card scene picks its slide layout; `burnCaptions: false` keeps a scene's captions out of the picture (they stay in the SRT) where the slide already shows the spoken words; `emphasis` on a card or a `statement` item sets that substring in pomegranate.

## The slide system (run 8)

Every non-recording frame is drawn in the public site's band language (`docs/DESIGN.md` "The public site"), from shared parts in [`remotion/src/components/slides/kit.jsx`](remotion/src/components/slides/kit.jsx): the site's palette (pomegranate, blush, charcoal, ink), the hero's wave as a band edge, white cards with the ink-tinted lift, arrows that draw out of a clipped slot, the hand-drawn accent marks, the drawn Awning lockup (never "shelfie" set in Figtree) and PayPal's official logo files (`project/assets/paypal/`, unmodified, full colour on white only, 120 px wide or more). Motion is one exponential ease-out (`beat()`), transform and opacity only.

| Slide | Where | What |
|---|---|---|
| Title | `scenes/Card.jsx`, `slide: "title"` | the lockup, "Hi there! / Welcome to **Shelfie.**" at 146 px, and the hero's four-step chain (paper menu photo, live shop, assistant order, PayPal paid) landing card by card on a pomegranate wave band |
| Statistic | `components/OnScreenText.jsx` | a pomegranate panel slides over the left of the problem clip: the figure at 300 px, the sentence, the source in blush |
| Statement | `OnScreenText.jsx`, `variant: "statement"` | a blush band rises over the clip with the wave; the line at 156 px, its `emphasis` in pomegranate |
| Chapter bar | `components/ChapterBar.jsx` | the site header's look: lockup, the three steps in fixed slots (done steps ticked), the current one in a pomegranate pill that slides from the previous step's slot when the step changes |
| Architecture | `scenes/Architecture.jsx`, `kind: "architecture"` | six white cards on blush snaking in two rows (photo, Claude reads it, PayPal catalog, agent door, PayPal orders and payment, Claude brief via the PayPal Agent Toolkit); each lights on its spoken phrase (`NODES[].cue`, matched in the word timings) and the photo lifts on "A sheet of paper" |
| End | `Card.jsx`, `slide: "end"` | the lockup, the line with "AI shoppers." in pomegranate, "Thanks for watching!", and a charcoal band: Built with [PayPal logo on a white chip] and Claude |

Slide content stays above y = 880 wherever captions burn in (the caption box sits at the bottom); the on-screen layer draws under the captions. Preview stills: `docs/preview/video-title.png`, `video-stat.png`, `video-statement.png`, `video-chapter.png`, `video-architecture.png`, `video-end.png`.

Captions use the "shelfie" style: phrases of at most about 50 characters, split at sentence ends and balanced at commas ([`remotion/src/lib/phrases.js`](remotion/src/lib/phrases.js), shared with the SRT writer), white Figtree 600 at 42 px on a solid ink box, inside the 90% title-safe area.
