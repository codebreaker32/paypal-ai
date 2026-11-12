// The assistant's three surfaces: where the box sits at each width, at every scroll position and with any amount of
// conversation. The console's stream is replayed from a recorded run,
// so no Claude or PayPal calls happen here.
//
// Run: E2E_PORT=3211 npx playwright test e2e/assistant-layout.spec.ts
// Titles carry check numbers: `--grep "A6"` runs the tests for check 6. Checks 9 and 16 fake the visual
// viewport and the stream; everything else is measured in the browser.
import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as itemsRepo from '../src/lib/db/repos/items';
import * as shopsRepo from '../src/lib/db/repos/shops';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { a11y, settle, smallTargets } from './helpers';

const SLUG = DEMO_SHOP.slug;
const TITLE = 'Order with an assistant';
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'console-turns.json'), 'utf8')) as {
  prompts: string[];
  turns: Record<string, unknown>[][];
};

test.beforeAll(async () => {
  const db = getDb();
  if (!shopsRepo.bySlug(db, SLUG)) {
    await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir: getConfig().uploadsDir });
  }
});

const ONE_SECTION_NAME = 'E2E One Section Shop';
let oneSectionSlug = '';

test.beforeAll(() => {
  // Paused and one section long: "Ask the assistant" at the top, and a sticky row that only holds the compact button.
  const db = getDb();
  for (const o of db.prepare('SELECT id FROM shops WHERE name = ?').all(ONE_SECTION_NAME) as { id: string }[]) {
    db.prepare('DELETE FROM shops WHERE id = ?').run(o.id);
  }
  const { shop } = shopsRepo.create(db, { name: ONE_SECTION_NAME, about: 'One section.', fulfillment: 'pickup', pickupNotes: 'Fridays' });
  const items = itemsRepo.replaceDrafts(
    db,
    shop.id,
    ['Lemon bar', 'Iced tea', 'Almond cake', 'Plum tart', 'Fig roll', 'Pear slice'].map((name) => ({
      section: 'Today', name, description: null, sourceText: name, confidence: 'high' as const, kind: 'PHYSICAL' as const, issues: [],
      issueDetail: null, status: 'draft' as const, variants: [{ label: null, priceCents: 350 }],
    })),
  );
  items.forEach((item, n) => itemsRepo.setPayPalProductId(db, item.id, `PROD-E2E-LAYOUT-${n}`));
  shopsRepo.publish(db, shop.id);
  oneSectionSlug = shopsRepo.update(db, shop.id, { status: 'paused' }).slug;
});

test.afterAll(() => {
  const db = getDb();
  for (const o of db.prepare('SELECT id FROM shops WHERE name = ?').all(ONE_SECTION_NAME) as { id: string }[]) {
    db.prepare('DELETE FROM shops WHERE id = ?').run(o.id);
  }
});

const ndjson = (events: Record<string, unknown>[]) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

