/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Seller-side PayPal Agent Toolkit wrapper. Allowlist: orders.get, shipment.create, shipment.get.
// Quirks of @paypal/agent-toolkit 1.11.0 handled here: results are JSON strings (errors come back as
// {"error":{...}} strings, not throws), and the OAuth token is cached without expiry (instance rebuilt every 30 min).
import { PayPalAgentToolkit } from '@paypal/agent-toolkit/ai-sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';
import { getConfig } from '@/lib/config';

export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeError';
  }
}

export class ToolkitError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ToolkitError';
  }
}

export interface ShopScope {
  orderIds: Set<string>;
  productIds: Set<string>;
}

export interface ToolkitTool {
  description?: string;
  parameters: ZodTypeAny;
  execute: (args: any) => Promise<unknown>;
}
export interface ToolkitLike {
  getTools(): Record<string, ToolkitTool>;
}

export type ClaudeToolName = 'get_order' | 'get_shipment_tracking';

const TTL_MS = 30 * 60_000;

/**
 * Wraps a tool function so every argument that names an order/product must belong to the shop in context.
 * `idArgs` maps argument name to the kind of id it holds. A missing id is rejected too (it could mean "list all").
 */
export function scopeTool<A extends Record<string, any>, R>(
  scope: ShopScope,
  idArgs: Record<string, 'order' | 'product'>,
  run: (args: A) => Promise<R>,
): (args: A) => Promise<R> {
  return async (args) => {
    for (const [key, kind] of Object.entries(idArgs)) {
      const value = args?.[key];
      const allowed = kind === 'order' ? scope.orderIds : scope.productIds;
      if (typeof value !== 'string' || !allowed.has(value)) {
        throw new ScopeError(`${key} is not an ${kind} of this shop`);
      }
    }
    return run(args);
  };
}

/** Parse the toolkit's JSON-string result; map {error:{message}} to ToolkitError. */
function parseResult(raw: unknown): any {
  if (typeof raw !== 'string') return raw;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolkitError(raw.slice(0, 300) || 'Empty response from the PayPal toolkit');
  }
  if (parsed && typeof parsed === 'object' && parsed.error) {
    const e = parsed.error;
    throw new ToolkitError(typeof e === 'string' ? e : (e.message ?? 'PayPal toolkit error'), e);
  }
  return parsed;
}

function defaultFactory(): ToolkitLike {
  const cfg = getConfig();
  return new PayPalAgentToolkit({
    clientId: cfg.paypalClientId,
    clientSecret: cfg.paypalSecret,
    configuration: {
      context: { sandbox: true },
      actions: { orders: { get: true }, shipment: { create: true, get: true } },
    },
  }) as unknown as ToolkitLike;
}

export function createSellerToolkit(
  scope: ShopScope,
  opts: { factory?: () => ToolkitLike; now?: () => number } = {},
) {
  const factory = opts.factory ?? defaultFactory;
  const now = opts.now ?? Date.now;
  let instance: { tk: ToolkitLike; builtAt: number } | null = null;

  const tool = (name: string): ToolkitTool => {
    if (!instance || now() - instance.builtAt >= TTL_MS) instance = { tk: factory(), builtAt: now() };
    const t = instance.tk.getTools()[name];
    if (!t) throw new ToolkitError(`PayPal toolkit tool ${name} is not available`);
    return t;
  };
  const call = async (name: string, args: Record<string, unknown>) => parseResult(await tool(name).execute(args));

  const getOrder = scopeTool(scope, { id: 'order' }, ({ id }: { id: string }) => call('get_order', { id }));
  const getShipmentTracking = scopeTool(scope, { order_id: 'order' }, ({ order_id }: { order_id: string }) =>
    call('get_shipment_tracking', { order_id }),
  );
  const createTracking = scopeTool(
    scope,
    { order_id: 'order' },
    (a: { order_id: string; transaction_id: string; tracking_number: string; carrier: string }) =>
      call('create_shipment_tracking', { ...a, status: 'SHIPPED' }),
  );

  const claudeRuns: Record<ClaudeToolName, (args: any) => Promise<unknown>> = {
    get_order: getOrder,
    get_shipment_tracking: getShipmentTracking,
  };

  return {
    getOrder: (id: string) => getOrder({ id }),
    getShipmentTracking: (orderId: string) => getShipmentTracking({ order_id: orderId }),
    createShipmentTracking: (a: { orderId: string; captureId: string; trackingNumber: string; carrier: string }) =>
      createTracking({ order_id: a.orderId, transaction_id: a.captureId, tracking_number: a.trackingNumber, carrier: a.carrier }),
    /** Read tools as Claude tools; every call goes through the shop scope check. */
    asClaudeTools(names: ClaudeToolName[]) {
      return names.map((name) => {
        const t = tool(name);
        const { $schema: _omit, ...inputSchema } = zodToJsonSchema(t.parameters) as Record<string, unknown>;
        return betaTool({
          name,
          description: t.description ?? name,
          inputSchema: inputSchema as any,
          run: async (args: any) => JSON.stringify(await claudeRuns[name](args)),
        });
      });
    },
  };
}
