// The seller app shell (spec WP4): sidebar and tab bar, section switching without a server round trip, the one banner
// slot, skip link and landmarks. Run: E2E_PORT=3221 npx playwright test e2e/app-shell.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, a11y, appNav } from './helpers';
import { createFixtureShop, seedAllStates, signInAsOwner, type FixtureShop } from './task8-fixtures';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const hideDevBadge = (page: Page) => page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

let shop: FixtureShop;
let orderId: string;

test.beforeAll(() => {
  shop = createFixtureShop('Shell Test Bakery');
  orderId = seedAllStates(shop).nutOrder.id;
});

test.beforeEach(async ({ context }) => {
  await signInAsOwner(context, shop, BASE);
});

test.describe('at 1440', () => {
  test.use({ viewport: DESKTOP });

  test('the sidebar has the four sections, Orders current, and no tabs', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await expect(appNav(page).getByRole('link')).toHaveText([/Orders/, 'Menu', 'Share', 'Settings']);
    await expect(appNav(page).getByRole('link', { name: /Orders/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('tab')).toHaveCount(0);
    await a11y(page);
  });

  test('sections switch in place: Back returns, with no RSC request and the page intact', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __marker: number }).__marker = 1;
    });
    const rsc: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('_rsc=')) rsc.push(r.url());
    });
    await appNav(page).getByRole('link', { name: 'Menu' }).click();
    await expect(page).toHaveURL(/\?tab=menu/);
    await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeFocused();
    await expect(page).toHaveTitle('Menu · Shell Test Bakery · Shelfie');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    await expect(appNav(page).getByRole('link', { name: /Orders/ })).toHaveAttribute('aria-current', 'page');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
    expect(rsc).toEqual([]);
  });

  test('deep links, and the active link on order detail and the counter card', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}?tab=settings`);
    await expect(appNav(page).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-section-panel]')).toHaveCount(1);
    await page.goto(`/shops/${shop.shop.id}/orders/${orderId}`);
    await expect(appNav(page).getByRole('link', { name: /Orders/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '24px');
    await page.goto(`/shops/${shop.shop.id}/card`);
    await expect(appNav(page).getByRole('link', { name: 'Share' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1, name: 'Counter card' })).toHaveCSS('font-size', '24px');
  });

  test('the shell replaces the site chrome, with one skip link to the content', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await expect(page.locator('body > header, body > footer')).toHaveCount(0);
    await expect(page.locator('[data-site-chrome]').first()).toBeHidden();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toHaveCount(1);
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#app-content')).toBeFocused();
  });

  test('no sideways scroll at 1024 and 1440', async ({ page }) => {
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const query of ['', '?tab=menu', '?tab=share', '?tab=settings']) {
        await page.goto(`/shops/${shop.shop.id}${query}`);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, `${width} ${query}`).toBeLessThanOrEqual(0);
      }
    }
  });
});

test.describe('at 390', () => {
  test.use({ viewport: PHONE });

  test('the tab bar sits at the foot with 44 px links, the sidebar hidden, and content clear of it', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await hideDevBadge(page);
    const nav = appNav(page);
    const box = (await nav.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(PHONE.height);
    for (const link of await nav.getByRole('link').all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('shop-switcher')).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = page.locator('#app-content > p').last();
    await expect(last).toHaveText(/PayPal sandbox/);
    const lastBox = (await last.boundingBox())!;
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(box.y);
    await a11y(page);
  });

  test('the Share link switches sections from the tab bar', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await hideDevBadge(page);
    await appNav(page).getByRole('link', { name: 'Share' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Share' })).toBeVisible();
    await expect(appNav(page).getByRole('link', { name: 'Share' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('banners', () => {
  test.use({ viewport: DESKTOP });

  test('pausing shows the banner on all four sections; Resume sends live and clears it', async ({ page, context }) => {
    const paused = createFixtureShop('Pause Banner Bakery');
    await signInAsOwner(context, paused, BASE);
    await page.goto(`/shops/${paused.shop.id}`);
    await page.getByRole('switch', { name: 'Pause agent orders' }).click();
    const banner = page.getByRole('status').filter({ hasText: 'Agent orders paused.' });
    await expect(banner).toBeVisible();
    for (const name of ['Menu', 'Share', 'Settings', 'Orders']) {
      await appNav(page).getByRole('link', { name: new RegExp(`^${name}`) }).click();
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      await expect(banner).toBeVisible();
    }
    const sent = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().endsWith(`/api/shops/${paused.shop.id}`));
    await banner.getByRole('button', { name: 'Resume' }).click();
    expect((await sent).postDataJSON()).toMatchObject({ status: 'live' });
    await expect(banner).toBeHidden();
  });

  test('one banner at a time: a missing payee outranks paused', async ({ page, context }) => {
    const noPayee = createFixtureShop('No Payee Bakery', { payeeEmail: null });
    await signInAsOwner(context, noPayee, BASE);
    await page.goto(`/shops/${noPayee.shop.id}`);
    const banner = page.getByRole('status').filter({ hasText: 'Not taking orders: add your PayPal email.' });
    await expect(banner).toBeVisible();
    await page.getByRole('switch', { name: 'Pause agent orders' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Agent orders paused.' })).toHaveCount(0);
    await banner.getByRole('link', { name: 'Add email' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });
});
