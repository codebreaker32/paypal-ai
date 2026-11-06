// Design reset (6 Nov): every item can have a photo and every shop a cover photo. Both are stored as a site-relative
// URL ("/demo/marigold/almond-croissant.jpg" for bundled demo photos, "/i/<file>" for a seller's upload) or null.
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, getDb } from '@/lib/db';
import { SCHEMA_SQL } from '@/lib/db/schema';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import { tempDbPath } from '../helpers/temp-db';

describe('item photos and shop covers', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });

  it('a new shop and item have no photo', () => {
    const { shop } = shops.create(db, { name: 'Marigold Bakehouse' });
    expect(shop.coverUrl).toBeNull();
    const item = items.insertDraft(db, shop.id, {
      section: null, name: 'Almond croissant', description: null, sourceText: 'Almond croissant 5.00', confidence: 'high',
      kind: 'PHYSICAL', issues: [], issueDetail: null, status: 'draft', variants: [{ label: null, priceCents: 500 }],
    });
    expect(item.photoUrl).toBeNull();
  });

  it('stores, reads back and clears an item photo and a shop cover', () => {
    const { shop } = shops.create(db, { name: 'Marigold Bakehouse' });
    const item = items.insertDraft(db, shop.id, {
      section: null, name: 'Almond croissant', description: null, sourceText: 'x', confidence: 'high',
      kind: 'PHYSICAL', issues: [], issueDetail: null, status: 'draft', variants: [{ label: null, priceCents: 500 }],
    });
    items.update(db, item.id, { photoUrl: '/demo/marigold/almond-croissant.jpg' });
    expect(items.byIdForShop(db, shop.id, item.id)?.photoUrl).toBe('/demo/marigold/almond-croissant.jpg');
    items.update(db, item.id, { photoUrl: null });
    expect(items.byIdForShop(db, shop.id, item.id)?.photoUrl).toBeNull();
    expect(shops.update(db, shop.id, { coverUrl: '/demo/marigold/cover.jpg' }).coverUrl).toBe('/demo/marigold/cover.jpg');
    expect(shops.update(db, shop.id, { coverUrl: null }).coverUrl).toBeNull();
  });

  it('stores an item category (null when the reading has none) and a shop logo', () => {
    const { shop } = shops.create(db, { name: 'Marigold Bakehouse' });
    expect(shop.logoUrl).toBeNull();
    const base = { section: null, description: null, sourceText: 'x', confidence: 'high' as const, kind: 'PHYSICAL' as const, issues: [], issueDetail: null, status: 'draft' as const, variants: [{ label: null, priceCents: 500 }] };
    const [loaf, bun] = items.replaceDrafts(db, shop.id, [{ ...base, name: 'Country sourdough loaf', category: 'bread' }, { ...base, name: 'Cardamom bun' }]);
    expect(loaf.category).toBe('bread');
    expect(bun.category).toBeNull();
    items.update(db, bun.id, { category: 'pastry' });
    expect(items.byIdForShop(db, shop.id, bun.id)?.category).toBe('pastry');
    db.prepare("UPDATE items SET category = 'sandwich' WHERE id = ?").run(loaf.id);
    expect(items.byIdForShop(db, shop.id, loaf.id)?.category).toBeNull();
    expect(shops.update(db, shop.id, { logoUrl: '/i/logo.webp' }).logoUrl).toBe('/i/logo.webp');
    expect(shops.update(db, shop.id, { logoUrl: null }).logoUrl).toBeNull();
  });

  it('adds items.category and shops.logo_url (run 3) to an older database', () => {
    const g = globalThis as unknown as { __shelfieDb?: { close(): void } };
    g.__shelfieDb?.close();
    delete g.__shelfieDb;
    const file = tempDbPath('migrate-category');
    const old = new Database(file);
    old.exec(SCHEMA_SQL.replace(/\n\s*category TEXT,[^\n]*/, '').replace(/\n\s*logo_url TEXT,[^\n]*/, ''));
    const colsOf = (t: string, d: { prepare(sql: string): { all(): unknown[] } }) =>
      (d.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    expect(colsOf('items', old)).not.toContain('category');
    expect(colsOf('shops', old)).not.toContain('logo_url');
    old.close();
    process.env.DATABASE_PATH = file;
    const upgraded = getDb();
    expect(colsOf('items', upgraded)).toContain('category');
    expect(colsOf('shops', upgraded)).toContain('logo_url');
    upgraded.close();
    delete g.__shelfieDb;
  });

  it('adds items.photo_url and shops.cover_url to an older database', () => {
    const g = globalThis as unknown as { __shelfieDb?: { close(): void } };
    g.__shelfieDb?.close();
    delete g.__shelfieDb;
    const file = tempDbPath('migrate-photos');
    const old = new Database(file);
    old.exec(SCHEMA_SQL.replace(/\n\s*photo_url TEXT,[^\n]*/, '').replace(/\n\s*cover_url TEXT,[^\n]*/, ''));
    const colsOf = (t: string, d: { prepare(sql: string): { all(): unknown[] } }) =>
      (d.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    expect(colsOf('items', old)).not.toContain('photo_url');
    expect(colsOf('shops', old)).not.toContain('cover_url');
    old.close();
    process.env.DATABASE_PATH = file;
    const upgraded = getDb();
    expect(colsOf('items', upgraded)).toContain('photo_url');
    expect(colsOf('shops', upgraded)).toContain('cover_url');
    upgraded.close();
    delete g.__shelfieDb;
  });
});