async function replayTurns(page: Page): Promise<void> {
  let turn = 0;
  await page.route(`**/api/assistant/${SLUG}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(FIXTURE.turns[Math.min(turn++, FIXTURE.turns.length - 1)]) });
  });
}

/** Sends the recorded prompts through the composer until the approval card has arrived. */
async function orderThrough(region: Locator): Promise<void> {
  const box = region.getByRole('textbox', { name: 'Message to the assistant' });
  for (const prompt of FIXTURE.prompts) {
    await box.fill(prompt);
    await box.press('Enter');
    await expect(region.getByRole('button', { name: 'Start over' })).toBeVisible();
  }
  await expect(region.getByRole('link', { name: 'Approve $27.00 on PayPal' })).toBeVisible();
}

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b!;
};

/** The composer, its box and its button: each fully inside the viewport. */
async function expectComposerInside(page: Page, region: Locator): Promise<void> {
  const { w, h } = await innerSize(page);
  for (const part of [
    region.locator('[data-assistant-footer] form'),
    region.getByRole('textbox', { name: 'Message to the assistant' }),
    region.getByRole('button', { name: 'Send' }),
  ]) {
    const b = await box(part);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w);
    expect(b.y + b.height).toBeLessThanOrEqual(h);
  }
}

const innerSize = (page: Page) => page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, sw: document.documentElement.scrollWidth }));

async function expectDocked(page: Page): Promise<void> {
  const aside = page.locator('[data-assistant-dock]');
  const { w, h, sw } = await innerSize(page);
  const b = await box(aside);
  expect(b.y).toBe(0);
  expect(b.y + b.height).toBe(h);
  expect(b.x + b.width).toBe(w);
  expect(b.width).toBeGreaterThanOrEqual(380);
  expect(b.width).toBeLessThanOrEqual(440);
  expect(sw).toBeLessThanOrEqual(w);

  const send = await box(aside.getByRole('button', { name: 'Send' }));
  expect(send.y + send.height).toBeLessThanOrEqual(h);

  for (const name of ['main', 'body > header, header', 'footer']) {
    const part = page.locator(name).first();
    if (await part.count()) expect((await box(part)).x + (await box(part)).width).toBeLessThanOrEqual(b.x + 1);
  }

  await expectComposerInside(page, aside);
  // A3 as written: all of them exist, and none reaches past the panel's left edge.
  for (const tag of ['main', 'header', 'footer']) {
    const parts = await page.locator(tag).all();
    expect(parts.length, tag).toBeGreaterThan(0);
    for (const part of parts) {
      const p = await box(part);
      expect(p.x + p.width, tag).toBeLessThanOrEqual(b.x + EPSILON);
    }
  }
}

/** Layout rounds to 1/64 px at fractional widths (30vw at 1366 is 409.8), so "at or left of" gets that much room. */
const EPSILON = 1 / 32;

test.describe('docked from 1024 px', () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
    test(`A1 A2 A3: ${viewport.width}x${viewport.height}: edge to edge at any scroll`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/s/${SLUG}?assistant=1`);
      await settle(page);
      for (const to of [0, 0.5, 1]) {
        await page.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * f, behavior: 'instant' }), to);
        const { y, end } = await page.evaluate(() => ({ y: window.scrollY, end: document.documentElement.scrollHeight - window.innerHeight }));
        expect(end).toBeGreaterThan(100);
        expect(Math.abs(y - end * to)).toBeLessThanOrEqual(2);
        await expectDocked(page);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      // The dock's top row is its Assistant / Your order switch: that row lines up with the site header.
      const panelHeader = await box(page.locator('[data-assistant-dock] [data-dock-switch]'));
      const siteHeader = await box(page.locator('header').first());
      expect(Math.abs(panelHeader.y + panelHeader.height - (siteHeader.y + siteHeader.height))).toBeLessThanOrEqual(1);
    });
  }

  test('1440: the dock is named by its title and the content narrows beside it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/s/${SLUG}?assistant=1`);
    await settle(page);
    await expect(page.getByRole('complementary', { name: TITLE })).toBeVisible();
    expect((await box(page.locator('[data-assistant-dock]'))).x).toBe(1008);
  });

  for (const width of [1440, 1920]) {
    test(`A4: ${width}: the logo stays within 8 px between closed and open`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const logo = page.locator('header a').first();
      const closed = await box(logo);
      await page.getByRole('button', { name: TITLE }).filter({ visible: true }).first().click();
      await expect(page.locator('[data-assistant-dock]')).toBeVisible();
      const opened = await box(logo);
      expect(Math.abs(closed.x - opened.x)).toBeLessThanOrEqual(8);
    });
  }

  test('A10: 1440: after a replayed order, the payment check and Start over sit outside the scroller', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/s/${SLUG}?assistant=1`);
    await settle(page);
    await replayTurns(page);
    const region = page.getByRole('complementary', { name: TITLE });
    await orderThrough(region);
    await expectFooterActions(page, region);
  });
});

async function expectFooterActions(page: Page, region: Locator): Promise<void> {
  const footer = region.locator('[data-assistant-footer]');
  for (const name of ['Did my payment go through?', 'Start over']) {
    const button = footer.getByRole('button', { name });
    await expect(button).toBeVisible();
    const b = await box(button);
    const { h } = await innerSize(page);
    expect(b.y + b.height).toBeLessThanOrEqual(h);
    await expect(region.locator('.overflow-y-auto').getByRole('button', { name })).toHaveCount(0);
    // Fully on screen, and below the scroller rather than over it.
    const { w } = await innerSize(page);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w);
    const scroller = await box(region.locator('.overflow-y-auto').first());
    expect(b.y).toBeGreaterThanOrEqual(scroller.y + scroller.height);
  }
}

test.describe('phone: bottom sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('A6 A10 A13: 390x844: y 12 to 844 for empty and full conversation; focus on the heading', async ({ page }) => {
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    await replayTurns(page);
    await page.locator('[data-order-bar] button').click();
    const dialog = page.getByRole('dialog', { name: TITLE });
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H2');

    const empty = await box(dialog);
    expect(Math.abs(empty.y - 12)).toBeLessThanOrEqual(1);
    expect(empty.y + empty.height).toBe(844);

    await orderThrough(dialog);
    const full = await box(dialog);
    expect(full.y).toBe(empty.y);
    expect(full.height).toBe(empty.height);
    await expectFooterActions(page, dialog);
  });

  test('A8: 390x480: the composer stays inside the screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 480 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    await page.locator('[data-order-bar] button').click();
    const dialog = page.getByRole('dialog', { name: TITLE });
    await expect(dialog).toBeVisible();
    const send = await box(dialog.getByRole('button', { name: 'Send' }));
    expect(send.y + send.height).toBeLessThanOrEqual(480);
    await expectComposerInside(page, dialog);
  });
});

test('A7: 768x1024: full-height side sheet at the right edge', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`/s/${SLUG}`);
  await settle(page);
  await page.locator('[data-order-bar] button').click();
  const dialog = page.getByRole('dialog', { name: TITLE });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => (await box(dialog)).x).toBe(328);
  const b = await box(dialog);
  expect(b.y).toBe(0);
  expect(b.width).toBe(440);
  expect(b.height).toBe(1024);
  expect(b.x + b.width).toBe(768);
});

test('A18: reduced motion: the dock and sheet sit still', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/s/${SLUG}?assistant=1`);
  await settle(page);
  const moved = (sel: string) =>
    page.locator(sel).evaluate((el) => ({ transform: getComputedStyle(el).transform, running: el.getAnimations().filter((a) => a.playState === 'running').length }));
  await expect.poll(() => moved('[data-assistant-dock]')).toEqual({ transform: 'none', running: 0 });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog', { name: TITLE })).toBeVisible();
  await expect.poll(() => moved('dialog.assistant-sheet')).toEqual({ transform: 'none', running: 0 });
});

