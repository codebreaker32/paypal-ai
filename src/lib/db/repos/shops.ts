import type { Db } from '@/lib/db';
import { now } from '@/lib/db';
import { hashToken, newId, ownerToken, slugify } from '@/lib/domain/ids';
import { RESERVED_SLUG } from '@/lib/domain/payee';
import type { Shop, ShopFulfillment, ShopKind, ShopStatus } from '@/lib/domain/types';
import { timingSafeEqual } from 'node:crypto';
import { menuPhotoAvatarSrc, shopAvatar, type ShopAvatarSource } from '@/lib/domain/avatar';
import { avatarItems } from './items';

interface ShopRow {
  id: string; slug: string; name: string; about: string; kind: ShopKind; fulfillment: ShopFulfillment;
  pickup_notes: string; shipping_fee_cents: number; status: ShopStatus; order_cap_cents: number;
  owner_token_hash: string; menu_photo_paths: string; created_at: string; published_at: string | null;
  payee_email: string | null; cover_url: string | null; logo_url: string | null; account_id: string | null;
  category: string | null;
}

const toShop = (r: ShopRow): Shop => ({
  id: r.id, slug: r.slug, name: r.name, about: r.about, kind: r.kind, fulfillment: r.fulfillment,
  pickupNotes: r.pickup_notes, shippingFeeCents: r.shipping_fee_cents, status: r.status,
  orderCapCents: r.order_cap_cents, menuPhotoPaths: JSON.parse(r.menu_photo_paths) as string[],
  createdAt: r.created_at, publishedAt: r.published_at, payeeEmail: r.payee_email ?? null,
  coverUrl: r.cover_url ?? null, logoUrl: r.logo_url ?? null, accountId: r.account_id ?? null,
  category: r.category ?? null,
});

export interface CreateShopInput {
  name: string;
  about?: string;
  kind?: ShopKind;
  fulfillment?: ShopFulfillment;
  pickupNotes?: string;
  shippingFeeCents?: number;
  menuPhotoPaths?: string[];
  payeeEmail?: string | null;
  /** The owning account; absent or null leaves the shop unattached (reached by its owner link). */
  accountId?: string | null;
}

/** Whether `slug` is used by a shop other than `exceptId`, or belonged to a deleted shop (SR19). */
export function slugTaken(db: Db, slug: string, exceptId: string | null = null): boolean {
  return (
    db.prepare('SELECT 1 FROM shops WHERE slug = ? AND id IS NOT ?').get(slug, exceptId) !== undefined ||
    db.prepare('SELECT 1 FROM retired_slugs WHERE slug = ?').get(slug) !== undefined
  );
}

/** A slug from `name` that no other shop uses and no deleted shop used (`exceptId`'s own slug doesn't count as taken). */
function uniqueSlug(db: Db, name: string, exceptId: string | null = null): string {
  const base = slugify(name);
  if (!slugTaken(db, base, exceptId)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!slugTaken(db, candidate, exceptId)) return candidate;
  }
}

/** Creates a draft shop. The raw owner token is returned once and only its hash is stored. */
export function create(db: Db, input: CreateShopInput): { shop: Shop; ownerToken: string } {
  const token = ownerToken();
  const id = newId('shp');
  db.prepare(
    `INSERT INTO shops (id, slug, name, about, kind, fulfillment, pickup_notes, shipping_fee_cents, owner_token_hash, menu_photo_paths, created_at, payee_email, account_id)
     VALUES (@id, @slug, @name, @about, @kind, @fulfillment, @pickupNotes, @shippingFeeCents, @hash, @photos, @createdAt, @payeeEmail, @accountId)`,
  ).run({
    id, slug: uniqueSlug(db, input.name), name: input.name, about: input.about ?? '', kind: input.kind ?? 'food',
    fulfillment: input.fulfillment ?? 'pickup', pickupNotes: input.pickupNotes ?? '',
    shippingFeeCents: input.shippingFeeCents ?? 0, hash: hashToken(token),
    photos: JSON.stringify(input.menuPhotoPaths ?? []), createdAt: now(), payeeEmail: input.payeeEmail ?? null,
    accountId: input.accountId ?? null,
  });
  return { shop: byId(db, id)!, ownerToken: token };
}

export function byId(db: Db, id: string): Shop | null {
  const r = db.prepare('SELECT * FROM shops WHERE id = ?').get(id) as ShopRow | undefined;
  return r ? toShop(r) : null;
}

export function bySlug(db: Db, slug: string): Shop | null {
  const r = db.prepare('SELECT * FROM shops WHERE slug = ?').get(slug) as ShopRow | undefined;
  return r ? toShop(r) : null;
}

/** The account's shops, newest first. */
export function listByAccount(db: Db, accountId: string): Shop[] {
  const rows = db.prepare('SELECT * FROM shops WHERE account_id = ? ORDER BY created_at DESC, rowid DESC').all(accountId) as ShopRow[];
  return rows.map(toShop);
}

export function byOwnerToken(db: Db, token: string): Shop | null {
  const r = db.prepare('SELECT * FROM shops WHERE owner_token_hash = ?').get(hashToken(token)) as ShopRow | undefined;
  return r ? toShop(r) : null;
}

