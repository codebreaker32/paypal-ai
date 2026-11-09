// Shop page, buyer console and receipt: behaviour and accessibility (screenshots: e2e/screenshots.spec.ts).
// The console's stream is replayed from a real recorded run
// (e2e/fixtures/console-turns.json), so no Claude or PayPal calls happen here. Orders for the receipt states are
// written straight to SQLite and removed afterwards.
//
// Run: E2E_PORT=3111 npx playwright test e2e/shop.spec.ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../src/lib/config';
import { getDb } from '../src/lib/db';
import * as eventsRepo from '../src/lib/db/repos/events';
import * as itemsRepo from '../src/lib/db/repos/items';
import * as ordersRepo from '../src/lib/db/repos/orders';
import * as shopsRepo from '../src/lib/db/repos/shops';
import type { Order, Shop } from '../src/lib/domain/types';
import { createFakePayPal } from '../src/lib/paypal/fake';
import { DEMO_SHOP, seedDemoShop } from '../scripts/seed-demo';
import { DESKTOP, PHONE, settle } from './helpers';

const SLUG = DEMO_SHOP.slug;
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'console-turns.json'), 'utf8')) as {
  prompts: string[];
  turns: Record<string, unknown>[][];
};
const SESSION_ID = FIXTURE.turns[0][0].id as string;
const APPROVAL_URL = (FIXTURE.turns[1].find((e) => e.type === 'approval') as { approvalUrl: string }).approvalUrl;

// ---- fixtures ------------------------------------------------------------------------------------------

let shop: Shop;
let edgeShop: Shop;
const made: string[] = [];
const fx = {} as Record<'awaiting' | 'paid' | 'cancelled' | 'refused' | 'polling' | 'cancelRoute' | 'back', Order>;
const EDGE_NAME = 'Shelfie Test Kitchen';

