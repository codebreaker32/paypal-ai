#!/usr/bin/env node
/**
 * Subtitles for the finished video, from the same phrases the burned-in
 * captions show (src/lib/phrases.js) on the same timeline (scene starts as
 * DemoVideo.jsx lays them out, transitions included).
 *
 *   node scripts/srt.mjs [--manifest ../project/demo.json] [--only a,b] [--out file.srt]
 *
 * Default outputs: ../out/shelfie-demo.srt and the committed copy ../shelfie-demo.srt.
 * With --only (a test cut) only --out, or ../out/<scenes>.srt, is written.
 */
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { APP_DIR, DEFAULT_MANIFEST, buildProps, parseArgs, sceneStarts } from "./build-props.mjs";
import { groupPhrases } from "../src/lib/phrases.js";

const stamp = (sec) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
};

export function srtFromProps(props) {
  const { starts, fps } = sceneStarts(props);
  const cues = [];
  for (const { scene, from, frames } of starts) {
    if (!scene.wordTimings?.length || props.captions?.enabled === false) continue;
    const t0 = from / fps;
    const end = (from + frames) / fps;
    for (const p of groupPhrases(scene.wordTimings)) {
      cues.push({ start: t0 + p.showSec, end: Math.min(end, t0 + p.hideSec), text: p.text });
    }
  }
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join("\n");
}

export async function writeSrt({ manifestPath = DEFAULT_MANIFEST, only = null, out = null, placeholders = true } = {}) {
  const { props } = await buildProps({ manifestPath, only, placeholders });
  const srt = srtFromProps(props);
  const outDir = path.resolve(APP_DIR, "..", "out");
  const files = out
    ? [path.resolve(out)]
    : only
      ? [path.join(outDir, `${String(only).replace(/[^a-z0-9,-]/gi, "").replace(/,/g, "+")}.srt`)]
      : [path.join(outDir, "shelfie-demo.srt"), path.resolve(APP_DIR, "..", "shelfie-demo.srt")];
  for (const f of files) {
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, srt);
  }
  return { files, cues: srt ? srt.split("\n\n").length : 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const r = await writeSrt({
      manifestPath: args.manifest ? path.resolve(args.manifest) : DEFAULT_MANIFEST,
      only: args.only || null,
      out: typeof args.out === "string" ? args.out : null,
    });
    console.log(`  ${r.cues} cue(s) -> ${r.files.map((f) => path.relative(process.cwd(), f)).join(", ")}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
