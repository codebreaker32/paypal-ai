/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createSellerToolkit, ScopeError, ToolkitError, scopeTool, type ToolkitLike } from '@/lib/paypal/toolkit';

const OWN = 'ABCDEFGHIJ1234567';
const FOREIGN = 'ZZZZZZZZZZ9999999';

function fakeToolkit(results: Record<string, unknown> = {}) {
  const execute = {
    get_order: vi.fn(async (_a: any) => results.get_order ?? JSON.stringify({ id: OWN, status: 'COMPLETED' })),
    get_shipment_tracking: vi.fn(async (_a: any) => results.get_shipment_tracking ?? JSON.stringify({ trackers: [] })),
    create_shipment_tracking: vi.fn(async (_a: any) => results.create_shipment_tracking ?? JSON.stringify({ ok: true })),
  };
  const tk: ToolkitLike = {
    getTools: () => ({
      get_order: { description: 'Get an order', parameters: z.object({ id: z.string() }), execute: execute.get_order },
      get_shipment_tracking: {
        description: 'Get tracking',
        parameters: z.object({ order_id: z.string().optional(), transaction_id: z.string().optional() }),
        execute: execute.get_shipment_tracking,
      },
      create_shipment_tracking: {
        description: 'Create tracking',
        parameters: z.object({ order_id: z.string(), tracking_number: z.string(), transaction_id: z.string(), carrier: z.string().optional() }),
        execute: execute.create_shipment_tracking,
      },
    }),
  };
  return { tk, execute };
}

const scope = () => ({ orderIds: new Set([OWN]), productIds: new Set<string>() });

describe('scopeTool', () => {
  it('rejects a foreign order id without calling the tool', async () => {
    const run = vi.fn(async () => 'x');
    const wrapped = scopeTool(scope(), { id: 'order' }, run);
    await expect(wrapped({ id: FOREIGN })).rejects.toBeInstanceOf(ScopeError);
    expect(run).not.toHaveBeenCalled();
    await expect(wrapped({ id: OWN })).resolves.toBe('x');
  });

  it('rejects a missing id and a foreign product id', async () => {
    const wrapped = scopeTool(scope(), { id: 'order' }, async () => 'x');
    await expect(wrapped({})).rejects.toBeInstanceOf(ScopeError);
    const p = scopeTool(scope(), { product_id: 'product' }, async () => 'x');
    await expect(p({ product_id: 'PROD-1' })).rejects.toBeInstanceOf(ScopeError);
  });
});

describe('createSellerToolkit', () => {
  it('parses the toolkit JSON string result', async () => {
    const { tk, execute } = fakeToolkit();
    const t = createSellerToolkit(scope(), { factory: () => tk });
    expect(await t.getOrder(OWN)).toEqual({ id: OWN, status: 'COMPLETED' });
    expect(execute.get_order).toHaveBeenCalledWith({ id: OWN });
  });

  it('maps an {error} result to ToolkitError', async () => {
    const { tk } = fakeToolkit({ get_order: JSON.stringify({ error: { message: 'The specified resource does not exist.', name: 'RESOURCE_NOT_FOUND' } }) });
    const t = createSellerToolkit(scope(), { factory: () => tk });
    const err = await t.getOrder(OWN).catch((e) => e);
    expect(err).toBeInstanceOf(ToolkitError);
    expect(err.message).toContain('does not exist');
  });

  it('rejects foreign ids on every method', async () => {
    const { tk, execute } = fakeToolkit();
    const t = createSellerToolkit(scope(), { factory: () => tk });
    await expect(t.getOrder(FOREIGN)).rejects.toBeInstanceOf(ScopeError);
    await expect(t.getShipmentTracking(FOREIGN)).rejects.toBeInstanceOf(ScopeError);
    await expect(
      t.createShipmentTracking({ orderId: FOREIGN, captureId: 'CAPTURE12345678', trackingNumber: '940', carrier: 'USPS' }),
    ).rejects.toBeInstanceOf(ScopeError);
    for (const fn of Object.values(execute)) expect(fn).not.toHaveBeenCalled();
  });

  it('createShipmentTracking sends order, capture (transaction_id), number and carrier', async () => {
    const { tk, execute } = fakeToolkit();
    const t = createSellerToolkit(scope(), { factory: () => tk });
    await t.createShipmentTracking({ orderId: OWN, captureId: 'CAPTURE12345678', trackingNumber: '9400', carrier: 'USPS' });
    expect(execute.create_shipment_tracking).toHaveBeenCalledWith({
      order_id: OWN,
      transaction_id: 'CAPTURE12345678',
      tracking_number: '9400',
      carrier: 'USPS',
      status: 'SHIPPED',
    });
  });

  it('rebuilds the toolkit instance after 30 minutes', async () => {
    let now = 0;
    const factory = vi.fn(() => fakeToolkit().tk);
    const t = createSellerToolkit(scope(), { factory, now: () => now });
    await t.getOrder(OWN);
    await t.getOrder(OWN);
    expect(factory).toHaveBeenCalledTimes(1);
    now = 31 * 60_000;
    await t.getOrder(OWN);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('asClaudeTools exposes JSON-schema tools that run through the scope check', async () => {
    const { tk } = fakeToolkit();
    const t = createSellerToolkit(scope(), { factory: () => tk });
    const tools = t.asClaudeTools(['get_order', 'get_shipment_tracking']) as any[];
    expect(tools.map((x) => x.name)).toEqual(['get_order', 'get_shipment_tracking']);
    expect(tools[0].input_schema).toMatchObject({ type: 'object', properties: { id: { type: 'string' } } });
    expect(JSON.stringify(tools[0].input_schema)).not.toContain('$schema');
    expect(JSON.parse((await tools[0].run({ id: OWN })) as string)).toEqual({ id: OWN, status: 'COMPLETED' });
    await expect(tools[0].run({ id: FOREIGN })).rejects.toBeInstanceOf(ScopeError);
  });
});
