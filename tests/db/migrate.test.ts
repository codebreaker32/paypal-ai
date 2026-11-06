// An existing database from before orders.client_key (R7) gets the column when the app opens it.
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { SCHEMA_SQL } from '@/lib/db/schema';
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
});
