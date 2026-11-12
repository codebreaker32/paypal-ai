#!/usr/bin/env node
/**
 * video/project/SCRIPT.md from demo.json: the full transcript, what the screen
 * shows, and each scene's measured narration and scene length, so the script
 * never lags the manifest. Run after the voice step (npm run voice).
 *
 *   node scripts/script-md.mjs [--manifest ../project/demo.json]
 */
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { DEFAULT_MANIFEST, parseArgs, sceneStarts } from "./build-props.mjs";

const args = parseArgs(process.argv.slice(2));
const manifestPath = args.manifest ? path.resolve(args.manifest) : DEFAULT_MANIFEST;
const m = JSON.parse(await readFile(manifestPath, "utf8"));
const ids = new Set(m.timeline.map((s) => s.id));
const props = { format: m.format, timeline: m.timeline, transitions: (m.transitions || []).filter((t) => ids.has(t.after) && t.after !== m.timeline.at(-1).id) };
const { starts, totalFrames, fps } = sceneStarts(props);
const mmss = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, "0")}`;
const speech = m.timeline.reduce((n, s) => n + (s.narrationSec || 0), 0);
const words = m.timeline.reduce((n, s) => n + (s.narration ? s.narration.split(/\s+/).length : 0), 0);
const BEATS = {
  1: "The problem: who it's for and why now",
  2: "Snap a paper menu; the shop goes live with photos",
  3: "Claude Code, given only the shop's URL, finds the agent door and orders",
  4: "The buyer approves on PayPal",
  5: "The seller's dashboard: paid, the AI brief, tracking",
  6: "Why it matters, and close",
};

const rows = starts.map(({ scene, from, frames }) =>
  `| ${scene.id} | ${scene.beat ?? ""} | ${mmss(from / fps)} | ${scene.narrationSec ? scene.narrationSec.toFixed(2) : "-"} | ${(frames / fps).toFixed(2)} |`);

let body = `# Shelfie demo video: script

_Generated from \`demo.json\` by \`video/remotion/scripts/script-md.mjs\`; do not edit by hand. Voice: Kokoro-82M \`${m.voice?.voice}\` (lang \`${m.voice?.lang}\`, speed ${m.voice?.speed ?? 1}). Every spoken claim comes from the demo script in \`video/project/demo.json\`._

**Runtime ${mmss(totalFrames / fps)}** (${(totalFrames / fps).toFixed(2)} s): ${speech.toFixed(2)} s of narration (${words} words), the rest is the ${m.pacing?.breathSec ?? 0.45} s breath after each line, per-scene holds for the screen (\`holdSec\`), the end card and ${(m.transitions || []).length} transition(s).

| Scene | Beat | Starts | Narration (s) | Scene (s) |
|---|---|---|---|---|
${rows.join("\n")}

`;
let beat = null;
for (const s of m.timeline) {
  if (s.beat !== beat) {
    beat = s.beat;
    body += `## Beat ${beat}: ${BEATS[beat] || ""}\n\n`;
  }
  body += `### ${s.id}${s.narrationSec ? ` (${s.narrationSec.toFixed(2)} s voice, ${s.durationSec.toFixed(2)} s scene)` : ` (${s.durationSec} s, no voice)`}\n\n`;
  body += `**Screen:** ${s.screen || s.note || ""}\n\n`;
  if (s.narration) body += `> ${s.narration}\n\n`;
  for (const o of s.onScreen || []) body += `On-screen text: "${o.text}" (${o.source})\n\n`;
  if (s.kind === "card") body += `Card: **${s.title}**, "${s.subtitle}"${s.cta ? `, "${s.cta}"` : ""}\n\n`;
}

const out = path.join(path.dirname(manifestPath), "SCRIPT.md");
await writeFile(out, body);
console.log(`  ${m.timeline.length} scenes, ${mmss(totalFrames / fps)} -> ${path.relative(process.cwd(), out)}`);
