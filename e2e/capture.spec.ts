// The capture gate (spec §12): the money path end to end against the real PayPal sandbox, no mocks.
//
//   1. A seller starts a shop from the sample menu, Shelfie reads it, she turns on shipping ($8 flat) and publishes:
//      real products in the PayPal sandbox catalog.
//   2. An agent orders over the shop's real agent door (MCP over HTTP): get_shop_info → list_products →
//      create_order (shipped, with a nut-allergy note) → PayPal approval link.
//   3. A buyer approves on PayPal's sandbox page by guest card checkout (e2e/paypal-buyer.ts); PayPal returns the
//      browser to Shelfie's return URL, which captures the payment.
//   4. The receipt says Paid; the capture id is stored, and PayPal itself reports the order COMPLETED with that capture.
//   5. The seller's dashboard shows the order paid, with the AI brief (written by Claude from PayPal's record).
//   6. The seller adds USPS tracking on the order page → a real PayPal tracker (Agent Toolkit) → the order is shipped.
//   7. get_order_status over the agent door returns the tracking number.
//
// Runs whenever PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY are set (.env is loaded here and by the app); guest checkout
// needs no buyer login. With ANTHROPIC_API_KEY the menu is read live and the brief must come from the Claude agent.
// Each run makes a new shop, sandbox products, a ~$27 sandbox order and a tracker.
//
//   E2E_PORT=3110 DATABASE_PATH=data/e2e-capture.db npx playwright test e2e/capture.spec.ts
// Refresh the committed screenshots (docs/judge/screenshots/capture/):
//   SHELFIE_SCREENSHOTS=1 E2E_PORT=3110 DATABASE_PATH=data/e2e-capture.db npx playwright test e2e/capture.spec.ts
//
// The app must send PayPal's buyer back to this server: playwright.config.ts gives the server it starts
// APP_URL=http://localhost:<E2E_PORT>. The spec checks that before it creates anything.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { config } from 'dotenv';
import fs from 'node:fs';
import { DESKTOP, settle } from './helpers';
import { payAsGuest } from './paypal-buyer';

config({ quiet: true });

const env = (name: string) => process.env[name]?.trim() || null;
const HAS_PAYPAL = Boolean(env('PAYPAL_CLIENT_ID') && env('PAYPAL_SECRET_KEY'));
const HAS_CLAUDE = Boolean(env('ANTHROPIC_API_KEY'));

const OUT = 'docs/judge/screenshots/capture';
/** Screenshots are committed, so only SHELFIE_SCREENSHOTS=1 rewrites them; every run attaches its own to the report. */
const SHOTS = process.env.SHELFIE_SCREENSHOTS === '1';
const SHIPPING_FEE_CENTS = 800;
const BUYER_NOTE = 'Nut allergy in our house, so please pack this away from anything with nuts. Would love it by Friday!';

// ---- small helpers -------------------------------------------------------------------------------------------

const cents = (usd: string) => Math.round(Number(usd) * 100);
const usd = (c: number) => (c / 100).toFixed(2);

function log(line: string) {
  // Sandbox ids only (order, capture, tracker); never a value from .env.
  console.log(`[capture-gate] ${line}`);
}

async function shoot(page: Page, info: TestInfo, name: string, fullPage = false) {
  const file = `${name}-1440.png`;
  const path = info.outputPath(file);
  await page.screenshot({ path, fullPage, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
  if (SHOTS) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.copyFileSync(path, `${OUT}/${file}`);
  }
}

/** Reads PayPal's own record from the test, to check what Shelfie stored against the source of truth. */
async function paypalGet<T>(path: string): Promise<T> {
  const base = 'https://api-m.sandbox.paypal.com';
  const basic = Buffer.from(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_SECRET_KEY')}`).toString('base64');
  const tok = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!tok.ok) throw new Error(`PayPal OAuth failed: HTTP ${tok.status}`);
  const { access_token } = (await tok.json()) as { access_token: string };
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`PayPal GET ${path.split('?')[0]} failed: HTTP ${res.status} ${res.headers.get('paypal-debug-id') ?? ''}`);
  return (await res.json()) as T;
}

// ---- the agent door --------------------------------------------------------------------------------------------

interface ShopInfo {
  shop_name: string;
  accepting_orders: boolean;
  fulfillment: { modes: string[]; shipping_fee: string | null };
}
interface ProductList {
  sections: { name: string; items: { item_id: string; name: string; orderable: boolean; options: { option_id: string; label: string | null; price: string | null }[] }[] }[];
}
interface CreatedOrder {
  order_ref: string;
  order_number: string;
  status: string;
  fulfillment: string;
  lines: { name: string; quantity: number; unit_price: string; line_total: string }[];
  shipping: string;
  total: string;
  approval_url: string | null;
}
interface OrderStatusOut {
  status: string;
  paid_at: string | null;
  tracking: { carrier: string; tracking_number: string; status: string | null }[];
  message: string;
}

