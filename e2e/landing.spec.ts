// The landing page and public footer, and the rest of brief WP7's acceptance: 1 to 5, 7 and 8 here (7's Help, Terms,
// Privacy and 404 are in e2e/other-pages.spec.ts, 6 is e2e/account-publish.spec.ts, 9 is the recorded Lighthouse run).
// Run: E2E_PORT=3251 npx playwright test e2e/landing.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { getDb } from '@/lib/db';
import { DESKTOP, PHONE, a11y, settle, signUpForShops, smallTargets } from './helpers';
import { addFixtureOrder, createFixtureShop, signInAsOwner } from './task8-fixtures';
import { TEST_MODE_LINE } from '../src/lib/brand/test-mode';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.LANDING_SHOTS;

const noSideways = async (page: Page) =>
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
        const box = await page.locator('body > header').getByRole('link', { name, exact: true }).boundingBox();
        expect(box, name).not.toBeNull();
        expect(box!.y + box!.height, name).toBeLessThanOrEqual(viewport.height);
      }
      await expect(page.locator('body > footer').getByText(TEST_MODE_LINE)).toBeVisible();

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
      await expect(page.locator('main details')).toHaveCount(6);
      if (label === '390') await page.getByRole('button', { name: 'Frequently asked questions' }).click();
      await page.getByText('Do I need a website?').click();
      await expect(page.getByText('a card with a QR code you can print for the counter')).toBeVisible();
    });

    test('footer kinds: the charcoal band on the landing page, the short row on a buyer page', async ({ page }) => {
      const shop = createFixtureShop('Footer Test Bakery');
      await page.goto('/');
      const footer = page.locator('body > footer');
      await expect(footer.getByText(TEST_MODE_LINE)).toBeVisible();
      for (const name of ['Product', 'Help', 'Legal', 'Open Source', 'Shelfie on GitHub', 'Privacy', 'agents.txt', 'llms.txt']) {
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

test('no demo login anywhere a visitor can sign in', async ({ page }) => {
  for (const path of ['/', '/login', '/signup']) {
    await page.goto(path);
    await expect(page.locator('body')).not.toContainText(/demo (login|account)|log in as (a )?demo|shared (login|account)/i);
    await expect(page.getByRole('link', { name: /demo/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /demo/i })).toHaveCount(0);
  }
});

test('buyer pages have no Log in or Add your shop in the header', async ({ page }) => {
  const shop = createFixtureShop('Buyer Header Bakery');
  const order = addFixtureOrder(shop, { status: 'awaiting_approval', fulfillment: 'pickup', lines: [[Object.keys(shop.items)[0], 1]], minutesAgo: 5 });
  for (const path of [`/s/${shop.shop.slug}`, `/o/${order.id}`]) {
    await page.goto(path);
    await expect(page.locator('footer').getByText(TEST_MODE_LINE)).toBeVisible();
    for (const name of ['Log in', 'Add your shop']) await expect(page.locator('header').getByRole('link', { name, exact: true })).toHaveCount(0);
  }
});

// Acceptance 5. A real server error, with no test-only route to ship: one of the shop's items holds unreadable JSON, so
// the page throws while rendering. Repairing the row before `Try again` proves that button re-renders from the server.
test('a server error renders the error page, and Try again recovers', async ({ page }) => {
  const shop = createFixtureShop('Broken Page Bakery');
  const itemId = Object.values(shop.items)[0].id;
  const db = getDb();
  const { issues_json: before } = db.prepare('SELECT issues_json FROM items WHERE id = ?').get(itemId) as { issues_json: string };
  db.prepare('UPDATE items SET issues_json = ? WHERE id = ?').run('not json', itemId);
  try {
    await page.goto(`/s/${shop.shop.slug}`);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' }); // the dev overlay would cover the button
    await expect(page.getByRole('heading', { name: 'That page didn’t load' })).toBeVisible();
    db.prepare('UPDATE items SET issues_json = ? WHERE id = ?').run(before, itemId);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Broken Page Bakery' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'That page didn’t load' })).toHaveCount(0);
  } finally {
    db.prepare('UPDATE items SET issues_json = ? WHERE id = ?').run(before, itemId);
  }
});

for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`acceptance 7 at ${label} px`, () => {
    test.use({ viewport });

    const check = async (page: Page, name: string) => {
      await settle(page);
      await a11y(page);
      await noSideways(page);
      await page.screenshot({ path: `test-results/wp7-${name}-${label}.png`, fullPage: true });
    };

    for (const [name, path, heading] of [['signup', '/signup', 'Create'], ['login', '/login', 'Log in'], ['recover', '/recover', '']] as const) {
      test(`${name} passes axe with no sideways scroll`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: new RegExp(heading) })).toBeVisible();
        await check(page, name);
      });
    }

    test('the recovery step passes axe with no sideways scroll', async ({ page }) => {
      await page.goto('/signup');
      await page.locator('#signup-email').fill(`e2e-recovery-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`);
      await page.locator('#new-password').fill('a long sentence only this test says');
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page.getByRole('heading', { name: 'Save your recovery key' })).toBeVisible();
      await check(page, 'recovery-step');
    });

    test('Your shops, Add a shop and Account pass axe with no sideways scroll', async ({ page }) => {
      await signUpForShops(page, 'screens');
      expect((await page.request.post('/api/shops', { data: { sample: 'marigold-bakehouse' } })).status()).toBe(201);
      for (const [name, path] of [['your-shops', '/shops'], ['add-a-shop', '/shops/new'], ['account', '/account']] as const) {
        await page.goto(path);
        await check(page, name);
      }
    });
  });

  test.describe(`acceptance 8 at ${label} px`, () => {
    test.use({ viewport });

    const shown = (page: Page) => expect(page.getByText(TEST_MODE_LINE).locator('visible=true').first()).toBeVisible();

    test('the test-mode line shows on every seller and buyer screen', async ({ page, context }) => {
      const shop = createFixtureShop('Test Mode Bakery');
      const order = addFixtureOrder(shop, { status: 'paid', fulfillment: 'pickup', lines: [[Object.keys(shop.items)[0], 1]], minutesAgo: 30 });
      for (const path of [`/s/${shop.shop.slug}`, `/o/${order.id}`]) {
        await page.goto(path);
        await shown(page);
      }
      await signInAsOwner(context, shop, BASE);
      const seller = `/shops/${shop.shop.id}`;
      for (const path of [seller, `${seller}?tab=menu`, `${seller}?tab=share`, `${seller}?tab=settings`, `${seller}/card`, `${seller}/orders/${order.id}`]) {
        await page.goto(path);
        await shown(page);
      }
    });

    test('and on setup, for a draft', async ({ page }) => {
      await signUpForShops(page, 'setup');
      const res = await page.request.post('/api/shops', { data: { sample: 'marigold-bakehouse' } });
      expect(res.status()).toBe(201);
      await page.route('**/api/shops/*/extract', () => {}); // the reading never answers, and Claude is never called
      await page.goto(`/shops/${((await res.json()) as { shopId: string }).shopId}/setup`);
      await expect(page.getByRole('heading', { level: 1, name: 'Reading your menu…' })).toBeVisible();
      await shown(page);
    });
  });
}
