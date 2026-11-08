// The account routes through a real server: cookies, the owner check and the redirect behave in Next as they do in the
// unit tests, with no screens involved (those are e2e/accounts.spec.ts).
import { expect, test } from '@playwright/test';

const PASSWORD = 'a long sentence only this test says';

test('an account owns its shop by session, and logging out closes it (SR13 to SR17)', async ({ request, playwright, baseURL }) => {
  const email = `e2e-${Date.now()}@example.com`;

  const signup = await request.post('/api/auth/signup', { data: { email, password: PASSWORD } });
  expect(signup.status()).toBe(201);
  expect(signup.headers()['cache-control']).toBe('no-store');
  const { recoveryKey, next } = (await signup.json()) as { recoveryKey: string; next: string };
  expect(recoveryKey).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
  expect(next).toBe('/shops/new');
  const cookies = (await request.storageState()).cookies;
  const session = cookies.find((c) => c.name === 'shelfie_session');
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Lax');
  expect(cookies.find((c) => c.name === 'shelfie_returning')?.value).toBe('1');

  const created = await request.post('/api/shops', { data: { sample: 'ravi-bike-repair' } });
  expect(created.status()).toBe(201);
  const { shopId } = (await created.json()) as { shopId: string };
  expect((await request.storageState()).cookies.some((c) => c.name.startsWith('shelfie_owner_'))).toBe(false);

  expect((await request.get(`/shops/${shopId}/setup`, { maxRedirects: 0 })).status()).toBe(200);

  const crossSite = await request.post('/api/auth/logout', { headers: { origin: 'https://evil.example' } });
  expect(crossSite.status()).toBe(403);
  expect(((await crossSite.json()) as { error: { code: string } }).error.code).toBe('BAD_ORIGIN');
  expect((await request.get(`/shops/${shopId}/setup`, { maxRedirects: 0 })).status()).toBe(200);

  expect((await request.post('/api/auth/logout')).status()).toBe(204);
  const afterLogout = await request.get(`/shops/${shopId}/setup`, { maxRedirects: 0 });
  expect(afterLogout.status()).toBeGreaterThanOrEqual(300);
  expect(afterLogout.status()).toBeLessThan(400);
  expect(afterLogout.headers()['location']).toBe(`/login?next=/shops/${shopId}`);

  const stranger = await playwright.request.newContext({ baseURL });
  expect((await stranger.get(`/shops/${shopId}/setup`, { maxRedirects: 0 })).status()).toBe(404);
  await stranger.dispose();

  const wrong = await request.post('/api/auth/login', { data: { email, password: 'not the password at all' } });
  expect(wrong.status()).toBe(401);

  const login = await request.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(login.status()).toBe(200);
  expect(await login.json()).toEqual({ next: `/shops/${shopId}/setup` });
  expect((await request.get(`/shops/${shopId}/setup`, { maxRedirects: 0 })).status()).toBe(200);

  const recovered = await request.post('/api/auth/recover', {
    data: { email, recoveryKey, newPassword: 'a brand new sentence for the shop' },
  });
  expect(recovered.status()).toBe(200);
  expect(((await recovered.json()) as { recoveryKey: string }).recoveryKey).not.toBe(recoveryKey);
  expect((await request.post('/api/auth/login', { data: { email, password: PASSWORD } })).status()).toBe(401);
  expect((await request.post('/api/auth/login', { data: { email, password: 'a brand new sentence for the shop' } })).status()).toBe(200);
});