test.describe('entry points: one order button, no side card', () => {
  const visibleCtas = (page: Page) => page.getByRole('button', { name: TITLE }).filter({ visible: true });
  const scrollTo = async (page: Page, y: number) => {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(350);
  };

  test('A5: 1440, closed: no side card, and exactly one button at the top, mid page and the end', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    await expect(page.getByRole('complementary', { name: TITLE })).toHaveCount(0);
    await expect(visibleCtas(page)).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Order with an assistant · PayPal' })).toBeVisible();
    await expect(page.locator('[data-hero-cta]').getByRole('link', { name: 'agent door' })).toBeVisible();

    for (const y of [900, 1_000_000]) {
      await scrollTo(page, y);
      await expect(visibleCtas(page)).toHaveCount(1);
      await expect(page.locator('[data-compact-cta]').getByRole('button', { name: TITLE })).toBeVisible();
    }
  });

  test('1440: the compact button opens the dock, then neither button shows; closing returns focus to it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    await scrollTo(page, 900);
    await page.locator('[data-compact-cta]').getByRole('button', { name: TITLE }).click();
    await expect(page.locator('[data-assistant-dock]')).toBeVisible();
    await expect(page.locator('[data-hero-cta] button, [data-compact-cta] button').filter({ visible: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Close the assistant' }).click();
    await expect(page.locator('[data-assistant-dock]')).toHaveCount(0);
    await expect(page.locator('[data-compact-cta]').getByRole('button', { name: TITLE })).toBeFocused();
  });

  for (const width of [1023, 640]) {
    test(`${width}: the order bar keeps PayPal, centred at most 448 px wide, with no hero button`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const bar = page.locator('[data-order-bar] button');
      await expect(bar).toContainText('· PayPal');
      const wide = await box(bar);
      expect(wide.width).toBeLessThanOrEqual(448);
      expect(Math.abs(wide.x + wide.width / 2 - width / 2)).toBeLessThanOrEqual(2);

      await expect(page.getByRole('complementary', { name: TITLE })).toHaveCount(0);
      await expect(page.locator('[data-hero-cta] button').filter({ visible: true })).toHaveCount(0);
    });
  }

  test('a shop with one section: "Ask the assistant" at lg, and its compact row appears only once the hero leaves', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto(`/s/${oneSectionSlug}`);
    await settle(page);
    const ctas = page.getByRole('button', { name: 'Ask the assistant' }).filter({ visible: true });
    await expect(ctas).toHaveCount(1);
    await expect(page.locator('[data-hero-cta]').getByRole('button', { name: 'Ask the assistant' })).toBeVisible();
    await expect(page.getByRole('button', { name: /PayPal/ })).toHaveCount(0);

    await scrollTo(page, 1_000_000);
    await expect(ctas).toHaveCount(1);
    await expect(page.locator('[data-compact-cta]').getByRole('button', { name: 'Ask the assistant' })).toBeVisible();
  });
});

/** The assistant's stream, under the test's control: `emit` one event at a time, `finish` to end the reply. */
const streamByHand = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const realFetch = window.fetch.bind(window);
    let stream: ReadableStreamDefaultController<Uint8Array> | null = null;
    window.fetch = (input, init) => {
      if (!String(input).includes('/api/assistant/')) return realFetch(input, init);
      const body = new ReadableStream<Uint8Array>({ start: (c) => void (stream = c) });
      return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson' } }));
    };
    w.emit = (event: unknown) => stream?.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
    w.finish = () => {
      stream?.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'done' }) + '\n'));
      stream?.close();
    };
  });

const emit = (page: Page, event: Record<string, unknown>) => page.evaluate((e) => (window as unknown as { emit: (e: unknown) => void }).emit(e), event);
const finish = (page: Page) => page.evaluate(() => (window as unknown as { finish: () => void }).finish());
const PARAGRAPH = Array.from({ length: 70 }, (_, i) => `word${i}`).join(' ');

const logState = (scroller: Locator) =>
  scroller.evaluate((el) => ({ top: el.scrollTop, end: el.scrollHeight - el.clientHeight, bottom: el.getBoundingClientRect().bottom, boxTop: el.getBoundingClientRect().top }));

/** Sends one message and waits for the buyer's bubble. */
async function say(region: Locator, text: string): Promise<void> {
  const input = region.getByRole('textbox', { name: 'Message to the assistant' });
  await input.fill(text);
  await input.press('Enter');
  await expect(region.getByRole('log').getByText(text)).toBeVisible();
}

/** A deep-linked conversation with one finished turn long enough to scroll. */
async function longConversation(page: Page, surface = 'dialog') {
  await streamByHand(page);
  await page.goto(`/s/${SLUG}?assistant=1`);
  await settle(page);
  const region = surface === 'dialog' ? page.getByRole('dialog') : page.locator(surface);
  await say(region, 'first');
  for (let i = 0; i < 6; i++) await emit(page, { type: 'text', text: PARAGRAPH });
  await finish(page);
  await expect(region.getByRole('button', { name: 'Start over' })).toBeVisible();
  return { region, scroller: region.locator('.overflow-y-auto').first() };
}

