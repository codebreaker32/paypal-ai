// /browse: every shop taking orders, with a search and category chips. Run: E2E_PORT=3203 npx playwright test e2e/browse.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { getDb } from '@/lib/db';
import { DESKTOP, PHONE, a11y, settle, smallTargets } from './helpers';
import { createFixtureShop } from './task8-fixtures';
import { TEST_MODE_LINE } from '../src/lib/brand/test-mode';

const noSideways = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

const stamp = Date.now().toString(36);
const flowers = createFixtureShop(`Browse Petals ${stamp}`);
const plain = createFixtureShop(`Browse Plain ${stamp}`);
getDb().prepare('UPDATE shops SET category = ? WHERE id = ?').run('flowers', flowers.shop.id);

for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test(`/browse at ${label} px: cards, search, empty state and chips`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/browse');
    await settle(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Browse shops' })).toBeVisible();
    await expect(page.locator('footer')).toContainText(TEST_MODE_LINE);
    await a11y(page);
    await noSideways(page);
    expect(await smallTargets(page, 'main')).toEqual([]);

    const open = (name: string) => page.getByRole('link', { name: `Open shop: ${name}` });
    await expect(open(flowers.shop.name)).toHaveAttribute('href', `/s/${flowers.shop.slug}`);
    await expect(open(plain.shop.name)).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Search shops' });
    await search.fill(`petals ${stamp}`);
    await expect(open(flowers.shop.name)).toBeVisible();
    await expect(open(plain.shop.name)).toHaveCount(0);
    await expect(page).toHaveURL(/q=petals/);

    // An item name finds every shop that sells it.
    await search.fill('morning bun');
    await expect(open(plain.shop.name)).toBeVisible();

    await search.fill('zzz no such thing');
    await expect(page.getByText('No shops match “zzz no such thing”.')).toBeVisible();
    await a11y(page);
    await page.getByRole('button', { name: 'Clear search' }).last().click();
    await expect(search).toHaveValue('');
    await expect(open(plain.shop.name)).toBeVisible();

    // A shop with no category is under All only.
    await page.getByRole('button', { name: 'Flowers', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Flowers', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(open(flowers.shop.name)).toBeVisible();
    await expect(open(plain.shop.name)).toHaveCount(0);

    await open(flowers.shop.name).click();
    await expect(page).toHaveURL(new RegExp(`/s/${flowers.shop.slug}$`));
  });
}

test('the header and the hero lead to /browse', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Browse', exact: true })).toHaveAttribute('href', '/browse');
  await expect(page.locator('main > section').first().getByRole('link', { name: 'Browse shops', exact: true })).toHaveAttribute('href', '/browse');
  await page.setViewportSize(PHONE);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Browse', exact: true }).click();
  await expect(page).toHaveURL(/\/browse$/);
});
