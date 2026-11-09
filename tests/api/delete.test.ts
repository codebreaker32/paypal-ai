// Deleting shops and accounts, changing passwords and ending sessions (SR19, with SR7, SR8 and SR11 on the password checks).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import type { DraftItem } from '@/lib/domain/types';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
  guests: false,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void state.jar.set(name, value),
  }),
}));
vi.mock('@/lib/db', async (orig) => ({ ...(await orig<typeof import('@/lib/db')>()), getDb: () => state.db }));
vi.mock('@/lib/auth/guest', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth/guest')>()),
  guestShopsAllowed: () => state.guests,
}));
vi.mock('@/lib/auth/password', async (orig) => {
  const real = await orig<typeof import('@/lib/auth/password')>();
  return {
    ...real,
    hashPassword: vi.fn(async (p: string) => `fake$${p}`),
    verifyPassword: vi.fn(async (p: string, stored: string) => stored === `fake$${p}`),
  };
});

const { createTestDb, now } = await import('@/lib/db');
const items = await import('@/lib/db/repos/items');
const shops = await import('@/lib/db/repos/shops');
const { publishShop } = await import('@/lib/catalog/publish');
const { createFakePayPal } = await import('@/lib/paypal/fake');
const { resetRateLimits } = await import('@/lib/rate-limit');

const draft = (name: string): DraftItem => ({
  section: 'Pastries', name, description: null, sourceText: name, confidence: 'high', kind: 'PHYSICAL',
  issues: [], issueDetail: null, status: 'draft', variants: [{ label: null, priceCents: 300 }],
});

beforeEach(() => {
  state.db = createTestDb();
  state.jar.clear();
  state.guests = false;
  resetRateLimits();
});

describe('retired slugs', () => {
  const retire = (slug: string) => state.db.prepare('INSERT INTO retired_slugs (slug, retired_at) VALUES (?, ?)').run(slug, now());
  const asDraft = (id: string) => state.db.prepare('UPDATE shops SET slug = ? WHERE id = ?').run('draft-abcdefgh', id);

  it('are taken when a shop is created', () => {
    retire('tia-lupe-tacos');
    expect(shops.create(state.db, { name: 'Tia Lupe Tacos' }).shop.slug).toBe('tia-lupe-tacos-2');
  });

  it('are skipped when a numbered slug is retired too', () => {
    retire('tia-lupe-tacos');
    retire('tia-lupe-tacos-2');
    expect(shops.create(state.db, { name: 'Tia Lupe Tacos' }).shop.slug).toBe('tia-lupe-tacos-3');
  });

  it('are taken when a draft gets its public slug', () => {
    retire('tia-lupe-tacos');
    const { shop } = shops.create(state.db, { name: 'Tia Lupe Tacos' });
    asDraft(shop.id);
    expect(shops.setSlug(state.db, shop.id, 'Tia Lupe Tacos').slug).toBe('tia-lupe-tacos-2');
  });

  it('are taken by the reserved name at first publish', async () => {
    retire('marigold-bakehouse-2');
    const { shop } = shops.create(state.db, { name: 'Marigold Bakehouse', payeeEmail: 'rosa@example.com' });
    asDraft(shop.id);
    items.replaceDrafts(state.db, shop.id, [draft('Bun')]);
    await publishShop({ db: state.db, paypal: createFakePayPal() }, shop.id);
    expect(shops.byId(state.db, shop.id)!.slug).toBe('marigold-bakehouse-3');
  });
});
