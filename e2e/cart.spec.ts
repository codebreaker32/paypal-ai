// The item sheet and the cart. The checkout route is stubbed in the browser:
// its refusals are unit-tested (tests/api/checkout-route.test.ts), and a real capture is covered by e2e/capture.spec.ts.
//
// Run: E2E_PORT=3231 npx playwright test e2e/cart.spec.ts
import { expect, test, type Page, type Route } from '@playwright/test';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as itemsRepo from '../src/lib/db/repos/items';
import * as shopsRepo from '../src/lib/db/repos/shops';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { a11y, DESKTOP, PHONE, settle } from './helpers';

const SLUG = DEMO_SHOP.slug;
const SHOP = `/s/${SLUG}`;
const ITEM = 'Almond croissant';

const BIG_NAME = 'E2E Cart Big Shop';
const BIG_ITEM = 'Wedding cake';
let bigSlug = '';

test.beforeAll(async () => {
  const db = getDb();
  if (!shopsRepo.bySlug(db, SLUG)) await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir: getConfig().uploadsDir });

  // A pickup-or-shipping shop whose one item is dear enough that two pass the $500.00 cap.
  for (const o of db.prepare('SELECT id FROM shops WHERE name = ?').all(BIG_NAME) as { id: string }[]) db.prepare('DELETE FROM shops WHERE id = ?').run(o.id);
  const { shop } = shopsRepo.create(db, { name: BIG_NAME, about: 'A test shop.', fulfillment: 'both', pickupNotes: 'Fridays', shippingFeeCents: 800 });
  const [item] = itemsRepo.replaceDrafts(db, shop.id, [
    { section: 'Cakes', name: BIG_ITEM, description: 'Three tiers.', sourceText: BIG_ITEM, confidence: 'high' as const, kind: 'PHYSICAL' as const, issues: [], issueDetail: null, status: 'draft' as const, variants: [{ label: null, priceCents: 30000 }] },
  ]);
  itemsRepo.setPayPalProductId(db, item.id, `PROD-E2E-CART-${shop.id}`);
  shopsRepo.publish(db, shop.id);
  bigSlug = shopsRepo.update(db, shop.id, { payeeEmail: 'seller@example.com', orderCapCents: 50000 }).slug;
});

