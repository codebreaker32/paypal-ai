// The item sheet and the cart (production pass addendum sections 4 and 5). The checkout route is stubbed in the browser:
// its refusals are unit-tested (tests/api/checkout-route.test.ts), and a real capture is the coordinator's gate.
//
// Run: E2E_PORT=3231 npx playwright test e2e/cart.spec.ts
import { expect, test, type Page, type Route } from '@playwright/test';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as shopsRepo from '../src/lib/db/repos/shops';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { a11y, DESKTOP, PHONE, settle } from './helpers';

const SLUG = DEMO_SHOP.slug;
const SHOP = `/s/${SLUG}`;
const ITEM = 'Almond croissant';

test.beforeAll(async () => {
  const db = getDb();
  if (!shopsRepo.bySlug(db, SLUG)) await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir: getConfig().uploadsDir });
});

const tile = (page: Page, name = ITEM) => page.locator(`li[data-menu-item="${name}"]`);
const openTile = (page: Page, name = ITEM) => tile(page, name).locator('h4 button').click();
const sheet = (page: Page) => page.locator('dialog[open]');
const addPlus = (page: Page, name = ITEM) => tile(page, name).getByRole('button', { name: `Add ${name} to your order` });
const bar = (page: Page) => page.locator('[data-order-bar]');
const stubCheckout = (page: Page, respond: (route: Route) => unknown) => page.route(`**/api/checkout/${SLUG}`, respond);
const clearCart = async (page: Page) => {
  await page.goto(SHOP);
  await page.evaluate(() => localStorage.clear());
};
const saved = (page: Page, slug = SLUG) => page.evaluate((k) => localStorage.getItem(k), `shelfie:cart:${slug}`);

async function hydrate(page: Page) {
  await expect(tile(page)).toBeVisible();
  await page.waitForFunction(() => {
    const el = document.querySelector('li[data-menu-item] button');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber'));
  });
}

test.describe('item sheet', () => {
  test.use({ viewport: PHONE });

  test('a tile opens the sheet with its title focused; Close and Back both step the history', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await openTile(page);
    await expect(sheet(page)).toBeVisible();
    await expect(page).toHaveURL(/\?item=/);
    await expect(sheet(page).getByRole('heading', { name: ITEM })).toBeFocused();
    await expect(sheet(page).getByRole('button', { name: /^Add to order/ })).toBeVisible();

    await page.goBack();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
    await expect(tile(page).locator('h4 button')).toBeFocused();

    await openTile(page);
    await sheet(page).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);

    await openTile(page);
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
  });

  test('a direct link opens the sheet and closing replaces the URL; an unknown id opens nothing', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await openTile(page);
    const href = page.url();
    await page.keyboard.press('Escape');
    await page.goto(href);
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);

    await page.goto(`${SHOP}?item=nope`);
    await hydrate(page);
    await expect(sheet(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
  });

  test('quantity and Add close the sheet and count in the bar', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await openTile(page);
    await sheet(page).getByRole('button', { name: 'One more' }).click();
    const add = sheet(page).getByRole('button', { name: /^Add to order/ });
    await expect(add).toContainText('·');
    await add.click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(bar(page).getByRole('button', { name: /View order · 2/ })).toBeVisible();
    await expect(tile(page).getByRole('button', { name: `Remove one ${ITEM}` })).toBeVisible();
    expect(await saved(page)).toContain('"qty":2');
  });

  test('Ask the assistant drafts and sends nothing', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    let sent = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/assistant')) sent += 1;
    });
    await openTile(page);
    await sheet(page).getByRole('button', { name: 'Ask the assistant' }).click();
    await expect(sheet(page).locator('textarea')).toHaveValue(`I’d like the ${ITEM}`);
    expect(sent).toBe(0);
  });

  test('axe is clean on the sheet', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await openTile(page);
    await settle(page);
    await a11y(page);
  });
});

