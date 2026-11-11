// The review screen's one-thumb fixes, the retake and failed screens, without calling Claude:
// the reading is written straight into the app's database with runReading() and a crafted model
// output (Marigold plus a cross-page duplicate and a missing price). Nothing is published.
// Screenshots of these screens come from e2e/screenshots.spec.ts.
// Run: E2E_PORT=3111 npx playwright test e2e/setup-review.spec.ts
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
import { itemsToPublish, publishShop } from '@/lib/catalog/publish';
import { PHONE, samplePhoto, settle } from './helpers';

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

/**
 * A draft shop owned by this page's browser (the Marigold sample, or `photo` from public/samples uploaded as
 * the owner would), read with `raw` (or failing) without Claude.
 */
async function shopWithReading(page: Page, raw: MenuExtraction | Error, photo?: string): Promise<string> {
  const res = photo
    ? await page.request.post('/api/shops', { multipart: { photos: samplePhoto(photo) } })
    : await page.request.post('/api/shops', { data: { sample: 'marigold-bakehouse' } });
  const { shopId } = (await res.json()) as { shopId: string };
  await runReading(
    { db: getDb(), hasAiKey: true, extract: async () => { if (raw instanceof Error) throw raw; return raw; } },
    shopId,
  );
  return shopId;
}

const card = (page: Page, name: string) => page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });

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

  // Where the money goes: Publish waits for a valid PayPal email, checked when the field loses focus.
  await expect(publish).toBeDisabled();
  const goToPayee = page.getByRole('button', { name: 'Add your PayPal email to publish.' });
  expect((await goToPayee.boundingBox())!.height).toBeGreaterThanOrEqual(44); // a touch target, not just a line of text
  await goToPayee.click();
  const payee = page.getByLabel('Your PayPal email');
  await expect(payee).toBeFocused();
  await payee.fill('rosa@example');
  await expect(page.getByText('Enter the email you use to log in to PayPal, like rosa@example.com.')).toHaveCount(0); // not while typing
  await payee.blur();
  await expect(page.getByText('Enter the email you use to log in to PayPal, like rosa@example.com.')).toBeVisible();
  await expect(publish).toBeDisabled();
  await payee.fill(' Rosa@Example.com');
  await expect(page.getByText('Enter the email you use to log in to PayPal, like rosa@example.com.')).toHaveCount(0);
  await expect(publish).toBeEnabled();
  await expect(goToPayee).toHaveCount(0);
  await expect.poll(() => shops.byId(getDb(), shopId)?.payeeEmail).toBe('rosa@example.com');

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
  const shopId = await shopWithReading(page, notAMenu, 'coffee-and-plant.jpg');
  await page.goto(`/shops/${shopId}/setup`);
  await expect(page.getByRole('heading', { level: 1, name: "This doesn’t look like a price list" })).toBeVisible();
  await expect(page.getByText(/Point the camera at your price list/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retake photo' })).toBeVisible();
  await settle(page);
});

