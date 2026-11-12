// "Continue with Google": the flow cookie, the id_token checks, the code exchange (fetch mocked) and the account mapping.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import {
  GOOGLE_TOKEN_URL,
  GoogleAuthError,
  authorizationUrl,
  decodeFlow,
  decodeIdTokenPayload,
  encodeFlow,
  exchangeCode,
  findOrCreateGoogleAccount,
  googleConfig,
  newFlow,
  sameState,
  validateClaims,
} from '@/lib/auth/google';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createHash } from 'node:crypto';

const CLIENT = 'client-123.apps.googleusercontent.com';
const CONFIG = { clientId: CLIENT, clientSecret: 'shh' };
const good = { iss: 'https://accounts.google.com', aud: CLIENT, email: 'Rosa@Example.com', email_verified: true, exp: Date.now() / 1000 + 600 };
const jwt = (payload: unknown) =>
  `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

const codeOf = (err: unknown) => (err instanceof GoogleAuthError ? err.code : 'other');
const thrown = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return codeOf(err);
  }
  return null;
};

afterEach(() => vi.unstubAllEnvs());

describe('googleConfig', () => {
  it('is off unless both variables are set', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', CLIENT);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(googleConfig()).toBeNull();
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'shh');
    expect(googleConfig()).toEqual(CONFIG);
  });
});

describe('the flow', () => {
  it('builds a PKCE S256 challenge from the verifier and a consent URL carrying it', () => {
    const { state, verifier, challenge } = newFlow();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
    const url = new URL(authorizationUrl({ clientId: CLIENT, redirectUri: 'https://shop.test/api/auth/google/callback', state, challenge }));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('redirect_uri')).toBe('https://shop.test/api/auth/google/callback');
  });

  it('round-trips the cookie, with and without next', () => {
    expect(decodeFlow(encodeFlow({ state: 's', verifier: 'v', next: '/shops/x?tab=menu' }))).toEqual({ state: 's', verifier: 'v', next: '/shops/x?tab=menu' });
    expect(decodeFlow(encodeFlow({ state: 's', verifier: 'v', next: null }))).toEqual({ state: 's', verifier: 'v', next: null });
    expect(decodeFlow(undefined)).toBeNull();
    expect(decodeFlow('garbage')).toBeNull();
    expect(decodeFlow('.v.')).toBeNull();
  });

  it('compares state exactly and refuses a missing one', () => {
    expect(sameState('abc', 'abc')).toBe(true);
    expect(sameState('abc', 'abd')).toBe(false);
    expect(sameState(null, 'abc')).toBe(false);
    expect(sameState('', '')).toBe(false);
  });
});

describe('validateClaims', () => {
  it('accepts a verified Google email and lower-cases it', () => {
    expect(validateClaims(good, CLIENT)).toBe('rosa@example.com');
    expect(validateClaims({ ...good, iss: 'accounts.google.com' }, CLIENT)).toBe('rosa@example.com');
  });

  it.each([
    ['another issuer', { iss: 'https://evil.example' }, 'google_failed'],
    ['another audience', { aud: 'someone-else' }, 'google_failed'],
    ['an expired token', { exp: Date.now() / 1000 - 10 }, 'google_failed'],
    ['an unverified email', { email_verified: false }, 'google_unverified'],
    ['a missing email_verified', { email_verified: undefined }, 'google_unverified'],
    ['no email', { email: undefined }, 'google_unverified'],
  ])('refuses %s', (_name, patch, code) => {
    expect(thrown(() => validateClaims({ ...good, ...patch }, CLIENT))).toBe(code);
  });

  it('refuses a malformed id_token', () => {
    expect(thrown(() => decodeIdTokenPayload('a.b'))).toBe('google_failed');
    expect(thrown(() => decodeIdTokenPayload('a.!!!.c'))).toBe('google_failed');
  });
});

describe('exchangeCode', () => {
  const input = { code: 'the-code', verifier: 'the-verifier', redirectUri: 'https://shop.test/api/auth/google/callback', config: CONFIG };

  it('posts the code and verifier to the token endpoint and returns the email', async () => {
    const fetchMock = vi.fn(async () => Response.json({ id_token: jwt(good), access_token: 'x' }));
    await expect(exchangeCode(input, fetchMock as unknown as typeof fetch)).resolves.toBe('rosa@example.com');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GOOGLE_TOKEN_URL);
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBe('the-verifier');
    expect(body.get('redirect_uri')).toBe(input.redirectUri);
  });

  it('fails on an error answer, a missing id_token, a network error or a bad audience', async () => {
    const cases: (() => Promise<Response>)[] = [
      async () => Response.json({ error: 'invalid_grant' }, { status: 400 }),
      async () => Response.json({ access_token: 'x' }),
      async () => {
        throw new Error('offline');
      },
      async () => Response.json({ id_token: jwt({ ...good, aud: 'other' }) }),
    ];
    for (const impl of cases) {
      await expect(exchangeCode(input, vi.fn(impl) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'google_failed' });
    }
  });
});

describe('findOrCreateGoogleAccount', () => {
  it('finds the existing account by email without touching its password', async () => {
    const db = createTestDb();
    const passwordHash = await hashPassword('a perfectly fine passphrase');
    const existing = accounts.create(db, { email: 'rosa@example.com', passwordHash, recoveryHash: 'r', termsVersion: 'v1' });
    const { account, created } = await findOrCreateGoogleAccount(db, 'rosa@example.com');
    expect(created).toBe(false);
    expect(account.id).toBe(existing.id);
    expect(accounts.byId(db, existing.id)!.passwordHash).toBe(passwordHash);
  });

  it('creates an account whose password can never match, with no recovery banner', async () => {
    const db = createTestDb();
    const { account, created } = await findOrCreateGoogleAccount(db, 'new@example.com');
    expect(created).toBe(true);
    expect(account.email).toBe('new@example.com');
    expect(account.passwordHash).toMatch(/^scrypt\$/);
    expect(account.recoverySavedAt).not.toBeNull();
    for (const guess of ['', 'new@example.com', 'password']) expect(await verifyPassword(guess, account.passwordHash)).toBe(false);
    // A second sign-in finds the same account.
    expect((await findOrCreateGoogleAccount(db, 'new@example.com')).account.id).toBe(account.id);
  });
});
