// Seller-side PayPal Agent Toolkit wrapper. Allowlist: orders.get, shipment.create, shipment.get.
// Quirks of @paypal/agent-toolkit 1.11.0 handled here: results are JSON strings (errors come back as
// {"error":{...}} strings, not throws), and the OAuth token is cached without expiry (instance rebuilt every 30 min).
import { PayPalAgentToolkit } from '@paypal/agent-toolkit/ai-sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';
import { getConfig } from '@/lib/config';
import type { PayPalOrder } from './types';

export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeError';
  }
}

export class ToolkitError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
    public readonly status?: number,
    public readonly code?: string,
  ) {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResult(raw: unknown): any {
  if (typeof raw !== 'string') return raw;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolkitError(raw.slice(0, 300) || 'Empty response from the PayPal toolkit');
  }
  // 1.11.0 reports PayPal HTTP failures as LlmError JSON: {ok:false,status,code,message}
  if (parsed && typeof parsed === 'object' && parsed.ok === false) {
    throw new ToolkitError(parsed.message ?? 'PayPal toolkit error', parsed, parsed.status, parsed.code);
  }
  if (parsed && typeof parsed === 'object' && parsed.error) {
    const e = parsed.error;
    throw new ToolkitError(typeof e === 'string' ? e : (e.message ?? 'PayPal toolkit error'), e);
  }
  return parsed;
}

// One toolkit instance for the whole process (its OAuth token never expires inside the library), rebuilt every 30 min.
let sharedInstance: { tk: ToolkitLike; builtAt: number } | null = null;

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
  // Injected factories (tests) get a private instance; the default factory shares the module-level one.
  let localInstance: { tk: ToolkitLike; builtAt: number } | null = null;

  const tool = (name: string): ToolkitTool => {
    let instance = opts.factory ? localInstance : sharedInstance;
    if (!instance || now() - instance.builtAt >= TTL_MS) instance = { tk: factory(), builtAt: now() };
    if (opts.factory) localInstance = instance;
    else sharedInstance = instance;
    const t = instance.tk.getTools()[name];
    if (!t) throw new ToolkitError(`PayPal toolkit tool ${name} is not available`);
    return t;
  };
  const call = async (name: string, args: Record<string, unknown>) => parseResult(await tool(name).execute(args));

  const getOrder = scopeTool(scope, { id: 'order' }, ({ id }: { id: string }): Promise<PayPalOrder> => call('get_order', { id }));
  const getShipmentTracking = scopeTool(scope, { order_id: 'order' }, ({ order_id }: { order_id: string }) =>
    call('get_shipment_tracking', { order_id }),
  );
  const createTracking = scopeTool(
    scope,
    { order_id: 'order' },
    (a: { order_id: string; transaction_id: string; tracking_number: string; carrier: string }) =>
      call('create_shipment_tracking', { ...a, status: 'SHIPPED' }),
  );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claudeRuns: Record<ClaudeToolName, (args: any) => Promise<unknown>> = {
    get_order: getOrder,
    get_shipment_tracking: getShipmentTracking,
  };

  return {
    getOrder: (id: string) => getOrder({ id }),
    getShipmentTracking: (orderId: string) => getShipmentTracking({ order_id: orderId }),
    /**
     * The toolkit posts only transaction_id (the capture id) and ignores order_id, so the capture id is derived
     * here from the scoped order itself; callers cannot name a capture belonging to another shop.
     */
    async createShipmentTracking(a: { orderId: string; trackingNumber: string; carrier: string }) {
      const order = await getOrder({ id: a.orderId });
      const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      if (!captureId) throw new ToolkitError(`Order ${a.orderId} has no payment capture yet, so tracking cannot be added`);
      return createTracking({ order_id: a.orderId, transaction_id: captureId, tracking_number: a.trackingNumber, carrier: a.carrier });
    },
    /** Read tools as Claude tools; every call goes through the shop scope check. */
    asClaudeTools(names: ClaudeToolName[]) {
      return names.map((name) => {
        const t = tool(name);
        const inputSchema =
          name === 'get_shipment_tracking'
            ? {
                type: 'object',
                properties: { order_id: { type: 'string', description: 'The PayPal order id to read tracking for' } },
                required: ['order_id'],
                additionalProperties: false,
              }
            : (() => {
                const { $schema, ...rest } = zodToJsonSchema(t.parameters) as Record<string, unknown>;
                void $schema;
                return rest;
              })();
        return betaTool({
          name,
          description: t.description ?? name,
          inputSchema: inputSchema as Parameters<typeof betaTool>[0]['inputSchema'],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          run: async (args: any) => JSON.stringify(await claudeRuns[name](args)),
        });
      });
    },
  };
}
