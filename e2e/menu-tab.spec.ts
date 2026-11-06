// The dashboard's Menu tab, photo-first (spec §4b): a photo per item (add, replace, remove), the cover, and
// "Snap your counter" with /api/shops/*/counter mocked (no live Claude in e2e). Sold out today: e2e/dashboard.spec.ts.
// Run: E2E_PORT=3211 npx playwright test e2e/menu-tab.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE } from './helpers';
import { getDb } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shopsRepo from '@/lib/db/repos/shops';
import { createFixtureShop, signInAsOwner, type FixtureShop } from './task8-fixtures';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const PHOTOS = path.join('public', 'demo', 'marigold-bakehouse');
const dataUrl = (file: string) => `data:image/jpeg;base64,${fs.readFileSync(path.join(PHOTOS, file)).toString('base64')}`;
const photoOf = (f: FixtureShop, name: string) => itemsRepo.listWithVariants(getDb(), f.shop.id).find((i) => i.name === name)!.photoUrl;

let shop: FixtureShop;
test.beforeEach(async ({ context }) => {
  shop = createFixtureShop('Menu Tab Bakery');
  await signInAsOwner(context, shop, BASE);
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('a row takes a photo and removes it; the cover too', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}?tab=menu`);
    const row = page.locator('li[data-item="Almond croissant"]');
    await row.getByLabel('Add a photo of Almond croissant').setInputFiles(path.join(PHOTOS, 'almond-croissant.jpg'));
    await expect(row.getByRole('img', { name: 'Almond croissant' })).toHaveAttribute('src', /^\/i\//);
    expect(photoOf(shop, 'Almond croissant')).toMatch(/^\/i\//);

    await row.getByRole('button', { name: 'Photo of Almond croissant: replace or remove' }).click();
    const sheet = page.getByRole('dialog', { name: 'Almond croissant' });
    await sheet.getByRole('button', { name: 'Remove photo' }).click();
    await expect(sheet).toBeHidden();
    await expect(row.getByLabel('Add a photo of Almond croissant')).toBeAttached();
    expect(photoOf(shop, 'Almond croissant')).toBeNull();

    await page.getByLabel('Add a cover photo').setInputFiles(path.join(PHOTOS, 'cover.jpg'));
    await expect(page.getByRole('img', { name: /cover$/ })).toBeVisible();
    expect(shopsRepo.byId(getDb(), shop.shop.id)!.coverUrl).toMatch(/^\/i\//);
    // Leaving the tab and coming back keeps the new cover (the dashboard holds it, like the items).
    const coverSrc = shopsRepo.byId(getDb(), shop.shop.id)!.coverUrl!;
    await page.getByRole('tab', { name: /Orders/ }).click();
    await page.getByRole('tab', { name: 'Menu' }).click();
    await expect(page.getByRole('img', { name: /cover$/ })).toHaveAttribute('src', coverSrc);
    // A reload reads the cover back.
    await page.reload();
    await expect(page.getByRole('img', { name: /cover$/ })).toBeVisible();
  });

  test('Snap your counter: proposals to Use, Replace or Skip; the row updates', async ({ page }) => {
    itemsRepo.update(getDb(), shop.items['Country sourdough loaf'].id, { photoUrl: '/demo/marigold-bakehouse/country-sourdough-loaf.jpg' });
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(`**/api/shops/${shop.shop.id}/counter`, async (route) => {
      await held;
      await route.fulfill({
        json: {
          proposals: [
            { itemId: shop.items['Almond croissant'].id, name: 'Almond croissant', confidence: 'high', image: dataUrl('almond-croissant.jpg') },
            { itemId: shop.items['Country sourdough loaf'].id, name: 'Country sourdough loaf', confidence: 'medium', image: dataUrl('butter-croissant.jpg') },
          ],
        },
      });
    });
    await page.goto(`/shops/${shop.shop.id}?tab=menu`);
    await page.locator('input[aria-label="Snap your counter"]').setInputFiles(path.join(PHOTOS, 'cover.jpg'));
    const sheet = page.getByRole('dialog', { name: 'Snap your counter' });
    await expect(sheet.getByRole('status')).toContainText('Finding your items…');
    release();

    await expect(sheet.getByRole('button', { name: 'Use: Almond croissant' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Replace: Country sourdough loaf' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Skip: Country sourdough loaf' }).click();
    await expect(sheet.locator('[data-proposal="Country sourdough loaf"]')).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Use: Almond croissant' }).click();
    await expect(sheet.locator('[data-proposal="Almond croissant"]')).toContainText('Added');
    await sheet.getByRole('button', { name: 'Done' }).click();

    await expect(page.locator('li[data-item="Almond croissant"]').getByRole('img', { name: 'Almond croissant' })).toHaveAttribute('src', /^\/i\//);
    expect(photoOf(shop, 'Almond croissant')).toMatch(/^\/i\//);
    expect(photoOf(shop, 'Country sourdough loaf')).toBe('/demo/marigold-bakehouse/country-sourdough-loaf.jpg');
  });

  test('Snap your counter: none found, and the server’s error (no AI key)', async ({ page }) => {
    let answer: { status: number; json: unknown } = { status: 200, json: { proposals: [] } };
    await page.route(`**/api/shops/${shop.shop.id}/counter`, (route) => route.fulfill(answer));
    await page.goto(`/shops/${shop.shop.id}?tab=menu`);
    await page.locator('input[aria-label="Snap your counter"]').setInputFiles(path.join(PHOTOS, 'cover.jpg'));
    const sheet = page.getByRole('dialog', { name: 'Snap your counter' });
    await expect(sheet).toContainText('We couldn’t match any items. Try a closer photo.');
    await sheet.getByRole('button', { name: 'Done' }).click();

    answer = { status: 503, json: { error: { code: 'NO_AI_KEY', message: 'Finding items in a photo needs an Anthropic API key on the server.' } } };
    await page.locator('input[aria-label="Snap your counter"]').setInputFiles(path.join(PHOTOS, 'cover.jpg'));
    await expect(sheet.getByRole('alert')).toHaveText('Finding items in a photo needs an Anthropic API key on the server.');
  });
});

test.describe('on a desktop', () => {
  test.use({ viewport: DESKTOP });

  test('rows show photos or the designed fallback, with Sold out today beside them', async ({ page }) => {
    itemsRepo.update(getDb(), shop.items['Almond croissant'].id, { photoUrl: '/demo/marigold-bakehouse/almond-croissant.jpg' });
    await page.goto(`/shops/${shop.shop.id}?tab=menu`);
    await expect(page.locator('li[data-item="Almond croissant"]').getByRole('img', { name: 'Almond croissant' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Almond croissant: Sold out today' })).toBeVisible();
    await expect(page.getByText('Photos in one go')).toBeVisible();
  });
});