test('a reading that fails says so and offers Try again', async ({ page }) => {
  const shopId = await shopWithReading(page, new Error('Request timed out.'));
  await page.goto(`/shops/${shopId}/setup`);
  await expect(page.getByRole('heading', { level: 1, name: 'Reading didn’t finish' })).toBeVisible();
  await expect(page.getByText(/took too long/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await settle(page);
});

test('a partly failed publish shows the live shop with Retry for the rest', async ({ page }) => {
  test.setTimeout(120_000);
  const shopId = await shopWithReading(page, recordedReading('marigold-bakehouse'));
  shops.update(getDb(), shopId, { payeeEmail: 'rosa@example.com' }); // the seller's PayPal email, which publishing needs
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
  await expect(page.getByRole('button', { name: 'Retry 1 item' })).toBeVisible();
  await settle(page);
});

test('a save the server refuses re-syncs the review with the database and keeps the message', async ({ page }) => {
  test.setTimeout(120_000);
  const shopId = await shopWithReading(page, recordedReading('marigold-bakehouse'));
  await page.goto(`/shops/${shopId}/setup`);
  const publish = page.getByRole('button', { name: /^Publish \d+ items? to PayPal$/ });
  await expect(publish).toHaveText('Publish 6 items to PayPal');
  // Behind this screen's back (another tab, say) the rye reaches PayPal, so its name is fixed now.
  const rye = items.listWithVariants(getDb(), shopId).find((i) => i.name === 'Seeded rye')!;
  items.setPayPalProductId(getDb(), rye.id, `PROD-E2E-${rye.id}`);
  const row = page.locator('li').filter({ hasText: 'Seeded rye' }).first();
  await row.getByRole('button', { name: /Edit/ }).click();
  await row.getByLabel('Name').fill('Seeded rye loaf');
  const refused = page.getByRole('alert').filter({ hasText: '"Seeded rye" is already in PayPal' });
  await expect(refused).toBeVisible();
  // The screen now shows what the server has: the rye is in PayPal, not renamed, and no longer to publish.
  await expect(publish).toHaveText('Publish 5 items to PayPal');
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Seeded rye loaf')).toHaveCount(0);
  await expect(refused).toBeVisible();
  expect(items.byIdForShop(getDb(), shopId, rye.id)!.name).toBe('Seeded rye');
});

test('a publish that stopped after every item reached PayPal finishes from the review', async ({ page }) => {
  test.setTimeout(120_000);
  const shopId = await shopWithReading(page, recordedReading('marigold-bakehouse'));
  shops.update(getDb(), shopId, { payeeEmail: 'rosa@example.com' }); // saved before that run
  // The broken run: every item is in PayPal, but the shop never went live.
  for (const it of itemsToPublish(getDb(), shopId)) items.setPayPalProductId(getDb(), it.id, `PROD-E2E-${it.id}`);
  await page.goto(`/shops/${shopId}/setup`);
  await expect(page.getByText('6 items are already in PayPal. Open your shop to finish.')).toBeVisible();
  await page.getByRole('button', { name: 'Open your shop' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your shop is live' })).toBeVisible();
  expect(shops.byId(getDb(), shopId)).toMatchObject({ status: 'live', slug: expect.stringMatching(/^marigold-bakehouse(-\d+)?$/) });
  // The Live step's one primary action is on screen on a phone without scrolling.
  await expect(page.getByRole('button', { name: 'Copy agent door link' })).toBeInViewport();
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
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Reading your menu…' })).toBeVisible();
  // Still exactly one reading: the refresh did not start another.
  expect(extractions.latest(getDb(), shopId)!.id).toBe(run);
  extractions.fail(getDb(), run, 'AI_ERROR: e2e done');
});

test('review: each item takes a photo (add, replace, remove) and the shop takes a cover', async ({ page }) => {
  const shopId = await shopWithReading(page, crafted());
  await page.goto(`/shops/${shopId}/setup`);
  await settle(page);
  const photo = path.join('public', 'demo', 'marigold-bakehouse');
  const rye = page.locator('li[data-item="Seeded rye"]');

  // A refused file says so in the row and saves nothing.
  await rye.getByLabel('Add a photo of Seeded rye').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expect(rye.getByRole('alert')).toContainText('We couldn’t open that photo');

  await rye.getByLabel('Add a photo of Seeded rye').setInputFiles(path.join(photo, 'country-sourdough-loaf.jpg'));
  await expect(rye.getByRole('img', { name: 'Seeded rye' })).toHaveAttribute('src', /^\/i\//);
  await expect(rye.getByRole('alert')).toHaveCount(0);
  expect(items.listWithVariants(getDb(), shopId).find((i) => i.name === 'Seeded rye')!.photoUrl).toMatch(/^\/i\//);

  // Replace, then remove, from the photo's sheet.
  const first = await rye.getByRole('img', { name: 'Seeded rye' }).getAttribute('src');
  await rye.getByRole('button', { name: 'Photo of Seeded rye: replace or remove' }).click();
  const sheet = page.getByRole('dialog', { name: 'Seeded rye' });
  await sheet.getByLabel('Replace the photo of Seeded rye').setInputFiles(path.join(photo, 'butter-croissant.jpg'));
  await expect(sheet).toBeHidden();
  await expect(rye.getByRole('img', { name: 'Seeded rye' })).not.toHaveAttribute('src', first!);
  await rye.getByRole('button', { name: 'Photo of Seeded rye: replace or remove' }).click();
  await sheet.getByRole('button', { name: 'Remove photo' }).click();
  await expect(sheet).toBeHidden();
  await expect(rye.getByLabel('Add a photo of Seeded rye')).toBeAttached();
  expect(items.listWithVariants(getDb(), shopId).find((i) => i.name === 'Seeded rye')!.photoUrl).toBeNull();

  // The cover.
  await page.getByLabel('Add a cover photo').setInputFiles(path.join(photo, 'cover.jpg'));
  await expect(page.getByRole('img', { name: /cover$/ })).toBeVisible();
  expect(shops.byId(getDb(), shopId)!.coverUrl).toMatch(/^\/i\//);
  await page.getByRole('button', { name: 'Remove cover' }).click();
  await expect(page.getByLabel('Add a cover photo')).toBeAttached();
  expect(shops.byId(getDb(), shopId)!.coverUrl).toBeNull();
});

test('on a phone: Check cards keep their actions on one line, and example photos are marked on the photo', async ({ page }) => {
  const shopId = await shopWithReading(page, crafted());
  // A photo-less row, so the list holds examples.
  for (const it of items.listWithVariants(getDb(), shopId)) if (it.photoUrl) items.update(getDb(), it.id, { photoUrl: null });
  await page.goto(`/shops/${shopId}/setup`);
  await settle(page);

  // Actions: the two actions and the bin share a row inside the card; the bin keeps its name.
  const check = card(page, 'Focaccia – rosemary & sea salt');
  const looks = (await check.getByRole('button', { name: 'Looks right' }).boundingBox())!;
  const fix = (await check.getByRole('button', { name: 'Fix' }).boundingBox())!;
  const remove = check.getByRole('button', { name: 'Remove', exact: true });
  const bin = (await remove.boundingBox())!;
  expect(Math.abs(looks.y - fix.y)).toBeLessThan(1);
  expect(Math.abs(looks.y - bin.y)).toBeLessThan(1);
  expect(bin.width).toBeGreaterThanOrEqual(44);
  const inner = (await check.boundingBox())!;
  expect(bin.x + bin.width).toBeLessThanOrEqual(inner.x + inner.width);
  expect((await remove.getByText('Remove').first().boundingBox())!.width).toBeLessThanOrEqual(1); // an icon on a phone, its word for screen readers
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Examples: one disclosure per row (review F6), the seller's visible line; no corner tag and no line above the list.
  await expect(page.getByText('Example photos are marked in the corner', { exact: false })).toHaveCount(0);
  const ready = page.getByRole('region', { name: /Ready for PayPal/ });
  await expect(ready.locator('[data-example-mark]')).toHaveCount(0);
  const caption = ready.locator('[data-example-caption]').first();
  await expect(caption).toBeVisible();
  await expect(caption).toHaveText('Example photo, replace with yours');
  const row = caption.locator('xpath=ancestor::li[1]');
  await expect(row.getByLabel(/^Add a photo of /)).toBeAttached();

  // The narrowest phones keep the card's buttons inside the card.
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const box = (await check.boundingBox())!;
    const right = (await remove.boundingBox())!;
    expect(right.x + right.width, `${width} px`).toBeLessThanOrEqual(box.x + box.width);
    if (width === 360) expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); // at 320 the guest header is wider than the page, whatever the cards do
  }
});

test('on a phone: every card action row is the two-and-a-bin grid, inside its card', async ({ page }) => {
  const shopId = await shopWithReading(page, crafted());
  await page.goto(`/shops/${shopId}/setup`);
  await settle(page);

  for (const width of [390, 340, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const name of ['Looks right', 'Save price', 'Set today’s price', 'Merge']) {
      const button = page.getByRole('button', { name, exact: true }).first();
      const row = button.locator('xpath=..');
      const columns = await row.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(await row.evaluate((el) => getComputedStyle(el).display), `${name} at ${width}`).toBe('grid');
      expect(columns, `${name} at ${width}`).toBe(3);
      const card = (await button.locator('xpath=ancestor::article[1]').boundingBox())!;
      const buttons = row.locator('> button');
      for (let i = 0; i < (await buttons.count()); i++) {
        const box = (await buttons.nth(i).boundingBox())!;
        expect(box.x + box.width, `${name} row, button ${i}, at ${width}`).toBeLessThanOrEqual(card.x + card.width);
        expect(await buttons.nth(i).evaluate((el) => el.scrollWidth <= el.clientWidth), `${name} row, button ${i}, at ${width}: label fits`).toBe(true);
      }
    }
    // A row with two actions fills the width: no hole on its right.
    const pair = page.getByRole('button', { name: 'Ask in person', exact: true }).first();
    const edge = (await pair.boundingBox())!;
    const inner = await pair.locator('xpath=..').evaluate((el) => el.getBoundingClientRect().right);
    expect(Math.abs(edge.x + edge.width - inner), `Ask in person at ${width}`).toBeLessThan(1);
  }
});
