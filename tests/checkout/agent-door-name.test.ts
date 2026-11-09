// SR29: nobody reaches the storefront's name, its label or its shorter window through the agent door.
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getDb } from '@/lib/db';
import * as orders from '@/lib/db/repos/orders';
import { STOREFRONT_AGENT_NAME } from '@/lib/domain/storefront';
import { buildUserMessage } from '@/lib/ai/brief';
import { createShopServer } from '@/lib/mcp/server';
import { createFakePayPal } from '@/lib/paypal/fake';
import { resetRateLimits } from '@/lib/rate-limit';
import { setPayPalForServices } from '@/lib/services';
import { POST } from '@/app/s/[slug]/mcp/route';
import type { Order } from '@/lib/domain/types';
import { seedShop, type SeededShop } from '../helpers/shop';
import { tempDbPath } from '../helpers/temp-db';

const MIN = 60_000;
const PROTOCOL = '2025-06-18';
const fake = createFakePayPal();
let s: SeededShop;

beforeAll(() => {
  process.env.DATABASE_PATH = tempDbPath('door-name');
  setPayPalForServices(fake);
  s = seedShop(getDb(), { name: `Door Name Bakery ${Date.now()}` });
});

const args = () => ({ items: [{ item_id: s.item['Sourdough loaf'].id, quantity: 1 }], fulfillment: 'pickup' });

async function viaHttp(query: string, ip: string): Promise<Order> {
  resetRateLimits();
  const res = await POST(
    new Request(`http://localhost:3000/s/${s.shop.slug}/mcp${query}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': PROTOCOL,
        'x-forwarded-for': ip,
        'user-agent': 'node',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_order', arguments: args() } }),
    }),
    { params: Promise.resolve({ slug: s.shop.slug }) },
  );
  const body = (await res.json()) as { result: { structuredContent: { order_ref: string } } };
  return orders.byId(getDb(), body.result.structuredContent.order_ref)!;
}

describe('the reserved storefront name at the agent door (SR29)', () => {
  it.each([
    '?agent=shelfie-storefront',
    '?agent=Shelfie-Storefront',
    '?agent=%20shelfie-storefront%20',
    '?agent=shelfie%00-storefront',
    '?agent=shelfie_storefront',
  ])('%s is stored as no name, with the normal 60-minute window', async (query) => {
    const order = await viaHttp(query, `203.0.113.${Math.floor(Math.random() * 200) + 1}`);
    expect(order.agentName).toBeNull();
    expect(Date.parse(order.expiresAt) - Date.parse(order.createdAt)).toBeGreaterThan(59 * MIN);
  });

  it('a real ?agent= name still goes through', async () => {
    expect((await viaHttp('?agent=claude-desktop', '203.0.113.250')).agentName).toBe('claude-desktop');
  });

  it('refuses the name from the MCP client name too', async () => {
    resetRateLimits();
    const server = createShopServer(s.shop.id, { db: getDb(), paypal: fake, appUrl: 'http://localhost:3000', clientIp: '203.0.113.251' });
    const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: STOREFRONT_AGENT_NAME, version: '1.0.0' });
    await client.connect(clientSide);
    await client.listTools();
    const res = await client.callTool({ name: 'create_order', arguments: args() });
    await client.close();
    const ref = (res.structuredContent as { order_ref: string }).order_ref;
    expect(orders.byId(getDb(), ref)!.agentName).toBeNull();
  });
});

describe('the AI brief for a storefront order', () => {
  const order = (agentName: string) => ({ ...orders.listByShop(getDb(), s.shop.id)[0], agentName }) as Order;
  const orderedBy = (o: Order) => {
    const text = buildUserMessage(o, s.shop, []);
    return (JSON.parse(text.slice(text.indexOf('<order>') + 7, text.indexOf('</order>'))) as { ordered_by_assistant: string | null }).ordered_by_assistant;
  };

  it('credits no assistant', () => expect(orderedBy(order(STOREFRONT_AGENT_NAME))).toBeNull());
  it('still names a real one', () => expect(orderedBy(order('claude-desktop'))).toBe('claude-desktop'));
});
