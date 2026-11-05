// POST /api/assistant/[slug] stops the console turn when the browser goes away: the engine gets an AbortSignal that
// aborts when the request is closed or the response stream is cancelled.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/db';
import { resetRateLimits } from '@/lib/rate-limit';
import type { BuyerConsoleTurnInput, ConsoleEvent } from '@/lib/agent/buyer-console';
import { seedShop, type SeededShop } from '../helpers/shop';

const seen: BuyerConsoleTurnInput[] = [];
vi.mock('@/lib/agent/buyer-console', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agent/buyer-console')>();
  return {
    ...actual,
    // A turn that says hello, then waits until it is stopped.
    runBuyerConsoleTurn: async function* (input: BuyerConsoleTurnInput): AsyncGenerator<ConsoleEvent> {
      seen.push(input);
      yield { type: 'session', id: 'asst_route' };
      await new Promise<void>((resolve) => {
        if (input.signal?.aborted) resolve();
        else input.signal?.addEventListener('abort', () => resolve(), { once: true });
      });
    },
  };
});

const { POST } = await import('@/app/api/assistant/[slug]/route');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfie-assistant-route-'));
let s: SeededShop;
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(tmp, 'test.db');
  s = seedShop(getDb(), { name: `Assistant Route Bakery ${Date.now()}` });
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const ctx = () => ({ params: Promise.resolve({ slug: s.shop.slug }) });
const post = (signal?: AbortSignal) =>
  new Request(`http://localhost/api/assistant/${s.shop.slug}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.20' },
    body: JSON.stringify({ text: 'Two almond croissants' }),
    signal,
  });

describe('POST /api/assistant/[slug] and a browser that goes away', () => {
  it('aborts the turn when the request is closed', async () => {
    resetRateLimits();
    const closed = new AbortController();
    const res = await POST(post(closed.signal), ctx());
    const reader = res.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('{"type":"session","id":"asst_route"}\n');
    const turn = seen.at(-1)!;
    expect(turn.signal?.aborted).toBe(false);
    closed.abort();
    expect(turn.signal?.aborted).toBe(true);
    expect((await reader.read()).done).toBe(true);
  });

  it('aborts the turn when the response stream is cancelled, and ends quietly', async () => {
    resetRateLimits();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(post(), ctx());
    const reader = res.body!.getReader();
    await reader.read();
    await new Promise((r) => setTimeout(r, 10)); // the stream is already waiting for the next event
    const turn = seen.at(-1)!;
    await reader.cancel();
    expect(turn.signal?.aborted).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    // Nothing is written to the closed stream (no "Controller is already closed" failure).
    expect(logged.mock.calls.map((c) => String(c[0]))).toEqual([]);
    logged.mockRestore();
  });
});
