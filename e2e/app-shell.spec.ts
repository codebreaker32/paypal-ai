// The seller app shell (spec WP4): sidebar and tab bar, section switching without a server round trip, the one banner
// slot, skip link and landmarks. Run: E2E_PORT=3221 npx playwright test e2e/app-shell.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, a11y, appNav } from './helpers';
import { createFixtureShop, fixtureFromShop, seedAllStates, signInAsOwner, type FixtureShop } from './task8-fixtures';
import { getDb } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shopsRepo from '@/lib/db/repos/shops';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const hideDevBadge = (page: Page) => page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

let shop: FixtureShop;
let orderId: string;

test.beforeAll(() => {
  shop = createFixtureShop('Shell Test Bakery');
  orderId = seedAllStates(shop).nutOrder.id;
});

test.beforeEach(async ({ context }) => {
  await signInAsOwner(context, shop, BASE);
});

test.describe('at 1440', () => {
  test.use({ viewport: DESKTOP });

  test('the sidebar has the four sections, Orders current, and no tabs', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await expect(appNav(page).getByRole('link')).toHaveText([/Orders/, 'Menu', 'Share', 'Settings']);
    await expect(appNav(page).getByRole('link', { name: /Orders/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('tab')).toHaveCount(0);
    await a11y(page);
  });

  test('sections switch in place: Back returns, with no RSC request and the page intact', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __marker: number }).__marker = 1;
    });
    const rsc: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('_rsc=')) rsc.push(r.url());
    });
    await appNav(page).getByRole('link', { name: 'Menu' }).click();
    await expect(page).toHaveURL(/\?tab=menu/);
    await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeFocused();
    await expect(page).toHaveTitle('Menu · Shell Test Bakery · Shelfie');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    await expect(appNav(page).getByRole('link', { name: /Orders/ })).toHaveAttribute('aria-current', 'page');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
    expect(rsc).toEqual([]);
  });

  test('deep links, and the active link on order detail and the counter card', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}?tab=settings`);
    await expect(appNav(page).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-section-panel]')).toHaveCount(1);
    await page.goto(`/shops/${shop.shop.id}/orders/${orderId}`);
    await expect(appNav(page).getByRole('link', { name: /Orders/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '24px');
    await page.goto(`/shops/${shop.shop.id}/card`);
    await expect(appNav(page).getByRole('link', { name: 'Share' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1, name: 'Counter card' })).toHaveCSS('font-size', '24px');
  });

  test('the shell replaces the site chrome, with one skip link to the content', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    for (const chrome of await page.locator('body > header, body > footer').all()) await expect(chrome).toBeHidden();
    await expect(page.locator('[data-site-chrome]').first()).toBeHidden();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toHaveCount(1);
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#app-content')).toBeFocused();
  });

  test('no sideways scroll at 1024 and 1440', async ({ page }) => {
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const query of ['', '?tab=menu', '?tab=share', '?tab=settings']) {
        await page.goto(`/shops/${shop.shop.id}${query}`);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, `${width} ${query}`).toBeLessThanOrEqual(0);
      }
    }
  });
});

test.describe('at 390', () => {
  test.use({ viewport: PHONE });

  test('the tab bar sits at the foot with 44 px links, the sidebar hidden, and content clear of it', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await hideDevBadge(page);
    const nav = appNav(page);
    const box = (await nav.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(PHONE.height);
    for (const link of await nav.getByRole('link').all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('shop-switcher')).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = page.locator('#app-content > p').last();
    await expect(last).toHaveText(/PayPal sandbox/);
    const lastBox = (await last.boundingBox())!;
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(box.y);
    await a11y(page);
  });

  test('the Share link switches sections from the tab bar', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await hideDevBadge(page);
    await appNav(page).getByRole('link', { name: 'Share' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Share' })).toBeVisible();
    await expect(appNav(page).getByRole('link', { name: 'Share' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('Orders and Menu at 390', () => {
  test.use({ viewport: PHONE });

  test('filters fit, group heads stay on one line, a paid order keeps its status and action on one line', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await hideDevBadge(page);
    const filters = page.getByRole('group', { name: 'Show orders' }).getByRole('button');
    await expect(filters).toHaveCount(4);
    for (const b of await filters.all()) {
      const box = (await b.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
    }

    const heading = page.getByRole('heading', { name: /To prepare/ }).first();
    const subtotal = page.locator('section').filter({ has: heading }).locator('p').first();
    const h = (await heading.boundingBox())!;
    const t = (await subtotal.boundingBox())!;
    expect(t.y).toBeLessThan(h.y + h.height);
    expect(t.y + t.height).toBeGreaterThan(h.y);

    const paid = page.locator('li[data-order]').filter({ has: page.getByRole('button', { name: 'Mark picked up' }) }).first();
    const status = (await paid.getByText('Paid', { exact: true }).boundingBox())!;
    const action = (await paid.getByRole('button', { name: 'Mark picked up' }).boundingBox())!;
    expect(status.y).toBeLessThan(action.y + action.height);
    expect(status.y + status.height).toBeGreaterThan(action.y);

    const first = (await page.locator('li[data-order]').first().boundingBox())!;
    expect(first.y).toBeLessThan(280);
    await a11y(page);
  });

  test('Photos in one go leads the Menu only while some items lack the seller\'s own photo', async ({ page, context }) => {
    const order = async () => {
      const list = (await page.locator('li[data-item]').first().boundingBox())!.y;
      const photos = (await page.getByRole('heading', { name: 'Photos in one go' }).boundingBox())!.y;
      return { list, photos };
    };
    await page.goto(`/shops/${shop.shop.id}?tab=menu`);
    let at = await order();
    expect(at.photos).toBeLessThan(at.list);

    const full = createFixtureShop('All Photos Bakery');
    for (const it of Object.values(full.items)) itemsRepo.update(getDb(), it.id, { photoUrl: '/demo/marigold-bakehouse/almond-croissant.webp' });
    for (const it of itemsRepo.listWithVariants(getDb(), full.shop.id)) if (!it.photoUrl) itemsRepo.update(getDb(), it.id, { photoUrl: '/demo/marigold-bakehouse/almond-croissant.webp' });
    await signInAsOwner(context, full, BASE);
    await page.goto(`/shops/${full.shop.id}?tab=menu`);
    at = await order();
    expect(at.list).toBeLessThan(at.photos);
  });

  test('order detail and the counter card have no sideways scroll, and Orders empty has its next steps', async ({ page, context }) => {
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of [`/shops/${shop.shop.id}/orders/${orderId}`, `/shops/${shop.shop.id}/card`]) {
        await page.goto(path);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, `${width} ${path}`).toBeLessThanOrEqual(0);
        if (width !== 1024) await a11y(page);
      }
      await page.goto(`/shops/${shop.shop.id}?tab=menu`);
      if (width !== 1024) await a11y(page);
    }
    const empty = createFixtureShop('Empty Orders Bakery');
    await signInAsOwner(context, empty, BASE);
    await page.setViewportSize(PHONE);
    await page.goto(`/shops/${empty.shop.id}`);
    await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Watch an AI order from you' })).toBeVisible();
    await page.getByRole('button', { name: 'Share your agent door' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Share' })).toBeVisible();
  });
});

test.describe('banners', () => {
  test.use({ viewport: DESKTOP });

  test('pausing shows the banner on all four sections; Resume sends live and clears it', async ({ page, context }) => {
    const paused = createFixtureShop('Pause Banner Bakery');
    await signInAsOwner(context, paused, BASE);
    await page.goto(`/shops/${paused.shop.id}`);
    await page.getByRole('switch', { name: 'Pause agent orders' }).click();
    const banner = page.getByRole('status').filter({ hasText: 'Agent orders paused.' });
    await expect(banner).toBeVisible();
    for (const name of ['Menu', 'Share', 'Settings', 'Orders']) {
      await appNav(page).getByRole('link', { name: new RegExp(`^${name}`) }).click();
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      await expect(banner).toBeVisible();
    }
    const sent = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().endsWith(`/api/shops/${paused.shop.id}`));
    await banner.getByRole('button', { name: 'Resume' }).click();
    expect((await sent).postDataJSON()).toMatchObject({ status: 'live' });
    await expect(banner).toBeHidden();
  });

  test('one banner at a time: a missing payee outranks paused', async ({ page, context }) => {
    const noPayee = createFixtureShop('No Payee Bakery', { payeeEmail: null });
    await signInAsOwner(context, noPayee, BASE);
    await page.goto(`/shops/${noPayee.shop.id}`);
    const banner = page.getByRole('status').filter({ hasText: 'Not taking orders: add your PayPal email.' });
    await expect(banner).toBeVisible();
    await page.getByRole('switch', { name: 'Pause agent orders' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Agent orders paused.' })).toHaveCount(0);
    await banner.getByRole('link', { name: 'Add email' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });
});

test.describe('Live, Share, Settings', () => {
  const noSideways = async (page: Page) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  };

  for (const [name, viewport] of [['1440', DESKTOP], ['390', PHONE]] as const) {
    test.describe(`at ${name}`, () => {
      test.use({ viewport });

      test('Live: in the shell, no slide leftovers, one primary button, a real shop preview', async ({ page, context }) => {
        const live = createFixtureShop('Live Screen Bakery');
        await signInAsOwner(context, live, BASE);
        await page.goto(`/shops/${live.shop.id}/setup`);
        await hideDevBadge(page);
        await expect(page.getByRole('heading', { level: 1, name: 'Your shop is live' })).toBeVisible();
        await expect(appNav(page).getByRole('link', { name: 'Orders' })).toBeVisible();
        const html = await page.content();
        expect(html).not.toContain('/claim/');
        expect(html).not.toContain('Open your dashboard');
        expect(html).not.toContain('See it work');
        await expect(page.locator('#app-content [data-variant="primary"]:visible')).toHaveCount(1);
        await expect(page.getByRole('link', { name: 'Watch an AI order from you' })).toHaveAttribute('data-variant', 'primary');
        const preview = page.getByTestId('live-preview');
        await expect(preview).toContainText('Live Screen Bakery');
        await expect(preview.getByRole('link', { name: 'Open your shop' })).toBeVisible();
        await noSideways(page);
        await a11y(page);
      });

      test('Share: exact rows, a QR in the Counter card region, a primary copy', async ({ page, context }) => {
        const pub = createFixtureShop('Share Screen Bakery');
        await signInAsOwner(context, pub, BASE);
        await page.goto(`/shops/${pub.shop.id}?tab=share`);
        await hideDevBadge(page);
        await expect(page.getByTestId('share-door-url')).toHaveText(new RegExp(`/s/${pub.shop.slug}/mcp$`));
        await expect(page.getByTestId('share-shop-url')).toHaveText(new RegExp(`/s/${pub.shop.slug}$`));
        await expect(page.getByRole('button', { name: 'Copy agent door link' })).toHaveAttribute('data-variant', 'primary');
        const region = page.getByRole('region', { name: 'Counter card' });
        await expect(region.getByRole('img')).toBeVisible();
        await expect(region.getByRole('link', { name: 'Print counter card' })).toBeVisible();
        await noSideways(page);
        await a11y(page);
      });

      test('Share on a draft: no address, no QR, the way to publish', async ({ page, context }) => {
        const made = shopsRepo.create(getDb(), { name: 'Draft Share Bakery', payeeEmail: 'owner@example.com', about: '', fulfillment: 'both', shippingFeeCents: 800, pickupNotes: '' });
        const draft = fixtureFromShop(made.shop, made.ownerToken);
        await signInAsOwner(context, draft, BASE);
        await page.goto(`/shops/${draft.shop.id}?tab=share`);
        await expect(page.getByText('Your shop gets its web address when you publish.')).toBeVisible();
        await expect(page.locator('#app-content').getByRole('link', { name: 'Finish setting up' })).toBeVisible();
        expect(await page.content()).not.toContain(draft.shop.slug);
        await expect(page.getByTestId('share-door-url')).toHaveCount(0);
        await a11y(page);
      });

      test('Settings: exact copy, no second Pause, sign-in row', async ({ page }) => {
        await page.goto(`/shops/${shop.shop.id}?tab=settings`);
        await hideDevBadge(page);
        await expect(page.getByText('Buyers pay straight into the PayPal account with this email.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Your logo' })).toBeVisible();
        await expect(page.locator('#app-content').getByRole('link', { name: 'Log in' })).toBeVisible();
        await expect(page.locator('#app-content').getByText('Pause agent orders')).toHaveCount(0);
        if (name === '1440') {
          const h = (await page.getByRole('heading', { name: 'Where you get paid' }).boundingBox())!;
          const form = (await page.getByTestId('payee-form').boundingBox())!;
          const content = (await page.locator('#app-content').evaluate((el) => { const s = getComputedStyle(el); return el.getBoundingClientRect().left + parseFloat(s.paddingLeft); }));
          expect(h.x + h.width).toBeLessThanOrEqual(form.x);
          expect(Math.abs(h.y - form.y)).toBeLessThanOrEqual(8);
          expect(form.x - content).toBeGreaterThanOrEqual(240);
        }
        await noSideways(page);
        await a11y(page);
      });

      test('a long shop name clamps in the shell and wraps on Live', async ({ page, context }) => {
        const longShop = createFixtureShop('The Extraordinarily Long Named Neighbourhood Sourdough and Pastry Cooperative of East Austin');
        await signInAsOwner(context, longShop, BASE);
        await page.goto(`/shops/${longShop.shop.id}/setup`);
        await hideDevBadge(page);
        if (name === '1440') {
          const label = page.getByTestId('shop-switcher').locator('[title]').first();
          const box = (await label.boundingBox())!;
          expect(box.height).toBeLessThanOrEqual(44); // two lines of 20
        } else {
          const bar = page.getByTestId('shop-switcher-bar');
          const box = (await bar.boundingBox())!;
          expect(box.height).toBeLessThanOrEqual(50);
        }
        await noSideways(page);
      });
    });
  }

  test('Live, Share and Settings have no sideways scroll at 1024', async ({ page, context }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    const s = createFixtureShop('Wide Check Bakery');
    await signInAsOwner(context, s, BASE);
    for (const url of [`/shops/${s.shop.id}/setup`, `/shops/${s.shop.id}?tab=share`, `/shops/${s.shop.id}?tab=settings`]) {
      await page.goto(url);
      await noSideways(page);
    }
  });

  test('a non-owner gets a real 404 with the public header', async ({ page }) => {
    const other = createFixtureShop('Someone Else Bakery');
    const res = await page.request.get(`/shops/${other.shop.id}`);
    expect(res.status()).toBe(404);
    await page.context().clearCookies();
    const nav = await page.goto(`/shops/${other.shop.id}`);
    expect(nav?.status()).toBe(404);
    await expect(page.locator('[data-site-chrome]').first()).toBeVisible();
    await expect(page.locator('[data-app-shell]')).toHaveCount(0);
  });
});
