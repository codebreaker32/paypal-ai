#!/usr/bin/env node
// Render stills of the current props at scene-relative times, for a quick look without a full render.
//   node ../tools/stills.mjs <outDir> scene:sec [scene:sec ...]     (run from video/remotion after build-props)
import { readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { sceneStarts } from "../remotion/scripts/build-props.mjs";
const [outDir, ...picks] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const props = JSON.parse(readFileSync("src/props.json", "utf8"));
const { starts, fps } = sceneStarts(props);
for (const pick of picks) {
  const [id, sec] = pick.split(":");
  const st = starts.find((s) => s.scene.id === id);
  if (!st) { console.error(`no scene ${id}`); continue; }
  const frame = st.from + Math.round(Number(sec) * fps);
  const file = path.resolve(outDir, `${id}-${sec}.png`);
  const r = spawnSync("npx", ["remotion", "still", "src/index.jsx", "DemoVideo", file, "--props", "src/props.json",
    "--public-dir", "../project", "--frame", String(frame), "--log", "error", "--timeout", "120000"], { stdio: "inherit" });
  console.log(r.status === 0 ? `  ${file}` : `  failed ${pick}`);
}
