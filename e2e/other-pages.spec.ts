// The not-found, /claim/<bad>, Help, Terms and Privacy pages (brief WP7, Other pages). Run: E2E_PORT=3251 npx playwright test e2e/other-pages.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, a11y, settle, smallTargets } from './helpers';
import { TEST_MODE_LINE } from '../src/lib/brand/test-mode';

const noSideways = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

const DRAFT = 'Early-access draft, last updated 8 November 2026';

for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`at ${label} px`, () => {
    test.use({ viewport });

    for (const path of ['/help', '/terms', '/privacy', '/no-such-page']) {
      test(`${path} passes axe, has no sideways scroll, and shows the test-mode line`, async ({ page }) => {
        await page.goto(path);
        await settle(page);
        await a11y(page);
        await noSideways(page);
        expect(await smallTargets(page, 'footer')).toEqual([]);
        await expect(page.locator('footer')).toContainText(TEST_MODE_LINE);
        await page.screenshot({ path: `test-results/wp7${path.replace('/', '-')}-${label}.png`, fullPage: true });
      });
    }
  });
}

test('every footer list is named by its heading', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/help');
  const footer = page.locator('footer');
  for (const name of ['Product', 'Help', 'For AI assistants', 'Legal']) await expect(footer.getByRole('list', { name, exact: true })).toHaveCount(1);
});

test('404, logged out: the brief’s copy with Go to Shelfie and Log in', async ({ page }) => {
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'We can’t find that page' })).toBeVisible();
  await expect(page.getByText('It may have moved, or it may belong to a shop you’re not logged in to.')).toBeVisible();
  const main = page.locator('#main');
  await expect(main.getByRole('link', { name: 'Go to Shelfie' })).toHaveAttribute('href', '/');
  await expect(main.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  await expect(main.getByRole('link', { name: 'Your shops' })).toHaveCount(0);
});

test('404, logged in: Your shops, and no Log in', async ({ page }) => {
  const res = await page.request.post('/api/auth/signup', {
    data: { email: `e2e-404-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`, password: 'a long sentence only this test says' },
  });
  expect(res.status()).toBe(201);
  expect((await page.goto('/no-such-page'))?.status()).toBe(404);
  const main = page.locator('#main');
  await expect(main.getByRole('link', { name: 'Your shops' })).toHaveAttribute('href', '/shops');
  await expect(main.getByRole('link', { name: 'Log in' })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Go to Shelfie' })).toHaveCount(0);
});

test('a bad owner link is a branded 404 page with a way to log in', async ({ page }) => {
  const res = await page.goto(`/claim/${'b'.repeat(40)}`);
  expect(res?.status()).toBe(404);
  expect(res?.headers()['content-type']).toMatch(/^text\/html/);
  await expect(page.getByText('This owner link doesn’t work. Check that you copied all of it, or log in.')).toBeVisible();
  await expect(page.getByAltText('Shelfie')).toBeVisible();
  await page.getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('Help has every anchor, the brief’s copy, and a contact', async ({ page }) => {
  await page.goto('/help');
  for (const id of ['test-mode', 'get-paid', 'locked-out', 'delete', 'contact']) await expect(page.locator(`#${id}`)).toHaveCount(1);
  await expect(page.locator('#test-mode')).toContainText(
    'Shelfie runs on the PayPal sandbox, PayPal’s practice system for payments. Orders and payments are practice runs and no real money moves.',
  );
  await expect(page.locator('#locked-out')).toContainText(
    'Without your password and recovery key we can’t confirm the account is yours, so we can’t reset it for you yet. Your shop keeps running.',
  );
  await expect(page.locator('#delete')).toContainText('To delete a shop, open its Settings and go to Delete this shop at the foot of the page.');
  await expect(page.locator('#contact a')).toHaveAttribute('href', /^(mailto:.+|https:\/\/github\.com\/codebreaker32\/paypal-ai\/issues)$/);
});

for (const [path, title, required] of [
  ['/terms', 'Terms', ['early access', 'PayPal sandbox', 'allergens', 'PayPal’s own terms', 'no warranty', 'close your account']],
  ['/privacy', 'Privacy', ['hash of your password', 'hash of your recovery key', 'PayPal email', 'ship-to', 'hashed caller id', 'Conversations with the shop assistant', 'Anthropic', 'Pexels', 'session cookie', 'returning cookie', 'owner cookie', 'no analytics and no ads']],
] as const) {
  test(`${title} carries the draft heading and what the brief requires`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: DRAFT })).toBeVisible();
    const main = page.locator('#main');
    for (const phrase of required) await expect(main).toContainText(phrase);
    await expect(main).not.toContainText(/governing law|lorem ipsum|TODO|TBD|\[.*\]/i);
  });
}
