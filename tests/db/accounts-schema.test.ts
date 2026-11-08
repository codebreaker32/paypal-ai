// Run 5 schema: accounts, sessions, payee_changes, shops.account_id, and the upgrade path for a database from before them.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createTestDb, getDb, type Db } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import { createShopFromPhotos, createShopFromSample } from '@/lib/catalog/setup';
import { tempDbPath } from '../helpers/temp-db';

const columnsOf = (db: Db, table: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
const indexesOf = (db: Db, table: string) =>
  (db.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[]).map((i) => i.name);

const insertAccount = (db: Db, id: string) =>
  db
    .prepare(
      `INSERT INTO accounts (id, email, password_hash, recovery_hash, terms_version, terms_accepted_at, password_changed_at, created_at)
       VALUES (?, ?, 'h', 'r', 'v1', 't', 't', 't')`,
    )
    .run(id, `${id}@example.com`);

// A shops table as the first release created it: none of the columns added since.
const FIRST_RELEASE_SHOPS = `CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  about TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'food',
  fulfillment TEXT NOT NULL DEFAULT 'pickup',
  pickup_notes TEXT NOT NULL DEFAULT '',
  shipping_fee_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  order_cap_cents INTEGER NOT NULL DEFAULT 50000,
  owner_token_hash TEXT NOT NULL,
  menu_photo_paths TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  published_at TEXT
);`;

describe('account tables on a fresh database', () => {
  it('has the accounts, sessions and payee_changes columns the spec names', () => {
    const db = createTestDb();
    expect(columnsOf(db, 'accounts')).toEqual([
      'id', 'email', 'password_hash', 'recovery_hash', 'recovery_saved_at', 'terms_version', 'terms_accepted_at',
      'password_changed_at', 'created_at',
    ]);
    expect(columnsOf(db, 'sessions')).toEqual(['token_hash', 'account_id', 'created_at', 'expires_at']);
    expect(columnsOf(db, 'payee_changes')).toEqual(['id', 'shop_id', 'old_masked', 'new_masked', 'changed_at']);
    expect(indexesOf(db, 'sessions')).toContain('sessions_account');
    expect(columnsOf(db, 'shops')).toContain('account_id');
    expect(indexesOf(db, 'shops')).toContain('shops_account');
  });

  it('refuses two accounts with one email', () => {
    const db = createTestDb();
    insertAccount(db, 'acc_a');
    expect(() =>
      db
        .prepare(
          `INSERT INTO accounts (id, email, password_hash, recovery_hash, terms_version, terms_accepted_at, password_changed_at, created_at)
           VALUES ('acc_b', 'acc_a@example.com', 'h', 'r', 'v1', 't', 't', 't')`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it("removes an account's sessions with it, and a shop's payee changes with it", () => {
    const db = createTestDb();
    insertAccount(db, 'acc_a');
    db.prepare(`INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES ('t', 'acc_a', 'c', 'e')`).run();
    db.prepare('DELETE FROM accounts WHERE id = ?').run('acc_a');
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: 0 });

    const { shop } = shops.create(db, { name: 'Marigold' });
    db.prepare(`INSERT INTO payee_changes (shop_id, new_masked, changed_at) VALUES (?, 'r•••@example.com', 't')`).run(shop.id);
    db.prepare('DELETE FROM shops WHERE id = ?').run(shop.id);
    expect(db.prepare('SELECT COUNT(*) AS n FROM payee_changes').get()).toEqual({ n: 0 });
  });
});

describe('shops.account_id', () => {
  it('stores the owning account, and a shop made without one has none', () => {
    const db = createTestDb();
    insertAccount(db, 'acc_a');
    expect(shops.create(db, { name: 'Owned', accountId: 'acc_a' }).shop.accountId).toBe('acc_a');
    expect(shops.create(db, { name: 'Unattached' }).shop.accountId).toBeNull();
  });

  it('refuses an account that does not exist', () => {
    const db = createTestDb();
    expect(() => shops.create(db, { name: 'Nobody', accountId: 'acc_missing' })).toThrow(/FOREIGN KEY/);
  });

  it('lists an account\'s shops, newest first, and nobody else\'s', () => {
    const db = createTestDb();
    insertAccount(db, 'acc_a');
    insertAccount(db, 'acc_b');
    const first = shops.create(db, { name: 'First', accountId: 'acc_a' }).shop;
    shops.create(db, { name: 'Theirs', accountId: 'acc_b' });
    shops.create(db, { name: 'Unattached' });
    const second = shops.create(db, { name: 'Second', accountId: 'acc_a' }).shop;
    expect(shops.listByAccount(db, 'acc_a').map((s) => s.id)).toEqual([second.id, first.id]);
    expect(shops.listByAccount(db, 'acc_none')).toEqual([]);
  });
});

describe('creating a draft shop for an account', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-account-shops-'));
  afterAll(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('passes accountId through createShopFromSample and createShopFromPhotos, and defaults to none', async () => {
    vi.stubEnv('UPLOADS_DIR', dir);
    const db = createTestDb();
    insertAccount(db, 'acc_a');
    expect((await createShopFromSample(db, 'marigold-bakehouse', 'acc_a')).shop.accountId).toBe('acc_a');
    expect((await createShopFromSample(db, 'marigold-bakehouse')).shop.accountId).toBeNull();

    const photo = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    expect((await createShopFromPhotos(db, [photo], 'acc_a')).shop.accountId).toBe('acc_a');
    expect((await createShopFromPhotos(db, [photo])).shop.accountId).toBeNull();
  });
});

describe('upgrading a database from before accounts', () => {
  it('gains shops.account_id and its index without error, keeping its shops unattached', () => {
    const g = globalThis as unknown as { __shelfieDb?: { close(): void } };
    g.__shelfieDb?.close();
    delete g.__shelfieDb;
    const file = tempDbPath('migrate-accounts');
    const old = new Database(file);
    old.exec(FIRST_RELEASE_SHOPS);
    old
      .prepare(
        `INSERT INTO shops (id, slug, name, owner_token_hash, created_at, status) VALUES ('shp_old', 'old-shop', 'Old Shop', 'x', '2026-11-01T00:00:00Z', 'live')`,
      )
      .run();
    expect((old.prepare('PRAGMA table_info(shops)').all() as { name: string }[]).map((c) => c.name)).not.toContain('account_id');
    old.close();

    vi.stubEnv('DATABASE_PATH', file);
    const db = getDb();
    expect(columnsOf(db, 'shops')).toContain('account_id');
    expect(indexesOf(db, 'shops')).toContain('shops_account');
    expect(columnsOf(db, 'accounts')).toContain('password_hash');
    expect(shops.byId(db, 'shp_old')).toMatchObject({ name: 'Old Shop', status: 'live', accountId: null });
    vi.unstubAllEnvs();
  });
});
