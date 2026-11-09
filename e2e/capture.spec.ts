// The capture gate (spec §12): the money path end to end against the real PayPal sandbox, no mocks. Two gates:
//
// Gate 1, seller payout (spec §8a). Needs PAYPAL_SANDBOX_SELLER_EMAIL and the sandbox buyer's login
// (PAYPAL_SANDBOX_BUYER_EMAIL / _PASSWORD) in .env:
//   1. A seller starts a shop from the sample menu, Shelfie reads it, she turns on shipping ($8 flat), gives her PayPal
//      email (the sandbox seller) and publishes: real products in the PayPal sandbox catalog.
//   2. An agent orders over the shop's real agent door (MCP over HTTP): get_shop_info → list_products →
//      create_order (shipped, with a nut-allergy note) → PayPal approval link.
//   3. The buyer logs in to PayPal (wallet checkout, e2e/paypal-buyer.ts) and pays; PayPal returns the browser to
//      Shelfie's return URL, which captures the payment.
//   4. The receipt says Paid and who was paid; PayPal's own record names the seller as payee, capture COMPLETED.
//   5. The seller's dashboard shows the order paid, with the AI brief (written by Claude from PayPal's record).
//   6. The seller adds USPS tracking. PayPal refuses tracking from the platform on the seller's capture (spec §8a), so
//      it is saved in Shelfie and the seller is told to add it in PayPal too.
//   7. get_order_status over the agent door returns the tracking number.
//
// Gate 2, the platform-paid demo shop (spec §8a's one fallback). Needs only the app keys:
//   the seeded demo shop with no seller email → the same door order → guest card checkout → Paid ("Shelfie's demo
//   PayPal account") → capture COMPLETED at PayPal → tracking sent to PayPal through the Agent Toolkit (SHIPPED) →
//   get_order_status. The seed here uses --reset, so run the gate against its own database.
//
// With ANTHROPIC_API_KEY the menu is read live and the brief must come from the Claude agent. Each run makes a new
// shop, sandbox products, two sandbox orders (~$27 each) and trackers. Nothing from .env is ever logged.
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
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { getPayPal } from '@/lib/paypal';
import { seedDemoShop } from '../scripts/seed-demo';
import { DESKTOP, settle } from './helpers';
import { payAsGuest, payWithPayPalLogin } from './paypal-buyer';

config({ quiet: true });

const env = (name: string) => process.env[name]?.trim() || null;
const HAS_PAYPAL = Boolean(env('PAYPAL_CLIENT_ID') && env('PAYPAL_SECRET_KEY'));
const HAS_CLAUDE = Boolean(env('ANTHROPIC_API_KEY'));
const SELLER = env('PAYPAL_SANDBOX_SELLER_EMAIL')?.toLowerCase() ?? null;
const BUYER = env('PAYPAL_SANDBOX_BUYER_EMAIL') && env('PAYPAL_SANDBOX_BUYER_PASSWORD')
  ? { email: env('PAYPAL_SANDBOX_BUYER_EMAIL')!, password: env('PAYPAL_SANDBOX_BUYER_PASSWORD')! }
  : null;
/** Same as OWNER_COOKIE_PREFIX in src/lib/auth/owner.ts (not imported: it pulls in next/headers). */
const ownerCookieName = (shopId: string) => `shelfie_owner_${shopId}`;

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

const AGENT = 'shelfie-capture-gate';

/**
 * Connects like the app's own buyer console: the agent names itself with `?agent=`. The stateless door builds a fresh
 * server per HTTP request, so the name from MCP initialize (clientInfo) is gone by the time create_order arrives and
 * the order would otherwise be attributed to the User-Agent ("node"). See the Task 9a report.
 */
