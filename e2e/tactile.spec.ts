// Press, loading and response against the real app (production-pass WP1, acceptance 5 to 14).
// Fixture data goes straight to data/e2e.db (see e2e/task8-fixtures.ts); only the routes under test are held or mocked.
//
// Timing is measured inside the page (a requestAnimationFrame sampler and a MutationObserver): a Playwright round trip
// on a loaded machine is longer than the windows being checked.
//
// Run: E2E_PORT=3201 npx playwright test e2e/tactile.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test';
import { a11y, DESKTOP, PHONE, settle, smallTargets } from './helpers';
import { addFixtureOrder, createFixtureShop, signInAsOwner, type FixtureShop } from './task8-fixtures';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;

let shop: FixtureShop;

test.beforeAll(() => {
  shop = createFixtureShop('Tactile Test Bakery');
});

test.beforeEach(async ({ context }) => {
  await signInAsOwner(context, shop, BASE);
});

const dashboard = (query = '') => `/shops/${shop.shop.id}${query}`;
const toasts = (page: Page) => page.locator('[data-toast-region] > *');

const paidPickup = () =>
  addFixtureOrder(shop, {
    status: 'paid', fulfillment: 'pickup', minutesAgo: 2, buyerName: 'Kim', lines: [['Morning bun', 1]],
    payer: { name: 'Kim Tran', email: 'kim@example.com' },
  });

const rowSelector = (number: string) => `[data-order="${number}"]`;
/** The row's one button. Its accessible name changes with its status, so it isn't found by name. */
const markButton = (page: Page, number: string) => page.locator(`${rowSelector(number)} button`);