test.describe('message scrolling', () => {
  test.use({ viewport: { width: 390, height: 560 } });

  test('a new message scrolls to it, even after the buyer scrolled away', async ({ page }) => {
    const { region, scroller } = await longConversation(page);
    await scroller.evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(100);
    await say(region, 'second question');
    const s = await logState(scroller);
    expect(s.top).toBeGreaterThanOrEqual(s.end - 1);
    const bubble = await box(region.getByRole('log').getByText('second question'));
    expect(bubble.y + bubble.height).toBeLessThanOrEqual(s.bottom);
  });

  test('a stream follows up to the start of the turn and never past it', async ({ page }) => {
    const { region, scroller } = await longConversation(page);
    await say(region, 'second question');
    await emit(page, { type: 'text', text: `FIRST-REPLY ${PARAGRAPH}` });
    const reply = region.getByRole('log').getByText('FIRST-REPLY');
    await expect(reply).toBeVisible();
    for (let i = 0; i < 6; i++) await emit(page, { type: 'text', text: PARAGRAPH });
    await page.waitForTimeout(400);
    const s = await logState(scroller);
    const first = await box(reply);
    expect(first.y).toBeGreaterThanOrEqual(s.boxTop);
    expect(s.top).toBeLessThan(s.end);
  });

  test('A16: a buyer who scrolled up during a stream keeps their place', async ({ page }) => {
    const { region, scroller } = await longConversation(page);
    await say(region, 'second question');
    await emit(page, { type: 'text', text: PARAGRAPH });
    await page.waitForTimeout(100);
    await scroller.evaluate((el) => (el.scrollTop = Math.max(0, el.scrollTop - 400)));
    await page.waitForTimeout(100);
    const before = (await logState(scroller)).top;
    for (let i = 0; i < 4; i++) await emit(page, { type: 'text', text: PARAGRAPH });
    await page.waitForTimeout(300);
    expect((await logState(scroller)).top).toBe(before);
  });

  test('a restored conversation opens at its end', async ({ page }) => {
    const { region, scroller } = await longConversation(page);
    await region.getByRole('button', { name: 'Close the assistant' }).click();
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    await page.getByRole('button', { name: new RegExp(TITLE) }).click();
    await expect(region).toBeVisible();
    const s = await logState(scroller);
    expect(s.end).toBeGreaterThan(0);
    expect(s.top).toBeGreaterThanOrEqual(s.end - 1);
  });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 390, height: 560 }]) {
    test(`A11: ${viewport.width}x${viewport.height}: the approval link is fully inside the log on arrival`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await replayTurns(page);
      await page.goto(`/s/${SLUG}?assistant=1`);
      await settle(page);
      const region = viewport.width >= 1024 ? page.locator('[data-assistant-dock]') : page.getByRole('dialog');
      await orderThrough(region);
      await page.waitForTimeout(350);
      const link = await box(region.getByRole('link', { name: 'Approve $27.00 on PayPal' }));
      const s = await logState(region.locator('.overflow-y-auto').first());
      expect(link.y).toBeGreaterThanOrEqual(s.boxTop);
      expect(link.y + link.height).toBeLessThanOrEqual(s.bottom);
    });
  }

  test('A16: wheel over the log at its end leaves the page where it was', async ({ page }) => {
    const { scroller } = await longConversation(page);
    await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
    const before = await page.evaluate(() => window.scrollY);
    const b = await box(scroller);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });
});

test.describe('keyboard', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the page asks the browser to resize for the keyboard, and keeps the root viewport', async ({ page }) => {
    await page.goto(`/s/${SLUG}`);
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('interactive-widget=resizes-content');
    expect(content).toContain('width=device-width');
    expect(content).not.toContain('viewport-fit');
  });

  test('A9: a visual viewport of 500 px: the dialog shrinks to 488 and the composer stays above it', async ({ page }) => {
    await page.addInitScript(() => {
      const fake = new EventTarget() as EventTarget & { height: number; offsetTop: number; scale: number; width: number };
      fake.height = window.innerHeight;
      fake.offsetTop = 0;
      fake.scale = 1;
      Object.defineProperty(window, 'visualViewport', { value: fake });
      (window as unknown as { keyboard: (h: number) => void }).keyboard = (h) => {
        fake.height = h;
        fake.dispatchEvent(new Event('resize'));
      };
    });
    await page.goto(`/s/${SLUG}?assistant=1`);
    await settle(page);
    const dialog = page.getByRole('dialog');
    await page.evaluate(() => (window as unknown as { keyboard: (h: number) => void }).keyboard(500));
    await expect.poll(async () => (await box(dialog)).height).toBe(488);
    expect((await box(dialog)).y).toBe(12);
    const send = await box(dialog.getByRole('button', { name: 'Send' }));
    expect(send.y + send.height).toBeLessThanOrEqual(500);

    // The keyboard goes away: back to the full height.
    await page.evaluate(() => (window as unknown as { keyboard: (h: number) => void }).keyboard(844));
    await expect.poll(async () => (await box(dialog)).height).toBe(832);
  });
});

test.describe('1440: the page holds still as the dock opens and closes', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('A15: a section in view stays within 8 px', async ({ page }) => {
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    // Stands in for the menu re-flowing beside the dock: the page above the anchor changes height as it opens. No browser
    // scroll anchoring, as in Safari, so the page's own correction is what's measured.
    await page.addStyleTag({ content: 'html { overflow-anchor: none; } main h3 { transition: none !important; } html:has([data-assistant-dock]) main h3:first-of-type { padding-top: 120px; }' });
    const section = page.locator('main h3').nth(1);
    await section.evaluate((el) => window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 300, behavior: 'instant' }));
    await page.waitForTimeout(250);
    const anchor = page.locator('main h3, main li').filter({ visible: true });
    const firstOnScreen = await anchor.evaluateAll((els) => els.findIndex((el) => el.getBoundingClientRect().bottom > 72));
    const watched = anchor.nth(firstOnScreen);
    const before = (await box(watched)).y;
    await page.getByRole('button', { name: new RegExp(TITLE) }).filter({ visible: true }).first().click();
    await expect(page.locator('[data-assistant-dock]')).toBeVisible();
    expect(Math.abs((await box(watched)).y - before)).toBeLessThanOrEqual(8);
    await page.getByRole('button', { name: 'Close the assistant' }).click();
    await expect(page.locator('[data-assistant-dock]')).toHaveCount(0);
    expect(Math.abs((await box(watched)).y - before)).toBeLessThanOrEqual(8);
  });
});

