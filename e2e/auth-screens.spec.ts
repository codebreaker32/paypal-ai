// The account screens (brief WP6): sign-up, recovery key, log in and out, the header's states and the account menu.
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, a11y, settle } from './helpers';

const PASSWORD = 'a long sentence only this test says';
const email = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function signUp(page: Page, address: string, password = PASSWORD) {
  await page.goto('/signup');
  await page.locator('#signup-email').fill(address);
  await page.locator('#new-password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Save your recovery key' })).toBeVisible();
}

test.describe('sign-up and the recovery key', () => {
  test('creating an account shows the key once, Download saves it, Continue moves on', async ({ page }) => {
    const address = email('signup');
    await signUp(page, address);
    await expect(page.getByRole('heading', { name: 'Save your recovery key' })).toBeFocused();
    await expect(page.getByText(`You’ll log in with ${address}.`)).toBeVisible();
    const key = await page.getByTestId('recovery-key').textContent();
    expect(key).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);

    const saved = page.waitForResponse((r) => r.url().endsWith('/api/account/recovery-key') && r.request().method() === 'PATCH');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
    expect(download.suggestedFilename()).toBe('shelfie-recovery-key.txt');
    expect((await saved).status()).toBe(204);

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL('**/shops/new');
  });

  test('errors: bad email, short password, taken email', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter your email, like rosa@example.com.')).toBeVisible();
    await expect(page.locator('#signup-email')).toBeFocused();

    await page.locator('#signup-email').fill('rosa@example.com');
    await page.locator('#new-password').fill('short');
    await expect(page.getByText('10 more to go')).toBeVisible();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Use at least 15 characters.')).toBeVisible();

    const taken = email('taken');
    await page.request.post('/api/auth/signup', { data: { email: taken, password: PASSWORD } });
    await page.context().clearCookies();
    await page.locator('#signup-email').fill(taken);
    await page.locator('#new-password').fill(PASSWORD);
    await expect(page.getByText('Long enough')).toBeVisible();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('link', { name: 'use your recovery key' })).toHaveAttribute('href', '/recover');
    await expect(page.getByRole('main').getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  test('the show button reveals the password and hides it again on submit', async ({ page }) => {
    await page.goto('/signup');
    const field = page.locator('#new-password');
    await field.fill('short');
    await page.getByRole('button', { name: 'Show password (it will be visible on screen)' }).click();
    await expect(field).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(field).toHaveAttribute('type', 'password');
  });
});

test.describe('log in and out', () => {
  test('wrong password, then right; a logged-in visitor to /login goes to their landing page', async ({ page }) => {
    const address = email('login');
    await page.request.post('/api/auth/signup', { data: { email: address, password: PASSWORD } });
    await page.context().clearCookies();

    await page.goto('/login');
    await page.locator('#login-email').fill(address);
    await page.locator('#current-password').fill('not the right password at all');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByText('That email and password don’t match.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'reset your password' })).toHaveAttribute('href', '/recover');

    await page.locator('#current-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.waitForURL('**/shops/new');

    await page.goto('/login');
    await page.waitForURL('**/shops/new');
  });

  test('required autocomplete and ids; Forgot password? is reachable by keyboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#login-email')).toHaveAttribute('autocomplete', 'username');
    await expect(page.locator('#login-email')).toHaveAttribute('autocapitalize', 'none');
    await expect(page.locator('#current-password')).toHaveAttribute('autocomplete', 'current-password');
    await expect(page.locator('#login-email')).toHaveAttribute('name', 'login-email');
    await page.locator('#current-password').focus();
    await page.keyboard.press('Tab'); // the show button
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeFocused();

    await page.goto('/signup');
    await expect(page.locator('#new-password')).toHaveAttribute('autocomplete', 'new-password');
    await page.goto('/recover');
    await expect(page.locator('#recover-new-password')).toHaveAttribute('autocomplete', 'new-password');
  });

  test('a shop link asks the seller to log in to open it, and a stray next is ignored', async ({ page }) => {
    await page.goto('/login?next=/shops/abc');
    await expect(page.getByText('Log in to open this shop.')).toBeVisible();
    await page.goto('/login?next=https://evil.example');
    await expect(page.getByText('Log in to open this shop.')).toHaveCount(0);
  });

  test('recovery sets a new password and shows a new key', async ({ page }) => {
    const address = email('recover');
    const res = await page.request.post('/api/auth/signup', { data: { email: address, password: PASSWORD } });
    const { recoveryKey } = (await res.json()) as { recoveryKey: string };
    await page.context().clearCookies();

    await page.goto('/recover');
    await expect(page.getByRole('link', { name: 'What you can do' })).toHaveAttribute('href', '/help#locked-out');
    await page.locator('#recover-email').fill(address);
    await page.locator('#recovery-key').fill('AAAAA-BBBBB-CCCCC-DDDDD');
    await page.locator('#recover-new-password').fill('another sentence i would say');
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByText('That email and recovery key don’t match. Check for typos.')).toBeVisible();

    await page.locator('#recovery-key').fill(recoveryKey);
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByRole('heading', { name: 'Save your recovery key' })).toBeVisible();
    expect(await page.getByTestId('recovery-key').textContent()).not.toBe(recoveryKey);
  });
});