async function openDoor(origin: string, slug: string): Promise<Client> {
  const client = new Client({ name: 'shelfie-capture-gate', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/s/${slug}/mcp`)));
  return client;
}

async function callTool<T>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 });
  if (r.isError) throw new Error(`${name} failed: ${JSON.stringify(r.content).slice(0, 500)}`);
  return r.structuredContent as T;
}

// ---- the seller's setup, through the app's own API (what the setup screens call) --------------------------------

interface LiveShop {
  id: string;
  slug: string;
}

async function createLiveShop(api: APIRequestContext, origin: string): Promise<LiveShop> {
  const made = await api.post(`${origin}/api/shops`, { data: { sample: 'marigold-bakehouse' }, timeout: 120_000 });
  expect(made.status(), await made.text()).toBe(201);
  const { shopId } = (await made.json()) as { shopId: string };

  // Reading the menu: Claude live when the server has ANTHROPIC_API_KEY, the recorded reading otherwise.
  const read = await api.post(`${origin}/api/shops/${shopId}/extract`, { timeout: 240_000 });
  const reading = (await read.json()) as { catalog?: { items: unknown[]; needsAttention: number } };
  expect(read.status(), JSON.stringify(reading).slice(0, 300)).toBe(200);
  expect(reading.catalog?.items.length ?? 0).toBeGreaterThan(0);

  // "Also ship orders" with a flat $8 fee.
  const patched = await api.patch(`${origin}/api/shops/${shopId}`, {
    data: { fulfillment: 'both', shippingFeeCents: SHIPPING_FEE_CENTS },
    timeout: 60_000,
  });
  expect(patched.status(), await patched.text()).toBe(200);

  // Publish: items the reading had no doubts about go to the PayPal catalog; flagged ones stay off the shop.
  const pub = await api.post(`${origin}/api/shops/${shopId}/publish`, { timeout: 240_000 });
  expect(pub.status()).toBe(200);
  const events = (await pub.text())
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { type: string; published?: number; failed?: unknown[]; shop?: { status: string; slug: string }; ok?: boolean; paypalProductId?: string });
  const done = events.find((e) => e.type === 'done');
  expect(done, JSON.stringify(events.at(-1))).toBeTruthy();
  expect(done!.shop!.status).toBe('live');
  expect(done!.failed).toEqual([]);
  expect(done!.published!).toBeGreaterThan(0);
  const products = events.filter((e) => e.type === 'item' && e.ok).map((e) => e.paypalProductId!);
  expect(products.every((p) => /^[A-Z0-9-]+$/.test(p) && !p.startsWith('PROD-FAKE'))).toBe(true);
  log(`shop ${shopId} live at /s/${done!.shop!.slug}: ${products.length} PayPal sandbox products (${products.slice(0, 3).join(', ')}…)`);
  return { id: shopId, slug: done!.shop!.slug };
}

// ---- the gate ------------------------------------------------------------------------------------------------------

test.describe('capture gate (real PayPal sandbox)', () => {
  test.skip(!HAS_PAYPAL, 'Needs PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY (sandbox) in .env.');
  test.use({ viewport: DESKTOP, locale: 'en-US', timezoneId: 'America/Los_Angeles' });

  test('agent order → PayPal guest approval → Paid → AI brief → USPS tracking → get_order_status', async ({ page, baseURL }, info) => {
    test.setTimeout(12 * 60_000);
    const origin = baseURL!;
    const api = page.context().request;

    // PayPal's return URL is built from the server's APP_URL, so it has to be this server or PayPal sends the buyer
    // elsewhere. The shop page shows the agent door at `${APP_URL}/s/<slug>/mcp`, which makes it visible.
    let shop!: LiveShop;
    await test.step('1. a live shop with shipping, published to the PayPal sandbox catalog', async () => {
      shop = await createLiveShop(api, origin);
      await page.goto(`/s/${shop.slug}`);
      await expect(page.locator('#agent-door code').first()).toHaveText(`${origin}/s/${shop.slug}/mcp`);
    });

    // ---- 2. the agent orders over the real agent door ----
    const door = await openDoor(origin, shop.slug);
    let order!: CreatedOrder;
    let shopName = '';
    try {
      await test.step('2. MCP: get_shop_info → list_products → create_order (shipped, nut-allergy note)', async () => {
        const info_ = await callTool<ShopInfo>(door, 'get_shop_info');
        shopName = info_.shop_name;
        expect(info_.accepting_orders).toBe(true);
        expect(info_.fulfillment.modes).toEqual(expect.arrayContaining(['pickup', 'shipping']));
        expect(info_.fulfillment.shipping_fee).toBe(usd(SHIPPING_FEE_CENTS));

        const list = await callTool<ProductList>(door, 'list_products');
        const orderable = list.sections.flatMap((s) => s.items).filter((i) => i.orderable && i.options[0]?.price);
        expect(orderable.length).toBeGreaterThan(0);
        // Two almond croissants and a sourdough loaf (spec §3), or whatever this reading made orderable.
        const almond = orderable.find((i) => /almond/i.test(i.name)) ?? orderable[0];
        const bread = orderable.find((i) => i !== almond && /sourdough|loaf/i.test(i.name)) ?? orderable.find((i) => i !== almond);
        const picks = [{ item: almond, quantity: 2 }, ...(bread ? [{ item: bread, quantity: 1 }] : [])];

        order = await callTool<CreatedOrder>(door, 'create_order', {
          items: picks.map(({ item, quantity }) => ({ item_id: item.item_id, option_id: item.options[0].option_id, quantity })),
          fulfillment: 'shipping',
          buyer_name: 'Dana',
          buyer_note: BUYER_NOTE,
          client_request_id: `capture-gate-${Date.now()}`,
        });
        const itemsCents = picks.reduce((t, { item, quantity }) => t + cents(item.options[0].price!) * quantity, 0);
        expect(order.status).toBe('awaiting_approval');
        expect(order.fulfillment).toBe('shipping');
        expect(order.shipping).toBe(usd(SHIPPING_FEE_CENTS));
        expect(order.total).toBe(usd(itemsCents + SHIPPING_FEE_CENTS));
        expect(order.approval_url).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\/checkoutnow\?token=[A-Z0-9]+$/);
        log(`order ${order.order_number} (${order.order_ref}) $${order.total}: ${order.lines.map((l) => `${l.quantity} × ${l.name}`).join(', ')} + shipping`);
      });
    } finally {
      await door.close();
    }
    const paypalOrderId = new URL(order.approval_url!).searchParams.get('token')!;
    log(`PayPal order ${paypalOrderId}`);

    // ---- 3. the buyer approves on PayPal (guest card checkout) ----
    await test.step('3. PayPal sandbox: guest card checkout, back to Shelfie', async () => {
      const returned = await payAsGuest(page, order.approval_url!, {
        returnOrigin: origin,
        testInfo: info,
        shot: (p, name) => shoot(p, info, name),
      });
      expect(returned.startsWith(`${origin}/api/paypal/return?o=${order.order_ref}`), returned).toBe(true);
      await page.waitForURL(`${origin}/o/${order.order_ref}`, { timeout: 90_000 });
    });

    // ---- 4. Paid on the receipt; the capture is stored and matches PayPal's record ----
    let captureId = '';
    await test.step('4. receipt shows Paid; capture id stored and COMPLETED at PayPal', async () => {
      await expect(page.getByRole('heading', { level: 1, name: `Paid. ${shopName} has your order.` })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(`Order ${order.order_number}`)).toBeVisible();
      await settle(page);
      await shoot(page, info, 'receipt-paid', true);

      const res = await api.get(`${origin}/api/shops/${shop.id}/orders`);
      const stored = ((await res.json()) as { orders: { id: string; status: string; captureId: string | null; paypalOrderId: string; paidAt: string | null }[] }).orders.find(
        (o) => o.id === order.order_ref,
      )!;
      expect(stored.status).toBe('paid');
      expect(stored.paypalOrderId).toBe(paypalOrderId);
      expect(stored.paidAt).not.toBeNull();
      expect(stored.captureId).toMatch(/^[A-Z0-9]{10,}$/);
      captureId = stored.captureId!;

      const pp = await paypalGet<{
        status: string;
        purchase_units: { custom_id?: string; amount: { value: string }; payments?: { captures?: { id: string; status: string; amount: { value: string } }[] } }[];
      }>(`/v2/checkout/orders/${paypalOrderId}`);
      const cap = pp.purchase_units[0].payments?.captures?.[0];
      expect(pp.status).toBe('COMPLETED');
      expect(pp.purchase_units[0].custom_id).toBe(order.order_ref);
      expect(cap?.id).toBe(captureId);
      expect(cap?.status).toBe('COMPLETED');
      expect(cap?.amount.value).toBe(order.total);
      log(`capture ${captureId} COMPLETED at PayPal, $${cap?.amount.value}`);
    });

    // ---- 5. the seller sees it paid, with the AI brief ----
    await test.step('5. dashboard: paid, with the AI brief', async () => {
      type Brief = { headline: string; buyer_requests: { kind: string; text: string }[]; flags: { severity: string; text: string }[] };
      let brief: { brief: Brief | null; briefSource: string | null } = { brief: null, briefSource: null };
      await expect
        .poll(
          async () => {
            const res = await api.get(`${origin}/api/shops/${shop.id}/orders`);
            const o = ((await res.json()) as { orders: { id: string; brief: Brief | null; briefSource: string | null }[] }).orders.find((x) => x.id === order.order_ref)!;
            brief = { brief: o.brief, briefSource: o.briefSource };
            return o.brief !== null;
          },
          { timeout: 180_000, intervals: [3_000] },
        )
        .toBe(true);
      const b = brief.brief!;
      log(`brief (${brief.briefSource}): "${b.headline}"; requests ${JSON.stringify(b.buyer_requests)}; flags ${JSON.stringify(b.flags)}`);
      info.annotations.push({ type: 'brief', description: `${brief.briefSource}: ${b.headline} | flags: ${b.flags.map((f) => `${f.severity}: ${f.text}`).join(' / ')}` });
      if (HAS_CLAUDE) {
        expect(brief.briefSource).toBe('agent');
        expect(b.buyer_requests.map((r) => r.kind)).toContain('allergy');
      } else {
        expect(brief.briefSource).toBe('template');
      }

      await page.goto(`/shops/${shop.id}`);
      const card = page.locator(`[data-order="${order.order_number}"]`);
      await expect(card).toBeVisible();
      await expect(card).toContainText('Paid');
      await expect(card).toContainText('Ship to San Jose, CA');
      await expect(card).toContainText(HAS_CLAUDE ? 'AI brief' : 'Summary');
      await expect(card).toContainText(b.headline);
      await settle(page);
      await shoot(page, info, 'dashboard-paid-brief');

      await page.goto(`/shops/${shop.id}/orders/${order.order_ref}`);
      await expect(page.getByTestId('brief-headline')).toHaveText(b.headline);
      await expect(page.getByTestId('PayPal-transaction-ID')).toHaveText(captureId);
      await expect(page.locator('section[aria-labelledby="timeline-title"]')).toContainText('Payment received');
      await settle(page);
      await shoot(page, info, 'order-paid-brief', true);
    });

    // ---- 6. the seller adds tracking; it goes to PayPal through the Agent Toolkit ----
    // A USPS-shaped number (22 digits, 9400 1118 prefix), unique per run.
    const trackingNumber = `9400111${Date.now().toString().slice(-13)}${Math.floor(Math.random() * 90 + 10)}`;
    await test.step('6. Add tracking (USPS) → PayPal tracker → shipped', async () => {
      const form = page.getByRole('form', { name: 'Add tracking' });
      await form.getByLabel('Carrier').selectOption('USPS');
      await form.getByLabel('Tracking number').fill(trackingNumber);
      await form.getByRole('button', { name: 'Send tracking to PayPal' }).click();
      const sent = page.getByRole('status').filter({ hasText: /Sent to PayPal: USPS/ });
      const refused = page.getByRole('alert').filter({ hasText: /PayPal|tracking/ });
      await expect(sent.or(refused).first()).toBeVisible({ timeout: 120_000 });
      if (await refused.isVisible()) throw new Error(`Add tracking failed: ${await refused.innerText()}`);
      await expect(sent).toContainText(trackingNumber);

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Shipped', exact: true })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Tracking' })).toContainText(trackingNumber);
      await expect(page.locator('section[aria-labelledby="timeline-title"]')).toContainText(`Tracking added: USPS ${trackingNumber}`);
      await settle(page);
      await shoot(page, info, 'order-shipped', true);

      const trackers = await paypalGet<{ trackers?: { transaction_id: string; tracking_number: string; status: string; carrier: string }[] }>(
        `/v1/shipping/trackers?transaction_id=${captureId}`,
      );
      const t = trackers.trackers?.find((x) => x.tracking_number === trackingNumber);
      expect(t, JSON.stringify(trackers).slice(0, 400)).toBeTruthy();
      expect(t!.status).toBe('SHIPPED');
      expect(t!.carrier).toBe('USPS');
      log(`PayPal tracker ${captureId}-${trackingNumber} ${t!.carrier} ${t!.status}`);
    });

    // ---- 7. the agent asks "where's my order?" ----
    await test.step('7. MCP get_order_status returns the tracking number', async () => {
      const again = await openDoor(origin, shop.slug);
      try {
        const status = await callTool<OrderStatusOut>(again, 'get_order_status', { order_ref: order.order_ref });
        expect(status.status).toBe('fulfilled');
        expect(status.paid_at).not.toBeNull();
        expect(status.tracking).toEqual([{ carrier: 'USPS', tracking_number: trackingNumber, status: 'SHIPPED' }]);
        expect(status.message).toContain(trackingNumber);
        log(`get_order_status: ${status.status} · ${status.message}`);
      } finally {
        await again.close();
      }
    });
  });
});
