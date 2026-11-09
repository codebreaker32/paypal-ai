// Screenshots for judging: every screen at 390×844 and 1440×900 into SCREENSHOTS_DIR (default data/screenshots/, which
// is gitignored, so a plain run never overwrites a committed round), each checked with axe (WCAG 2.1 A/AA). Serious or
// critical violations fail the test; every violation found is written to axe-results.json in the same folder.
//
// One story across the set: the demo shop Marigold Bakehouse (scripts/seed-demo.ts, here with a fake PayPal), its
// menu read from public/samples/marigold-bakehouse.jpg. States that are slow to reach live (paid, shipped, expired,
// a held reading) are LABELLED TEST FIXTURES written straight to the e2e database (e2e/task8-fixtures.ts); their
// PayPal ids start with "E2E". The console conversation is replayed from a real recorded run
// (e2e/fixtures/console-turns.json). No Claude or PayPal calls happen here.
//
// The in-between states (publishing, a publish that partly failed, the console thinking, rate-limited or failing,
// tracking PayPal refused, the dashboard loading) are MOCKED in the browser: Playwright answers those requests instead
// of the server (page.route, streamThenHold for a stream that stays open, holdNavigation for a page request that never
// answers). Each one is listed in the screenshots README (dashboard-loading: NOTES-dashboard-loading.md).
//
// Run: E2E_PORT=3111 npx playwright test e2e/screenshots.spec.ts   (or: npm run screenshots)
// SCREENSHOTS_DIR=docs/judge/screenshots/round-4 writes a judged round's set (npm run screenshots:prod does this).
import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import { recordedReading } from '@/lib/ai/samples';
import { itemsToPublish, publishShop, sellerMessageFor } from '@/lib/catalog/publish';
import { createShopFromPhotos, createShopFromSample, runReading } from '@/lib/catalog/setup';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as extractions from '@/lib/db/repos/extractions';
import * as itemsRepo from '@/lib/db/repos/items';
import * as ordersRepo from '@/lib/db/repos/orders';
import * as shopsRepo from '@/lib/db/repos/shops';
import type { MenuExtraction } from '@/lib/ai/schemas';
import type { Order, OrderBrief } from '@/lib/domain/types';
import { createFakePayPal } from '@/lib/paypal/fake';
import { PayPalApiError } from '@/lib/paypal/types';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { DESKTOP, PHONE, appNav, holdNavigation, samplePhoto, settle, streamThenHold } from './helpers';
import { E2E_DB, FIXTURE_PAYEE, addFixtureOrder, createFixtureShop, fixtureFromShop, type FixtureShop } from './task8-fixtures';

const OUT = process.env.SCREENSHOTS_DIR
  ? path.resolve(process.env.SCREENSHOTS_DIR)
  : path.resolve(__dirname, '..', 'data', 'screenshots');
const AXE_FILE = path.join(OUT, 'axe-results.json');
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const SLUG = DEMO_SHOP.slug;
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'console-turns.json'), 'utf8')) as {
  prompts: string[];
  turns: Record<string, unknown>[][];
};

// ---- fixtures -------------------------------------------------------------------------------------------------

interface Setup {
  shopId: string;
  ownerToken: string;
}
let demo: FixtureShop;
let empty: FixtureShop;
/** A second Marigold Bakehouse (fixture) for an order paid moments ago, kept off the demo shop's dashboard. */
let briefShop: FixtureShop;
const orders = {} as Record<'nut' | 'pickup' | 'waiting' | 'pending' | 'shipped' | 'pickedUp' | 'cancelled' | 'expired' | 'refused', Order>;
const setups = {} as Record<'reading' | 'review' | 'retake' | 'failed' | 'live' | 'publish', Setup>;
/** Orders on briefShop paid into the seller's own PayPal account (spec §8a). */
const sellerOrders = {} as Record<'paid' | 'held', Order>;

const AUSTIN = { name: 'Dana Whitfield', line1: '2104 E 6th St', line2: 'Apt 3', city: 'Austin', state: 'TX', postalCode: '78702', countryCode: 'US' };

/** The brief the Claude brief agent wrote for this order shape (fixture copy). */
const NUT_BRIEF: OrderBrief = {
  headline: 'Ship 2 almond croissants + 1 sourdough loaf to Austin, TX',
  prep_list: [
    { text: 'Almond croissant', qty: 2 },
    { text: 'Country sourdough loaf', qty: 1 },
  ],
  buyer_requests: [
    { kind: 'allergy', text: 'Nut allergy in the house' },
    { kind: 'timing', text: 'Would like it by Friday' },
  ],
  flags: [
    { severity: 'warn', text: 'Buyer mentions a nut allergy, but almond croissants contain nuts. Check with the buyer before shipping.' },
    { severity: 'info', text: "PayPal's amount matches the order: $19.00 items + $8.00 shipping." },
  ],
  next_action: 'contact_buyer',
};

