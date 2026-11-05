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

  it('replaces draft items and keeps variant order', () => {
    const { shop } = shops.create(db, { name: 'Marigold' });
    items.replaceDrafts(db, shop.id, [draft('Butter croissant', [425]), draft('Drip coffee', [300, 400])]);
    items.replaceDrafts(db, shop.id, [draft('Drip coffee', [300, 400]), draft('Seeded rye', [1050])]);
    const list = items.listWithVariants(db, shop.id);
    expect(list.map((i) => i.name)).toEqual(['Drip coffee', 'Seeded rye']);
    expect(list[0].variants.map((v) => [v.label, v.priceCents])).toEqual([['S', 300], ['L', 400]]);
    expect(list[0].id).toMatch(/^itm_/);
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
});
