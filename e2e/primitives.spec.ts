// Button states, Copy and Switch against the real dashboard (production-pass WP1, acceptance 9, 10 and 11).
// Fixture data is written straight to data/e2e.db (see e2e/task8-fixtures.ts); only the routes under test are mocked.
//
// Run: E2E_PORT=3201 npx playwright test e2e/primitives.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP } from './helpers';
import { addFixtureOrder, createFixtureShop, signInAsOwner, type FixtureShop } from './task8-fixtures';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;

let shop: FixtureShop;

test.beforeAll(() => {
  shop = createFixtureShop('Press Test Bakery');
});

test.beforeEach(async ({ page, context }) => {
  await page.setViewportSize(DESKTOP);
  await signInAsOwner(context, shop, BASE);
});

const dashboard = (query = '') => `/shops/${shop.shop.id}${query}`;
const toasts = (page: Page) => page.locator('[data-toast-region] > *');

test('a held response keeps the button width, and the spinner waits for the pending delay (9)', async ({ page }) => {
  const o = addFixtureOrder(shop, {
    status: 'paid', fulfillment: 'pickup', minutesAgo: 2, buyerName: 'Kim', lines: [['Morning bun', 1]],
    payer: { name: 'Kim Tran', email: 'kim@example.com' },
  });
  await page.route(`**/api/shops/${shop.shop.id}/orders/${o.id}/fulfil`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto(dashboard());
  const button = page.locator(`[data-order="${o.number}"]`).getByRole('button', { name: 'Mark picked up' });
  await expect(button).toBeVisible();
  await expect.poll(async () => button.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

  const samples = await button.evaluate(async (el: HTMLElement) => {
    const layer = el.querySelector<HTMLElement>('[data-layer="loading"]')!;
    const widthBefore = el.getBoundingClientRect().width;
    const start = performance.now();
    el.click();
    const out: { t: number; w: number; visible: boolean }[] = [];
    while (performance.now() - start < 700) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const style = getComputedStyle(layer);
      out.push({ t: performance.now() - start, w: el.getBoundingClientRect().width, visible: style.visibility === 'visible' && Number(style.opacity) > 0.5 });
    }
    return { widthBefore, out };
  });

  const widths = samples.out.map((s) => s.w);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.5);
  expect(Math.abs(widths[0] - samples.widthBefore)).toBeLessThan(0.5);
  expect(samples.out.filter((s) => s.t < 100).some((s) => s.visible)).toBe(false);
  const late = samples.out.filter((s) => s.t >= 400);
  expect(late.length).toBeGreaterThan(0);
  expect(late.every((s) => s.visible)).toBe(true);
});

test('Copy shows Copied with a tick for about 2 s and no toast (10)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(dashboard('?tab=share'));
  const copy = page.getByRole('button', { name: 'Copy agent door link' });
  // offsetWidth is the laid-out width: a press is still scaling the button when it is read.
  const width = await copy.evaluate((el: HTMLElement) => el.offsetWidth);
  await copy.click();

  const done = page.getByRole('button', { name: /agent door link copied/i });
  await expect(done).toBeVisible();
  await expect(done.getByText('Copied')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /agent door link copied/i })).toBeAttached();
  expect(await done.evaluate((el: HTMLElement) => el.offsetWidth)).toBe(width);
  expect(await toasts(page).count()).toBe(0);

  await expect(copy).toBeVisible({ timeout: 3000 });
  expect(await toasts(page).count()).toBe(0);
});

test('a refused clipboard shows the failure toast (10)', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  await page.goto(dashboard('?tab=share'));
  await page.getByRole('button', { name: 'Copy agent door link' }).click();
  await expect(toasts(page).first()).toContainText('Couldn’t copy');
  await expect(toasts(page).first()).toContainText('Select the text and copy it yourself.');
});

test('a failed pause rolls the switch back, shakes it and shows the inline alert; a success adds no toast (11)', async ({ page }) => {
  await page.route(`**/api/shops/${shop.shop.id}`, (route) =>
    route.fulfill({ json: { shop: { ...shop.shop, status: 'paused' } } }),
  );
  await page.goto(dashboard());
  const toggle = page.getByRole('switch', { name: 'Pause agent orders' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(toggle).not.toHaveAttribute('data-nope');
  expect(await toasts(page).count()).toBe(0);

  await page.unroute(`**/api/shops/${shop.shop.id}`);
  await page.route(`**/api/shops/${shop.shop.id}`, (route) =>
    route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: 'Couldn’t save. Try again.' } } }),
  );
  await toggle.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Couldn’t save');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(toggle).toHaveAttribute('data-nope', 'true');
});

test('a Sold out switch never dims or goes natively disabled while it saves', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/shops/${shop.shop.id}/items`, async (route) => {
    await gate;
    await route.fulfill({ json: { items: [] } });
  });
  await page.goto(dashboard('?tab=menu'));
  const sw = page.getByRole('switch', { name: 'Almond croissant: Sold out today' });
  await sw.click();
  await expect(sw).toHaveAttribute('aria-disabled', 'true');
  await expect(sw).toHaveAttribute('aria-busy', 'true');
  await expect(sw).toBeEnabled({ enabled: false }); // Playwright counts aria-disabled as disabled
  expect(await sw.evaluate((el: HTMLButtonElement) => el.disabled)).toBe(false);
  const track = sw.locator('> span');
  expect(await track.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  release();
  await expect(sw).not.toHaveAttribute('aria-busy');
  expect(await toasts(page).count()).toBe(0);
});
