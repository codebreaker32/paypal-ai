// Logo designer B: builds every concept's SVGs from hand-set geometry.
// Usage: node docs/judge/logo/tools-B/build.mjs   (writes docs/judge/logo/concepts/B/B{1,2,3}/*.svg)
// The wordmark is drawn here from strokes and arcs (no font): a geometric lowercase
// "shelfie" (x-height 100, ascender 150, no descenders), each part emitted as its own path.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const POM = '#c21a4b';
export const INK = '#141414';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'concepts', 'B');
const f = (n) => +n.toFixed(2);
const rad = (d) => (d * Math.PI) / 180;

// ---------- primitives (each returns path data) ----------
const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
const circle = (cx, cy, r) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0z`;
// A stroked elliptical arc as a filled outline; t increases clockwise on screen (SVG y-down).
function arc(cx, cy, rx, ry, w, t0, t1) {
  const P = (t, a, b) => `${f(cx + a * Math.cos(rad(t)))} ${f(cy + b * Math.sin(rad(t)))}`;
  const [ox, oy, ix, iy] = [rx + w / 2, ry + w / 2, rx - w / 2, ry - w / 2];
  const large = t1 - t0 > 180 ? 1 : 0;
  return `M${P(t0, ox, oy)}A${f(ox)} ${f(oy)} 0 ${large} 1 ${P(t1, ox, oy)}L${P(t1, ix, iy)}A${f(ix)} ${f(iy)} 0 ${large} 0 ${P(t0, ix, iy)}z`;
}
const arcEnd = (cx, cy, rx, ry, t) => [cx + rx * Math.cos(rad(t)), cy + ry * Math.sin(rad(t))];

// ---------- the wordmark ----------
// opts: w = stroke weight, round = round terminals, dot = 'circle' | 'square', gap = letter spacing
export function wordmarkParts(opts) {
  const { w, round = false, dot = 'circle', gap = 16 } = opts;
  const X = 100, ASC = 150;
  const R = (X - w) / 2;
  const ink = [], accent = [];
  const cap = (x, y) => round && ink.push(circle(x, y, w / 2));
  const stem = (x, yTop, yBot, capTop = true, capBot = true) => {
    ink.push(rect(x - w / 2, yTop, w, yBot - yTop));
    if (capTop) cap(x, yTop);
    if (capBot) cap(x, yBot);
  };
  let x = 0;
  const L = {
    s() {
      const rx = 44 - w / 2, ry = (X - w) / 4, cx = x + 44;
      const cy1 = -X + w / 2 + ry, cy2 = -w / 2 - ry;
      ink.push(arc(cx, cy1, rx, ry, w, 84, 335), arc(cx, cy2, rx, ry, w, -96, 155)); // lobes overlap at the spine
      if (round) { cap(...arcEnd(cx, cy1, rx, ry, 335)); cap(...arcEnd(cx, cy2, rx, ry, 155)); }
      return 88;
    },
    h() {
      const sx = x + w / 2, cx = sx + R, cy = -X + w / 2 + R;
      stem(sx, -ASC, 0);
      ink.push(arc(cx, cy, R, R, w, 180, 360));
      stem(cx + R, cy - 2, 0, false); // overlaps the arch: no hairline seam
      return 2 * R + w;
    },
    e() {
      const cx = x + 50, cy = -50;
      ink.push(arc(cx, cy, R, R, w, 38, 360));
      ink.push(rect(x + w / 2, cy - w * 0.42, 100 - w / 2, w * 0.84));
      if (round) cap(...arcEnd(cx, cy, R, R, 38));
      return 100;
    },
    l() { stem(x + w / 2, -ASC, 0); return w; },
    f() {
      const rf = 26, sx = x + w / 2, cx = sx + rf, cy = -ASC + w / 2 + rf;
      stem(sx, cy - 2, 0, false);
      ink.push(arc(cx, cy, rf, rf, w, 180, 285));
      if (round) cap(...arcEnd(cx, cy, rf, rf, 285));
      const bh = w * 0.84, bx0 = x - 8, bx1 = sx + 34;
      ink.push(rect(bx0, -X, bx1 - bx0, bh));
      if (round) { cap(bx0, -X + bh / 2); cap(bx1, -X + bh / 2); }
      return w + 34;
    },
    i() {
      stem(x + w / 2, -X, 0);
      const cy = -X - 24 - w * 0.6;
      if (dot === 'square') { const s = w * 1.25; accent.push(rect(x + w / 2 - s / 2, cy - s / 2, s, s)); }
      else if (dot === 'scallop') {
        // a single awning scallop: flat top, round belly
        const r = w * 0.8, cx = x + w / 2, ty = cy - r / 2;
        accent.push(`M${f(cx - r)} ${f(ty)}h${f(2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(-2 * r)} 0z`);
      } else ink.push(circle(x + w / 2, cy, w * 0.62));
      return w;
    },
  };
  const kern = { sh: 2, he: 0, el: 2, lf: 2, fi: -2, ie: 2 };
  const word = 'shelfie';
  for (let k = 0; k < word.length; k++) {
    const adv = L[word[k]]();
    x += adv + (k < word.length - 1 ? gap + (kern[word[k] + word[k + 1]] ?? 0) : 0);
  }
  if (round) x += 0;
  return { ink, accent, width: x, top: -ASC - (round ? w / 2 : 0), X, ASC };
}

const p = (d, fill) => `<path fill="${fill}" d="${d}"/>`;
const svg = (vb, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${extra}>${body}</svg>\n`;

// ---------- concepts ----------
// Each mark is drawn in a 64-unit box on a 4-unit grid (1 px at 16 px) using only two inks
// (accent + ink); "paper" areas are holes, so mono and reversed versions stay true.
export const concepts = {
  B1: {
    name: 'Awning',
    // a striped-free scalloped shop awning over the corners of a print: the shopfront is the photo
    mark(c) {
      const a = c.accent, k = c.ink;
      // awning: top band 4..60, three equal scallops (r = 56/6)
      const r = 28 / 3;
      const sc = (x) => `A${f(r)} ${f(r)} 0 0 1 ${f(x)} 18`;
      const awning = `M4 6H60V18${sc(60 - 2 * r)}${sc(60 - 4 * r)}${sc(4)}Z`;
      // the shopfront below is a photo print: side margins 6, a deep chin (the counter)
      const front = 'M11 18H53V61H11Z M16 18V47H48V18Z';
      return p(awning, a) + `<path fill="${k}" fill-rule="evenodd" d="${front}"/>`;
    },
    word: { w: 20, round: false, dot: 'scallop', gap: 15 },
    appBg: '#ffffff',
  },
  B2: {
    name: 'Propped print',
    // a snapshot print leaning on a shelf, next to a bun: products on a shelf, photographed
    mark(c) {
      const a = c.accent, k = c.ink;
      // the print: a portrait instant photo (28x38, chin 12), tipped back on the shelf
      // about its foot's left corner; a bun sits on the shelf to its left
      const print = `<path fill="${a}" fill-rule="evenodd" transform="rotate(-8 30 52)" d="M30 14h28v38H30z M34 18v20h20V18z"/>`;
      const shelf = p(rect(4, 52, 56, 8), k);
      const bun = p('M6 52a10 10 0 0 1 20 0z', a);
      return print + shelf + bun;
    },
    word: { w: 18, round: true, dot: 'circle', gap: 14 },
    appBg: '#ffffff',
  },
  B3: {
    name: 'On the shelf',
    // the wordmark stands on a pomegranate shelf; the i's dot is a snapshot square
    mark(c) {
      const a = c.accent, k = c.ink;
      // the mark is the wordmark's own "s" standing on the shelf, with the square "snapshot" dot
      const w = 11, X = 36, cx = 30, rx = 17 - w / 2, ry = (X - w) / 4;
      const cy1 = 52 - X + w / 2 + ry, cy2 = 52 - w / 2 - ry;
      const s = arc(cx, cy1, rx, ry, w, 84, 335) + arc(cx, cy2, rx, ry, w, -96, 155);
      const corners = 'M4 4H24V12H12V24H4Z M60 60H8V52H52V40H60Z';
      return p(s, k) + p(corners, a);
    },
    word: { w: 22, round: false, dot: 'square', gap: 16, shelf: true },
    appBg: '#ffffff',
  },
};

export const colours = {
  full: { accent: POM, ink: INK },
  reverse: { accent: POM, ink: '#ffffff' },
  mono: { accent: 'currentColor', ink: 'currentColor' },
  white: { accent: '#ffffff', ink: '#ffffff' },
};

export function markSvg(id, c = colours.full, size) {
  const extra = size ? ` width="${size}" height="${size}"` : '';
  return svg('0 0 64 64', concepts[id].mark(c), extra);
}

export function wordmarkSvg(id, c = colours.full, { shelf = false } = {}) {
  const o = concepts[id].word;
  const W = wordmarkParts(o);
  const pad = 2;
  let body = W.ink.map((d) => p(d, c.ink)).join('') + W.accent.map((d) => p(d, c.accent)).join('');
  let bottom = 2;
  if (shelf) {
    // the shelf: a plank under the baseline, overhanging both ends, with two bracket ticks
    // crop corners: top-left over the s; the bottom-right corner's long arm is the shelf
    // the whole word stands on, its upright the shelf's end bracket
    const t = 26, L = -44, Rr = W.width + 50, T = W.top - 30, arm = 130, up = 132, shelfL = -8;
    body += p(`M${f(L)} ${f(T)}h${arm}v${t}h${-arm + t}v${up - 30 - t}h${-t}z`, c.accent);
    body += p(`M${f(Rr)} ${t}H${f(shelfL)}v${-t}H${f(Rr - t)}v${-up + t}h${t}z`, c.accent);
    bottom = 28;
  }
  const x0 = shelf ? -44 - pad : -16 - pad;
  const top = shelf ? W.top - 30 : W.top;
  const w = (shelf ? W.width + 94 : W.width + 16) + 2 * pad;
  return { svg: svg(`${f(x0)} ${f(top - pad)} ${f(w)} ${f(bottom - top + 2 * pad)}`, body), w, h: bottom - top + pad };
}

export function lockupSvg(id, c = colours.full) {
  if (id === 'B3') return wordmarkSvg(id, c, { shelf: true });
  const o = concepts[id].word;
  const W = wordmarkParts(o);
  const body = W.ink.map((d) => p(d, c.ink)).join('') + W.accent.map((d) => p(d, c.accent)).join('');
  // mark sized to the ascender height (150) + 30, sitting on the baseline
  const m = 190 / 64, gap = 44;
  const mark = `<g transform="translate(0 ${f(-160)}) scale(${f(m)})">${concepts[id].mark(c)}</g>`;
  const word = `<g transform="translate(${f(190 + gap + 16)} 0)">${body}</g>`;
  const w = 190 + gap + 16 + W.width + 4;
  return { svg: svg(`-2 -164 ${f(w)} 196`, mark + word), w, h: 196 };
}

const BBOX = { B1: [4, 6, 60, 61], B2: [4, 10, 60, 60], B3: [4, 4, 60, 60] };
export function appIconSvg(id, { maskable = false } = {}) {
  // white tile, full-colour mark centred on its bounding box; the maskable one fits the
  // box's half-diagonal inside the central 80% circle (radius 204.8)
  const [x0, y0, x1, y1] = BBOX[id];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const s = maskable ? 204.8 / Math.hypot((x1 - x0) / 2, (y1 - y0) / 2) : (512 * 0.74) / Math.max(x1 - x0, y1 - y0);
  const tx = 256 - cx * s, ty = 256 - cy * s;
  const bg = maskable ? `<rect width="512" height="512" fill="#ffffff"/>` : `<rect width="512" height="512" rx="112" fill="#ffffff"/>`;
  return svg('0 0 512 512', `${bg}<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(s)})">${concepts[id].mark(colours.full)}</g>`);
}

const NOTES = {
  B1: '**Awning.** A scalloped shop awning over an instant-photo print: the print\'s deep chin is the shop counter and its window is the shopfront, so one snapshot becomes a shop, which is what Shelfie does with one photo of a price list.\nIt reads as a shop at 16 px (three scallops over a framed window), pomegranate awning over an ink print, no camera and no rounded app tile.',
  B2: '**Propped print.** An instant-photo print leaning on a shelf beside a bun: the goods, their snapshot and the shelf they sell from in one small still life.\nThe tilted print gives a silhouette no other app icon has, the shelf grounds it as retail, and the bun keeps it a small food seller rather than a photo app.',
  B3: '**On the shelf.** A wordmark-led logo: two pomegranate crop corners frame the lowercase "shelfie" like a snapshot, and the bottom corner\'s long arm is the shelf the letters stand on; the i\'s dot is a small square print.\nThe name is the logo (shelf + selfie in one frame), and the favicon is the wordmark\'s own "s" standing in the same two corners.',
};

export function writeAll() {
  for (const id of Object.keys(concepts)) {
    const dir = join(OUT, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'mark.svg'), markSvg(id));
    writeFileSync(join(dir, 'mark-mono.svg'), markSvg(id, colours.mono));
    writeFileSync(join(dir, 'wordmark.svg'), wordmarkSvg(id).svg);
    writeFileSync(join(dir, 'lockup.svg'), lockupSvg(id).svg);
    writeFileSync(join(dir, 'app-icon-512.svg'), appIconSvg(id));
    writeFileSync(join(dir, 'app-icon-maskable.svg'), appIconSvg(id, { maskable: true }));
    writeFileSync(join(dir, 'NOTE.md'), NOTES[id] + '\n');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeAll();
