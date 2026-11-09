// The whole product, live: Start → Try a sample menu (Marigold) → Reading (real Claude) → Review (fix every flagged
// card) → Publish (real PayPal sandbox catalog) → Live → the shop page → the buyer console orders "two almond
// croissants, pickup" through the shop's real agent door (real Claude, real MCP over HTTP, real PayPal Orders v2) →
// the Activity panel lists the MCP calls → the approval card shows the right total and a PayPal sandbox link.
// It stops at the approval link (e2e/capture.spec.ts approves and captures).
// Needs ANTHROPIC_API_KEY, PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY in .env; skipped without them.
// Run: E2E_PORT=3111 npx playwright test e2e/flow.spec.ts
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { config } from 'dotenv';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DESKTOP, PHONE, appNav, settle } from './helpers';

config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
const HAS_KEYS = Boolean(process.env.ANTHROPIC_API_KEY && process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET_KEY);

async function accessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Resolves one flagged card the way a seller would with one thumb. */
async function fix(card: Locator) {
  for (const name of ['Looks right', 'Ask in person', 'Keep both']) {
    const button = card.getByRole('button', { name, exact: true });
    if (await button.count()) return button.click();
  }
  // A missing price: type one on the keypad.
  for (const input of await card.getByRole('textbox').all()) await input.fill('5');
  await card.getByRole('button', { name: 'Save price' }).click();
}

const cents = (price: string) => Math.round(Number(price.replace(/[$,]/g, '')) * 100);
const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

test('a sample menu becomes a live PayPal shop, and an AI assistant orders from it through the agent door', async ({ page }) => {
  test.skip(!HAS_KEYS, 'Needs ANTHROPIC_API_KEY and PayPal sandbox keys in .env.');
  test.setTimeout(480_000);

  // Start → sample
  await page.setViewportSize(PHONE);
  await page.goto('/');
  await page.getByRole('button', { name: /Marigold Bakehouse/ }).click();
  await page.waitForURL(/\/shops\/shp_[a-z0-9]+\/setup$/);

  // Reading (real Claude)
  await expect(page.getByRole('heading', { level: 1, name: 'Reading your menu…' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Your menu photo/ })).toBeVisible();

  // Review: fix every flagged card
  await expect(page.getByRole('heading', { level: 1, name: 'Check your menu' })).toBeVisible({ timeout: 180_000 });
  await settle(page);
  await expect(page.getByText(/\d+ items · \d+ needs? you/)).toBeVisible();
  await accessible(page);
  const needs = page.locator('section[aria-labelledby="needs-title"] article');
  const flagged = await needs.count();
  expect(flagged).toBeGreaterThan(0);
  for (let left = flagged; left > 0; left = await needs.count()) {
    await fix(needs.first());
    await expect(needs).toHaveCount(left - 1);
  }
  await page.getByRole('radio', { name: /Both/ }).check();
  await page.getByLabel('Flat shipping fee').fill('8');
  // Where buyers' money goes (spec §8a): the sandbox seller when .env names one. Never printed.
  await page.getByLabel('Your PayPal email').fill(process.env.PAYPAL_SANDBOX_SELLER_EMAIL || 'seller@example.com');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  // Publish (real PayPal sandbox catalog) → Live
  const publish = page.getByRole('button', { name: /^Publish \d+ items? to PayPal$/ });
  const count = Number((await publish.innerText()).match(/\d+/)![0]);
  await publish.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your shop is live' })).toBeVisible({ timeout: 150_000 });
  await settle(page);
  await expect(page.getByText(new RegExp(`^${count} items are in your PayPal catalog`))).toBeVisible();
  await expect(page.getByText(/^https?:\/\/\S+\/s\/marigold-bakehouse-\d+\/mcp$/)).toBeVisible(); // never the demo shop's slug
  await expect(page.getByText(/\/claim\/[A-Za-z0-9_-]{40,}$/)).toHaveCount(0); // the owner link no longer shows here
  await expect(appNav(page).getByRole('link', { name: /Orders/ })).toHaveAttribute('href', /\/shops\/shp_/);
  await accessible(page);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Your shop is live' })).toBeVisible();

  // The shop page
  await page.getByRole('link', { name: 'Open your shop' }).first().click(); // header and preview card both have it
  await page.waitForURL(/\/s\/marigold-bakehouse-\d+$/);
  const slug = new URL(page.url()).pathname.split('/')[2];
  await expect(page.getByRole('heading', { level: 1, name: 'Marigold Bakehouse' })).toBeVisible();
  const almond = page.getByRole('listitem').filter({ hasText: 'Almond croissant' }).first();
  const unit = cents((await almond.innerText()).match(/\$\d+\.\d{2}/)![0]);
  await accessible(page);

  // The buyer console orders through the shop's agent door (real Claude, real MCP, real PayPal order)
  await page.setViewportSize(DESKTOP);
  await page.getByRole('button', { name: 'Order with an assistant' }).filter({ visible: true }).first().click();
  const region = page.getByRole('complementary', { name: 'Order with an assistant' });
  const input = region.getByRole('textbox', { name: 'Message to the assistant' });
  const approve = region.getByRole('link', { name: /^Approve \$[\d,.]+ on PayPal$/ });
  const say = async (text: string) => {
    await input.fill(text);
    await region.getByRole('button', { name: 'Send' }).click();
    await expect(region.getByRole('button', { name: 'Start over' })).toBeVisible({ timeout: 150_000 });
  };
  await say('Two almond croissants, pickup');
  // The assistant reads the order back and waits for a yes (it may ask once more before it places it).
  for (let turn = 0; turn < 3 && !(await approve.count()); turn++) await say('Yes, place it');
  await expect(approve).toBeVisible();

  // The Activity panel shows the agent door calls, ending with create_order.
  const activity = region.getByRole('group', { name: 'Activity', exact: true });
  await expect(activity.first()).toBeVisible();
  const calls = (await activity.allInnerTexts()).join('\n');
  expect(calls).toMatch(/list_products/);
  expect(calls).toMatch(/create_order/);
  await expect(region.locator('summary', { hasText: 'create_order' }).last()).toContainText(/awaiting approval/);

  // The approval card: 2 × the menu's almond croissant price, pickup (no shipping), a real PayPal sandbox link.
  const total = dollars(unit * 2);
  await expect(approve).toHaveAccessibleName(`Approve ${total} on PayPal`);
  await expect(approve).toHaveAttribute('href', /^https:\/\/www\.sandbox\.paypal\.com\/checkoutnow\?token=[A-Z0-9]+/);
  await expect(region.locator('summary', { hasText: 'create_order' }).last()).toContainText(total);
  await accessible(page);
  console.log(`[flow] ${slug}: ${count} items published; console order ${total} awaiting approval on PayPal`);
});
