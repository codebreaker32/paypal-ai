// LABELLED TEST FIXTURES for the Task 8 dashboard e2e and screenshots. Not product data.
// Writes a shop and orders in every dashboard state straight into the e2e SQLite file through the repos, so the UI
// states can be shown without PayPal. PayPal ids here are fake ("E2E…"). The dev server must use the same
// DATABASE_PATH (data/e2e-task8.db).
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { getDb } from '@/lib/db';
import * as eventsRepo from '@/lib/db/repos/events';
import * as itemsRepo from '@/lib/db/repos/items';
import * as ordersRepo from '@/lib/db/repos/orders';
import * as shopsRepo from '@/lib/db/repos/shops';
import type { DraftItem, EventSource, Order, OrderBrief, OrderLine, OrderStatus, Shop, ShipTo } from '@/lib/domain/types';

export const E2E_DB = 'data/e2e-task8.db';
/** Same as OWNER_COOKIE_PREFIX in src/lib/auth/owner.ts (not imported: it pulls in next/headers). */
const ownerCookieName = (shopId: string) => `shelfie_owner_${shopId}`;

function db() {
  process.env.DATABASE_PATH ??= E2E_DB;
  if (path.resolve(process.env.DATABASE_PATH) !== path.resolve(E2E_DB)) {
    throw new Error(`task8 fixtures write only to ${E2E_DB}; DATABASE_PATH is ${process.env.DATABASE_PATH}`);
  }
  return getDb();
}
const MIN = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MIN).toISOString();

const draft = (name: string, section: string, prices: (number | null)[], description: string | null = null, labels?: string[]): DraftItem => ({
  section, name, description, sourceText: name, confidence: 'high', kind: 'PHYSICAL', issues: [], issueDetail: null, status: 'draft',
  variants: prices.map((p, i) => ({ label: labels?.[i] ?? null, priceCents: p })),
});

export interface FixtureShop {
  shop: Shop;
  ownerToken: string;
  items: Record<string, { id: string; variantId: string; label: string | null; priceCents: number; paypalProductId: string | null }>;
}

/** A published bakery with a realistic menu (test fixture). */
export function createFixtureShop(name = 'Marigold Bakehouse'): FixtureShop {
  const { shop, ownerToken } = shopsRepo.create(db(), {
    name,
    about: 'Weekend bakes from a home kitchen in Austin.',
    fulfillment: 'both',
    shippingFeeCents: 800,
    pickupNotes: 'Saturday 8 to 12 at the Mueller farmers market, stall 14.',
  });
  const created = itemsRepo.replaceDrafts(db(), shop.id, [
    draft('Almond croissant', 'Pastries', [475], 'Flaky, with almond cream. Contains nuts.'),
    draft('Butter croissant', 'Pastries', [425]),
    draft('Morning bun', 'Pastries', [450], 'Orange zest and cinnamon sugar.'),
    draft('Country sourdough loaf', 'Bread', [900]),
    draft('Seeded rye', 'Bread', [1050]),
    draft('Focaccia slab', 'Bread', [800], 'Rosemary and flaky salt.'),
    draft('Drip coffee', 'Drinks', [300, 400], null, ['S', 'L']),
    draft('Celebration cake', 'Cakes', [null], 'Ask for flavours and sizes.'),
  ]);
  let n = 0;
  for (const it of created) {
    if (it.name === 'Celebration cake') {
      itemsRepo.update(db(), it.id, { status: 'in_person' });
      continue;
    }
    itemsRepo.setPayPalProductId(db(), it.id, `PROD-E2E${shop.id.slice(4, 10).toUpperCase()}${++n}`);
  }
  itemsRepo.update(db(), created.find((i) => i.name === 'Seeded rye')!.id, { soldOut: true });
  const live = shopsRepo.publish(db(), shop.id);
  const items = Object.fromEntries(
    itemsRepo.listWithVariants(db(), shop.id).map((i) => [
      i.name,
      { id: i.id, variantId: i.variants[0].id, label: i.variants[0].label, priceCents: i.variants[0].priceCents ?? 0, paypalProductId: i.paypalProductId },
    ]),
  );
  return { shop: live, ownerToken, items };
}

interface OrderSpec {
  status: OrderStatus;
  fulfillment: 'pickup' | 'shipping';
  lines: [name: string, qty: number][];
  minutesAgo: number;
  buyerName?: string;
  buyerNote?: string;
  agentName?: string;
  payer?: { name: string; email: string };
  shipTo?: ShipTo;
  brief?: { brief: OrderBrief; source: 'agent' | 'template' };
  tracking?: { carrier: string; trackingNumber: string };
}

