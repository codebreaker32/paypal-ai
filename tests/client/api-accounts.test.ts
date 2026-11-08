// The Start page's calls once shops belong to accounts: the two refusals of POST /api/shops.
import { describe, expect, it } from 'vitest';
import { StartError, startFromSample } from '@/lib/client/api';
import { ApiError } from '@/lib/client/http';
import { isGone } from '@/components/dashboard/api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const errorFrom = (status: number, code: string) =>
  startFromSample('marigold-bakehouse', { fetch: async () => json(status, { error: { code, message: 'x' } }) }).catch((e: unknown) => e);

describe('POST /api/shops refusals', () => {
  it('LOGIN_REQUIRED is its own kind, with its own message', async () => {
    const err = (await errorFrom(401, 'LOGIN_REQUIRED')) as StartError;
    expect(err).toBeInstanceOf(StartError);
    expect(err.kind).toBe('login_required');
    expect(err.message).toBe('Log in to add a shop.');
  });

  it('SHOP_LIMIT is its own kind, with its own message', async () => {
    const err = (await errorFrom(409, 'SHOP_LIMIT')) as StartError;
    expect(err.kind).toBe('shop_limit');
    expect(err.message).toBe('One account can have up to 25 shops.');
  });

  it('a bare 401 counts as logged out', async () => {
    const err = (await startFromSample('marigold-bakehouse', { fetch: async () => new Response(null, { status: 401 }) }).catch((e: unknown) => e)) as StartError;
    expect(err.kind).toBe('login_required');
  });
});

describe('isGone, for the dashboard poll', () => {
  it('is true only for a 404: the session ended or the shop went away', () => {
    expect(isGone(new ApiError(404, 'NOT_FOUND', 'x'))).toBe(true);
    expect(isGone(new ApiError(500, 'SERVER_ERROR', 'x'))).toBe(false);
    expect(isGone(new ApiError(0, 'NETWORK', 'x'))).toBe(false);
    expect(isGone(new Error('x'))).toBe(false);
  });
});
