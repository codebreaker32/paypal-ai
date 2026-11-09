// The landing page and public footer (brief WP7 acceptance 1 to 4). Run: E2E_PORT=3251 npx playwright test e2e/landing.spec.ts
import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, a11y, settle, smallTargets } from './helpers';
import { createFixtureShop, signInAsOwner } from './task8-fixtures';
import { TEST_MODE_LINE } from '../src/lib/brand/test-mode';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.LANDING_SHOTS;

const noSideways = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`at ${label} px`, () => {
    test.use({ viewport });

    test('four parts, the two ways in within the first screen, no photo input, no sample chips', async ({ page }) => {
      await page.goto('/');
      await settle(page);
      await expect(page.locator('main > section')).toHaveCount(4);
      await expect(page.locator('main input[type="file"]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Marigold/ })).toHaveCount(0);

      const hero = page.locator('main > section').first();
      await expect(hero.getByRole('heading', { level: 1, name: 'Your price list, open to AI shoppers.' })).toBeVisible();
      for (const name of ['Add your shop', 'Log in']) {
        const box = await hero.getByRole('link', { name, exact: true }).boundingBox();
        expect(box, name).not.toBeNull();
        expect(box!.y + box!.height, name).toBeLessThanOrEqual(viewport.height);
      }
      await expect(hero.getByText(TEST_MODE_LINE)).toBeVisible();

      // Marigold's name only in the hero's picture; the others use its paper at most.
      for (const part of await page.locator('main > section').all()) {
        if (await part.getByRole('heading', { level: 1 }).count()) continue;
        expect(await part.innerText()).not.toContain('Marigold');
      }
      expect(await page.getByRole('link', { name: 'See an example shop' }).count()).toBeLessThanOrEqual(1);

      await a11y(page);
      await noSideways(page);
      expect(await smallTargets(page, 'footer')).toEqual([]);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing-${label}.png`, fullPage: true });
    });

    test('the FAQ is native disclosures with the brief’s words', async ({ page }) => {
      await page.goto('/');
      await settle(page);
      await expect(page.locator('main details')).toHaveCount(5);
      await page.getByText('Do I need a website?').click();
      await expect(page.getByText('a card with a QR code you can print for the counter')).toBeVisible();
    });

    test('footer kinds: groups on the landing page, the short row on a buyer page', async ({ page }) => {
      const shop = createFixtureShop('Footer Test Bakery');
      await page.goto('/');
      const footer = page.locator('body > footer');
      await expect(footer.getByText(TEST_MODE_LINE)).toBeVisible();
      for (const name of ['Add your shop', 'Log in', 'Help', 'agents.txt', 'llms.txt', 'Terms', 'Privacy', 'Open source on GitHub']) {
        await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
      }
      await expect(footer.getByRole('button', { name: 'Sound' })).toBeVisible();
      if (SHOTS) await footer.screenshot({ path: `${SHOTS}/footer-site-${label}.png` });

      await page.goto(`/s/${shop.shop.slug}`);
      await expect(footer.getByText(TEST_MODE_LINE)).toBeVisible();
      expect(await footer.getByRole('link').allInnerTexts()).toEqual(['Terms', 'Privacy']);
      await expect(footer.getByRole('button', { name: 'Sound' })).toBeVisible();
      expect(await smallTargets(page, 'footer')).toEqual([]);
      if (SHOTS) await footer.screenshot({ path: `${SHOTS}/footer-buyer-${label}.png` });
      await noSideways(page);
    });
  });
}

test('with an owner cookie: no welcome back, one Dashboard link', async ({ page, context }) => {
  const shop = createFixtureShop('Owner Cookie Bakery');
  await signInAsOwner(context, shop, BASE);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Your price list, open to AI shoppers.' })).toBeVisible();
  await expect(page.getByText('Welcome back')).toHaveCount(0);
  await expect(page.getByText('Open your dashboard')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(1);
});

test('a logged-in visitor goes to their own landing path', async ({ page }) => {
  const res = await page.request.post('/api/auth/signup', {
    data: { email: `e2e-landing-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`, password: 'a long sentence only this test says' },
  });
  expect(res.status()).toBe(201);
  await page.goto('/');
  await expect(page).toHaveURL(/\/shops\/new$/);
});
