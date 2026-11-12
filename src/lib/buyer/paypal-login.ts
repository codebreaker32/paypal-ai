// "Log in with PayPal" for buyers (OpenID Connect, authorization code flow, sandbox only), by plain fetch. Off (no
// button, routes 404) unless PAYPAL_LOGIN_ENABLED=1, since the PayPal app needs the feature turned on first. Nothing
// here logs: codes and tokens are never written out.
import { randomBytes } from 'node:crypto';
import { PAYPAL_SANDBOX_BASE } from '@/lib/config';
import { MAX_EMAIL_LENGTH } from '@/lib/domain/payee';

export { sameState } from '@/lib/auth/google';

export const PAYPAL_AUTHORIZE_URL = 'https://www.sandbox.paypal.com/signin/authorize';
export const PAYPAL_TOKEN_URL = `${PAYPAL_SANDBOX_BASE}/v1/oauth2/token`;
export const PAYPAL_USERINFO_URL = `${PAYPAL_SANDBOX_BASE}/v1/identity/oauth2/userinfo?schema=paypalv1.1`;
export const PAYPAL_LOGIN_CALLBACK_PATH = '/api/buyer/paypal/callback';
/** Holds `state` between start and callback, scoped to the callback path. */
export const PAYPAL_LOGIN_STATE_COOKIE = 'shelfie_paypal_state';
export const PAYPAL_LOGIN_STATE_SECONDS = 10 * 60;

export const paypalLoginEnabled = (): boolean => process.env.PAYPAL_LOGIN_ENABLED?.trim() === '1';

export const paypalLoginRedirectUri = (appUrl: string): string => `${appUrl}${PAYPAL_LOGIN_CALLBACK_PATH}`;

export const newState = (): string => randomBytes(32).toString('base64url');

export function paypalAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    flowEntry: 'static',
    client_id: input.clientId,
    response_type: 'code',
    scope: 'openid email',
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  // URLSearchParams writes a space as '+'; PayPal documents %20.
  return `${PAYPAL_AUTHORIZE_URL}?${params.toString().replace(/\+/g, '%20')}`;
}

export class PayPalLoginError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= MAX_EMAIL_LENGTH && EMAIL.test(e) ? e : null;
};

const truthy = (v: unknown): boolean => v === true || v === 'true';

/**
 * The account's emails from a paypalv1.1 userinfo body: the confirmed ones, else the primary one; a top-level `email`
 * only when there is no `emails` list. Lower-cased, trimmed, deduplicated.
 */
export function emailsFromUserinfo(body: unknown): string[] {
  if (body === null || typeof body !== 'object') return [];
  const b = body as { emails?: unknown; email?: unknown };
  let picked: unknown[];
  if (Array.isArray(b.emails)) {
    const list = b.emails.filter(
      (e): e is { value?: unknown; primary?: unknown; confirmed?: unknown } => e !== null && typeof e === 'object',
    );
    const confirmed = list.filter((e) => truthy(e.confirmed));
    picked = (confirmed.length > 0 ? confirmed : list.filter((e) => truthy(e.primary))).map((e) => e.value);
  } else {
    picked = [b.email];
  }
  return [...new Set(picked.map(clean).filter((e): e is string => e !== null))];
}

/** Exchanges the code for an access token, then reads the account's emails from userinfo. */
export async function exchangeCodeForEmails(
  input: { code: string; clientId: string; clientSecret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const basic = Buffer.from(`${input.clientId}:${input.clientSecret}`).toString('base64');
  let tokenRes: Response;
  try {
    tokenRes = await fetchImpl(PAYPAL_TOKEN_URL, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: input.code }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new PayPalLoginError('Token request failed.');
  }
  if (!tokenRes.ok) throw new PayPalLoginError(`Token endpoint answered ${tokenRes.status}.`);
  const token = (await tokenRes.json().catch(() => null)) as { access_token?: unknown } | null;
  if (!token || typeof token.access_token !== 'string' || token.access_token === '') throw new PayPalLoginError('No access token.');

  let infoRes: Response;
  try {
    infoRes = await fetchImpl(PAYPAL_USERINFO_URL, {
      headers: { authorization: `Bearer ${token.access_token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new PayPalLoginError('Userinfo request failed.');
  }
  if (!infoRes.ok) throw new PayPalLoginError(`Userinfo answered ${infoRes.status}.`);
  return emailsFromUserinfo(await infoRes.json().catch(() => null));
}
