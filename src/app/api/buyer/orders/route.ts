// GET /api/buyer/orders → { orders: [{ ref, shopName, total, createdAt, status, statusLabel }] }: the orders paid with
// the PayPal account behind this browser's buyer session, newest first, at most 100. 401 without a session; 404 unless
// PAYPAL_LOGIN_ENABLED=1.
import { paypalLoginEnabled } from '@/lib/buyer/paypal-login';
import { currentBuyerEmails, listBuyerOrders } from '@/lib/buyer/session';
import { getDb } from '@/lib/db';
import { jsonError } from '@/lib/http/json-error';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  if (!paypalLoginEnabled()) return new Response('Not found', { status: 404 });
  const emails = await currentBuyerEmails();
  if (!emails) return jsonError(401, 'LOGIN_REQUIRED', 'Log in with PayPal to see your orders.');
  return Response.json({ orders: listBuyerOrders(getDb(), emails) }, { headers: { 'cache-control': 'no-store' } });
}
