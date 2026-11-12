# Edit tools

Small helpers to cut `video/project/demo.json` against recorded clips. They read clips and renders; none records the screen or calls a service.

- `edit_beats.py <demo.json>`: re-applies the whole edit (each scene's beats, rates and caption placement); change the numbers there.
- `check_beats.py <demo.json> <clips dir>`: prints each beat's clip window and any frozen tail (a clip shorter than its beat).
- `changes.sh <clip> [threshold]`: a clip's scene-change times (ffmpeg), to compare a new take with the offsets the edit assumes.
- `at_frames.sh`, `vid_frames.sh`, `frames.sh`, `sheet.sh`, `render_sheet.sh`, `pair.sh`, `at.sh`, `tail.sh`, `probe.sh`: exact frames or contact sheets from a clip or a render at given times, and ffprobe summaries.

Judge sync from exact frames at the spoken words, not from 2-second contact sheets (a frame can sit up to 1 s after its label).
