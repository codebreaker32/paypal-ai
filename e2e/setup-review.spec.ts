// The review screen's one-thumb fixes, the retake and failed screens, without calling Claude:
// the reading is written straight into the app's database with runReading() and a crafted model
// output (Marigold plus a cross-page duplicate and a missing price). Nothing is published.
// Run: E2E_PORT=3101 npx playwright test e2e/setup-review.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { getDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import * as extractions from '@/lib/db/repos/extractions';
import { recordedReading } from '@/lib/ai/samples';
import type { MenuExtraction } from '@/lib/ai/schemas';
import { runReading } from '@/lib/catalog/setup';
import { publishShop } from '@/lib/catalog/publish';
import { DESKTOP, PHONE, settle } from './helpers';

const OUT = 'docs/judge/screenshots/task6';

function crafted(): MenuExtraction {
  const raw = recordedReading('marigold-bakehouse');
  const base = raw.items[0];
  raw.items.push(
    { ...base, section: 'Pastries', name: 'Butter croissant', description: null, source_text: 'Butter croissant $4.50', page: 2, prices: [{ label: null, amount_cents: 450, raw: '$4.50' }], confidence: 'high', note: null },
    { ...base, section: 'Breads', name: 'Day-old loaf', description: null, source_text: 'Day-old loaf', page: 2, prices: [], price_kind: 'missing', confidence: 'high', note: null },
  );
  raw.skipped_lines.push({ text: '+$1.5 add jam', page: 2, reason: 'addon' });
  return raw;
}

/** A sample shop owned by this page's browser, read with `raw` (or failing) without Claude. */
async function shopWithReading(page: Page, raw: MenuExtraction | Error): Promise<string> {
  const res = await page.request.post('/api/shops', { data: { sample: 'marigold-bakehouse' } });
  const { shopId } = (await res.json()) as { shopId: string };
  await runReading(
    { db: getDb(), hasAiKey: true, extract: async () => { if (raw instanceof Error) throw raw; return raw; } },
    shopId,
  );
  return shopId;
}

const card = (page: Page, name: string) => page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });

async function shoot(page: Page, name: string) {
  for (const [label, size] of [['390', PHONE], ['1440', DESKTOP]] as const) {
    await page.setViewportSize(size);
    await page.waitForFunction(() => Array.from(document.images).filter((i) => i.checkVisibility()).every((i) => i.complete && i.naturalWidth > 0));
    const unstick = await page.addStyleTag({ content: '[data-publish-bar] { position: static !important; }' });
    await page.screenshot({ path: `${OUT}/${name}-${label}.png`, fullPage: true, animations: 'disabled' });
    await unstick.evaluate((el) => (el as Element).remove());
  }
  await page.setViewportSize(PHONE);
}

test.beforeAll(() => fs.mkdirSync(path.resolve(OUT), { recursive: true }));
test.use({ viewport: PHONE });

