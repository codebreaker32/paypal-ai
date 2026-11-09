// The shop page's first screen and item tile (spec 2026-11-08 production pass WP3, addendum section 2): tracks at each
// width and with the dock open, the orphan tile, what fits on the first screen, tap targets and the tile's states.
//
// Run: E2E_PORT=3231 npx playwright test e2e/tiles.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as itemsRepo from '../src/lib/db/repos/items';
import * as shopsRepo from '../src/lib/db/repos/shops';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { a11y, DESKTOP, PHONE, settle, smallTargets } from './helpers';

const SLUG = DEMO_SHOP.slug;
const FIXTURE_NAME = 'E2E Tiles Shop';
const PAUSED_NAME = 'E2E Tiles Paused Shop';
let fixtureSlug = '';
let pausedSlug = '';

const draft = (section: string, name: string, variants: { label: string | null; priceCents: number | null }[]) => ({
  section, name, description: 'Made this morning.', sourceText: name, confidence: 'high' as const, kind: 'PHYSICAL' as const, issues: [],
  issueDetail: null, status: 'draft' as const, variants,
});

const seedShop = (name: string, drafts: ReturnType<typeof draft>[]) => {
  const db = getDb();
  for (const o of db.prepare('SELECT id FROM shops WHERE name = ?').all(name) as { id: string }[]) db.prepare('DELETE FROM shops WHERE id = ?').run(o.id);
  const { shop } = shopsRepo.create(db, { name, about: 'A test shop.', fulfillment: 'pickup', pickupNotes: 'Fridays' });
  const items = itemsRepo.replaceDrafts(db, shop.id, drafts);
  items.forEach((item, n) => itemsRepo.setPayPalProductId(db, item.id, `PROD-E2E-TILES-${shop.id}-${n}`));
  shopsRepo.publish(db, shop.id);
  shopsRepo.update(db, shop.id, { payeeEmail: 'seller@example.com' });
  return { db, shop, items };
};

test.beforeAll(async () => {
  const db = getDb();
  if (!shopsRepo.bySlug(db, SLUG)) await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir: getConfig().uploadsDir });

  const one = { label: null, priceCents: 350 };
  const section = (name: string, n: number) => Array.from({ length: n }, (_, i) => draft(name, `${name} item ${i + 1}`, [one]));
  const seeded = seedShop(FIXTURE_NAME, [
    ...section('One', 1),
    ...section('Three', 3),
    ...section('Five', 5),
    ...section('Seven', 7),
    draft('States', 'Two options', [{ label: 'S', priceCents: 300 }, { label: 'L', priceCents: 400 }]),
    draft('States', 'Three options', [{ label: 'S', priceCents: 300 }, { label: 'M', priceCents: 350 }, { label: 'L', priceCents: 400 }]),
    draft('States', 'Sold out one', [one]),
    draft('States', 'In person one', [{ label: null, priceCents: null }]),
  ]);
  fixtureSlug = seeded.shop.slug;
  const byName = (name: string) => seeded.items.find((i) => i.name === name)!;
  itemsRepo.update(db, byName('Sold out one').id, { soldOut: true });
  itemsRepo.update(db, byName('In person one').id, { status: 'in_person' });

  const paused = seedShop(PAUSED_NAME, section('Today', 3));
  pausedSlug = shopsRepo.update(db, paused.shop.id, { status: 'paused' }).slug;
});

test.afterAll(() => {
  const db = getDb();
  for (const name of [FIXTURE_NAME, PAUSED_NAME]) {
    for (const o of db.prepare('SELECT id FROM shops WHERE name = ?').all(name) as { id: string }[]) db.prepare('DELETE FROM shops WHERE id = ?').run(o.id);
  }
});

const tracks = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll('.menu-grid')).map((g) => getComputedStyle(g).gridTemplateColumns.trim().split(/\s+/).length));