function seedDemoOrders(f: FixtureShop) {
  const db = getDb();
  orders.nut = addFixtureOrder(f, {
    status: 'paid', fulfillment: 'shipping', minutesAgo: 6, buyerName: 'Dana',
    buyerNote: 'Nut allergy in the house. Would love it by Friday!',
    lines: [['Almond croissant', 2], ['Country sourdough loaf', 1]],
    payer: { name: 'Dana Whitfield', email: 'dana.whitfield@example.com' }, shipTo: AUSTIN,
    brief: { brief: NUT_BRIEF, source: 'agent' },
  });
  orders.pickup = addFixtureOrder(f, {
    status: 'paid', fulfillment: 'pickup', minutesAgo: 25, buyerName: 'Sam', agentName: 'shelfie-assistant',
    lines: [['Cardamom bun', 3], ['Drip coffee', 2]],
    payer: { name: 'Sam Ortega', email: 'sam.ortega@example.com' },
    brief: {
      source: 'agent',
      brief: {
        headline: 'Pickup Saturday: 3 cardamom buns + 2 small drip coffees',
        prep_list: [{ text: 'Cardamom bun', qty: 3 }, { text: 'Drip coffee (S)', qty: 2 }],
        buyer_requests: [], flags: [], next_action: 'prepare',
      },
    },
  });
  orders.waiting = addFixtureOrder(f, { status: 'awaiting_approval', fulfillment: 'shipping', minutesAgo: 3, buyerName: 'Lee', lines: [['Almond croissant', 2], ['Country sourdough loaf', 1]] });
  orders.pending = addFixtureOrder(f, {
    status: 'payment_pending', fulfillment: 'shipping', minutesAgo: 9, buyerName: 'Jo', lines: [['Seeded rye', 2]],
    payer: { name: 'Jo Park', email: 'jo.park@example.com' }, shipTo: { ...AUSTIN, name: 'Jo Park', line1: '88 Oak Ln', line2: null, city: 'Round Rock', postalCode: '78664' },
  });
  orders.shipped = addFixtureOrder(f, {
    status: 'fulfilled', fulfillment: 'shipping', minutesAgo: 26 * 60, buyerName: 'Maya',
    lines: [['Focaccia – rosemary & sea salt', 2], ['Butter croissant', 2]],
    payer: { name: 'Maya Chen', email: 'maya.chen@example.com' }, shipTo: { ...AUSTIN, name: 'Maya Chen', line1: '501 Congress Ave', line2: null, postalCode: '78701' },
    brief: {
      source: 'agent',
      brief: {
        headline: 'Ship 2 focaccia + 2 butter croissants to Austin, TX',
        prep_list: [{ text: 'Focaccia – rosemary & sea salt', qty: 2 }, { text: 'Butter croissant', qty: 2 }],
        buyer_requests: [], flags: [], next_action: 'ship',
      },
    },
    tracking: { carrier: 'USPS', trackingNumber: '9400111899223197428490' },
  });
  orders.pickedUp = addFixtureOrder(f, {
    status: 'fulfilled', fulfillment: 'pickup', minutesAgo: 27 * 60, buyerName: 'Ana', lines: [['Pain au chocolat', 2]],
    payer: { name: 'Ana Ruiz', email: 'ana.ruiz@example.com' },
  });
  orders.cancelled = addFixtureOrder(f, { status: 'cancelled', fulfillment: 'pickup', minutesAgo: 28 * 60, lines: [['Butter croissant', 2]] });
  orders.expired = addFixtureOrder(f, { status: 'expired', fulfillment: 'shipping', minutesAgo: 30 * 60, lines: [['Almond croissant', 2], ['Country sourdough loaf', 1]] });
  // Approved, but PayPal refused the capture for a reason retrying won't fix.
  orders.refused = addFixtureOrder(f, { status: 'awaiting_approval', fulfillment: 'shipping', minutesAgo: 2, lines: [['Almond croissant', 2], ['Country sourdough loaf', 1]] });
  ordersRepo.casStatus(db, orders.refused.id, 'awaiting_approval', 'approved');
  eventsRepo.add(db, orders.refused.id, 'capture_failed', 'return_url', { status: 422, issue: 'TRANSACTION_REFUSED', debugId: 'E2E' });
}

/**
 * A draft shop as a visitor makes it from the Start page (the Marigold sample, or `photo` from public/samples),
 * read with `raw` without Claude: an Error fails the reading and null leaves it running.
 */
async function sampleShop(raw: MenuExtraction | Error | null, photo?: string): Promise<Setup> {
  const db = getDb();
  const { shop, ownerToken } = photo
    ? await createShopFromPhotos(db, [samplePhoto(photo).buffer])
    : await createShopFromSample(db, 'marigold-bakehouse');
  if (raw === null) {
    extractions.start(db, shop.id, 'claude-sonnet-5-5'); // a reading that is still running
  } else {
    await runReading({ db, hasAiKey: true, extract: async () => { if (raw instanceof Error) throw raw; return raw; } }, shop.id);
  }
  return { shopId: shop.id, ownerToken };
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  expect(path.resolve(getConfig().databasePath)).toBe(path.resolve(E2E_DB));
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(AXE_FILE)) fs.writeFileSync(AXE_FILE, '{}\n');
  const db = getDb();
  // Earlier runs' sample shops: without them the published sample is marigold-bakehouse-2, as on a fresh install.
  db.prepare("DELETE FROM shops WHERE name = 'Marigold Bakehouse' AND slug != ?").run(SLUG);

  // One fake PayPal for every publish here: product ids are unique across the database.
  const paypal = createFakePayPal();
  const seeded = await seedDemoShop({ db, paypal, uploadsDir: getConfig().uploadsDir, reset: true });
  demo = fixtureFromShop(seeded.shop, seeded.ownerToken!);
  demoPhotos(seeded.shop.id);
  seedDemoOrders(demo);
  empty = createFixtureShop('Tía Lupe Tacos');

  const recorded = recordedReading('marigold-bakehouse');
  setups.reading = await sampleShop(null);
  setups.review = await sampleShop(recorded);
  // A photo that really isn't a price list (a coffee cup and a plant), so the retake screen doesn't show a menu.
  setups.retake = await sampleShop(
    JSON.parse(fs.readFileSync(path.resolve(__dirname, '../tests/ai/fixtures/not-a-menu.json'), 'utf8')) as MenuExtraction,
    'coffee-and-plant.jpg',
  );
  setups.failed = await sampleShop(new Error('Request timed out.'));
  setups.live = await sampleShop(recorded);
  sellerChecked(setups.live.shopId);
  shopsRepo.update(db, setups.live.shopId, { payeeEmail: FIXTURE_PAYEE }); // publishing needs the seller's PayPal email
  await publishShop({ db, paypal }, setups.live.shopId);
  // Created after the others so their slugs stay as on a fresh install.
  setups.publish = await sampleShop(recorded);
  sellerChecked(setups.publish.shopId); // ready to publish; the publish itself is mocked per screen
  shopsRepo.update(db, setups.publish.shopId, { payeeEmail: FIXTURE_PAYEE });
  briefShop = createFixtureShop('Marigold Bakehouse');
  seedSellerPaidOrders(briefShop);
});

