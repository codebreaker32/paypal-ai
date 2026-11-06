// Re-align demo.json cut points to a new take: for each beat, the old clip's frame at videoStartSec is found in the new clip
// (96x54 grey frames at 10 fps, least mean absolute difference). Prints old -> new; a high diff (a terminal clip) needs a look.
// usage: node video/tools/align-cuts.mjs video/project/demo.json <oldClipsDir> <newClipsDir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [demo, oldDir, newDir] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(demo, 'utf8'));
const W = 96, H = 54, FPS = 10, N = W * H;
const cache = {};
const frames = (f) => cache[f] ??= execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `fps=${FPS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
const diff = (a, ai, b, bi) => { let s = 0; for (let k = 0; k < N; k++) s += Math.abs(a[ai * N + k] - b[bi * N + k]); return s / N; };
for (const s of d.timeline) {
  if (!s.video) continue;
  const name = s.video.split('/').pop();
  const o = frames(`${oldDir}/${name}`), n = frames(`${newDir}/${name}`);
  const on = o.length / N, nn = n.length / N;
  const beats = s.beats ?? [{ atSec: 0, videoStartSec: s.videoStartSec ?? 0 }];
  for (const b of beats) {
    const oi = Math.min(on - 1, Math.round((b.videoStartSec ?? 0) * FPS));
    let best = 1e9, bi = 0, second = 1e9;
    for (let i = 0; i < nn; i++) { const v = diff(o, oi, n, i); if (v < best) { second = best; best = v; bi = i; } else if (v < second) second = v; }
    console.log(`${s.id}\tat ${b.atSec}\told ${b.videoStartSec ?? 0}\tnew ${(bi / FPS).toFixed(1)}\tdiff ${best.toFixed(1)}\t(old len ${(on / FPS).toFixed(1)} new ${(nn / FPS).toFixed(1)})`);
  }
}