const AUSTIN: ShipTo = { name: 'Dana Whitfield', line1: '2104 E 6th St', line2: 'Apt 3', city: 'Austin', state: 'TX', postalCode: '78702', countryCode: 'US' };

let seq = 0;
/** One order in the given state, with the events that would have led there (test fixture). */
export function addFixtureOrder(f: FixtureShop, spec: OrderSpec): Order {
  const lines: OrderLine[] = spec.lines.map(([name, qty]) => {
    const it = f.items[name];
    return { itemId: it.id, variantId: it.variantId, name, label: it.label, unitCents: it.priceCents, qty, paypalProductId: it.paypalProductId };
  });
  const itemsCents = lines.reduce((t, l) => t + l.unitCents * l.qty, 0);
  const shippingCents = spec.fulfillment === 'shipping' ? f.shop.shippingFeeCents : 0;
  const created = ordersRepo.insert(
    db(),
    {
      shopId: f.shop.id, fulfillment: spec.fulfillment, buyerName: spec.buyerName ?? null, buyerNote: spec.buyerNote ?? null,
      agentName: spec.agentName ?? 'Claude', clientRequestId: null, itemsCents, shippingCents, totalCents: itemsCents + shippingCents,
      paypalOrderId: `E2E${Date.now().toString(36).toUpperCase()}${String(++seq).padStart(4, '0')}`,
      approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=E2E-FIXTURE',
      expiresAt: new Date(Date.now() - spec.minutesAgo * MIN + 60 * MIN).toISOString(),
    },
    lines,
  );
  const id = created.id;
  const t0 = spec.minutesAgo;
  const events: [type: string, source: EventSource, minutesAgo: number, detail?: unknown][] = [
    ['created', 'mcp', t0, { agentName: spec.agentName ?? 'Claude', totalCents: itemsCents + shippingCents }],
  ];
  const paidLike = spec.status === 'paid' || spec.status === 'fulfilled';
  const capture = paidLike || spec.status === 'payment_pending' ? `${created.paypalOrderId.slice(3, 9)}CAP${String(seq).padStart(8, '0')}` : null;
  if (spec.status !== 'awaiting_approval' && spec.status !== 'cancelled' && spec.status !== 'expired') {
    events.push(['paypal_approved', 'return_url', t0 - 2]);
  }
  if (spec.status === 'payment_pending') events.push(['capture_pending', 'return_url', t0 - 2, { captureId: capture }]);
  if (paidLike) events.push(['capture_completed', 'return_url', t0 - 2, { captureId: capture }]);
  if (spec.status === 'cancelled') events.push(['cancelled', 'cancel_url', t0 - 3]);
  if (spec.status === 'expired') events.push(['expired', 'poller', t0 - 60]);
  if (spec.status === 'fulfilled') {
    events.push(['fulfilled', 'seller', t0 - 30]);
    if (spec.tracking) events.push(['tracking_added', 'seller', t0 - 30, spec.tracking]);
  }

  const paidAt = paidLike ? ago(t0 - 2) : null;
  db().prepare('UPDATE orders SET status = ?, created_at = ?, updated_at = ?, last_checked_at = ? WHERE id = ?').run(spec.status, ago(t0), ago(t0), ago(0), id);
  ordersRepo.update(db(), id, {
    paidAt: paidAt ?? undefined,
    captureId: capture ?? undefined,
    payerName: spec.payer?.name,
    payerEmail: spec.payer?.email,
    shipTo: spec.shipTo,
    brief: spec.brief?.brief,
    briefSource: spec.brief?.source,
    fulfilledAt: spec.status === 'fulfilled' ? ago(t0 - 30) : undefined,
  });
  for (const [type, source, m, detail] of events) {
    eventsRepo.add(db(), id, type, source, detail);
    db().prepare('UPDATE order_events SET created_at = ? WHERE order_id = ? AND seq = (SELECT MAX(seq) FROM order_events WHERE order_id = ?)').run(ago(m), id, id);
  }
  if (spec.tracking) ordersRepo.addTracker(db(), { orderId: id, ...spec.tracking, paypalStatus: 'SHIPPED' });
  return ordersRepo.byId(db(), id)!;
}

export const NUT_BRIEF: OrderBrief = {
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
    { severity: 'info', text: "PayPal's amount matches the order: $18.50 items + $8.00 shipping." },
  ],
  next_action: 'contact_buyer',
};

