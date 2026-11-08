// The assistant's three surfaces: where the box sits at each width, at every scroll position and with any amount of
// conversation (spec 2026-11-08 production pass, WP2 acceptance). The console's stream is replayed from a recorded run,
// so no Claude or PayPal calls happen here.
//
// Run: E2E_PORT=3211 npx playwright test e2e/assistant-layout.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as itemsRepo from '../src/lib/db/repos/items';
import * as shopsRepo from '../src/lib/db/repos/shops';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { settle } from './helpers';

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
}

test.describe('docked from 1024 px', () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
    test(`${viewport.width}x${viewport.height}: edge to edge at any scroll`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/s/${SLUG}?assistant=1`);
      await settle(page);
      for (const to of [0, 0.5, 1]) {
        await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * f), to);
        await expectDocked(page);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const panelHeader = await box(page.locator('[data-assistant-header]'));
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
    test(`${width}: the logo stays within 8 px between closed and open`, async ({ page }) => {
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

  test('1440: after a replayed order, the payment check and Start over sit outside the scroller', async ({ page }) => {
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
  }
}

test.describe('phone: bottom sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('390x844: y 12 to 844 for empty and full conversation; focus on the heading', async ({ page }) => {
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

  test('390x480: the composer stays inside the screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 480 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    await page.locator('[data-order-bar] button').click();
    const dialog = page.getByRole('dialog', { name: TITLE });
    await expect(dialog).toBeVisible();
    const send = await box(dialog.getByRole('button', { name: 'Send' }));
    expect(send.y + send.height).toBeLessThanOrEqual(480);
  });
});

test('768x1024: full-height side sheet at the right edge', async ({ page }) => {
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

test('reduced motion: the dock and sheet sit still', async ({ page }) => {
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

  test('1440, closed: no side card, and exactly one button at the top, mid page and the end', async ({ page }) => {
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
