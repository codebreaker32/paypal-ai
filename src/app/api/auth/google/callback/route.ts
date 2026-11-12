// GET /api/auth/google/callback?code&state → 302 to the seller's landing page (or the safe `next`), session set.
// Any failure (consent denied, state mismatch, token exchange, unverified email) → 302 /login?error=<code>.
// 404 when GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is unset.
import { cookies } from 'next/headers';
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_FLOW_COOKIE,
  GoogleAuthError,
  decodeFlow,
  exchangeCode,
  findOrCreateGoogleAccount,
  googleConfig,
  googleRedirectUri,
  sameState,
  type GoogleErrorCode,
} from '@/lib/auth/google';
import { safeNext } from '@/lib/auth/next-path';
import { HashBusyError } from '@/lib/auth/password';
import { landingPath, startSession } from '@/lib/auth/session';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

const redirectTo = (location: string): Response =>
  new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } });

export async function GET(req: Request): Promise<Response> {
  const config = googleConfig();
  if (!config) return new Response('Not found', { status: 404 });
  const { appUrl } = getConfig();
  const fail = (code: GoogleErrorCode | 'busy') => redirectTo(`${appUrl}/login?error=${code}`);

  const jar = await cookies();
  const flow = decodeFlow(jar.get(GOOGLE_FLOW_COOKIE)?.value);
  // One use only, whatever happens next.
  jar.set(GOOGLE_FLOW_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: appUrl.startsWith('https:'),
    path: GOOGLE_CALLBACK_PATH,
    maxAge: 0,
  });

  const params = new URL(req.url).searchParams;
  if (params.get('error')) return fail('google_denied');
  if (!flow || !sameState(params.get('state'), flow.state)) return fail('google_state');
  const code = params.get('code');
  if (!code) return fail('google_failed');

  try {
    const email = await exchangeCode({ code, verifier: flow.verifier, redirectUri: googleRedirectUri(appUrl), config });
    const db = getDb();
    const { account } = await findOrCreateGoogleAccount(db, email);
    await startSession(account.id);
    return redirectTo(`${appUrl}${safeNext(flow.next) ?? landingPath(account.id, db)}`);
  } catch (err) {
    if (err instanceof GoogleAuthError) return fail(err.code);
    if (err instanceof HashBusyError) return fail('busy');
    return fail('google_failed');
  }
}