async function openDoor(origin: string, slug: string): Promise<Client> {
  const client = new Client({ name: AGENT, version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/s/${slug}/mcp?agent=${AGENT}`)));
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

async function createLiveShop(api: APIRequestContext, origin: string, payeeEmail: string): Promise<LiveShop> {
  const made = await api.post(`${origin}/api/shops`, { data: { sample: 'marigold-bakehouse' }, timeout: 120_000 });
  expect(made.status(), await made.text()).toBe(201);
  const { shopId } = (await made.json()) as { shopId: string };

  // Reading the menu: Claude live when the server has ANTHROPIC_API_KEY, the recorded reading otherwise.
  const read = await api.post(`${origin}/api/shops/${shopId}/extract`, { timeout: 240_000 });
  const reading = (await read.json()) as { catalog?: { items: unknown[]; needsAttention: number } };
  expect(read.status(), JSON.stringify(reading).slice(0, 300)).toBe(200);
  expect(reading.catalog?.items.length ?? 0).toBeGreaterThan(0);

  // "Also ship orders" with a flat $8 fee, and "Your PayPal email" (where buyers' money goes; required to publish).
  const patched = await api.patch(`${origin}/api/shops/${shopId}`, {
    data: { fulfillment: 'both', shippingFeeCents: SHIPPING_FEE_CENTS, payeeEmail },
    timeout: 60_000,
  });
  // The response holds the email: report only the status on failure.
  expect(patched.status()).toBe(200);

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

// ---- the gate ----------------------------------------------------------------------------------------------------

type Brief = { headline: string; buyer_requests: { kind: string; text: string }[]; flags: { severity: string; text: string }[] };
interface StoredOrder {
  id: string;
  status: string;
  captureId: string | null;
  paypalOrderId: string;
  paidAt: string | null;
  brief: Brief | null;
  briefSource: string | null;
}

async function storedOrder(api: APIRequestContext, origin: string, shopId: string, ref: string): Promise<StoredOrder> {
  const res = await api.get(`${origin}/api/shops/${shopId}/orders`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { orders: StoredOrder[] }).orders.find((o) => o.id === ref)!;
}

interface GateRun {
  /** 'seller': paid into the shop's own PayPal account (wallet login). 'platform': the demo shop (guest card). */
  mode: 'seller' | 'platform';
  shop: LiveShop;
  /** Screenshot name prefix ('' keeps the platform gate's historical names). */
  prefix: string;
}

/**
 * In the seller gate two sandbox logins reach the seller's own pages: the seller's PayPal email ("Paid to") and the
 * buyer's PayPal email (PayPal's payer record, shown under Buyer). Both are replaced on screen before a screenshot is
 * taken, and the replacement says so, so committed screenshots never publish a sandbox login.
 */
async function redactSandboxLogins(page: Page): Promise<void> {
  const logins = [SELLER, BUYER?.email.toLowerCase()].filter((e): e is string => Boolean(e));
  await page.evaluate((emails) => {
    const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const email of emails) {
        if (n.nodeValue && n.nodeValue.toLowerCase().includes(email)) {
          n.nodeValue = n.nodeValue.replace(new RegExp(esc(email), 'gi'), '[sandbox login, hidden in this screenshot]');
        }
      }
    }
    for (const a of Array.from(document.querySelectorAll('a[href^="mailto:"]'))) {
      if (emails.some((e) => a.getAttribute('href')!.toLowerCase().includes(e))) a.setAttribute('href', 'mailto:hidden');
    }
  }, logins);
}

/** Steps 2–7, shared by both gates. */
async function runGate(page: Page, info: TestInfo, origin: string, run: GateRun): Promise<void> {
  const api = page.context().request;
  const { shop, mode, prefix } = run;
  const shot = (p: Page, name: string, full = false) => shoot(p, info, `${prefix}${name}`, full);

  // ---- 2. the agent orders over the real agent door ----
  const door = await openDoor(origin, shop.slug);
  let order!: CreatedOrder;
  let shopName = '';
  try {
    await test.step('2. MCP: get_shop_info → list_products → create_order (shipped, nut-allergy note)', async () => {
      const info_ = await callTool<ShopInfo & { payments?: string }>(door, 'get_shop_info');
      shopName = info_.shop_name;
      expect(info_.accepting_orders).toBe(true);
      expect(info_.fulfillment.modes).toEqual(expect.arrayContaining(['pickup', 'shipping']));
      expect(info_.fulfillment.shipping_fee).toBe(usd(SHIPPING_FEE_CENTS));
      // The door tells the agent where the money goes, never with the full email.
      if (mode === 'seller') {
        expect(info_.payments).toMatch(/own PayPal account/);
        expect(info_.payments!.includes(SELLER!)).toBe(false);
      } else {
        expect(info_.payments).toMatch(/demo PayPal account/);
      }

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
        client_request_id: `capture-gate-${mode}-${Date.now()}`,
      });
      const itemsCents = picks.reduce((t, { item, quantity }) => t + cents(item.options[0].price!) * quantity, 0);
      expect(order.status).toBe('awaiting_approval');
      expect(order.fulfillment).toBe('shipping');
      expect(order.shipping).toBe(usd(SHIPPING_FEE_CENTS));
      expect(order.total).toBe(usd(itemsCents + SHIPPING_FEE_CENTS));
      expect(order.approval_url).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\/checkoutnow\?token=[A-Z0-9]+$/);
      log(`[${mode}] order ${order.order_number} (${order.order_ref}) $${order.total}: ${order.lines.map((l) => `${l.quantity} × ${l.name}`).join(', ')} + shipping`);
    });
  } finally {
    await door.close();
  }
  const paypalOrderId = new URL(order.approval_url!).searchParams.get('token')!;
  log(`[${mode}] PayPal order ${paypalOrderId}`);

  // ---- 3. the buyer approves on PayPal ----
  await test.step(mode === 'seller' ? '3. PayPal sandbox: buyer logs in and pays (wallet), back to Shelfie' : '3. PayPal sandbox: guest card checkout, back to Shelfie', async () => {
    const returned =
      mode === 'seller'
        ? await payWithPayPalLogin(page, order.approval_url!, { returnOrigin: origin, testInfo: info, shot: (p, name) => shot(p, name), ...BUYER! })
        : await payAsGuest(page, order.approval_url!, { returnOrigin: origin, testInfo: info, shot: (p, name) => shot(p, name) });
    expect(returned.startsWith(`${origin}/api/paypal/return?o=${order.order_ref}`), returned).toBe(true);
    await page.waitForURL(`${origin}/o/${order.order_ref}`, { timeout: 90_000 });
  });

  // ---- 4. Paid on the receipt; the capture is stored and matches PayPal's record ----
  let captureId = '';
  await test.step('4. receipt shows Paid and who was paid; capture COMPLETED at PayPal, to the right account', async () => {
    await expect(page.getByRole('heading', { level: 1, name: `Paid. ${shopName} has your order.` })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(`Order ${order.order_number}`)).toBeVisible();
    await expect(
      page.getByText(mode === 'seller' ? `Paid to ${shopName}’s own PayPal account (` : `Paid to Shelfie’s demo PayPal account for ${shopName}`),
    ).toBeVisible();
    if (mode === 'seller') expect((await page.locator('body').innerText()).includes(SELLER!)).toBe(false); // masked only
    await settle(page);
    if (mode === 'seller') await redactSandboxLogins(page);
    await shot(page, 'receipt-paid', true);

    const stored = await storedOrder(api, origin, shop.id, order.order_ref);
    expect(stored.status).toBe('paid');
    expect(stored.paypalOrderId).toBe(paypalOrderId);
    expect(stored.paidAt).not.toBeNull();
    expect(stored.captureId).toMatch(/^[A-Z0-9]{10,}$/);
    captureId = stored.captureId!;

    const pp = await paypalGet<{
      status: string;
      purchase_units: {
        custom_id?: string;
        payee?: { email_address?: string };
        amount: { value: string };
        payments?: { captures?: { id: string; status: string; amount: { value: string } }[] };
      }[];
    }>(`/v2/checkout/orders/${paypalOrderId}`);
    const cap = pp.purchase_units[0].payments?.captures?.[0];
    expect(pp.status).toBe('COMPLETED');
    expect(pp.purchase_units[0].custom_id).toBe(order.order_ref);
    expect(cap?.id).toBe(captureId);
    expect(cap?.status).toBe('COMPLETED');
    expect(cap?.amount.value).toBe(order.total);
    if (mode === 'seller') {
      // PayPal paid the seller's own account, not the platform's. Compared here so the email never reaches a log.
      expect(pp.purchase_units[0].payee?.email_address?.toLowerCase() === SELLER, 'PayPal payee is the sandbox seller').toBe(true);
      log(`[seller] capture ${captureId} COMPLETED at PayPal, $${cap?.amount.value}, payee = PAYPAL_SANDBOX_SELLER_EMAIL`);
    } else {
      log(`[platform] capture ${captureId} COMPLETED at PayPal, $${cap?.amount.value}, payee = the app's own account`);
    }
  });

  // ---- 5. the seller sees it paid, with the AI brief ----
  await test.step('5. dashboard: paid, with the AI brief', async () => {
    let stored!: StoredOrder;
    await expect
      .poll(
        async () => {
          stored = await storedOrder(api, origin, shop.id, order.order_ref);
          return stored.brief !== null;
        },
        { timeout: 180_000, intervals: [3_000] },
      )
      .toBe(true);
    const b = stored.brief!;
    log(`[${mode}] brief (${stored.briefSource}): "${b.headline}"; requests ${JSON.stringify(b.buyer_requests)}; flags ${JSON.stringify(b.flags)}`);
    info.annotations.push({ type: `brief-${mode}`, description: `${stored.briefSource}: ${b.headline} | flags: ${b.flags.map((f) => `${f.severity}: ${f.text}`).join(' / ')}` });
    if (HAS_CLAUDE) {
      expect(stored.briefSource).toBe('agent');
      expect(b.buyer_requests.map((r) => r.kind)).toContain('allergy');
    } else {
      expect(stored.briefSource).toBe('template');
    }

    await page.goto(`/shops/${shop.id}`);
    const card = page.locator(`[data-order="${order.order_number}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText('Paid');
    await expect(card).toContainText('via Shelfie Capture Gate');
    await expect(card).toContainText(mode === 'seller' ? 'Ship to ' : 'Ship to San Jose, CA');
    await expect(card).toContainText(HAS_CLAUDE ? 'AI brief' : 'Summary');
    await expect(card).toContainText(b.headline);
    await settle(page);
    if (mode === 'seller') await redactSandboxLogins(page);
    await shot(page, 'dashboard-paid-brief');

    await page.goto(`/shops/${shop.id}/orders/${order.order_ref}`);
    await expect(page.getByTestId('brief-headline')).toHaveText(b.headline);
    await expect(page.getByTestId('PayPal-transaction-ID')).toHaveText(captureId);
    const paidTo = (await page.getByTestId('paid-to').innerText()).trim();
    expect(mode === 'seller' ? paidTo.toLowerCase() === SELLER : paidTo === 'Shelfie’s demo PayPal account', 'order page names who was paid').toBe(true);
    await expect(page.locator('section[aria-labelledby="timeline-title"]')).toContainText('Payment received');
    await settle(page);
    if (mode === 'seller') await redactSandboxLogins(page);
    await shot(page, 'order-paid-brief', true);
  });

  // ---- 6. the seller adds tracking ----
  // A USPS-shaped number (22 digits, 9400 1118 prefix), unique per run.
  const trackingNumber = `9400111${Date.now().toString().slice(-13)}${Math.floor(Math.random() * 90 + 10)}`;
  await test.step(mode === 'seller' ? '6. Add tracking (USPS) → saved in Shelfie (PayPal refuses the platform on a seller capture)' : '6. Add tracking (USPS) → PayPal tracker → shipped', async () => {
    const form = page.getByRole('form', { name: 'Add tracking' });
    await form.getByLabel('Carrier').selectOption('USPS');
    await form.getByLabel('Tracking number').fill(trackingNumber);
    await form.getByRole('button', { name: mode === 'seller' ? 'Save tracking' : 'Send tracking to PayPal' }).click();
    const done = page.getByRole('status').filter({ hasText: mode === 'seller' ? /PayPal only lets the account that was paid add tracking/ : /Sent to PayPal: USPS/ });
    const shipped = page.getByRole('heading', { name: 'Shipped', exact: true });
    const refused = form.getByRole('alert');
    await expect(done.or(shipped).or(refused).first()).toBeVisible({ timeout: 120_000 });
    if (await refused.isVisible()) throw new Error(`Add tracking failed: ${await refused.innerText()}`);
    if (mode === 'seller') {
      await settle(page);
      await redactSandboxLogins(page);
      await shot(page, 'tracking-saved', true);
    }

    await page.reload();
    await expect(shipped).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('list', { name: 'Tracking' })).toContainText(trackingNumber);
    await expect(page.locator('section[aria-labelledby="timeline-title"]')).toContainText(
      `${mode === 'seller' ? 'Tracking saved' : 'Tracking added'}: USPS ${trackingNumber}`,
    );
    if (mode === 'seller') await expect(page.getByRole('list', { name: 'Tracking' })).toContainText('Saved in Shelfie');
    await settle(page);
    if (mode === 'seller') await redactSandboxLogins(page);
    await shot(page, 'order-shipped', true);

    if (mode === 'platform') {
      const trackers = await paypalGet<{ trackers?: { transaction_id: string; tracking_number: string; status: string; carrier: string }[] }>(
        `/v1/shipping/trackers?transaction_id=${captureId}`,
      );
      const t = trackers.trackers?.find((x) => x.tracking_number === trackingNumber);
      expect(t, JSON.stringify(trackers).slice(0, 400)).toBeTruthy();
      expect(t!.status).toBe('SHIPPED');
      expect(t!.carrier).toBe('USPS');
      log(`[platform] PayPal tracker ${captureId}-${trackingNumber} ${t!.carrier} ${t!.status}`);
    } else {
      log(`[seller] tracking ${trackingNumber} saved in Shelfie (no PayPal call)`);
    }
  });

  // ---- 7. the agent asks "where's my order?" ----
  await test.step('7. MCP get_order_status returns the tracking number', async () => {
    const again = await openDoor(origin, shop.slug);
    try {
      const status = await callTool<OrderStatusOut>(again, 'get_order_status', { order_ref: order.order_ref });
      expect(status.status).toBe('fulfilled');
      expect(status.paid_at).not.toBeNull();
      expect(status.tracking).toEqual([{ carrier: 'USPS', tracking_number: trackingNumber, status: mode === 'seller' ? null : 'SHIPPED' }]);
      expect(status.message).toContain(trackingNumber);
      log(`[${mode}] get_order_status: ${status.status} · ${status.message}`);
    } finally {
      await again.close();
    }
  });
}

test.describe('capture gate (real PayPal sandbox)', () => {
  test.skip(!HAS_PAYPAL, 'Needs PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY (sandbox) in .env.');
  test.use({ viewport: DESKTOP, locale: 'en-US', timezoneId: 'America/Los_Angeles' });

  test('seller payout: a new shop paid to its own PayPal email → wallet login → Paid → brief → tracking → get_order_status', async ({ page, baseURL }, info) => {
    test.skip(!SELLER || !BUYER, 'Needs PAYPAL_SANDBOX_SELLER_EMAIL and PAYPAL_SANDBOX_BUYER_EMAIL / _PASSWORD in .env.');
    test.setTimeout(12 * 60_000);
    const origin = baseURL!;
    let shop!: LiveShop;
    await test.step('1. a live shop with shipping and the seller\'s PayPal email, published to the PayPal sandbox catalog', async () => {
      shop = await createLiveShop(page.context().request, origin, SELLER!);
      await page.goto(`/s/${shop.slug}`);
      // PayPal's return URL is built from the server's APP_URL; the door shown on the page proves it is this server.
      await expect(page.locator('#agent-door code').first()).toHaveText(`${origin}/s/${shop.slug}/mcp`);
    });
    await runGate(page, info, origin, { mode: 'seller', shop, prefix: 'seller-' });
  });

  test('demo shop, paid to the platform: guest card → Paid → brief → tracking at PayPal → get_order_status', async ({ page, baseURL }, info) => {
    test.setTimeout(12 * 60_000);
    const origin = baseURL!;
    let shop!: LiveShop;
    await test.step('1. the seeded demo shop with no seller email (the platform fallback), live in the PayPal sandbox catalog', async () => {
      // --reset gives a fresh owner token for the dashboard steps; payeeEmail null is the platform fallback.
      const seeded = await seedDemoShop({ db: getDb(), paypal: getPayPal(), uploadsDir: getConfig().uploadsDir, reset: true, payeeEmail: null });
      expect(seeded.payee).toEqual({ kind: 'platform' });
      expect(seeded.ownerToken).toBeTruthy();
      shop = { id: seeded.shop.id, slug: seeded.shop.slug };
      await page.context().addCookies([{ name: ownerCookieName(shop.id), value: seeded.ownerToken!, url: origin, httpOnly: true, sameSite: 'Lax' }]);
      log(`[platform] demo shop ${shop.id} live at /s/${shop.slug}: ${seeded.published} published now, paid to the platform`);
      await page.goto(`/s/${shop.slug}`);
      await expect(page.locator('#agent-door code').first()).toHaveText(`${origin}/s/${shop.slug}/mcp`);
    });
    await runGate(page, info, origin, { mode: 'platform', shop, prefix: '' });
  });

  // The cart's own money path (addendum, WP3b): no agent door. A buyer adds from the menu and pays through the shop page.
  test('cart checkout: a buyer adds from the menu → wallet login → Paid to the seller → capture COMPLETED → cart cleared → brief', async ({ page, baseURL }, info) => {
    test.skip(!SELLER || !BUYER, 'Needs PAYPAL_SANDBOX_SELLER_EMAIL and PAYPAL_SANDBOX_BUYER_EMAIL / _PASSWORD in .env.');
    test.setTimeout(12 * 60_000);
    const origin = baseURL!;
    const api = page.context().request;
    const shot = (p: Page, name: string, full = false) => shoot(p, info, `cart-${name}`, full);
    let shop!: LiveShop;
    let shopName = '';
    const cartKey = () => `shelfie:cart:${shop.slug}`;

    await test.step('1. a live shop paid to the seller\'s own PayPal email', async () => {
      shop = await createLiveShop(api, origin, SELLER!);
    });

    let checkout!: { orderRef: string; number: string; approvalUrl: string; totalCents: number };
    await test.step('2. the shop page: add two items, open the cart, approve on PayPal', async () => {
      await page.goto(`/s/${shop.slug}`);
      shopName = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim();
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForFunction(() => {
        const el = document.querySelector('li[data-menu-item] button');
        return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber'));
      });
      const add = page.getByRole('button', { name: /^Add .* to your order$/ });
      expect(await add.count()).toBeGreaterThan(1);
      await add.first().click();
      await add.nth(1).click();
      await page.getByRole('button', { name: /View order/ }).filter({ visible: true }).first().click();

      const dock = page.locator('[data-assistant-dock]');
      await expect(dock.locator('[data-cart-line]')).toHaveCount(2);
      await dock.getByLabel(/Note for the shop/).fill(BUYER_NOTE);
      const pay = dock.getByRole('button', { name: /^Approve \$[\d.,]+ on PayPal$/ });
      await expect(pay).toBeVisible();
      const shownTotal = /\$([\d.,]+)/.exec((await pay.innerText()).trim())![1];
      await settle(page);
      await shot(page, 'panel');

      // Read in a route handler: the page leaves for PayPal the moment this answers, which discards the response body.
      let status = 0;
      await page.route(`**/api/checkout/${shop.slug}`, async (route) => {
        const res = await route.fetch({ timeout: 120_000 });
        status = res.status();
        checkout = (await res.json()) as typeof checkout;
        await route.fulfill({ response: res });
      });
      await pay.click();
      await page.waitForURL(/^https:\/\/www\.sandbox\.paypal\.com\//, { timeout: 120_000 });
      expect(status).toBe(201);
      expect(usd(checkout.totalCents)).toBe(shownTotal);
      expect(checkout.approvalUrl).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\/checkoutnow\?token=[A-Z0-9]+$/);
      log(`[cart] order ${checkout.number} (${checkout.orderRef}) $${usd(checkout.totalCents)} from the shop page`);
    });
    const paypalOrderId = new URL(checkout.approvalUrl).searchParams.get('token')!;

    await test.step('3. PayPal sandbox: buyer logs in and pays (wallet), back to Shelfie', async () => {
      const returned = await payWithPayPalLogin(page, checkout.approvalUrl, { returnOrigin: origin, testInfo: info, ...BUYER! });
      expect(returned.startsWith(`${origin}/api/paypal/return?o=${checkout.orderRef}`), returned).toBe(true);
      await page.waitForURL(`${origin}/o/${checkout.orderRef}`, { timeout: 90_000 });
    });

    await test.step('4. receipt: Paid, to the seller; capture COMPLETED at PayPal; the cart is cleared', async () => {
      await expect(page.getByRole('heading', { level: 1, name: `Paid. ${shopName} has your order.` })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(`Paid to ${shopName}’s own PayPal account (`)).toBeVisible();
      expect((await page.locator('body').innerText()).includes(SELLER!)).toBe(false);
      await settle(page);
      await redactSandboxLogins(page);
      await shot(page, 'receipt-paid', true);

      const stored = await storedOrder(api, origin, shop.id, checkout.orderRef);
      expect(stored.status).toBe('paid');
      expect(stored.paypalOrderId).toBe(paypalOrderId);
      expect(stored.captureId).toMatch(/^[A-Z0-9]{10,}$/);
      const pp = await paypalGet<{
        status: string;
        purchase_units: { custom_id?: string; payee?: { email_address?: string }; payments?: { captures?: { id: string; status: string; amount: { value: string } }[] } }[];
      }>(`/v2/checkout/orders/${paypalOrderId}`);
      const cap = pp.purchase_units[0].payments?.captures?.[0];
      expect(pp.status).toBe('COMPLETED');
      expect(pp.purchase_units[0].custom_id).toBe(checkout.orderRef);
      expect(cap?.id).toBe(stored.captureId);
      expect(cap?.status).toBe('COMPLETED');
      expect(cap?.amount.value).toBe(usd(checkout.totalCents));
      expect(pp.purchase_units[0].payee?.email_address?.toLowerCase() === SELLER, 'PayPal payee is the sandbox seller').toBe(true);
      log(`[cart] capture ${stored.captureId} COMPLETED at PayPal, $${cap?.amount.value}, payee = PAYPAL_SANDBOX_SELLER_EMAIL`);

      await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), cartKey()), { timeout: 15_000 }).toBeNull();
      expect(await page.evaluate((k) => localStorage.getItem(`${k}:pending`), cartKey())).toBeNull();
    });

    await test.step('5. the seller sees "via your shop page", with the brief from the buyer\'s note', async () => {
      let stored!: StoredOrder;
      await expect
        .poll(
          async () => {
            stored = await storedOrder(api, origin, shop.id, checkout.orderRef);
            return stored.brief !== null;
          },
          { timeout: 180_000, intervals: [3_000] },
        )
        .toBe(true);
      log(`[cart] brief (${stored.briefSource}): "${stored.brief!.headline}"`);
      if (HAS_CLAUDE) {
        expect(stored.briefSource).toBe('agent');
        expect(stored.brief!.buyer_requests.map((r) => r.kind)).toContain('allergy');
      }
      await page.goto(`/shops/${shop.id}`);
      const card = page.locator(`[data-order="${checkout.number}"]`);
      await expect(card).toContainText('Paid');
      await expect(card).toContainText('via your shop page');
      await settle(page);
      await redactSandboxLogins(page);
      await shot(page, 'dashboard-paid');
    });
  });
});