test.describe('the header', () => {
  test('logged out at 1440: Log in and Add your shop; at 390 only Log in', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/help-does-not-exist');
    const header = page.locator('header[data-site-chrome]');
    await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Add your shop' })).toBeVisible();
    await page.setViewportSize(PHONE);
    await expect(header.getByRole('link', { name: 'Add your shop' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('auth pages offer the other door, and the prompt only at 1440', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/login');
    const header = page.locator('header[data-site-chrome]');
    await expect(header.getByText('New to Shelfie?')).toBeVisible();
    await expect(header.getByRole('link', { name: 'Add your shop' })).toHaveAttribute('href', '/signup');
    await page.goto('/signup');
    await expect(header.getByText('Have an account?')).toBeVisible();
    await page.setViewportSize(PHONE);
    await expect(header.getByText('Have an account?')).toBeHidden();
    await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('the account menu opens by keyboard, closes on Esc, returns focus, and logs out', async ({ page }) => {
    const address = email('menu');
    await page.request.post('/api/auth/signup', { data: { email: address, password: PASSWORD } });
    await page.goto('/this-page-does-not-exist');
    const header = page.locator('header[data-site-chrome]');
    await expect(header.getByRole('link', { name: 'Shelfie home' })).toHaveAttribute('href', '/shops');

    const trigger = header.getByRole('button', { name: 'Account' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByTestId('account-menu');
    await expect(menu.getByText(address)).toBeVisible();
    for (const name of ['Your shops', 'Add a shop', 'Account', 'Help']) await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
    await expect(menu.locator('[role="menu"]')).toHaveCount(0);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.locator('h1').click();
    await expect(menu).toBeHidden();

    await trigger.click();
    await menu.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.locator('header[data-site-chrome]').getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('buyer pages show the logo alone', async ({ page }) => {
    await page.goto('/o/does-not-exist');
    const header = page.locator('header[data-site-chrome]');
    await expect(header.getByRole('link')).toHaveCount(1);
  });
});

test.describe('how they look', () => {
  for (const [name, size] of [['390', PHONE], ['1440', DESKTOP]] as const) {
    test(`auth screens at ${name}: no overflow, no axe violations`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const path of ['/signup', '/login', '/recover']) {
        await page.goto(path);
        await settle(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await a11y(page);
        await page.screenshot({ path: `test-results/wp6-auth${path.replace('/', '-')}-${name}.png` });
      }
      await signUp(page, email(`look${name}`));
      await settle(page);
      await a11y(page);
      await page.screenshot({ path: `test-results/wp6-auth-key-${name}.png` });
    });
  }
});
