import type { Db } from '@/lib/db';
import { now } from '@/lib/db';
import { newId, orderNumber } from '@/lib/domain/ids';
import type { Fulfillment, NewOrder, Order, OrderBrief, OrderLine, OrderStatus, ShipTo, Tracker } from '@/lib/domain/types';

interface OrderRow {
  id: string; number: string; shop_id: string; status: OrderStatus; fulfillment: Fulfillment; buyer_name: string | null;
  buyer_note: string | null; agent_name: string | null; client_request_id: string | null; items_cents: number;
  shipping_cents: number; total_cents: number; paypal_order_id: string; approval_url: string; expires_at: string;
  capture_claimed_at: string | null; capture_id: string | null; payer_name: string | null; payer_email: string | null;
  ship_to_json: string | null; brief_json: string | null; brief_source: 'agent' | 'template' | null; paid_at: string | null;
  fulfilled_at: string | null; last_checked_at: string | null; created_at: string; updated_at: string; payee_email: string | null;
}
interface LineRow {
  order_id: string; item_id: string; variant_id: string; name: string; label: string | null; unit_cents: number; qty: number;
  paypal_product_id: string | null;
}

function lines(db: Db, orderId: string): OrderLine[] {
  return (db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY sort').all(orderId) as LineRow[]).map((l) => ({
    itemId: l.item_id, variantId: l.variant_id, name: l.name, label: l.label, unitCents: l.unit_cents, qty: l.qty,
    paypalProductId: l.paypal_product_id,
  }));
}

/**
 * An `approved` order whose latest capture outcome is a refusal (capture_failed, not superseded by a new approval or
 * a transient error). Same rule as lastCaptureFailure() in the order service.
 */
function captureRefused(db: Db, r: OrderRow): boolean {
  if (r.status !== 'approved') return false;
  const last = db
    .prepare(
      `SELECT type FROM order_events WHERE order_id = ? AND type IN ('capture_failed','capture_error','paypal_approved') ORDER BY seq DESC LIMIT 1`,
    )
    .get(r.id) as { type: string } | undefined;
  return last?.type === 'capture_failed';
}

function toOrder(db: Db, r: OrderRow): Order {
  return {
    id: r.id, number: r.number, shopId: r.shop_id, status: r.status, fulfillment: r.fulfillment, buyerName: r.buyer_name,
    buyerNote: r.buyer_note, agentName: r.agent_name, clientRequestId: r.client_request_id, itemsCents: r.items_cents,
    shippingCents: r.shipping_cents, totalCents: r.total_cents, paypalOrderId: r.paypal_order_id, approvalUrl: r.approval_url,
    expiresAt: r.expires_at, captureClaimedAt: r.capture_claimed_at, captureId: r.capture_id, payerName: r.payer_name,
    payerEmail: r.payer_email, payeeEmail: r.payee_email ?? null, shipTo: r.ship_to_json ? (JSON.parse(r.ship_to_json) as ShipTo) : null,
    brief: r.brief_json ? (JSON.parse(r.brief_json) as OrderBrief) : null, briefSource: r.brief_source, paidAt: r.paid_at,
    fulfilledAt: r.fulfilled_at, lastCheckedAt: r.last_checked_at, createdAt: r.created_at, updatedAt: r.updated_at,
    lines: lines(db, r.id), captureRefused: captureRefused(db, r),
  };
}

