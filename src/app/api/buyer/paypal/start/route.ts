// GET /api/buyer/paypal/start → 302 to PayPal's sandbox "Log in with PayPal" consent, with a 10-minute httpOnly cookie
// holding `state`. 404 unless PAYPAL_LOGIN_ENABLED=1.
import { cookies } from 'next/headers';
import {
  PAYPAL_LOGIN_CALLBACK_PATH,
  PAYPAL_LOGIN_STATE_COOKIE,
  PAYPAL_LOGIN_STATE_SECONDS,
  newState,
  paypalAuthorizationUrl,
  paypalLoginEnabled,
  paypalLoginRedirectUri,
} from '@/lib/buyer/paypal-login';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  if (!paypalLoginEnabled()) return new Response('Not found', { status: 404 });
  const config = getConfig();
  const state = newState();
  (await cookies()).set(PAYPAL_LOGIN_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax', // PayPal's redirect back is a top-level GET from another site
    secure: config.appUrl.startsWith('https:'),
    path: PAYPAL_LOGIN_CALLBACK_PATH,
    maxAge: PAYPAL_LOGIN_STATE_SECONDS,
  });
  const location = paypalAuthorizationUrl({
    clientId: config.paypalClientId,
    redirectUri: paypalLoginRedirectUri(config.appUrl),
    state,
  });
  return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } });
}
