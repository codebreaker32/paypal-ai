// The shop's agent door: POST /s/[slug]/mcp (stateless MCP over Streamable HTTP, JSON responses).
import { handleMcpRequest, jsonRpcError, methodNotAllowed } from '@/lib/mcp/server';
import type { OrderDeps } from '@/lib/orders/service';
import { getOrderDeps } from '@/lib/services';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  let deps: OrderDeps;
  try {
    deps = getOrderDeps();
  } catch (e) {
    console.error(`[shelfie] agent door unavailable: ${e instanceof Error ? e.message : String(e)}`);
    return jsonRpcError(503, -32000, 'The agent door is not available right now. Try again later.');
  }
  return handleMcpRequest(req, slug, deps);
}

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function DELETE(): Promise<Response> {
  return methodNotAllowed();
}