test.describe('cart on a phone', () => {
  test.use({ viewport: PHONE });

  test('+ adds with no sheet; the bar shows the order; Back closes the cart sheet; the cart survives a reload', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await expect(sheet(page)).toHaveCount(0);
    const view = bar(page).getByRole('button', { name: /View order · 1/ });
    await expect(view).toBeVisible();
    await expect(bar(page).getByRole('button', { name: 'Order with an assistant' })).toBeVisible();
    await expect(page.locator('[data-cart-status]')).toContainText(`${ITEM} added. 1 item`);

    await view.click();
    await expect(page).toHaveURL(/order=1/);
    await expect(sheet(page).getByRole('heading', { name: 'Your order' })).toBeFocused();
    await expect(sheet(page).locator('[data-cart-line]')).toHaveCount(1);
    await expect(sheet(page).getByRole('button', { name: /^Approve \$.* on PayPal/ })).toBeVisible();
    await expect(sheet(page)).toContainText('Nothing is charged until you approve');
    await page.goBack();
    await expect(sheet(page)).toHaveCount(0);
    await page.reload();
    await hydrate(page);
    await expect(bar(page).getByRole('button', { name: /View order · 1/ })).toBeVisible();
  });

  test('removing the last line returns the bar to its empty form', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await tile(page).getByRole('button', { name: `Remove one ${ITEM}` }).click();
    await expect(bar(page).getByRole('button', { name: /Order with an assistant/ })).toBeVisible();
    await expect(addPlus(page)).toBeFocused();
    await expect(bar(page).getByRole('button', { name: /View order/ })).toHaveCount(0);
  });

  test('checkout sends lines and goes only to PayPal; SR27 rotates when the note changes', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    const bodies: { requestId: string; note?: string; expectedTotalCents: number; lines: unknown[] }[] = [];
    await stubCheckout(page, (route) => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { orderRef: 'ord_1', number: '1', approvalUrl: 'https://evil.example.com/approve', totalCents: 100 } });
    });
    await bar(page).getByRole('button', { name: /View order/ }).click();
    const pay = sheet(page).getByRole('button', { name: /on PayPal/ });
    await pay.click();
    // Not a PayPal URL: stays on the shop with an alert (SR30).
    await expect(sheet(page).getByRole('alert')).toContainText('can’t reach PayPal');
    expect(new URL(page.url()).pathname).toBe(SHOP);
    expect(bodies[0].lines).toEqual([expect.objectContaining({ quantity: 1 })]);
    expect(Object.keys(bodies[0])).not.toContain('price');
    expect(bodies[0].expectedTotalCents).toBeGreaterThan(0);

    await pay.click();
    await sheet(page).getByPlaceholder('Allergies, timing').fill('no nuts');
    await pay.click();
    await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(3);
    expect(bodies[1].requestId).toBe(bodies[0].requestId);
    expect(bodies[2].requestId).not.toBe(bodies[1].requestId);
    expect(bodies[2].note).toBe('no nuts');
  });

  for (const [code, status, message] of [
    ['PAYPAL_UNAVAILABLE', 502, 'We can’t reach PayPal right now.'],
    ['RATE_LIMITED', 429, 'You’ve tried a lot in the last hour.'],
    ['TOO_MANY_OPEN_ORDERS', 409, 'You have orders waiting for payment here.'],
    ['SHOP_NOT_ACCEPTING_ORDERS', 409, 'isn’t taking orders right now.'],
    ['PRICE_CHANGED', 409, 'Prices changed. Check your total, then try again.'],
  ] as const) {
    test(`${code} shows its line and keeps the cart`, async ({ page }) => {
      await clearCart(page);
      await hydrate(page);
      await addPlus(page).click();
      await stubCheckout(page, (route) => route.fulfill({ status, json: { error: { code, message } } }));
      await bar(page).getByRole('button', { name: /View order/ }).click();
      await sheet(page).getByRole('button', { name: /on PayPal/ }).click();
      await expect(sheet(page).getByRole('alert')).toContainText(message);
      await expect(sheet(page).locator('[data-cart-line]')).toHaveCount(1);
      expect(await saved(page)).toContain('qty');
    });
  }

  test('ITEM_UNAVAILABLE takes the line out and says so', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    const stored = JSON.parse((await saved(page))!);
    const itemId = stored.lines[0].itemId;
    await stubCheckout(page, (route) => route.fulfill({ status: 409, json: { error: { code: 'ITEM_UNAVAILABLE', message: `${ITEM} is no longer available, so we took it out.`, itemId } } }));
    await bar(page).getByRole('button', { name: /View order/ }).click();
    await sheet(page).getByRole('button', { name: /on PayPal/ }).click();
    await expect(sheet(page).getByRole('alert')).toContainText('so we took it out');
    await expect(sheet(page).locator('[data-cart-line]')).toHaveCount(0);
    await expect(sheet(page).locator('[data-cart-empty]')).toBeVisible();
  });

  test('a cart that names something no longer on the menu loses it, with one line', async ({ page }) => {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [`shelfie:cart:${SLUG}`, JSON.stringify({ savedAt: Date.now(), lines: [{ itemId: 'gone', optionId: 'o', qty: 1 }] })] as const);
    await page.goto(SHOP);
    await hydrate(page);
    await expect(bar(page).getByRole('button', { name: /View order/ })).toHaveCount(0);
    await expect(page.locator('[data-toast-region]')).toContainText('no longer available, so we took it out');
    await expect.poll(async () => (await saved(page)) ?? '').not.toContain('gone');
  });

  test('axe is clean with the cart open', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await bar(page).getByRole('button', { name: /View order/ }).click();
    await expect(sheet(page).locator('[data-cart-line]')).toHaveCount(1);
    await settle(page);
    await a11y(page);
  });
});

