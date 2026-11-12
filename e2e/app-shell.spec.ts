// The seller app shell: sidebar and tab bar, section switching without a server round trip, the one banner
// slot, skip link and landmarks. Run: E2E_PORT=3221 npx playwright test e2e/app-shell.spec.ts
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, a11y, appNav } from './helpers';
import { addFixtureOrder, createFixtureShop, fixtureFromShop, seedAllStates, signInAsOwner, type FixtureShop } from './task8-fixtures';
import { getDb } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shopsRepo from '@/lib/db/repos/shops';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const hideDevBadge = (page: Page) => page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

const SAMPLE_LOGO = path.resolve(__dirname, '..', 'public', 'samples', 'coffee-and-plant.jpg');
const shellBanner = (page: Page) => page.locator('[data-shell-banner]');
type Marked = { __marker?: number };

let shop: FixtureShop;
let orderId: string;

/** Every screen the shell wraps, for the checks that apply to all of them. */
const shellScreens = () =>
  [
    ['Orders', `/shops/${shop.shop.id}`],
    ['Menu', `/shops/${shop.shop.id}?tab=menu`],
    ['Share', `/shops/${shop.shop.id}?tab=share`],
    ['Settings', `/shops/${shop.shop.id}?tab=settings`],
    ['Order detail', `/shops/${shop.shop.id}/orders/${orderId}`],
    ['Counter card', `/shops/${shop.shop.id}/card`],
    ['Live', `/shops/${shop.shop.id}/setup`],
  ] as const;

