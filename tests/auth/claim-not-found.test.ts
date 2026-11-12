// /claim/<bad>: a real 404, as a small branded page rather than bare text, the same for every kind of bad link.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({ db: null as unknown as Database.Database, jar: new Map<string, string>() }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void state.jar.set(name, value),
  }),
}));
vi.mock('@/lib/db', async (orig) => ({ ...(await orig<typeof import('@/lib/db')>()), getDb: () => state.db }));

const { createTestDb } = await import('@/lib/db');
const { GET: claim } = await import('@/app/claim/[token]/route');

const open = (token: string) => claim(new Request(`http://x/claim/${token}`), { params: Promise.resolve({ token }) });

describe('a bad owner link', () => {
  beforeEach(() => {
    state.db = createTestDb();
    state.jar.clear();
  });

  it('is a 404 HTML page with the message and a Log in link', async () => {
    const res = await open('b'.repeat(40));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/^text\/html/);
    const html = await res.text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('This owner link doesn’t work. Check that you copied all of it, or log in.');
    expect(html).toMatch(/<a [^>]*href="\/login"[^>]*>Log in<\/a>/);
    expect(html).toContain('/brand/lockup.svg');
  });

  it('is never cached, never indexed, and keeps the link out of any referrer', async () => {
    const res = await open('b'.repeat(40));
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await res.text()).toContain('<meta name="robots" content="noindex">');
  });

  it('does not repeat the token it was given', async () => {
    const token = '<script>alert(1)</script>'.padEnd(30, 'x');
    const html = await (await open(token)).text();
    expect(html).not.toContain('alert(1)');
  });

  it('answers a too-short token the same as an unknown one', async () => {
    const short = await (await open('short')).text();
    const unknown = await (await open('c'.repeat(40))).text();
    expect(short).toBe(unknown);
  });
});
