// Renders one comparison sheet per concept to docs/judge/logo/concepts/B/<id>-sheet.png.
// Usage: node docs/judge/logo/tools-B/sheet.mjs [B1 B2 B3 | FINAL]   (FINAL writes docs/judge/logo/final/sheet.png)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { writeAll, writeFinal, FINAL_DIR, markSvg, wordmarkSvg, lockupSvg, appIconSvg, colours, concepts, INK, POM } from './build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const OUT = join(HERE, '..', 'concepts', 'B');
const fontSrc = readFileSync(join(ROOT, 'video/remotion/src/fonts/figtree-woff2.js'), 'utf8');
const font = (wt) => fontSrc.match(new RegExp(`${wt}: "([^"]+)"`))[1];
const faces = [400, 600, 700]
  .map((wt) => `@font-face{font-family:Figtree;font-weight:${wt};src:url(data:font/woff2;base64,${font(wt)}) format('woff2')}`)
  .join('');

const uri = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
async function px(svgText, size, bg) {
  // rasterise at true size (librsvg), on a solid background, as a PNG data URL
  const png = await sharp(Buffer.from(svgText), { density: 72 * (size / 64) * 1 })
    .resize(size, size)
    .flatten({ background: bg })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function html(id) {
  const full = markSvg(id), rev = markSvg(id, colours.reverse);
  const monoInk = markSvg(id, { accent: INK, ink: INK }), monoWhite = markSvg(id, colours.white), monoPom = markSvg(id, { accent: POM, ink: POM });
  const lock = lockupSvg(id), lockRev = lockupSvg(id, colours.reverse);
  const word = wordmarkSvg(id);
  const sizes = [16, 32, 64, 256];
  const row = async (s, bg) => {
    const z16 = await px(s, 16, bg), z32 = await px(s, 32, bg);
    return `<div class="row" style="background:${bg}">
      ${sizes.map((n) => `<div class="cell"><img src="${uri(s)}" width="${n}" height="${n}"><span>${n}</span></div>`).join('')}
      <div class="cell"><img class="pix" src="${z16}" width="64" height="64"><span>16 ×4</span></div>
      <div class="cell"><img class="pix" src="${z32}" width="128" height="128"><span>32 ×4</span></div>
      <div class="cell"><div class="tab" style="background:${bg === '#ffffff' ? '#dee1e6' : '#2a2b2e'}"><img class="pix" src="${z16}" width="16" height="16"><b style="color:${bg === '#ffffff' ? '#111' : '#eee'}">Marigold Bakehouse · Shelfie</b></div><span>browser tab</span></div>
    </div>`;
  };
  const header = (w, l, id) => `<div class="hdr" style="width:${w}px">
      <img src="${uri(l.svg)}" style="height:${(w < 500 ? 26 : 30) * (id === "B3" ? 1.25 : 1)}px">
      <nav>${w < 500 ? '<b class="pill dark">Start</b>' : '<a>How it works</a><a>For AI assistants</a><a>Pricing</a><b class="pill dark">Snap your price list</b>'}</nav></div>`;
  const app = appIconSvg(id), mask = appIconSvg(id, { maskable: true, maskScale: id === 'FINAL' ? 0.9 : 1 });
  return `<!doctype html><html><head><style>${faces}
  *{box-sizing:border-box;margin:0}
  body{font-family:Figtree,sans-serif;background:#f4f5f7;color:#111214;padding:32px;width:1600px;text-rendering:geometricPrecision}
  h1{font-size:30px;font-weight:700} h2{font-size:15px;font-weight:600;color:#5e636c;margin:28px 0 10px;text-transform:uppercase;letter-spacing:.06em}
  .row{display:flex;align-items:flex-end;gap:40px;padding:24px 28px;border-radius:14px}
  .cell{display:flex;flex-direction:column;align-items:center;gap:8px} .cell span{font-size:12px;color:#8a8f98}
  .pix{image-rendering:pixelated}
  .tab{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px 10px 0 0;font-size:12px;width:230px}
  .tab b{font-weight:400;white-space:nowrap;overflow:hidden}
  .hdr{height:64px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid #eceef1}
  .hdr nav{display:flex;align-items:center;gap:28px;font-size:15px;color:#3d4148}
  .pill{display:inline-flex;align-items:center;height:44px;padding:0 22px;border-radius:999px;font-weight:600;font-size:16px}
  .dark{background:#111214;color:#fff} .pp{background:#0070e0;color:#fff}
  .grid{display:flex;gap:28px;align-items:flex-start}
  .card{width:340px;background:#fff;border-radius:18px;box-shadow:0 1px 2px #0001,0 8px 28px #0000000f;padding:28px;display:flex;flex-direction:column;gap:14px;align-items:flex-start}
  .qr{width:180px;height:180px;background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0 0/24px 24px;border:10px solid #fff;outline:2px solid #111;align-self:center;margin:6px 0}
  .ico{position:relative;width:256px;height:256px} .ico img{width:256px;height:256px}
  .safe{position:absolute;inset:25.6px;border-radius:50%;outline:2px dashed #0070e0}
  .lbl{font-size:12px;color:#8a8f98;margin-top:6px}
  </style></head><body>
  <h1>${id} · ${concepts[id].name}</h1>
  <h2>Full colour on white: actual pixels, then 4× nearest-neighbour</h2>${await row(full, '#ffffff')}
  <h2>On ink #141414 (reversed: ink parts turn white)</h2>${await row(rev, '#141414')}
  <h2>One colour</h2><div class="row" style="background:#fff;gap:28px">
    ${[[monoInk, '#fff'], [monoPom, '#fff']].map(([s]) => `<img src="${uri(s)}" width="64"><img src="${uri(s)}" width="32"><img src="${uri(s)}" width="16">`).join('<i style="width:20px"></i>')}
    <div style="background:#141414;padding:16px 20px;border-radius:10px;display:flex;gap:20px;align-items:flex-end"><img src="${uri(monoWhite)}" width="64"><img src="${uri(monoWhite)}" width="32"><img src="${uri(monoWhite)}" width="16"></div>
    <div style="background:${POM};padding:16px 20px;border-radius:10px;display:flex;gap:20px;align-items:flex-end"><img src="${uri(monoWhite)}" width="64"><img src="${uri(monoWhite)}" width="32"></div>
    <img src="${uri(wordmarkSvg(id, { accent: INK, ink: INK }).svg)}" style="height:40px">
  </div>${id === 'FINAL' ? `<div class="row" style="background:#fff;gap:28px;margin-top:12px">
    <img src="${uri(lockupSvg(id, { accent: INK, ink: INK }).svg)}" style="height:32px">
    <div style="background:#141414;padding:14px 20px;border-radius:10px"><img src="${uri(lockupSvg(id, colours.white).svg)}" style="height:32px"></div>
    <div style="background:#141414;padding:14px 20px;border-radius:10px"><img src="${uri(lockupSvg(id, colours.reverse).svg)}" style="height:32px"></div>
    <div style="background:${POM};padding:14px 20px;border-radius:10px"><img src="${uri(lockupSvg(id, colours.white).svg)}" style="height:32px"></div>
    <img src="${uri(lockupSvg(id, { accent: POM, ink: POM }).svg)}" style="height:32px">
  </div>` : ''}
  <h2>Site header, 64 px tall, at 1440 and 390</h2>${header(1440, lock, id)}<div style="height:16px"></div>${header(390, lock, id)}
  <h2>Counter card · app icon 512 · maskable (dashed: 80% safe zone) · beside PayPal</h2>
  <div class="grid">
    <div class="card"><img src="${uri(lock.svg)}" style="height:30px"><div style="font-size:26px;font-weight:700;margin-top:8px">Marigold Bakehouse</div><div style="font-size:15px;color:#3d4148">Scan to order. Or ask your AI assistant for Marigold Bakehouse on Shelfie.</div><div class="qr"></div><div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#5e636c"><img src="${uri(full)}" width="18">shelfie.shop/s/marigold-bakehouse</div></div>
    <div><div class="ico" style="background:#e9ebef;border-radius:56px"><img src="${uri(app)}"></div><div class="lbl">512 app icon (shown at 256)</div></div>
    <div><div class="ico"><img src="${uri(mask)}"><div class="safe"></div></div><div class="lbl">maskable, 80% safe circle</div>
      <div style="display:flex;gap:16px;margin-top:12px"><img src="${uri(mask)}" width="72" style="border-radius:50%"><img src="${uri(mask)}" width="72" style="border-radius:22px"><img src="${uri(mask)}" width="72" style="clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)"></div></div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div style="background:#fff;border-radius:18px;padding:24px;display:flex;flex-direction:column;gap:18px;width:420px">
        <img src="${uri(lock.svg)}" style="height:28px;align-self:flex-start"><div style="font-size:15px;color:#5e636c">2 × Cardamom bun, 1 × Sourdough loaf</div>
        <b class="pill pp" style="justify-content:center">Approve $27.00 on PayPal</b></div>
      <div style="background:#141414;border-radius:18px;padding:24px;display:flex;align-items:center;gap:18px;width:420px">
        <img src="${uri(lockRev.svg)}" style="height:26px"><b class="pill pp">Approve $27.00 on PayPal</b></div>
      <div style="background:#fff;border-radius:18px;padding:18px 24px;display:flex;align-items:center;gap:14px;width:420px">
        <img src="${uri(full)}" width="32"><b class="pill pp" style="height:40px;font-size:15px">Approve $27.00 on PayPal</b></div>
    </div>
  </div>
  <h2>Wordmark (drawn paths), large</h2><div class="row" style="background:#fff"><img src="${uri(word.svg)}" style="height:110px"><img src="${uri(lock.svg)}" style="height:90px"></div>
  </body></html>`;
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['B1', 'B2', 'B3'];
if (ids.includes('FINAL')) writeFinal();
if (ids.some((i) => i !== 'FINAL')) writeAll();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1664, height: 800 } });
for (const id of ids) {
  await page.setContent(await html(id), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const file = id === 'FINAL' ? join(FINAL_DIR, 'sheet.png') : join(OUT, `${id}-sheet.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('wrote', file);
}
await browser.close();
