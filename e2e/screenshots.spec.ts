// Round-1 screenshots for judging: every screen at 390×844 and 1440×900 into docs/judge/screenshots/round-1/, each
// checked with axe (WCAG 2.1 A/AA). Serious or critical violations fail the test; every violation found is written to
// round-1/axe-results.json.
//
// One story across the set: the demo shop Marigold Bakehouse (scripts/seed-demo.ts, here with a fake PayPal), its
// menu read from public/samples/marigold-bakehouse.jpg. States that are slow to reach live (paid, shipped, expired,
// a held reading) are LABELLED TEST FIXTURES written straight to the e2e database (e2e/task8-fixtures.ts); their
// PayPal ids start with "E2E". The console conversation is replayed from a real recorded run
// (e2e/fixtures/console-turns.json). No Claude or PayPal calls happen here.
//
// Run: E2E_PORT=3111 npx playwright test e2e/screenshots.spec.ts   (or: npm run screenshots)
import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { recordedReading } from '@/lib/ai/samples';
import { publishShop } from '@/lib/catalog/publish';
import { createShopFromSample, runReading } from '@/lib/catalog/setup';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as extractions from '@/lib/db/repos/extractions';
import * as itemsRepo from '@/lib/db/repos/items';
import * as ordersRepo from '@/lib/db/repos/orders';
import type { MenuExtraction } from '@/lib/ai/schemas';
import type { Order, OrderBrief } from '@/lib/domain/types';
import { createFakePayPal } from '@/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { DESKTOP, PHONE, samplePhoto, settle } from './helpers';
import { E2E_DB, addFixtureOrder, createFixtureShop, fixtureFromShop, type FixtureShop } from './task8-fixtures';

const OUT = path.resolve(__dirname, '..', 'docs', 'judge', 'screenshots', 'round-1');
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
const orders = {} as Record<'nut' | 'pickup' | 'waiting' | 'pending' | 'shipped' | 'pickedUp' | 'cancelled' | 'expired' | 'refused', Order>;
const setups = {} as Record<'reading' | 'review' | 'retake' | 'failed' | 'live', Setup>;

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

/** A Marigold sample shop as a visitor makes it from the Start page, read with `raw` (or failing) without Claude. */
async function sampleShop(raw: MenuExtraction | Error | null): Promise<Setup> {
  const db = getDb();
  const { shop, ownerToken } = await createShopFromSample(db, 'marigold-bakehouse');
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
  seedDemoOrders(demo);
  empty = createFixtureShop('Tía Lupe Tacos');

  const recorded = recordedReading('marigold-bakehouse');
  setups.reading = await sampleShop(null);
  setups.review = await sampleShop(recorded);
  setups.retake = await sampleShop(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../tests/ai/fixtures/not-a-menu.json'), 'utf8')) as MenuExtraction);
  setups.failed = await sampleShop(new Error('Request timed out.'));
  setups.live = await sampleShop(recorded);
  // What a seller does on review: "Looks right" on the checks, "Ask in person" on the market price; then publish.
  for (const item of itemsRepo.listWithVariants(db, setups.live.shopId)) {
    if (!item.issues.length) continue;
    itemsRepo.update(db, item.id, { issues: [], issueDetail: null, ...(item.issues.includes('MARKET_PRICE') ? { status: 'in_person' as const } : {}) });
  }
  await publishShop({ db, paypal }, setups.live.shopId);
});

test.afterAll(() => {
  const reading = extractions.latest(getDb(), setups.reading?.shopId ?? '');
  if (reading?.status === 'running') extractions.fail(getDb(), reading.id, 'AI_ERROR: screenshots done');
});

// ---- capture + axe --------------------------------------------------------------------------------------------

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

async function converse(region: Locator) {
  const input = region.getByRole('textbox', { name: 'Message to the assistant' });
  await input.fill(FIXTURE.prompts[0]);
  await region.getByRole('button', { name: 'Send' }).click();
  await expect(region.getByText(/Should I place it\?/)).toBeVisible();
  await input.fill(FIXTURE.prompts[1]);
  await region.getByRole('button', { name: 'Send' }).click();
  await expect(region.getByRole('link', { name: 'Approve $27.00 on PayPal' })).toBeVisible();
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
      await expect(page.locator('section[aria-labelledby="start-title"]').getByRole('alert')).toHaveText("We couldn't open that photo. Try a JPG or PNG.");
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
    name: 'setup-retake',
    run: async (page, { context }) => {
      await signIn(context, setups.retake.shopId, setups.retake.ownerToken);
      await page.goto(`/shops/${setups.retake.shopId}/setup`);
      await expect(page.getByRole('heading', { level: 1, name: "This doesn't look like a price list" })).toBeVisible();
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
  // Receipt
  receipt('waiting', 'Waiting for your approval'),
  receipt('nut', 'Paid. Marigold Bakehouse has your order.'),
  receipt('cancelled', 'Order cancelled'),
  receipt('expired', 'This order expired'),
  receipt('refused', "PayPal didn't complete the payment"),
  {
    name: 'receipt-unknown',
    run: async (page) => {
      await page.goto('/o/ord_doesnotexist000');
      await expect(page.getByRole('heading', { level: 1, name: "We couldn't find that order" })).toBeVisible();
    },
  },
  // Dashboard
  {
    name: 'dashboard-orders',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      await page.goto(`/shops/${demo.shop.id}`);
      await expect(page.locator(`[data-order="${orders.nut.number}"]`)).toContainText('almond croissants contain nuts');
      await page.locator('details[data-group="waiting"] summary').click();
      await expect(page.locator('details[data-group="waiting"]')).toHaveAttribute('open', '');
    },
  },
  {
    name: 'dashboard-menu',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      await page.goto(`/shops/${demo.shop.id}?tab=menu`);
      await expect(page.getByRole('tab', { name: 'Menu' })).toHaveAttribute('aria-selected', 'true');
    },
  },
  {
    name: 'dashboard-share',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
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
  // Order detail
  {
    name: 'order-paid-with-brief',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      await page.goto(`/shops/${demo.shop.id}/orders/${orders.nut.id}`);
      await expect(page.getByTestId('brief-headline')).toHaveText(NUT_BRIEF.headline);
      await expect(page.getByRole('form', { name: 'Add tracking' })).toBeVisible();
    },
  },
  {
    name: 'order-shipped-with-tracking',
    run: async (page, { context }) => {
      await signIn(context, demo.shop.id, demo.ownerToken);
      await page.goto(`/shops/${demo.shop.id}/orders/${orders.shipped.id}`);
      await expect(page.locator('section[aria-labelledby="action-title"]')).toContainText('9400111899223197428490');
    },
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
