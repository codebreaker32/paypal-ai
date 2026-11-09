// The account and public screens for the judge's screenshot set (WP7 acceptance 7), at 390 and 1440 px with an axe
// check. Skipped unless SCREENSHOTS_DIR names a folder; run against a production build beside e2e/screenshots.spec.ts.
//
// SCREENSHOTS_DIR=docs/judge/screenshots/round-12 E2E_PORT=3190 E2E_REUSE_SERVER=1 npx playwright test e2e/screenshots-account.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { a11y, DESKTOP, PHONE, settle, signUpForShops } from './helpers';

const OUT = process.env.SCREENSHOTS_DIR;
test.skip(!OUT, 'set SCREENSHOTS_DIR=<folder> to take these');

async function shot(page: Page, name: string, label: string) {
  await settle(page);
  await a11y(page);
  await page.screenshot({ path: path.join(OUT!, `${name}-${label}.png`), fullPage: true, animations: 'disabled' });
}

for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`account and public screens at ${label} px`, () => {
    test.use({ viewport });
    test.beforeAll(() => fs.mkdirSync(OUT!, { recursive: true }));

    for (const [name, url] of [
      ['landing', '/'],
      ['signup', '/signup'],
      ['login', '/login'],
      ['recover', '/recover'],
      ['help', '/help'],
      ['terms', '/terms'],
      ['privacy', '/privacy'],
      ['not-found', '/this-page-does-not-exist'],
    ] as const) {
      test(name, async ({ page }) => {
        await page.goto(url);
        await shot(page, name, label);
      });
    }

    test('recovery-step (a made-up key: the sign-up answer is stubbed so no real key is in a committed picture)', async ({ page }) => {
      await page.route('**/api/auth/signup', (route) =>
        route.fulfill({ status: 201, json: { recoveryKey: 'ABCDE-FGHJK-MNPQR-STVWX', next: '/shops/new' } }),
      );
      await page.goto('/signup');
      await page.getByLabel('Email').fill('rosa@example.com');
      await page.getByLabel('Password', { exact: true }).fill('a long sentence only this test says');
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Save your recovery key' })).toBeVisible();
      await shot(page, 'recovery-step', label);
    });

    test('shops-new, shops, account, account-menu', async ({ page }) => {
      await signUpForShops(page, `shots${label}`);
      await page.goto('/shops/new');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await shot(page, 'shops-new', label);
      for (let i = 0; i < 2; i++) expect((await page.request.post('/api/shops', { data: { sample: 'marigold-bakehouse' }, timeout: 60_000 })).status()).toBe(201);
      await page.goto('/shops');
      await expect(page.getByRole('heading', { level: 1, name: 'Your shops' })).toBeVisible();
      await shot(page, 'shops', label);
      await page.goto('/account');
      await shot(page, 'account', label);
      await page.getByRole('button', { name: 'Account', exact: true }).click();
      await expect(page.getByTestId('account-menu')).toBeVisible();
      await shot(page, 'account-menu', label);
    });
  });
}
