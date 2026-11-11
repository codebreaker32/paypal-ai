// Accounts end to end (brief WP6 acceptance): the journey, the shop list, Add a shop, /account, the recovery banner and the PayPal email check.
// Acceptance, by number: 1 'the journey' (first test). 2 'a second browser'. 3 '/shops' (two shops, one shop). 4 'a shop owned by an account' (first test).
// 5 and 6 their own describes below. 7 the shell test plus its own describe. 8 'the recovery banner' plus its own describe. 9 'changing the PayPal email'.
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { getDb } from '../src/lib/db';
import { DESKTOP, PHONE, a11y } from './helpers';
import { addFixtureOrder, createFixtureShop } from './task8-fixtures';

const PASSWORD = 'a long sentence only this test says';
const email = (tag: string) => `e2e-acct-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
const banner = (page: Page) => page.locator('[data-shell-banner]', { hasText: 'Save your recovery key.' });
const rows = (page: Page) => page.getByTestId('shop-row');

/** Signs up in this browser, leaving the recovery key unsaved. */
async function signUp(page: Page, address = email('user'), password = PASSWORD) {
  const res = await page.request.post('/api/auth/signup', { data: { email: address, password } });
  expect(res.status()).toBe(201);
  return address;
}

/** A published shop owned by the account with this email. */
function ownedShop(address: string, name = 'Rosa Bakes') {
  const f = createFixtureShop(name);
  getDb().prepare('UPDATE shops SET account_id = (SELECT id FROM accounts WHERE email = ?) WHERE id = ?').run(address, f.shop.id);
  return f;
}

async function saveKey(page: Page, address: string) {
  getDb().prepare("UPDATE accounts SET recovery_saved_at = '2026-11-08T12:00:00.000Z' WHERE email = ?").run(address);
  void page;
}

async function logIn(page: Page, address: string, password = PASSWORD) {
  await page.locator('#login-email').fill(address);
  await page.locator('#current-password').fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

async function logOut(page: Page) {
  await page.getByRole('button', { name: 'Account' }).first().click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL((u) => u.pathname === '/');
}

async function freshContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ baseURL: test.info().project.use.baseURL });
}

test.describe('the journey', () => {
  test('sign up, recovery step, /shops/new, a sample, setup; log out; log in returns to that shop', async ({ page }) => {
    const address = email('journey');
    await page.goto('/signup');
    await page.locator('#signup-email').fill(address);
    await page.locator('#new-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Save your recovery key' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL('**/shops/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Add your shop' })).toBeVisible();

    await page.getByRole('button', { name: 'Try the sample menu from Marigold Bakehouse' }).click();
    await page.waitForURL(/\/shops\/[^/]+\/setup$/, { timeout: 30_000 });
    const setup = new URL(page.url()).pathname;

    await page.goto('/shops');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Not published yet');
    await expect(rows(page).first()).toHaveAttribute('href', setup);
    await logOut(page);

    await page.goto('/login');
    await logIn(page, address);
    await page.waitForURL(`**${setup}`);
  });

  test('a second browser opens the dashboard after logging in, with no owner cookie', async ({ page, browser }) => {
    const address = await signUp(page);
    const f = ownedShop(address);
    const other = await freshContext(browser);
    const second = await other.newPage();
    await second.goto('/login');
    await logIn(second, address);
    await second.waitForURL(`**/shops/${f.shop.id}`);
    await expect(second.locator('[data-app-shell]')).toBeVisible();
    expect((await other.cookies()).some((c) => c.name.startsWith('shelfie_owner_'))).toBe(false);
    await other.close();
  });
});

test.describe('/shops', () => {
  test('two shops: both listed, to-prepare first, Add a shop opens /shops/new', async ({ page }) => {
    const address = await signUp(page);
    const quiet = ownedShop(address, 'Quiet Corner');
    const busy = ownedShop(address, 'Busy Bakers');
    addFixtureOrder(busy, { status: 'paid', fulfillment: 'pickup', minutesAgo: 5, lines: [['Butter croissant', 1]] });
    addFixtureOrder(busy, { status: 'paid', fulfillment: 'pickup', minutesAgo: 6, lines: [['Morning bun', 1]] });

    await page.goto('/shops');
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(0)).toContainText('Busy Bakers');
    await expect(rows(page).nth(0)).toContainText('2');
    await expect(rows(page).nth(0)).toContainText('to prepare');
    await expect(rows(page).nth(1)).toContainText('Quiet Corner');
    await expect(rows(page).nth(1)).not.toContainText('to prepare');
    await expect(rows(page).nth(1)).toHaveAttribute('href', `/shops/${quiet.shop.id}`);

    await page.getByRole('link', { name: 'Add a shop' }).click();
    await page.waitForURL('**/shops/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Add a shop' })).toBeVisible();
    await expect(page.getByText('No photo handy? Try a sample:')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'See a live shop' })).toHaveCount(0);
  });

  test('one shop: login goes straight in, and the switcher opens a one-row list', async ({ page }) => {
    const address = await signUp(page);
    const f = ownedShop(address);
    await saveKey(page, address);
    await page.context().clearCookies();

    await page.goto('/login');
    await logIn(page, address);
    await page.waitForURL(`**/shops/${f.shop.id}`);
    await page.setViewportSize(DESKTOP);
    await page.getByTestId('shop-switcher').click();
    await page.waitForURL('**/shops');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Add a shop' })).toBeVisible();
  });

  test('no shops redirects to /shops/new; logged out goes to log in', async ({ page, browser }) => {
    await signUp(page);
    await page.goto('/shops');
    await page.waitForURL('**/shops/new');
    await expect(page.getByText('No photo handy? Try a sample:')).toBeVisible();
    // No picture before the seller picks one; the AuthFrame photo panel (an <aside>, decorative) is not the form's.
    await expect(page.getByRole('main').locator('img:not(aside img)')).toHaveCount(0);

    const other = await freshContext(browser);
    const logged = await other.newPage();
    const res = await logged.request.get('/shops', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toContain('/login?next=/shops');
    await other.close();
  });

  for (const [name, size] of [['390', PHONE], ['1440', DESKTOP]] as const) {
    test(`the row at ${name}: the count ${name === '390' ? 'under the status' : 'in its own column'}, 88 px, no axe problems`, async ({ page }) => {
      await page.setViewportSize(size);
      const address = await signUp(page);
      const f = ownedShop(address, 'A Shop Whose Name Is Rather Long And Would Certainly Overflow A Phone Screen');
      addFixtureOrder(f, { status: 'paid', fulfillment: 'pickup', minutesAgo: 5, lines: [['Morning bun', 1]] });
      await page.goto('/shops');
      const row = rows(page).first();
      const box = (await row.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(88);
      const status = (await row.getByText('Live').boundingBox())!;
      const count = (await row.getByText('to prepare').boundingBox())!;
      if (name === '390') expect(count.y).toBeGreaterThanOrEqual(status.y + status.height);
      else expect(count.x).toBeGreaterThan(status.x + status.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/wp6-shops-${name}.png`, fullPage: true });
      await a11y(page);
    });
  }
});

