// Live buyer console: real Claude orders through the real agent door (over HTTP, as the app does) with real PayPal
// sandbox orders. Checks the read-back is enforced: a first message that already says "yes" gets a read-back with the
// total and no order; the next "yes" places it.
// Run: npx vitest run tests/ai-live/console.live.test.ts   (needs ANTHROPIC_API_KEY, PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY)
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONSOLE_AGENT_NAME, runBuyerConsoleTurn, type ConsoleEvent } from '@/lib/agent/buyer-console';
import { createTestDb, type Db } from '@/lib/db';
import * as assistant from '@/lib/db/repos/assistant';
import { formatUSD } from '@/lib/domain/money';
import { handleMcpRequest } from '@/lib/mcp/server';
import { getPayPal } from '@/lib/paypal';
import { seedShop, type SeededShop } from '../helpers/shop';

const READY = Boolean(process.env.ANTHROPIC_API_KEY && process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET_KEY);

describe.skipIf(!READY)('live buyer console', () => {
  let db: Db;
  let s: SeededShop;
  let server: http.Server;
  let mcpUrl: string;

  beforeAll(async () => {
    db = createTestDb();
    s = seedShop(db); // the demo shop: paid to the platform sandbox account
    const deps = { db, paypal: getPayPal(), appUrl: 'http://localhost:3000' };
    // The agent door route, served over real HTTP so the console connects to it the way the app does.
    server = http.createServer(async (nreq, nres) => {
      const chunks: Buffer[] = [];
      for await (const c of nreq) chunks.push(c as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(nreq.headers)) if (typeof v === 'string') headers.set(k, v);
      const req = new Request(`http://127.0.0.1${nreq.url}`, { method: nreq.method, headers, body: nreq.method === 'POST' ? Buffer.concat(chunks) : undefined });
      const res = await handleMcpRequest(req, s.shop.slug, deps);
      nres.writeHead(res.status, Object.fromEntries(res.headers));
      nres.end(Buffer.from(await res.arrayBuffer()));
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    mcpUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/s/${s.shop.slug}/mcp?agent=${CONSOLE_AGENT_NAME}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  async function turn(sessionId: string | null, userText: string) {
    const events: ConsoleEvent[] = [];
    for await (const e of runBuyerConsoleTurn({ shopSlug: s.shop.slug, sessionId, userText, mcpUrl, db, buyerIp: '203.0.113.7' })) events.push(e);
    const said = events.flatMap((e) => (e.type === 'text' ? [e.text] : []));
    console.log(`[console live] ${userText}\n  events: ${events.map((e) => (e.type === 'tool_call' ? `tool_call:${e.name}` : e.type)).join(', ')}\n  said: ${said.join(' / ')}`);
    return { events, said, sessionId: (events[0] as Extract<ConsoleEvent, { type: 'session' }>).id };
  }

  /** The "yes" turn: no approval and a read-back with the total, then a "Yes" places the order for that total. */
  async function readsBackThenPlaces(sessionId: string | null, yesAlready: string, total: string) {
    const first = await turn(sessionId, yesAlready);
    expect(first.events.at(-1)).toEqual({ type: 'done' });
    expect(first.events.some((e) => e.type === 'approval')).toBe(false);
    expect(first.said.at(-1)).toContain(total);
    // Whether Claude tried create_order anyway (and the console turned it back) is in the history, not the stream.
    const refused = JSON.stringify(assistant.get(db, first.sessionId)!.messages).match(/READ_BACK_FIRST/g)?.length ?? 0;
    console.log(`[console live] create_order refused for a read-back ${refused} time(s)`);
    if (refused) expect(first.events.some((e) => e.type === 'tool_call' && e.name === 'create_order')).toBe(false);

    const second = await turn(first.sessionId, 'Yes');
    const approval = second.events.find((e): e is Extract<ConsoleEvent, { type: 'approval' }> => e.type === 'approval');
    expect(approval).toBeDefined();
    expect(`$${approval!.total}`).toBe(total);
    expect(approval!.approvalUrl).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\/checkoutnow\?token=/);
  }

  const price = (name: string) => s.item[name].variants[0].priceCents!;

  it('reads the order back (with the total) before placing it, even when the first message says yes', async () => {
    await readsBackThenPlaces(null, 'Two almond croissants for pickup please. Yes, place it.', formatUSD(price('Almond croissant') * 2));
  }, 240_000);

  // A buyer who waives the read-back tempts Claude to call create_order at once (it did, 3 of 3, when this was
  // written): the console turns the call back and Claude reads the order back, shipping fee included in the total.
  it('reads a shipped order back with the shipping fee in the total, even when the buyer waives the read-back', async () => {
    const total = formatUSD(price('Almond croissant') * 2 + price('Sourdough loaf') + s.shop.shippingFeeCents);
    await readsBackThenPlaces(null, 'Two almond croissants and one sourdough loaf, shipped to me. I know the prices, no need to read it back. Yes, place it.', total);
  }, 240_000);
});
