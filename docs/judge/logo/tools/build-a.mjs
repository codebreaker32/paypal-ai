// Logo designer A: builds the three concepts' SVGs (mark, mono mark, wordmark, lockup, icons).
// Run: node docs/judge/logo/tools/build-a.mjs  (writes docs/judge/logo/concepts/A/A{1,2,3}/)
// Every shape is hand-placed geometry; the wordmark is stroked centre-line paths, no font.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'concepts', 'A');
const POM = '#c21a4b';
const INK = '#141414';
const f = (n) => +n.toFixed(2);

// ---------- wordmark geometry ----------
// Baseline y=0, x-height X, ascender A. W = stroke width. Paths are centre lines.
function wordmark({ W, X = 50, A = 76, gap, cap, tittle, shelf, fiBridge = false, fiShelf = false }) {
  const L = W / 2;
  const t = -X + L; // centre-line top of x-height strokes
  const b = cap === 'round' ? -L : 0;
  const tTop = cap === 'round' ? t : -X; // where stems start at x-height
  const asc = cap === 'round' ? -A + L : -A;
  const paths = [];
  const extras = [];
  let x = 0;
  const S = 30 + W * 0.55; // s width
  {
    const l = x + L, r = x + S - L, c = (l + r) / 2, m = (t + (cap === 'round' ? b : -L)) / 2;
    const bb = -L, k = (r - l) * 0.28;
    paths.push(
      `M${f(r - 0.5)} ${f(t + X * 0.13)}C${f(r - 2)} ${f(t + 1)} ${f(c + k)} ${f(t)} ${f(c)} ${f(t)}` +
        `C${f(l + k * 0.8)} ${f(t)} ${f(l)} ${f(t + X * 0.09)} ${f(l)} ${f((t + m) / 2)}` +
        `C${f(l)} ${f(m - X * 0.07)} ${f(l + k)} ${f(m - 0.6)} ${f(c)} ${f(m)}` +
        `C${f(r - k)} ${f(m + 0.6)} ${f(r)} ${f(m + X * 0.07)} ${f(r)} ${f((m + bb) / 2)}` +
        `C${f(r)} ${f(bb - X * 0.09)} ${f(r - k * 0.8)} ${f(bb)} ${f(c)} ${f(bb)}` +
        `C${f(c - k)} ${f(bb)} ${f(l + 2)} ${f(bb - 1)} ${f(l + 0.5)} ${f(bb - X * 0.13)}`,
    );
    x += S + gap;
  }
  const H = 30 + W * 0.8; // h width
  {
    const s = x + L, r = (H - W) / 2;
    paths.push(`M${f(s)} ${f(asc)}V${f(b)}M${f(s)} ${f(b)}V${f(t + r)}A${f(r)} ${f(r)} 0 0 1 ${f(s + 2 * r)} ${f(t + r)}V${f(b)}`);
    x += H + gap;
  }
  const E = 30 + W * 1.1;
  {
    const cx = x + E / 2, R = E / 2 - L, cy = -X / 2, a = (40 * Math.PI) / 180;
    paths.push(`M${f(cx - R)} ${f(cy)}H${f(cx + R)}A${f(R)} ${f(R)} 0 1 0 ${f(cx + R * Math.cos(a))} ${f(cy + R * Math.sin(a))}`);
    x += E + gap;
  }
  {
    paths.push(`M${f(x + L)} ${f(asc)}V${f(b)}`);
    x += W + gap;
  }
  const F = 20 + W * 0.6;
  let fiX;
  {
    const s = x + W * 0.9 + 2, r = 7 + W * 0.3;
    if (fiBridge) {
      // f's hook carries on over to become the i: one arch, a doorway between two stems
      fiX = s + 2 * r + 8;
      paths.push(`M${f(s)} ${f(b)}V${f(asc + r)}A${f(r)} ${f(r)} 0 0 1 ${f(s + r)} ${f(asc)}H${f(fiX - r)}`);
    } else {
      paths.push(`M${f(s)} ${f(b)}V${f(asc + r)}A${f(r)} ${f(r)} 0 0 1 ${f(s + r)} ${f(asc)}H${f(s + r + 4)}`);
    }
    x += F + gap;
    const barEnd = fiShelf ? x + W + 3 : s + W * 0.55 + 6;
    const barStart = fiShelf ? s - W * 0.55 - 7 : x - F - gap + (cap === 'round' ? L : 0);
    paths.push(`M${f(barStart)} ${f(-X + L)}H${f(barEnd)}`);
  }
  {
    const s = x + L;
    paths.push(`M${f(s)} ${f(tTop)}V${f(b)}`);
    const ty = -A + W * 0.15;
    if (tittle === 'square') extras.push({ kind: 'rect', x: s - W * 0.62, y: ty - 0.5, w: W * 1.24, h: W * 1.24, rx: W * 0.18, rot: 0 });
    if (tittle === 'tilt') extras.push({ kind: 'rect', x: s - W * 0.6, y: ty - 2, w: W * 1.2, h: W * 1.32, rx: W * 0.12, rot: -10 });
    if (tittle === 'shelf') extras.push({ kind: 'rect', x: s - W * 0.75, y: -X - 2.5 - W * 1.5, w: W * 1.5, h: W * 1.5, rx: W * 0.25, rot: 0 });
    if (tittle === 'dot') extras.push({ kind: 'circle', cx: s, cy: ty + W * 0.6, r: W * 0.62 });
    x += W + gap;
  }
  {
    const cx = x + E / 2, R = E / 2 - L, cy = -X / 2, a = (40 * Math.PI) / 180;
    paths.push(`M${f(cx - R)} ${f(cy)}H${f(cx + R)}A${f(R)} ${f(R)} 0 1 0 ${f(cx + R * Math.cos(a))} ${f(cy + R * Math.sin(a))}`);
    x += E;
  }
  if (shelf) extras.push({ kind: 'shelf', x: -4, w: x + 8, y: 6, h: shelf });
  return { paths, extras, width: x, top: -A, bottom: shelf ? 6 + shelf : 0, W, cap };
}