test.afterAll(() => {
  const db = getDb();
  for (const o of db.prepare('SELECT id FROM shops WHERE name = ?').all(BIG_NAME) as { id: string }[]) db.prepare('DELETE FROM shops WHERE id = ?').run(o.id);
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
const saved = (page: Page, slug: string = SLUG) => page.evaluate((k) => localStorage.getItem(k), `shelfie:cart:${slug}`);

/** The `router.refresh()` a PRICE_CHANGED asks for. Set up before the click that causes it. */
const rscRefresh = (page: Page) => page.waitForResponse((r) => new URL(r.url()).pathname === SHOP && r.request().headers()['rsc'] === '1' && r.ok());

async function hydrate(page: Page, name = ITEM) {
  await expect(tile(page, name)).toBeVisible();
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

    const warnings: string[] = [];
    page.on('console', (m) => {
      if (m.text().includes('flushSync')) warnings.push(m.text());
    });
    await page.goto(`${SHOP}?item=nope`);
    await hydrate(page);
    await expect(sheet(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
    expect(warnings).toEqual([]);
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

  test('an add control answers with one warm sound, not a tick and then the warm one', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await page.evaluate(() => {
      const w = window as unknown as { heard: string[] };
      w.heard = [];
      window.addEventListener('shelfie:feedback', (e) => w.heard.push((e as CustomEvent<{ event: string }>).detail.event));
    });
    await addPlus(page).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { heard: string[] }).heard)).toEqual(['add']);
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

  test('checkout sends lines and goes only to PayPal; the request id rotates when the note changes', async ({ page }) => {
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
    // Not a PayPal URL: stays on the shop with an alert.
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

  test('a good approval URL leaves for PayPal, with the pending order saved and the cart kept', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    const approvalUrl = 'https://www.sandbox.paypal.com/checkoutnow?token=E2E-CART';
    await page.route('https://www.sandbox.paypal.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>PayPal</title>' }));
    await stubCheckout(page, (route) => route.fulfill({ status: 201, json: { orderRef: 'ord_e2e', number: '7', approvalUrl, totalCents: 100 } }));
    await bar(page).getByRole('button', { name: /View order/ }).click();
    await sheet(page).getByRole('button', { name: /on PayPal/ }).click();
    await page.waitForURL(approvalUrl);
    // localStorage belongs to the shop's origin, so read it back there.
    await page.goto(SHOP);
    expect(await page.evaluate((k) => localStorage.getItem(k), `shelfie:cart:${SLUG}:pending`)).toBe('ord_e2e');
    expect(await saved(page)).toContain('qty');
  });

  test('in flight: the button says Opening PayPal and the controls are disabled', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await stubCheckout(page, async (route) => {
      await held;
      await route.fulfill({ status: 502, json: { error: { code: 'PAYPAL_UNAVAILABLE', message: 'We can’t reach PayPal right now.' } } });
    });
    await bar(page).getByRole('button', { name: /View order/ }).click();
    await sheet(page).getByRole('button', { name: /on PayPal/ }).click();
    await expect(sheet(page).getByRole('button', { name: /Opening PayPal/ })).toBeDisabled();
    await expect(sheet(page).getByPlaceholder('Allergies, timing')).toBeDisabled();
    await expect(sheet(page).getByRole('button', { name: `Add one ${ITEM}` })).toBeDisabled();
    release();
    await expect(sheet(page).getByRole('alert')).toContainText('can’t reach PayPal');
    await expect(sheet(page).getByPlaceholder('Allergies, timing')).toBeEnabled();
  });

  test('the shop-wide open-order limit shows the line that does not blame the buyer', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    const message = 'Marigold Bakehouse has a lot of orders waiting for payment right now. Try again in a few minutes. Your items are saved here.';
    await stubCheckout(page, (route) => route.fulfill({ status: 409, json: { error: { code: 'TOO_MANY_OPEN_ORDERS', scope: 'shop', message } } }));
    await bar(page).getByRole('button', { name: /View order/ }).click();
    await sheet(page).getByRole('button', { name: /on PayPal/ }).click();
    await expect(sheet(page).getByRole('alert')).toHaveText(message);
    await expect(sheet(page).locator('[data-cart-line]')).toHaveCount(1);
  });

  test('UNKNOWN_ITEM takes the line out and says so', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    const itemId = JSON.parse((await saved(page))!).lines[0].itemId;
    await stubCheckout(page, (route) => route.fulfill({ status: 409, json: { error: { code: 'UNKNOWN_ITEM', message: `${ITEM} is no longer available, so we took it out.`, itemId } } }));
    await bar(page).getByRole('button', { name: /View order/ }).click();
    await sheet(page).getByRole('button', { name: /on PayPal/ }).click();
    await expect(sheet(page).getByRole('alert')).toContainText('so we took it out');
    await expect(sheet(page).locator('[data-cart-line]')).toHaveCount(0);
  });

  for (const code of ['CHECKOUT_STALE', 'IDEMPOTENCY_CONFLICT'] as const) {
    test(`${code} rotates the request id and retries once`, async ({ page }) => {
      await clearCart(page);
      await hydrate(page);
      await addPlus(page).click();
      const ids: string[] = [];
      await stubCheckout(page, (route) => {
        ids.push(route.request().postDataJSON().requestId);
        return route.fulfill({ status: 409, json: { error: { code, message: 'Something changed. Try again.' } } });
      });
      await bar(page).getByRole('button', { name: /View order/ }).click();
      await sheet(page).getByRole('button', { name: /on PayPal/ }).click();
      await expect(sheet(page).getByRole('alert')).toContainText('Something changed');
      expect(ids).toHaveLength(2);
      expect(ids[1]).not.toBe(ids[0]);
    });
  }

  test('over the order cap the button is disabled and the line says the limit', async ({ page }) => {
    await page.goto(`/s/${bigSlug}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await hydrate(page, BIG_ITEM);
    await addPlus(page, BIG_ITEM).click();
    await bar(page).getByRole('button', { name: /View order/ }).click();
    await expect(sheet(page).getByRole('button', { name: /on PayPal/ })).toBeEnabled();
    await sheet(page).getByRole('button', { name: `Add one ${BIG_ITEM}` }).click();
    await expect(sheet(page).getByRole('button', { name: /on PayPal/ })).toBeDisabled();
    await expect(sheet(page)).toContainText('This shop takes online orders up to $500.00.');
  });

  test('Pickup is preselected; Shipping adds its fee and says PayPal asks for the address', async ({ page }) => {
    await page.goto(`/s/${bigSlug}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await hydrate(page, BIG_ITEM);
    await addPlus(page, BIG_ITEM).click();
    await bar(page).getByRole('button', { name: /View order/ }).click();
    await expect(sheet(page).getByRole('radio', { name: 'Pickup' })).toBeChecked();
    await expect(sheet(page).getByRole('button', { name: 'Approve $300.00 on PayPal' })).toBeVisible();
    await sheet(page).getByText('Shipping · $8.00').click();
    await expect(sheet(page).getByRole('button', { name: 'Approve $308.00 on PayPal' })).toBeVisible();
    await expect(sheet(page)).toContainText('PayPal asks for your address.');
  });

  test('emptying the cart and closing it returns focus to the order bar', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await bar(page).getByRole('button', { name: /View order/ }).click();
    await sheet(page).getByRole('button', { name: `Remove one ${ITEM}` }).click();
    await expect(sheet(page).locator('[data-cart-empty]')).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Close your order' }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(bar(page).getByRole('button', { name: /Order with an assistant/ })).toBeFocused();
  });

  test('PRICE_CHANGED keeps ?order=1 and the cart through the refresh', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await stubCheckout(page, (route) => route.fulfill({ status: 409, json: { error: { code: 'PRICE_CHANGED', message: 'Prices changed. Check your total, then try again.' } } }));
    await bar(page).getByRole('button', { name: /View order/ }).click();
    const refreshed = rscRefresh(page);
    await sheet(page).getByRole('button', { name: /on PayPal/ }).click();
    await expect(sheet(page).getByRole('alert')).toContainText('Prices changed');
    await refreshed;
    await page.waitForTimeout(300); // Its commit, after the response.
    await expect(page).toHaveURL(/order=1/);
    expect(await page.evaluate(() => (history.state as { shelfieAssistantEntry?: boolean }).shelfieAssistantEntry)).toBe(true);
    await page.reload();
    await hydrate(page);
    await expect(sheet(page).getByRole('heading', { name: 'Your order' })).toBeVisible();
  });

  test('PRICE_CHANGED after a ?assistant=1 load does not bring the assistant back into the URL', async ({ page }) => {
    await clearCart(page);
    await page.goto(`${SHOP}?assistant=1`);
    await hydrate(page);
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveCount(0);
    await addPlus(page).click();
    await stubCheckout(page, (route) => route.fulfill({ status: 409, json: { error: { code: 'PRICE_CHANGED', message: 'Prices changed. Check your total, then try again.' } } }));
    await bar(page).getByRole('button', { name: /View order/ }).click();
    const refreshed = rscRefresh(page);
    await sheet(page).getByRole('button', { name: /on PayPal/ }).click();
    await refreshed;
    await page.waitForTimeout(300); // Its commit, after the response.
    await expect(page).toHaveURL(/order=1/);
    await expect(page).not.toHaveURL(/assistant=1/);
  });

  test('the cart is kept through a shop pause: shown, unapprovable, and back when the shop is', async ({ page }) => {
    const db = getDb();
    const paused = shopsRepo.bySlug(db, bigSlug)!;
    await page.goto(`/s/${bigSlug}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await hydrate(page, BIG_ITEM);
    await addPlus(page, BIG_ITEM).click();
    await expect(bar(page).getByRole('button', { name: /View order · 1/ })).toBeVisible();
    await expect.poll(() => saved(page, bigSlug)).toContain('qty');
    try {
      shopsRepo.update(db, paused.id, { status: 'paused' });
      await page.reload();
      await hydrate(page, BIG_ITEM);
      await expect(bar(page).getByRole('button', { name: /View order · 1/ })).toBeVisible();
      expect(await saved(page, bigSlug)).toContain('qty');
      await expect(page.locator('[data-toast-region]')).not.toContainText('took it out');
      await bar(page).getByRole('button', { name: /View order/ }).click();
      await expect(sheet(page).getByRole('button', { name: /on PayPal/ })).toBeDisabled();
      await expect(sheet(page)).toContainText(`${BIG_NAME} isn’t taking orders right now. Your items are saved here.`);
    } finally {
      shopsRepo.update(db, paused.id, { status: 'live' });
    }
    await page.reload();
    await hydrate(page, BIG_ITEM);
    await expect(bar(page).getByRole('button', { name: /View order · 1/ })).toBeVisible();
    expect(await saved(page, bigSlug)).toContain('qty');
  });

  test('a saved cart keeps its first timestamp when the page is opened again', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await expect.poll(() => saved(page)).toContain('qty');
    const old = Date.now() - 23 * 60 * 60 * 1000;
    await page.evaluate(([k, at]) => {
      const v = JSON.parse(localStorage.getItem(k as string)!);
      localStorage.setItem(k as string, JSON.stringify({ ...v, savedAt: at }));
    }, [`shelfie:cart:${SLUG}`, old] as const);
    await page.reload();
    await hydrate(page);
    await expect(bar(page).getByRole('button', { name: /View order · 1/ })).toBeVisible();
    expect(JSON.parse((await saved(page))!).savedAt).toBe(old);
  });

  test('a line at 20 refuses the next add, with a tick and no add sound', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await expect.poll(() => saved(page)).toContain('qty');
    await page.evaluate((k) => {
      const v = JSON.parse(localStorage.getItem(k)!);
      v.lines[0].qty = 20;
      localStorage.setItem(k, JSON.stringify(v));
    }, `shelfie:cart:${SLUG}`);
    await page.reload();
    await hydrate(page);
    await page.evaluate(() => {
      const w = window as unknown as { heard: string[] };
      w.heard = [];
      window.addEventListener('shelfie:feedback', (e) => w.heard.push((e as CustomEvent<{ event: string }>).detail.event));
    });
    await addPlus(page).click();
    await expect(page.locator('[data-cart-status]')).toHaveText('An order can hold 20 of each item.');
    await expect.poll(() => page.evaluate(() => (window as unknown as { heard: string[] }).heard)).toEqual(['tick']);
    expect(await saved(page)).toContain('"qty":20');
  });

  test('the sheet stops at the room left on the line and states what it adds', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await expect.poll(() => saved(page)).toContain('qty');
    await page.evaluate((k) => {
      const v = JSON.parse(localStorage.getItem(k)!);
      v.lines[0].qty = 18;
      localStorage.setItem(k, JSON.stringify(v));
    }, `shelfie:cart:${SLUG}`);
    await page.reload();
    await hydrate(page);
    await openTile(page);
    await sheet(page).getByRole('button', { name: 'One more' }).click();
    await expect(sheet(page).getByRole('button', { name: 'One more' })).toBeDisabled();
    const dollars = (t: string) => Number(t.replace(/[^0-9.]/g, ''));
    const total = dollars((await sheet(page).getByRole('button', { name: /^Add to order/ }).textContent())!);
    await sheet(page).getByRole('button', { name: /^Add to order/ }).click();
    await expect(bar(page).getByRole('button', { name: /View order · 20/ })).toBeVisible();
    expect(total).toBeGreaterThan(0);
  });

  for (const width of [390, 360, 320]) {
    test(`the bar with items is 16 px and its button holds its text at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await clearCart(page);
      await hydrate(page);
      for (let i = 0; i < 4; i++) await addPlus(page).click();
      const view = bar(page).getByRole('button', { name: /View order/ });
      await expect(view).toBeVisible();
      const m = await view.evaluate((b) => {
        const total = b.querySelector('.type-figures') as HTMLElement;
        const r = total.getBoundingClientRect();
        const box = b.getBoundingClientRect();
        return { size: getComputedStyle(b).fontSize, sw: b.scrollWidth, cw: b.clientWidth, totalRight: r.right, boxRight: box.right, docW: document.documentElement.scrollWidth, vw: innerWidth };
      });
      expect(m.size).toBe('16px');
      expect(m.sw).toBeLessThanOrEqual(m.cw);
      expect(m.totalRight).toBeLessThanOrEqual(m.boxRight);
      expect(m.docW).toBeLessThanOrEqual(m.vw);
      await expect(bar(page).getByRole('button', { name: 'Order with an assistant' })).toHaveCSS('font-size', '16px');
    });
  }

  test('the Pickup and Shipping segments show keyboard focus', async ({ page }) => {
    await page.goto(`/s/${bigSlug}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await hydrate(page, BIG_ITEM);
    await addPlus(page, BIG_ITEM).click();
    await bar(page).getByRole('button', { name: /View order/ }).click();
    const pickup = sheet(page).getByRole('radio', { name: 'Pickup' });
    await sheet(page).getByRole('button', { name: `Add one ${BIG_ITEM}` }).focus();
    await page.keyboard.press('Tab');
    await expect(pickup).toBeFocused();
    expect(await pickup.evaluate((i) => (i.parentElement as HTMLElement).matches(':has(:focus-visible)'))).toBe(true);
    expect(await pickup.evaluate((i) => getComputedStyle(i.parentElement as HTMLElement).outlineStyle)).toBe('solid');
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

    await dock(page).getByRole('tab', { name: 'Assistant', exact: true }).click();
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

  test('in flight the tile controls and the dock are disabled, and the order sent is the order shown', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await expect(addPlus(page)).toBeEnabled();
    await hero(page).click();
    const bodies: { lines: unknown[]; expectedTotalCents: number }[] = [];
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await stubCheckout(page, async (route) => {
      bodies.push(route.request().postDataJSON());
      await held;
      await route.fulfill({ status: 409, json: { error: { code: 'CHECKOUT_STALE', message: 'Something changed. Try again.' } } });
    });
    await dock(page).getByRole('button', { name: /on PayPal/ }).click();
    await expect(dock(page).getByRole('button', { name: /Opening PayPal/ })).toBeDisabled();
    await expect(addPlus(page)).toBeDisabled();
    await expect(tile(page).getByRole('button', { name: `Remove one ${ITEM}` })).toBeDisabled();
    await expect(dock(page).getByRole('tab', { name: 'Assistant', exact: true })).toBeDisabled();
    await expect(dock(page).getByRole('button', { name: 'Close your order' })).toBeDisabled();
    await dock(page).getByRole('heading', { name: 'Your order' }).focus();
    await page.keyboard.press('Escape');
    await expect(dock(page).locator('[data-cart-panel]')).toHaveCount(1);
    release();
    await expect(dock(page).getByRole('alert')).toContainText('Something changed');
    expect(bodies).toHaveLength(2);
    expect(bodies[1].lines).toEqual(bodies[0].lines);
    expect(bodies[1].expectedTotalCents).toBe(bodies[0].expectedTotalCents);
    await expect(addPlus(page)).toBeEnabled();
  });

  test('PRICE_CHANGED keeps ?order=1 with the cart docked', async ({ page }) => {
    await clearCart(page);
    await hydrate(page);
    await addPlus(page).click();
    await hero(page).click();
    await stubCheckout(page, (route) => route.fulfill({ status: 409, json: { error: { code: 'PRICE_CHANGED', message: 'Prices changed. Check your total, then try again.' } } }));
    const refreshed = rscRefresh(page);
    await dock(page).getByRole('button', { name: /on PayPal/ }).click();
    await expect(dock(page).getByRole('alert')).toContainText('Prices changed');
    await refreshed;
    await page.waitForTimeout(300); // Its commit, after the response.
    await expect(page).toHaveURL(/order=1/);
    await expect(page).not.toHaveURL(/assistant=1/);
    await page.reload();
    await hydrate(page);
    await expect(dock(page).locator('[data-cart-panel]')).toHaveCount(1);
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