test.describe('focus', () => {
  const input = (page: Page) => page.getByRole('textbox', { name: 'Message to the assistant' });
  const heading = (page: Page) => page.getByRole('heading', { name: TITLE, level: 2 });

  test.describe('1440', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('A13: a click docks and focuses the message box, the caret at the end; Esc inside closes and focus returns to a button that shows', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const hero = page.locator('[data-hero-cta]').getByRole('button', { name: new RegExp(TITLE) });
      await hero.click();
      await expect(input(page)).toBeFocused();
      await input(page).fill('half a sentence');
      await expect.poll(() => input(page).evaluate((el: HTMLInputElement) => el.selectionStart)).toBe('half a sentence'.length);

      await page.keyboard.press('Escape');
      await expect(page.locator('[data-assistant-dock]')).toHaveCount(0);
      await expect(hero).toBeFocused();
    });

    test('docked by keyboard: Enter on the button focuses the message box', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const hero = page.locator('[data-hero-cta]').getByRole('button', { name: new RegExp(TITLE) });
      await hero.focus();
      await page.keyboard.press('Enter');
      await expect(input(page)).toBeFocused();
    });

    test('no trap while docked: focus can leave, and Esc outside the panel does nothing', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await page.locator('[data-hero-cta]').getByRole('button', { name: new RegExp(TITLE) }).click();
      await expect(input(page)).toBeFocused();
      await page.getByRole('link', { name: /Shelfie/i }).first().focus();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-assistant-dock]')).toBeVisible();
    });

    test('a `?assistant=1` load moves no focus', async ({ page }) => {
      await page.goto(`/s/${SLUG}?assistant=1`);
      await settle(page);
      await expect(page.locator('[data-assistant-dock]')).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
    });

    test('deep link then close: focus lands on a button that shows', async ({ page }) => {
      await page.goto(`/s/${SLUG}?assistant=1`);
      await settle(page);
      await page.getByRole('button', { name: 'Close the assistant' }).click();
      await expect(page.locator('[data-assistant-dock]')).toHaveCount(0);
      await expect(page.locator('[data-hero-cta]').getByRole('button', { name: new RegExp(TITLE) })).toBeFocused();
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('A12 A13: modal: the heading, never the message box; closing puts focus on the opener and the page stays put', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
      expect(await page.evaluate(() => window.scrollY)).toBe(500);
      const bar = page.locator('[data-order-bar] button');
      await bar.click();
      await expect(heading(page)).toBeFocused();
      await expect(input(page)).not.toBeFocused();
      await page.getByRole('button', { name: 'Close the assistant' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(bar).toBeFocused();
      expect(await page.evaluate(() => window.scrollY)).toBe(500);
    });
  });
});

test.describe('back and deep link', () => {
  const close = (page: Page) => page.getByRole('button', { name: 'Close the assistant' }).click();
  const hasParam = (page: Page) => new URL(page.url()).searchParams.has('assistant');
  const marker = (page: Page) => page.evaluate(() => (window as unknown as { __marker?: string }).__marker);
  const setMarker = (page: Page) => page.evaluate(() => void ((window as unknown as { __marker: string }).__marker = 'still here'));
  const length = (page: Page) => page.evaluate(() => history.length);

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    const bar = (page: Page) => page.locator('[data-order-bar] button');

    test('A14: tap open, then Back: the sheet closes, the URL is clean and the page did not reload', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await setMarker(page);
      await bar(page).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(hasParam(page)).toBe(true);

      await page.goBack();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(hasParam(page)).toBe(false);
      expect(await marker(page)).toBe('still here');
    });

    test('tap open, then the X, Esc and the scrim each close through Back', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const start = await length(page);
      const closers: ((p: Page) => Promise<unknown>)[] = [
        close,
        (p) => p.keyboard.press('Escape'),
        (p) => p.getByRole('dialog').evaluate((d: HTMLDialogElement) => d.dispatchEvent(new MouseEvent('click', { bubbles: true }))),
      ];
      for (const closer of closers) {
        await bar(page).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect(hasParam(page)).toBe(true);
        await closer(page);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(hasParam(page)).toBe(false);
      }
      // Each open adds one entry, each close steps back off it: the entry above is reused by the next tap.
      expect(await length(page)).toBe(start + 1);
    });

    test('a close tapped twice leaves the shop only once closed, never the shop itself', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await setMarker(page);
      await bar(page).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Close the assistant' }).dblclick();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe(`/s/${SLUG}`);
      expect(await marker(page)).toBe('still here');
    });

    test('Forward reopens, and Back then closes again', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await bar(page).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.goBack();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.goForward();
      await expect(page.getByRole('dialog')).toBeVisible();
      await close(page);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(hasParam(page)).toBe(false);
    });

    test('A14: deep link, then X: closed by replaceState, history.length unchanged, focus on the order bar', async ({ page }) => {
      await page.goto(`/s/${SLUG}?assistant=1`);
      await settle(page);
      await expect(page.getByRole('dialog')).toBeVisible();
      const before = await length(page);
      await close(page);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(hasParam(page)).toBe(false);
      expect(await length(page)).toBe(before);
      await expect(bar(page)).toBeFocused();
    });

    test('a query the page already had survives opening and closing', async ({ page }) => {
      await page.goto(`/s/${SLUG}?ref=flyer`);
      await settle(page);
      await bar(page).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(new URL(page.url()).searchParams.get('ref')).toBe('flyer');
      await close(page);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(new URL(page.url()).searchParams.get('ref')).toBe('flyer');
    });
  });

  test.describe('1440: docked', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('open and close rewrite the current entry only', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const before = await length(page);
      await page.locator('[data-hero-cta]').getByRole('button', { name: new RegExp(TITLE) }).click();
      await expect(page.locator('[data-assistant-dock]')).toBeVisible();
      expect(hasParam(page)).toBe(true);
      expect(await length(page)).toBe(before);
      await close(page);
      await expect(page.locator('[data-assistant-dock]')).toHaveCount(0);
      expect(hasParam(page)).toBe(false);
      expect(await length(page)).toBe(before);
    });
  });
});