export function verifyOwnerToken(db: Db, shopId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const r = db.prepare('SELECT owner_token_hash FROM shops WHERE id = ?').get(shopId) as { owner_token_hash: string } | undefined;
  if (!r) return false;
  const a = Buffer.from(r.owner_token_hash, 'hex');
  const b = Buffer.from(hashToken(token), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ShopPatch = Partial<Pick<Shop, 'name' | 'about' | 'kind' | 'fulfillment' | 'pickupNotes' | 'shippingFeeCents' | 'status' | 'orderCapCents' | 'menuPhotoPaths' | 'publishedAt' | 'payeeEmail' | 'coverUrl' | 'logoUrl' | 'category'>>;

const COLS: Record<keyof ShopPatch, string> = {
  name: 'name', about: 'about', kind: 'kind', fulfillment: 'fulfillment', pickupNotes: 'pickup_notes',
  shippingFeeCents: 'shipping_fee_cents', status: 'status', orderCapCents: 'order_cap_cents',
  menuPhotoPaths: 'menu_photo_paths', publishedAt: 'published_at', payeeEmail: 'payee_email', coverUrl: 'cover_url', logoUrl: 'logo_url', category: 'category',
};

export function update(db: Db, id: string, patch: ShopPatch): Shop {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof ShopPatch, unknown][];
  if (entries.length) {
    const sets = entries.map(([k]) => `${COLS[k]} = @${k}`).join(', ');
    const params = Object.fromEntries(entries.map(([k, v]) => [k, k === 'menuPhotoPaths' ? JSON.stringify(v) : v]));
    db.prepare(`UPDATE shops SET ${sets} WHERE id = @id`).run({ ...params, id });
  }
  return byId(db, id)!;
}

/** Gives the shop a unique slug made from `name` (a draft shop gets its public slug at first publish). */
export function setSlug(db: Db, id: string, name: string): Shop {
  db.prepare('UPDATE shops SET slug = ? WHERE id = ?').run(uniqueSlug(db, name, id), id);
  return byId(db, id)!;
}

/** Deletes the shop (its items, orders and the rest cascade) and retires its slug for good (SR19). Run inside the caller's transaction. */
export function deleteAndRetireSlug(db: Db, shop: Pick<Shop, 'id' | 'slug'>): void {
  db.prepare('INSERT OR IGNORE INTO retired_slugs (slug, retired_at) VALUES (?, ?)').run(shop.slug, now());
  db.prepare('DELETE FROM shops WHERE id = ?').run(shop.id);
}

/** Marks the shop live (first publish keeps its original published_at). */
export function publish(db: Db, id: string): Shop {
  db.prepare(`UPDATE shops SET status = 'live', published_at = COALESCE(published_at, ?) WHERE id = ?`).run(now(), id);
  return byId(db, id)!;
}

/**
 * The shops /agents.txt and /llms.txt list: live and able to take orders (a PayPal email, or the demo shop, which is
 * paid to the platform). Newest first, at most `limit`. Not paused, not draft.
 * The payee condition is `canBePaid` (src/lib/domain/payee.ts) written in SQL, which can't call it: change both together
 * (tests/discovery/index-file.test.ts checks they agree).
 */
export function listOrderableForIndex(db: Db, limit: number): { name: string; slug: string; about: string }[] {
  return db
    .prepare(
      `SELECT name, slug, about FROM shops WHERE status = 'live' AND (payee_email IS NOT NULL OR slug = ?)
       ORDER BY COALESCE(published_at, created_at) DESC, rowid DESC LIMIT ?`,
    )
    .all(RESERVED_SLUG, limit) as { name: string; slug: string; about: string }[];
}

/** The shop `npm run seed` made under `key` (src/lib/demo/shops.ts), or null. */
export function bySeedKey(db: Db, key: string): Shop | null {
  const r = db.prepare('SELECT * FROM shops WHERE seed_key = ?').get(key) as ShopRow | undefined;
  return r ? toShop(r) : null;
}

/** Marks a shop as the seed's own under `key`. */
export function setSeedKey(db: Db, id: string, key: string): void {
  db.prepare('UPDATE shops SET seed_key = ? WHERE id = ?').run(key, id);
}

/** A shop on the Browse page: what its card shows. */
export interface BrowseShop {
  slug: string;
  name: string;
  /** The Browse chip (food, drinks, gifts, repairs), or null. */
  category: string | null;
  coverUrl: string | null;
  /** The shop's round picture, as the public shop header draws it (`shopAvatar`). */
  avatar: ShopAvatarSource;
  /** Where to get it (pickup notes), else its short description. */
  line: string;
  /** Its listed items' names, in menu order. */
  itemNames: string[];
}

/**
 * Every shop that is live and can take orders (the predicate of `listOrderableForIndex` and `canBePaid`), newest first,
 * with what a Browse card needs.
 */
export function listBrowseShops(db: Db): BrowseShop[] {
  const rows = db
    .prepare(
      `SELECT * FROM shops WHERE status = 'live' AND (payee_email IS NOT NULL OR slug = ?)
       ORDER BY COALESCE(published_at, created_at) DESC, rowid DESC`,
    )
    .all(RESERVED_SLUG) as ShopRow[];
  return rows.map((r) => {
    const shop = toShop(r);
    const listed = avatarItems(db, shop.id);
    return {
      slug: shop.slug,
      name: shop.name,
      category: shop.category,
      coverUrl: shop.coverUrl,
      avatar: shopAvatar({ ...shop, menuPhotoSrc: menuPhotoAvatarSrc(shop, 'public') }, listed),
      line: shop.pickupNotes.trim() || shop.about.trim(),
      itemNames: listed.map((i) => i.name),
    };
  });
}
