// Seller dashboard and order detail (Task 8). Data comes from labelled test fixtures written straight to
// data/e2e.db (see e2e/task8-fixtures.ts). The PATCH routes (pause, sold out) are mocked here.
// Screenshots of these screens come from e2e/screenshots.spec.ts.
//
// Run: E2E_PORT=3111 npx playwright test e2e/dashboard.spec.ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE } from './helpers';
import { addFixtureOrder, createFixtureShop, seedAllStates, signInAsOwner, type FixtureShop } from './task8-fixtures';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const APP_URL = process.env.APP_URL ?? BASE;

let full: FixtureShop;
let orders: ReturnType<typeof seedAllStates>;
let empty: FixtureShop;
/** Tests that add or change orders use this shop, so the screenshot shop stays as seeded. */
let scratch: FixtureShop;

test.beforeAll(() => {
  full = createFixtureShop('Marigold Bakehouse');
  orders = seedAllStates(full);
  empty = createFixtureShop('Tía Lupe Tacos');
  scratch = createFixtureShop('Scratch Test Bakery');
});

const dashboard = (f: FixtureShop, query = '') => `/shops/${f.shop.id}${query}`;
const detail = (f: FixtureShop, orderId: string) => `/shops/${f.shop.id}/orders/${orderId}`;
const group = (page: Page, name: RegExp) => page.locator('section, details').filter({ has: page.getByRole('heading', { name }) });

async function a11y(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Standalone controls are at least 44 px tall (links inside a sentence are exempt; a stretched link's target is its card).
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main button, main a, main select, main input'))
      .filter((el) => el.offsetParent !== null && !el.closest('p') && !el.closest('details:not([open]) > :not(summary)'))
      .map((el) => {
        const target = el.hasAttribute('data-stretched-link') ? el.closest('li')! : el;
        return { text: el.innerText?.trim() || el.getAttribute('aria-label') || el.tagName, h: target.getBoundingClientRect().height };
      })
      .filter((c) => c.h < 44),
  );
  expect(small).toEqual([]);
}

