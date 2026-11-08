import type { Db } from '@/lib/db';
import { now } from '@/lib/db';
import { maskEmail } from '@/lib/domain/payee';

/** One change of a published shop's PayPal email (SR18). Only masked addresses are kept. */
export interface PayeeChange {
  id: number;
  shopId: string;
  oldMasked: string | null;
  newMasked: string;
  changedAt: string;
}

interface Row {
  id: number; shop_id: string; old_masked: string | null; new_masked: string; changed_at: string;
}

/** Call in the same transaction as the update. */
export function record(db: Db, shopId: string, oldEmail: string | null, newEmail: string): void {
  db.prepare('INSERT INTO payee_changes (shop_id, old_masked, new_masked, changed_at) VALUES (?, ?, ?, ?)').run(
    shopId, oldEmail ? maskEmail(oldEmail) : null, maskEmail(newEmail), now(),
  );
}

/** The shop's most recent change, or null if its email has never changed. */
export function latest(db: Db, shopId: string): PayeeChange | null {
  const r = db.prepare('SELECT * FROM payee_changes WHERE shop_id = ? ORDER BY id DESC LIMIT 1').get(shopId) as Row | undefined;
  return r ? { id: r.id, shopId: r.shop_id, oldMasked: r.old_masked, newMasked: r.new_masked, changedAt: r.changed_at } : null;
}
