// Draws the site's Open Graph image, src/app/opengraph-image.png (1200 x 630; Next serves it and adds the og:image and
// twitter:image tags), from the drawn lockup (public/brand/lockup.svg) and the one-line pitch in Figtree, ink on white.
//
// Run: node scripts/make-og-image.mjs   (needs Playwright's Chromium, as the e2e tests do)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PITCH = 'Snap your price list. Any AI assistant can order, buyers pay with PayPal.';

const fontSrc = readFileSync(join(ROOT, 'video/remotion/src/fonts/figtree-woff2.js'), 'utf8');
const font = (wt) => fontSrc.match(new RegExp(`${wt}: "([^"]+)"`))[1];
const lockup = readFileSync(join(ROOT, 'public/brand/lockup.svg'));

const html = `<!doctype html><html><head><style>
@font-face{font-family:Figtree;font-weight:600;src:url(data:font/woff2;base64,${font(600)}) format('woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#fff;color:#141414;font-family:Figtree,sans-serif;text-rendering:geometricPrecision;
  display:flex;flex-direction:column;justify-content:center;padding:0 112px;gap:56px}
img{height:132px;align-self:flex-start}
p{font-size:52px;font-weight:600;line-height:1.18;letter-spacing:-0.01em;max-width:960px}
</style></head><body>
<img src="data:image/svg+xml;base64,${lockup.toString('base64')}" alt="">
<p>${PITCH}</p>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const out = join(ROOT, 'src/app/opengraph-image.png');
await page.screenshot({ path: out });
await browser.close();
writeFileSync(join(ROOT, 'src/app/opengraph-image.alt.txt'), `Shelfie. ${PITCH}`);
console.log('wrote src/app/opengraph-image.png and opengraph-image.alt.txt');
