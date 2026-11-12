// BASE_URL=http://localhost:3000 npx tsx scripts/illustration-sheet.ts [out.png]
// Renders the contact sheet of the item drawings in public/illustrations.svg (one per category, plus the bread and pastry variants) against a running app, so it uses the
// real tokens from globals.css: each drawing at 56 px and 224 px wide on the four section tints, plus the dimmed
// (sold out) state. Default output: docs/evidence/illustrations.png.
import { chromium } from '@playwright/test';
import { DRAWING_IDS } from '@/lib/domain/drawing';

const TINTS = ['--tile-rose-bg', '--tile-sage-bg', '--tile-sky-bg', '--tile-lilac-bg'];

async function main() {
  const base = process.env.BASE_URL ?? 'http://localhost:3000';
  const out = process.argv[2] ?? 'docs/evidence/illustrations.png';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const tile = (category: string, width: number, tint: string, dim = false) =>
    `<span style="display:flex;align-items:center;justify-content:center;width:${width}px;height:${(width * 3) / 4}px;border-radius:${width < 100 ? 10 : 16}px;background:var(${dim ? '--grey-50' : tint});overflow:hidden">` +
    `<svg viewBox="0 0 96 72" style="width:100%;height:100%;${dim ? 'opacity:.5;filter:grayscale(1)' : ''}"><use href="/illustrations.svg#${category}"/></svg></span>`;
  const cells = DRAWING_IDS.map(
    (c, i) =>
      `<figure style="display:flex;flex-direction:column;gap:10px;margin:0;align-items:flex-start">` +
      `<div style="display:flex;gap:12px;align-items:flex-end">${tile(c, 224, TINTS[i % 4])}<div style="display:flex;flex-direction:column;gap:8px">${tile(c, 56, TINTS[(i + 1) % 4])}${tile(c, 56, TINTS[(i + 2) % 4])}${tile(c, 56, TINTS[i % 4], true)}</div></div>` +
      `<figcaption style="font:600 15px Figtree, sans-serif;color:var(--ink-700)">${c}</figcaption></figure>`,
  ).join('');
  // Same document, so the app's stylesheet (the tokens) applies and /illustrations.svg resolves against the app.
  await page.evaluate((html) => {
    document.body.innerHTML = html;
    document.body.style.background = '#fff';
  }, `<main style="padding:40px;display:grid;grid-template-columns:repeat(4,max-content);gap:36px 40px;background:#fff">${cells}</main>`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.locator('main').screenshot({ path: out });
  await browser.close();
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
