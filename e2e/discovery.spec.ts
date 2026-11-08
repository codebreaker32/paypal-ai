// The findable door (spec §10a): the shop page's JSON-LD and <link rel="alternate">, /agents.txt and /llms.txt, and the
// counter card (owner only, prints alone). Uses LABELLED TEST FIXTURE shops written to the e2e database and removed
// afterwards; no Claude or PayPal calls. The printed card is saved for a human look: data/discovery/counter-card.pdf
// (letter, as Chrome prints it with background graphics off) and counter-card-print.png.
//
// Run: E2E_PORT=3201 npx playwright test e2e/discovery.spec.ts   (screenshots of the card: e2e/screenshots.spec.ts)
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type BrowserContext } from '@playwright/test';
import { getDb } from '@/lib/db';
import * as shopsRepo from '@/lib/db/repos/shops';
import { qrSvg } from '@/lib/discovery/qr';
import type { Shop } from '@/lib/domain/types';
import { DESKTOP, PHONE, appNav, settle } from './helpers';
import { createFixtureShop, type FixtureShop } from './task8-fixtures';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve(__dirname, '..', 'data', 'discovery');

let live: FixtureShop;
let paused: FixtureShop;
let noPayee: FixtureShop;
let draft: { shop: Shop; ownerToken: string };

const shopUrl = (s: Shop) => `${BASE}/s/${s.slug}`;
const doorUrl = (s: Shop) => `${BASE}/s/${s.slug}/mcp`;

async function signIn(context: BrowserContext, shopId: string, token: string) {
  await context.addCookies([{ name: `shelfie_owner_${shopId}`, value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }]);
}

test.beforeAll(() => {
  const db = getDb();
  db.prepare("DELETE FROM shops WHERE name LIKE 'Findable %'").run(); // an earlier run that stopped half-way
  live = createFixtureShop('Findable Door Bakery');
  paused = createFixtureShop('Findable Paused Pies');
  shopsRepo.update(db, paused.shop.id, { status: 'paused' });
  noPayee = createFixtureShop('Findable Unpaid Bagels', { payeeEmail: null }); // live, but can't be paid: refuses every order
  draft = shopsRepo.create(db, { name: 'Findable Draft Deli' });
  fs.mkdirSync(OUT, { recursive: true });
});

test.afterAll(() => {
  getDb().prepare("DELETE FROM shops WHERE name LIKE 'Findable %'").run();
});

test.describe('shop page, for agents that read it', () => {
  test('the raw HTML carries the agent door in <head> and as a schema.org OrderAction', async ({ request }) => {
    const html = await (await request.get(`/s/${live.shop.slug}`)).text();
    const head = html.slice(0, html.indexOf('</head>'));
    const alternate = head.match(/<link[^>]*rel="alternate"[^>]*>/g) ?? [];
    expect(alternate.find((l) => l.includes(`href="${doorUrl(live.shop)}"`))).toMatch(/type="application\/json"/);
    expect(alternate.find((l) => l.includes(`href="${doorUrl(live.shop)}"`))).toContain('title="Agent door (MCP)"');

    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1]));
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({
      '@type': 'FoodEstablishment',
      name: 'Findable Door Bakery',
      url: shopUrl(live.shop),
      paymentAccepted: 'PayPal',
      potentialAction: { '@type': 'OrderAction', target: { urlTemplate: doorUrl(live.shop), httpMethod: 'POST' } },
    });
    // The page says it in words too, beside the door's address.
    expect(html.replaceAll('<!-- -->', '')).toContain('can read Findable Door Bakery’s menu and place an order through this address');
  });

  test('a paused shop keeps its menu in JSON-LD but offers no OrderAction', async ({ page }) => {
    await page.goto(`/s/${paused.shop.slug}`);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld.hasMenu.hasMenuSection.length).toBeGreaterThan(0);
    expect(ld).not.toHaveProperty('potentialAction');
  });

  test('a shop that isn’t taking orders (paused, or no PayPal email) has no agent door <link> either', async ({ request }) => {
    for (const shop of [paused.shop, noPayee.shop]) {
      const html = await (await request.get(`/s/${shop.slug}`)).text();
      const head = html.slice(0, html.indexOf('</head>'));
      expect(head, shop.name).not.toMatch(/<link[^>]*rel="alternate"/);
      expect(html, shop.name).toContain('application/ld+json');
      // The door's section stays (it still answers questions about the menu) but doesn't offer ordering.
      expect(html, shop.name).toContain('This shop isn’t taking orders right now.');
      expect(html, shop.name).not.toContain('place an order through this address');
      expect(html, shop.name).toContain(doorUrl(shop));
    }
  });
});