test('A6: 390x844: the same box while thinking and with a long reply', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await streamByHand(page);
  await page.goto(`/s/${SLUG}`);
  await settle(page);
  await page.locator('[data-order-bar] button').click();
  const dialog = page.getByRole('dialog', { name: TITLE });
  await expect(dialog).toBeVisible();
  const empty = await box(dialog);
  expect(Math.abs(empty.y - 12)).toBeLessThanOrEqual(1);
  expect(empty.y + empty.height).toBe(844);

  await say(dialog, 'hello');
  await expect(dialog.getByRole('status').getByText('Thinking')).toBeVisible();
  const thinking = await box(dialog);
  expect(thinking).toEqual(empty);

  for (let i = 0; i < 6; i++) await emit(page, { type: 'text', text: PARAGRAPH });
  await finish(page);
  await expect(dialog.getByRole('button', { name: 'Start over' })).toBeVisible();
  const scroller = dialog.locator('.overflow-y-auto').first();
  const s = await logState(scroller);
  expect(s.end).toBeGreaterThan(0);
  expect(await box(dialog)).toEqual(empty);
});

test.describe('A13: Esc closes and focus returns to the opener', () => {
  test('phone: Esc on the sheet returns focus to the order bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    const bar = page.locator('[data-order-bar] button');
    await bar.click();
    await expect(page.getByRole('heading', { name: TITLE, level: 2 })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(bar).toBeFocused();
  });

  test('768: the side sheet takes focus on its heading; Esc returns it to the order bar', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    const bar = page.locator('[data-order-bar] button');
    await bar.click();
    await expect(page.getByRole('heading', { name: TITLE, level: 2 })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(bar).toBeFocused();
  });
});

