import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/home/aman/paypal-ai/package.json');
const { chromium } = require('playwright');
const ROOT = process.argv[2]; const OUT = '/tmp/judge-logo/out';
const C = ['A/A1','A/A2','A/A3','B/B1','B/B2','B/B3'];
const rd = (c, f) => { const p = `${ROOT}/${c}/${f}`; return fs.existsSync(p) ? fs.readFileSync(p,'utf8') : null; };
const id = c => c.split('/')[1];
const svgUrl = (s) => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64');
const browser = await chromium.launch();
async function shot(name, html, w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(`<style>body{margin:0;font-family:sans-serif}</style>${html}`);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); await p.close();
}
let w = '';
for (const c of C) w += `<div style="padding:14px 20px;border-bottom:1px solid #eee"><b>${id(c)}</b><br><img src="${svgUrl(rd(c,'wordmark.svg'))}" style="height:120px"></div>`;
await shot('wordmarks-large', w, 1000, 400);
let m = '';
for (const c of C) {
  const mk = rd(c,'icon-maskable.svg') ?? rd(c,'app-icon-maskable.svg');
  m += `<div style="text-align:center"><b>${id(c)}</b><div style="position:relative;width:300px;height:300px;margin:6px"><img src="${svgUrl(mk)}" width="300" height="300" style="opacity:.2"><img src="${svgUrl(mk)}" width="300" height="300" style="position:absolute;left:0;top:0;clip-path:circle(40% at 50% 50%)"><div style="position:absolute;inset:30px;border:1px dashed #0a0;border-radius:50%"></div></div></div>`;
}
await shot('maskable-safe-zone', `<div style="display:flex;flex-wrap:wrap;gap:10px;padding:10px;background:#ddd">${m}</div>`, 1000, 400);
await browser.close();
