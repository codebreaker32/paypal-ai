// Click sounds against the real app (production-pass addendum, Click sounds). A spy in every page counts AudioContexts and
// oscillator starts: a tick is one start, the order chime four (two notes, each with its octave partial).
//
// Run: E2E_PORT=3271 npx playwright test e2e/sounds.spec.ts
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { a11y, appNav, DESKTOP, PHONE, settle } from './helpers';
import { addFixtureOrder, createFixtureShop, signInAsOwner, type FixtureShop } from './task8-fixtures';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const KEY = 'shelfie:feedback:v1';

let shop: FixtureShop;

interface Spy {
  contexts: number;
  starts: number[];
  orderEvents: number;
}
const spyOf = (page: Page) => page.evaluate(() => (window as unknown as { __sound: Spy }).__sound);
const starts = async (page: Page) => (await spyOf(page)).starts.length;

test.beforeAll(() => {
  shop = createFixtureShop('Sounds Test Bakery');
});

test.beforeEach(async ({ context }) => {
  await signInAsOwner(context, shop, BASE);
  await context.addInitScript(() => {
    const spy: Spy = { contexts: 0, starts: [], orderEvents: 0 };
    (window as unknown as { __sound: Spy }).__sound = spy;
    const Real = window.AudioContext;
    window.AudioContext = class extends Real {
      constructor(options?: AudioContextOptions) {
        super(options);
        spy.contexts += 1;
      }
    };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when?: number) {
      spy.starts.push(performance.now());
      return start.call(this, when);
    };
    window.addEventListener('shelfie:feedback', (e) => {
      if ((e as CustomEvent<{ event: string }>).detail.event === 'order') spy.orderEvents += 1;
    });
  });
});

const dashboard = (query = '') => `/shops/${shop.shop.id}${query}`;
const paidPickup = () =>
  addFixtureOrder(shop, {
    status: 'paid', fulfillment: 'pickup', minutesAgo: 2, buyerName: 'Kim', lines: [['Morning bun', 1]],
    payer: { name: 'Kim Tran', email: 'kim@example.com' },
  });
const markButton = (page: Page, number: string) => page.locator(`[data-order="${number}"] button`);
const soundToggle = (page: Page) => page.getByRole('button', { name: 'Sound', exact: true });
/** A dashboard section in the seller nav (the sections were tabs before the app shell). */
const sectionLink = (page: Page, name: string) => appNav(page).getByRole('link', { name, exact: false });

/** Hydrated (Tactile's listener is on) and the target finished its entrance, so a press lands where its box says. */
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
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function centre(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('the target has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Stops the fixture shop's APIs from changing what's under test, so a press is only a press. */
async function refuseFulfil(page: Page) {
  await page.route(`**/api/shops/${shop.shop.id}/orders/*/fulfil`, (route) =>
    route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }),
  );
}

/** A link press with no navigation: the spy lives in the page, and a new document would reset it. */
const keepPage = (link: Locator) => link.evaluate((el) => el.addEventListener('click', (e) => e.preventDefault()));

/** The sound has had time to start, and a second one would have shown by now. */
const quiet = (page: Page) => page.waitForTimeout(250);

const SIZES = [
  ['390', PHONE, true],
  ['1440', DESKTOP, false],
] as const;