test.describe('a shop owned by an account', () => {
  test('logged out with the returning cookie goes to log in and comes back; a fresh browser gets a 404', async ({ page, browser }) => {
    const address = await signUp(page);
    const f = ownedShop(address);
    await saveKey(page, address);
    await page.goto(`/shops/${f.shop.id}`);
    await page.request.post('/api/auth/logout');
    await page.goto(`/shops/${f.shop.id}`);
    await page.waitForURL(/\/login\?next=/);
    await logIn(page, address);
    await page.waitForURL(`**/shops/${f.shop.id}`);

    const other = await freshContext(browser);
    const stranger = await other.newPage();
    const res = await stranger.goto(`/shops/${f.shop.id}`);
    expect(res?.status()).toBe(404);
    await other.close();
  });

  test('the shell has the account menu; it opens upward in the sidebar, closes on Esc and returns focus', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const address = await signUp(page);
    const f = ownedShop(address);
    await page.goto(`/shops/${f.shop.id}`);
    const trigger = page.getByRole('button', { name: 'Account' }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByTestId('account-menu').first();
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(address);
    const panel = (await menu.boundingBox())!;
    const button = (await trigger.boundingBox())!;
    expect(panel.y + panel.height).toBeLessThanOrEqual(button.y);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('the recovery banner is on every section and /shops until the key is saved', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const address = await signUp(page);
    const f = ownedShop(address);
    for (const path of [`/shops/${f.shop.id}`, `/shops/${f.shop.id}?tab=menu`, `/shops/${f.shop.id}?tab=share`, `/shops/${f.shop.id}?tab=settings`, '/shops']) {
      await page.goto(path);
      await expect(banner(page)).toBeVisible();
    }
    await page.getByRole('link', { name: 'Get a new key' }).click();
    await page.waitForURL('**/account#recovery-key');
    await expect(page.getByText('Not saved yet')).toBeVisible();

    await page.locator('#account-current-password').fill('not the right password at all');
    await page.getByRole('button', { name: 'Create a new key' }).click();
    await expect(page.getByText('That password doesn’t match.')).toBeVisible();

    await page.locator('#account-current-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create a new key' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Save your recovery key' })).toBeFocused();
    await expect(page.locator('h1')).toHaveCount(1);
    const saved = page.waitForResponse((r) => r.url().endsWith('/api/account/recovery-key') && r.request().method() === 'PATCH');
    await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
    expect((await saved).status()).toBe(204);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/Saved on \d{1,2} [A-Z][a-z]{2} \d{4}/)).toBeVisible();

    await page.goto('/shops');
    await expect(banner(page)).toHaveCount(0);
    await page.goto(`/shops/${f.shop.id}`);
    await expect(banner(page)).toHaveCount(0);
  });

  test('changing the PayPal email needs the password; wrong and missing leave it unchanged', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const address = await signUp(page);
    const f = ownedShop(address);
    await saveKey(page, address);
    await page.goto(`/shops/${f.shop.id}?tab=settings`);
    const form = page.getByTestId('payee-form');
    const emailField = form.getByRole('textbox', { name: /Your PayPal email/ });
    const passwordField = form.locator('#payee-current-password');
    await expect(passwordField).toHaveCount(0);
    await expect(form.getByText('PayPal email changed on')).toHaveCount(0);

    await emailField.fill('new-paypal@example.com');
    await expect(passwordField).toBeVisible();
    await expect(form.getByText('Your Shelfie password')).toBeVisible();
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('Enter your Shelfie password to do that.')).toBeVisible();
    await expect(passwordField).toBeFocused();
    await page.reload();
    await expect(emailField).not.toHaveValue('new-paypal@example.com');

    await emailField.fill('new-paypal@example.com');
    await passwordField.fill('not the right password at all');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('That password doesn’t match.')).toBeVisible();

    await passwordField.fill(PASSWORD);
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('PayPal email changed on')).toBeVisible();
    await expect(passwordField).toHaveCount(0);
    await page.reload();
    await expect(emailField).toHaveValue('new-paypal@example.com');
    await expect(form.getByText('PayPal email changed on')).toBeVisible();
  });

  test('going back to the saved email hides the password field', async ({ page }) => {
    const address = await signUp(page);
    const f = ownedShop(address);
    await saveKey(page, address);
    await page.goto(`/shops/${f.shop.id}?tab=settings`);
    const form = page.getByTestId('payee-form');
    const emailField = form.getByRole('textbox', { name: /Your PayPal email/ });
    const before = await emailField.inputValue();
    await emailField.fill('other@example.com');
    await expect(form.locator('#payee-current-password')).toBeVisible();
    await emailField.fill(before);
    await expect(form.locator('#payee-current-password')).toHaveCount(0);
  });
});

