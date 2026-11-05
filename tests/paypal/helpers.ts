import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createPayPalClient } from '@/lib/paypal/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fixture(name: string): { status: number; body: any } {
  return JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', `${name}.json`), 'utf8'));
}

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export type Reply = { status: number; body: unknown } | Error;

/** A scripted fetch: routes by "METHOD path-suffix"; replies are consumed in order, the last one repeats. */
export function scriptedFetch(routes: Record<string, Reply[]>) {
  const calls: Call[] = [];
  const counters: Record<string, number> = {};
  const impl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    const parsed = new URL(u);
    const key = Object.keys(routes).find((k) => k === `${method} ${parsed.pathname}`) ?? '';
    const raw = typeof init?.body === 'string' ? init.body : '';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = raw;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      /* form body */
    }
    calls.push({ url: u, method, headers: (init?.headers ?? {}) as Record<string, string>, body });
    if (!key) throw new Error(`Unscripted request: ${method} ${parsed.pathname}`);
    const list = routes[key];
    const i = Math.min(counters[key] ?? 0, list.length - 1);
    counters[key] = (counters[key] ?? 0) + 1;
    const reply = list[i];
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  return { fetch: impl, calls };
}

export const tokenReply = (expiresIn = 3600): Reply => ({ status: 200, body: { access_token: 'tok', expires_in: expiresIn } });

export function makeClient(routes: Record<string, Reply[]>, extra: { now?: () => number } = {}) {
  const s = scriptedFetch({ 'POST /v1/oauth2/token': [tokenReply()], ...routes });
  const sleeps: number[] = [];
  const client = createPayPalClient({
    fetch: s.fetch,
    base: 'https://api-m.sandbox.paypal.com',
    clientId: 'id',
    secret: 'secret',
    sleep: async (ms) => void sleeps.push(ms),
    ...extra,
  });
  return { client, calls: s.calls, sleeps };
}