function wordmarkSvg(wm, { ink = INK, accent = POM, pad = 4, mono = false } = {}) {
  const x0 = -pad - 4, y0 = wm.top - pad, w = wm.width + 2 * pad + 8, h = wm.bottom - wm.top + 2 * pad;
  const acc = mono ? 'currentColor' : accent;
  const col = mono ? 'currentColor' : ink;
  const extras = wm.extras
    .map((e) =>
      e.kind === 'rect'
        ? `<rect x="${f(e.x)}" y="${f(e.y)}" width="${f(e.w)}" height="${f(e.h)}" rx="${f(e.rx)}" fill="${acc}"${e.rot ? ` transform="rotate(${e.rot} ${f(e.x + e.w / 2)} ${f(e.y + e.h / 2)})"` : ''}/>`
        : e.kind === 'circle'
          ? `<circle cx="${f(e.cx)}" cy="${f(e.cy)}" r="${f(e.r)}" fill="${acc}"/>`
          : `<rect x="${f(e.x)}" y="${f(e.y)}" width="${f(e.w)}" height="${f(e.h)}" rx="${f(e.h / 2)}" fill="${acc}"/>`,
    )
    .join('');
  return {
    vb: [x0, y0, w, h],
    body: `<path d="${wm.paths.join('')}" fill="none" stroke="${col}" stroke-width="${wm.W}" stroke-linecap="${wm.cap}" stroke-linejoin="round"/>${extras}`,
  };
}

const svg = (vb, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(' ')}"${extra}>${body}</svg>\n`;

// ---------- marks (64 x 64 grid) ----------
const marks = {
  // A1: a shelf caught in a viewfinder. Two top corners of a viewfinder, the bottom edge is a
  // shelf on two brackets, and on the shelf a jar and a loaf. Monoline.
  A1: (c) => {
    const ink = c.ink, acc = c.acc;
    return (
      `<path d="M8 23V12a4 4 0 0 1 4-4h10M42 8h10a4 4 0 0 1 4 4v11" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M5 47h54M14 47l5 7M50 47l-5 7" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M14 41.5V30a3.5 3.5 0 0 1 3.5-3.5h7A3.5 3.5 0 0 1 28 30v11.5z" fill="${acc}"/>` +
      `<rect x="13" y="17.5" width="16" height="5" rx="2.5" fill="${acc}"/>` +
      `<path d="M34 41.5v-2a11 10.5 0 0 1 22 0v2z" fill="${acc}"/>`
    );
  },
  // A2: an instant photo whose thick bottom border is the shelf: the picture shows goods
  // standing on its lower edge. Bold silhouette, tilted like a snap pinned to a wall.
  A2: (c) =>
    `<g transform="rotate(-9 32 33)">` +
    `<path fill-rule="evenodd" fill="${c.acc}" d="M14 5h36a5 5 0 0 1 5 5v46a5 5 0 0 1-5 5H14a5 5 0 0 1-5-5V10a5 5 0 0 1 5-5zM16 12v29h32V12z"/>` +
    `<path fill="${c.acc}" d="M20 43V29.5c0-2 1.2-3.6 2.8-4.4V18h4.4v7.1c1.6.8 2.8 2.4 2.8 4.4V43zM33.5 43V33a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v10z"/><rect x="34.5" y="24" width="12" height="3.5" rx="1.2" fill="${c.acc}"/>` +
    `</g>`,
  // A3: the wordmark's own "s" standing on its shelf, with the snapshot square as the i's dot.
  A3: (c) => {
    // f and i under one shelf: the f's crossbar runs on over the i, and the dot is a snapshot
    // square sitting on that shelf.
    const W = 9.5, L = W / 2;
    return (
      `<path d="M22 60V20a11 11 0 0 1 11-11h2" fill="none" stroke="${c.ink}" stroke-width="${W}"/>` +
      `<path d="M47 29.5V60" fill="none" stroke="${c.ink}" stroke-width="${W}"/>` +
      `<rect x="8" y="${29.5 - L}" width="${56 - 8}" height="${W}" rx="1" fill="${c.ink}"/>` +
      `<rect x="${47 - 7}" y="${29.5 - L - 2.5 - 14}" width="14" height="14" rx="2.5" fill="${c.acc}"/>`
    );
  },
};

