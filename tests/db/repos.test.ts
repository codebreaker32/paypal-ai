import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import * as orders from '@/lib/db/repos/orders';
import * as events from '@/lib/db/repos/events';
import { hashToken } from '@/lib/domain/ids';
import type { DraftItem } from '@/lib/domain/types';

const draft = (name: string, prices: (number | null)[], extra: Partial<DraftItem> = {}): DraftItem => ({
  section: 'Pastries', name, description: null, sourceText: name, confidence: 'high', kind: 'PHYSICAL',
  issues: [], issueDetail: null, status: 'draft',
  variants: prices.map((p, i) => ({ label: prices.length > 1 ? ['S', 'L'][i] : null, priceCents: p })),
  ...extra,
});

describe('repos', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });

  it('creates shops with unique slugs and a hashed owner token', () => {
    const a = shops.create(db, { name: 'Marigold Bakehouse' });
    const b = shops.create(db, { name: 'Marigold Bakehouse' });
    expect(a.shop.slug).toBe('marigold-bakehouse');
    expect(b.shop.slug).toBe('marigold-bakehouse-2');
    expect(a.shop.id).toMatch(/^shp_/);
    expect(shops.verifyOwnerToken(db, a.shop.id, a.ownerToken)).toBe(true);
    expect(shops.verifyOwnerToken(db, a.shop.id, b.ownerToken)).toBe(false);
    const raw = db.prepare('select owner_token_hash from shops where id=?').get(a.shop.id) as { owner_token_hash: string };
    expect(raw.owner_token_hash).toBe(hashToken(a.ownerToken));
    expect(raw.owner_token_hash).not.toContain(a.ownerToken);
  });

  it("stores a shop's PayPal email and an order's payee snapshot, which a later shop change never touches", () => {
    const { shop } = shops.create(db, { name: 'Rosa', payeeEmail: 'rosa@example.com' });
    expect(shop.payeeEmail).toBe('rosa@example.com');
    expect(shops.create(db, { name: 'No email yet' }).shop.payeeEmail).toBeNull();
    const [item] = items.replaceDrafts(db, shop.id, [draft('Butter croissant', [425])]);
    const base = {
      shopId: shop.id, fulfillment: 'pickup' as const, buyerName: null, buyerNote: null, agentName: null, clientRequestId: null,
      itemsCents: 425, shippingCents: 0, totalCents: 425, approvalUrl: 'https://x', expiresAt: new Date(Date.now() + 3600e3).toISOString(),
    };
    const line = [{ itemId: item.id, variantId: item.variants[0].id, name: 'Butter croissant', label: null, unitCents: 425, qty: 1, paypalProductId: null }];
    const o = orders.insert(db, { ...base, paypalOrderId: 'PP-PAYEE', payeeEmail: 'rosa@example.com' }, line);
    const platform = orders.insert(db, { ...base, paypalOrderId: 'PP-PLATFORM' }, line);
    expect(shops.update(db, shop.id, { payeeEmail: 'rosa.new@example.com' }).payeeEmail).toBe('rosa.new@example.com');
    expect(orders.byId(db, o.id)!.payeeEmail).toBe('rosa@example.com');
    expect(orders.byId(db, platform.id)!.payeeEmail).toBeNull();
    expect(shops.update(db, shop.id, { payeeEmail: null }).payeeEmail).toBeNull();
  });

  it('lists only the most recent orders when asked for a limit, and maps item photos without their variants', () => {
    const { shop } = shops.create(db, { name: 'Rosa' });
    const [item] = items.replaceDrafts(db, shop.id, [draft('Butter croissant', [425])]);
    items.update(db, item.id, { photoUrl: '/i/img_a.webp' });
    const base = {
      shopId: shop.id, fulfillment: 'pickup' as const, buyerName: null, buyerNote: null, agentName: null, clientRequestId: null,
      itemsCents: 425, shippingCents: 0, totalCents: 425, approvalUrl: 'https://x', expiresAt: new Date(Date.now() + 3600e3).toISOString(),
    };
    const line = [{ itemId: item.id, variantId: item.variants[0].id, name: 'Butter croissant', label: null, unitCents: 425, qty: 1, paypalProductId: null }];
    const ids = ['PP-1', 'PP-2', 'PP-3'].map((pp, i) => {
      const o = orders.insert(db, { ...base, paypalOrderId: pp }, line);
      db.prepare('UPDATE orders SET created_at = ? WHERE id = ?').run(`2026-11-0${i + 1}T10:00:00.000Z`, o.id);
      return o.id;
    });
    expect(orders.listByShop(db, shop.id, { limit: 2 }).map((o) => o.id)).toEqual([ids[2], ids[1]]);
    expect(orders.listByShop(db, shop.id)).toHaveLength(3);
    expect(items.itemPictures(db, shop.id, shop.kind)).toEqual(new Map([[item.id, { photoUrl: '/i/img_a.webp', category: 'pastry' }]]));
  });

  it('replaces draft items and keeps variant order', () => {
    const { shop } = shops.create(db, { name: 'Marigold' });
    items.replaceDrafts(db, shop.id, [draft('Butter croissant', [425]), draft('Drip coffee', [300, 400])]);
    items.replaceDrafts(db, shop.id, [draft('Drip coffee', [300, 400]), draft('Seeded rye', [1050])]);
    const list = items.listWithVariants(db, shop.id);
    expect(list.map((i) => i.name)).toEqual(['Drip coffee', 'Seeded rye']);
    expect(list[0].variants.map((v) => [v.label, v.priceCents])).toEqual([['S', 300], ['L', 400]]);
    expect(list[0].id).toMatch(/^itm_/);
  });

  it('setSlug gives a shop a unique slug from a name, never colliding with itself or others', () => {
    shops.create(db, { name: 'Rosa' });
    const { shop } = shops.create(db, { name: 'draft k7f2qxm4' });
    expect(shops.setSlug(db, shop.id, "Rosa's").slug).toBe('rosas');
    expect(shops.setSlug(db, shop.id, 'Rosa').slug).toBe('rosa-2');
    // Its own current slug is not "taken".
    expect(shops.setSlug(db, shop.id, 'Rosa 2').slug).toBe('rosa-2');
  });

  it('insertDraft adds one draft item (with its variants) at the end of the menu', () => {
    const { shop } = shops.create(db, { name: 'Marigold' });
    items.replaceDrafts(db, shop.id, [draft('Butter croissant', [425]), draft('Drip coffee', [300, 400])]);
    const added = items.insertDraft(db, shop.id, draft('Seeded rye', [1050, null], { section: 'Breads', issues: ['MISSING_PRICE'] }));
    expect(added).toMatchObject({
      shopId: shop.id, name: 'Seeded rye', section: 'Breads', status: 'draft', issues: ['MISSING_PRICE'], sort: 2, paypalProductId: null,
    });
    expect(added.id).toMatch(/^itm_/);
    expect(added.variants.map((v) => [v.label, v.priceCents])).toEqual([['S', 1050], ['L', null]]);
    expect(items.listWithVariants(db, shop.id).map((i) => i.name)).toEqual(['Butter croissant', 'Drip coffee', 'Seeded rye']);
    // The first item of an empty menu sorts first.
    const empty = shops.create(db, { name: 'Empty' }).shop.id;
    expect(items.insertDraft(db, empty, draft('Only', [100])).sort).toBe(0);
  });

  it('stores orders with lines and supports compare-and-set status changes', () => {
    const { shop } = shops.create(db, { name: 'Marigold' });
    const [item] = items.replaceDrafts(db, shop.id, [draft('Butter croissant', [425])]);
    const o = orders.insert(db, {
      shopId: shop.id, fulfillment: 'pickup', buyerName: 'Dana', buyerNote: null, agentName: 'claude-ai',
      clientRequestId: 'k1', itemsCents: 850, shippingCents: 0, totalCents: 850, paypalOrderId: 'PP1',
      approvalUrl: 'https://x', expiresAt: new Date(Date.now() + 3600e3).toISOString(),
    }, [{ itemId: item.id, variantId: item.variants[0].id, name: 'Butter croissant', label: null, unitCents: 425, qty: 2, paypalProductId: null }]);
    expect(o.id).toMatch(/^ord_/);
    expect(o.number).toMatch(/^SHF-[A-HJ-NP-Z2-9]{6}$/);
    expect(o.status).toBe('awaiting_approval');
    expect(orders.byId(db, o.id)?.lines).toHaveLength(1);
    expect(orders.byClientRequestId(db, shop.id, 'k1')?.id).toBe(o.id);
    expect(orders.byPayPalId(db, 'PP1')?.id).toBe(o.id);
    expect(orders.casStatus(db, o.id, 'approved', 'paid')).toBe(false);
    expect(orders.casStatus(db, o.id, 'awaiting_approval', 'approved')).toBe(true);
    expect(orders.byId(db, o.id)?.status).toBe('approved');
  });

  it('grants the capture claim once within 30 seconds', () => {
    const { shop } = shops.create(db, { name: 'Marigold' });
    const o = orders.insert(db, {
      shopId: shop.id, fulfillment: 'pickup', buyerName: null, buyerNote: null, agentName: null, clientRequestId: null,
      itemsCents: 100, shippingCents: 0, totalCents: 100, paypalOrderId: 'PP2', approvalUrl: 'https://x',
      expiresAt: new Date(Date.now() + 3600e3).toISOString(),
    }, []);
    orders.casStatus(db, o.id, 'awaiting_approval', 'approved');
    const t = Date.now();
    expect(orders.claimCapture(db, o.id, t)).toBe(true);
    expect(orders.claimCapture(db, o.id, t + 1000)).toBe(false);
    expect(orders.claimCapture(db, o.id, t + 31_000)).toBe(true);
  });

  it('records order events in order', () => {
    const { shop } = shops.create(db, { name: 'Marigold' });
    const o = orders.insert(db, {
      shopId: shop.id, fulfillment: 'shipping', buyerName: null, buyerNote: null, agentName: null, clientRequestId: null,
      itemsCents: 100, shippingCents: 800, totalCents: 900, paypalOrderId: 'PP3', approvalUrl: 'https://x',
      expiresAt: new Date(Date.now() + 3600e3).toISOString(),
    }, []);
    events.add(db, o.id, 'created', 'mcp', { total: 900 });
    events.add(db, o.id, 'paypal_approved', 'return_url');
    expect(events.list(db, o.id).map((e) => [e.type, e.source])).toEqual([['created', 'mcp'], ['paypal_approved', 'return_url']]);
  });

  it('counts only unexpired unpaid orders toward the open-order caps, so they never wait on the poller', () => {
    const { shop } = shops.create(db, { name: 'Marigold' });
    const add = (paypalOrderId: string, expiresInMs: number) =>
      orders.insert(db, {
        shopId: shop.id, fulfillment: 'pickup', buyerName: null, buyerNote: null, agentName: null, clientRequestId: null,
        clientKey: 'console:198.51.100.7', itemsCents: 100, shippingCents: 0, totalCents: 100, paypalOrderId,
        approvalUrl: 'https://x', expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
      }, []);
    add('PP-live', 3600e3);
    add('PP-old-1', -60e3);
    add('PP-old-2', -24 * 3600e3);
    expect(orders.countOpen(db, shop.id)).toBe(1);
    expect(orders.countOpenForClient(db, shop.id, 'console:198.51.100.7')).toBe(1);
  });
});