test.describe('cart in the dock', () => {
  test.use({ viewport: DESKTOP });
  const dock = (page: Page) => page.locator('[data-assistant-dock]');
  const hero = (page: Page) => page.getByRole('button', { name: /View order/ }).filter({ visible: true }).first();

  test('hero order button opens the cart in the same dock, one panel at a time', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await hero(page).click();
    await expect(dock(page).getByRole('heading', { name: 'Your order' })).toBeFocused();
    await expect(dock(page).locator('[data-cart-line]')).toHaveCount(1);
    await settle(page);
    const box = (await dock(page).boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(Math.round(box.x + box.width)).toBe(width);
    expect(box.y).toBe(0);
    expect(box.height).toBe(page.viewportSize()!.height);

    await dock(page).getByRole('button', { name: 'Assistant', exact: true }).click();
    await expect(dock(page).locator('[data-cart-panel]')).toHaveCount(0);
    await expect(dock(page).getByRole('heading', { name: 'Order with an assistant' })).toBeVisible();
    await expect(page.locator('[data-assistant-dock]')).toHaveCount(1);

    await dock(page).getByRole('button', { name: 'Close the assistant' }).click();
    await expect(dock(page)).toHaveCount(0);
    await hero(page).click();
    await expect(dock(page).locator('[data-cart-panel]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dock(page)).toHaveCount(0);
    await expect(hero(page)).toBeFocused();
  });

  test('removing the last line from the dock shows the empty state', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await hero(page).click();
    await dock(page).getByRole('button', { name: `Remove one ${ITEM}` }).click();
    await expect(dock(page).locator('[data-cart-empty]')).toContainText('Add something from the menu and it shows up here.');
    await expect(dock(page).getByRole('heading', { name: 'Your order', exact: true }).first()).toBeFocused();
  });

  test('axe is clean with the cart docked', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await hero(page).click();
    await expect(dock(page).locator('[data-cart-line]')).toHaveCount(1);
    await settle(page);
    await a11y(page);
  });
});
