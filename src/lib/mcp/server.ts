// The agent door: one fresh McpServer per request over a stateless Streamable HTTP transport (spec §10).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { doorRateIdentity } from '@/lib/agent/console-key';
import * as shopsRepo from '@/lib/db/repos/shops';
import { clientIp } from '@/lib/http/client-ip';
import type { OrderDeps } from '@/lib/orders/service';
import { agentFromUserAgent, agentLabel } from './agent-name';
import { buildInstructions, sanitizeShopName } from './instructions';
import { registerShopTools, type ShopServerDeps } from './tools';

export type { ShopServerDeps } from './tools';

export const MAX_MCP_BODY_BYTES = 64 * 1024;

export function createShopServer(shopId: string, deps: ShopServerDeps): McpServer {
  const shop = shopsRepo.byId(deps.db, shopId);
  if (!shop) throw new Error(`createShopServer: unknown shop ${shopId}`);
  const server = new McpServer(
    { name: 'shelfie-agent-door', title: `${sanitizeShopName(shop.name)} on Shelfie`, version: '1.0.0' },
    { instructions: buildInstructions(shop.name) },
  );
  registerShopTools(server, shop.id, deps);
  return server;
}

/** POST only. Unknown and draft shops are 404; paused shops are served (their tools say they aren't taking orders). */
export async function handleMcpRequest(req: Request, slug: string, deps: OrderDeps): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const shop = shopsRepo.bySlug(deps.db, slug);
  if (!shop || shop.status === 'draft') return jsonRpcError(404, -32001, 'No shop at this address.');

  const url = new URL(req.url);
  const server = createShopServer(shop.id, {
    ...deps,
    // The buyer console (proven by its secret) is keyed by its buyer's IP, everyone else by the request IP.
    clientIp: doorRateIdentity(req, clientIp(req)),
    agentName: agentLabel(url.searchParams.get('agent')) ?? agentFromUserAgent(req.headers.get('user-agent')),
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_MCP_BODY_BYTES,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } finally {
    // JSON mode: the response is fully built before handleRequest resolves, so closing here is safe.
    await server.close().catch(() => {});
  }
}

export function methodNotAllowed(): Response {
  return jsonRpcError(405, -32000, 'Method not allowed. The agent door accepts POST only (stateless Streamable HTTP).', { allow: 'POST' });
}

export function jsonRpcError(status: number, code: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
