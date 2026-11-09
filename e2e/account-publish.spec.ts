// A real account from end to end (brief WP7 acceptance 6), and setup's ways out for an account's draft.
// The menu reading is written straight into the database (no Claude); the publish is a real PayPal sandbox catalog call.
// Run: E2E_PORT=3251 npx playwright test e2e/account-publish.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { recordedReading } from '@/lib/ai/samples';
import type { MenuExtraction } from '@/lib/ai/schemas';
import { runReading } from '@/lib/catalog/setup';
import { getDb } from '@/lib/db';
import { DESKTOP, appNav, settle } from './helpers';

config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
const HAS_PAYPAL = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET_KEY);

const NOT_A_MENU = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../tests/ai/fixtures/not-a-menu.json'), 'utf8')) as MenuExtraction;
const PASSWORD = 'a long sentence only this test says';
const email = (tag: string) => `e2e-publish-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function signUpThroughTheForm(page: Page) {
  await page.goto('/signup');
  await page.locator('#signup-email').fill(email('form'));
  await page.locator('#new-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Save your recovery key' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('**/shops/new');
}

async function signUp(page: Page) {
  const res = await page.request.post('/api/auth/signup', { data: { email: email('api'), password: PASSWORD } });
  expect(res.status()).toBe(201);
}

async function startSample(page: Page): Promise<string> {
  const res = await page.request.post('/api/shops', { data: { sample: 'marigold-bakehouse' } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { shopId: string }).shopId;
}

/** The sample's reading, or `raw`, or a failure, without Claude. */
async function read(shopId: string, raw: MenuExtraction | Error = recordedReading('marigold-bakehouse')) {
  await runReading({ db: getDb(), hasAiKey: true, extract: async () => { if (raw instanceof Error) throw raw; return raw; } }, shopId);
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

test.use({ viewport: DESKTOP });

test('sign up, publish a sample, open the dashboard and the shop page', async ({ page }) => {
  test.skip(!HAS_PAYPAL, 'Needs PayPal sandbox keys in .env.');
  test.setTimeout(240_000);

  await signUpThroughTheForm(page);
  const shopId = await startSample(page);
  await read(shopId);
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
  const shopHref = await page.getByRole('link', { name: 'Open your shop' }).first().getAttribute('href');
  expect(shopHref).toMatch(/^\/s\/marigold-bakehouse-\d+$/);

  // The account's own shop: / now goes straight to its dashboard, and the list no longer calls it a draft.
  await page.goto('/');
  await page.waitForURL(`**/shops/${shopId}`);
  await expect(appNav(page).getByRole('link', { name: /Orders/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible();
  await page.goto('/shops');
  await expect(page.getByTestId('shop-row')).toHaveCount(1);
  await expect(page.getByTestId('shop-row').first()).not.toContainText('Not published yet');

  const shop = await page.goto(shopHref!);
  expect(shop?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Marigold Bakehouse' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Almond croissant' }).first()).toBeVisible();
});

test.describe('the ways out of setup, for an account whose only shop is this draft', () => {
  test('Cancel on the reading step leaves it', async ({ page }) => {
    await signUp(page);
    const shopId = await startSample(page);
    await page.route('**/api/shops/*/extract', () => {}); // the reading never answers, and Claude is never called
    await page.goto(`/shops/${shopId}/setup`);
    await expect(page.getByRole('heading', { level: 1, name: 'Reading your menu…' })).toBeVisible();
    await page.getByRole('link', { name: 'Cancel' }).click();
    await page.waitForURL('**/shops/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Add a shop' })).toBeVisible();
  });

  test('Start over on a failed reading leaves it', async ({ page }) => {
    await signUp(page);
    const shopId = await startSample(page);
    await read(shopId, new Error('Request timed out.'));
    await page.goto(`/shops/${shopId}/setup`);
    await expect(page.getByRole('heading', { level: 1, name: 'Reading didn’t finish' })).toBeVisible();
    await page.getByRole('link', { name: 'Start over' }).click();
    await page.waitForURL('**/shops/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Add a shop' })).toBeVisible();
  });

  test('Try a sample menu instead shows the samples', async ({ page }) => {
    await signUp(page);
    const shopId = await startSample(page);
    await read(shopId, NOT_A_MENU);
    await page.goto(`/shops/${shopId}/setup`);
    await page.getByRole('link', { name: 'Try a sample menu instead' }).click();
    await page.waitForURL('**/shops/new?samples=1');
    await expect(page.getByText('No photo handy? Try a sample:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try the sample menu from Marigold Bakehouse' })).toBeVisible();
  });
});