for (const [label, viewport, touch] of SIZES) {
  test.describe(`one tick per press at ${label} px`, () => {
    test.use({ viewport, hasTouch: touch });

    async function press(page: Page, target: Locator) {
      const { x, y } = await centre(target);
      if (touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y, { delay: 40 });
    }

    async function expectOneTick(page: Page, target: Locator) {
      await ready(page, target);
      expect(await starts(page)).toBe(0);
      await press(page, target);
      await expect.poll(() => starts(page)).toBe(1);
      await quiet(page);
      expect(await starts(page)).toBe(1);
    }

    test('a button', async ({ page }) => {
      const order = paidPickup();
      await refuseFulfil(page);
      await page.goto(dashboard());
      await expectOneTick(page, markButton(page, order.number));
    });

    test('a link', async ({ page }) => {
      await page.goto('/');
      const link = page.locator('header a').first();
      await link.waitFor({ state: 'visible' });
      await keepPage(link);
      await expectOneTick(page, link);
    });

    test('a section link', async ({ page }) => {
      await page.goto(dashboard());
      await expectOneTick(page, sectionLink(page, 'Menu'));
    });

    test('a tab', async ({ page }) => {
      await page.goto(`/s/${shop.shop.slug}#agent-door`);
      await expectOneTick(page, page.getByRole('tab').last());
    });

    test('a switch', async ({ page }) => {
      await page.goto(dashboard('?tab=settings'));
      const toggle = page.getByRole('switch', { name: 'Play sounds and vibrate' });
      await expectOneTick(page, toggle);
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    test('no AudioContext before the first gesture, on any page', async ({ page }) => {
      const order = paidPickup();
      for (const path of ['/', `/s/${shop.shop.slug}`, `/o/${order.id}`, dashboard()]) {
        await page.goto(path);
        // The footer toggle is public chrome; inside the seller shell the section links are what's there.
        await ready(page, path === dashboard() ? sectionLink(page, 'Menu') : soundToggle(page));
        await page.waitForTimeout(200);
        expect(await spyOf(page), path).toEqual({ contexts: 0, starts: [], orderEvents: 0 });
      }
      await press(page, sectionLink(page, 'Menu'));
      await expect.poll(async () => (await spyOf(page)).contexts).toBe(1);
    });
  });
}

test.describe('at 1440 with a mouse', () => {
  test.use({ viewport: DESKTOP });

  /** A press somewhere on the page that presses no control: audio is unlocked, so a later silence means something. */
  async function unlock(page: Page) {
    await page.mouse.click(5, 300);
    await expect.poll(async () => (await spyOf(page)).contexts).toBe(1);
  }

  test('none on hover or focus', async ({ page }) => {
    const order = paidPickup();
    await page.goto(dashboard());
    const button = markButton(page, order.number);
    await ready(page, button);
    await unlock(page);
    const { x, y } = await centre(button);
    await page.mouse.move(x, y, { steps: 4 });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await button.focus();
    await quiet(page);
    expect(await starts(page)).toBe(0);
  });

  test('none on a disabled control, native or aria-disabled', async ({ page }) => {
    const order = paidPickup();
    await refuseFulfil(page);
    await page.goto(dashboard());
    const button = markButton(page, order.number);
    await ready(page, button);
    await unlock(page);
    const { x, y } = await centre(button);

    await button.evaluate((el: HTMLButtonElement) => (el.disabled = true));
    await page.mouse.click(x, y, { delay: 40 });
    await button.evaluate((el: HTMLButtonElement) => {
      el.disabled = false;
      el.setAttribute('aria-disabled', 'true');
    });
    await page.mouse.click(x, y, { delay: 40 });
    await quiet(page);
    expect(await starts(page)).toBe(0);

    // The same control does tick once it's available again, so the silence above was the rule at work.
    await button.evaluate((el: HTMLButtonElement) => el.removeAttribute('aria-disabled'));
    await page.mouse.click(x, y, { delay: 40 });
    await expect.poll(() => starts(page)).toBe(1);
  });

  test('a key press ticks once, however long the key is held', async ({ page }) => {
    await page.goto(dashboard());
    const tab = sectionLink(page, 'Menu');
    await ready(page, tab);
    await tab.focus();
    await page.keyboard.down('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.down('Enter'); // a held key repeats
    await page.keyboard.up('Enter');
    await expect.poll(() => starts(page)).toBe(1);
    await quiet(page);
    expect(await starts(page)).toBe(1);
  });

  test('none when off, and off survives a reload', async ({ page }) => {
    await page.goto('/');
    const toggle = soundToggle(page);
    await ready(page, toggle);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('false');

    await page.reload();
    await ready(page, toggle);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const link = page.locator('header a').first();
    await keepPage(link);
    await link.click();
    await quiet(page);
    expect(await spyOf(page)).toEqual({ contexts: 0, starts: [], orderEvents: 0 });

    // The seller's switch is the same setting.
    await page.goto(dashboard('?tab=settings'));
    const sellerSwitch = page.getByRole('switch', { name: 'Play sounds and vibrate' });
    await ready(page, sellerSwitch);
    await expect(sellerSwitch).toHaveAttribute('aria-checked', 'false');
    await sellerSwitch.click();
    await expect(sellerSwitch).toHaveAttribute('aria-checked', 'true');
    // The footer toggle is hidden inside the shell, so it is read where it shows.
    await page.goto('/');
    await ready(page, soundToggle(page));
    await expect(soundToggle(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('true');
  });

  test('new paid orders chime once for the whole poll batch', async ({ page }) => {
    await page.goto(dashboard());
    await ready(page, sectionLink(page, 'Orders'));
    await unlock(page);

    paidPickup();
    paidPickup();
    await expect.poll(async () => (await spyOf(page)).orderEvents, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(() => starts(page)).toBe(4);
    await page.waitForTimeout(6_000); // the next poll finds nothing new
    expect(await spyOf(page)).toMatchObject({ orderEvents: 1 });
    expect(await starts(page)).toBe(4);
  });

  test('the footer toggle is on every public page, 44 px, and named', async ({ page }) => {
    const order = paidPickup();
    for (const path of ['/', `/s/${shop.shop.slug}`, `/o/${order.id}`, '/no-such-page']) {
      await page.goto(path);
      const toggle = soundToggle(page);
      await toggle.waitFor({ state: 'visible' });
      const box = await toggle.boundingBox();
      expect(box!.width, path).toBeGreaterThanOrEqual(44);
      expect(box!.height, path).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('at 390 with touch', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  /** Real touch events through the browser's input pipeline, so it scrolls and cancels the pointer as a finger would. */
  async function swipe(context: BrowserContext, page: Page, x: number, y: number, restMs: number) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    if (restMs) await page.waitForTimeout(restMs);
    for (let dy = 16; dy <= 260; dy += 16) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  for (const [kind, restMs] of [['a flick', 0], ['a finger that rests before it scrolls', 150]] as const) {
    test(`none for ${kind} over a row`, async ({ page, context }) => {
      for (let i = 0; i < 8; i += 1) paidPickup();
      const order = paidPickup();
      await page.goto(dashboard());
      const row = page.locator(`[data-order="${order.number}"]`);
      await ready(page, row);
      await page.evaluate(() => window.scrollTo(0, 0));
      const { x, y } = await centre(row);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const before = await page.evaluate(() => window.scrollY);

      await swipe(context, page, x, y, restMs);
      await page.waitForTimeout(300);

      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
      expect(await starts(page)).toBe(0);
    });
  }
});

for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`accessibility at ${label} px`, () => {
    test.use({ viewport });

    test('axe has nothing to report with the footer toggle and the Settings section', async ({ page }) => {
      await page.goto('/');
      await settle(page);
      await soundToggle(page).waitFor({ state: 'visible' });
      await a11y(page);

      await page.goto(`/s/${shop.shop.slug}`);
      await settle(page);
      await a11y(page);

      await page.goto(dashboard('?tab=settings'));
      await settle(page);
      await expect(page.getByRole('heading', { name: 'Sound and vibration' })).toBeVisible();
      await a11y(page);

      // The footer toggle is hidden in the shell: the seller's switch is the same setting, and the toggle shows it on /.
      await page.getByRole('switch', { name: 'Play sounds and vibrate' }).click();
      await page.goto('/');
      await settle(page);
      await soundToggle(page).waitFor({ state: 'visible' });
      await expect(soundToggle(page)).toHaveAttribute('aria-pressed', 'false');
      await a11y(page);
    });
  });
}
