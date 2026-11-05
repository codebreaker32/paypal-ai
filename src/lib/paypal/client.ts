// PayPal REST client (sandbox). Injected fetch + sleep so tests never touch the network or wait.
import { PayPalApiError, type PayPalPort } from './types';
import { createProductCall } from './catalog';
import { buildOrderBody, approveUrlOf } from './orders';
import { verifyWebhook } from './webhooks';

export interface PayPalClientOptions {
  fetch?: typeof fetch;
  base: string;
  clientId: string;
  secret: string;
  /** Injected in tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface RequestOptions {
  body?: unknown;
  requestId?: string;
  headers?: Record<string, string>;
}

export type Requester = <T = unknown>(method: string, path: string, opts?: RequestOptions) => Promise<T>;

export type PayPalClient = PayPalPort & {
  verifyWebhookSignature(headers: Headers, rawBody: string, webhookId: string): Promise<boolean>;
};

const RETRY_DELAYS_MS = [200, 600];
const TOKEN_SKEW_MS = 60_000;

/** Turn a non-2xx PayPal response into a PayPalApiError that keeps PayPal's issue code. */
export function toApiError(status: number, text: string): PayPalApiError {
  let body: { name?: string; message?: string; debug_id?: string; details?: { issue?: string }[]; error?: string; error_description?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  const name = body.name ?? body.error ?? `HTTP_${status}`;
  const issue = body.details?.[0]?.issue ?? null;
  const message = body.message ?? body.error_description ?? `PayPal returned HTTP ${status}`;
  return new PayPalApiError(status, name, issue, body.debug_id ?? null, message);
}

export function createPayPalClient(opts: PayPalClientOptions): PayPalClient {
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  let cached: { token: string; expiresAt: number } | null = null;

  let inflight: Promise<string> | null = null;

  async function fetchToken(): Promise<string> {
    const basic = Buffer.from(`${opts.clientId}:${opts.secret}`).toString('base64');
    for (let attempt = 0; ; attempt++) {
      let status = 0;
      let text = '';
      try {
        const res = await doFetch(`${opts.base}/v1/oauth2/token`, {
          method: 'POST',
          headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=client_credentials',
        });
        status = res.status;
        text = await res.text();
        if (res.ok) {
          const json = JSON.parse(text) as { access_token: string; expires_in: number };
          cached = { token: json.access_token, expiresAt: now() + json.expires_in * 1000 };
          return cached.token;
        }
      } catch (e) {
        if (attempt >= RETRY_DELAYS_MS.length) throw e;
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      if ((status === 429 || status >= 500) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw toApiError(status, text);
    }
  }

  /** Concurrent cold callers share one in-flight token request. */
  function getToken(force = false): Promise<string> {
    if (!force && cached && now() < cached.expiresAt - TOKEN_SKEW_MS) return Promise.resolve(cached.token);
    inflight ??= fetchToken().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  const request: Requester = async <T,>(method: string, path: string, o: RequestOptions = {}): Promise<T> => {
    let refreshed = false;
    let attempt = 0;
    for (;;) {
      const token = await getToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json', ...o.headers };
      if (o.body !== undefined) headers['Content-Type'] = 'application/json';
      if (o.requestId) headers['PayPal-Request-Id'] = o.requestId;
      let res: Response;
      let text: string;
      try {
        res = await doFetch(`${opts.base}${path}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
        text = await res.text();
      } catch (e) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt++]);
          continue;
        }
        throw e;
      }
      if (res.ok) return (text ? JSON.parse(text) : {}) as T;
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        await getToken(true);
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt++]);
        continue;
      }
      throw toApiError(res.status, text);
    }
  };

  return {
    createProduct: (p, requestId) => createProductCall(request, p, requestId),
    async createOrder(input, requestId) {
      const order = await request<{ id: string; status: 'CREATED' | 'PAYER_ACTION_REQUIRED'; links?: { rel: string; href: string }[] }>(
        'POST',
        '/v2/checkout/orders',
        { body: buildOrderBody(input), requestId },
      );
      return { id: order.id, status: order.status, approveUrl: approveUrlOf(order) };
    },
    getOrder: (id) => request('GET', `/v2/checkout/orders/${encodeURIComponent(id)}`),
    captureOrder: (id, requestId) =>
      request('POST', `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {
        body: {},
        requestId,
        headers: { Prefer: 'return=representation' },
      }),
    verifyWebhookSignature: (headers, rawBody, webhookId) => verifyWebhook(request, headers, rawBody, webhookId),
  };
}