test.describe('owner access', () => {
  test('the dashboard and order pages are 404 without the owner cookie', async ({ page }) => {
    expect((await page.goto(dashboard(full)))?.status()).toBe(404);
    expect((await page.goto(detail(full, orders.nutOrder.id)))?.status()).toBe(404);
  });

  test("an owner can't open another shop's order", async ({ page, context }) => {
    await signInAsOwner(context, empty, BASE);
    expect((await page.goto(detail(empty, orders.nutOrder.id)))?.status()).toBe(404);
  });
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsOwner(context, full, BASE);
  });

  for (const [label, viewport] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
    test(`orders grouped: to prepare, waiting (collapsed), done, accessible at ${label}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(dashboard(full));
      await expect(page.getByRole('heading', { level: 1, name: 'Marigold Bakehouse' })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Orders/ })).toHaveAttribute('aria-selected', 'true');

      const prepare = group(page, /To prepare/);
      await expect(prepare.getByRole('listitem')).toHaveCount(3);
      const nut = prepare.locator(`[data-order="${orders.nutOrder.number}"]`);
      await expect(nut).toContainText('Dana Whitfield · via Claude');
      await expect(nut).toContainText('2 × Almond croissant, 1 × Country sourdough loaf');
      await expect(nut).toContainText('Ship to Austin, TX');
      await expect(nut).toContainText(NUT_HEADLINE);
      await expect(nut).toContainText('almond croissants contain nuts');
      await expect(nut.getByRole('link', { name: 'Add tracking' })).toBeVisible();
      await expect(prepare.locator(`[data-order="${orders.pickupTemplate.number}"]`).getByRole('button', { name: 'Mark picked up' })).toBeVisible();
      await expect(prepare.locator(`[data-order="${orders.writing.number}"]`)).toContainText('Writing the brief…');

      const waiting = page.locator('details[data-group="waiting"]');
      await expect(waiting).not.toHaveAttribute('open', '');
      await expect(waiting.getByRole('heading', { name: /Waiting for payment\s*2/ })).toBeVisible();
      await expect(waiting.getByRole('listitem').first()).toBeHidden();

      const done = group(page, /^Done/);
      await expect(done.getByRole('listitem')).toHaveCount(4);
      await expect(done).toContainText('Shipped');
      await expect(done).toContainText('Picked up');
      await expect(done).toContainText('Cancelled');
      await expect(done).toContainText('Expired');
      await a11y(page);
    });
  }

  test('a new paid order slides into To prepare without a reload', async ({ page, context }) => {
    await signInAsOwner(context, scratch, BASE);
    await page.goto(dashboard(scratch));
    await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible();
    const arrived = addFixtureOrder(scratch, {
      status: 'paid', fulfillment: 'pickup', minutesAgo: 0, buyerName: 'Rae', lines: [['Butter croissant', 2]],
      payer: { name: 'Rae Lopez', email: 'rae@example.com' },
    });
    const card = page.locator(`[data-order="${arrived.number}"]`);
    await expect(card).toBeVisible({ timeout: 12_000 });
    await expect(group(page, /To prepare/).getByRole('listitem')).toHaveCount(1);
    await expect(page.getByText(`Payment received · ${arrived.number}`)).toBeVisible();
  });

  test('Mark picked up moves a pickup order to Done', async ({ page, context }) => {
    await signInAsOwner(context, scratch, BASE);
    const o = addFixtureOrder(scratch, {
      status: 'paid', fulfillment: 'pickup', minutesAgo: 2, buyerName: 'Kim', lines: [['Morning bun', 1]],
      payer: { name: 'Kim Tran', email: 'kim@example.com' },
    });
    await page.goto(dashboard(scratch));
    const card = page.locator(`[data-order="${o.number}"]`);
    await card.getByRole('button', { name: 'Mark picked up' }).click();
    await expect(group(page, /^Done/).locator(`[data-order="${o.number}"]`)).toContainText('Picked up', { timeout: 20_000 });
  });

  test('Pause agent orders: saves through PATCH /api/shops/[id], and rolls back on an error', async ({ page }) => {
    let sent: unknown;
    await page.route(`**/api/shops/${full.shop.id}`, async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ json: { shop: { ...full.shop, status: 'paused' } } });
    });
    await page.goto(dashboard(full));
    const toggle = page.getByRole('switch', { name: 'Pause agent orders' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(sent).toEqual({ status: 'paused' });
    await expect(page.getByText('Agent orders paused').first()).toBeVisible();

    await page.unroute(`**/api/shops/${full.shop.id}`);
    await page.route(`**/api/shops/${full.shop.id}`, (route) =>
      route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: "Couldn’t save. Try again." } } }),
    );
    await toggle.click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText("Couldn’t save");
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('Menu tab: Sold out today saves through PATCH /api/shops/[id]/items', async ({ page }) => {
    let sent: unknown;
    await page.route(`**/api/shops/${full.shop.id}/items`, async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ json: { items: [] } });
    });
    await page.goto(dashboard(full, '?tab=menu'));
    await expect(page.getByRole('tab', { name: 'Menu' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-item="Seeded rye"]')).toContainText('Sold out today');
    await expect(page.locator('[data-item="Celebration cake"]')).toContainText('Ask in person');
    const sw = page.getByRole('switch', { name: 'Almond croissant: Sold out today' });
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sent).toEqual({ updates: [{ itemId: full.items['Almond croissant'].id, soldOut: true }] });
    await a11y(page);
  });

  test('Share tab: the shop link and the agent door URL', async ({ page }) => {
    await page.goto(dashboard(full));
    await page.getByRole('tab', { name: 'Share' }).click();
    await expect(page).toHaveURL(/\?tab=share/);
    await expect(page.getByTestId('share-door-url')).toHaveText(`${APP_URL}/s/${full.shop.slug}/mcp`);
    await expect(page.getByTestId('share-shop-url')).toHaveText(`${APP_URL}/s/${full.shop.slug}`);
    await expect(page.getByRole('button', { name: 'Copy Agent door link' })).toBeVisible();
    await a11y(page);
  });

  test('empty dashboard points at the assistant demo', async ({ page, context }) => {
    await signInAsOwner(context, empty, BASE);
    await page.goto(dashboard(empty));
    await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Watch an AI order from you' })).toHaveAttribute('href', `/s/${empty.shop.slug}?assistant=1`);
    await a11y(page);
  });
});

const NUT_HEADLINE = 'Ship 2 almond croissants + 1 sourdough loaf to Austin, TX';

test.describe('order detail', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsOwner(context, full, BASE);
  });

  for (const [label, viewport] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
    test(`paid shipping order: brief, items, buyer, ship-to, PayPal ids, timeline, tracking form (${label})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(detail(full, orders.nutOrder.id));
      await expect(page.getByRole('heading', { level: 1 })).toContainText(orders.nutOrder.number);
      await expect(page.getByTestId('brief-headline')).toHaveText(NUT_HEADLINE);
      await expect(page.getByText('Warning: Buyer mentions a nut allergy')).toBeAttached();
      await expect(page.getByText('Nut allergy in the house').first()).toBeVisible();
      const items = page.locator('section[aria-labelledby="items-title"]');
      await expect(items).toContainText('Shipping');
      await expect(items).toContainText('$8.00');
      await expect(items).toContainText('$26.50');
      await expect(page.locator('section[aria-labelledby="buyer-title"]')).toContainText('2104 E 6th St');
      await expect(page.getByTestId('PayPal-order-ID')).toHaveText(orders.nutOrder.paypalOrderId);
      await expect(page.getByTestId('PayPal-transaction-ID')).toHaveText(orders.nutOrder.captureId!);
      const timeline = page.locator('section[aria-labelledby="timeline-title"]');
      await expect(timeline).toContainText('Order created by Claude');
      await expect(timeline).toContainText('Approved on PayPal');
      await expect(timeline).toContainText('Payment received');
      await expect(page.getByRole('form', { name: 'Add tracking' })).toBeVisible();
      await a11y(page);
    });
  }

  test("tracking form: sending, PayPal's error, then sent", async ({ page, context }) => {
    await signInAsOwner(context, scratch, BASE);
    const o = addFixtureOrder(scratch, {
      status: 'paid', fulfillment: 'shipping', minutesAgo: 4, buyerName: 'Ola', lines: [['Seeded rye', 1]],
      payer: { name: 'Ola Bello', email: 'ola@example.com' },
      shipTo: { name: 'Ola Bello', line1: '1 Elm St', line2: null, city: 'Dallas', state: 'TX', postalCode: '75201', countryCode: 'US' },
    });
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    let attempt = 0;
    await page.route(`**/api/shops/${scratch.shop.id}/orders/${o.id}/tracking`, async (route) => {
      attempt++;
      if (attempt === 1) {
        await gate;
        return route.fulfill({ status: 502, json: { error: { code: 'PAYPAL_REJECTED', message: 'PayPal said: Tracking number is invalid for carrier UPS.' } } });
      }
      return route.fulfill({
        json: { order: { ...o, status: 'fulfilled' }, trackers: [{ orderId: o.id, carrier: 'UPS', trackingNumber: '1Z999AA10123456784', paypalStatus: 'SHIPPED', createdAt: new Date().toISOString() }] },
      });
    });
    await page.goto(detail(scratch, o.id));
    await page.getByLabel('Carrier').selectOption('UPS');
    await page.getByLabel('Tracking number').fill('1Z 999 AA1 0123 4567 84');
    await page.getByRole('button', { name: 'Send tracking to PayPal' }).click();
    await expect(page.getByRole('button', { name: 'Sending to PayPal…' })).toBeDisabled();
    release();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('PayPal said: Tracking number is invalid for carrier UPS.');
    await page.getByRole('button', { name: 'Send tracking to PayPal' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sent to PayPal: UPS' })).toBeVisible();
  });

  test.skip('Other carrier asks for the carrier name (hidden until verified in the sandbox)', async ({ page }) => {
    await page.goto(detail(full, orders.nutOrder.id));
    await page.getByLabel('Carrier').selectOption('OTHER');
    await page.getByLabel('Tracking number').fill('OT12345678');
    await page.getByRole('button', { name: 'Send tracking to PayPal' }).click();
    await expect(page.getByText('Enter the name of the carrier.')).toBeVisible();
  });

  test('fulfilled shipping order shows its tracking', async ({ page }) => {
    await page.goto(detail(full, orders.shipped.id));
    const action = page.locator('section[aria-labelledby="action-title"]');
    await expect(action.getByRole('heading', { name: 'Shipped' })).toBeVisible();
    await expect(action).toContainText('USPS');
    await expect(action).toContainText('9400111899223197428490');
    await expect(action).toContainText('Sent to PayPal');
    await expect(page.locator('section[aria-labelledby="timeline-title"]')).toContainText('Tracking added: USPS 9400111899223197428490');
    await a11y(page);
  });
});
