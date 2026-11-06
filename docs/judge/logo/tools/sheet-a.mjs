// Renders one comparison sheet per concept: node docs/judge/logo/tools/sheet-a.mjs [A1 A2 A3]
// Small sizes are rasterised by sharp at their real pixel size (then shown 1x and 4x nearest-neighbour);
// the rest of the sheet is HTML screenshotted by Playwright at deviceScaleFactor 1.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const req = createRequire(existsSync(join(ROOT, 'node_modules')) ? join(ROOT, 'package.json') : '/home/aman/paypal-ai/package.json');
const sharp = req('sharp');
const { chromium } = req('playwright');
const FONT = ['/tmp/fonttest/figtree-next.woff2'].find(existsSync);

const INK = '#141414';
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['A1', 'A2', 'A3'];

const uri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const colour = (svg, c) => svg.replace('<svg ', `<svg color="${c}" `);
async function png(svg, size, bg) {
  let img = sharp(Buffer.from(svg), { density: 72 * Math.max(1, 1024 / 64) }).resize(size, size, { fit: 'contain', background: '#0000' });
  if (bg) img = img.flatten({ background: bg });
  return `data:image/png;base64,${(await img.png().toBuffer()).toString('base64')}`;
}

for (const id of ids) {
  const dir = join(HERE, '..', 'concepts', 'A', id);
  const r = (n) => readFileSync(join(dir, n), 'utf8');
  const mark = r('mark.svg'), mono = r('mark-mono.svg'), lockup = r('lockup.svg'), lockMono = r('lockup-mono.svg');
  const wordmark = r('wordmark.svg'), icon = r('icon-512.svg'), mask = r('icon-maskable.svg');
  const monoWhite = colour(mono, '#ffffff'), monoInk = colour(mono, INK), lockWhite = colour(lockMono, '#ffffff');
  const small = [];
  for (const [label, s, bg] of [['white', mark, '#ffffff'], ['ink, mono white', monoWhite, INK], ['mono ink', monoInk, '#ffffff']]) {
    const p16 = await png(s, 16, bg), p32 = await png(s, 32, bg), p64 = await png(s, 64, bg), p256 = await png(s, 256, bg);
    small.push(`<div class="row" style="background:${bg};color:${bg === INK ? '#fff' : INK}"><span class="lab">${label}</span>
      <img src="${p16}" width="16" height="16"><img src="${p32}" width="32" height="32"><img src="${p64}" width="64" height="64">
      <img class="px" src="${p16}" width="64" height="64"><img class="px" src="${p32}" width="128" height="128"><img src="${p256}" width="256" height="256"></div>`);
  }
  // full-colour mark on ink as well (does the colour version survive a dark page?)
  const rev = mark.replaceAll('#141414', '#ffffff');
  const p32dark = await png(rev, 32, INK), p256dark = await png(rev, 128, INK);
  const nav = (w) => `<div class="hdr" style="width:${w}px"><img src="${uri(lockup)}" style="height:${w > 500 ? 30 : 26}px">
    <nav>${w > 500 ? '<a>How it works</a><a>For agents</a>' : ''}<b>Start a shop</b></nav></div>`;
  const html = `<!doctype html><html><head><style>
    ${FONT ? `@font-face{font-family:Figtree;src:url(data:font/woff2;base64,${readFileSync(FONT).toString('base64')})}` : ''}
    body{margin:0;font-family:Figtree,system-ui,sans-serif;color:${INK};background:#f4f5f7;width:1560px;text-rendering:geometricPrecision}
    h1{font-size:28px;margin:0 0 4px} h2{font-size:15px;margin:28px 0 10px;color:#5e636c;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
    .wrap{padding:36px 48px}
    .row{display:flex;align-items:flex-end;gap:28px;padding:18px 22px;border-radius:14px;margin-bottom:10px}
    .lab{width:130px;font-size:13px;align-self:center}
    img.px{image-rendering:pixelated}
    .hdr{height:64px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 24px;box-sizing:border-box;border-bottom:1px solid #eceef1;margin-bottom:12px}
    .hdr nav{display:flex;gap:24px;align-items:center;font-size:15px}.hdr b{background:#111214;color:#fff;border-radius:999px;padding:9px 16px;font-size:14px}
    .flex{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap}
    .card{width:360px;height:500px;background:#fff;border-radius:6px;box-shadow:0 2px 14px #0002;padding:30px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;text-align:center}
    .qr{width:200px;height:200px;background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0 0/25px 25px;margin:22px 0;outline:8px solid #fff}
    .pp{background:#0070e0;color:#fff;border-radius:999px;padding:14px 28px;font-weight:700;font-size:17px}
    .tile{position:relative;width:256px;height:256px}
    .tile img{width:256px;height:256px}
    .safe{position:absolute;inset:0;border-radius:50%;width:204.8px;height:204.8px;margin:25.6px;border:2px dashed #00e0ff;box-sizing:border-box}
    .cap{font-size:13px;color:#5e636c;margin-top:6px}
  </style></head><body><div class="wrap">
    <h1>Concept ${id}</h1><div class="cap">${readFileSync(join(dir, 'NOTE.md'), 'utf8').replace(/\n/g, ' ')}</div>
    <h2>Mark at 16, 32, 64 px (actual pixels), 16 and 32 at 4x nearest-neighbour, 256 px</h2>${small.join('')}
    <div class="row" style="background:${INK};color:#fff"><span class="lab">reversed colour on ink</span><img src="${p32dark}" width="32"><img src="${p256dark}" width="128">
      <img src="${uri(lockWhite)}" style="height:56px;margin-left:40px"><span class="lab" style="width:auto">mono lockup on ink</span></div>
    <h2>Lockup in a 64 px site header: 1440 and 390 wide</h2>${nav(1440)}${nav(390)}
    <h2>Wordmark alone, lockup mono, counter card, app icons, beside PayPal</h2>
    <div class="flex">
      <div class="card"><img src="${uri(mark)}" width="64"><div style="font-size:30px;font-weight:800;margin-top:16px">Marigold Bakehouse</div>
        <div style="font-size:16px;color:#5e636c;margin-top:4px">Scan to order. Pay with PayPal.</div><div class="qr"></div>
        <img src="${uri(lockup)}" style="height:26px;margin-top:auto"></div>
      <div><div class="tile"><img src="${uri(icon)}"></div><div class="cap">512 app icon (shown at 256)</div></div>
      <div><div class="tile"><img src="${uri(mask)}"><div class="safe"></div></div><div class="cap">maskable, dashed = 80% safe circle</div></div>
      <div><div class="tile" style="border-radius:50%;overflow:hidden"><img src="${uri(mask)}"></div><div class="cap">maskable cropped to a circle</div></div>
    </div>
    <div class="row" style="background:#fff;margin-top:24px;gap:48px;align-items:center"><img src="${uri(lockup)}" style="height:40px"><span class="pp">Approve $27.00 on PayPal</span><img src="${uri(mark)}" width="40"></div>
    <div class="row" style="background:#fff;gap:48px;align-items:center"><img src="${uri(wordmark)}" style="height:64px"><img src="${uri(lockMono)}" style="height:40px"></div>
  </div></body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1560, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: join(HERE, '..', 'concepts', 'A', `${id}-sheet.png`), fullPage: true });
  await browser.close();
  console.log('sheet', id);
}
