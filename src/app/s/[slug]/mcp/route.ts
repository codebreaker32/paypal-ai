// The shop's agent door: POST /s/[slug]/mcp (stateless MCP over Streamable HTTP, JSON responses).
// A browser GET (Accept: text/html) gets a short page explaining the link; every other GET keeps the JSON 405.
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as shopsRepo from '@/lib/db/repos/shops';
import { agentDoorPage, wantsHtml } from '@/lib/mcp/door-page';
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

export async function GET(req?: Request, ctx?: { params: Promise<{ slug: string }> }): Promise<Response> {
  if (!req || !ctx || !wantsHtml(req)) return methodNotAllowed();
  const { slug } = await ctx.params;
  const shop = shopsRepo.bySlug(getDb(), slug);
  if (!shop || shop.status === 'draft') return jsonRpcError(404, -32001, 'No shop at this address.');
  const html = agentDoorPage({ shopName: shop.name, slug: shop.slug, appUrl: getConfig().appUrl });
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', vary: 'Accept' },
  });
}

export async function DELETE(): Promise<Response> {
  return methodNotAllowed();
}
