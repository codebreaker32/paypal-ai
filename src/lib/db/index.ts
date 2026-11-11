import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '@/lib/config';
import { SCHEMA_SQL } from './schema';

export type Db = Database.Database;

function applySchema(db: Db): Db {
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  addMissingColumns(db);
  return db;
}

/** Columns added after the first release: CREATE TABLE IF NOT EXISTS leaves an existing table as it was. */
function addMissingColumns(db: Db): void {
  const has = (table: string, column: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
  if (!has('orders', 'client_key')) db.exec('ALTER TABLE orders ADD COLUMN client_key TEXT');
  if (!has('shops', 'payee_email')) db.exec('ALTER TABLE shops ADD COLUMN payee_email TEXT');
  if (!has('orders', 'payee_email')) db.exec('ALTER TABLE orders ADD COLUMN payee_email TEXT');
  if (!has('items', 'photo_url')) db.exec('ALTER TABLE items ADD COLUMN photo_url TEXT');
  if (!has('shops', 'cover_url')) db.exec('ALTER TABLE shops ADD COLUMN cover_url TEXT');
  if (!has('shops', 'logo_url')) db.exec('ALTER TABLE shops ADD COLUMN logo_url TEXT');
  if (!has('items', 'category')) db.exec('ALTER TABLE items ADD COLUMN category TEXT');
  if (!has('items', 'example_photo')) db.exec('ALTER TABLE items ADD COLUMN example_photo TEXT');
  if (!has('shops', 'category')) db.exec('ALTER TABLE shops ADD COLUMN category TEXT');
  if (!has('shops', 'seed_key')) db.exec('ALTER TABLE shops ADD COLUMN seed_key TEXT');
  if (!has('shops', 'account_id')) db.exec('ALTER TABLE shops ADD COLUMN account_id TEXT REFERENCES accounts(id)');
  // Here, not in schema.sql: on an older database the column only exists from the line above.
  db.exec('CREATE INDEX IF NOT EXISTS shops_account ON shops(account_id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS shops_seed_key ON shops(seed_key) WHERE seed_key IS NOT NULL');
}

const globalForDb = globalThis as unknown as { __shelfieDb?: Db };

/** Process-wide connection (survives Next dev hot reloads). */
export function getDb(): Db {
  if (!globalForDb.__shelfieDb) {
    const file = path.resolve(getConfig().databasePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    globalForDb.__shelfieDb = applySchema(db);
  }
  return globalForDb.__shelfieDb;
}

/** Fresh in-memory database with the full schema, for tests. */
export function createTestDb(): Db {
  return applySchema(new Database(':memory:'));
}

export const now = (): string => new Date().toISOString();
