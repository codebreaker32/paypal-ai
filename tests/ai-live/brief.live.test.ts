// Live order brief: real Claude + the real PayPal Agent Toolkit on a real sandbox order.
// Run: npx vitest run tests/ai-live/brief.live.test.ts   (needs ANTHROPIC_API_KEY, PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY)
// The sandbox order is created with our REST client and is still waiting for buyer approval, which get_order reads fine.
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db';
import * as orders from '@/lib/db/repos/orders';
import { orderNumber, newId } from '@/lib/domain/ids';
import type { OrderLine } from '@/lib/domain/types';
import { writeOrderBrief } from '@/lib/ai/brief';
import { getPayPal } from '@/lib/paypal';
import { createSellerToolkit, type ClaudeToolName } from '@/lib/paypal/toolkit';
import { seedShop } from '../helpers/shop';

const READY = Boolean(process.env.ANTHROPIC_API_KEY && process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET_KEY);

describe.skipIf(!READY)('live order brief', () => {
  it('reads the sandbox order through the toolkit and submits a brief', async () => {
    const db = createTestDb();
    const s = seedShop(db, { name: 'Marigold Bakehouse' });
    const line = (name: string, qty: number): OrderLine => {
      const it = s.item[name];
      return { itemId: it.id, variantId: it.variants[0].id, name, label: null, unitCents: it.variants[0].priceCents!, qty, paypalProductId: it.paypalProductId };
    };
    const lines = [line('Almond croissant', 2), line('Sourdough loaf', 1)];
    const itemsCents = lines.reduce((t, l) => t + l.unitCents * l.qty, 0);
    const id = newId('ord');
    const number = orderNumber();

    const created = await getPayPal().createOrder(
      {
        shopName: s.shop.name,
        orderId: id,
        orderNumber: number,
        items: lines.map((l) => ({ name: l.name, unitCents: l.unitCents, qty: l.qty, sku: l.paypalProductId, kind: 'PHYSICAL' as const })),
        shippingCents: 800,
        fulfillment: 'shipping',
        returnUrl: `http://localhost:3000/api/paypal/return?o=${id}`,
        cancelUrl: `http://localhost:3000/api/paypal/cancel?o=${id}`,
      },
      `ord-live-brief-${id}`,
    );
    const order = orders.insert(
      db,
      {
        id, number, shopId: s.shop.id, fulfillment: 'shipping', buyerName: 'Dana', agentName: 'Claude', clientRequestId: null,
        buyerNote: 'My son has a nut allergy, please keep everything nut-free. Could it arrive by Friday?',
        itemsCents, shippingCents: 800, totalCents: itemsCents + 800, paypalOrderId: created.id, approvalUrl: created.approveUrl,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
      lines,
    );

    const calls: { tool: string; args: unknown; ms: number }[] = [];
    let requests = 0;
    const client = new Anthropic({
      fetch: async (url, init) => {
        requests++;
        return fetch(url, init);
      },
    });
    const toolkit = (scope: Parameters<typeof createSellerToolkit>[0]) => {
      const real = createSellerToolkit(scope);
      return {
        asClaudeTools: (names: ClaudeToolName[]) =>
          real.asClaudeTools(names).map((t) => ({
            ...t,
            run: async (args: never) => {
              const t0 = Date.now();
              try {
                return await t.run(args);
              } finally {
                calls.push({ tool: t.name, args, ms: Date.now() - t0 });
              }
            },
          })) as ReturnType<typeof real.asClaudeTools>,
      };
    };

    const t0 = Date.now();
    const result = await writeOrderBrief({ db, client, toolkit }, order.id);
    const ms = Date.now() - t0;

    console.log(`[live brief] PayPal order ${created.id} (${created.status}); ${requests} Claude requests; ${ms} ms total`);
    console.log(`[live brief] toolkit calls: ${JSON.stringify(calls)}`);
    console.log(`[live brief] source=${result?.source}\n${JSON.stringify(result?.brief, null, 2)}`);

    expect(result?.source).toBe('agent');
    expect(calls.some((c) => c.tool === 'get_order')).toBe(true);
    expect(orders.byId(db, order.id)?.briefSource).toBe('agent');
    expect(result!.brief.headline.length).toBeLessThanOrEqual(90);
  }, 180_000);
});
