// GET /agents.txt and GET /llms.txt: plain text, live shops only, door URLs from APP_URL.
import { describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({ db: null as unknown as Database.Database }));

vi.mock('@/lib/db', async (orig) => {
  const real = await orig<typeof import('@/lib/db')>();
  return { ...real, getDb: () => state.db };
});

const { createTestDb } = await import('@/lib/db');
const { getConfig } = await import('@/lib/config');
const { seedShop } = await import('../helpers/shop');
const agents = await import('@/app/agents.txt/route');
const llms = await import('@/app/llms.txt/route');

describe.each([
  ['/agents.txt', agents],
  ['/llms.txt', llms],
] as const)('GET %s', (_path, route) => {
  it('runs in the Node runtime', () => {
    expect(route.runtime).toBe('nodejs');
  });

  it('answers text/plain in UTF-8 with live shops and their agent doors', async () => {
    state.db = createTestDb();
    const { shop } = seedShop(state.db, { name: 'Marigold Bakehouse' });
    seedShop(state.db, { name: 'Paused Pies', status: 'paused' });

    const res = await route.GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    const body = await res.text();
    const app = getConfig().appUrl;
    expect(body).toContain(`${app}/s/${shop.slug}/mcp`);
    expect(body).toContain('Marigold Bakehouse');
    expect(body).not.toContain('Paused Pies');
  });
});
