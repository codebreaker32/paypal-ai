#!/usr/bin/env node
/**
 * demo.json -> src/props.json, the input of the Remotion composition.
 *
 *   node scripts/build-props.mjs [--manifest ../project/demo.json] [--placeholders] [--only a,b]
 *
 * A self-contained version of demoday's render/build-props.mjs for what Shelfie's
 * video uses (demo scenes with screen clips, card scenes, narration, captions),
 * so the video renders from this repo alone, without the demoday plugin.
 *
 * - Every path in the manifest is relative to the project directory, which is
 *   also Remotion's public dir (staticFile("clips/x.mp4")).
 * - Word timings (audio/<id>.words.json) are inlined as `wordTimings`.
 * - `onScreen` items may give `from` / `to` as a spoken phrase instead of
 *   `fromSec` / `toSec`; they are resolved here against the word timings.
 * - --placeholders: a demo scene whose clip is missing renders as a labelled
 *   placeholder instead of failing (an animatic of the whole cut).
 * - --only a,b: just those scenes (a short test render).
 */
import path from "node:path";
import { copyFileSync, existsSync, linkSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_MANIFEST = path.resolve(APP_DIR, "..", "project", "demo.json");

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

export function probeSec(file) {
  try {
    const s = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
    return Number(s.trim()) || null;
  } catch {
    return null;
  }
}

/**
 * `npm run clips` (repo root) records into video/clips/. A scene's clip lives at
 * video/project/clips/ (Remotion's public dir); when it is missing there but
 * recorded, hard-link it in (copy across filesystems). An existing project clip
 * (an edited or re-timed one) is never replaced.
 */
export function linkRecordedClip(projectDir, rel) {
  if (!rel || !rel.startsWith("clips/")) return;
  const dest = path.join(projectDir, rel);
  const src = path.resolve(projectDir, "..", rel);
  if (existsSync(dest) || !existsSync(src)) return;
  mkdirSync(path.dirname(dest), { recursive: true });
  try {
    linkSync(src, dest);
  } catch {
    copyFileSync(src, dest);
  }
  console.log(`  linked ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dest)}`);
}

const norm = (t) => String(t).toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** Start time (s) of the first occurrence of `phrase` in the words, or null. */
export function findPhrase(words, phrase, { end = false } = {}) {
  const target = String(phrase).split(/\s+/).map(norm).filter(Boolean);
  const toks = words.map((w) => norm(w.text));
  for (let i = 0; i + target.length <= toks.length; i++) {
    if (target.every((t, j) => toks[i + j] === t)) {
      return end ? words[i + target.length - 1].endSec : words[i].startSec;
    }
  }
  return null;
}

export async function buildProps({ manifestPath = DEFAULT_MANIFEST, placeholders = false, only = null } = {}) {
  const projectDir = path.dirname(path.resolve(manifestPath));
  const m = JSON.parse(await readFile(manifestPath, "utf8"));
  const problems = [];
  const warnings = [];
  const wanted = only ? new Set(String(only).split(",").map((x) => x.trim())) : null;
  const scenes = m.timeline.filter((s) => !wanted || wanted.has(s.id));
  if (wanted) {
    for (const id of wanted) if (!m.timeline.some((s) => s.id === id)) problems.push(`--only: no scene "${id}"`);
  }

  const timeline = [];
  for (const scene of scenes) {
    const out = { ...scene };
    if (scene.kind === "demo") {
      const abs = scene.video ? path.join(projectDir, scene.video) : null;
      linkRecordedClip(projectDir, scene.video);
      if (!abs || !existsSync(abs)) {
        if (placeholders) out.placeholder = true;
        else problems.push(`scene "${scene.id}": clip not found at ${scene.video} (record it, or render with --placeholders)`);
      } else {
        const dur = probeSec(abs);
        if (dur) out.clipSec = dur; // DemoClip holds the last frame past this
        const avail = dur ? (dur - (scene.videoStartSec || 0)) / (scene.playbackRate || 1) : null;
        if (!scene.beats?.length && avail != null && avail < (scene.durationSec || 0) - 0.05) {
          warnings.push(`scene "${scene.id}": the clip has ${avail.toFixed(2)} s from videoStartSec at playbackRate ` +
            `${scene.playbackRate || 1}, the scene runs ${scene.durationSec} s (its last frame is held)`);
        }
      }
    }
    if (scene.audio && !existsSync(path.join(projectDir, scene.audio))) {
      problems.push(`scene "${scene.id}": audio not found at ${scene.audio} (run the voice step)`);
    }
    let words = [];
    if (scene.words) {
      try {
        words = JSON.parse(await readFile(path.join(projectDir, scene.words), "utf8")).timestamps || [];
      } catch {
        warnings.push(`scene "${scene.id}": no word timings at ${scene.words}: no captions for it`);
      }
    }
    if (words.length && scene.captions !== false) out.wordTimings = words;
    if (scene.onScreen?.length) {
      out.onScreen = scene.onScreen.map((item, i) => {
        const r = { ...item };
        if (item.from != null) r.fromSec = findPhrase(words, item.from);
        if (item.to != null) r.toSec = findPhrase(words, item.to);
        if (item.until != null) r.toSec = findPhrase(words, item.until, { end: true });
        if (r.toSec != null && item.extraSec) r.toSec += item.extraSec;
        if ((item.from != null && r.fromSec == null) || ((item.to ?? item.until) != null && r.toSec == null)) {
          problems.push(`scene "${scene.id}" onScreen[${i}]: phrase not found in its narration`);
        }
        return r;
      });
    }
    // Shelfie: a beat may start on a spoken phrase (`at`) and play another clip (`video`).
    if (scene.beats?.length) {
      out.beats = scene.beats.map((b, i) => {
        const r = { ...b };
        if (b.at != null) {
          r.atSec = findPhrase(words, b.at);
          if (r.atSec == null) problems.push(`scene "${scene.id}" beats[${i}]: phrase "${b.at}" not found in its narration`);
          else r.atSec = Math.max(0, r.atSec - (b.leadSec ?? 0.15));
        }
        if (b.video) {
          linkRecordedClip(projectDir, b.video);
          const abs = path.join(projectDir, b.video);
          if (!existsSync(abs)) problems.push(`scene "${scene.id}" beats[${i}]: clip not found at ${b.video}`);
          else r.clipSec = probeSec(abs);
        }
        return r;
      });
    }
    // Shelfie: roadmap steps and summary rows appear on a spoken phrase.
    for (const key of ["steps", "rows"]) {
      if (!scene[key]?.length) continue;
      out[key] = scene[key].map((it, i) => {
        const r = { ...it };
        if (it.from != null) {
          r.fromSec = findPhrase(words, it.from);
          if (r.fromSec == null) problems.push(`scene "${scene.id}" ${key}[${i}]: phrase not found in its narration`);
        }
        return r;
      });
    }
    if (!out.durationSec) problems.push(`scene "${scene.id}": no durationSec (run the voice step)`);
    timeline.push(out);
  }

  const ids = new Set(timeline.map((s) => s.id));
  const last = timeline.at(-1)?.id;
  const transitions = (m.transitions || []).filter((t) => ids.has(t.after) && t.after !== last);

  if (problems.length) throw new Error(`Cannot render yet:\n  - ${problems.join("\n  - ")}`);
  return {
    props: {
      slug: m.slug,
      format: m.format,
      brand: m.brand,
      style: null,
      presenter: { mode: "none" },
      music: m.music,
      captions: m.captions,
      watermark: null,
      cover: null,
      intro: m.intro && (!wanted || wanted.has(m.timeline[0]?.id)) ? m.intro : null,
      sfx: null,
      sfxTrack: [],
      transitions,
      timeline,
    },
    manifest: m,
    projectDir,
    warnings,
  };
}

/** Each scene's start frame on the finished video (the same arithmetic as DemoVideo.jsx). */
export function sceneStarts(props) {
  const fps = props.format?.fps || 30;
  const f = (sec) => Math.max(1, Math.round(sec * fps));
  const byAfter = new Map((props.transitions || []).map((t) => [t.after, t]));
  const out = [];
  let cursor = 0;
  for (const [i, s] of props.timeline.entries()) {
    out.push({ scene: s, from: cursor, frames: f(s.durationSec || 0) });
    cursor += f(s.durationSec || 0);
    const t = byAfter.get(s.id);
    if (t && i < props.timeline.length - 1) cursor -= f((t.ms ?? 400) / 1000);
  }
  return { starts: out, totalFrames: cursor, fps };
}

export async function writeProps(props) {
  const file = path.join(APP_DIR, "src", "props.json");
  await writeFile(file, `${JSON.stringify(props, null, 2)}\n`);
  return file;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const { props, warnings } = await buildProps({
      manifestPath: args.manifest ? path.resolve(args.manifest) : DEFAULT_MANIFEST,
      placeholders: !!args.placeholders,
      only: args.only || null,
    });
    for (const w of warnings) console.warn(`  warning: ${w}`);
    const file = await writeProps(props);
    const { totalFrames, fps } = sceneStarts(props);
    console.log(`  ${props.timeline.length} scene(s), ${(totalFrames / fps).toFixed(2)} s -> ${path.relative(process.cwd(), file)}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
