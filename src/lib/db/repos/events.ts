import type { Db } from '@/lib/db';
import { now } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import type { EventSource, OrderEventRow } from '@/lib/domain/types';

export function add(db: Db, orderId: string, type: string, source: EventSource, detail?: unknown): void {
  const seq = (db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM order_events WHERE order_id = ?').get(orderId) as { n: number }).n;
  db.prepare('INSERT INTO order_events (id, order_id, type, source, detail_json, created_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(newId('evt'), orderId, type, source, detail === undefined ? null : JSON.stringify(detail), now(), seq);
}

export function list(db: Db, orderId: string): OrderEventRow[] {
  return (db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY seq').all(orderId) as {
    id: string; order_id: string; type: string; source: EventSource; detail_json: string | null; created_at: string;
  }[]).map((r) => ({
    id: r.id, orderId: r.order_id, type: r.type, source: r.source,
    detail: r.detail_json ? JSON.parse(r.detail_json) : null, createdAt: r.created_at,
  }));
}

/** Records a PayPal webhook event id; returns false when it was already seen (dedupe). */
export function recordWebhook(db: Db, e: { id: string; eventType: string; resourceId: string | null; verified: boolean }): boolean {
  const res = db
    .prepare('INSERT OR IGNORE INTO webhook_events (id, event_type, resource_id, verified, received_at) VALUES (?, ?, ?, ?, ?)')
    .run(e.id, e.eventType, e.resourceId, e.verified ? 1 : 0, now());
  return res.changes === 1;
}
