// Seller setup end to end, against the real routes: Start → Try a sample menu (Marigold) → Reading →
// Review (fix one flagged card) → Publish to the PayPal sandbox → Live. Screenshots of Reading,
// Review and Live at 390 and 1440 px go to docs/judge/screenshots/task6/.
// Uses Claude when ANTHROPIC_API_KEY is set (else the recorded reading) and skips publishing
// when PayPal sandbox keys are missing.
// Run: E2E_PORT=3101 npx playwright test e2e/setup.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { config } from 'dotenv';
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, settle } from './helpers';

config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
const HAS_PAYPAL = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET_KEY);
const OUT = 'docs/judge/screenshots/task6';

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Screenshots at both widths, then back to the phone. */
async function shoot(page: Page, name: string) {
  for (const [label, size] of [
    ['390', PHONE],
    ['1440', DESKTOP],
  ] as const) {
    await page.setViewportSize(size);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Array.from(document.images).filter((i) => i.checkVisibility()).every((i) => i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: `${OUT}/${name}-${label}-fold.png`, animations: 'disabled' });
    // A full-page capture would freeze the sticky publish bar mid-page; show it where it rests instead.
    const unstick = await page.addStyleTag({ content: '[data-publish-bar] { position: static !important; }' });
    await page.screenshot({ path: `${OUT}/${name}-${label}.png`, fullPage: true, animations: 'disabled' });
    await unstick.evaluate((el) => (el as Element).remove());
  }
  await page.setViewportSize(PHONE);
}

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

test('a seller turns the Marigold sample into a live PayPal shop', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(PHONE);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: /Marigold Bakehouse/ }).click();
  await page.waitForURL(/\/shops\/shp_[a-z0-9]+\/setup$/);

  // Reading
  await expect(page.getByRole('heading', { level: 1, name: 'Reading your menu…' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Your menu photo/ })).toBeVisible();
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await shoot(page, 'reading');

  // Review
  const readingStarted = Date.now();
  await expect(page.getByRole('heading', { level: 1, name: 'Check your menu' })).toBeVisible({ timeout: 120_000 });
  console.log(`[setup] reading screen to review: ${Date.now() - readingStarted} ms (includes screenshots)`);
  await settle(page);
  const needs = page.locator('section[aria-labelledby="needs-title"] article');
  await expect(needs.first()).toBeVisible();
  const flaggedBefore = await needs.count();
  expect(flaggedBefore).toBeGreaterThan(0);
  await expect(page.getByText(/\d+ items · \d+ needs? you/)).toBeVisible();
  await noHorizontalScroll(page);
  await axe(page);
  await shoot(page, 'review');

  // Fix one flagged card: "Looks right" on the first check card (the crossed-out focaccia price, usually).
  const looksRight = page.getByRole('button', { name: 'Looks right' }).first();
  const publish = page.getByRole('button', { name: /^Publish \d+ items? to PayPal$/ });
  const before = Number((await publish.innerText()).match(/\d+/)![0]);
  await looksRight.click();
  await expect(needs).toHaveCount(flaggedBefore - 1);
  await expect(publish).toHaveText(`Publish ${before + 1} items to PayPal`);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  // Set the shop to ship too, with a flat fee.
  await page.getByRole('radio', { name: /Both/ }).check();
  await page.getByLabel('Flat shipping fee').fill('8');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  // Publish (real PayPal sandbox)
  test.skip(!HAS_PAYPAL, 'PayPal sandbox keys are not set: stopping before publish.');
  const publishStarted = Date.now();
  await publish.click();
  await expect(page.getByRole('heading', { level: 1, name: /Adding your menu to PayPal|Your menu is in PayPal/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /Adding to PayPal… \d+\/\d+|in PayPal/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/publishing-390.png`, animations: 'disabled' });
  await expect(page.getByRole('heading', { level: 1, name: 'Your shop is live' })).toBeVisible({ timeout: 120_000 });
  console.log(`[setup] publish click to live screen: ${Date.now() - publishStarted} ms; shop ${page.url()}`);
  await settle(page);
  await expect(page.getByRole('link', { name: 'Watch an AI order from you' })).toHaveAttribute('href', /\/s\/[a-z0-9-]+\?assistant=1$/);
  await expect(page.getByRole('link', { name: 'Open your dashboard' })).toHaveAttribute('href', /\/shops\/shp_/);
  await expect(page.getByText(/^https?:\/\/\S+\/s\/[a-z0-9-]+\/mcp$/)).toBeVisible();
  await expect(page.getByText(/\/claim\/[A-Za-z0-9_-]{40,}$/)).toBeVisible();
  await noHorizontalScroll(page);
  await axe(page);
  await shoot(page, 'live');

  // Opening the setup page again keeps showing the live step.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Your shop is live' })).toBeVisible();
});

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