/** Inserts an order in `awaiting_approval` with its line snapshot. */
export function insert(db: Db, o: NewOrder, orderLines: OrderLine[]): Order {
  const id = o.id ?? newId('ord');
  const ts = now();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (id, number, shop_id, status, fulfillment, buyer_name, buyer_note, agent_name, client_request_id,
        client_key, items_cents, shipping_cents, total_cents, paypal_order_id, approval_url, expires_at, payee_email, created_at, updated_at)
       VALUES (@id, @number, @shopId, 'awaiting_approval', @fulfillment, @buyerName, @buyerNote, @agentName, @clientRequestId,
        @clientKey, @itemsCents, @shippingCents, @totalCents, @paypalOrderId, @approvalUrl, @expiresAt, @payeeEmail, @ts, @ts)`,
    ).run({ ...o, id, number: o.number ?? orderNumber(), clientKey: o.clientKey ?? null, payeeEmail: o.payeeEmail ?? null, ts });
    const ins = db.prepare(
      `INSERT INTO order_items (order_id, item_id, variant_id, name, label, unit_cents, qty, paypal_product_id, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    orderLines.forEach((l, i) => ins.run(id, l.itemId, l.variantId, l.name, l.label, l.unitCents, l.qty, l.paypalProductId, i));
  });
  tx();
  return byId(db, id)!;
}

export function byId(db: Db, id: string): Order | null {
  const r = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
  return r ? toOrder(db, r) : null;
}

export function byPayPalId(db: Db, paypalOrderId: string): Order | null {
  const r = db.prepare('SELECT * FROM orders WHERE paypal_order_id = ?').get(paypalOrderId) as OrderRow | undefined;
  return r ? toOrder(db, r) : null;
}

export function byClientRequestId(db: Db, shopId: string, key: string): Order | null {
  const r = db.prepare('SELECT * FROM orders WHERE shop_id = ? AND client_request_id = ?').get(shopId, key) as OrderRow | undefined;
  return r ? toOrder(db, r) : null;
}

/** A shop's orders, newest first; `limit`: only the newest that many (their lines are read only for those). */
/** How many paid orders (waiting to be prepared) each of an account's shops has. A shop with none is absent. */
export function paidCountsByAccount(db: Db, accountId: string): Map<string, number> {
  const rows = db
    .prepare("SELECT o.shop_id AS shopId, COUNT(*) AS n FROM orders o JOIN shops s ON s.id = o.shop_id WHERE s.account_id = ? AND o.status = 'paid' GROUP BY o.shop_id")
    .all(accountId) as { shopId: string; n: number }[];
  return new Map(rows.map((r) => [r.shopId, r.n]));
}

export function listByShop(db: Db, shopId: string, opts: { status?: OrderStatus[]; limit?: number } = {}): Order[] {
  const statuses = opts.status ?? [];
  const where = statuses.length ? ` AND status IN (${statuses.map(() => '?').join(',')})` : '';
  const limit = opts.limit === undefined ? '' : ' LIMIT ?';
  const args: unknown[] = [shopId, ...statuses, ...(opts.limit === undefined ? [] : [Math.max(0, Math.floor(opts.limit))])];
  const rows = db.prepare(`SELECT * FROM orders WHERE shop_id = ?${where} ORDER BY created_at DESC${limit}`).all(...args) as OrderRow[];
  return rows.map((r) => toOrder(db, r));
}

/** Non-terminal orders created after `sinceIso` (for the poller). */
export function listOpen(db: Db, sinceIso: string): Order[] {
  const rows = db
    .prepare(`SELECT * FROM orders WHERE status IN ('awaiting_approval','approved','payment_pending') AND created_at >= ? ORDER BY created_at`)
    .all(sinceIso) as OrderRow[];
  return rows.map((r) => toOrder(db, r));
}

/** Unpaid, unexpired orders at a shop. A past expiry doesn't count even before a sync marks the order expired. */
export function countOpen(db: Db, shopId: string, nowIso: string = now()): number {
  return (
    db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND status = 'awaiting_approval' AND expires_at > ?`).get(shopId, nowIso) as { n: number }
  ).n;
}

/** Orders that block deleting the shop (SR19): money is moving or owed a handover. An awaiting_approval past its expiry doesn't count. */
export function countUnfinished(db: Db, shopId: string, nowIso: string = now()): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM orders WHERE shop_id = ?
         AND (status IN ('approved', 'paid', 'payment_pending') OR (status = 'awaiting_approval' AND expires_at > ?))`,
      )
      .get(shopId, nowIso) as { n: number }
  ).n;
}

