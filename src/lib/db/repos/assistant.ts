import type { Db } from '@/lib/db';
import { now } from '@/lib/db';
import { newId } from '@/lib/domain/ids';

/** Buyer-console session: append-only Claude message params plus UI events. */
export interface AssistantSession {
  id: string;
  shopId: string;
  messages: unknown[];
  events: unknown[];
  createdAt: string;
  updatedAt: string;
}

interface Row { id: string; shop_id: string; messages_json: string; events_json: string; created_at: string; updated_at: string }

export function create(db: Db, shopId: string): AssistantSession {
  const id = newId('asst');
  const ts = now();
  db.prepare('INSERT INTO assistant_sessions (id, shop_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, shopId, ts, ts);
  return get(db, id)!;
}

export function get(db: Db, id: string): AssistantSession | null {
  const r = db.prepare('SELECT * FROM assistant_sessions WHERE id = ?').get(id) as Row | undefined;
  return r
    ? { id: r.id, shopId: r.shop_id, messages: JSON.parse(r.messages_json), events: JSON.parse(r.events_json), createdAt: r.created_at, updatedAt: r.updated_at }
    : null;
}

/** Appends messages and events (never rewrites history). */
export function append(db: Db, id: string, messages: unknown[], events: unknown[]): void {
  const s = get(db, id);
  if (!s) throw new Error(`Unknown assistant session ${id}`);
  db.prepare('UPDATE assistant_sessions SET messages_json = ?, events_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify([...s.messages, ...messages]), JSON.stringify([...s.events, ...events]), now(), id);
}
