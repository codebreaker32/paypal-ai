// Deleting a shop (brief S1): the sheet's two confirmations, and what is left afterwards. The menu reading is written
// straight into the database (no Claude); the publish is a real PayPal sandbox catalog call.
// Run: E2E_PORT=3265 npx playwright test e2e/delete.spec.ts
import path from 'node:path';
import { config } from 'dotenv';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { recordedReading } from '@/lib/ai/samples';
import { runReading } from '@/lib/catalog/setup';
import { getDb } from '@/lib/db';
import { DESKTOP, settle } from './helpers';

config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
const HAS_PAYPAL = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET_KEY);

const PASSWORD = 'a long sentence only this test says';

async function signUp(page: Page) {
  const email = `e2e-delete-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const res = await page.request.post('/api/auth/signup', { data: { email, password: PASSWORD } });
  expect(res.status()).toBe(201);
}

async function startShop(page: Page, name: string): Promise<string> {
  const res = await page.request.post('/api/shops', { data: { sample: 'marigold-bakehouse' } });
  expect(res.status()).toBe(201);
  const { shopId } = (await res.json()) as { shopId: string };
  await runReading({ db: getDb(), hasAiKey: true, extract: async () => recordedReading('marigold-bakehouse') }, shopId);
  const renamed = await page.request.patch(`/api/shops/${shopId}`, { data: { name } });
  expect(renamed.status()).toBe(200);
  return shopId;
}

/** Resolves one flagged card the way a seller would. */
async function fix(card: Locator) {
  for (const name of ['Looks right', 'Ask in person', 'Keep both']) {
    const button = card.getByRole('button', { name, exact: true });
    if (await button.count()) return button.click();
  }
  for (const input of await card.getByRole('textbox').all()) await input.fill('5');
  await card.getByRole('button', { name: 'Save price' }).click();
}

/** Publishes through the setup screen and returns the shop's public path. */
async function publish(page: Page, shopId: string): Promise<string> {
  await page.goto(`/shops/${shopId}/setup`);
  await expect(page.getByRole('heading', { level: 1, name: 'Check your menu' })).toBeVisible();
  await settle(page);
  const needs = page.locator('section[aria-labelledby="needs-title"] article');
  for (let left = await needs.count(); left > 0; left = await needs.count()) {
    await fix(needs.first());
    await expect(needs).toHaveCount(left - 1);
  }
  await page.getByRole('radio', { name: /Both/ }).check();
  await page.getByLabel('Flat shipping fee').fill('8');
  await page.getByLabel('Your PayPal email').fill(process.env.PAYPAL_SANDBOX_SELLER_EMAIL || 'seller@example.com');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Publish \d+ items? to PayPal$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your shop is live' })).toBeVisible({ timeout: 150_000 });
  await settle(page);
  return (await page.getByRole('link', { name: 'Open your shop' }).first().getAttribute('href'))!;
}

async function openSheet(page: Page, shopId: string): Promise<Locator> {
  await page.goto(`/shops/${shopId}?tab=settings`);
  await expect(page.getByRole('heading', { level: 2, name: 'Delete this shop' })).toBeVisible();
  await settle(page);
  await page.getByRole('button', { name: 'Delete shop' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  return sheet;
}

async function confirm(sheet: Locator, name: string, password: string) {
  await sheet.getByLabel('Type the shop’s name to confirm').fill(name);
  await sheet.getByLabel('Your password', { exact: true }).fill(password);
  await sheet.getByRole('button', { name: 'Delete shop' }).click();
}

test.use({ viewport: DESKTOP });

test('a wrong name blocks the delete, and nothing is sent', async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  const name = `Delete Blocked ${Date.now()}`;
  const shopId = await startShop(page, name);

  let deletes = 0;
  page.on('request', (r) => {
    if (r.method() === 'DELETE' && r.url().endsWith(`/api/shops/${shopId}`)) deletes += 1;
  });

  const sheet = await openSheet(page, shopId);
  await expect(sheet.getByRole('heading', { name: `Delete ${name}?` })).toBeVisible();
  await confirm(sheet, 'Not the name', PASSWORD);
  await expect(sheet.getByText('Type the shop’s name exactly as it appears.')).toBeVisible();
  expect(deletes).toBe(0);

  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();
  await page.goto('/shops');
  await expect(page.getByTestId('shop-row')).toHaveCount(1);
});

test('the wrong password is refused and the shop stays', async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  const name = `Delete Password ${Date.now()}`;
  const shopId = await startShop(page, name);

  const sheet = await openSheet(page, shopId);
  await confirm(sheet, name, 'not the password of this account');
  await expect(sheet.getByText('That password doesn’t match.')).toBeVisible();
  await page.goto('/shops');
  await expect(page.getByTestId('shop-row')).toHaveCount(1);
});

test('the right name deletes it: gone from /shops, its page is a 404, and its address is never reused', async ({ page }) => {
  test.skip(!HAS_PAYPAL, 'Needs PayPal sandbox keys in .env.');
  test.setTimeout(480_000);
  await signUp(page);
  const name = `Delete Me ${Date.now()}`;

  const firstId = await startShop(page, name);
  const firstHref = await publish(page, firstId);

  const sheet = await openSheet(page, firstId);
  await confirm(sheet, name, PASSWORD);
  await page.waitForURL('**/shops');
  await expect(page.getByTestId('shop-row')).toHaveCount(0);
  expect((await page.goto(firstHref))?.status()).toBe(404);

  const secondId = await startShop(page, name);
  expect(await publish(page, secondId)).toBe(`${firstHref}-2`);
});