test('A15: 1440: "Pastries" holds still as the dock opens and closes, with nothing forced', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/s/${SLUG}`);
  await settle(page);
  const pastries = page.getByRole('heading', { name: 'Pastries' });
  await pastries.evaluate((el) => window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 300, behavior: 'instant' }));
  await page.waitForTimeout(350);
  const before = (await box(pastries)).y;
  expect(Math.abs(before - 300)).toBeLessThanOrEqual(2);

  await page.getByRole('button', { name: TITLE }).filter({ visible: true }).first().click();
  await expect(page.locator('[data-assistant-dock]')).toBeVisible();
  await page.waitForTimeout(100);
  expect(Math.abs((await box(pastries)).y - before)).toBeLessThanOrEqual(8);

  await page.getByRole('button', { name: 'Close the assistant' }).click();
  await expect(page.locator('[data-assistant-dock]')).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(Math.abs((await box(pastries)).y - before)).toBeLessThanOrEqual(8);
});

test.describe('A16: the page never moves for the log, measured with a real wheel', () => {
  /** A wheel over the log. The first one proves the browser is delivering wheels to it. */
  async function wheelAtEnd(page: Page, scroller: Locator) {
    const b = await box(scroller);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const end = (await logState(scroller)).end;
    expect(end).toBeGreaterThan(200);
    await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.mouse.wheel(0, -120);
    await expect.poll(async () => (await logState(scroller)).top).toBeLessThan(end - 1);
    await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.waitForTimeout(100);
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    expect((await logState(scroller)).top).toBeGreaterThanOrEqual(end - 1);
    return before;
  }

  test('1440, docked with the page mid-way (no scroll lock): the page stays', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { scroller } = await longConversation(page, '[data-assistant-dock]');
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
    expect(await wheelAtEnd(page, scroller)).toBe(600);
  });

  test('390x844, sheet over a page at 500: the page stays', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await streamByHand(page);
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
    await page.locator('[data-order-bar] button').click();
    const region = page.getByRole('dialog');
    await expect(region).toBeVisible();
    await say(region, 'first');
    for (let i = 0; i < 6; i++) await emit(page, { type: 'text', text: PARAGRAPH });
    await finish(page);
    await expect(region.getByRole('button', { name: 'Start over' })).toBeVisible();
    expect(await wheelAtEnd(page, region.locator('.overflow-y-auto').first())).toBe(500);
  });

  test('1440: wheeling up during a stream keeps the buyer where they went', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { region, scroller } = await longConversation(page, '[data-assistant-dock]');
    await say(region, 'second question');
    await emit(page, { type: 'text', text: PARAGRAPH });
    await page.waitForTimeout(100);
    const b = await box(scroller);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const start = (await logState(scroller)).top;
    await page.mouse.wheel(0, -400);
    await expect.poll(async () => (await logState(scroller)).top).toBeLessThan(start - 200);
    await page.waitForTimeout(150);
    const before = (await logState(scroller)).top;
    for (let i = 0; i < 4; i++) await emit(page, { type: 'text', text: PARAGRAPH });
    await page.waitForTimeout(300);
    expect((await logState(scroller)).top).toBe(before);
  });
});

test.describe('A17: accessibility, empty and in conversation', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`${viewport.width}: axe and target size`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await replayTurns(page);
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const docked = viewport.width >= 1024;
      await page.getByRole('button', { name: TITLE }).filter({ visible: true }).first().click();
      const scope = docked ? '[data-assistant-dock]' : 'dialog[open]';
      const region = page.locator(scope);
      await expect(region).toBeVisible();

      await a11y(page);
      expect(await smallTargets(page, scope)).toEqual([]);

      await orderThrough(region);
      await page.waitForTimeout(350);
      await a11y(page);
      expect(await smallTargets(page, scope)).toEqual([]);
    });
  }
});

test.describe('A18: reduced motion, measured the moment each surface opens', () => {
  const measure = (region: Locator) =>
    region.evaluate(async (el) => {
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      // The surface itself must have nothing running at all. Inside it, the reduced-motion rule turns every transition
      // into a 0.01 ms one, and a colour change (the input's border when the pointer lands on it) can be caught in that
      // instant; anything longer than 1 ms, the scrim included, is a real animation and fails.
      const own = el.getAnimations().filter((a) => a.playState === 'running').length;
      const running = el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && Number(a.effect?.getTiming().duration) > 1).map((a) => {
        const effect = a.effect as KeyframeEffect;
        const name = (a as Partial<CSSAnimation>).animationName ?? (a as Partial<CSSTransition>).transitionProperty;
        return `${name} on ${effect.target?.tagName}.${effect.target?.className} (${effect.getTiming().duration} ms, ${effect.getTiming().iterations})`;
      });
      return { transform: getComputedStyle(el).transform, own, running };
    });

  for (const { width, height, surface } of [
    { width: 1440, height: 900, surface: '[data-assistant-dock]' },
    { width: 768, height: 1024, surface: 'dialog.assistant-sheet' },
    { width: 390, height: 844, surface: 'dialog.assistant-sheet' },
  ]) {
    test(`${width}: no transform and no running animation`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height });
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      await page.getByRole('button', { name: TITLE }).filter({ visible: true }).first().click();
      const region = page.locator(surface);
      await expect(region).toBeVisible();
      expect(await measure(region)).toEqual({ transform: 'none', own: 0, running: [] });
    });
  }

  test('motion on, the control: the same surface does slide in, and ends at 12 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      const w = window as unknown as { __sheetTransitions: string[] };
      w.__sheetTransitions = [];
      document.addEventListener('transitionrun', (e) => {
        if ((e.target as Element).matches('dialog.assistant-sheet')) w.__sheetTransitions.push((e as TransitionEvent).propertyName);
      });
    });
    await page.locator('[data-order-bar] button').click();
    const dialog = page.locator('dialog.assistant-sheet');
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __sheetTransitions: string[] }).__sheetTransitions)).toContain('transform');
    await expect.poll(() => dialog.evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
    const b = await box(dialog);
    expect(Math.abs(b.y - 12)).toBeLessThanOrEqual(1);
    expect(b.y + b.height).toBe(844);
  });
});

// History, focus and the first look at the page.
test.describe('the URL and the assistant agree after leaving and coming back', () => {
  const close = (page: Page) => page.getByRole('button', { name: 'Close the assistant' }).click();
  const hasParam = (page: Page) => new URL(page.url()).searchParams.has('assistant');
  const setMarker = (page: Page) => page.evaluate(() => void ((window as unknown as { __marker: string }).__marker = 'still here'));
  const marker = (page: Page) => page.evaluate(() => (window as unknown as { __marker?: string }).__marker);
  /** A client-side trip away, as the receipt link on the approval card makes, and Back. */
  const awayAndBack = async (page: Page) => {
    await page.evaluate(() => (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push('/o/ord_e2e_missing'));
    await page.waitForURL('**/o/ord_e2e_missing');
    await page.goBack();
    await page.waitForURL(`**/s/${SLUG}**`);
  };

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    const bar = (page: Page) => page.locator('[data-order-bar] button');

    test('tap open, a client-side trip away, Back: the sheet is open again and one X closes it', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await setMarker(page);
      await bar(page).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await awayAndBack(page);
      expect(await marker(page)).toBe('still here');
      expect(hasParam(page)).toBe(true);
      await expect(page.getByRole('dialog')).toBeVisible();

      await close(page);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(hasParam(page)).toBe(false);
      expect(new URL(page.url()).pathname).toBe(`/s/${SLUG}`);
    });

    test('deep link, X, a client-side trip away, Back: the sheet stays closed', async ({ page }) => {
      await page.goto(`/s/${SLUG}?assistant=1`);
      await settle(page);
      await expect(page.getByRole('dialog')).toBeVisible();
      await close(page);
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await awayAndBack(page);
      await settle(page);
      expect(hasParam(page)).toBe(false);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });

  test.describe('1440: docked', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    const dock = (page: Page) => page.locator('[data-assistant-dock]');
    const hero = (page: Page) => page.locator('[data-hero-cta]').getByRole('button', { name: new RegExp(TITLE) });
    const secondTab = (page: Page) => page.locator('a[href^="#section-"]').nth(1);
    const activeTag = (page: Page) => page.evaluate(() => document.activeElement?.tagName);

    test('a client-side trip away and Back: the dock is back, and focus has not moved into it', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await hero(page).click();
      await expect(dock(page)).toBeVisible();

      await awayAndBack(page);
      await expect(dock(page)).toBeVisible();
      expect(hasParam(page)).toBe(true);
      expect(await activeTag(page)).not.toBe('INPUT');

      await close(page);
      await expect(dock(page)).toHaveCount(0);
      expect(hasParam(page)).toBe(false);
    });

    test('closed, then Back across a section tab: the dock stays closed and the URL says so', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await setMarker(page);
      await hero(page).click();
      await expect(dock(page)).toBeVisible();
      await secondTab(page).click();
      await close(page);
      await expect(dock(page)).toHaveCount(0);

      await page.goBack();
      await expect.poll(() => hasParam(page)).toBe(false);
      await expect(dock(page)).toHaveCount(0);
      expect(await activeTag(page)).not.toBe('INPUT');
      expect(await marker(page)).toBe('still here');
    });

    test('open, then Back across a section tab: the dock stays open and the URL says so', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await setMarker(page);
      await secondTab(page).click();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await hero(page).click();
      await expect(dock(page)).toBeVisible();

      await page.goBack();
      await expect.poll(() => hasParam(page)).toBe(true);
      await expect(dock(page)).toBeVisible();

      // Forward onto the entry rewritten above: still the same page, not a reload.
      await page.goForward();
      await expect(dock(page)).toBeVisible();
      expect(await marker(page)).toBe('still here');
    });
  });

  test('a tablet crossing 1024 px: X on an entry the page never pushed stays in the shop', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    await setMarker(page);
    await page.locator('[data-hero-cta]').getByRole('button', { name: new RegExp(TITLE) }).click();
    await expect(page.locator('[data-assistant-dock]')).toBeVisible();
    await page.locator('a[href^="#section-"]').nth(1).click();
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('dialog')).toBeVisible();
    await close(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goBack();
    await expect(page.getByRole('dialog')).toBeVisible();
    await close(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(`/s/${SLUG}`);
    expect(hasParam(page)).toBe(false);
    expect(await marker(page)).toBe('still here');
  });
});

test.describe('1440: a panel button that goes away leaves the keyboard in the panel', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  const composer = (region: Locator) => region.getByRole('textbox', { name: 'Message to the assistant' });
  const open = async (page: Page) => {
    await page.goto(`/s/${SLUG}?assistant=1`);
    await settle(page);
    await replayTurns(page);
    return page.getByRole('complementary', { name: TITLE });
  };
  const escapeCloses = async (page: Page) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-assistant-dock]')).toHaveCount(0);
  };

  test('Start over: focus on the message box, and Esc still closes', async ({ page }) => {
    const region = await open(page);
    await orderThrough(region);
    await region.getByRole('button', { name: 'Start over' }).focus();
    await page.keyboard.press('Enter');
    await expect(composer(region)).toBeFocused();
    await escapeCloses(page);
  });

  test('the payment check: focus on the message box, and Esc still closes', async ({ page }) => {
    const region = await open(page);
    await orderThrough(region);
    await region.getByRole('button', { name: 'Did my payment go through?' }).focus();
    await page.keyboard.press('Enter');
    await expect(composer(region)).toBeFocused();
    await escapeCloses(page);
  });

  test('a starter: focus on the message box, and Esc still closes', async ({ page }) => {
    const region = await open(page);
    await region.locator('.overflow-y-auto button').first().focus();
    await page.keyboard.press('Enter');
    await expect(composer(region)).toBeFocused();
    await escapeCloses(page);
  });
});

test.describe('opening the dock at the top of the page', () => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 1060, height: 768 }, { width: 1440, height: 900 }]) {
    test(`${viewport.width}x${viewport.height}: the page stays at the top, by click, and the headers line up`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await page.locator('[data-hero-cta]').getByRole('button', { name: new RegExp(TITLE) }).click();
      await expect(page.locator('[data-assistant-dock]')).toBeVisible();
      await page.evaluate(() => new Promise(requestAnimationFrame));
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      // The dock's top row is its Assistant / Your order switch: that row lines up with the site header.
      const panelHeader = await box(page.locator('[data-assistant-dock] [data-dock-switch]'));
      const siteHeader = await box(page.locator('header').first());
      expect(Math.abs(panelHeader.y + panelHeader.height - (siteHeader.y + siteHeader.height))).toBeLessThanOrEqual(1);
      await page.getByRole('button', { name: 'Close the assistant' }).click();
      await expect(page.locator('[data-assistant-dock]')).toHaveCount(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });
  }
});

test.describe('a buyer message is as wide as its words', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`${viewport.width}: a short reply makes a short bubble at the right`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/s/${SLUG}?assistant=1`);
      await settle(page);
      await replayTurns(page);
      const region = viewport.width < 1024 ? page.getByRole('dialog', { name: TITLE }) : page.getByRole('complementary', { name: TITLE });
      const input = region.getByRole('textbox', { name: 'Message to the assistant' });
      await input.fill('Yes');
      await input.press('Enter');
      const bubble = region.locator('[role="log"] p', { hasText: /^Yes$/ });
      await expect(bubble).toBeVisible();
      const { text, right, logRight, width } = await bubble.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const b = el.getBoundingClientRect();
        return { text: range.getBoundingClientRect().width, width: b.width, right: b.right, logRight: el.closest('[role="log"]')!.getBoundingClientRect().right };
      });
      expect(width).toBeLessThanOrEqual(text + 28 + 2);
      expect(Math.abs(logRight - right)).toBeLessThanOrEqual(1);
    });
  }
});