/**
 * FIXTURE: the demo shop's photos, if the seed hasn't set them. Each item gets `/demo/<slug>/<item-name-slug>.jpg` and the
 * shop `/demo/<slug>/cover.jpg`, whenever that file is in public/. Sample-menu shops stay photo-less (the fallback).
 */
function demoPhotos(shopId: string) {
  const db = getDb();
  const dir = path.resolve(__dirname, '..', 'public', 'demo', SLUG);
  const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const shop = shopsRepo.byId(db, shopId)!;
  if (!shop.coverUrl && fs.existsSync(path.join(dir, 'cover.jpg'))) shopsRepo.update(db, shopId, { coverUrl: `/demo/${SLUG}/cover.jpg` });
  for (const item of itemsRepo.listWithVariants(db, shopId)) {
    const file = `${slugify(item.name)}.jpg`;
    if (!item.photoUrl && fs.existsSync(path.join(dir, file))) itemsRepo.update(db, item.id, { photoUrl: `/demo/${SLUG}/${file}` });
  }
}

/**
 * Orders paid into the seller's own PayPal account (spec §8a), on the second Marigold Bakehouse (a seller's shop, paid
 * to FIXTURE_PAYEE): one paid, and one PayPal holds because it was made while her email had a typo (UNILATERAL).
 */
function seedSellerPaidOrders(f: FixtureShop) {
  sellerOrders.paid = addFixtureOrder(f, {
    status: 'paid', fulfillment: 'pickup', minutesAgo: 12, buyerName: 'Sam', lines: [['Almond croissant', 2], ['Drip coffee', 1]],
    payer: { name: 'Sam Ortega', email: 'sam.ortega@example.com' },
  });
  sellerOrders.held = addFixtureOrder(f, {
    status: 'payment_pending', fulfillment: 'pickup', minutesAgo: 40, buyerName: 'Lu', lines: [['Morning bun', 3]],
    payeeEmail: 'rosa@exmaple.com', pendingReason: 'UNILATERAL', payer: { name: 'Lu Chen', email: 'lu.chen@example.com' },
  });
}

/** What a seller does on review: "Looks right" on the checks, "Ask in person" on the market price. */
function sellerChecked(shopId: string) {
  const db = getDb();
  for (const item of itemsRepo.listWithVariants(db, shopId)) {
    if (!item.issues.length) continue;
    itemsRepo.update(db, item.id, { issues: [], issueDetail: null, ...(item.issues.includes('MARKET_PRICE') ? { status: 'in_person' as const } : {}) });
  }
}

test.afterAll(() => {
  const reading = extractions.latest(getDb(), setups.reading?.shopId ?? '');
  if (reading?.status === 'running') extractions.fail(getDb(), reading.id, 'AI_ERROR: screenshots done');
});

// ---- capture + axe --------------------------------------------------------------------------------------------

/**
 * The e2e server runs without the order poller (SHELFIE_TEST), so open fixture orders look unchecked after a few
 * minutes and the dashboard rightly shows "We can't reach PayPal". Stamp them as just checked, as the poller would.
 */
function pollerJustChecked() {
  getDb().prepare('UPDATE orders SET last_checked_at = ? WHERE shop_id = ?').run(new Date().toISOString(), demo.shop.id);
}

/** The opposite (fixture): PayPal last answered the poller `minutes` ago, so open orders look unchecked. */
function pollerStalled(minutes: number) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  getDb().prepare('UPDATE orders SET last_checked_at = MAX(created_at, ?) WHERE shop_id = ?').run(since, demo.shop.id);
}

/**
 * Picks a photo for Snap your counter and waits for its sheet. A file set before React has hydrated the Menu tab loses
 * its change event (the sheet never opens) and stays in the input, and Chromium fires no change for the same file
 * again, so each try clears the input first.
 */