function makeOrder(label: string, fulfillment: 'shipping' | 'pickup' = 'shipping'): Order {
  const db = getDb();
  const items = itemsRepo.listWithVariants(db, shop.id, { status: ['live'] });
  const almond = items.find((i) => i.name === 'Almond croissant') ?? items[0];
  const bread = items.find((i) => i.name === 'Country sourdough loaf') ?? items[1];
  const lines = [
    { item: almond, qty: 2 },
    { item: bread, qty: 1 },
  ].map(({ item, qty }) => ({
    itemId: item.id, variantId: item.variants[0].id, name: item.name, label: item.variants[0].label,
    unitCents: item.variants[0].priceCents!, qty, paypalProductId: item.paypalProductId,
  }));
  const itemsCents = lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
  const shippingCents = fulfillment === 'shipping' ? shop.shippingFeeCents : 0;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const order = ordersRepo.insert(
    db,
    {
      shopId: shop.id, fulfillment, buyerName: null, buyerNote: null, agentName: 'shelfie-assistant', clientRequestId: null,
      itemsCents, shippingCents, totalCents: itemsCents + shippingCents, paypalOrderId: `E2E-${label}-${stamp}`,
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=E2E${stamp}`,
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    },
    lines,
  );
  made.push(order.id);
  return order;
}

function markPaid(order: Order): void {
  const db = getDb();
  ordersRepo.casStatus(db, order.id, 'awaiting_approval', 'approved');
  ordersRepo.casStatus(db, order.id, 'approved', 'paid', { paidAt: new Date().toISOString(), captureId: 'E2E-CAPTURE' });
}

test.beforeAll(async () => {
  const db = getDb();
  if (!shopsRepo.bySlug(db, SLUG)) {
    // No demo shop yet: seed it with a fake PayPal (npm run seed -- --reset publishes it to the sandbox later).
    await seedDemoShop({ db, paypal: createFakePayPal(), uploadsDir: getConfig().uploadsDir });
  }
  shop = shopsRepo.bySlug(db, SLUG)!;

  fx.awaiting = makeOrder('awaiting');
  fx.paid = makeOrder('paid');
  markPaid(fx.paid);
  fx.cancelled = makeOrder('cancelled', 'pickup');
  ordersRepo.casStatus(db, fx.cancelled.id, 'awaiting_approval', 'cancelled');
  fx.polling = makeOrder('polling');
  fx.cancelRoute = makeOrder('cancel-route');
  fx.back = makeOrder('back');
  // Approved, but PayPal refused the capture for a reason retrying won't fix (the order service logs capture_failed).
  fx.refused = makeOrder('refused');
  ordersRepo.casStatus(db, fx.refused.id, 'awaiting_approval', 'approved');
  eventsRepo.add(db, fx.refused.id, 'capture_failed', 'return_url', { status: 422, issue: 'TRANSACTION_REFUSED', debugId: 'E2E' });

  // A paused shop with a sold-out item and an "ask in person" item.
  const old = db.prepare('SELECT id FROM shops WHERE name = ?').all(EDGE_NAME) as { id: string }[];
  for (const o of old) db.prepare('DELETE FROM shops WHERE id = ?').run(o.id);
  edgeShop = shopsRepo.create(db, { name: EDGE_NAME, about: 'A test shop for edge states.', fulfillment: 'pickup', pickupNotes: 'Fridays 4–6 pm' }).shop;
  const drafts = [
    { name: 'Lemon bar', prices: [350] },
    { name: 'Iced tea', prices: [300, 450] },
    { name: 'Market fish', prices: [null], inPerson: true },
  ];
  const created = itemsRepo.replaceDrafts(
    db,
    edgeShop.id,
    drafts.map((d) => ({
      section: 'Today', name: d.name, description: null, sourceText: d.name, confidence: 'high', kind: 'PHYSICAL', issues: [],
      issueDetail: null, status: d.inPerson ? 'in_person' : 'draft',
      variants: d.prices.map((p, i) => ({ label: d.prices.length > 1 ? ['S', 'L'][i] : null, priceCents: p })),
    })),
  );
  created.filter((i) => i.status === 'draft').forEach((i, n) => itemsRepo.setPayPalProductId(db, i.id, `PROD-E2E-${edgeShop.id}-${n}`));
  itemsRepo.update(db, created.find((i) => i.name === 'Lemon bar')!.id, { soldOut: true });
  shopsRepo.publish(db, edgeShop.id);
  edgeShop = shopsRepo.update(db, edgeShop.id, { status: 'paused' });
});

test.afterAll(() => {
  const db = getDb();
  for (const id of made) db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  if (edgeShop) db.prepare('DELETE FROM shops WHERE id = ?').run(edgeShop.id);
});

// ---- helpers -------------------------------------------------------------------------------------------

const ndjson = (events: Record<string, unknown>[]) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

/** Replays the recorded turns for POST /api/assistant/<slug>, one per request; returns the request bodies. */
/**
 * Replays the recorded turns for POST /api/assistant/<slug>, one per request; returns the request bodies. With `order`,
 * the recorded approval points at that order instead, so the console can follow its real status.
 */
async function replayConsole(page: Page, order?: Order): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await page.route(`**/api/assistant/${SLUG}`, async (route) => {
    bodies.push(route.request().postDataJSON());
    let turn = FIXTURE.turns[Math.min(bodies.length - 1, FIXTURE.turns.length - 1)];
    if (order) {
      turn = turn.map((e) =>
        e.type === 'approval' ? { ...e, orderRef: order.id, orderNumber: order.number, approvalUrl: order.approvalUrl } : e,
      );
    }
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(turn) });
  });
  return bodies;
}

/** The console: the dock from 1024 px (an aside), a modal sheet below it (a side sheet from 640 px, a bottom sheet under that). */
function consoleRegion(page: Page, phone: boolean): Locator {
  return phone ? page.getByRole('dialog', { name: 'Order with an assistant' }) : page.getByRole('complementary', { name: 'Order with an assistant' });
}

async function openConsole(page: Page, phone: boolean): Promise<Locator> {
  await page.getByRole('button', { name: 'Order with an assistant' }).filter({ visible: true }).first().click();
  const region = consoleRegion(page, phone);
  await expect(region.getByRole('textbox', { name: 'Message to the assistant' })).toBeVisible();
  return region;
}

async function orderThroughConsole(region: Locator): Promise<void> {
  const input = region.getByRole('textbox', { name: 'Message to the assistant' });
  await input.fill(FIXTURE.prompts[0]);
  await region.getByRole('button', { name: 'Send' }).click();
  await expect(region.getByText(/Should I place it\?/)).toBeVisible();
  await input.fill(FIXTURE.prompts[1]);
  await region.getByRole('button', { name: 'Send' }).click();
  await expect(region.getByRole('link', { name: 'Approve $27.00 on PayPal' })).toBeVisible();
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function smallTargets(page: Page, scope = 'main') {
  return page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll<HTMLElement>(`${sel} a, ${sel} button, ${sel} summary, ${sel} [role="tab"]`))
        .filter((el) => el.offsetParent !== null && !el.closest('p, dd, li > span'))
        .map((el) => ({ text: el.innerText.trim().slice(0, 40) || el.getAttribute('aria-label') || el.tagName, h: Math.round(el.getBoundingClientRect().height) }))
        .filter((c) => c.h < 44),
    scope,
  );
}

// ---- shop page -----------------------------------------------------------------------------------------

for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`shop page at ${label} px`, () => {
    test.use({ viewport });

    test('shows the menu, how to get it, the original photo and the agent door', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Marigold Bakehouse' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Pastries' })).toBeVisible();
      const almond = page.getByRole('listitem').filter({ hasText: 'Almond croissant' });
      await expect(almond).toContainText('$5.00');
      await expect(page.getByRole('listitem').filter({ hasText: 'Drip coffee' })).toContainText(/S\s*\$3\.00/);
      await expect(page.getByRole('listitem').filter({ hasText: 'Seasonal fruit galette' })).toContainText('Ask in person');
      await expect(page.getByText('Sat & Sun pickup · 14 Alder St · order by Fri 6pm')).toBeVisible();
      await expect(page.getByText(/\$8\.00 flat/)).toBeVisible();
      await expect(page.getByRole('img', { name: /price list Marigold Bakehouse was made from/ })).toBeVisible();
      // The agent door is folded behind one disclosure at the foot of the page.
      await page.locator('#agent-door summary').click();
      await expect(page.locator('#agent-door code').first()).toHaveText(/\/s\/marigold-bakehouse\/mcp$/);
      await page.getByRole('tab', { name: 'Claude Code' }).click();
      await expect(page.getByText(/claude mcp add --transport http marigold-bakehouse /)).toBeVisible();
      await expectAccessible(page);
      if (label === '390') expect(await smallTargets(page)).toEqual([]);
    });

    test('opens the console with starter prompts made from the menu', async ({ page }) => {
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const region = await openConsole(page, label === '390');
      await expect(region.getByRole('button', { name: /^Two .+, shipped to me$/ })).toBeVisible();
      await expect(region.getByRole('list', { name: 'Try asking' }).getByRole('button')).toHaveCount(3);
      await expectAccessible(page);
    });

    test('replays a real order conversation: Activity, read-back, approval card', async ({ page }) => {
      const phone = label === '390';
      const bodies = await replayConsole(page);
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const region = await openConsole(page, phone);
      await orderThroughConsole(region);

      // The second turn continues the first turn's session.
      expect(bodies).toEqual([{ text: FIXTURE.prompts[0] }, { text: FIXTURE.prompts[1], sessionId: SESSION_ID }]);

      // Every tool call is listed with its arguments, result and time, and expands to the raw MCP JSON.
      const activity = region.getByRole('group', { name: 'Activity', exact: true });
      await expect(activity).toHaveCount(2);
      await expect(activity.first()).toContainText('get_shop_info');
      await expect(activity.first()).toContainText('Marigold Bakehouse · taking orders');
      await expect(activity.first()).toContainText(/list_products/);
      const create = region.locator('summary', { hasText: 'create_order' });
      await expect(create).toContainText(/3 items · shipping/);
      await expect(create).toContainText(/\$27\.00 · awaiting approval/);

      // The approval card comes after the assistant's "tap the PayPal button under this message".
      const approve = region.getByRole('link', { name: 'Approve $27.00 on PayPal' });
      await expect(approve).toHaveAttribute('href', APPROVAL_URL);
      const order = await region.evaluate((el) => {
        const text = Array.from(el.querySelectorAll('p')).find((p) => /Tap the PayPal button/.test(p.textContent ?? ''));
        const link = el.querySelector('a[href*="paypal.com"]');
        return text && link ? text.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
      });
      expect(order).toBeTruthy();
      await expect(region.getByRole('button', { name: 'Did my payment go through?' })).toBeVisible();

      await expectAccessible(page);
      if (phone) expect(await smallTargets(page, 'dialog[open]')).toEqual([]);
      await approve.scrollIntoViewIfNeeded();
      await settle(page);
      // The first turn: the door calls, then the read-back with the shipping fee and total.
      await region.locator('.overflow-y-auto').first().evaluate((el) => (el.scrollTop = 0));

      await create.click();
      await expect(region.locator('details[open]').getByText('MCP request')).toBeVisible();
      await expect(region.locator('details[open] pre').first()).toContainText('"method": "tools/call"');
      await expectAccessible(page);
      // Scroll only the conversation (not the page) so the expanded call sits at the top of it.
      await create.evaluate((el) => {
        const box = el.closest('.overflow-y-auto');
        if (box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
      });
    });
  });
}

test.describe('console states', () => {
  test.use({ viewport: DESKTOP });

  test('?assistant=1 opens the console on load', async ({ page }) => {
    await page.goto(`/s/${SLUG}?assistant=1`);
    await expect(consoleRegion(page, false).getByRole('textbox', { name: 'Message to the assistant' })).toBeVisible();
    await page.setViewportSize(PHONE);
    await expect(consoleRegion(page, true)).toBeVisible();
  });

  test('an agent door link opens the folded door, even when the address already ends in #agent-door', async ({ page }) => {
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    const door = page.locator('#agent-door details');
    const link = page.getByRole('link', { name: 'agent door', exact: true });
    await link.click();
    await expect(door).toHaveAttribute('open', '');
    await page.locator('#agent-door summary').click();
    await expect(door).not.toHaveAttribute('open', '');
    await link.click();
    await expect(door).toHaveAttribute('open', '');
  });

  test('a newer turn folds the first turn\'s Activity to one line that opens again', async ({ page }) => {
    await replayConsole(page);
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    const region = await openConsole(page, false);
    const activity = region.getByRole('group', { name: 'Activity', exact: true });
    const firstRow = region.locator('summary', { hasText: 'get_shop_info' });

    const input = region.getByRole('textbox', { name: 'Message to the assistant' });
    await input.fill(FIXTURE.prompts[0]);
    await region.getByRole('button', { name: 'Send' }).click();
    await expect(region.getByText(/Should I place it\?/)).toBeVisible();
    await expect(firstRow).toBeVisible();

    await input.fill(FIXTURE.prompts[1]);
    await region.getByRole('button', { name: 'Send' }).click();
    await expect(region.getByRole('link', { name: 'Approve $27.00 on PayPal' })).toBeVisible();

    await expect(activity).toHaveCount(2);
    await expect(activity.first().locator('summary').first()).toHaveText('Activity · 3 calls to the agent door');
    await expect(firstRow).toBeHidden();
    await expect(region.locator('summary', { hasText: 'create_order' })).toBeVisible();

    // Opened again, its rows are back, and each row's time is inside its own expansion.
    await activity.first().locator('summary').first().click();
    await expect(firstRow).toBeVisible();
    await expect(activity.first().getByText(/^Took \d+ ms$/).first()).toBeHidden();
    await firstRow.click();
    await expect(activity.first().getByText(/^Took \d+ ms$/).first()).toBeVisible();
    await expectAccessible(page);
  });

  test('a failed call stays in sight after a newer turn', async ({ page }) => {
    const turns = [
      [
        { type: 'session', id: 'asst_failed' },
        { type: 'tool_call', id: 'c1', name: 'create_order', input: {} },
        { type: 'tool_result', id: 'c1', ok: false, result: { error: { code: 'OPTION_REQUIRED' } }, ms: 12 },
        { type: 'text', text: 'Which size would you like?' },
        { type: 'done' },
      ],
      [{ type: 'session', id: 'asst_failed' }, { type: 'text', text: 'Noted.' }, { type: 'done' }],
    ];
    let request = 0;
    await page.route(`**/api/assistant/${SLUG}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(turns[request++]) }),
    );
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    const region = await openConsole(page, false);
    const input = region.getByRole('textbox', { name: 'Message to the assistant' });
    await input.fill('Two loaves');
    await region.getByRole('button', { name: 'Send' }).click();
    await expect(region.getByText('Which size would you like?')).toBeVisible();
    await input.fill('Large');
    await region.getByRole('button', { name: 'Send' }).click();
    await expect(region.getByText('Noted.')).toBeVisible();

    await expect(region.locator('summary', { hasText: 'OPTION_REQUIRED' })).toBeVisible();
    await expect(region.locator('details[role="group"]')).toHaveCount(0);
  });

  test('rate limited: a plain message', async ({ page }) => {
    await page.route(`**/api/assistant/${SLUG}`, (route) =>
      route.fulfill({ status: 429, json: { error: { code: 'RATE_LIMITED', message: "You’ve sent a lot of messages in the last hour. Try again later." } } }),
    );
    await page.goto(`/s/${SLUG}?assistant=1`);
    const region = consoleRegion(page, false);
    await region.getByRole('button', { name: /shipped to me$/ }).click();
    await expect(region.getByRole('alert')).toHaveText("You’ve sent a lot of messages in the last hour. Try again later.");
  });

  test("network failure: “The shop didn't answer. Try again.”", async ({ page }) => {
    await page.route(`**/api/assistant/${SLUG}`, (route) => route.abort('connectionrefused'));
    await page.goto(`/s/${SLUG}?assistant=1`);
    const region = consoleRegion(page, false);
    await region.getByRole('button', { name: /shipped to me$/ }).click();
    await expect(region.getByRole('alert')).toHaveText("The shop didn’t answer. Try again.");
    await expect(region.getByRole('button', { name: 'Start over' })).toBeVisible();
  });

  test('no Anthropic key: the explanation from the server, pointing at the agent door', async ({ page }) => {
    const message =
      'This assistant needs an Anthropic API key on the server (ANTHROPIC_API_KEY). Any MCP client, like Claude Code or Claude Desktop, can still order through the agent door below.';
    await page.route(`**/api/assistant/${SLUG}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson([{ type: 'error', message }]) }),
    );
    await page.goto(`/s/${SLUG}?assistant=1`);
    const region = consoleRegion(page, false);
    await region.getByRole('button', { name: /shipped to me$/ }).click();
    await expect(region.getByRole('alert')).toHaveText(message);
  });

  test('a full conversation offers a new one', async ({ page }) => {
    const message = 'This conversation is full. Start a new one to keep ordering.';
    await page.route(`**/api/assistant/${SLUG}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: ndjson([{ type: 'session', id: 'asst_full' }, { type: 'error', message, code: 'CONVERSATION_FULL' }]),
      }),
    );
    await page.goto(`/s/${SLUG}?assistant=1`);
    const region = consoleRegion(page, false);
    await region.getByRole('button', { name: /shipped to me$/ }).click();
    await expect(region.getByRole('alert')).toHaveText(message);
    await region.getByRole('button', { name: 'Start a new conversation' }).click();
    await expect(region.getByRole('list', { name: 'Try asking' })).toBeVisible();
  });

  test('a paused shop says so; sold-out and ask-in-person items are marked', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`/s/${edgeShop.slug}`);
    await settle(page);
    await expect(page.getByRole('status').filter({ hasText: 'Not taking orders right now' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Lemon bar' })).toContainText('Sold out today');
    await expect(page.getByRole('listitem').filter({ hasText: 'Market fish' })).toContainText('Ask in person');
    await expect(page.getByRole('listitem').filter({ hasText: 'Iced tea' })).toContainText(/L\s*\$4\.50/);
    await expectAccessible(page);
  });

  test('the shop’s picture is a picture, never letters, and nothing covers it at 390, 768 or 1440', async ({ page }) => {
    for (const [slug, width] of [
      [SLUG, 390], [SLUG, 768], [SLUG, 1440],
      [edgeShop.slug, 390], [edgeShop.slug, 1440],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/s/${slug}`);
      await settle(page);
      // The demo shop shows its cover (cropped square) over the cover's edge; the edge shop, with no photos and no
      // stored categories, the drawing of its most common guessed category, and its items' drawings on their tints.
      const avatar = page.locator('main [data-avatar], main [data-illustration]').first();
      await expect(avatar).toBeVisible();
      if (slug === edgeShop.slug) await expect(page.locator('main [data-illustration] use').first()).toHaveAttribute('href', /^\/illustrations\.svg#[a-z_-]+$/);
      const box = (await avatar.boundingBox())!;
      const top = await page.evaluate(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit?.closest('[data-avatar], [data-illustration]');
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      expect(top, `${slug} at ${width}`).toBe(true);
    }
  });

  test('at 390, each section tab lands its heading below the sticky tabs and above the order bar', async ({ page }) => {
    // A tall phone and a short one (browser chrome showing): the last section can't scroll to the top on either.
    for (const height of [PHONE.height, 560]) {
      await page.setViewportSize({ width: PHONE.width, height });
      await page.goto(`/s/${SLUG}`);
      await settle(page);
      const tabs = page.getByRole('navigation', { name: 'Menu sections' });
      const bar = page.locator('[data-order-bar]');
      const links = tabs.getByRole('link');
      const count = await links.count();
      expect(count).toBeGreaterThan(1);
      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const name = (await link.innerText()).trim();
        await link.click();
        const heading = page.getByRole('heading', { level: 3, name, exact: true });
        // Let the jump finish (smooth scrolling or not), then compare the boxes in the viewport.
        await expect(async () => {
          const [h, t, b] = await Promise.all([heading.boundingBox(), tabs.boundingBox(), bar.boundingBox()]);
          expect(h && t && b, name).toBeTruthy();
          expect(h!.y, `${name} at ${height}: below the tabs`).toBeGreaterThanOrEqual(t!.y + t!.height - 1);
          expect(h!.y + h!.height, `${name} at ${height}: above the order bar`).toBeLessThanOrEqual(b!.y + 1);
        }).toPass({ timeout: 5_000 });
      }
    }
  });

  test('switching to reduced motion shows every menu section at once, also below the fold (nothing waits to scroll in)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/s/${SLUG}`);
    await page.waitForLoadState('load');
    // Switched on after the page has hydrated (as a visitor might, and as the screenshot helper does): sections already
    // waiting below the fold for their entrance must show too. The last one starts far below a 1440x900 first screen;
    // no scrolling happens in this test.
    await page.waitForTimeout(1_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const coffee = page.getByRole('heading', { name: 'Coffee', level: 3 });
    await expect(coffee).toBeAttached();
    expect((await coffee.boundingBox())!.y).toBeGreaterThan(900);
    await expect(async () => {
      const hidden = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-slot="reveal"], [data-slot="stagger-item"]')).filter(
          (el) => Number(getComputedStyle(el).opacity) < 1,
        ).length,
      );
      expect(hidden).toBe(0);
    }).toPass({ timeout: 5_000 });
  });

  test('the order card counts its total up once; with reduced motion it shows the total at once', async ({ page }) => {
    for (const reduced of [false, true]) {
      await page.setViewportSize(DESKTOP);
      await replayConsole(page);
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await page.goto(`/s/${SLUG}`);
      await page.evaluate(() => sessionStorage.clear());
      const region = await openConsole(page, false);
      // Sample the total's text as the card appears: with motion it runs from $0.00 up; reduced, it is final at once.
      await page.evaluate(() => {
        const seen: string[] = ((window as unknown as { __totals: string[] }).__totals = []);
        new MutationObserver(() => {
          const el = document.querySelector('[data-slot="count-up"]');
          if (el) seen.push(el.textContent ?? '');
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
      });
      await orderThroughConsole(region);
      const total = region.locator('[data-slot="count-up"]');
      await expect(total).toHaveText('$27.00');
      const seen = await page.evaluate(() => (window as unknown as { __totals: string[] }).__totals);
      if (reduced) expect(seen.every((t) => t === '$27.00'), seen.join(' | ')).toBe(true);
      else expect(seen.some((t) => t !== '$27.00'), 'counted up').toBe(true);
    }
  });

  test('on a phone the price sits directly under the item name', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`/s/${SLUG}`);
    await settle(page);
    const row = page.locator('[data-menu-item="Almond croissant"]');
    const name = (await row.getByRole('heading', { level: 4 }).boundingBox())!;
    const price = (await row.getByText('$5.00').boundingBox())!;
    expect(price.y).toBeGreaterThanOrEqual(name.y + name.height - 1);
    expect(price.y - (name.y + name.height)).toBeLessThanOrEqual(8);
  });

  test('draft and unknown shops are 404', async ({ page }) => {
    const res = await page.goto('/s/no-such-shop-anywhere');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'No shop here' })).toBeVisible();
  });
});