/** Acceptance 18: a grey panel holding only a heading and buttons is the "slide" look this package removes. */
async function headingAndButtonsOnGrey(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'bg-surface-sunken';
    document.body.append(probe);
    const sunken = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return Array.from(document.querySelectorAll<HTMLElement>('#app-content *'))
      .filter((el) => getComputedStyle(el).backgroundColor === sunken)
      .filter((el) => el.querySelector('h1, h2, h3, h4') && el.querySelector('a, button'))
      .filter((el) => {
        const copy = el.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('h1, h2, h3, h4, a, button').forEach((n) => n.remove());
        return copy.textContent!.trim() === '';
      })
      .map((el) => el.className);
  });
}

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
    const chrome = page.locator('[data-site-chrome]');
    expect(await chrome.count()).toBeGreaterThan(0);
    for (const el of await chrome.all()) await expect(el).toBeHidden();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toHaveCount(1);
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#app-content')).toBeFocused();
  });

  test('?tab=menu deep-links, and quick switching never shows two panels (or none)', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}?tab=menu`);
    await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible();
    await expect(appNav(page).getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-section-panel]')).toHaveCount(1);
    await expect(page.locator('#section-panel-menu')).toBeVisible();

    await page.evaluate(async () => {
      const w = window as unknown as { __panels: number[]; __sampling: boolean };
      w.__panels = [];
      w.__sampling = true;
      const sample = () => {
        w.__panels.push(document.querySelectorAll('[data-section-panel]').length);
        if (w.__sampling) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      const nav = document.querySelector('nav[aria-label="Shop sections"]')!;
      const link = (name: string) => Array.from(nav.querySelectorAll('a')).find((a) => a.textContent!.startsWith(name))!;
      for (const name of ['Share', 'Settings', 'Orders', 'Menu', 'Share', 'Orders', 'Settings', 'Menu', 'Settings']) {
        link(name).click();
        await new Promise((r) => setTimeout(r, 40));
      }
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await page.waitForTimeout(300);
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __panels: number[]; __sampling: boolean };
      w.__sampling = false;
      return w.__panels;
    });
    expect(frames.length).toBeGreaterThan(10);
    expect([...new Set(frames)]).toEqual([1]);
    await expect(page.locator('#section-panel-settings')).toBeVisible();
  });

  test('a section link clicked before the router has taken over history still opens the section', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    // Next patches pushState in an effect; hydrating the clicked link first can run its handler before that effect.
    await page.waitForFunction(() => !String(window.history.pushState).includes('[native code]'));
    await page.evaluate(() => {
      delete (window.history as unknown as { pushState?: unknown }).pushState;
    });
    await appNav(page).getByRole('link', { name: 'Share' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Share' })).toBeVisible();
    await expect(page).toHaveURL(/\?tab=share/);
  });

  test('the first order row starts under 260 px', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    const first = (await page.locator('li[data-order]').first().boundingBox())!;
    expect(first.y).toBeLessThan(260);
  });

  test('a new logo shows in the sidebar switcher without a reload', async ({ page, context }) => {
    const s = createFixtureShop('Logo Switcher Bakery');
    await signInAsOwner(context, s, BASE);
    await page.goto(`/shops/${s.shop.id}?tab=settings`);
    await expect(page.getByTestId('shop-switcher').locator('img[data-avatar="logo"]')).toHaveCount(0);
    await page.evaluate(() => {
      (window as unknown as Marked).__marker = 1;
    });
    await page.getByLabel('Add a logo').setInputFiles(SAMPLE_LOGO);
    await expect(page.getByTestId('shop-switcher').locator('img[data-avatar="logo"]')).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => (window as unknown as Marked).__marker)).toBe(1);
  });

  test('the sidebar rows share one text edge, and copy labels sit level with the button beside them', async ({ page }) => {
    await page.goto(`/shops/${shop.shop.id}`);
    const textX = (el: Element) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent!.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
      const node = walker.nextNode()!;
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().left;
    };
    const nav = await appNav(page).getByRole('link', { name: 'Settings' }).evaluate(textX);
    const view = await page.getByRole('link', { name: 'View your shop' }).evaluate(textX);
    expect(Math.abs(nav - view)).toBeLessThanOrEqual(0.5);

    await page.goto(`/shops/${shop.shop.id}?tab=share`);
    const centre = (el: Element) => {
      const b = el.getBoundingClientRect();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent!.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
      const range = document.createRange();
      range.selectNodeContents(walker.nextNode()!);
      const r = range.getBoundingClientRect();
      return r.top + r.height / 2 - (b.top + b.height / 2);
    };
    const copy = await page.getByRole('button', { name: 'Copy agent door link' }).evaluate(centre);
    const open = await page.getByRole('link', { name: 'Open', exact: true }).evaluate(centre);
    expect(Math.abs(copy - open)).toBeLessThanOrEqual(1);
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

  test('a toast sits above the tab bar', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
    });
    await page.goto(`/shops/${shop.shop.id}?tab=share`);
    await hideDevBadge(page);
    await page.getByRole('button', { name: 'Copy agent door link' }).click();
    const toast = page.locator('[data-toast-region] > *').first();
    await expect(toast).toContainText('Couldn’t copy');
    const barTop = (await appNav(page).boundingBox())!.y;
    await expect(async () => {
      const box = (await toast.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(barTop);
    }).toPass({ timeout: 3000 });
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
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height);
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

  test('a busy shop\'s filters stay inside their pill and the buyer and agent are both readable', async ({ page, context }) => {
    const busy = createFixtureShop('Busy Filters Bakery');
    for (let i = 0; i < 15; i += 1) seedAllStates(busy);
    await signInAsOwner(context, busy, BASE);
    await page.goto(`/shops/${busy.shop.id}`);
    const group = page.getByRole('group', { name: 'Show orders' });
    await expect(group.getByRole('button').first()).toBeVisible();
    const track = await group.locator('> div').boundingBox();
    for (const b of await group.getByRole('button').all()) {
      const box = await b.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(track!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(track!.x + track!.width + 0.5);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }
    await expect(group.getByRole('button', { name: /All.*135/ })).toHaveCount(1);
    const clipped = await page.locator('li[data-order] p span.min-w-0.truncate').evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth).map((el) => el.textContent),
    );
    expect(clipped).toEqual([]);
  });

  test('the counter card keeps its whole content inside the card, however long the name', async ({ page, context }) => {
    for (const name of ["Rosa's Weekend Bakehouse", 'The Corner Bakery and Coffee Shop', 'The Very Long Named Neighbourhood Bakery, Coffee Roastery and Weekend Sandwich Counter']) {
      const f = createFixtureShop(name);
      await signInAsOwner(context, f, BASE);
      await page.goto(`/shops/${f.shop.id}/card`);
      const card = page.locator('[data-print-alone]');
      await expect(card).toBeVisible();
      const m = await card.evaluate((el) => {
        const qr = el.querySelector('[data-testid="card-qr"] svg')!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const door = el.querySelector('[data-testid="card-door-url"]')!.getBoundingClientRect();
        return { over: el.scrollHeight - el.clientHeight, qrH: qr.height, doorBottom: door.bottom, cardBottom: box.bottom };
      });
      expect(m.over, name).toBeLessThanOrEqual(1);
      expect(m.doorBottom, name).toBeLessThanOrEqual(m.cardBottom);
      expect(m.qrH, name).toBeGreaterThan(90);
    }
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
    await expect(shellBanner(page)).toHaveCount(1);
    await a11y(page);
    for (const name of ['Menu', 'Share', 'Settings', 'Orders']) {
      await appNav(page).getByRole('link', { name: new RegExp(`^${name}`) }).click();
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      await expect(banner).toBeVisible();
      await expect(shellBanner(page)).toHaveCount(1);
    }
    const sent = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().endsWith(`/api/shops/${paused.shop.id}`));
    await banner.getByRole('button', { name: 'Resume' }).click();
    expect((await sent).postDataJSON()).toMatchObject({ status: 'live' });
    await expect(banner).toBeHidden();
  });

  test('Resume keeps focus and says it worked', async ({ page, context }) => {
    const f = createFixtureShop('Resume Focus Bakery');
    await signInAsOwner(context, f, BASE);
    await page.goto(`/shops/${f.shop.id}`);
    await page.getByRole('switch', { name: 'Pause agent orders' }).click();
    await expect(shellBanner(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Resume' }).focus();
    await page.keyboard.press('Enter');
    await expect(shellBanner(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'Agent orders are on again.' })).toHaveCount(1);
  });

  test('Back after pausing keeps the banner and the switch: the store outlives a cached page', async ({ page, context }) => {
    const f = createFixtureShop('Back Paused Bakery');
    await signInAsOwner(context, f, BASE);
    await page.goto(`/shops/${f.shop.id}`);
    const pause = page.getByRole('switch', { name: 'Pause agent orders' });
    const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/api/shops/${f.shop.id}`));
    await pause.click();
    await saved;
    await expect(shellBanner(page)).toHaveCount(1);
    await page.getByRole('link', { name: 'View your shop' }).click();
    await page.waitForURL(`**/s/${f.shop.slug}`);
    await page.goBack();
    await expect(page.locator('[data-app-shell]')).toBeVisible();
    await expect(shellBanner(page)).toHaveCount(1);
    await expect(pause).toHaveAttribute('aria-checked', 'true');
    expect(shopsRepo.byId(getDb(), f.shop.id)!.status).toBe('paused');
  });

  test('Back restores no missing-payee banner or lost logo after they were saved', async ({ page, context }) => {
    const f = createFixtureShop('Back Payee Bakery', { payeeEmail: null });
    seedAllStates(f);
    await signInAsOwner(context, f, BASE);
    await page.goto(`/shops/${f.shop.id}?tab=settings`);
    await expect(page.getByText('Not taking orders: add your PayPal email.')).toBeVisible();
    await page.getByRole('textbox', { name: /PayPal email/i }).fill('seller@example.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(shellBanner(page)).toHaveCount(0);
    await appNav(page).getByRole('link', { name: /^Orders/ }).click();
    await page.locator('li[data-order] a').first().click();
    await page.waitForURL(`**/shops/${f.shop.id}/orders/*`);
    await page.goBack();
    await expect(page.locator('[data-section-panel]')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(shellBanner(page)).toHaveCount(0);
    expect(shopsRepo.byId(getDb(), f.shop.id)!.payeeEmail).toBe('seller@example.com');
  });

  test('a shop whose orders cannot be read still shows the shell and the error state', async ({ page, context }) => {
    const f = createFixtureShop('Broken Orders Bakery');
    const order = addFixtureOrder(f, { status: 'paid', fulfillment: 'pickup', minutesAgo: 1, buyerName: 'Sam', lines: [['Morning bun', 1]] });
    getDb().prepare("UPDATE orders SET brief_json = '{' WHERE id = ?").run(order.id);
    await signInAsOwner(context, f, BASE);
    await page.goto(`/shops/${f.shop.id}`);
    await hideDevBadge(page);
    await expect(page.locator('[data-app-shell]')).toBeVisible();
    await expect(page.getByText('Your shop and orders are safe.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('a slow pause answer arriving after Resume does not bring the banner back', async ({ page, context }) => {
    const s = createFixtureShop('Slow Pause Bakery');
    await signInAsOwner(context, s, BASE);
    await page.goto(`/shops/${s.shop.id}`);
    let held = false;
    let released = () => {};
    const answered = new Promise<void>((resolve) => { released = resolve; });
    await page.route(`**/api/shops/${s.shop.id}`, async (route) => {
      if (route.request().method() === 'PATCH' && !held) {
        held = true;
        const res = await route.fetch();
        await new Promise((r) => setTimeout(r, 1500));
        await route.fulfill({ response: res });
        released();
      } else {
        await route.continue();
      }
    });
    await page.getByRole('switch', { name: 'Pause agent orders' }).click();
    const banner = page.getByRole('status').filter({ hasText: 'Agent orders paused.' });
    await banner.getByRole('button', { name: 'Resume' }).click();
    await answered;
    await page.waitForTimeout(400); // the late answer has had its chance to bring the banner back
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
    await expect(shellBanner(page)).toHaveCount(1);
    await banner.getByRole('link', { name: 'Add email' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });
});

test.describe('banner priority', () => {
  test.use({ viewport: DESKTOP });

  test('PayPal unreachable outranks a missing payee and a paused shop: one banner only', async ({ page, context }) => {
    const s = createFixtureShop('All Conditions Bakery', { payeeEmail: null });
    shopsRepo.update(getDb(), s.shop.id, { status: 'paused' });
    const open = addFixtureOrder(s, { status: 'awaiting_approval', fulfillment: 'pickup', lines: [['Almond croissant', 1]], minutesAgo: 1 });
    eventsRepo.add(getDb(), open.id, 'capture_error', 'poller', { status: 503 });
    await signInAsOwner(context, s, BASE);
    await page.goto(`/shops/${s.shop.id}`);
    await expect(shellBanner(page)).toHaveCount(1);
    await expect(shellBanner(page)).toContainText('We can’t reach PayPal right now.');
    await expect(page.getByText('Not taking orders: add your PayPal email.')).toHaveCount(0);
    await expect(page.getByText('Agent orders paused.')).toHaveCount(0);
  });
});

test.describe('Live, Share, Settings', () => {
  const noSideways = async (page: Page) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('h1')).toHaveCSS('font-size', '24px');
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
        expect(await headingAndButtonsOnGrey(page)).toEqual([]);
        await noSideways(page);
        await a11y(page);
        await preview.getByRole('link', { name: 'Open your shop' }).click();
        await expect(page).toHaveURL(new RegExp(`/s/${live.shop.slug}$`));
        await expect(page.getByRole('heading', { level: 1, name: 'Live Screen Bakery' })).toBeVisible();
      });

      test('Share: exact rows, a QR in the Counter card region, a primary copy', async ({ page, context }) => {
        const pub = createFixtureShop('Share Screen Bakery');
        await signInAsOwner(context, pub, BASE);
        await page.goto(`/shops/${pub.shop.id}?tab=share`);
        await hideDevBadge(page);
        await expect(page.getByTestId('share-door-url')).toHaveText(`${BASE}/s/${pub.shop.slug}/mcp`);
        await expect(page.getByTestId('share-shop-url')).toHaveText(`${BASE}/s/${pub.shop.slug}`);
        await expect(page.getByRole('button', { name: 'Copy agent door link' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Copy agent door link' })).toHaveAttribute('data-variant', 'primary');
        const region = page.getByRole('region', { name: 'Counter card' });
        await expect(region.getByRole('img')).toBeVisible();
        await expect(region.getByRole('link', { name: 'Print counter card' })).toBeVisible();
        expect(await headingAndButtonsOnGrey(page)).toEqual([]);
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

for (const [label, viewport] of [['390', PHONE], ['1024', { width: 1024, height: 900 }], ['1440', DESKTOP]] as const) {
  test.describe(`every shell screen at ${label}`, () => {
    test.use({ viewport });

    test('no sideways scroll, a 24 px H1 and no axe violations', async ({ page }) => {
      test.setTimeout(240_000);
      for (const [name, url] of shellScreens()) {
        await page.goto(url);
        await hideDevBadge(page);
        await expect(page.locator('h1'), name).toHaveCount(1);
        await expect(page.locator('h1'), name).toHaveCSS('font-size', '24px');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), name).toBeLessThanOrEqual(0);
        if (label !== '1024') await a11y(page);
      }
    });
  });
}

for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`at ${label}, print and first-run states`, () => {
    test.use({ viewport });

    test('printing the counter card hides all the shell chrome', async ({ page }) => {
      await page.goto(`/shops/${shop.shop.id}/card`);
      await page.emulateMedia({ media: 'print' });
      await expect(
        page.locator(
          'nav[aria-label="Shop sections"]:visible, [data-testid="shop-switcher"]:visible, [data-testid="shop-switcher-bar"]:visible, a[href="#app-content"]:visible, [data-site-chrome]:visible',
        ),
      ).toHaveCount(0);
      await expect(page.getByText('Payments run in the PayPal sandbox').locator('visible=true')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Back to Share' })).toBeHidden();
      await expect(page.getByRole('img').first()).toBeVisible();
    });

    test('empty Orders names its next steps, and the paused banner is accessible', async ({ page, context }) => {
      const empty = createFixtureShop(`Empty Bakery ${label}`);
      await signInAsOwner(context, empty, BASE);
      await page.goto(`/shops/${empty.shop.id}`);
      await hideDevBadge(page);
      await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Watch an AI order from you' })).toBeVisible();
      await a11y(page);
      await page.getByRole('switch', { name: 'Pause agent orders' }).click();
      await expect(shellBanner(page)).toContainText('Agent orders paused.');
      await a11y(page);
    });
  });
}
