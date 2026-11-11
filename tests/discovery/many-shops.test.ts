// Discovery with several sellers' shops: /agents.txt, /llms.txt, /browse's JSON-LD and each shop's own JSON-LD list every
// shop that takes orders, and every listed door answers for its own shop.
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { listBrowseShops } from '@/lib/db/repos/browse';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shops from '@/lib/db/repos/shops';
import { getConfig } from '@/lib/config';
import { browseJsonLd, shopJsonLd } from '@/lib/discovery/jsonld';
import { LISTED_STATUSES } from '@/lib/domain/listed';
import { createFakePayPal } from '@/lib/paypal/fake';
import { setPayPalForServices } from '@/lib/services';
import { POST } from '@/app/s/[slug]/mcp/route';
import { GET as agentsTxt } from '@/app/agents.txt/route';
import { GET as llmsTxt } from '@/app/llms.txt/route';
import { seedShop, type SeededShop } from '../helpers/shop';
import { tempDbPath } from '../helpers/temp-db';

const PROTOCOL = '2025-06-18';
const call = (slug: string, id: number, method: string, params: unknown) =>
  POST(
    new Request(`http://localhost:3000/s/${slug}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': PROTOCOL },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    }),
    { params: Promise.resolve({ slug }) },
  ).then((r) => r.json());

describe('discovery across many shops', () => {
  let open: SeededShop[];
  let closed: SeededShop[];
  const app = () => getConfig().appUrl;

  beforeAll(() => {
    process.env.DATABASE_PATH = tempDbPath('many-shops');
    setPayPalForServices(createFakePayPal());
    const db = getDb();
    open = [
      seedShop(db), // Marigold, paid to the platform
      seedShop(db, { name: 'Tía Lupe Tacos', fulfillment: 'pickup' }),
      seedShop(db, { name: 'Ravi Bike Repair' }),
      seedShop(db, { name: 'Juniper Juice' }),
      seedShop(db, { name: 'Petal and Stem', fulfillment: 'shipping' }),
    ];
    closed = [seedShop(db, { name: 'Paused Pies', status: 'paused' }), seedShop(db, { name: 'Unpaid Co', payeeEmail: null })];
  });

  it('/agents.txt and /llms.txt list every open shop’s door and no closed one', async () => {
    for (const route of [agentsTxt, llmsTxt]) {
      const body = await (await route()).text();
      for (const s of open) expect(body).toContain(`${app()}/s/${s.shop.slug}/mcp`);
      for (const s of closed) expect(body).not.toContain(`/s/${s.shop.slug}`);
    }
  });

  it('/browse lists the same shops, and its JSON-LD names each one’s door', () => {
    const listed = listBrowseShops(getDb());
    expect(listed.map((s) => s.slug).sort()).toEqual(open.map((s) => s.shop.slug).sort());
    const ld = browseJsonLd(listed, app()) as { numberOfItems: number; itemListElement: { item: { url: string; potentialAction: { target: { urlTemplate: string } } } }[] };
    expect(ld.numberOfItems).toBe(open.length);
    for (const s of open) {
      const entry = ld.itemListElement.find((e) => e.item.url === `${app()}/s/${s.shop.slug}`);
      expect(entry?.item.potentialAction.target.urlTemplate).toBe(`${app()}/s/${s.shop.slug}/mcp`);
    }
  });

  it('each shop page’s JSON-LD advertises its own door', () => {
    for (const s of open) {
      const shop = shops.bySlug(getDb(), s.shop.slug)!;
      const items = itemsRepo.listWithVariants(getDb(), shop.id, { status: [...LISTED_STATUSES] });
      const shopUrl = `${app()}/s/${shop.slug}`;
      const ld = shopJsonLd(shop, items, { shopUrl, doorUrl: `${shopUrl}/mcp` }) as { potentialAction?: { target: { urlTemplate: string } } };
      expect(ld.potentialAction?.target.urlTemplate).toBe(`${shopUrl}/mcp`);
    }
  });

  it('every listed door answers for its own shop: initialize, get_shop_info and list_products', async () => {
    let id = 1;
    for (const s of open) {
      const init = await call(s.shop.slug, id++, 'initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'many-shops', version: '1' } });
      expect(init.result.instructions).toContain(s.shop.name);
      const info = (await call(s.shop.slug, id++, 'tools/call', { name: 'get_shop_info', arguments: {} })).result;
      expect(info.isError).toBeFalsy();
      expect(info.structuredContent).toMatchObject({ shop_name: s.shop.name, accepting_orders: true });
      const products = (await call(s.shop.slug, id++, 'tools/call', { name: 'list_products', arguments: {} })).result;
      const names = (products.structuredContent.sections as { items: { name: string }[] }[]).flatMap((sec) => sec.items.map((i) => i.name));
      expect(names).toContain('Almond croissant');
    }
  });
});