// ---- receipt -------------------------------------------------------------------------------------------

for (const [label, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`receipt at ${label} px`, () => {
    test.use({ viewport });

    test('waiting for approval: the PayPal button again', async ({ page }) => {
      await page.goto(`/o/${fx.awaiting.id}`);
      await settle(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Waiting for your approval' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Approve $27.00 on PayPal' })).toHaveAttribute('href', fx.awaiting.approvalUrl);
      await expect(page.getByText(`Order ${fx.awaiting.number}`)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to the assistant' })).toHaveAttribute('href', `/s/${SLUG}?assistant=1`);
      await expectAccessible(page);
    });

    test('paid', async ({ page }) => {
      await page.goto(`/o/${fx.paid.id}`);
      await settle(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Paid. Marigold Bakehouse has your order.' })).toBeVisible();
      await expect(page.getByText('Marigold Bakehouse will ship it to the address you gave PayPal.')).toBeVisible();
      await expect(page.getByRole('link', { name: /PayPal/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Back to shop' })).toHaveAttribute('href', `/s/${SLUG}`);
      await expectAccessible(page);
    });

    test('one column: the state with its action first, the summary under it', async ({ page }) => {
      await page.goto(`/o/${fx.awaiting.id}`);
      await settle(page);
      const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
      const action = (await page.getByRole('link', { name: 'Approve $27.00 on PayPal' }).boundingBox())!;
      const summary = (await page.getByRole('region', { name: 'Marigold Bakehouse' }).boundingBox())!;
      expect(summary.y).toBeGreaterThanOrEqual(action.y + action.height);
      expect(Math.abs(summary.x - heading.x)).toBeLessThanOrEqual(1);
      expect(summary.width).toBeLessThanOrEqual(36 * 16);
    });

    test('cancelled', async ({ page }) => {
      await page.goto(`/o/${fx.cancelled.id}`);
      await settle(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Order cancelled' })).toBeVisible();
      await expect(page.getByText(/Pickup: Sat & Sun pickup/)).toBeVisible();
      await expectAccessible(page);
    });
  });
}

test.describe('receipt behaviour', () => {
  test.use({ viewport: PHONE });

  for (const [viewport, size] of [['390', PHONE], ['a small phone', { width: 360, height: 640 }]] as const) {
    test(`on ${viewport}, the primary action is on the first screen`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/o/${fx.awaiting.id}`);
      await settle(page);
      const approve = (await page.getByRole('link', { name: 'Approve $27.00 on PayPal' }).boundingBox())!;
      expect(approve.y + approve.height).toBeLessThanOrEqual(size.height);
      await page.goto(`/o/${fx.paid.id}`);
      await settle(page);
      const back = (await page.getByRole('link', { name: 'Back to shop' }).boundingBox())!;
      expect(back.y + back.height).toBeLessThanOrEqual(size.height);
    });
  }

  test('an unknown order says so with a 404', async ({ page }) => {
    const res = await page.goto('/o/ord_doesnotexist000');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: "We couldn’t find that order" })).toBeVisible();
    await settle(page);
  });

  test('re-reads the order every 3 s and shows Paid when it lands', async ({ page }) => {
    await page.goto(`/o/${fx.polling.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Waiting for your approval' })).toBeVisible();
    markPaid(fx.polling);
    await expect(page.getByRole('heading', { level: 1, name: 'Paid. Marigold Bakehouse has your order.' })).toBeVisible({ timeout: 10_000 });
  });

  test('PayPal refused the approved payment: says so, no PayPal button, stops re-reading', async ({ page }) => {
    const reads: string[] = [];
    page.on('request', (r) => r.url().includes('/api/orders/') && reads.push(r.url()));
    await page.goto(`/o/${fx.refused.id}`);
    await settle(page);
    await expect(page.getByRole('heading', { level: 1, name: "PayPal didn’t complete the payment" })).toBeVisible();
    await expect(page.getByText(/so nothing was charged\. Contact Marigold Bakehouse/)).toBeVisible();
    await expect(page.getByRole('link', { name: /PayPal/ })).toHaveCount(0);
    await expect(page.getByText('This page updates by itself.')).toHaveCount(0);
    await expectAccessible(page);
    await page.waitForTimeout(3500);
    expect(reads).toEqual([]);
  });

  test('the PayPal cancel URL cancels the order and shows the receipt', async ({ page }) => {
    await page.goto(`/api/paypal/cancel?o=${fx.cancelRoute.id}&token=${fx.cancelRoute.paypalOrderId}`);
    await expect(page).toHaveURL(new RegExp(`/o/${fx.cancelRoute.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Order cancelled' })).toBeVisible();
  });

  test('Back to the assistant brings the conversation back, and the approval card follows the order to Paid', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await replayConsole(page, fx.back);
    await page.goto(`/s/${SLUG}`);
    const region = await openConsole(page, false);
    await orderThroughConsole(region);

    // Still waiting for approval: the way back keeps the PayPal button.
    await page.goto(`/o/${fx.back.id}`);
    await page.getByRole('link', { name: 'Back to the assistant' }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${SLUG}\\?assistant=1$`));
    let again = consoleRegion(page, false);
    await expect(again.getByRole('link', { name: 'Approve $27.00 on PayPal' })).toHaveAttribute('href', fx.back.approvalUrl);
    await expect(again.getByRole('button', { name: 'Did my payment go through?' })).toBeVisible();

    // Paid on PayPal: back in the console, the card no longer offers to approve; it links the receipt.
    markPaid(fx.back);
    await page.goto(`/o/${fx.back.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Paid. Marigold Bakehouse has your order.' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to the assistant' }).click();
    again = consoleRegion(page, false);
    await expect(again.getByRole('link', { name: 'Paid · View receipt' })).toHaveAttribute('href', `/o/${fx.back.id}`);
    await expect(again.getByRole('link', { name: /Approve .* on PayPal/ })).toHaveCount(0);
    await expect(again.getByRole('button', { name: 'Did my payment go through?' })).toHaveCount(0);
    await expectAccessible(page);
    await again.getByRole('link', { name: 'Paid · View receipt' }).scrollIntoViewIfNeeded();
    await settle(page);
  });
});