/** The full set of dashboard states for screenshots and e2e (test fixture). */
export function seedAllStates(f: FixtureShop) {
  const nutOrder = addFixtureOrder(f, {
    status: 'paid', fulfillment: 'shipping', minutesAgo: 6, buyerName: 'Dana',
    buyerNote: 'Nut allergy in the house. Would love it by Friday!',
    lines: [['Almond croissant', 2], ['Country sourdough loaf', 1]],
    payer: { name: 'Dana Whitfield', email: 'dana.whitfield@example.com' }, shipTo: AUSTIN,
    brief: { brief: NUT_BRIEF, source: 'agent' },
  });
  const pickupTemplate = addFixtureOrder(f, {
    status: 'paid', fulfillment: 'pickup', minutesAgo: 25, buyerName: 'Sam', agentName: 'shelfie-assistant',
    lines: [['Morning bun', 3], ['Drip coffee', 2]],
    payer: { name: 'Sam Ortega', email: 'sam.ortega@example.com' },
    brief: {
      source: 'template',
      brief: {
        headline: '5 items · $19.50 · pickup',
        prep_list: [{ text: 'Morning bun', qty: 3 }, { text: 'Drip coffee (S)', qty: 2 }],
        buyer_requests: [], flags: [], next_action: 'prepare',
      },
    },
  });
  const writing = addFixtureOrder(f, {
    status: 'paid', fulfillment: 'pickup', minutesAgo: 1, buyerName: 'Priya', agentName: 'claude-code',
    lines: [['Focaccia slab', 1]],
    payer: { name: 'Priya Natarajan', email: 'priya.n@example.com' },
  });
  const waiting = addFixtureOrder(f, {
    status: 'awaiting_approval', fulfillment: 'pickup', minutesAgo: 3, buyerName: 'Lee',
    lines: [['Butter croissant', 4]],
  });
  const pending = addFixtureOrder(f, {
    status: 'payment_pending', fulfillment: 'shipping', minutesAgo: 9, buyerName: 'Jo',
    lines: [['Country sourdough loaf', 2]],
    payer: { name: 'Jo Park', email: 'jo.park@example.com' }, shipTo: { ...AUSTIN, name: 'Jo Park', line1: '88 Oak Ln', line2: null, city: 'Round Rock', postalCode: '78664' },
  });
  const shipped = addFixtureOrder(f, {
    status: 'fulfilled', fulfillment: 'shipping', minutesAgo: 26 * 60, buyerName: 'Maya',
    lines: [['Focaccia slab', 2], ['Butter croissant', 2]],
    payer: { name: 'Maya Chen', email: 'maya.chen@example.com' }, shipTo: { ...AUSTIN, name: 'Maya Chen', line1: '501 Congress Ave', line2: null, postalCode: '78701' },
    brief: {
      source: 'agent',
      brief: {
        headline: 'Ship 2 focaccia slabs + 2 butter croissants to Austin, TX',
        prep_list: [{ text: 'Focaccia slab', qty: 2 }, { text: 'Butter croissant', qty: 2 }],
        buyer_requests: [], flags: [], next_action: 'ship',
      },
    },
    tracking: { carrier: 'USPS', trackingNumber: '9400111899223197428490' },
  });
  const pickedUp = addFixtureOrder(f, {
    status: 'fulfilled', fulfillment: 'pickup', minutesAgo: 27 * 60, buyerName: 'Ana',
    lines: [['Almond croissant', 1], ['Drip coffee', 1]],
    payer: { name: 'Ana Ruiz', email: 'ana.ruiz@example.com' },
    brief: { source: 'agent', brief: { headline: 'Pickup: 1 almond croissant + 1 small drip coffee', prep_list: [], buyer_requests: [], flags: [], next_action: 'prepare' } },
  });
  const cancelled = addFixtureOrder(f, { status: 'cancelled', fulfillment: 'pickup', minutesAgo: 28 * 60, lines: [['Morning bun', 2]] });
  const expired = addFixtureOrder(f, { status: 'expired', fulfillment: 'shipping', minutesAgo: 30 * 60, lines: [['Seeded rye', 1]] });
  return { nutOrder, pickupTemplate, writing, waiting, pending, shipped, pickedUp, cancelled, expired };
}

export async function signInAsOwner(context: BrowserContext, f: FixtureShop, baseURL: string) {
  await context.addCookies([{ name: ownerCookieName(f.shop.id), value: f.ownerToken, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}
