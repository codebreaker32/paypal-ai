// The dock's two-way switch and the add feedback (run 14): a buyer who taps `+` with the assistant open always sees
// what happened and how to reach the order. Checkout is not called here (cart.spec.ts covers it).
//
// Run: E2E_PORT=3232 npx playwright test e2e/cart-dock.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as shopsRepo from '../src/lib/db/repos/shops';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { DESKTOP, PHONE, settle } from './helpers';

const SHOP = `/s/${DEMO_SHOP.slug}`;
const FIRST = 'Almond croissant';
const SECOND = 'Cardamom bun';
const SHOTS = 'docs/preview';

test.beforeAll(async () => {
  const db = getDb();
  if (!shopsRepo.bySlug(db, DEMO_SHOP.slug)) await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir: getConfig().uploadsDir });
});

const tile = (page: Page, name: string) => page.locator(`li[data-menu-item="${name}"]`);
const addPlus = (page: Page, name: string) => tile(page, name).getByRole('button', { name: `Add ${name} to your order` });
const toast = (page: Page) => page.locator('[data-toast-region]');
const tab = (scope: Page | ReturnType<Page['locator']>, name: RegExp | string) => scope.getByRole('tab', { name });

async function load(page: Page) {
  await page.goto(SHOP);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${SHOP}?assistant=1`);
  await expect(tile(page, FIRST)).toBeVisible();
  await page.waitForFunction(() => {
    const el = document.querySelector('li[data-menu-item] button');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber'));
  });
}

test.describe('desktop dock', () => {
  test.use({ viewport: DESKTOP });

  test('adds answer with a toast and the count; the switch moves between the assistant and the order', async ({ page }) => {
    await load(page);
    const dock = page.locator('[data-assistant-dock]');
    await expect(dock.getByRole('heading', { name: 'Order with an assistant' })).toBeVisible();
    await expect(tab(dock, 'Assistant')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(dock, 'Your order (empty)')).toHaveAttribute('aria-selected', 'false');
    await expect(dock.locator('[data-dock-count]')).toHaveCount(0);

    await addPlus(page, FIRST).click();
    await expect(tile(page, FIRST).getByRole('button', { name: `Remove one ${FIRST}` })).toBeVisible();
    await expect(toast(page)).toContainText(`${FIRST} added`);
    await expect(toast(page).getByRole('button', { name: 'View order' })).toBeVisible();
    await expect(tab(dock, /^Your order 1 \$[\d.]+ \(1 item\)$/)).toBeVisible();

    await addPlus(page, SECOND).click();
    await expect(toast(page)).toContainText(`${SECOND} added`);
    // One toast for repeated adds, replaced in place.
    await expect(toast(page).getByRole('button', { name: 'View order' })).toHaveCount(1);
    await expect(tab(dock, /^Your order 2 \$[\d.]+ \(2 items\)$/)).toBeVisible();
    await expect(dock.locator('[data-dock-count]')).toHaveText('2');
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/cart-dock-1440-added.png` });

    await tab(dock, /^Your order/).click();
    await expect(tab(dock, /^Your order/)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(dock, /^Your order/)).toBeFocused();
    await expect(dock.locator('[data-cart-line]')).toHaveCount(2);
    await expect(dock.locator(`[data-cart-line="${FIRST}"]`)).toBeVisible();
    await expect(dock.locator(`[data-cart-line="${SECOND}"]`)).toBeVisible();
    await expect(dock.getByRole('button', { name: /^Approve \$.* on PayPal$/ })).toBeVisible();
    await expect(page).toHaveURL(/order=1/);
    await expect(page).not.toHaveURL(/assistant=1/);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/cart-dock-1440-order.png` });

    // Arrow keys move along the tabs too.
    await page.keyboard.press('ArrowLeft');
    await expect(tab(dock, 'Assistant')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(dock, 'Assistant')).toBeFocused();
    await expect(dock.getByRole('heading', { name: 'Order with an assistant' })).toBeVisible();
    await expect(dock.locator('[data-cart-panel]')).toHaveCount(0);
    await expect(page).toHaveURL(/assistant=1/);

    // The toast's View order switches the dock to the order.
    await addPlus(page, FIRST).click();
    await expect(tab(dock, /^Your order 3 \$[\d.]+ \(3 items\)$/)).toBeVisible();
    await toast(page).getByRole('button', { name: 'View order' }).click();
    await expect(dock.locator('[data-cart-panel]')).toHaveCount(1);
    await expect(tab(dock, /^Your order/)).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('phone sheets', () => {
  test.use({ viewport: PHONE });

  test('the sheet has the same switch, and an add behind it is one tap from the order', async ({ page }) => {
    await load(page);
    const sheet = page.locator('dialog[open]');
    await expect(sheet.getByRole('heading', { name: 'Order with an assistant' })).toBeVisible();
    await expect(tab(sheet, 'Your order (empty)')).toBeVisible();
    await sheet.getByRole('button', { name: 'Close the assistant' }).click();
    await expect(sheet).toHaveCount(0);

    await addPlus(page, FIRST).click();
    await expect(toast(page)).toContainText(`${FIRST} added`);
    await addPlus(page, SECOND).click();
    await expect(toast(page)).toContainText(`${SECOND} added`);
    const bar = page.locator('[data-order-bar]');
    await expect(bar.getByRole('button', { name: /^View order · 2/ })).toBeVisible();
    // The toast sits above the bar, never over it.
    const toastBox = (await toast(page).boundingBox())!;
    const barBox = (await bar.boundingBox())!;
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(barBox.y);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/cart-dock-390-added.png` });

    await toast(page).getByRole('button', { name: 'View order' }).click();
    await expect(sheet.locator('[data-cart-line]')).toHaveCount(2);
    await expect(sheet.getByRole('button', { name: /^Approve \$.* on PayPal$/ })).toBeVisible();
    await expect(tab(sheet, /^Your order 2 \$[\d.]+ \(2 items\)$/)).toHaveAttribute('aria-selected', 'true');
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/cart-dock-390-order.png` });

    await tab(sheet, 'Assistant').click();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await expect(sheet.getByRole('heading', { name: 'Order with an assistant' })).toBeVisible();
    await expect(tab(sheet, 'Assistant')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/assistant=1/);
    await expect(page).not.toHaveURL(/order=1/);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/cart-dock-390-assistant.png` });

    await tab(sheet, /^Your order/).click();
    await expect(sheet.locator('[data-cart-line]')).toHaveCount(2);
    // The entry the order sheet pushed is still its own: Back closes it and stays on the shop.
    await page.goBack();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${SHOP}$`));
    await expect(bar.getByRole('button', { name: /^View order · 2/ })).toBeVisible();
  });
});
