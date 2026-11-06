#!/usr/bin/env node
/**
 * Render Shelfie's demo video: props from demo.json, the Remotion render
 * (1920x1080, 30 fps, H.264 + AAC), the poster frame and the subtitles.
 *
 *   node scripts/render.mjs                         # the full video
 *   node scripts/render.mjs --placeholders          # animatic: missing clips drawn as labelled placeholders
 *   node scripts/render.mjs --only problem,snap     # a short test cut of some scenes
 *   node scripts/render.mjs --frames 0-449          # only these frames (Remotion's --frames)
 *   node scripts/render.mjs --out ../out/test.mp4 --no-poster
 *
 * Outputs (gitignored): ../out/shelfie-demo.mp4 and ../out/poster.png; the SRT
 * goes to ../out/shelfie-demo.srt and the committed ../shelfie-demo.srt (a test
 * cut writes ../out/<scenes>.srt only). The poster is demo.json's
 * `poster: { scene, atSec }` (default: the end card, 2 s in).
 * Run one render at a time; Remotion uses every core.
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { APP_DIR, buildProps, parseArgs, sceneStarts, writeProps, probeSec, DEFAULT_MANIFEST } from "./build-props.mjs";
import { writeSrt } from "./srt.mjs";

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: APP_DIR, stdio: "inherit" });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args[1]} exited ${code}`))));
  });

const args = parseArgs(process.argv.slice(2));
const manifestPath = args.manifest ? path.resolve(args.manifest) : DEFAULT_MANIFEST;
const only = typeof args.only === "string" ? args.only : null;

try {
  const { props, projectDir, manifest, warnings } = await buildProps({ manifestPath, placeholders: !!args.placeholders, only });
  for (const w of warnings) console.warn(`  warning: ${w}`);
  const propsFile = await writeProps(props);
  const { starts, totalFrames, fps } = sceneStarts(props);
  console.log(`  ${props.timeline.length} scene(s), ${(totalFrames / fps).toFixed(2)} s (${totalFrames} frames)`);

  const outDir = path.resolve(APP_DIR, "..", "out");
  const defaultName = only ? `test-${only.replace(/[^a-z0-9,-]/gi, "").replace(/,/g, "+")}.mp4` : "shelfie-demo.mp4";
  const outFile = path.resolve(typeof args.out === "string" ? args.out : path.join(outDir, defaultName));
  await mkdir(path.dirname(outFile), { recursive: true });

  // A long delayRender timeout: on a busy machine a tab can take a while to load the fonts and clips.
  const common = ["--props", propsFile, "--public-dir", projectDir, "--log", args.verbose ? "verbose" : "info",
    "--timeout", String(args.timeout || 120000)];
  const renderArgs = ["remotion", "render", "src/index.jsx", "DemoVideo", outFile, ...common,
    "--codec", "h264", "--audio-codec", "aac", "--crf", String(args.crf || 18), "--pixel-format", "yuv420p"];
  if (typeof args.frames === "string") renderArgs.push("--frames", args.frames);
  renderArgs.push("--concurrency", String(args.concurrency || 2));
  await run("npx", renderArgs);

  if (!args["no-poster"]) {
    const pick = manifest.poster || { scene: "end", atSec: 2 };
    const at = starts.find((s) => s.scene.id === pick.scene) || starts.at(-1);
    const frame = Math.min(totalFrames - 1, at.from + Math.round((pick.atSec ?? 2) * fps));
    const poster = only ? outFile.replace(/\.mp4$/i, ".png") : path.join(outDir, "poster.png");
    await run("npx", ["remotion", "still", "src/index.jsx", "DemoVideo", poster, ...common, "--frame", String(frame)]);
    console.log(`  poster (frame ${frame}) -> ${poster}`);
  }

  // Only a full render of the real manifest refreshes the committed SRT; a test
  // cut (--only, --frames, --out or another manifest) writes its SRT beside its MP4.
  const fullCut = !only && typeof args.frames !== "string" && typeof args.out !== "string" && manifestPath === DEFAULT_MANIFEST;
  const srt = await writeSrt({ manifestPath, only, out: fullCut ? null : outFile.replace(/\.mp4$/i, ".srt") });
  const dur = probeSec(outFile);
  console.log(`  done: ${outFile} (${dur?.toFixed(2)} s); subtitles: ${srt.files.join(", ")}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
