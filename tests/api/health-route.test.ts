// GET /api/health: the Render health check. One trivial SQLite query; never PayPal or Claude.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  getDbError: null as Error | null,
  getPayPal: vi.fn(),
}));

vi.mock('@/lib/db', async (orig) => {
  const real = await orig<typeof import('@/lib/db')>();
  return {
    ...real,
    getDb: () => {
      if (state.getDbError) throw state.getDbError;
      return state.db;
    },
  };
});

vi.mock('@/lib/paypal', async (orig) => {
  const real = await orig<typeof import('@/lib/paypal')>();
  return { ...real, getPayPal: state.getPayPal };
});

const { createTestDb } = await import('@/lib/db');
const route = await import('@/app/api/health/route');

describe('GET /api/health', () => {
  afterEach(() => {
    state.getDbError = null;
    state.getPayPal.mockClear();
    vi.restoreAllMocks();
  });

  it('runs in the Node runtime', () => {
    expect(route.runtime).toBe('nodejs');
  });

  it('answers 200 { ok: true } when SQLite answers, uncached', async () => {
    state.db = createTestDb();
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers 503 with the JSON error shape when the database cannot be opened', async () => {
    state.getDbError = new Error('SQLITE_CANTOPEN: /var/data/shelfie.db');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await route.GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'DB_UNAVAILABLE', message: expect.any(String) } });
    // The error detail (a file path) is logged, not returned.
    expect(JSON.stringify(body)).not.toContain('/var/data');
    expect(err).toHaveBeenCalled();
  });

  it('answers 503 when the query itself fails', async () => {
    const db = createTestDb();
    db.close();
    state.db = db;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await route.GET();
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('DB_UNAVAILABLE');
  });

  it('never calls PayPal', async () => {
    state.db = createTestDb();
    await route.GET();
    expect(state.getPayPal).not.toHaveBeenCalled();
  });
});