const photos = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-menu-item] .tile-photo')).map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, top: r.top, bottom: r.bottom, orphan: el.parentElement!.matches(':last-child:nth-child(odd)') };
    }),
  );

test.describe('at 390', () => {
  test.use({ viewport: PHONE });

  test('two tracks, and normal tile photos are 169 x 127 (1)', async ({ page }) => {
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    expect(new Set(await tracks(page))).toEqual(new Set([2]));
    const normal = (await photos(page)).filter((p) => !p.orphan);
    expect(normal.length).toBeGreaterThan(0);
    for (const p of normal) {
      expect(Math.abs(p.w - 169)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.h - 127)).toBeLessThanOrEqual(1);
    }
  });

  test('sections of 1, 3, 5 and 7 tiles end at the grid edge (3)', async ({ page }) => {
    await page.goto(`/s/${fixtureSlug}`);
    await settle(page);
    const gaps = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.menu-grid')).map((g) => {
        const last = g.lastElementChild!.getBoundingClientRect();
        return Math.abs(g.getBoundingClientRect().right - last.right);
      }),
    );
    expect(gaps.length).toBeGreaterThan(3);
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(1);
  });

  test('two tile photos fit above the order bar on the demo shop (4)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    const bar = (await page.locator('[data-order-bar]').boundingBox())!;
    const above = (await photos(page)).filter((p) => p.top >= 0 && p.bottom <= bar.y);
    expect(above.length).toBeGreaterThanOrEqual(2);
  });

  test('no small targets in main, and the grid is axe clean (8)', async ({ page }) => {
    await page.goto(`/s/${fixtureSlug}`);
    await settle(page);
    expect(await smallTargets(page)).toEqual([]);
    await a11y(page);
  });

  test('the price list link sits in the avatar row with its 32 px thumb', async ({ page }) => {
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    const link = page.getByRole('link', { name: /price list Marigold Bakehouse was made from/ });
    const box = (await link.boundingBox())!;
    const thumb = (await link.getByRole('img').boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(thumb.width).toBe(32);
    expect(box.x + box.width).toBeGreaterThan(360);
    const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(h1.y);
  });
});

test.describe('at 1440', () => {
  test.use({ viewport: DESKTOP });

  test('four tracks closed, three docked, every photo the same width (2)', async ({ page }) => {
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    expect(new Set(await tracks(page))).toEqual(new Set([4]));
    const widths = (await photos(page)).map((p) => p.w);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);

    await page.goto(`/s/${SLUG}?assistant=1`);
    await settle(page);
    await expect(page.locator('[data-assistant-dock]')).toBeVisible();
    await expect.poll(() => tracks(page)).toEqual(expect.arrayContaining([3]));
    expect(new Set(await tracks(page))).toEqual(new Set([3]));
    const docked = (await photos(page)).map((p) => p.w);
    expect(Math.max(...docked) - Math.min(...docked)).toBeLessThanOrEqual(1);
  });

  test('the first row of photos is fully on screen at 1440 x 900 (4)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    const all = await photos(page);
    const first = all.filter((p) => Math.abs(p.top - all[0].top) < 1);
    expect(first.length).toBeGreaterThan(0);
    for (const p of first) expect(p.bottom).toBeLessThanOrEqual(900);
  });

  test('the tile states', async ({ page }) => {
    await page.goto(`/s/${fixtureSlug}`);
    await settle(page);
    const tile = (name: string) => page.locator(`[data-menu-item="${name}"]`);
    await expect(tile('Sold out one')).toContainText('Sold out today');
    await expect(tile('Sold out one').locator('[data-add-control]')).toHaveCount(0);
    await expect(tile('In person one')).toContainText('Ask in person');
    await expect(tile('In person one').locator('[data-add-control]')).toHaveCount(0);
    await expect(tile('Two options')).toContainText('$3.00');
    await expect(tile('Two options')).toContainText('$4.00');
    await expect(tile('Three options')).toContainText('From $3.00 · 3 options');
    for (const name of ['Two options', 'Three options', 'Sold out one', 'In person one']) {
      await expect(tile(name).getByRole('heading', { level: 4 }).getByRole('button')).toHaveAttribute('aria-haspopup', 'dialog');
    }
    // The add control is above the tile's stretched button: a click at its centre reaches it, and it fits in the photo.
    const add = tile('Two options').locator('[data-add-control] button');
    await add.scrollIntoViewIfNeeded();
    const box = (await add.boundingBox())!;
    expect(box.width).toBe(44);
    expect(box.height).toBe(44);
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'), { x: box.x + 22, y: box.y + 22 });
    expect(hit).toBe('Choose options for Two options');
  });
});

