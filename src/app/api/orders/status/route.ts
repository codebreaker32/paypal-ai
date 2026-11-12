// GET /api/orders/status?refs=ord_a,ord_b: live status words for the "Your orders" list on this device.
// Returns only { ref, status, statusLabel } per known ref. Public by capability (each ref is the receipt's secret).
import { getDb } from '@/lib/db';
import { clientIp } from '@/lib/http/client-ip';
import { ORDER_STATUS_RATE, orderStatuses, parseStatusRefs } from '@/lib/orders/status-list';
import { allow } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(req: Request): Promise<Response> {
  if (!allow(`order-status:${clientIp(req)}`, ORDER_STATUS_RATE.limit, ORDER_STATUS_RATE.windowMs)) {
    return Response.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' } },
      { status: 429, headers: { ...NO_STORE, 'retry-after': '60' } },
    );
  }
  const refs = parseStatusRefs(new URL(req.url).searchParams.get('refs'));
  if (!refs) {
    return Response.json(
      { error: { code: 'BAD_REFS', message: 'Pass up to 50 order refs as ?refs=ord_a,ord_b.' } },
      { status: 400, headers: NO_STORE },
    );
  }
  return Response.json({ orders: orderStatuses(getDb(), refs) }, { headers: NO_STORE });
}