test.describe('/shops/new and /account', () => {
  for (const [name, size] of [['390', PHONE], ['1440', DESKTOP]] as const) {
    test(`at ${name}: the page frame, no sideways scroll, no axe problems`, async ({ page }) => {
      await page.setViewportSize(size);
      await signUp(page);
      await page.goto('/shops/new');
      await expect(page.getByTestId('photo-input')).toHaveCount(1);
      const frame = await page.locator('header [data-page-frame]').first().getAttribute('class');
      expect(frame).toContain('max-w-page');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/wp6-new-${name}.png`, fullPage: true });
      await a11y(page);

      await page.goto('/account');
      await expect(page.getByRole('heading', { name: 'Recovery key' })).toBeVisible();
      await expect(page.getByText('This cancels your old key.')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/wp6-account-${name}.png`, fullPage: true });
      await a11y(page);
    });
  }
});

test.describe('acceptance 5: a logged-in visitor to /login goes to landingPath', () => {
  const visitLogin = async (page: Page) => {
    const res = await page.request.get('/login', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    await page.goto('/login');
  };

  test('no shops: /shops/new', async ({ page }) => {
    await signUp(page);
    await visitLogin(page);
    await page.waitForURL('**/shops/new');
  });

  test('one published shop: its dashboard, in the shell', async ({ page }) => {
    const f = ownedShop(await signUp(page));
    await visitLogin(page);
    await page.waitForURL(`**/shops/${f.shop.id}`);
    await expect(page.locator('[data-app-shell]')).toBeVisible();
  });

  test('one draft: its setup', async ({ page }) => {
    const f = ownedShop(await signUp(page));
    getDb().prepare("UPDATE shops SET status = 'draft' WHERE id = ?").run(f.shop.id);
    await visitLogin(page);
    await page.waitForURL(`**/shops/${f.shop.id}/setup`);
  });

  test('two shops: the list', async ({ page }) => {
    const address = await signUp(page);
    ownedShop(address, 'First Shop');
    ownedShop(address, 'Second Shop');
    await visitLogin(page);
    await page.waitForURL((u) => u.pathname === '/shops');
    await expect(rows(page)).toHaveCount(2);
  });

  test('a safe next wins over landingPath, a stray one does not', async ({ page }) => {
    await signUp(page);
    await page.goto('/login?next=/account');
    await page.waitForURL('**/account');
    await page.goto('/login?next=https://evil.example');
    await page.waitForURL('**/shops/new');
  });
});

test.describe('acceptance 6: password managers and the keyboard', () => {
  test('Forgot password? is reached with Tab alone and Enter opens it', async ({ page }) => {
    await page.goto('/login');
    const forgot = page.getByRole('link', { name: 'Forgot password?' });
    await expect(forgot).toBeVisible();
    let reached = false;
    for (let press = 0; press < 12 && !reached; press++) {
      await page.keyboard.press('Tab');
      reached = await forgot.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Enter');
    await page.waitForURL('**/recover');
  });

  test('each field has the required autocomplete, and no two forms share an id or a name', async ({ page }) => {
    const forms: [string, Record<string, string>][] = [
      ['/signup', { 'signup-email': 'username', 'new-password': 'new-password' }],
      ['/login', { 'login-email': 'username', 'current-password': 'current-password' }],
      ['/recover', { 'recover-email': 'username', 'recover-new-password': 'new-password' }],
    ];
    const ids: string[] = [];
    const names: string[] = [];
    for (const [path, fields] of forms) {
      await page.goto(path);
      const inputs = page.locator('main input[type="email"], main input[type="password"]');
      await expect(inputs).toHaveCount(Object.keys(fields).length);
      for (const [id, autocomplete] of Object.entries(fields)) {
        await expect(page.locator(`#${id}`)).toHaveAttribute('autocomplete', autocomplete);
        ids.push(id);
        names.push((await page.locator(`#${id}`).getAttribute('name')) ?? '');
      }
    }
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });
});

test.describe('acceptance 7: the account menu outside the sidebar', () => {
  test('the public header on /shops: opens by keyboard, closes on Esc, returns focus', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    ownedShop(await signUp(page));
    await page.goto('/shops');
    const trigger = page.locator('header[data-site-chrome]').getByRole('button', { name: 'Account' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByTestId('account-menu');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('the shell top bar at 390: opens downward, closes on Esc, returns focus', async ({ page }) => {
    await page.setViewportSize(PHONE);
    const f = ownedShop(await signUp(page));
    await page.goto(`/shops/${f.shop.id}`);
    const trigger = page.getByRole('button', { name: 'Account' }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByTestId('account-menu').filter({ visible: true });
    await expect(menu).toBeVisible();
    const panel = (await menu.boundingBox())!;
    const button = (await trigger.boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(button.y + button.height);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('acceptance 8: Download at sign-up', () => {
  test('the banner never comes back once the key from sign-up is downloaded', async ({ page }) => {
    const address = email('download');
    await page.goto('/signup');
    await page.locator('#signup-email').fill(address);
    await page.locator('#new-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Save your recovery key' })).toBeVisible();
    const f = ownedShop(address);

    const saved = page.waitForResponse((r) => r.url().endsWith('/api/account/recovery-key') && r.request().method() === 'PATCH');
    await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
    expect((await saved).status()).toBe(204);

    await page.goto('/shops');
    await expect(rows(page)).toHaveCount(1);
    await expect(banner(page)).toHaveCount(0);
    await page.goto(`/shops/${f.shop.id}`);
    await expect(page.locator('[data-app-shell]')).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  });

  test('without Download, Continue leaves the banner on /shops', async ({ page }) => {
    const address = email('skipped');
    await page.goto('/signup');
    await page.locator('#signup-email').fill(address);
    await page.locator('#new-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Save your recovery key' })).toBeVisible();
    ownedShop(address);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL((u) => u.pathname.startsWith('/shops'));
    await page.goto('/shops');
    await expect(banner(page)).toBeVisible();
  });
});

test.describe('review round 1', () => {
  test('text typed before React arrives is kept, and Log in waits for it instead of losing it', async ({ browser }) => {
    const context = await freshContext(browser);
    const held: (() => void)[] = [];
    let hold = true;
    await context.route('**/_next/**', (route) => {
      if (hold && route.request().resourceType() === 'script') held.push(() => void route.continue());
      else void route.continue();
    });
    const page = await context.newPage();
    await page.goto('/login', { waitUntil: 'commit' });
    const field = page.locator('#login-email');
    const address = email('late');
    await field.waitFor();
    await field.fill(address);
    await page.locator('#current-password').fill(PASSWORD);

    // Before hydration a press and Enter send nothing: no POST that would come back as a blank form.
    const button = page.getByRole('button', { name: 'Log in', exact: true });
    await expect(button).toBeDisabled();
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname === '/login') posts.push(r.url());
    });
    await page.locator('#current-password').press('Enter');
    expect(posts).toEqual([]);
    await expect(field).toHaveValue(address);

    hold = false;
    held.forEach((go) => go());
    await expect(button).toBeEnabled({ timeout: 60_000 });
    await expect(field).toHaveValue(address);
    await expect(page.locator('#current-password')).toHaveValue(PASSWORD);

    const sent = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/api/auth/login'));
    await button.click();
    const body = (await sent).postDataJSON() as { email: string; password: string };
    expect(body.email).toBe(address);
    expect(body.password).toBe(PASSWORD);
    await context.close();
  });

  test('a Download then Back: the banner is gone without a reload', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const address = await signUp(page, email('back'));
    const f = ownedShop(address);
    await page.goto(`/shops/${f.shop.id}`);
    await expect(banner(page)).toBeVisible();
    await page.getByRole('link', { name: 'Get a new key' }).click();
    await page.waitForURL('**/account#recovery-key');
    await page.locator('#account-current-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create a new key' }).click();
    const saved = page.waitForResponse((r) => r.url().endsWith('/api/account/recovery-key') && r.request().method() === 'PATCH');
    await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
    expect((await saved).status()).toBe(204);

    await page.goBack();
    await page.waitForURL(`**/shops/${f.shop.id}`);
    await expect(page.getByRole('link', { name: 'Menu' }).first()).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
    await page.getByRole('link', { name: 'Menu' }).first().click();
    await expect(banner(page)).toHaveCount(0);
  });

  test('a password typed for an abandoned PayPal email change does not come back', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const address = await signUp(page, email('abandon'));
    const f = ownedShop(address);
    await saveKey(page, address);
    await page.goto(`/shops/${f.shop.id}?tab=settings`);
    const form = page.getByTestId('payee-form');
    const emailBox = form.getByRole('textbox', { name: /Your PayPal email/ });
    const passwordBox = form.locator('#payee-current-password');
    const savedEmail = await emailBox.inputValue();

    await emailBox.fill('typo@example.com');
    await passwordBox.fill(PASSWORD);
    await emailBox.fill(savedEmail);
    await expect(passwordBox).toHaveCount(0);
    await emailBox.fill('attacker@example.com');
    await expect(passwordBox).toBeVisible();
    await expect(passwordBox).toHaveValue('');

    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('Enter your Shelfie password to do that.')).toBeVisible();
    const row = getDb().prepare('SELECT payee_email FROM shops WHERE id = ?').get(f.shop.id) as { payee_email: string };
    expect(row.payee_email).toBe(savedEmail);
  });
});