test('a paused shop has no add controls, and its prices still show', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(`/s/${pausedSlug}`);
  await settle(page);
  await expect(page.locator('[data-add-control]')).toHaveCount(0);
  await expect(page.locator('[data-menu-item]').first()).toContainText('$3.50');
});

test.describe('a tile opens the sheet (addendum: 5 and 6)', () => {
  test.use({ viewport: PHONE });
  const sheet = (page: Page) => page.locator('dialog[open]');
  const open = (page: Page, name: string) => page.locator(`[data-menu-item="${name}"] h4 button`).click();
  const ready = (page: Page) =>
    page.waitForFunction(() => {
      const el = document.querySelector('li[data-menu-item] h4 button');
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber'));
    });

  test('on the demo shop a tile opens the sheet, and + adds with no sheet and no assistant call', async ({ page }) => {
    let sent = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/assistant')) sent += 1;
    });
    await page.goto(`/s/${SLUG}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await ready(page);
    await open(page, 'Almond croissant');
    await expect(sheet(page).getByRole('heading', { name: 'Almond croissant' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveCount(0);
    await page.locator('[data-menu-item="Almond croissant"]').getByRole('button', { name: 'Add Almond croissant to your order' }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator('[data-order-bar]').getByRole('button', { name: /View order · 1/ })).toBeVisible();
    expect(sent).toBe(0);
  });

  test('a two-option + opens the sheet with the first option chosen, on 48 px rows', async ({ page }) => {
    await page.goto(`/s/${fixtureSlug}`);
    await ready(page);
    await page.getByRole('button', { name: 'Choose options for Two options' }).click();
    const group = sheet(page).getByRole('group', { name: 'Choose one' });
    await expect(group.getByRole('radio')).toHaveCount(2);
    await expect(group.getByRole('radio').first()).toBeChecked();
    for (const row of await group.locator('label').all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  });

  for (const [name, line] of [
    ['Sold out one', 'Sold out today.'],
    ['In person one', 'Ask in person: the shop sets this price on the day.'],
  ] as const) {
    test(`${name} opens the sheet, which ends in one plain line`, async ({ page }) => {
      await page.goto(`/s/${fixtureSlug}`);
      await ready(page);
      await expect(page.locator(`[data-menu-item="${name}"] [data-add-control]`)).toHaveCount(0);
      await open(page, name);
      await expect(sheet(page)).toContainText(line);
      await expect(sheet(page).getByRole('button', { name: /^Add to order/ })).toHaveCount(0);
    });
  }

  test('a paused shop’s tile opens the sheet, which says it is not taking orders', async ({ page }) => {
    await page.goto(`/s/${pausedSlug}`);
    await ready(page);
    await open(page, 'Today item 1');
    await expect(sheet(page)).toContainText('Not taking orders right now.');
    await expect(sheet(page).getByRole('button', { name: /^Add to order/ })).toHaveCount(0);
  });
});

test('at 1024 docked the menu has two tracks (2)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(`/s/${SLUG}?assistant=1`);
  await settle(page);
  await expect(page.locator('[data-assistant-dock]')).toBeVisible();
  await expect.poll(() => tracks(page)).toEqual(expect.arrayContaining([2]));
  expect(new Set(await tracks(page))).toEqual(new Set([2]));
});
