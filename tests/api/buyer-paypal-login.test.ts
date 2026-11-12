// "Log in with PayPal" for buyers on /orders: the gate, the state check, the code exchange (fetch mocked), the buyer
// session and GET /api/buyer/orders (only that buyer's orders, only the list's fields).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  jar: new Map<string, string>(),
  written: new Map<string, { value: string; options: Record<string, unknown> }>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      state.written.set(name, { value, options });
      if (value === '' || options.maxAge === 0) state.jar.delete(name);
      else state.jar.set(name, value);
    },
  }),
}));
vi.mock('@/lib/db', async (orig) => ({ ...(await orig<typeof import('@/lib/db')>()), getDb: () => state.db }));

const { createTestDb } = await import('@/lib/db');
const ordersRepo = await import('@/lib/db/repos/orders');
const buyerSessions = await import('@/lib/db/repos/buyer-sessions');
const { hashToken } = await import('@/lib/domain/ids');
const { createFakePayPal } = await import('@/lib/paypal/fake');
const { createOrderForShop } = await import('@/lib/orders/service');
const { seedShop } = await import('../helpers/shop');
const login = await import('@/lib/buyer/paypal-login');
const session = await import('@/lib/buyer/session');
const { GET: start } = await import('@/app/api/buyer/paypal/start/route');
const { GET: callback } = await import('@/app/api/buyer/paypal/callback/route');
const { POST: logout } = await import('@/app/api/buyer/logout/route');
const { GET: buyerOrders } = await import('@/app/api/buyer/orders/route');

const APP = 'https://shelfie.test';

beforeEach(() => {
  state.db = createTestDb();
  state.jar.clear();
  state.written.clear();
  vi.stubEnv('PAYPAL_LOGIN_ENABLED', '1');
  vi.stubEnv('APP_URL', APP);
  vi.stubEnv('PAYPAL_CLIENT_ID', 'client-abc');
  vi.stubEnv('PAYPAL_SECRET_KEY', 'secret-xyz');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Token then userinfo, recording each call. */
function mockPayPal(userinfo: unknown, tokenStatus = 200) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url) === login.PAYPAL_TOKEN_URL) return json({ access_token: 'at-123', token_type: 'Bearer' }, tokenStatus);
    if (String(url) === login.PAYPAL_USERINFO_URL) return json(userinfo);
    return json({}, 404);
  });
  return { fetchMock, calls };
}

const USERINFO = {
  user_id: 'https://www.paypal.com/webapps/auth/identity/user/abc',
  emails: [
    { value: ' Jane.Buyer@Example.com ', primary: true, confirmed: true },
    { value: 'old@example.com', primary: false, confirmed: false },
  ],
};

describe('gate', () => {
  it('every route answers 404 unless PAYPAL_LOGIN_ENABLED=1', async () => {
    vi.stubEnv('PAYPAL_LOGIN_ENABLED', '');
    expect((await start()).status).toBe(404);
    expect((await callback(new Request(`${APP}/api/buyer/paypal/callback?code=c&state=s`))).status).toBe(404);
    expect((await logout(new Request(`${APP}/api/buyer/logout`, { method: 'POST' }))).status).toBe(404);
    expect((await buyerOrders()).status).toBe(404);
  });
});

describe('start', () => {
  it('sets a 10-minute state cookie on the callback path and redirects to the sandbox consent', async () => {
    const res = await start();
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin + loc.pathname).toBe('https://www.sandbox.paypal.com/signin/authorize');
    expect(res.headers.get('location')).toContain('scope=openid%20email');
    expect(loc.searchParams.get('client_id')).toBe('client-abc');
    expect(loc.searchParams.get('flowEntry')).toBe('static');
    expect(loc.searchParams.get('response_type')).toBe('code');
    expect(loc.searchParams.get('redirect_uri')).toBe(`${APP}/api/buyer/paypal/callback`);
    const cookie = state.written.get(login.PAYPAL_LOGIN_STATE_COOKIE)!;
    expect(loc.searchParams.get('state')).toBe(cookie.value);
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true, path: '/api/buyer/paypal/callback', maxAge: 600 });
  });
});

