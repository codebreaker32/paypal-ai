import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '@/lib/config';
import { SCHEMA_SQL } from './schema';

export type Db = Database.Database;

function applySchema(db: Db): Db {
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
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
