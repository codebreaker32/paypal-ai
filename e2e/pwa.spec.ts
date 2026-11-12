// Installable on a phone: Chromium reports no installability errors, the manifest has what an install needs,
// every icon is served at its stated size, the iOS meta is there, and no service worker is registered (order, payment
// and dashboard pages are never cached). Saves the manifest and an icon sheet to data/pwa/.
//
// Run: E2E_PORT=3150 npx playwright test e2e/pwa.spec.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import sharp from 'sharp';

const OUT = process.env.PWA_OUT ? path.resolve(process.env.PWA_OUT) : path.resolve(__dirname, '..', 'data', 'pwa');

const PORT = Number(process.env.E2E_PORT ?? 3100);

test('Chromium can install Shelfie, with no service worker', async ({ request }) => {
  // Two things make the check real: the full Chromium build in new-headless mode (the default headless shell skips
  // installability and answers [] even for a page with no manifest), and a persistent profile (Playwright's normal
  // contexts are incognito, which Chromium reports as "in-incognito").
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-pwa-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', viewport: { width: 390, height: 844 } });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    const cdp = await context.newCDPSession(page);
    const errors = ((await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] }).installabilityErrors;
    expect(errors.map((e) => e.errorId)).toEqual([]);
    await checkManifestAndMeta(page, request);
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

async function checkManifestAndMeta(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext) {

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: 'Shelfie', short_name: 'Shelfie', start_url: '/', display: 'standalone' });
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  const purposes = manifest.icons.map((i: { purpose: string; sizes: string }) => `${i.sizes} ${i.purpose}`);
  expect(purposes).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']));

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  let left = 24;
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    const buf = await res.body();
    const meta = await sharp(buf).metadata();
    expect(`${meta.width}x${meta.height}`, icon.src).toBe(icon.sizes);
    tiles.push({ input: await sharp(buf).resize(256, 256).png().toBuffer(), left, top: 24 });
    left += 280;
  }

  // iOS: the touch icon, standalone capability and status bar style; and the theme colour for Android's toolbar.
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(touch).toBeTruthy();
  const touchBuf = await (await request.get(touch!)).body();
  expect((await sharp(touchBuf).metadata()).width).toBe(180);
  tiles.push({ input: await sharp(touchBuf).resize(256, 256).png().toBuffer(), left, top: 24 });
  left += 280;
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', /default|black|black-translucent/);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', manifest.theme_color);

  await sharp({ create: { width: left, height: 304, channels: 4, background: '#e9ecef' } })
    .composite(tiles)
    .png()
    .toFile(path.join(OUT, 'icons.png'));

  // No offline caching: nothing registers a service worker.
  const registrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
  expect(registrations).toBe(0);
}
