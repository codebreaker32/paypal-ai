#!/usr/bin/env python3
"""Narration for the demo video with Kokoro-82M, on the CPU, offline.

A drop-in for demoday's ``scripts/gen/tts.mjs`` (which needs fal.ai or ElevenLabs):
it writes the same artifacts in the same shape, so demoday's renderer, captions
and our SRT writer work unchanged. From the repo root:

    HF_HOME=video/models \\
      video/.venv/bin/python -I video/voice/kokoro_tts.py \\
      video/project/demo.json [--line <scene-id>]... [--force]

For every scene with ``narration`` (or only the ``--line`` ones) it writes, next to
the manifest:

  audio/<scene-id>.mp3         mono, 44.1 kHz (ffmpeg)
  audio/<scene-id>.words.json  {"text", "voice", "model", "provider", "cacheKey",
                                "timestamps": [{"text", "startSec", "endSec"}]}

and updates the scene in the manifest the way tts.mjs does: ``audio``, ``words``,
``narrationSec`` (the mp3's measured length) and ``durationSec`` (narration +
the following transition + ``pacing.breathSec``, default 0.45 s; see demoday's
``lib/pacing.mjs``). A line whose text, voice, speed and model are unchanged is
not re-synthesised (``cacheKey`` in its words file) unless ``--force``.

The voice is ``voice.voice`` in the manifest (a Kokoro voice id such as
``af_heart``); ``voice.lang`` is Kokoro's language code ("a" American English,
"b" British English), inferred from the voice id's first letter when absent;
``voice.speed`` defaults to 1.0. Word timings are Kokoro's own token timestamps
(``MToken.start_ts`` / ``end_ts``), with punctuation folded into its word.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

SR = 24000  # Kokoro's output rate
MODEL = "hexgrad/Kokoro-82M"
DEFAULT_BREATH_SEC = 0.45


def transition_after_sec(manifest: dict, scene_id: str) -> float:
    for t in manifest.get("transitions") or []:
        if t.get("after") == scene_id:
            return (t.get("ms") if t.get("ms") is not None else 400) / 1000
    return 0.0


def breath_sec(manifest: dict) -> float:
    v = (manifest.get("pacing") or {}).get("breathSec")
    return float(v) if isinstance(v, (int, float)) else DEFAULT_BREATH_SEC


def scene_duration(manifest: dict, scene: dict, narration_sec: float) -> float:
    """demoday's sceneDuration: the line ends cleanly before the next one starts."""
    hold = float(scene.get("holdSec") or 0)  # optional extra hold on the last frame
    return round(narration_sec + transition_after_sec(manifest, scene["id"]) + breath_sec(manifest) + hold, 3)


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def words_from_tokens(tokens, offset: float) -> list[dict]:
    """Kokoro tokens -> words. A token with no whitespace before it (punctuation,
    a split contraction) is glued onto the previous word, so the caption reads
    exactly like the script."""
    words: list[dict] = []
    glue = False  # the previous token had no trailing whitespace
    for tok in tokens:
        text = tok.text or ""
        start = tok.start_ts
        end = tok.end_ts
        if words and glue:
            w = words[-1]
            w["text"] += text
            if end is not None:
                w["endSec"] = round(offset + end, 3)
        elif text.strip():
            s = start if start is not None else (words[-1]["endSec"] - offset if words else 0.0)
            e = end if end is not None else s
            words.append({"text": text, "startSec": round(offset + s, 3), "endSec": round(offset + e, 3)})
        glue = not (tok.whitespace or "")
    return [w for w in words if w["text"].strip()]


def synthesise(pipe, text: str, voice: str, speed: float):
    import numpy as np

    chunks, words, offset = [], [], 0.0
    for r in pipe(text, voice=voice, speed=speed):
        if r.audio is None:
            continue
        audio = r.audio.numpy()
        words += words_from_tokens(r.tokens or [], offset)
        chunks.append(audio)
        offset += len(audio) / SR
    if not chunks:
        raise RuntimeError(f"Kokoro returned no audio for: {text[:60]!r}")
    return np.concatenate(chunks).astype(np.float32), words


