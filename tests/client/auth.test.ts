// Browser-side calls for the account routes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/client/http';
import { createRecoveryKey, login, logout, markRecoverySaved, recover, signup } from '@/lib/client/auth';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function stubFetch(res: Response) {
  const fetchMock = vi.fn(async () => res);
  vi.stubGlobal('fetch', fetchMock);
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return { url, init, body: init.body ? (JSON.parse(init.body as string) as unknown) : undefined };
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('account calls', () => {
  it('signup posts email and password, and returns the key and where to go', async () => {
    const sent = stubFetch(json(201, { recoveryKey: 'KEY', next: '/shops/new' }));
    await expect(signup('rosa@example.com', 'a long sentence here')).resolves.toEqual({ recoveryKey: 'KEY', next: '/shops/new' });
    expect(sent()).toMatchObject({ url: '/api/auth/signup', init: { method: 'POST' }, body: { email: 'rosa@example.com', password: 'a long sentence here' } });
  });

  it('login posts the next path when given one', async () => {
    const sent = stubFetch(json(200, { next: '/shops/shp_1' }));
    await expect(login('rosa@example.com', 'a long sentence here', '/shops/shp_1')).resolves.toEqual({ next: '/shops/shp_1' });
    expect(sent()).toMatchObject({ url: '/api/auth/login', body: { email: 'rosa@example.com', password: 'a long sentence here', next: '/shops/shp_1' } });
  });

  it('login leaves next out when there is none', async () => {
    const sent = stubFetch(json(200, { next: '/shops/new' }));
    await login('rosa@example.com', 'a long sentence here');
    expect(sent().body).not.toHaveProperty('next');
  });

  it('logout posts and resolves on 204', async () => {
    const sent = stubFetch(new Response(null, { status: 204 }));
    await expect(logout()).resolves.toBeUndefined();
    expect(sent()).toMatchObject({ url: '/api/auth/logout', init: { method: 'POST' } });
  });

  it('recover posts the three fields and returns the new key', async () => {
    const sent = stubFetch(json(200, { recoveryKey: 'NEW', next: '/shops' }));
    await expect(recover('rosa@example.com', 'ABCDE', 'a long sentence here')).resolves.toEqual({ recoveryKey: 'NEW', next: '/shops' });
    expect(sent()).toMatchObject({ url: '/api/auth/recover', body: { email: 'rosa@example.com', recoveryKey: 'ABCDE', newPassword: 'a long sentence here' } });
  });

  it('createRecoveryKey posts the current password', async () => {
    const sent = stubFetch(json(200, { recoveryKey: 'NEW' }));
    await expect(createRecoveryKey('a long sentence here')).resolves.toEqual({ recoveryKey: 'NEW' });
    expect(sent()).toMatchObject({ url: '/api/account/recovery-key', init: { method: 'POST' }, body: { currentPassword: 'a long sentence here' } });
  });

  it('markRecoverySaved patches with no body', async () => {
    const sent = stubFetch(new Response(null, { status: 204 }));
    await expect(markRecoverySaved()).resolves.toBeUndefined();
    expect(sent()).toMatchObject({ url: '/api/account/recovery-key', init: { method: 'PATCH' } });
    expect(sent().body).toBeUndefined();
  });

  it('turns an error answer into an ApiError with its code', async () => {
    stubFetch(json(401, { error: { code: 'BAD_CREDENTIALS', message: 'That email and password don’t match.' } }));
    const err = await login('rosa@example.com', 'wrong').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: 'BAD_CREDENTIALS', message: 'That email and password don’t match.' });
  });

  it('a network failure is an ApiError with code NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(logout()).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
