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
      ink.push(arc(cx, cy1, rx, ry, w, 90, 335), arc(cx, cy2, rx, ry, w, -90, 155));
      if (round) { cap(...arcEnd(cx, cy1, rx, ry, 335)); cap(...arcEnd(cx, cy2, rx, ry, 155)); }
      return 88;
    },
    h() {
      const sx = x + w / 2, cx = sx + R, cy = -X + w / 2 + R;
      stem(sx, -ASC, 0);
      ink.push(arc(cx, cy, R, R, w, 180, 360));
      stem(cx + R, cy, 0, false);
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
      stem(sx, cy, 0, false);
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
      else ink.push(circle(x + w / 2, cy, w * 0.62));
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
    word: { w: 20, round: false, dot: 'circle', gap: 15 },
    appBg: '#ffffff',
  },
  B2: {
    name: 'Propped print',
    // a snapshot print leaning on a shelf, next to a bun: products on a shelf, photographed
    mark(c) {
      const a = c.accent, k = c.ink;
      // the print: outer 30x36, window inset 4 (sides/top) and 10 at the chin; rotated about its foot
      const print = `<path fill="${a}" fill-rule="evenodd" transform="rotate(-10 8 50)" d="M8 12h32v38H8z M13 17v21h22V17z"/>`;
      const shelf = p(rect(2, 50, 60, 8), k);
      const bun = p('M42 50a9 9 0 0 1 18 0z', a);
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
      const s = arc(cx, cy1, rx, ry, w, 90, 335) + arc(cx, cy2, rx, ry, w, -90, 155);
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
    // crop corners: top-left above the s, bottom-right under "fie" (letters stand on its arm)
    const t = 16, L = -40, Rr = W.width + 34, T = W.top - 26, arm = 130, up = 80;
    body += p(`M${f(L)} ${f(T)}h${arm}v${t}h${-arm + t}v${up - t}h${-t}z`, c.accent);
    body += p(`M${f(Rr)} ${t}h${-W.width * 0.5}v${-t}h${W.width * 0.5 - t}v${-up + t}h${t}z`, c.accent);
    bottom = t + 2;
  }
  const x0 = shelf ? -40 - pad : -16 - pad;
  const top = shelf ? W.top - 26 : W.top;
  const w = (shelf ? W.width + 74 : W.width + 16) + 2 * pad;
  return { svg: svg(`${f(x0)} ${f(top - pad)} ${f(w)} ${f(bottom - top + 2 * pad)}`, body), w, h: bottom - top + pad };
}

export function lockupSvg(id, c = colours.full) {
  if (id === 'B3') return wordmarkSvg(id, c, { shelf: true });
  const o = concepts[id].word;
  const W = wordmarkParts(o);
  const body = W.ink.map((d) => p(d, c.ink)).join('');
  // mark sized to the ascender height (150) + 30, sitting on the baseline
  const m = 190 / 64, gap = 44;
  const mark = `<g transform="translate(0 ${f(-160)}) scale(${f(m)})">${concepts[id].mark(c)}</g>`;
  const word = `<g transform="translate(${f(190 + gap + 16)} 0)">${body}</g>`;
  const w = 190 + gap + 16 + W.width + 4;
  return { svg: svg(`-2 -164 ${f(w)} 196`, mark + word), w, h: 196 };
}

export function appIconSvg(id, { maskable = false } = {}) {
  // white tile, full-colour mark; maskable keeps the mark's 52-unit box inside the central 80% circle
  const s = maskable ? (0.8 * 512) / (52 * Math.SQRT2) : 512 / 64 * 0.78;
  const t = 256 - 32 * s;
  const bg = maskable ? `<rect width="512" height="512" fill="#ffffff"/>` : `<rect width="512" height="512" rx="112" fill="#ffffff"/>`;
  return svg('0 0 512 512', `${bg}<g transform="translate(${f(t)} ${f(t)}) scale(${f(s)})">${concepts[id].mark(colours.full)}</g>`);
}

const NOTES = {
  B1: '**Awning.** A scalloped shop awning over an instant-photo print: the print\'s deep chin is the shop counter and its window is the shopfront, so one snapshot becomes a shop, which is what Shelfie does with one photo of a price list.\nIt reads as a shop at 16 px (three scallops over a framed window), pomegranate awning over an ink print, no camera and no rounded app tile.',
  B2: '**Propped print.** A snapshot print leaning on a shelf beside a bun: the product, its photo and the shelf it sells from in one small still life.\nThe tilted print gives a silhouette no other app icon has, the shelf grounds it as retail, and the bun keeps it a small food seller rather than a photo app.',
  B3: '**On the shelf.** A wordmark-led logo: the lowercase "shelfie" stands on a pomegranate shelf, and the i\'s dot is a small square snapshot (the moment the shelf becomes a shop).\nThe name is the logo, so it is memorable without a symbol; the favicon is the wordmark\'s own "s" on its shelf with the snapshot square.',
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