/** Hydrated (Tactile's listener is on) and every entrance finished, so a press lands where the box says. */
async function ready(page: Page, target: Locator) {
  await target.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const bar = document.querySelector('[data-slot="route-progress"]');
    return !!bar && Object.keys(bar).some((key) => key.startsWith('__reactFiber'));
  });
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  await expect.poll(() => target.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function centre(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('the target has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Keeps POST .../fulfil unanswered until release(), so the button stays in its loading state. */
async function holdFulfil(page: Page, orderId: string) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/shops/${shop.shop.id}/orders/${orderId}/fulfil`, async (route) => {
    await gate;
    await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } });
  });
  return release;
}

type Reading = Record<string, string | number | boolean | null> & { t: number };
interface Sampling {
  on: boolean;
  readings: Reading[];
  marks: Record<string, number>;
}

/**
 * Reads every probe on each animation frame, and notes when the first pointerdown, pointerup and click happen.
 * A probe is [selector, read]: a CSS property, `@attribute`, `width`, `visible` or `count`.
 */
async function startSampling(page: Page, probes: Record<string, [selector: string, read: string]>) {
  await page.evaluate((probes) => {
    const state: Sampling = { on: true, readings: [], marks: {} };
    (window as unknown as { __sampling: Sampling }).__sampling = state;
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      window.addEventListener(type, () => (state.marks[type] ??= performance.now()), true);
    }
    const tick = () => {
      if (!state.on) return;
      const reading: Reading = { t: performance.now() };
      for (const [name, [selector, read]] of Object.entries(probes)) {
        const el = document.querySelector<HTMLElement>(selector);
        if (read === 'count') reading[name] = document.querySelectorAll(selector).length;
        else if (!el) reading[name] = null;
        else if (read === 'width') reading[name] = el.getBoundingClientRect().width;
        else if (read === 'visible') {
          const style = getComputedStyle(el);
          reading[name] = style.visibility === 'visible' && Number(style.opacity) > 0.5 && el.getClientRects().length > 0;
        } else if (read.startsWith('@')) reading[name] = el.getAttribute(read.slice(1));
        else reading[name] = getComputedStyle(el).getPropertyValue(read);
      }
      state.readings.push(reading);
      requestAnimationFrame(tick);
    };
    tick();
  }, probes);
}

function stopSampling(page: Page) {
  return page.evaluate(() => {
    const state = (window as unknown as { __sampling: Sampling }).__sampling;
    state.on = false;
    return { readings: state.readings, marks: state.marks };
  });
}

/** Every time an element gains or loses data-pressed. Returns a reader. */
async function watchPressed(page: Page) {
  await page.evaluate(() => {
    const log: { at: number; on: boolean }[] = [];
    (window as unknown as { __pressed: typeof log }).__pressed = log;
    new MutationObserver((list) => {
      for (const m of list) log.push({ at: performance.now(), on: (m.target as Element).hasAttribute('data-pressed') });
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-pressed'] });
  });
  return () => page.evaluate(() => (window as unknown as { __pressed: { at: number; on: boolean }[] }).__pressed);
}

/** A computed `scale` as a number: `none` is 1. */
const scaleOf = (value: unknown) => (value === 'none' ? 1 : Number(value));

test.describe('at 1440 with a mouse', () => {
  test.use({ viewport: DESKTOP });

  test('pressing Mark picked up reaches .96 fast and comes back, and its row does not move (5)', async ({ page }) => {
    const order = paidPickup();
    const release = await holdFulfil(page, order.id);
    await page.goto(dashboard());
    const button = markButton(page, order.number);
    await ready(page, button);
    await button.evaluate((el) => el.setAttribute('data-probe', 'mark'));
    const { x, y } = await centre(button);
    await page.mouse.move(x, y);

    await startSampling(page, { button: ['[data-probe="mark"]', 'scale'], row: [rowSelector(order.number), 'scale'] });
    await page.mouse.down();
    await page.waitForTimeout(220);
    await page.mouse.up();
    await page.waitForTimeout(500);
    const { readings, marks } = await stopSampling(page);
    release();

    const inWindow = readings.filter((r) => r.t >= marks.pointerdown && r.t <= marks.pointerdown + 150);
    expect(inWindow.some((r) => Math.abs(scaleOf(r.button) - 0.96) < 0.001), JSON.stringify(inWindow.slice(0, 12))).toBe(true);

    const after = readings.filter((r) => r.t >= marks.pointerup);
    const back = after.findIndex((r) => scaleOf(r.button) === 1);
    expect(back).toBeGreaterThanOrEqual(0);
    expect(after[back].t - marks.pointerup).toBeLessThanOrEqual(350);
    expect(after.slice(back).every((r) => scaleOf(r.button) === 1)).toBe(true);

    expect(readings.every((r) => r.row === 'none')).toBe(true);
  });

  test('a press on the Sold out switch flexes its thumb and leaves the row alone; so does a press on its label (7)', async ({ page }) => {
    await page.goto(dashboard('?tab=menu'));
    const sw = page.getByRole('switch', { name: 'Almond croissant: Sold out today' });
    await ready(page, sw);
    const row = page.locator('[data-item="Almond croissant"]');
    const thumb = sw.locator('[data-thumb]');
    const thumbScale = () => thumb.evaluate((el) => getComputedStyle(el).scale);
    const rowScale = () => row.evaluate((el) => getComputedStyle(el).scale);

    for (const target of [sw, row.locator('label[for]').filter({ hasText: 'Sold out' })]) {
      const { x, y } = await centre(target);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await expect.poll(thumbScale).toBe('1.18 1');
      expect(await rowScale()).toBe('none');
      // Leaving before the release means no click, so the switch doesn't change between the two presses.
      await page.mouse.move(2, 2);
      await page.mouse.up();
      await expect.poll(thumbScale).toBe('none');
      expect(await rowScale()).toBe('none');
    }
    await expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  test('Space on a focused Button presses it, and focus stays through loading (8)', async ({ page }) => {
    const order = paidPickup();
    const release = await holdFulfil(page, order.id);
    await page.goto(dashboard());
    const button = markButton(page, order.number);
    await ready(page, button);
    await button.focus();

    await page.keyboard.down('Space');
    await expect(button).toHaveAttribute('data-pressed');
    await page.keyboard.up('Space');

    await expect(button).toHaveAttribute('data-status', 'loading');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    release();
  });

  test('with a held response the width holds across idle, loading and success, and the spinner waits (9)', async ({ page }) => {
    const order = paidPickup();
    await page.route(`**/api/shops/${shop.shop.id}/orders/${order.id}/fulfil`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    await page.goto(dashboard());
    const button = markButton(page, order.number);
    await ready(page, button);
    await button.evaluate((el) => el.setAttribute('data-probe', 'mark'));

    await startSampling(page, {
      width: ['[data-probe="mark"]', 'width'],
      status: ['[data-probe="mark"]', '@data-status'],
      spinner: ['[data-probe="mark"] [data-layer="loading"]', 'visible'],
    });
    await button.evaluate((el: HTMLElement) => el.click());
    await expect(button).toHaveAttribute('data-status', 'success', { timeout: 20_000 });
    await page.waitForTimeout(150);
    const { readings, marks } = await stopSampling(page);

    // The row moves to Done 500 ms into success, so the button can be gone by the time the sampling stops.
    const present = readings.filter((r) => r.status !== null);
    expect(new Set(present.map((r) => r.status))).toEqual(new Set(['idle', 'loading', 'success']));
    const widths = present.map((r) => r.width as number);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.5);

    const early = readings.filter((r) => r.t >= marks.click && r.t < marks.click + 100);
    expect(early.length).toBeGreaterThan(0);
    expect(early.some((r) => r.spinner === true)).toBe(false);
    const late = readings.filter((r) => r.t >= marks.click + 400 && r.t <= marks.click + 900);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((r) => r.spinner === true)).toBe(true);
  });

  test('Copy shows Copied and a tick for about 2 s, with no toast (10)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(dashboard('?tab=share'));
    const copy = page.getByRole('button', { name: 'Copy agent door link' });
    await ready(page, copy);
    await copy.evaluate((el) => el.setAttribute('data-probe', 'copy'));

    await startSampling(page, {
      label: ['[data-probe="copy"]', '@aria-label'],
      tick: ['[data-probe="copy"] .animate-pop', 'visible'],
      toasts: ['[data-toast-region] > *', 'count'],
    });
    await copy.click();
    await expect(page.getByRole('button', { name: /agent door link copied/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /agent door link copied/i }).getByText('Copied')).toBeVisible();
    await expect(copy).toBeVisible({ timeout: 4000 });
    await page.waitForTimeout(100);
    const { readings } = await stopSampling(page);

    const copied = readings.filter((r) => typeof r.label === 'string' && /copied/i.test(r.label));
    expect(copied.length).toBeGreaterThan(0);
    // The tick pops in over 220 ms; after that it is on screen for the rest of the hold.
    expect(copied.filter((r) => r.t > copied[0].t + 300).every((r) => r.tick === true)).toBe(true);
    const held = copied[copied.length - 1].t - copied[0].t;
    expect(held).toBeGreaterThanOrEqual(1800);
    expect(held).toBeLessThanOrEqual(2300);
    expect(readings.every((r) => r.toasts === 0)).toBe(true);
  });

  test('a refused clipboard shows the failure toast (10)', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
    });
    await page.goto(dashboard('?tab=share'));
    const copy = page.getByRole('button', { name: 'Copy agent door link' });
    await ready(page, copy);
    await copy.click();
    await expect(toasts(page).first()).toContainText('Couldn’t copy');
    await expect(toasts(page).first()).toContainText('Select the text and copy it yourself.');
  });

  test('a failed pause rolls back with the inline alert and data-nope; a success adds no toast (11)', async ({ page }) => {
    await page.route(`**/api/shops/${shop.shop.id}`, (route) =>
      route.fulfill({ json: { shop: { ...shop.shop, status: 'paused' } } }),
    );
    await page.goto(dashboard());
    const toggle = page.getByRole('switch', { name: 'Pause agent orders' });
    await ready(page, toggle);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(toggle).not.toHaveAttribute('aria-busy');
    expect(await toasts(page).count()).toBe(0);

    await page.unroute(`**/api/shops/${shop.shop.id}`);
    await page.route(`**/api/shops/${shop.shop.id}`, (route) =>
      route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: 'Couldn’t save. Try again.' } } }),
    );
    await toggle.click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Couldn’t save');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(toggle).toHaveAttribute('data-nope', 'true');
  });

  test('a slow route shows the bar by 300 ms and marks the pressed row; both clear on arrival (12)', async ({ page }) => {
    const order = paidPickup();
    const path = `/shops/${shop.shop.id}/orders/${order.id}`;
    let delayed = 0;
    await page.route(
      (url) => url.pathname === path,
      async (route) => {
        delayed += 1;
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await route.continue();
      },
    );
    await page.goto(dashboard());
    const row = page.locator(rowSelector(order.number));
    const link = row.locator('[data-stretched-link]');
    await ready(page, link);

    await startSampling(page, {
      bar: ['[data-slot="route-progress"]', 'opacity'],
      navigating: [rowSelector(order.number), '@data-navigating'],
    });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`), { timeout: 30_000 });
    const { readings, marks } = await stopSampling(page);
    expect(delayed).toBeGreaterThan(0); // the navigation really was the slow one

    const shown = readings.find((r) => r.t >= marks.click && Number(r.bar) > 0.5);
    expect(shown, JSON.stringify(readings.slice(0, 40))).toBeDefined();
    expect(shown!.t - marks.click).toBeLessThanOrEqual(300);
    const early = readings.filter((r) => r.t >= marks.click && r.t <= marks.click + 300);
    expect(early.some((r) => r.navigating !== null)).toBe(true);

    await expect(page.locator('[data-navigating]')).toHaveCount(0);
    await expect
      .poll(() => page.locator('[data-slot="route-progress"]').evaluate((el) => getComputedStyle(el).opacity))
      .toBe('0');
  });

  test('Enter on a focused file picker presses its label, as Space does', async ({ page }) => {
    await page.goto(dashboard('?tab=menu'));
    const input = page.locator('input[type=file][aria-label="Snap your counter"]');
    const label = page.locator('label:has(input[type=file][aria-label="Snap your counter"])');
    await input.waitFor({ state: 'attached' });
    await ready(page, label);
    const pressed = await watchPressed(page);
    await input.focus();

    await page.keyboard.down('Enter');
    await expect(label).toHaveAttribute('data-pressed');
    await page.keyboard.up('Enter');

    await expect(label).not.toHaveAttribute('data-pressed');
    expect((await pressed()).map((entry) => entry.on)).toEqual([true, false]);
  });

  test('the pageshow at the end of the first load leaves a running navigation and a live press alone', async ({ page }) => {
    const order = paidPickup();
    const path = `/shops/${shop.shop.id}/orders/${order.id}`;
    let open: () => void = () => {};
    const held = new Promise<void>((resolve) => (open = resolve));
    await page.route(
      (url) => url.pathname === path,
      async (route) => {
        await held;
        await route.continue();
      },
    );
    await page.goto(dashboard());
    const row = page.locator(rowSelector(order.number));
    const link = row.locator('[data-stretched-link]');
    const bar = page.locator('[data-slot="route-progress"]');
    await ready(page, link);
    const pageshow = (persisted: boolean) =>
      page.evaluate((value) => void window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: value })), persisted);

    await link.click();
    await expect(row).toHaveAttribute('data-navigating');
    await expect(bar).not.toHaveAttribute('data-phase', 'idle');
    await pageshow(false);
    await expect(row).toHaveAttribute('data-navigating');
    await expect(bar).not.toHaveAttribute('data-phase', 'finish');

    // A return from the back/forward cache is the one pageshow that means the page was left: it ends the bar and the mark.
    await pageshow(true);
    await expect(row).not.toHaveAttribute('data-navigating');
    await expect(bar).toHaveAttribute('data-phase', /finish|idle/);
    open();

    await page.goto(dashboard());
    const button = markButton(page, order.number);
    await ready(page, button);
    await button.focus();
    await page.keyboard.down('Space');
    await expect(button).toHaveAttribute('data-pressed');
    await pageshow(false);
    await expect(button).toHaveAttribute('data-pressed');
    await pageshow(true);
    await expect(button).not.toHaveAttribute('data-pressed');
    await page.keyboard.up('Space');
  });

  test('with reduced motion a pressed Button keeps its scale and still changes colour (13)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const order = paidPickup();
    const release = await holdFulfil(page, order.id);
    await page.goto(dashboard());
    const button = markButton(page, order.number);
    await ready(page, button);
    await button.evaluate((el) => el.setAttribute('data-probe', 'mark'));
    const { x, y } = await centre(button);
    await page.mouse.move(x, y);
    await page.waitForTimeout(300); // the hover fill has finished arriving
    const hover = await button.evaluate((el) => getComputedStyle(el).backgroundColor);

    await startSampling(page, { scale: ['[data-probe="mark"]', 'scale'], background: ['[data-probe="mark"]', 'background-color'] });
    await page.mouse.down();
    await expect.poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(hover);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const { readings } = await stopSampling(page);
    release();

    expect(readings.every((r) => scaleOf(r.scale) === 1), JSON.stringify(readings.slice(0, 12))).toBe(true);
    expect(readings.some((r) => r.background !== hover)).toBe(true);
  });
});

