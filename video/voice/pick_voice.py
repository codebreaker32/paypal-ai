#!/usr/bin/env python3
"""Voice pick: the same two narration sentences in a few Kokoro-82M voices. From the repo root:

    HF_HOME=video/models \
      video/.venv/bin/python -I video/voice/pick_voice.py [out_dir]

Writes <out_dir>/<voice>.mp3 (default video/out/voices/, gitignored) and prints
each clip's length. Listen to them side by side and set voice.voice (and
voice.lang) in video/project/demo.json.
"""
import subprocess
import sys
import time
from pathlib import Path

try:
    import numpy as np
    from kokoro import KPipeline
except ImportError as e:
    sys.exit(f"{e}. Run this with the Kokoro venv's Python (set up as in video/README.md), from the repo root:\n"
             "  HF_HOME=video/models video/.venv/bin/python -I video/voice/pick_voice.py")

SR = 24000
TEXT = (
    "AI assistants have started shopping for people. "
    "Rosa bakes from her kitchen, and she has a paper price list, not a website."
)
# lang_code 'a' = American English, 'b' = British English (Kokoro's grapheme-to-phoneme).
VOICES = [
    ("af_heart", "a"),    # American female
    ("am_michael", "a"),  # American male
    ("bf_emma", "b"),     # British female
    ("bm_george", "b"),   # British male
]


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "out" / "voices"
    out.mkdir(parents=True, exist_ok=True)
    pipes = {}
    for voice, lang in VOICES:
        if lang not in pipes:
            pipes[lang] = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
        pipe = pipes[lang]
        t0 = time.time()
        chunks = [r.audio.numpy() for r in pipe(TEXT, voice=voice) if r.audio is not None]
        audio = np.concatenate(chunks).astype(np.float32)
        mp3 = out / f"{voice}.mp3"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1",
             "-i", "pipe:0", "-ar", "44100", "-b:a", "160k", str(mp3)],
            input=audio.tobytes(), check=True,
        )
        print(f"{voice:12s} {len(audio) / SR:5.2f} s audio, "
              f"{time.time() - t0:5.1f} s to synthesise -> {mp3}", flush=True)


if __name__ == "__main__":
    main()
