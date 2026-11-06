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
  const { w, round = false, dot = 'circle', gap = 16, fiShelf = false } = opts;
  let fBarEnd = 0; // fiShelf: where the f's crossbar ends, so the i can run it on as a shelf
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
      fBarEnd = bx1;
      if (round) { cap(bx0, -X + bh / 2); cap(bx1, -X + bh / 2); }
      return w + 34;
    },
    i() {
      stem(x + w / 2, -X, 0);
      const cy = -X - 24 - w * 0.6;
      if (fiShelf) {
        // the f's crossbar runs on over the i as a short shelf (A3's join); a small pomegranate
        // print (taller than wide, like an instant photo) stands just above it as the dot
        const ix = x + w / 2, pw = opts.dotW ?? w * 1.4, ph = pw * 1.12, end = ix + pw / 2 + 4, bh = w * 0.84;
        ink.push(rect(fBarEnd - 1, -X, end - fBarEnd + 1, bh));
        const gapY = w * 0.3;
        accent.push(rect(ix - pw / 2, -X - gapY - ph, pw, ph));
        return Math.max(w, end - x);
      }
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

// ---------- the final logo: B1 refined once with the judge's five changes ----------
// (1) the print is closed: a thin top band of the ink frame shows under the scallops, chin 3x the
//     sides; a paper gap keeps the awning apart from the print, so the one-colour mark still reads
// (2)/(3) the wordmark's f crossbar runs on over the i as a shelf with a pom dome on it; strokes +15%
// (4) mono wordmark and lockup, and a dark-aware favicon; (5) the maskable mark at 90%
export const FINAL = {
  name: 'Awning (final)',
  mark(c) {
    const a = c.accent, k = c.ink;
    const r = 28 / 3; // three equal scallops across 4..60
    const sc = (x) => `A${f(r)} ${f(r)} 0 0 1 ${f(x)} 12`;
    const awning = `M4 4H60V12${sc(60 - 2 * r)}${sc(60 - 4 * r)}${sc(4)}Z`;
    // the print: 8..56 x 24..60, sides and top 4, chin 12; the window 12..52 x 28..48
    const front = 'M8 24H56V60H8Z M12 28V48H52V28Z';
    return p(awning, a) + `<path fill="${k}" fill-rule="evenodd" d="${front}"/>`;
  },
  // stroke 23 (B1's 20 + 15%); the dot (34 x 38) is over 1.4x the old 32 x 16 scallop
  word: { w: 23, round: false, gap: 15, fiShelf: true, dotW: 34 },
  bbox: [4, 4, 60, 60],
};
concepts.FINAL = FINAL;

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
  // FINAL: the art box (awning top -148, print foot 18.2, the last e), so the files place exactly
  if (id === "FINAL") return { svg: svg(`10 -150 ${f(w - 12)} 170`, mark + word), w: w - 12, h: 170 };
  return { svg: svg(`-2 -164 ${f(w)} 196`, mark + word), w, h: 196 };
}

const BBOX = { FINAL: FINAL.bbox, B1: [4, 6, 60, 61], B2: [4, 10, 60, 60], B3: [4, 4, 60, 60] };
export function appIconSvg(id, { maskable = false, maskScale = 1 } = {}) {
  // white tile, full-colour mark centred on its bounding box; the maskable one fits the
  // box's half-diagonal inside the central 80% circle (radius 204.8)
  const [x0, y0, x1, y1] = BBOX[id];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const s = maskable ? (maskScale * 204.8) / Math.hypot((x1 - x0) / 2, (y1 - y0) / 2) : (512 * 0.74) / Math.max(x1 - x0, y1 - y0);
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

// A favicon whose ink turns white when the browser UI is dark.
export function faviconSvg(id = 'FINAL') {
  const body = concepts[id].mark({ accent: POM, ink: INK }).replace(`fill="${INK}"`, 'class="k"');
  return svg('0 0 64 64', `<style>.k{fill:${INK}}@media (prefers-color-scheme:dark){.k{fill:#fff}}</style>${body}`);
}

export const FINAL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'final');
export function writeFinal() {
  const id = 'FINAL', dir = FINAL_DIR;
  mkdirSync(dir, { recursive: true });
  const files = {
    'mark.svg': markSvg(id),
    'mark-mono.svg': markSvg(id, colours.mono),
    'mark-reverse.svg': markSvg(id, colours.reverse),
    'wordmark.svg': wordmarkSvg(id).svg,
    'wordmark-mono.svg': wordmarkSvg(id, colours.mono).svg,
    'lockup.svg': lockupSvg(id).svg,
    'lockup-mono.svg': lockupSvg(id, colours.mono).svg,
    'lockup-reverse.svg': lockupSvg(id, colours.reverse).svg,
    'favicon.svg': faviconSvg(id),
    'app-icon-512.svg': appIconSvg(id),
    'app-icon-maskable.svg': appIconSvg(id, { maskable: true, maskScale: 0.9 }),
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return files;
}

// The same geometry as plain path data for the app (src/components/brand/logo-paths.ts), so the
// React logo, the OG image and the SVG files can't drift apart.
export function writeAppPaths(file) {
  const k = { accent: '@A', ink: '@K' };
  const pick = (body, tag) => [...body.matchAll(/<path fill="([^"]+)"(?: fill-rule="evenodd")? d="([^"]+)"\/>/g)].filter((m) => m[1] === tag).map((m) => m[2]);
  const mark = FINAL.mark(k);
  const W = wordmarkParts(FINAL.word);
  const lock = lockupSvg('FINAL', colours.full).svg;
  const word = wordmarkSvg('FINAL').svg;
  const vb = (t) => t.match(/viewBox="([^"]+)"/)[1];
  const ts = `// Generated by docs/judge/logo/tools-B/build.mjs (node docs/judge/logo/tools-B/build.mjs final). Do not edit by hand.
// The Shelfie logo (B1 "Awning", final): a pomegranate scalloped awning over an ink instant print, and the drawn
// lowercase wordmark whose f crossbar runs on over the i as a shelf, with a pomegranate print as the dot.

/** The mark, in a 64-unit box (art 4..60 on both axes). The print path uses fill-rule evenodd (the window is a hole). */
export const MARK = { viewBox: '0 0 64 64', awning: ${JSON.stringify(pick(mark, '@A')[0])}, print: ${JSON.stringify(pick(mark, '@K')[0])} } as const;

/** The wordmark: ink stroke outlines and the pomegranate i-dot, baseline at y = 0, ascender at y = -150. */
export const WORDMARK = { viewBox: ${JSON.stringify(vb(word))}, ink: ${JSON.stringify(W.ink)}, dot: ${JSON.stringify(W.accent[0])} } as const;

/** The lockup: the mark scaled to 190 units on the left, the wordmark after it. */
export const LOCKUP = { viewBox: ${JSON.stringify(vb(lock))}, mark: 'translate(0 -160) scale(2.97)', word: 'translate(250 0)' } as const;
`;
  writeFileSync(file, ts);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'final') {
    console.log(Object.keys(writeFinal()).join(' '));
    writeAppPaths(join(FINAL_DIR, '..', '..', '..', '..', 'src', 'components', 'brand', 'logo-paths.ts'));
  }
  else writeAll();
}
