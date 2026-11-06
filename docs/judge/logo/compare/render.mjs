import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/home/aman/paypal-ai/package.json');
const { chromium } = require('playwright');
const sharp = require('sharp');
const ROOT = process.argv[2]; const OUT = '/tmp/judge-logo/out';
const C = ['A/A1','A/A2','A/A3','B/B1','B/B2','B/B3'];
const rd = (c, f) => { const p = `${ROOT}/${c}/${f}`; return fs.existsSync(p) ? fs.readFileSync(p,'utf8') : null; };
const id = c => c.split('/')[1];
const font = fs.readFileSync('/tmp/judge-logo/figtree.woff2').toString('base64');
const css = `@font-face{font-family:Figtree;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;font-family:Figtree;text-rendering:geometricPrecision;color:#111214}th,td{font-family:Figtree}`;
const durl = async (svg, px, tint) => {
  let s = svg; if (tint) s = s.replaceAll('currentColor', tint);
  const b = await sharp(Buffer.from(s), { density: Math.max(72, 72 * px / 64 * 4) }).resize(px, px).png().toBuffer();
  return 'data:image/png;base64,' + b.toString('base64');
};
const svgUrl = (s) => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64');
const darkify = s => s.replaceAll('#141414', '#ffffff');
const browser = await chromium.launch();
async function shot(name, html, w, h, full=true) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(`<style>${css}</style>${html}`); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); await p.close();
}
for (const N of [16, 32, 64, 256]) {
  const mag = N <= 32 ? (N === 16 ? 6 : 3) : 1;
  let rows = '';
  const variants = [
    ['colour on white', '#fff', c => rd(c,'mark.svg'), null],
    ['colour on #141414 (as shipped)', '#141414', c => rd(c,'mark.svg'), null],
    ['colour on #141414 (ink to white)', '#141414', c => darkify(rd(c,'mark.svg')), null],
    ['mono ink on white', '#fff', c => rd(c,'mark-mono.svg'), '#111214'],
    ['mono white on #141414', '#141414', c => rd(c,'mark-mono.svg'), '#ffffff'],
  ];
  for (const [label, bg, get, tint] of variants) {
    let cells = '';
    for (const c of C) {
      const u = await durl(get(c), N, tint);
      cells += `<td style="background:${bg};padding:12px;text-align:center"><img src="${u}" width="${N}" height="${N}" style="image-rendering:pixelated">${mag>1?`<br><img src="${u}" width="${N*mag}" height="${N*mag}" style="image-rendering:pixelated;margin-top:8px">`:''}</td>`;
    }
    rows += `<tr><th style="font-size:12px;text-align:left;padding:4px 8px;width:150px">${label}</th>${cells}</tr>`;
  }
  const head = `<tr><th></th>${C.map(c=>`<th style="font-size:18px">${id(c)}</th>`).join('')}</tr>`;
  await shot(`marks-${N}px`, `<h3 style="margin:8px">Marks at ${N} px (rasterised at exactly ${N} px${mag>1?`; under each, the same pixels x${mag}`:''})</h3><table style="border-collapse:collapse">${head}${rows}</table>`, N===256?1800:1400, 400);
}
{
  const neighbours = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#0070e0"/><path d="M5 3h4a3 3 0 0 1 0 6H7v4H5z" fill="#fff"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#111"/><circle cx="8" cy="8" r="3" fill="#fff"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#ea4335"/><path d="M3 5l5 4 5-4v7H3z" fill="#fff"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="8" fill="#d97757"/><path d="M8 3v10M3 8h10M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="#fff" stroke-width="1.6"/></svg>`,
  ];
  const titles = ['PayPal Developer','GitHub','Inbox','Claude'];
  let strips = '';
  for (const dark of [false, true]) {
    for (const c of C) {
      const mine = await durl(dark ? darkify(rd(c,'mark.svg')) : rd(c,'mark.svg'), 16);
      const order = [0, 1, 'ME', 2, 3];
      const tabs = order.map(n => {
        const me = n === 'ME';
        const src = me ? mine : svgUrl(neighbours[n]);
        const t = me ? 'Marigold Bakehouse' : titles[n];
        return `<div style="display:flex;align-items:center;gap:8px;width:180px;height:34px;padding:0 10px;border-radius:8px 8px 0 0;${me?`background:${dark?'#3c3c3c':'#fff'}`:''};font-size:12px;color:${dark?'#ddd':'#333'}"><img src="${src}" width="16" height="16">${t}</div>`;
      }).join('');
      strips += `<div style="display:flex;align-items:center;background:${dark?'#202124':'#dee1e6'};padding:6px 8px 0"><b style="width:36px;font-size:12px;color:${dark?'#fff':'#000'}">${id(c)}</b>${tabs}</div>`;
    }
  }
  await shot('favicon-tabstrip', strips, 960, 300);
  const b = await sharp(`${OUT}/favicon-tabstrip.png`).metadata();
  await sharp(`${OUT}/favicon-tabstrip.png`).resize(b.width*2, b.height*2, { kernel: 'nearest' }).toFile(`${OUT}/favicon-tabstrip-x2.png`);
}
{
  let cells = '';
  for (const c of C) {
    const i512 = rd(c,'icon-512.svg') ?? rd(c,'app-icon-512.svg');
    const mk = rd(c,'icon-maskable.svg') ?? rd(c,'app-icon-maskable.svg');
    const small = await sharp(Buffer.from(i512)).resize(48, 48).png().toBuffer();
    cells += `<div style="text-align:center"><b>${id(c)}</b><br>
      <img src="${svgUrl(i512)}" width="192" height="192" style="border-radius:42px;box-shadow:0 2px 8px #0003;margin:6px">
      <div style="position:relative;width:192px;height:192px;margin:6px auto"><img src="${svgUrl(mk)}" width="192" height="192" style="border-radius:50%;"><div style="position:absolute;inset:19.2px;border:2px dashed #0a0;border-radius:50%"></div></div>
      <div style="position:relative;width:192px;height:192px;margin:6px auto"><img src="${svgUrl(mk)}" width="192" height="192" style="opacity:.25"><img src="${svgUrl(mk)}" width="192" height="192" style="position:absolute;left:0;top:0;clip-path:circle(40% at 50% 50%)"></div>
      <img src="data:image/png;base64,${small.toString('base64')}" width="48" height="48" style="border-radius:11px;margin:6px;box-shadow:0 1px 4px #0003">
    </div>`;
  }
  await shot('app-icons', `<div style="padding:12px;background:#f1f1f1"><p style="margin:0 0 8px">Row 1: icon-512 in a rounded launcher tile. Row 2: maskable in a circle mask, green dashed = 80% safe zone. Row 3: maskable, only the 80% safe circle at full opacity. Row 4: icon at 48 px.</p><div style="display:flex;gap:16px">${cells}</div></div>`, 1300, 900);
}
for (const W of [1440, 390]) {
  let html = '';
  for (const c of C) {
    const lk = rd(c,'lockup.svg'); const lkm = rd(c,'lockup-mono.svg');
    const darkL = lkm ? lkm.replaceAll('currentColor','#ffffff') : darkify(lk);
    const navL = W > 600 ? `<nav style="display:flex;gap:28px;font-size:15px;font-weight:500">Orders <span style="color:#c21a4b;border-bottom:2px solid #c21a4b">Menu</span> Share Settings</nav><button style="font:600 14px Figtree;background:#111214;color:#fff;border:0;border-radius:999px;padding:10px 18px">Open my shop</button>` : `<span style="font-size:22px">&#9776;</span>`;
    const navD = W > 600 ? `<nav style="display:flex;gap:28px;font-size:15px;font-weight:500">Orders <span style="border-bottom:2px solid #fff">Menu</span> Share Settings</nav><button style="font:600 14px Figtree;background:#fff;color:#111;border:0;border-radius:999px;padding:10px 18px">Open my shop</button>` : `<span style="font-size:22px">&#9776;</span>`;
    html += `<div style="font:600 11px Figtree;padding:6px 16px;color:#888">${id(c)}${lkm?'':' (dark: no mono lockup file, ink swapped to white)'}</div>
    <header style="height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 ${W>600?32:16}px;border-bottom:1px solid #eee;background:#fff"><img src="${svgUrl(lk)}" style="height:32px">${navL}</header>
    <header style="height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 ${W>600?32:16}px;background:#141414;color:#fff"><img src="${svgUrl(darkL)}" style="height:32px">${navD}</header>`;
  }
  await shot(`header-${W}`, html, W, 400);
}
{
  let cards = '';
  for (const c of C) {
    const lk = rd(c,'lockup.svg'); const mk = rd(c,'mark.svg');
    cards += `<div style="width:300px;padding:20px;background:#fff;border-radius:16px;box-shadow:0 2px 10px #0002;text-align:center">
      <div style="font:600 11px Figtree;color:#888;text-align:left">${id(c)}</div>
      <img src="${svgUrl(lk)}" style="height:34px;margin-top:6px">
      <div style="font-size:22px;font-weight:700;margin:12px 0 2px">Marigold Bakehouse</div>
      <div style="font-size:13px;color:#5e636c">Order ahead, or ask your AI assistant</div>
      <div style="width:140px;height:140px;margin:14px auto;background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0 0/20px 20px;border:6px solid #fff;outline:1px solid #ddd"></div>
      <div style="font-size:13px">shelfie.app/s/marigold-bakehouse</div>
      <hr style="border:0;border-top:1px solid #eee;margin:16px 0">
      <div style="display:flex;align-items:center;gap:10px;justify-content:center">
        <img src="${svgUrl(mk)}" style="height:28px"><button style="font:600 15px Figtree;background:#0070e0;color:#fff;border:0;border-radius:999px;padding:12px 18px">Approve $27.00 on PayPal</button></div>
      <div style="display:flex;align-items:center;gap:10px;justify-content:center;margin-top:10px">
        <img src="${svgUrl(lk)}" style="height:22px"><button style="font:600 13px Figtree;background:#0070e0;color:#fff;border:0;border-radius:999px;padding:9px 14px">Approve $27.00 on PayPal</button></div>
    </div>`;
  }
  await shot('counter-card-paypal', `<div style="display:flex;flex-wrap:wrap;gap:20px;padding:20px;background:#f3f3f3">${cards}</div>`, 1040, 600);
}
{
  let rows = '';
  for (const c of C) {
    const wm = rd(c,'wordmark.svg'); const wmm = rd(c,'wordmark-mono.svg');
    rows += `<tr><td style="padding:10px;font-weight:700">${id(c)}</td>
      <td style="padding:10px"><img src="${svgUrl(wm)}" style="height:56px"></td>
      <td style="padding:10px;font-size:44px;font-weight:700;letter-spacing:-0.02em">shelfie</td>
      <td style="padding:10px;white-space:nowrap"><img src="${svgUrl(wm)}" style="height:18px;vertical-align:middle"> <span style="font-size:15px;vertical-align:middle">Orders &middot; Menu</span></td>
      <td style="padding:10px;background:#141414"><img src="${svgUrl(wmm ? wmm.replaceAll('currentColor','#fff') : darkify(wm))}" style="height:40px">${wmm?'':'<div style="color:#f88;font-size:11px">no mono file; ink swapped</div>'}</td></tr>`;
  }
  await shot('wordmarks', `<table style="border-collapse:collapse"><tr><th></th><th>wordmark</th><th>Figtree 700</th><th>18 px in UI</th><th>dark</th></tr>${rows}</table>`, 1300, 500);
}
await browser.close();
