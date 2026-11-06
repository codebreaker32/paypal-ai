import type { Db } from '@/lib/db';
import { now } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { isItemCategory } from '@/lib/domain/category';
import type { Confidence, DraftItem, IssueCode, ItemKind, ItemStatus, ItemWithVariants, Variant } from '@/lib/domain/types';

interface ItemRow {
  id: string; shop_id: string; section: string | null; name: string; description: string | null; source_text: string;
  confidence: Confidence; issues_json: string; issue_detail: string | null; kind: ItemKind; status: ItemStatus;
  sold_out: number; photo_url: string | null; category: string | null; sort: number; paypal_product_id: string | null; published_at: string | null; updated_at: string;
}
interface VariantRow { id: string; item_id: string; label: string | null; price_cents: number | null; sort: number }

const toVariant = (v: VariantRow): Variant => ({ id: v.id, itemId: v.item_id, label: v.label, priceCents: v.price_cents, sort: v.sort });

function withVariants(db: Db, rows: ItemRow[]): ItemWithVariants[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const vs = db
    .prepare(`SELECT * FROM variants WHERE item_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort`)
    .all(...ids) as VariantRow[];
  return rows.map((r) => ({
    id: r.id, shopId: r.shop_id, section: r.section, name: r.name, description: r.description, sourceText: r.source_text,
    confidence: r.confidence, issues: JSON.parse(r.issues_json) as IssueCode[], issueDetail: r.issue_detail, kind: r.kind,
    status: r.status, soldOut: r.sold_out === 1, photoUrl: r.photo_url ?? null,
    category: isItemCategory(r.category) ? r.category : null, sort: r.sort, paypalProductId: r.paypal_product_id,
    publishedAt: r.published_at, updatedAt: r.updated_at,
    variants: vs.filter((v) => v.item_id === r.id).map(toVariant),
  }));
}

/** Inserts one draft item and its variants at position `sort`; returns the new item's id. */
function insertItem(db: Db, shopId: string, d: DraftItem, sort: number, ts: string): string {
  const id = newId('itm', 12);
  db.prepare(
    `INSERT INTO items (id, shop_id, section, name, description, source_text, confidence, issues_json, issue_detail, kind, status, category, sort, updated_at)
     VALUES (@id, @shopId, @section, @name, @description, @sourceText, @confidence, @issues, @issueDetail, @kind, @status, @category, @sort, @ts)`,
  ).run({
    id, shopId, section: d.section, name: d.name, description: d.description, sourceText: d.sourceText,
    confidence: d.confidence, issues: JSON.stringify(d.issues), issueDetail: d.issueDetail, kind: d.kind,
    status: d.status, category: isItemCategory(d.category) ? d.category : null, sort, ts,
  });
  const insVar = db.prepare('INSERT INTO variants (id, item_id, label, price_cents, sort) VALUES (?, ?, ?, ?, ?)');
  d.variants.forEach((v, j) => insVar.run(newId('var', 12), id, v.label, v.priceCents, j));
  return id;
}

/** Replaces every unpublished item of the shop with a new draft list (published items are kept). */
export function replaceDrafts(db: Db, shopId: string, drafts: DraftItem[]): ItemWithVariants[] {
  const ts = now();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM items WHERE shop_id = ? AND paypal_product_id IS NULL').run(shopId);
    drafts.forEach((d, i) => insertItem(db, shopId, d, i, ts));
  });
  tx();
  return listWithVariants(db, shopId);
}

/** Adds one draft item (and its variants) at the end of the shop's menu. */
export function insertDraft(db: Db, shopId: string, draft: DraftItem): ItemWithVariants {
  const id = db.transaction(() => {
    const { sort } = db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS sort FROM items WHERE shop_id = ?').get(shopId) as { sort: number };
    return insertItem(db, shopId, draft, sort, now());
  })();
  return byIdForShop(db, shopId, id)!;
}

export function listWithVariants(db: Db, shopId: string, opts: { status?: ItemStatus[] } = {}): ItemWithVariants[] {
  const rows = opts.status?.length
    ? (db.prepare(`SELECT * FROM items WHERE shop_id = ? AND status IN (${opts.status.map(() => '?').join(',')}) ORDER BY sort`).all(shopId, ...opts.status) as ItemRow[])
    : (db.prepare('SELECT * FROM items WHERE shop_id = ? ORDER BY sort').all(shopId) as ItemRow[]);
  return withVariants(db, rows);
}

/** Each of a shop's items' photo URL (or null), without reading their variants. */
export function photoUrls(db: Db, shopId: string): Map<string, string | null> {
  const rows = db.prepare('SELECT id, photo_url FROM items WHERE shop_id = ?').all(shopId) as { id: string; photo_url: string | null }[];
  return new Map(rows.map((r) => [r.id, r.photo_url ?? null]));
}

/** Item scoped to its shop: never returns another shop's item. */
export function byIdForShop(db: Db, shopId: string, itemId: string): ItemWithVariants | null {
  const r = db.prepare('SELECT * FROM items WHERE id = ? AND shop_id = ?').get(itemId, shopId) as ItemRow | undefined;
  return r ? withVariants(db, [r])[0] : null;
}

export type ItemPatch = Partial<Pick<ItemWithVariants, 'section' | 'name' | 'description' | 'issues' | 'issueDetail' | 'kind' | 'status' | 'soldOut' | 'photoUrl' | 'category' | 'sort' | 'publishedAt'>>;

const COLS: Record<keyof ItemPatch, string> = {
  section: 'section', name: 'name', description: 'description', issues: 'issues_json', issueDetail: 'issue_detail',
  kind: 'kind', status: 'status', soldOut: 'sold_out', photoUrl: 'photo_url', category: 'category', sort: 'sort', publishedAt: 'published_at',
};

export function update(db: Db, id: string, patch: ItemPatch): void {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof ItemPatch, unknown][];
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${COLS[k]} = @${k}`).join(', ');
  const params = Object.fromEntries(
    entries.map(([k, v]) => [k, k === 'issues' ? JSON.stringify(v) : k === 'soldOut' ? (v ? 1 : 0) : v]),
  );
  db.prepare(`UPDATE items SET ${sets}, updated_at = @ts WHERE id = @id`).run({ ...params, id, ts: now() });
}

export function updateVariant(db: Db, variantId: string, patch: { label?: string | null; priceCents?: number | null }): void {
  if (patch.label !== undefined) db.prepare('UPDATE variants SET label = ? WHERE id = ?').run(patch.label, variantId);
  if (patch.priceCents !== undefined) db.prepare('UPDATE variants SET price_cents = ? WHERE id = ?').run(patch.priceCents, variantId);
}

/** Replaces an item's variants (used when the seller merges or edits options). */
export function setVariants(db: Db, itemId: string, variants: { label: string | null; priceCents: number | null }[]): void {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM variants WHERE item_id = ?').run(itemId);
    const ins = db.prepare('INSERT INTO variants (id, item_id, label, price_cents, sort) VALUES (?, ?, ?, ?, ?)');
    variants.forEach((v, j) => ins.run(newId('var', 12), itemId, v.label, v.priceCents, j));
  });
  tx();
}

/** Only a draft goes live: an item the seller removed (or made "ask in person") mid-publish keeps that status. */
export function setPayPalProductId(db: Db, id: string, paypalProductId: string): void {
  db.prepare(
    `UPDATE items SET paypal_product_id = ?, status = CASE WHEN status = 'draft' THEN 'live' ELSE status END,
       published_at = ?, updated_at = ? WHERE id = ?`,
  ).run(paypalProductId, now(), now(), id);
}
