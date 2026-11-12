// GET /api/auth/google/start[?next=/shops/...] → 302 to Google's consent screen, with a 10-minute httpOnly cookie holding
// `state`, the PKCE verifier and the safe `next`. 404 when GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is unset.
import { cookies } from 'next/headers';
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_SECONDS,
  authorizationUrl,
  encodeFlow,
  googleConfig,
  googleRedirectUri,
  newFlow,
} from '@/lib/auth/google';
import { safeNext } from '@/lib/auth/next-path';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const config = googleConfig();
  if (!config) return new Response('Not found', { status: 404 });
  const { appUrl } = getConfig();
  const next = safeNext(new URL(req.url).searchParams.get('next'));
  const { state, verifier, challenge } = newFlow();
  (await cookies()).set(GOOGLE_FLOW_COOKIE, encodeFlow({ state, verifier, next }), {
    httpOnly: true,
    sameSite: 'lax', // Google's redirect back is a top-level GET from another site
    secure: appUrl.startsWith('https:'),
    path: GOOGLE_CALLBACK_PATH,
    maxAge: GOOGLE_FLOW_SECONDS,
  });
  const location = authorizationUrl({ clientId: config.clientId, redirectUri: googleRedirectUri(appUrl), state, challenge });
  return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } });
}
