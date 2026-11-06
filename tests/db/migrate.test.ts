// An existing database from before orders.client_key (R7) gets the column when the app opens it.
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { SCHEMA_SQL } from '@/lib/db/schema';
import * as shops from '@/lib/db/repos/shops';
import { tempDbPath } from '../helpers/temp-db';

describe('schema upgrade', () => {
  it('adds orders.client_key to a database created before it existed', () => {
    const file = tempDbPath('migrate');
    const old = new Database(file);
    old.exec(SCHEMA_SQL.replace(/^\s*client_key TEXT,.*$/m, ''));
    const before = (old.prepare('PRAGMA table_info(orders)').all() as { name: string }[]).map((c) => c.name);
    old.close();
    expect(before).not.toContain('client_key');
    process.env.DATABASE_PATH = file;
    const cols = (getDb().prepare('PRAGMA table_info(orders)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain('client_key');
  });

  it('adds shops.payee_email and orders.payee_email (run 2) to an older database, keeping its rows', () => {
    // The open connection from the test above is closed so getDb() opens this file.
    const g = globalThis as unknown as { __shelfieDb?: { close(): void } };
    g.__shelfieDb?.close();
    delete g.__shelfieDb;
    const file = tempDbPath('migrate-payee');
    const old = new Database(file);
    // The shops column is the table's last (drop it with the comma before it); the orders one is followed by a comma.
    old.exec(SCHEMA_SQL.replace(/,\n\s*payee_email TEXT[^\n]*\n\);/, '\n);').replace(/\n\s*payee_email TEXT,[^\n]*/, ''));
    const colsOf = (db: { prepare(sql: string): { all(): unknown[] } }, t: string) =>
      (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    expect(colsOf(old, 'shops')).not.toContain('payee_email');
    expect(colsOf(old, 'orders')).not.toContain('payee_email');
    old.prepare(
      `INSERT INTO shops (id, slug, name, owner_token_hash, created_at, status) VALUES ('shp_old', 'old-shop', 'Old Shop', 'x', '2026-11-01T00:00:00Z', 'live')`,
    ).run();
    old.close();
    process.env.DATABASE_PATH = file;
    const db = getDb();
    expect(colsOf(db, 'shops')).toContain('payee_email');
    expect(colsOf(db, 'orders')).toContain('payee_email');
    expect(shops.byId(db, 'shp_old')).toMatchObject({ name: 'Old Shop', status: 'live', payeeEmail: null });
  });
});