describe('callback', () => {
  const cb = (qs: string) => callback(new Request(`${APP}/api/buyer/paypal/callback?${qs}`));

  it('refuses a missing or wrong state, without calling PayPal, and clears the state cookie', async () => {
    const { fetchMock } = mockPayPal(USERINFO);
    vi.stubGlobal('fetch', fetchMock);
    let res = await cb('code=c&state=s');
    expect(res.headers.get('location')).toBe(`${APP}/orders?paypal=error`);
    state.jar.set(login.PAYPAL_LOGIN_STATE_COOKIE, 'right');
    res = await cb('code=c&state=wrong');
    expect(res.headers.get('location')).toBe(`${APP}/orders?paypal=error`);
    expect(state.jar.has(login.PAYPAL_LOGIN_STATE_COOKIE)).toBe(false);
    expect(state.written.get(login.PAYPAL_LOGIN_STATE_COOKIE)!.options.maxAge).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.jar.has(session.BUYER_COOKIE)).toBe(false);
  });

  it('sends a denied consent to the error message', async () => {
    state.jar.set(login.PAYPAL_LOGIN_STATE_COOKIE, 'st');
    const res = await cb('error=access_denied&state=st');
    expect(res.headers.get('location')).toBe(`${APP}/orders?paypal=error`);
  });

  it('exchanges the code, reads the emails and starts a buyer session', async () => {
    const { fetchMock, calls } = mockPayPal(USERINFO);
    vi.stubGlobal('fetch', fetchMock);
    state.jar.set(login.PAYPAL_LOGIN_STATE_COOKIE, 'st');
    const res = await cb('code=the-code&state=st');
    expect(res.headers.get('location')).toBe(`${APP}/orders`);
    expect(calls[0].url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    expect(calls[0].init?.method).toBe('POST');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from('client-abc:secret-xyz').toString('base64')}`);
    expect(String(calls[0].init?.body)).toBe('grant_type=authorization_code&code=the-code');
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1');
    expect((calls[1].init?.headers as Record<string, string>).authorization).toBe('Bearer at-123');
    const cookie = state.written.get(session.BUYER_COOKIE)!;
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 30 * 24 * 60 * 60 });
    const row = buyerSessions.byTokenHash(state.db, hashToken(cookie.value))!;
    expect(row.emails).toEqual(['jane.buyer@example.com']);
  });

  it('redirects with noemail when PayPal shares no usable email, and error when the token call fails', async () => {
    vi.stubGlobal('fetch', mockPayPal({ emails: [] }).fetchMock);
    state.jar.set(login.PAYPAL_LOGIN_STATE_COOKIE, 'st');
    expect((await cb('code=c&state=st')).headers.get('location')).toBe(`${APP}/orders?paypal=noemail`);
    vi.stubGlobal('fetch', mockPayPal(USERINFO, 401).fetchMock);
    state.jar.set(login.PAYPAL_LOGIN_STATE_COOKIE, 'st');
    expect((await cb('code=c&state=st')).headers.get('location')).toBe(`${APP}/orders?paypal=error`);
    expect(state.jar.has(session.BUYER_COOKIE)).toBe(false);
  });
});

describe('emailsFromUserinfo', () => {
  it('takes confirmed emails, else the primary one, else a top-level email; normalised and deduplicated', () => {
    expect(login.emailsFromUserinfo(USERINFO)).toEqual(['jane.buyer@example.com']);
    expect(login.emailsFromUserinfo({ emails: [{ value: 'A@x.com', primary: true }, { value: 'b@x.com' }] })).toEqual(['a@x.com']);
    expect(login.emailsFromUserinfo({ emails: [{ value: 'A@x.com', confirmed: true }, { value: 'a@x.com', confirmed: 'true' }] })).toEqual(['a@x.com']);
    expect(login.emailsFromUserinfo({ email: 'Top@x.com' })).toEqual(['top@x.com']);
    expect(login.emailsFromUserinfo({ emails: [{ value: 'not-an-email', confirmed: true }] })).toEqual([]);
    expect(login.emailsFromUserinfo(null)).toEqual([]);
  });
});

describe('buyer session', () => {
  it('looks up a token, and expires it after 30 days (the row is removed)', () => {
    const t0 = Date.parse('2026-11-01T00:00:00Z');
    const token = session.createBuyerSession(state.db, ['jane@example.com'], t0);
    expect(buyerSessions.byTokenHash(state.db, token)).toBeNull(); // only the hash is stored
    expect(session.buyerEmailsOfToken(state.db, token, t0 + 1000)).toEqual(['jane@example.com']);
    expect(session.buyerEmailsOfToken(state.db, 'other', t0)).toBeNull();
    expect(session.buyerEmailsOfToken(state.db, token, t0 + 30 * 24 * 3600 * 1000)).toBeNull();
    expect(buyerSessions.byTokenHash(state.db, hashToken(token))).toBeNull();
  });

  it('logout deletes the row and clears the cookie; a cross-site logout is refused', async () => {
    const token = session.createBuyerSession(state.db, ['jane@example.com']);
    state.jar.set(session.BUYER_COOKIE, token);
    const refused = await logout(new Request(`${APP}/api/buyer/logout`, { method: 'POST', headers: { origin: 'https://evil.test' } }));
    expect(refused.status).toBe(403);
    const res = await logout(new Request(`${APP}/api/buyer/logout`, { method: 'POST', headers: { origin: APP, host: 'shelfie.test' } }));
    expect(res.status).toBe(204);
    expect(buyerSessions.byTokenHash(state.db, hashToken(token))).toBeNull();
    expect(state.jar.has(session.BUYER_COOKIE)).toBe(false);
  });
});

describe('GET /api/buyer/orders', () => {
  const paypal = createFakePayPal();
  async function paidOrder(shop: Parameters<typeof createOrderForShop>[1], itemId: string, payerEmail: string | null) {
    const o = await createOrderForShop(
      { db: state.db, paypal, appUrl: APP },
      shop,
      { lines: [{ itemId, quantity: 1 }], fulfillment: 'pickup', buyerName: 'Jane Buyer' },
    );
    if (payerEmail) {
      ordersRepo.update(state.db, o.id, { payerEmail, payerName: 'Jane Buyer' });
      ordersRepo.casStatus(state.db, o.id, 'awaiting_approval', 'paid');
    }
    return o.id;
  }

  it('is 401 without a session', async () => {
    expect((await buyerOrders()).status).toBe(401);
  });

  it("returns only this buyer's orders, newest first, with only the list's fields", async () => {
    const s = seedShop(state.db, { name: 'Login Bakery', payeeEmail: 'rosa@example.com' });
    const item = s.item['Almond croissant'].id;
    const mine1 = await paidOrder(s.shop, item, 'Jane.Buyer@example.com');
    const theirs = await paidOrder(s.shop, item, 'someone@example.com');
    const unpaid = await paidOrder(s.shop, item, null);
    const mine2 = await paidOrder(s.shop, item, 'jane.buyer@example.com');
    state.db.prepare('UPDATE orders SET created_at = ? WHERE id = ?').run('2026-11-01T00:00:00.000Z', mine1);
    state.db.prepare('UPDATE orders SET created_at = ? WHERE id = ?').run('2026-11-02T00:00:00.000Z', mine2);

    state.jar.set(session.BUYER_COOKIE, session.createBuyerSession(state.db, ['jane.buyer@example.com']));
    const res = await buyerOrders();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { orders: Record<string, unknown>[] };
    expect(body.orders.map((o) => o.ref)).toEqual([mine2, mine1]);
    expect(body.orders.map((o) => o.ref)).not.toContain(theirs);
    expect(body.orders.map((o) => o.ref)).not.toContain(unpaid);
    for (const o of body.orders) {
      expect(Object.keys(o).sort()).toEqual(['createdAt', 'ref', 'shopName', 'status', 'statusLabel', 'total']);
    }
    expect(body.orders[0]).toMatchObject({ shopName: 'Login Bakery', total: 475, status: 'paid', statusLabel: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain('example.com');
  });
});