/** Unpaid, unexpired orders one caller (hashed rate-limit identity) has open at a shop. */
export function countOpenForClient(db: Db, shopId: string, clientKey: string, nowIso: string = now()): number {
  return (
    db
      .prepare(`SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND client_key = ? AND status = 'awaiting_approval' AND expires_at > ?`)
      .get(shopId, clientKey, nowIso) as { n: number }
  ).n;
}

export type OrderPatch = Partial<Pick<Order, 'captureId' | 'payerName' | 'payerEmail' | 'shipTo' | 'brief' | 'briefSource' | 'paidAt' | 'fulfilledAt' | 'lastCheckedAt' | 'captureClaimedAt'>>;

const COLS: Record<keyof OrderPatch, string> = {
  captureId: 'capture_id', payerName: 'payer_name', payerEmail: 'payer_email', shipTo: 'ship_to_json', brief: 'brief_json',
  briefSource: 'brief_source', paidAt: 'paid_at', fulfilledAt: 'fulfilled_at', lastCheckedAt: 'last_checked_at',
  captureClaimedAt: 'capture_claimed_at',
};

function patchParams(patch: OrderPatch) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof OrderPatch, unknown][];
  const sets = entries.map(([k]) => `${COLS[k]} = @${k}`);
  const params = Object.fromEntries(
    entries.map(([k, v]) => [k, (k === 'shipTo' || k === 'brief') && v !== null ? JSON.stringify(v) : v]),
  );
  return { sets, params };
}

/** Compare-and-set: changes status only if it is still `from`. Returns whether this caller won. */
export function casStatus(db: Db, id: string, from: OrderStatus, to: OrderStatus, patch: OrderPatch = {}): boolean {
  const { sets, params } = patchParams(patch);
  const extra = sets.length ? `, ${sets.join(', ')}` : '';
  const res = db
    .prepare(`UPDATE orders SET status = @to, updated_at = @ts${extra} WHERE id = @id AND status = @from`)
    .run({ ...params, id, from, to, ts: now() });
  return res.changes === 1;
}

export function update(db: Db, id: string, patch: OrderPatch): void {
  const { sets, params } = patchParams(patch);
  if (!sets.length) return;
  db.prepare(`UPDATE orders SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run({ ...params, id, ts: now() });
}

/** Atomic capture claim: only one caller per 30 s window may call PayPal capture for an approved order. */
export function claimCapture(db: Db, id: string, nowMs: number = Date.now()): boolean {
  const ts = new Date(nowMs).toISOString();
  const staleBefore = new Date(nowMs - 30_000).toISOString();
  const res = db
    .prepare(
      `UPDATE orders SET capture_claimed_at = ? WHERE id = ? AND status = 'approved'
         AND (capture_claimed_at IS NULL OR capture_claimed_at < ?)`,
    )
    .run(ts, id, staleBefore);
  return res.changes === 1;
}

export function addTracker(db: Db, t: Omit<Tracker, 'createdAt'>): boolean {
  const res = db
    .prepare('INSERT OR IGNORE INTO trackers (order_id, carrier, tracking_number, paypal_status, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(t.orderId, t.carrier, t.trackingNumber, t.paypalStatus, now());
  return res.changes === 1;
}

export function trackers(db: Db, orderId: string): Tracker[] {
  return (db.prepare('SELECT * FROM trackers WHERE order_id = ? ORDER BY created_at').all(orderId) as {
    order_id: string; carrier: string; tracking_number: string; paypal_status: string | null; created_at: string;
  }[]).map((r) => ({ orderId: r.order_id, carrier: r.carrier, trackingNumber: r.tracking_number, paypalStatus: r.paypal_status, createdAt: r.created_at }));
}
