// GET /api/orders/[ref]: the receipt's view of an order. Public by capability (the ref is unguessable), SQLite only.
import { receiptView } from '@/app/o/[ref]/receipt-view';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }): Promise<Response> {
  const { ref } = await ctx.params;
  const order = receiptView(getDb(), ref);
  if (!order) {
    return Response.json(
      { error: { code: 'ORDER_NOT_FOUND', message: "We couldn't find that order." } },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  }
  return Response.json({ order }, { headers: { 'cache-control': 'no-store' } });
}
