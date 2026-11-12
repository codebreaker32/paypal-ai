// One real order on a seeded shop that is not Marigold, against the PayPal sandbox, no mocks: the seed
// publishes Little Ember Coffee (scripts/seed-demo.ts seedSellerShop, paid to PAYPAL_SANDBOX_SELLER_EMAIL), a buyer adds
// two items on its page, approves on PayPal with the sandbox buyer's login, and the receipt and the stored order say
// Paid, with PayPal's capture COMPLETED to the seller. Needs the app keys, PAYPAL_SANDBOX_SELLER_EMAIL and the sandbox
// buyer's login in .env; skipped otherwise. Nothing from .env is logged.
//
//   E2E_PORT=3202 npx playwright test e2e/new-shop-order.spec.ts
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as orders from '@/lib/db/repos/orders';
import { SEED_SHOPS } from '@/lib/demo/shops';
import { getPayPal } from '@/lib/paypal';
import { seedSellerShop } from '../scripts/seed-demo';
import { payWithPayPalLogin } from './paypal-buyer';

config({ quiet: true });

const env = (name: string) => process.env[name]?.trim() || null;
const HAS_PAYPAL = Boolean(env('PAYPAL_CLIENT_ID') && env('PAYPAL_SECRET_KEY'));
const SELLER = env('PAYPAL_SANDBOX_SELLER_EMAIL')?.toLowerCase() ?? null;
const BUYER = env('PAYPAL_SANDBOX_BUYER_EMAIL') && env('PAYPAL_SANDBOX_BUYER_PASSWORD')
  ? { email: env('PAYPAL_SANDBOX_BUYER_EMAIL')!, password: env('PAYPAL_SANDBOX_BUYER_PASSWORD')! }
  : null;
const usd = (c: number) => (c / 100).toFixed(2);

test('a seeded new shop takes a real sandbox order: cart → PayPal wallet login → Paid to the seller', async ({ page, baseURL }, info) => {
  test.skip(!HAS_PAYPAL || !SELLER || !BUYER, 'Needs PayPal app keys, PAYPAL_SANDBOX_SELLER_EMAIL and the sandbox buyer login in .env.');
  test.setTimeout(8 * 60_000);
  const origin = baseURL!;
  const def = SEED_SHOPS.find((s) => s.key === 'little-ember')!;

  const seeded = await seedSellerShop(def, { db: getDb(), paypal: getPayPal(), uploadsDir: getConfig().uploadsDir, payeeEmail: SELLER });
  const shop = seeded.shop!;
  expect(shop).toMatchObject({ status: 'live', category: 'drinks', payeeEmail: SELLER });
  expect(seeded.failed).toEqual([]);

  await page.goto(`/s/${shop.slug}`);
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(def.name);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => {
    const el = document.querySelector('li[data-menu-item] button');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber'));
  });
  await page.getByRole('button', { name: 'Add Americano to your order' }).click();
  await page.getByRole('button', { name: 'Add Blueberry muffin to your order' }).click();
  await page.getByRole('button', { name: /View order/ }).filter({ visible: true }).first().click();
  const dock = page.locator('[data-assistant-dock]');
  await expect(dock.locator('[data-cart-line]')).toHaveCount(2);
  const pay = dock.getByRole('button', { name: /^Approve \$[\d.,]+ on PayPal$/ });
  // Americano $3.50 + Blueberry muffin $3.50, pickup.
  await expect(pay).toHaveAccessibleName('Approve $7.00 on PayPal');

  let checkout!: { orderRef: string; number: string; approvalUrl: string; totalCents: number };
  await page.route(`**/api/checkout/${shop.slug}`, async (route) => {
    const res = await route.fetch({ timeout: 120_000 });
    checkout = (await res.json()) as typeof checkout;
    await route.fulfill({ response: res });
  });
  await pay.click();
  await page.waitForURL(/^https:\/\/www\.sandbox\.paypal\.com\//, { timeout: 120_000 });
  expect(checkout.totalCents).toBe(700);

  const returned = await payWithPayPalLogin(page, checkout.approvalUrl, { returnOrigin: origin, testInfo: info, ...BUYER! });
  expect(returned.startsWith(`${origin}/api/paypal/return?o=${checkout.orderRef}`), returned).toBe(true);
  await page.waitForURL(`${origin}/o/${checkout.orderRef}`, { timeout: 90_000 });
  await expect(page.getByRole('heading', { level: 1, name: `Paid. ${def.name} has your order.` })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(`Paid to ${def.name}’s own PayPal account (`)).toBeVisible();

  const stored = orders.byId(getDb(), checkout.orderRef);
  expect(stored).toMatchObject({ status: 'paid', payeeEmail: SELLER, totalCents: 700 });
  expect(stored!.captureId).toMatch(/^[A-Z0-9]{10,}$/);
  // Order ref, number and status only: sandbox ids, never a value from .env.
  console.log(`[new-shop-order] ${new Date().toISOString()} ${def.name} (/s/${shop.slug}) order ${checkout.number} ref ${checkout.orderRef} $${usd(checkout.totalCents)} status ${stored!.status} capture ${stored!.captureId}`);
});