async function snapCounter(page: Page, file: string) {
  const input = page.locator('input[aria-label="Snap your counter"]');
  await expect(async () => {
    await input.setInputFiles([]);
    await input.setInputFiles(file);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
}

async function signIn(context: BrowserContext, shopId: string, token: string) {
  await context.addCookies([{ name: `shelfie_owner_${shopId}`, value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }]);
}

interface AxeRecord {
  violations: { id: string; impact: string | null; help: string; nodes: string[] }[];
}

/** Settles the page, saves the screenshot, and runs axe; serious or critical violations fail the test. */
async function capture(page: Page, name: string, fullPage = true) {
  await settle(page);
  await page.waitForFunction(() => Array.from(document.images).filter((i) => i.checkVisibility()).every((i) => i.complete && i.naturalWidth > 0));
  // A full-page capture would freeze the review's sticky publish bar mid-page; show it where it rests instead.
  const unstick = fullPage ? await page.addStyleTag({ content: '[data-publish-bar] { position: static !important; }' }) : null;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage, animations: 'disabled' });
  await unstick?.evaluate((el) => (el as Element).remove());

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const record: AxeRecord = {
    violations: results.violations.map((v) => ({ id: v.id, impact: v.impact ?? null, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) })),
  };
  const all = JSON.parse(fs.readFileSync(AXE_FILE, 'utf8')) as Record<string, AxeRecord & { passes: number }>;
  all[name] = { passes: results.passes.length, ...record };
  fs.writeFileSync(AXE_FILE, JSON.stringify(Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
  const serious = record.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.join(', ')})`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

// ---- console replay -------------------------------------------------------------------------------------------

const ndjson = (events: Record<string, unknown>[]) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

const RECORDED_NUMBER = (FIXTURE.turns.flat().find((e) => e.type === 'approval') as { orderNumber: string }).orderNumber;

/** Replays the recorded conversation for the demo shop; it ordered the fixture order `order` (number and approval card). */
async function replayConsole(page: Page, order: Order) {
  let n = 0;
  await page.route(`**/api/assistant/${SLUG}`, async (route) => {
    const recorded = JSON.parse(JSON.stringify(FIXTURE.turns[Math.min(n++, FIXTURE.turns.length - 1)]).replaceAll(RECORDED_NUMBER, order.number)) as Record<string, unknown>[];
    const turn = recorded.map((e) =>
      e.type === 'approval' ? { ...e, orderRef: order.id, orderNumber: order.number, approvalUrl: order.approvalUrl } : e,
    );
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(turn) });
  });
}

async function openConsole(page: Page, phone: boolean): Promise<Locator> {
  await page.getByRole('button', { name: 'Order with an assistant' }).filter({ visible: true }).first().click();
  const region = phone ? page.getByRole('dialog', { name: 'Order with an assistant' }) : page.getByRole('complementary', { name: 'Order with an assistant' });
  await expect(region.getByRole('textbox', { name: 'Message to the assistant' })).toBeVisible();
  return region;
}

async function say(region: Locator, text: string) {
  await region.getByRole('textbox', { name: 'Message to the assistant' }).fill(text);
  await region.getByRole('button', { name: 'Send' }).click();
}

/** The first turn of the recorded conversation, up to the assistant's question. */
async function firstTurn(region: Locator) {
  await say(region, FIXTURE.prompts[0]);
  await expect(region.getByText(/Should I place it\?/)).toBeVisible();
}

async function converse(region: Locator) {
  await firstTurn(region);
  await say(region, FIXTURE.prompts[1]);
  await expect(region.getByRole('link', { name: 'Approve $27.00 on PayPal' })).toBeVisible();
}

/** MOCKED: the recorded first turn, then `next` answers the buyer's next message. */
async function firstTurnThen(page: Page, next: (route: Route) => Promise<void>) {
  let n = 0;
  await page.route(`**/api/assistant/${SLUG}`, async (route) => {
    if (n++ > 0) return next(route);
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(FIXTURE.turns[0]) });
  });
}

// ---- publish (mocked) -----------------------------------------------------------------------------------------

/** The `publish` setup's items as the server's publish stream lists them, and its line for an item PayPal took. */
function publishStart() {
  const items = itemsToPublish(getDb(), setups.publish.shopId).map((i) => ({ itemId: i.id, name: i.name }));
  const added = (itemId: string, n: number) => ({ type: 'item', itemId, ok: true, paypalProductId: `PROD-E2E${n}` });
  return { items, start: { type: 'start', items }, added };
}

/** What the seller reads for an item PayPal answered with a 5xx (the app's own copy). */
const PAYPAL_OUTAGE = sellerMessageFor(new PayPalApiError(503, 'SERVICE_UNAVAILABLE', null, 'E2E', 'Service Unavailable'));

async function openReview(page: Page, context: BrowserContext) {
  await signIn(context, setups.publish.shopId, setups.publish.ownerToken);
  await page.goto(`/shops/${setups.publish.shopId}/setup`);
  await expect(page.getByRole('heading', { level: 1, name: 'Check your menu' })).toBeVisible();
}

// ---- screens --------------------------------------------------------------------------------------------------

interface Screen {
  name: string;
  /** Viewport-only capture (fixed panels and sheets); default full page. */
  viewport?: boolean;
  run: (page: Page, ctx: { phone: boolean; context: BrowserContext }) => Promise<void>;
}

const receipt = (key: keyof typeof orders, heading: string | RegExp): Screen => ({
  name: `receipt-${key === 'waiting' ? 'awaiting-approval' : key === 'refused' ? 'capture-refused' : key === 'nut' ? 'paid' : key}`,
  run: async (page) => {
    await page.goto(`/o/${orders[key].id}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  },
});