test.describe('at 390 with touch', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('a tap holds data-pressed for at least 100 ms (6)', async ({ page }) => {
    const order = paidPickup();
    const release = await holdFulfil(page, order.id);
    await page.goto(dashboard());
    const button = markButton(page, order.number);
    await ready(page, button);
    const { x, y } = await centre(button);

    const pressed = await watchPressed(page);
    await page.touchscreen.tap(x, y);
    await expect(button).toHaveAttribute('data-status', 'loading');
    await expect.poll(async () => (await pressed()).length).toBeGreaterThanOrEqual(2);
    release();

    const log = await pressed();
    const on = log.find((e) => e.on);
    const off = log.find((e) => !e.on);
    expect(on).toBeDefined();
    expect(off).toBeDefined();
    expect(off!.at - on!.at).toBeGreaterThanOrEqual(100);
  });

  test('a swipe that scrolls over an order row presses nothing (6)', async ({ page, context }) => {
    for (let i = 0; i < 8; i += 1) paidPickup();
    const order = paidPickup();
    await page.goto(dashboard());
    const row = page.locator(rowSelector(order.number));
    await ready(page, row);
    await page.evaluate(() => window.scrollTo(0, 0));
    const { x, y } = await centre(row);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

    const pressed = await watchPressed(page);
    const before = await page.evaluate(() => window.scrollY);
    // Real touch events through the browser's input pipeline, so it scrolls and cancels the pointer as a finger would.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let dy = 16; dy <= 260; dy += 16) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);

    const info = await page.evaluate(() => ({ y: window.scrollY, height: document.documentElement.scrollHeight, inner: window.innerHeight }));
    expect(info.y, JSON.stringify(info)).toBeGreaterThan(before);
    expect(await pressed()).toEqual([]);
  });
});

// Dashboard and shop (the fixture shop's public page), with the press system on them.
for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`accessibility at ${label} px`, () => {
    test.use({ viewport });

    test('axe has nothing to report on the dashboard and the shop (14)', async ({ page }) => {
      paidPickup();
      await page.goto(dashboard());
      await settle(page);
      await a11y(page);
      if (label === '390') expect(await smallTargets(page)).toEqual([]);

      await page.goto(`/s/${shop.shop.slug}`);
      await settle(page);
      await a11y(page);
      if (label === '390') expect(await smallTargets(page)).toEqual([]);
    });
  });
}
