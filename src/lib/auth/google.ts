// "Continue with Google": OAuth 2.0 authorization code flow with PKCE and `state`, by plain fetch. Off (no button, routes
// 404) unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are both set. Nothing here logs: codes and tokens are never
// written out.
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import { parsePayeeEmail } from '@/lib/domain/payee';
import { TERMS_VERSION } from '@/lib/legal/version';
import { hashPassword } from './password';
import { generateRecoveryKey, hashRecoveryKey } from './recovery';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';
/** Holds `state`, the PKCE verifier and the safe `next` path between start and callback. */
export const GOOGLE_FLOW_COOKIE = 'shelfie_google_flow';
export const GOOGLE_FLOW_SECONDS = 10 * 60;
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

/** Both env vars, or null: the feature is off. */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const googleEnabled = (): boolean => googleConfig() !== null;

export const googleRedirectUri = (appUrl: string): string => `${appUrl}${GOOGLE_CALLBACK_PATH}`;

const b64url = (buf: Buffer): string => buf.toString('base64url');

export function newFlow(): { state: string; verifier: string; challenge: string } {
  const state = b64url(randomBytes(32));
  const verifier = b64url(randomBytes(48)); // 64 characters, within RFC 7636's 43..128
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { state, verifier, challenge };
}

export function authorizationUrl(input: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** The flow cookie's value: three base64url-safe parts, `next` itself base64url-encoded (it may hold any path). */
export function encodeFlow(flow: { state: string; verifier: string; next: string | null }): string {
  return [flow.state, flow.verifier, flow.next ? b64url(Buffer.from(flow.next, 'utf8')) : ''].join('.');
}

export function decodeFlow(value: string | undefined): { state: string; verifier: string; next: string | null } | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) return null;
  return { state: parts[0], verifier: parts[1], next: parts[2] ? Buffer.from(parts[2], 'base64url').toString('utf8') : null };
}

/** Constant-time enough for two random strings of our own: compare their hashes. */
export function sameState(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const h = (s: string) => createHash('sha256').update(s).digest('hex');
  return h(a) === h(b);
}

export type GoogleErrorCode = 'google_denied' | 'google_state' | 'google_failed' | 'google_unverified';

export class GoogleAuthError extends Error {
  constructor(readonly code: GoogleErrorCode, message: string) {
    super(message);
  }
}

/** Decodes a JWT's payload without checking its signature: only for an id_token fetched straight from Google over TLS. */
export function decodeIdTokenPayload(idToken: string): Record<string, unknown> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new GoogleAuthError('google_failed', 'Malformed id_token.');
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown;
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('not an object');
    return payload as Record<string, unknown>;
  } catch {
    throw new GoogleAuthError('google_failed', 'Malformed id_token payload.');
  }
}

/** The id_token's claims, checked: issuer, audience, expiry, a verified email. Returns the normalised email. */
export function validateClaims(claims: Record<string, unknown>, clientId: string, nowMs: number = Date.now()): string {
  if (typeof claims.iss !== 'string' || !ISSUERS.has(claims.iss)) throw new GoogleAuthError('google_failed', 'Wrong issuer.');
  const aud = claims.aud;
  const audOk = typeof aud === 'string' ? aud === clientId : Array.isArray(aud) && aud.includes(clientId);
  if (!audOk) throw new GoogleAuthError('google_failed', 'Wrong audience.');
  if (typeof claims.exp === 'number' && claims.exp * 1000 < nowMs) throw new GoogleAuthError('google_failed', 'Expired id_token.');
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throw new GoogleAuthError('google_unverified', 'Email not verified.');
  }
  const parsed = parsePayeeEmail(claims.email);
  if (!parsed.ok) throw new GoogleAuthError('google_unverified', 'No usable email.');
  return parsed.email;
}

/** Exchanges the code at Google's token endpoint and returns the verified email from its id_token. */
export async function exchangeCode(
  input: { code: string; verifier: string; redirectUri: string; config: GoogleConfig },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        code_verifier: input.verifier,
        redirect_uri: input.redirectUri,
        client_id: input.config.clientId,
        client_secret: input.config.clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new GoogleAuthError('google_failed', 'Token request failed.');
  }
  if (!res.ok) throw new GoogleAuthError('google_failed', `Token endpoint answered ${res.status}.`);
  const body = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!body || typeof body.id_token !== 'string') throw new GoogleAuthError('google_failed', 'No id_token.');
  return validateClaims(decodeIdTokenPayload(body.id_token), input.config.clientId);
}

const isDuplicateEmail = (err: unknown): boolean => (err as { code?: unknown } | null)?.code === 'SQLITE_CONSTRAINT_UNIQUE';

/**
 * The account for a Google-verified email: the existing one (emails are stored lower-cased), else a new one. A new
 * account's password is the scrypt hash of 64 random bytes nobody ever sees, so password login can never match it, and
 * its recovery key is likewise random and marked saved: a Google account signs in with Google, no banner asks for a key.
 */
export async function findOrCreateGoogleAccount(db: Db, email: string): Promise<{ account: accounts.Account; created: boolean }> {
  const existing = accounts.byEmail(db, email);
  if (existing) return { account: existing, created: false };
  const passwordHash = await hashPassword(randomBytes(64).toString('base64url'));
  try {
    const account = accounts.create(db, {
      email,
      passwordHash,
      recoveryHash: hashRecoveryKey(generateRecoveryKey()),
      termsVersion: TERMS_VERSION,
    });
    accounts.markRecoverySaved(db, account.id);
    return { account: accounts.byId(db, account.id)!, created: true };
  } catch (err) {
    const raced = isDuplicateEmail(err) ? accounts.byEmail(db, email) : null;
    if (raced) return { account: raced, created: false };
    throw err;
  }
}
