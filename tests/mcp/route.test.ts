import { beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getDb } from '@/lib/db';
import * as orders from '@/lib/db/repos/orders';
import * as shops from '@/lib/db/repos/shops';
import { createFakePayPal } from '@/lib/paypal/fake';
import { setPayPalForServices } from '@/lib/services';
import { handleMcpRequest } from '@/lib/mcp/server';
import { agentDoorPage } from '@/lib/mcp/door-page';
import { getConfig } from '@/lib/config';
import { DELETE, GET, POST, runtime } from '@/app/s/[slug]/mcp/route';
import { seedShop, type SeededShop } from '../helpers/shop';
import { tempDbPath } from '../helpers/temp-db';

const PROTOCOL = '2025-06-18';
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

function rpc(slug: string, body: unknown, opts: { query?: string; headers?: Record<string, string> } = {}): Request {
  return new Request(`http://localhost:3000/s/${slug}/mcp${opts.query ?? ''}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL,
      ...opts.headers,
    },
    body: JSON.stringify(body),
  });
}

describe('agent door route POST /s/[slug]/mcp', () => {
  let s: SeededShop;
  const fake = createFakePayPal();

  beforeAll(() => {
    process.env.DATABASE_PATH = tempDbPath('route');
    setPayPalForServices(fake);
    s = seedShop(getDb(), { name: `Route Bakery ${Date.now()}` });
  });

  it('runs in the Node runtime', () => {
    expect(runtime).toBe('nodejs');
  });

  it('answers initialize and then tools/list as plain JSON, statelessly', async () => {
    const init = await POST(rpc(s.shop.slug, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'route-test', version: '1.0.0' } },
    }), ctx(s.shop.slug));
    expect(init.status).toBe(200);
    expect(init.headers.get('content-type')).toContain('application/json');
    expect(init.headers.get('mcp-session-id')).toBeNull();
    const initBody = await init.json();
    expect(initBody.result.serverInfo.name).toBeTruthy();
    expect(initBody.result.capabilities.tools).toBeDefined();
    expect(initBody.result.instructions).toContain(s.shop.name);

    const list = await POST(rpc(s.shop.slug, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }), ctx(s.shop.slug));
    expect(list.status).toBe(200);
    expect(list.headers.get('content-type')).toContain('application/json');
    const listBody = await list.json();
    expect(listBody.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(['create_order', 'get_order_status', 'get_shop_info', 'list_products']);
  });

  it('creates an order over HTTP and records the agent from ?agent= or the User-Agent', async () => {
    const args = { items: [{ item_id: s.item['Sourdough loaf'].id, quantity: 1 }], fulfillment: 'pickup' };
    const viaQuery = await POST(rpc(s.shop.slug, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'create_order', arguments: args } },
      { query: '?agent=claude-desktop', headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }), ctx(s.shop.slug));
    expect(viaQuery.status).toBe(200);
    const a = (await viaQuery.json()).result;
    expect(a.isError).toBeFalsy();
    expect(a.structuredContent.status).toBe('awaiting_approval');
    expect(orders.byId(getDb(), a.structuredContent.order_ref)!.agentName).toBe('claude-desktop');

    const viaUa = await POST(rpc(s.shop.slug, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_order', arguments: args } },
      { headers: { 'user-agent': 'ExampleAgent/2.1' } }), ctx(s.shop.slug));
    const b = (await viaUa.json()).result;
    // Never the raw User-Agent: an unknown client is "an AI assistant", known ones get their name.
    expect(orders.byId(getDb(), b.structuredContent.order_ref)!.agentName).toBe('an AI assistant');
  });

  it('works end to end with the MCP SDK client over real HTTP', async () => {
    const slug = s.shop.slug;
    const srv = http.createServer(async (nreq, nres) => {
      const chunks: Buffer[] = [];
      for await (const c of nreq) chunks.push(c as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(nreq.headers)) if (typeof v === 'string') headers.set(k, v);
      const req = new Request(`http://127.0.0.1${nreq.url}`, {
        method: nreq.method,
        headers,
        body: nreq.method === 'GET' || nreq.method === 'DELETE' ? undefined : Buffer.concat(chunks),
      });
      const res = nreq.method === 'POST' ? await POST(req, ctx(slug)) : nreq.method === 'GET' ? await GET() : await DELETE();
      nres.writeHead(res.status, Object.fromEntries(res.headers));
      nres.end(Buffer.from(await res.arrayBuffer()));
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const { port } = srv.address() as AddressInfo;
    const client = new Client({ name: 'http-agent', version: '1.0.0' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/s/${slug}/mcp?agent=http-agent`)));
      expect(client.getInstructions()).toContain(s.shop.name);
      expect((await client.listTools()).tools).toHaveLength(4);
      const info = (await client.callTool({ name: 'get_shop_info', arguments: {} })) as CallToolResult;
      expect(info.structuredContent).toMatchObject({ shop_name: s.shop.name, accepting_orders: true });
      const bad = (await client.callTool({
        name: 'create_order',
        arguments: { items: [{ item_id: s.item['Sourdough loaf'].id, quantity: 1 }], fulfillment: 'pickup', price: '0.01' },
      })) as CallToolResult;
      expect(bad.isError).toBe(true);
      expect(JSON.parse((bad.content[0] as { text: string }).text).error.code).toBe('INVALID_ARGUMENTS');
      const created = (await client.callTool({
        name: 'create_order',
        arguments: { items: [{ item_id: s.item['Sourdough loaf'].id, quantity: 1 }], fulfillment: 'pickup', client_request_id: 'http-1' },
      })) as CallToolResult;
      expect(created.isError).toBeFalsy();
      const ref = (created.structuredContent as { order_ref: string }).order_ref;
      expect(orders.byId(getDb(), ref)!.agentName).toBe('http-agent');
      fake.approve(orders.byId(getDb(), ref)!.paypalOrderId);
      const status = (await client.callTool({ name: 'get_order_status', arguments: { order_ref: ref } })) as CallToolResult;
      expect(status.structuredContent).toMatchObject({ status: 'paid' });
    } finally {
      await client.close();
      await new Promise((r) => srv.close(r));
    }
  });

  it('rejects GET and DELETE with 405', async () => {
    const get = await GET();
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    const del = await DELETE();
    expect(del.status).toBe(405);
    const viaHandler = await handleMcpRequest(new Request('http://localhost:3000/s/x/mcp', { method: 'GET' }), s.shop.slug, {
      db: getDb(), paypal: fake, appUrl: 'http://localhost:3000',
    });
    expect(viaHandler.status).toBe(405);
  });

  it('keeps the JSON 405 for a GET that does not ask for HTML (MCP clients)', async () => {
    const res = await GET(new Request(`http://localhost:3000/s/${s.shop.slug}/mcp`, {
      method: 'GET', headers: { accept: 'application/json, text/event-stream' },
    }), ctx(s.shop.slug));
    expect(res.status).toBe(405);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect((await res.json()).error.message).toContain('POST only');
  });

  it('shows a browser a page explaining the link, with the shop link and the door URL', async () => {
    const res = await GET(new Request(`http://localhost:3000/s/${s.shop.slug}/mcp`, {
      method: 'GET', headers: { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
    }), ctx(s.shop.slug));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const html = await res.text();
    const appUrl = getConfig().appUrl;
    expect(html).toContain('This link is for AI assistants');
    expect(html).toContain(s.shop.name);
    expect(html).toContain(`href="${appUrl}/s/${s.shop.slug}"`);
    expect(html).toContain(`${appUrl}/s/${s.shop.slug}/mcp`);
    expect(html).toContain(`claude mcp add --transport http ${s.shop.slug} ${appUrl}/s/${s.shop.slug}/mcp`);
    expect(html).not.toMatch(/<script[^>]+src=/);
  });

  it('a browser GET for an unknown shop is still a 404', async () => {
    const res = await GET(new Request('http://localhost:3000/s/no-such-shop/mcp', { headers: { accept: 'text/html' } }), ctx('no-such-shop'));
    expect(res.status).toBe(404);
  });

  it('escapes the shop name in the browser page', () => {
    const html = agentDoorPage({ shopName: `<script>alert("x")</script> & Sons`, slug: 'x', appUrl: 'https://shelfie.example' });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Sons');
    expect(html).toContain('https://shelfie.example/s/x/mcp');
  });

  it('returns 404 for an unknown or draft shop', async () => {
    const res = await POST(rpc('no-such-shop', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }), ctx('no-such-shop'));
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toMatch(/no shop/i);
    const { shop: draft } = shops.create(getDb(), { name: `Draft ${Date.now()}` });
    const d = await POST(rpc(draft.slug, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }), ctx(draft.slug));
    expect(d.status).toBe(404);
  });

  it('still serves a paused shop (tools explain it is not taking orders)', async () => {
    const paused = seedShop(getDb(), { name: `Paused ${Date.now()}`, status: 'paused' });
    const res = await POST(rpc(paused.shop.slug, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_shop_info', arguments: {} } }), ctx(paused.shop.slug));
    expect(res.status).toBe(200);
    expect((await res.json()).result.structuredContent.accepting_orders).toBe(false);
  });
});