test.describe('discovery files', () => {
  for (const file of ['agents.txt', 'llms.txt']) {
    test(`/${file} lists live shops with their agent doors, as plain text`, async ({ request }) => {
      const res = await request.get(`/${file}`);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('text/plain; charset=utf-8');
      const text = await res.text();
      expect(text).toContain('Findable Door Bakery');
      expect(text).toContain(doorUrl(live.shop));
      expect(text).toContain(`${BASE}/s/<slug>/mcp`);
      expect(text).not.toContain('Findable Paused Pies');
      expect(text).not.toContain('Findable Unpaid Bagels');
      expect(text).not.toContain('Findable Draft Deli');
    });
  }
});

test.describe('counter card', () => {
  test('is for the shop’s owner only', async ({ page, context }) => {
    expect((await page.goto(`/shops/${live.shop.id}/card`))?.status()).toBe(404);
    await signIn(context, paused.shop.id, paused.ownerToken); // owning another shop doesn't help
    expect((await page.goto(`/shops/${live.shop.id}/card`))?.status()).toBe(404);
  });

  test('shows the shop link as a QR code, the link itself and the agent door', async ({ page, context }) => {
    await signIn(context, live.shop.id, live.ownerToken);
    await page.goto(`/shops/${live.shop.id}/card`);
    await expect(page.getByRole('heading', { level: 1, name: 'Counter card' })).toBeVisible();
    const card = page.getByRole('article', { name: 'Findable Door Bakery' });
    await expect(card).toContainText('Order ahead with any AI assistant, pay with PayPal');
    await expect(card.getByTestId('card-shop-url')).toHaveText(`localhost:${PORT}/s/${live.shop.slug}`);
    await expect(card.getByTestId('card-door-url')).toHaveText(doorUrl(live.shop));
    // The QR is the absolute shop link (the same modules qrcode draws for it here).
    const expected = (await qrSvg(shopUrl(live.shop))).match(/<path[^>]*stroke[^>]*d="([^"]+)"/)![1];
    await expect(card.getByRole('img', { name: `QR code that opens localhost:${PORT}/s/${live.shop.slug}` }).locator('path[stroke]')).toHaveAttribute('d', expected);
    // One primary action, and the way back.
    await expect(page.getByRole('button', { name: 'Print card' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Share' })).toHaveAttribute('href', `/shops/${live.shop.id}?tab=share`);
  });

  test('a draft shop has no card yet (its address changes at first publish): no QR, no links, no Print', async ({ page, context }) => {
    await signIn(context, draft.shop.id, draft.ownerToken);
    await page.goto(`/shops/${draft.shop.id}/card`);
    await expect(page.getByText('Your counter card is ready once your shop is live.')).toBeVisible();
    await expect(page.locator('#app-content').getByRole('link', { name: 'Finish setting up' })).toHaveAttribute('href', `/shops/${draft.shop.id}/setup`);
    await expect(page.getByTestId('card-qr')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Print card' })).toHaveCount(0);
    expect(await page.content()).not.toContain(draft.shop.slug);
  });

  test('prints the card alone, on one page', async ({ page, context }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(context, live.shop.id, live.ownerToken);
    await page.goto(`/shops/${live.shop.id}/card`);
    await settle(page);
    await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
    await expect(page.getByRole('article', { name: 'Findable Door Bakery' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Counter card' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Print card' })).toBeHidden();
    await expect(page.locator('body > header')).toBeHidden();
    await expect(page.locator('body > footer')).toBeHidden();
    await page.screenshot({ path: path.join(OUT, 'counter-card-print.png'), fullPage: true });

    // Chrome's print dialog defaults: letter, 0.4 in margins, background graphics off (the card prints its own colours).
    const margin = '0.4in';
    const pdf = await page.pdf({
      path: path.join(OUT, 'counter-card.pdf'),
      format: 'Letter',
      margin: { top: margin, right: margin, bottom: margin, left: margin },
    });
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? [];
    expect(pages).toHaveLength(1);
  });
});

test.describe('Share tab', () => {
  test.use({ viewport: PHONE });

  test('links to the counter card, and copying the agent door stays the one primary action', async ({ page, context }) => {
    await signIn(context, live.shop.id, live.ownerToken);
    await page.goto(`/shops/${live.shop.id}?tab=share`);
    const block = page.getByRole('region', { name: 'Counter card' });
    await expect(block).toBeVisible();
    await block.getByRole('link', { name: 'Print counter card' }).click();
    await expect(page).toHaveURL(`${BASE}/shops/${live.shop.id}/card`);
    await expect(page.getByRole('heading', { level: 1, name: 'Counter card' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to Share' }).click();
    await expect(appNav(page).getByRole('link', { name: 'Share' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Copy agent door link' })).toBeVisible();
  });
});
