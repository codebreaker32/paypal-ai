// The buyer console reaches the agent door from the server, so the door can't key create_order by the request IP for
// it: the console proves itself with a per-process secret and passes the buyer's IP, which the door then keys by.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { connectAgentDoor } from '@/lib/agent/buyer-console';
import { BUYER_IP_HEADER, CONSOLE_HEADER, consoleHeaders } from '@/lib/agent/console-key';
import { getDb } from '@/lib/db';
import { createFakePayPal } from '@/lib/paypal/fake';
import { resetRateLimits } from '@/lib/rate-limit';
import { setPayPalForServices } from '@/lib/services';
import { POST } from '@/app/s/[slug]/mcp/route';
import { seedShop, type SeededShop } from '../helpers/shop';
import { tempDbPath } from '../helpers/temp-db';

const SERVER_IP = '10.9.8.7';
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const bad = { items: [{ item_id: 'itm_nope', quantity: 1 }], fulfillment: 'pickup' };

let s: SeededShop;
beforeAll(() => {
  process.env.DATABASE_PATH = tempDbPath('console-key');
  setPayPalForServices(createFakePayPal());
  s = seedShop(getDb(), { name: `Console Key Bakery ${Date.now()}` });
});
beforeEach(() => resetRateLimits());

async function createOrder(headers: Record<string, string>): Promise<string> {
  const res = await POST(
    new Request(`http://localhost:3000/s/${s.shop.slug}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
        'x-forwarded-for': SERVER_IP,
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_order', arguments: bad } }),
    }),
    ctx(s.shop.slug),
  );
  const result = (await res.json()).result;
  return JSON.parse(result.content[0].text).error.code as string;
}

describe('agent door rate limiting for the buyer console', () => {
  it('keys create_order by the buyer IP when the console secret matches', async () => {
    for (let i = 0; i < 30; i++) expect(await createOrder(consoleHeaders('203.0.113.50'))).toBe('UNKNOWN_ITEM');
    expect(await createOrder(consoleHeaders('203.0.113.50'))).toBe('RATE_LIMITED');
    // Another console buyer behind the same server IP has their own bucket, and so does a direct agent on the server IP.
    expect(await createOrder(consoleHeaders('203.0.113.51'))).toBe('UNKNOWN_ITEM');
    expect(await createOrder({})).toBe('UNKNOWN_ITEM');
  });

  it('falls back to the request IP when the secret is wrong or missing', async () => {
    for (let i = 0; i < 15; i++) {
      expect(await createOrder({ [CONSOLE_HEADER]: 'not-the-secret', [BUYER_IP_HEADER]: `203.0.113.${i}` })).toBe('UNKNOWN_ITEM');
    }
    for (let i = 15; i < 30; i++) expect(await createOrder({ [BUYER_IP_HEADER]: `203.0.113.${i}` })).toBe('UNKNOWN_ITEM');
    expect(await createOrder({ [CONSOLE_HEADER]: '', [BUYER_IP_HEADER]: '203.0.113.99' })).toBe('RATE_LIMITED');
    const wrongLength = consoleHeaders('203.0.113.98');
    wrongLength[CONSOLE_HEADER] = `${wrongLength[CONSOLE_HEADER]}x`;
    expect(await createOrder(wrongLength)).toBe('RATE_LIMITED');
    expect(await createOrder({})).toBe('RATE_LIMITED');
  });

  it('the console sends the secret and the buyer IP on every request to the door', async () => {
    const seen: Record<string, string | undefined>[] = [];
    const srv = http.createServer(async (nreq, nres) => {
      seen.push({ console: nreq.headers[CONSOLE_HEADER] as string, buyer: nreq.headers[BUYER_IP_HEADER] as string });
      const chunks: Buffer[] = [];
      for await (const c of nreq) chunks.push(c as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(nreq.headers)) if (typeof v === 'string') headers.set(k, v);
      const res = await POST(new Request(`http://127.0.0.1${nreq.url}`, { method: 'POST', headers, body: Buffer.concat(chunks) }), ctx(s.shop.slug));
      nres.writeHead(res.status, Object.fromEntries(res.headers));
      nres.end(Buffer.from(await res.arrayBuffer()));
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const { port } = srv.address() as AddressInfo;
    const door = await connectAgentDoor(new URL(`http://127.0.0.1:${port}/s/${s.shop.slug}/mcp`), undefined, '198.51.100.77');
    try {
      await door.listTools();
      await door.callTool({ name: 'get_shop_info', arguments: {} });
    } finally {
      await door.close();
      await new Promise((r) => srv.close(r));
    }
    expect(seen.length).toBeGreaterThanOrEqual(3);
    const expected = consoleHeaders('198.51.100.77');
    for (const h of seen) expect(h).toEqual({ console: expected[CONSOLE_HEADER], buyer: '198.51.100.77' });
  });
});
