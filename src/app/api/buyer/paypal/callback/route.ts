// GET /api/buyer/paypal/callback?code&state → 302 /orders with a buyer session holding the PayPal account's emails.
// Denied, state mismatch or a failed exchange → 302 /orders?paypal=error; no usable email → /orders?paypal=noemail.
// 404 unless PAYPAL_LOGIN_ENABLED=1.
import { cookies } from 'next/headers';
import {
  PAYPAL_LOGIN_CALLBACK_PATH,
  PAYPAL_LOGIN_STATE_COOKIE,
  exchangeCodeForEmails,
  paypalLoginEnabled,
  sameState,
} from '@/lib/buyer/paypal-login';
import { startBuyerSession } from '@/lib/buyer/session';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

const redirectTo = (location: string): Response =>
  new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } });

export async function GET(req: Request): Promise<Response> {
  if (!paypalLoginEnabled()) return new Response('Not found', { status: 404 });
  const config = getConfig();
  const { appUrl } = config;
  const fail = (code: 'error' | 'noemail') => redirectTo(`${appUrl}/orders?paypal=${code}`);

  const jar = await cookies();
  const expected = jar.get(PAYPAL_LOGIN_STATE_COOKIE)?.value;
  // One use only, whatever happens next.
  jar.set(PAYPAL_LOGIN_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: appUrl.startsWith('https:'),
    path: PAYPAL_LOGIN_CALLBACK_PATH,
    maxAge: 0,
  });

  const params = new URL(req.url).searchParams;
  if (params.get('error')) return fail('error');
  if (!sameState(params.get('state'), expected)) return fail('error');
  const code = params.get('code');
  if (!code) return fail('error');

  try {
    const emails = await exchangeCodeForEmails({ code, clientId: config.paypalClientId, clientSecret: config.paypalSecret });
    if (emails.length === 0) return fail('noemail');
    await startBuyerSession(emails);
    return redirectTo(`${appUrl}/orders`);
  } catch {
    return fail('error');
  }
}
