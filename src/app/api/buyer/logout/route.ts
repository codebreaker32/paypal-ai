// POST /api/buyer/logout → 204: this browser's buyer session ("Log in with PayPal") is deleted and its cookie cleared.
// 404 unless PAYPAL_LOGIN_ENABLED=1.
import { noStoreEmpty } from '@/lib/auth/http';
import { paypalLoginEnabled } from '@/lib/buyer/paypal-login';
import { endBuyerSession } from '@/lib/buyer/session';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  if (!paypalLoginEnabled()) return new Response('Not found', { status: 404 });
  await endBuyerSession();
  return noStoreEmpty();
}