test('every kind of flagged card can be fixed with a tap or two, and edits autosave', async ({ page }) => {
  test.setTimeout(120_000);
  const shopId = await shopWithReading(page, crafted());
  await page.goto(`/shops/${shopId}/setup`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Check your menu' })).toBeVisible();
  await expect(page.getByText('12 items · 7 need you')).toBeVisible();
  const publish = page.getByRole('button', { name: /^Publish \d+ items? to PayPal$/ });
  await expect(publish).toHaveText('Publish 5 items to PayPal');

  // DUPLICATE: one card for both croissants; Merge, then keep $4.25.
  const dup = card(page, 'Butter croissant');
  await expect(dup.getByText('Listed twice')).toBeVisible();
  await dup.getByRole('button', { name: 'Merge' }).click();
  await dup.getByRole('button', { name: 'Keep $4.25' }).click();
  await expect(dup).toHaveCount(0);
  await expect(publish).toHaveText('Publish 6 items to PayPal');

  // MISSING_PRICE: the decimal keypad, with a helpful error first.
  const loaf = card(page, 'Day-old loaf');
  const price = loaf.getByLabel('Price');
  await expect(price).toHaveAttribute('inputmode', 'decimal');
  await price.fill('4.555');
  await price.blur();
  await expect(loaf.getByRole('alert')).toContainText('Enter a price like 4.50');
  await price.fill('4.5');
  await loaf.getByRole('button', { name: 'Save price' }).click();
  await expect(loaf).toHaveCount(0);

  // CHECK: Fix (rename and reprice), and Looks right.
  const focaccia = card(page, 'Focaccia – rosemary & sea salt');
  await focaccia.getByRole('button', { name: 'Fix' }).click();
  await focaccia.getByLabel('Name').fill('Rosemary focaccia');
  await focaccia.getByLabel('Price').fill('7');
  await focaccia.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(focaccia).toHaveCount(0);
  await card(page, 'Cardamom bun').getByRole('button', { name: 'Looks right' }).click();

  // MARKET_PRICE: Ask in person keeps it listed, off PayPal.
  await card(page, 'Seasonal fruit galette').getByRole('button', { name: 'Ask in person' }).click();
  await expect(page.getByRole('heading', { name: 'Ask in person' })).toBeVisible();
  await expect(page.getByText('11 items · 1 needs you')).toBeVisible();
  await expect(publish).toHaveText('Publish 9 items to PayPal');
  await shoot(page, 'review-after-fixes');

  // A skipped line becomes an item, with the price found in it.
  await page.getByText('Lines we skipped').click();
  const jam = page.locator('li').filter({ hasText: '“+$1.5 add jam”' });
  await jam.getByRole('button', { name: 'Make it an item' }).click();
  await expect(jam.getByLabel('Price')).toHaveValue('1.50');
  await jam.getByLabel('Name').fill('Add jam');
  await jam.getByRole('button', { name: 'Add to menu' }).click();
  await expect(publish).toHaveText('Publish 10 items to PayPal');

  // Remove, then put back.
  const rye = page.locator('li').filter({ hasText: 'Seeded rye' }).first();
  await rye.getByRole('button', { name: /Edit/ }).click();
  await rye.getByRole('button', { name: 'Remove from menu' }).click();
  await expect(publish).toHaveText('Publish 9 items to PayPal');
  await page.locator('summary', { hasText: 'Removed' }).click();
  await page.getByRole('button', { name: /Put back Seeded rye/ }).click();
  await expect(publish).toHaveText('Publish 10 items to PayPal');

  // Shop details: ship too, with a flat fee.
  await page.getByRole('radio', { name: /Both/ }).check();
  await page.getByLabel('Flat shipping fee').fill('8');
  await page.getByLabel('About').fill('Weekend bakes from a home kitchen.');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  // Everything landed in the database.
  await expect
    .poll(() => shops.byId(getDb(), shopId)?.shippingFeeCents)
    .toBe(800);
  const saved = items.listWithVariants(getDb(), shopId);
  const byName = (n: string) => saved.find((i) => i.name === n)!;
  expect(shops.byId(getDb(), shopId)).toMatchObject({ fulfillment: 'both', about: 'Weekend bakes from a home kitchen.' });
  expect(byName('Rosemary focaccia')).toMatchObject({ issues: [], status: 'draft' });
  expect(byName('Rosemary focaccia').variants[0].priceCents).toBe(700);
  expect(byName('Day-old loaf').variants[0].priceCents).toBe(450);
  expect(byName('Seasonal fruit galette')).toMatchObject({ status: 'in_person', issues: [] });
  expect(saved.filter((i) => i.name === 'Butter croissant').map((i) => [i.status, i.variants[0].priceCents]).sort()).toEqual([
    ['draft', 425],
    ['removed', 450],
  ]);
  expect(byName('Add jam').variants[0].priceCents).toBe(150);
  expect(byName('Seeded rye').status).toBe('draft');

  // A reload shows the same review.
  await page.reload();
  await expect(page.getByText('12 items · 1 needs you')).toBeVisible();
  await expect(publish).toHaveText('Publish 10 items to PayPal');
});

test('a photo that is not a menu shows the retake screen with its tip', async ({ page }) => {
  const notAMenu = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../tests/ai/fixtures/not-a-menu.json'), 'utf8'));
  const shopId = await shopWithReading(page, notAMenu);
  await page.goto(`/shops/${shopId}/setup`);
  await expect(page.getByRole('heading', { level: 1, name: "This doesn't look like a price list" })).toBeVisible();
  await expect(page.getByText(/Point the camera at your price list/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retake photo' })).toBeVisible();
  await settle(page);
  await shoot(page, 'retake');
});

test('a reading that fails says so and offers Try again', async ({ page }) => {
  const shopId = await shopWithReading(page, new Error('Request timed out.'));
  await page.goto(`/shops/${shopId}/setup`);
  await expect(page.getByRole('heading', { level: 1, name: 'Reading didn’t finish' })).toBeVisible();
  await expect(page.getByText(/took too long/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await settle(page);
  await shoot(page, 'failed');
});

test('a partly failed publish shows the live shop with Retry for the rest', async ({ page }) => {
  test.setTimeout(120_000);
  const shopId = await shopWithReading(page, recordedReading('marigold-bakehouse'));
  // A stand-in PayPal that turns down the sourdough loaf. (Retry is not pressed: that would call the sandbox.)
  let n = 0;
  const flaky = {
    async createProduct(p: { name: string }, requestId: string) {
      if (p.name.startsWith('Country sourdough')) throw new Error('PayPal is busy. Try again.');
      return { id: `PROD-E2E${Date.now()}${n++}-${requestId.slice(-6)}` };
    },
  };
  const result = await publishShop({ db: getDb(), paypal: flaky }, shopId);
  expect(result.failed).toHaveLength(1);
  await page.goto(`/shops/${shopId}/setup`);
  await expect(page.getByRole('heading', { level: 1, name: 'Your shop is live' })).toBeVisible();
  await expect(page.getByText('1 item hasn’t reached PayPal yet')).toBeVisible();
  await expect(page.getByText(/Country sourdough loaf is ready but PayPal didn’t take it/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry 1' })).toBeVisible();
  await settle(page);
  await shoot(page, 'live-partial');
});

test('the reading screen: the photo with a scan and plain status lines, and a refresh keeps watching', async ({ page }) => {
  test.setTimeout(120_000);
  const res = await page.request.post('/api/shops', { data: { sample: 'marigold-bakehouse' } });
  const { shopId } = (await res.json()) as { shopId: string };
  // A reading that is already running (as after a refresh mid-run): the page must only watch it.
  const run = extractions.start(getDb(), shopId, 'claude-sonnet-5-5');
  await page.goto(`/shops/${shopId}/setup`);
  await expect(page.getByRole('heading', { level: 1, name: 'Reading your menu…' })).toBeVisible();
  await expect(page.getByText('This usually takes about 10 seconds.')).toBeVisible();
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await shoot(page, 'reading');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Reading your menu…' })).toBeVisible();
  // Still exactly one reading: the refresh did not start another.
  expect(extractions.latest(getDb(), shopId)!.id).toBe(run);
  extractions.fail(getDb(), run, 'AI_ERROR: e2e done');
});
