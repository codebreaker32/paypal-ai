// Setup access rules against the real routes. The seller journey itself (sample → reading → review → publish →
// live, with real Claude and the PayPal sandbox) is e2e/flow.spec.ts; its screens are in e2e/screenshots.spec.ts.
// Run: E2E_PORT=3111 npx playwright test e2e/setup.spec.ts
import { expect, test } from '@playwright/test';

test('a stranger gets a 404 for someone else’s setup page and its API', async ({ page, browser }) => {
  // Create the shop without opening its setup page, so no reading starts.
  const res = await page.request.post('/api/shops', { data: { sample: 'ravi-bike-repair' } });
  expect(res.status()).toBe(201);
  const { shopId } = (await res.json()) as { shopId: string };
  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  expect((await other.goto(`/shops/${shopId}/setup`))?.status()).toBe(404);
  expect((await other.request.post(`/api/shops/${shopId}/publish`)).status()).toBe(404);
  expect((await other.request.get(`/api/shops/${shopId}/photo/1`)).status()).toBe(404);
  await stranger.close();
  // The owner can see the photo.
  expect((await page.request.get(`/api/shops/${shopId}/photo/1`)).headers()['content-type']).toBe('image/jpeg');
});

test('an unknown owner link is a 404', async ({ page }) => {
  expect((await page.goto(`/claim/${'x'.repeat(43)}`))?.status()).toBe(404);
});