def encode_mp3(audio, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
         "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", str(out)],
        input=audio.tobytes(), check=True,
    )


def save_manifest(path: Path, m: dict) -> None:
    """Write demo.json atomically (temp file, then rename)."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n")
    tmp.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("manifest", type=Path, help="path to demo.json")
    ap.add_argument("--line", "--scene", action="append", dest="lines", default=[],
                    help="only this scene id (repeatable)")
    ap.add_argument("--force", action="store_true", help="re-synthesise even when unchanged")
    args = ap.parse_args()

    manifest_path = args.manifest.resolve()
    project = manifest_path.parent
    m = json.loads(manifest_path.read_text())
    v = m.get("voice") or {}
    voice = v.get("voice") or "af_heart"
    lang = v.get("lang") or voice[0]
    speed = float(v.get("speed") or 1.0)

    scenes = [s for s in m["timeline"] if s.get("narration")]
    if args.lines:
        known = {s["id"] for s in m["timeline"]}
        missing = [x for x in args.lines if x not in known]
        if missing:
            print(f"unknown scene id(s): {', '.join(missing)}", file=sys.stderr)
            return 2
        scenes = [s for s in scenes if s["id"] in args.lines]

    pipe = None
    total = 0.0
    for scene in scenes:
        text = scene["narration"].strip()
        key = hashlib.sha256(json.dumps([MODEL, voice, lang, speed, text]).encode()).hexdigest()[:16]
        mp3 = project / "audio" / f"{scene['id']}.mp3"
        words_file = mp3.with_suffix(".words.json")
        cached = False
        if not args.force and mp3.exists() and words_file.exists():
            try:
                cached = json.loads(words_file.read_text()).get("cacheKey") == key
            except ValueError:
                cached = False
        if not cached:
            if pipe is None:
                try:
                    from kokoro import KPipeline  # slow import: only when a line needs speaking
                except ImportError as e:
                    print(f"{e}. Run this with the Kokoro venv's Python (video/README.md), from the repo root:\n"
                          "  HF_HOME=video/models video/.venv/bin/python -I video/voice/kokoro_tts.py "
                          "video/project/demo.json", file=sys.stderr)
                    return 1
                pipe = KPipeline(lang_code=lang, repo_id=MODEL)
            audio, words = synthesise(pipe, text, voice, speed)
            encode_mp3(audio, mp3)
            words_file.write_text(json.dumps({
                "text": text, "voice": voice, "model": MODEL, "provider": "kokoro",
                "cacheKey": key, "timestamps": words,
            }, indent=2) + "\n")
        n = probe_duration(mp3)
        scene["audio"] = mp3.relative_to(project).as_posix()
        scene["words"] = words_file.relative_to(project).as_posix()
        scene["narrationSec"] = round(n, 3)
        scene["durationSec"] = scene_duration(m, scene, n)
        total += n
        # Saved after every line, so a failure later in the run leaves no stale
        # duration behind for the lines already spoken.
        save_manifest(manifest_path, m)
        print(f"  {scene['id']:<14} {'cached' if cached else 'spoken'} {n:6.2f} s speech, scene {scene['durationSec']:6.2f} s")

    timeline = m["timeline"]
    runtime = sum(s.get("durationSec") or 0 for s in timeline) - sum(
        transition_after_sec(m, s["id"]) for s in timeline[:-1])
    speech = sum(s.get("narrationSec") or 0 for s in timeline)
    print(f"  {len(scenes)} line(s) this run ({total:.2f} s); whole script: {speech:.2f} s speech, "
          f"{runtime:.2f} s video ({int(runtime // 60)}:{runtime % 60:05.2f}) with voice {voice}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