const concepts = {
  A1: { lock: 1.35, wm: { W: 8, gap: 7, cap: 'round', tittle: 'square' }, full: { ink: INK, acc: POM }, tileBg: POM, tileFg: { ink: '#fff', acc: '#fff' } },
  A2: { lock: 1.2, wm: { W: 13, gap: 5, cap: 'butt', tittle: 'tilt' }, full: { ink: POM, acc: POM }, tileBg: POM, tileFg: { ink: '#fff', acc: '#fff' } },
  A3: { lock: 1.25, wm: { W: 10, gap: 6, cap: 'butt', tittle: 'shelf', fiShelf: true }, full: { ink: INK, acc: POM }, tileBg: '#ffffff', tileFg: { ink: INK, acc: POM } },
};

for (const [id, c] of Object.entries(concepts)) {
  const dir = join(OUT, id);
  mkdirSync(dir, { recursive: true });
  const markFull = marks[id](c.full);
  const markMono = marks[id]({ ink: 'currentColor', acc: 'currentColor' });
  writeFileSync(join(dir, 'mark.svg'), svg([0, 0, 64, 64], markFull));
  writeFileSync(join(dir, 'mark-mono.svg'), svg([0, 0, 64, 64], markMono, ' fill="currentColor"'));
  const wm = wordmark(c.wm);
  const w = wordmarkSvg(wm);
  writeFileSync(join(dir, 'wordmark.svg'), svg(w.vb, w.body));
  const wMono = wordmarkSvg(wm, { mono: true });
  writeFileSync(join(dir, 'wordmark-mono.svg'), svg(wMono.vb, wMono.body));
  // lockup: mark height = cap-ish height of the word (ascender to baseline + a little)
  const markH = (wm.bottom - wm.top) * c.lock;
  const s = markH / 64;
  const mx = w.vb[0] - markH - 18;
  const my = wm.top - (markH - (wm.bottom - wm.top)) / 2;
  const lock = (mk, body) =>
    `<g transform="translate(${f(mx)} ${f(my)}) scale(${f(s)})">${mk}</g>${body}`;
  const lvb = [mx - 4, my - 4, w.vb[0] + w.vb[2] - mx + 8, markH + 8];
  writeFileSync(join(dir, 'lockup.svg'), svg(lvb, lock(markFull, w.body)));
  writeFileSync(join(dir, 'lockup-mono.svg'), svg(lvb, lock(markMono, wMono.body)));
  // app icon (512) and maskable (512, content inside the central 80% circle)
  const icon = (scale) => {
    const size = 512 * scale;
    const o = (512 - size) / 2;
    return `<rect width="512" height="512" fill="${c.tileBg}"/><g transform="translate(${f(o)} ${f(o)}) scale(${f(size / 64)})">${marks[id](c.tileFg)}</g>`;
  };
  writeFileSync(join(dir, 'icon-512.svg'), svg([0, 0, 512, 512], `<clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath><g clip-path="url(#r)">${icon(0.74)}</g>`));
  writeFileSync(join(dir, 'icon-maskable.svg'), svg([0, 0, 512, 512], icon(0.56)));
}
console.log('built', Object.keys(concepts).join(', '));