const SCREENS: Screen[] = [
  // Start
  {
    name: 'start',
    run: async (page) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Snap your price list' })).toBeVisible();
    },
  },
  {
    name: 'start-photos-ready',
    run: async (page) => {
      await page.goto('/');
      await page.getByTestId('photo-input').setInputFiles([samplePhoto('marigold-bakehouse.jpg', 'page-1.jpg'), samplePhoto('tia-lupe-chalkboard.jpg', 'page-2.jpg')]);
      await expect(page.getByRole('button', { name: 'Read my menu' })).toBeVisible();
    },
  },
  {
    name: 'start-bad-file',
    run: async (page) => {
      await page.goto('/');
      await page.getByTestId('photo-input').setInputFiles([{ name: 'menu.heic', mimeType: 'image/heic', buffer: Buffer.from('not a jpg') }]);
      await expect(page.locator('section[aria-labelledby="start-title"]').getByRole('alert')).toHaveText("We couldn’t open that photo. Try a JPG or PNG.");
    },
  },
  {
    name: 'start-returning-owner',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      await page.goto('/');
      await expect(page.getByRole('link', { name: 'Open your dashboard' })).toBeVisible();
    },
  },
  // Setup
  {
    name: 'setup-reading',
    run: async (page, { context }) => {
      await signIn(context, setups.reading.shopId, setups.reading.ownerToken);
      await page.goto(`/shops/${setups.reading.shopId}/setup`);
      await expect(page.getByRole('heading', { level: 1, name: 'Reading your menu…' })).toBeVisible();
    },
  },
  {
    name: 'setup-review',
    run: async (page, { context }) => {
      await signIn(context, setups.review.shopId, setups.review.ownerToken);
      await page.goto(`/shops/${setups.review.shopId}/setup`);
      await expect(page.getByRole('heading', { level: 1, name: 'Check your menu' })).toBeVisible();
      await expect(page.getByText('10 items · 4 need you')).toBeVisible();
    },
  },
  {
    // MOCKED: the publish stream has answered for 6 items and stays open.
    name: 'setup-publishing',
    run: async (page, { context }) => {
      const { items, start, added } = publishStart();
      await streamThenHold(page, `/api/shops/${setups.publish.shopId}/publish`, [start, ...items.slice(0, 6).map((i, n) => added(i.itemId, n + 1))]);
      await openReview(page, context);
      await page.getByRole('button', { name: `Publish ${items.length} items to PayPal` }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Adding your menu to PayPal' })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: `Adding to PayPal… 6/${items.length}` })).toBeVisible();
    },
  },
  {
    // MOCKED: a finished publish stream where PayPal answered 503 for 2 items; the shop went live with the rest.
    name: 'setup-publish-retry',
    run: async (page, { context }) => {
      const { items, start, added } = publishStart();
      const failed = new Set([items[2].itemId, items[5].itemId]);
      const lines = items.map((i, n) => (failed.has(i.itemId) ? { type: 'item', itemId: i.itemId, ok: false, message: PAYPAL_OUTAGE } : added(i.itemId, n + 1)));
      const slug = shopsRepo.byId(getDb(), setups.publish.shopId)!.slug;
      const done = { type: 'done', published: items.length - 2, failed: [...failed].map((itemId) => ({ itemId, message: PAYPAL_OUTAGE })), shop: { status: 'live', slug } };
      await page.route(`**/api/shops/${setups.publish.shopId}/publish`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson([start, ...lines, done]) }),
      );
      await openReview(page, context);
      await page.getByRole('button', { name: `Publish ${items.length} items to PayPal` }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Almost there' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry 2 items' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue to your live shop' })).toBeVisible();
    },
  },
  {
    name: 'setup-retake',
    run: async (page, { context }) => {
      await signIn(context, setups.retake.shopId, setups.retake.ownerToken);
      await page.goto(`/shops/${setups.retake.shopId}/setup`);
      await expect(page.getByRole('heading', { level: 1, name: "This doesn’t look like a price list" })).toBeVisible();
    },
  },
  {
    name: 'setup-failed',
    run: async (page, { context }) => {
      await signIn(context, setups.failed.shopId, setups.failed.ownerToken);
      await page.goto(`/shops/${setups.failed.shopId}/setup`);
      await expect(page.getByRole('heading', { level: 1, name: 'Reading didn’t finish' })).toBeVisible();
    },
  },
  {
    name: 'setup-live',
    run: async (page, { context }) => {
      await signIn(context, setups.live.shopId, setups.live.ownerToken);
      await page.goto(`/shops/${setups.live.shopId}/setup`);
      await expect(page.getByRole('heading', { level: 1, name: 'Your shop is live' })).toBeVisible();
    },
  },
  // Shop and buyer console
  {
    name: 'shop',
    run: async (page) => {
      await page.goto(`/s/${SLUG}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Marigold Bakehouse' })).toBeVisible();
      // The menu's photos load lazily: scroll through once, as a buyer would, so the full-page capture has them all.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      // Back at the top, the section tabs mark the first section again.
      await expect(page.getByRole('navigation', { name: 'Menu sections' }).getByRole('link').first())
        .toHaveAttribute('aria-current', 'true', { timeout: 3000 })
        .catch(() => undefined);
    },
  },
  {
    // The first screen only, as a buyer's phone shows it: the sticky "Order with an assistant" bar at the bottom. (In
    // the full-page `shop` capture Chromium draws that bar where the first screen ended, over the menu.)
    name: 'shop-first-screen',
    viewport: true,
    run: async (page) => {
      await page.goto(`/s/${SLUG}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Marigold Bakehouse' })).toBeVisible();
    },
  },
  {
    // A shop published from the Marigold sample menu: no photos, so every item shows the designed fallback.
    name: 'shop-no-photos',
    run: async (page) => {
      const shop = shopsRepo.byId(getDb(), setups.live.shopId)!;
      await page.goto(`/s/${shop.slug}`);
      await expect(page.getByRole('heading', { level: 1, name: shop.name })).toBeVisible();
    },
  },
  {
    name: 'console-empty',
    viewport: true,
    run: async (page, { phone }) => {
      await page.goto(`/s/${SLUG}`);
      const region = await openConsole(page, phone);
      await expect(region.getByRole('list', { name: 'Try asking' }).getByRole('button')).toHaveCount(3);
    },
  },
  {
    name: 'console-conversation',
    viewport: true,
    run: async (page, { phone }) => {
      await replayConsole(page, orders.waiting);
      await page.goto(`/s/${SLUG}`);
      const region = await openConsole(page, phone);
      await converse(region);
      await expect(region.getByRole('group', { name: 'Activity', exact: true }).first()).toContainText('get_shop_info');
      await region.getByRole('link', { name: 'Approve $27.00 on PayPal' }).scrollIntoViewIfNeeded();
    },
  },
  {
    name: 'console-activity-raw-mcp',
    viewport: true,
    run: async (page, { phone }) => {
      await replayConsole(page, orders.waiting);
      await page.goto(`/s/${SLUG}`);
      const region = await openConsole(page, phone);
      await converse(region);
      const create = region.locator('summary', { hasText: 'create_order' });
      await create.click();
      await expect(region.locator('details[open] pre').first()).toContainText('"method": "tools/call"');
      await create.evaluate((el) => {
        const box = el.closest('.overflow-y-auto');
        if (box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
      });
    },
  },
  {
    // MOCKED: the turn's stream has opened (its session line) and stays open.
    name: 'console-thinking',
    viewport: true,
    run: async (page, { phone }) => {
      await streamThenHold(page, `/api/assistant/${SLUG}`, [FIXTURE.turns[0][0]]);
      await page.goto(`/s/${SLUG}`);
      const region = await openConsole(page, phone);
      await say(region, FIXTURE.prompts[0]);
      await expect(region.getByRole('status').filter({ hasText: 'Thinking…' })).toBeVisible();
    },
  },
  {
    // MOCKED: the recorded first turn, then the server's 429 (20 turns per IP per hour) for the next message.
    name: 'console-rate-limited',
    viewport: true,
    run: async (page, { phone }) => {
      await firstTurnThen(page, (route) =>
        route.fulfill({ status: 429, json: { error: { code: 'RATE_LIMITED', message: "You’ve sent a lot of messages in the last hour. Try again later." } } }),
      );
      await page.goto(`/s/${SLUG}`);
      const region = await openConsole(page, phone);
      await firstTurn(region);
      await say(region, FIXTURE.prompts[1]);
      await expect(region.getByRole('alert')).toHaveText("You’ve sent a lot of messages in the last hour. Try again later.");
      await expect(region.getByRole('button', { name: 'Start over' })).toBeVisible();
    },
  },
  {
    // MOCKED: the recorded first turn, then the stream the server sends when the assistant fails mid-turn.
    name: 'console-error',
    viewport: true,
    run: async (page, { phone }) => {
      await firstTurnThen(page, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/x-ndjson',
          body: ndjson([FIXTURE.turns[1][0], { type: 'error', message: "The shop didn’t answer. Try again." }]),
        }),
      );
      await page.goto(`/s/${SLUG}`);
      const region = await openConsole(page, phone);
      await firstTurn(region);
      await say(region, FIXTURE.prompts[1]);
      await expect(region.getByRole('alert')).toHaveText("The shop didn’t answer. Try again.");
      await expect(region.getByRole('button', { name: 'Start over' })).toBeVisible();
    },
  },
  // Receipt
  receipt('waiting', 'Waiting for your approval'),
  receipt('nut', 'Paid. Marigold Bakehouse has your order.'),
  receipt('cancelled', 'Order cancelled'),
  receipt('expired', 'This order expired'),
  receipt('refused', "PayPal didn’t complete the payment"),
  {
    name: 'receipt-unknown',
    run: async (page) => {
      await page.goto('/o/ord_doesnotexist000');
      await expect(page.getByRole('heading', { level: 1, name: "We couldn’t find that order" })).toBeVisible();
    },
  },
  // Dashboard
  {
    name: 'dashboard-orders',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      await page.goto(`/shops/${demo.shop.id}`);
      await expect(page.getByText("We can’t reach PayPal right now")).toHaveCount(0);
      await expect(page.locator(`[data-order="${orders.nut.number}"]`)).toContainText('almond croissants contain nuts');
      await page.locator('details[data-group="waiting"] summary').click();
      await expect(page.locator('details[data-group="waiting"]')).toHaveAttribute('open', '');
    },
  },
  {
    name: 'dashboard-menu',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      await page.goto(`/shops/${demo.shop.id}?tab=menu`);
      await expect(appNav(page).getByRole('link', { name: 'Menu' })).toHaveAttribute('aria-current', 'page');
    },
  },
  {
    // MOCKED: "Snap your counter" answers with three crops (no live Claude); one item already has a photo (Replace).
    name: 'dashboard-menu-counter',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      const crop = (file: string) => `data:image/jpeg;base64,${fs.readFileSync(path.join('public', 'demo', 'marigold-bakehouse', file)).toString('base64')}`;
      const proposals = [
        ['Butter croissant', 'butter-croissant.jpg'],
        ['Cardamom bun', 'cardamom-bun.jpg'],
        ['Pain au chocolat', 'pain-au-chocolat.jpg'],
      ].map(([name, file]) => ({ itemId: demo.items[name].id, name, confidence: 'high', image: crop(file) }));
      await page.route(`**/api/shops/${demo.shop.id}/counter`, (route) => route.fulfill({ json: { proposals } }));
      await page.goto(`/shops/${demo.shop.id}?tab=menu`);
      await snapCounter(page, path.join('public', 'demo', 'marigold-bakehouse', 'cover.jpg'));
      await expect(page.getByRole('button', { name: 'Replace: Cardamom bun' })).toBeVisible();
    },
    viewport: true,
  },
  // Snap your counter's other states. The first three are MOCKED (the route is held or answered in the browser).
  ...(
    [
      ['reading', null, 'Finding your items…'],
      ['none', { json: { proposals: [] } }, 'We couldn’t match any items. Try a closer photo.'],
      ['error', { status: 502, json: { error: { code: 'COUNTER_FAILED', message: 'We couldn’t look at that photo just now. Try again in a moment.' } } }, 'We couldn’t look at that photo just now.'],
    ] as const
  ).map(([state, answer, text]) => ({
    name: `dashboard-menu-counter-${state}`,
    viewport: true,
    run: async (page: Page, { context }: { context: BrowserContext }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      // Reading: the request is never answered, so the sheet stays on "Finding your items…".
      await page.route(`**/api/shops/${demo.shop.id}/counter`, (route) => (answer ? route.fulfill(answer) : new Promise<void>(() => {})));
      await page.goto(`/shops/${demo.shop.id}?tab=menu`);
      await snapCounter(page, path.join('public', 'samples', 'counter-case.jpg'));
      await expect(page.getByRole('dialog').getByText(text)).toBeVisible();
    },
  })),
  {
    // LIVE: a real Claude answer for the display-case photo (public/samples/counter-case.jpg). Skipped with no AI key.
    name: 'dashboard-menu-counter-live',
    viewport: true,
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      await page.goto(`/shops/${demo.shop.id}?tab=menu`);
      const answered = page.waitForResponse((r) => r.url().endsWith(`/api/shops/${demo.shop.id}/counter`), { timeout: 60_000 });
      await snapCounter(page, path.join('public', 'samples', 'counter-case.jpg'));
      const res = await answered;
      test.skip(res.status() === 503, 'No ANTHROPIC_API_KEY on the server.');
      expect(res.status()).toBe(200);
      // Whatever Claude answered: its crops, or "We couldn't match any items" (a live answer can find none).
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('list', { name: 'Photos found' }).locator('li').first().or(sheet.getByText('We couldn’t match any items.'))).toBeVisible();
    },
  },
  {
    name: 'dashboard-share',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      await page.goto(`/shops/${demo.shop.id}?tab=share`);
      await expect(page.getByTestId('share-door-url')).toBeVisible();
    },
  },
  {
    name: 'dashboard-empty',
    run: async (page, { context }) => {
      await signIn(context, empty.shop.id, empty.ownerToken);
      await page.goto(`/shops/${empty.shop.id}`);
      await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible();
    },
  },
  {
    // MOCKED: back from an order to the dashboard. The Orders link's prefetch (the layout and loading.tsx) comes from
    // the server; the page request the click makes is held in the browser (holdNavigation), so the skeleton stays up.
    // Production builds only: Next prefetches links in view only in production.
    name: 'dashboard-loading',
    run: async (page, { context }) => {
      const dashboard = `/shops/${demo.shop.id}`;
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      const held = await holdNavigation(page, dashboard);
      // The prefetch up to the loading boundary (not the /_tree one). Its stream can stay open after the skeleton
      // has arrived, so wait for its answer, not its end.
      const prefetched = page.waitForResponse((r) => {
        const h = r.request().headers();
        return new URL(r.url()).pathname === dashboard && h['next-router-prefetch'] === '1' && !h['next-router-segment-prefetch'];
      });
      await page.goto(`${dashboard}/orders/${orders.nut.id}`);
      await expect(page.getByTestId('brief-headline')).toHaveText(NUT_BRIEF.headline);
      // A dev server never prefetches; it shows its dev indicator (nextjs-portal) instead.
      const dev = await Promise.race([
        prefetched.then(() => false),
        page.locator('nextjs-portal').first().waitFor({ state: 'attached' }).then(() => true),
      ]);
      test.skip(dev, 'Next prefetches links only in a production build (npm run screenshots:prod).');
      // A click before the router has stored the prefetch goes straight to the (held) page request and stays on the
      // order, so click again until the skeleton shows.
      const back = page.getByRole('main').getByRole('link', { name: 'Back to Orders', exact: true });
      const skeleton = page.locator('[aria-busy="true"]').getByRole('status');
      await expect(async () => {
        if (await back.isVisible()) await back.click();
        await expect(skeleton).toHaveText('Loading your orders', { timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await expect(page).toHaveURL(dashboard);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
      expect(await held(), 'the dashboard page request is held').toBeGreaterThanOrEqual(1);
    },
  },
  {
    // FIXTURE: the open orders' last PayPal check is stamped 5 minutes ago (what a stalled poller leaves behind).
    name: 'dashboard-paypal-unreachable',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerStalled(5);
      await page.goto(`/shops/${demo.shop.id}`);
      await expect(page.getByRole('status').filter({ hasText: "We can’t reach PayPal right now." })).toBeVisible();
    },
  },
  // Counter card (run 2, findable door): Share tab → Print counter card. Its print view: e2e/discovery.spec.ts.
  {
    name: 'counter-card',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      await page.goto(`/shops/${demo.shop.id}/card`);
      await expect(page.getByRole('heading', { level: 1, name: 'Counter card' })).toBeVisible();
      await expect(page.getByTestId('card-door-url')).toHaveText(`${BASE}/s/${SLUG}/mcp`);
    },
  },
  // Order detail
  {
    // FIXTURE: the nut-allergy order on a second Marigold Bakehouse, paid just now, before the brief agent answers.
    name: 'order-brief-writing',
    run: async (page, { context }) => {
      const order = addFixtureOrder(briefShop, {
        status: 'paid', fulfillment: 'shipping', minutesAgo: 2, buyerName: 'Dana',
        buyerNote: 'Nut allergy in the house. Would love it by Friday!',
        lines: [['Almond croissant', 2], ['Country sourdough loaf', 1]],
        payer: { name: 'Dana Whitfield', email: 'dana.whitfield@example.com' }, shipTo: AUSTIN,
      });
      await signIn(context, briefShop.shop.id, briefShop.ownerToken);
      await page.goto(`/shops/${briefShop.shop.id}/orders/${order.id}`);
      await expect(page.getByText('Writing the brief…')).toBeVisible();
    },
  },
  {
    name: 'order-paid-with-brief',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      await page.goto(`/shops/${demo.shop.id}/orders/${orders.nut.id}`);
      await expect(page.getByTestId('brief-headline')).toHaveText(NUT_BRIEF.headline);
      await expect(page.getByRole('form', { name: 'Add tracking' })).toBeVisible();
    },
  },
  {
    // MOCKED: the tracking POST answers 502 PAYPAL_REJECTED (a UPS number sent as USPS).
    name: 'order-tracking-error',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      await page.route(`**/api/shops/${demo.shop.id}/orders/${orders.nut.id}/tracking`, (route) =>
        route.fulfill({ status: 502, json: { error: { code: 'PAYPAL_REJECTED', message: 'PayPal said: Tracking number is invalid for carrier USPS.' } } }),
      );
      await page.goto(`/shops/${demo.shop.id}/orders/${orders.nut.id}`);
      await page.getByLabel('Tracking number').fill('1Z 999 AA1 0123 4567 84');
      await page.getByRole('button', { name: 'Send tracking to PayPal' }).click();
      await expect(page.getByRole('main').getByRole('alert')).toHaveText('PayPal said: Tracking number is invalid for carrier USPS.');
    },
  },
  {
    name: 'order-shipped-with-tracking',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      await page.goto(`/shops/${demo.shop.id}/orders/${orders.shipped.id}`);
      await expect(page.locator('section[aria-labelledby="action-title"]')).toContainText('9400111899223197428490');
    },
  },
  // Paying each seller (spec §8a)
  {
    name: 'dashboard-settings',
    run: async (page, { context }) => {
      await signIn(context, briefShop.shop.id, briefShop.ownerToken);
      await page.goto(`/shops/${briefShop.shop.id}?tab=settings`);
      await expect(page.getByLabel('Your PayPal email')).toHaveValue(FIXTURE_PAYEE);
    },
  },
  {
    name: 'dashboard-settings-invalid',
    run: async (page, { context }) => {
      await signIn(context, briefShop.shop.id, briefShop.ownerToken);
      await page.goto(`/shops/${briefShop.shop.id}?tab=settings`);
      const field = page.getByLabel('Your PayPal email');
      await field.fill('rosa@example');
      await field.blur();
      await expect(page.getByText('Enter the email you use to log in to PayPal, like rosa@example.com.')).toBeVisible();
    },
  },
  {
    name: 'dashboard-settings-demo',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      pollerJustChecked();
      await page.goto(`/shops/${demo.shop.id}?tab=settings`);
      await expect(page.getByTestId('demo-payee-note')).toBeVisible();
    },
  },
  {
    name: 'receipt-paid-to-seller',
    run: async (page) => {
      await page.goto(`/o/${sellerOrders.paid.id}`);
      await expect(page.getByText('Paid to Marigold Bakehouse’s own PayPal account (r•••@example.com)')).toBeVisible();
    },
  },
  {
    name: 'order-payment-held',
    run: async (page, { context }) => {
      await signIn(context, briefShop.shop.id, briefShop.ownerToken);
      await page.goto(`/shops/${briefShop.shop.id}/orders/${sellerOrders.held.id}`);
      await expect(page.locator('section[aria-labelledby="action-title"]')).toContainText('No PayPal account uses rosa@exmaple.com yet.');
    },
  },
  {
    name: 'review-paypal-email',
    run: async (page, { context }) => {
      await signIn(context, setups.review.shopId, setups.review.ownerToken);
      await page.goto(`/shops/${setups.review.shopId}/setup`);
      await expect(page.getByRole('button', { name: 'Add your PayPal email to publish.' })).toBeVisible();
      const field = page.getByLabel('Your PayPal email');
      await field.fill('rosa@example');
      await field.blur();
      await expect(page.getByText('Enter the email you use to log in to PayPal, like rosa@example.com.')).toBeVisible();
      // Centred, so the sticky publish bar (with its "Add your PayPal email" reason) doesn't cover the field's error.
      await field.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    },
    viewport: true,
  },
];

for (const [label, size] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`round-1 screens at ${label} px`, () => {
    test.use({ viewport: size });
    for (const screen of SCREENS) {
      test(screen.name, async ({ page, context }) => {
        await screen.run(page, { phone: label === '390', context });
        await capture(page, `${screen.name}-${label}`, !screen.viewport);
      });
    }
  });
}
