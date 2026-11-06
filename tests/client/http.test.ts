// The browser-side JSON call shared by the setup and dashboard screens.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, call } from '@/lib/client/http';
import { ApiError as SetupApiError } from '@/components/setup/api';
import { ApiError as DashboardApiError, fetchOrders } from '@/components/dashboard/api';

afterEach(() => vi.unstubAllGlobals());

describe('call', () => {
  it('returns the status and body, fetching without the cache', async () => {
    const fetch = vi.fn(async () => Response.json({ reading: true }, { status: 202 }));
    vi.stubGlobal('fetch', fetch);
    expect(await call('/x', { method: 'POST' })).toEqual({ status: 202, body: { reading: true } });
    expect(fetch).toHaveBeenCalledWith('/x', { cache: 'no-store', method: 'POST' });
  });

  it('throws ApiError(status, code, message) from the error body, or the fallbacks', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: { code: 'ITEM_LIVE', message: 'Already in PayPal.' } }, { status: 409 }));
    await expect(call('/x')).rejects.toMatchObject({ status: 409, code: 'ITEM_LIVE', message: 'Already in PayPal.' });
    vi.stubGlobal('fetch', async () => new Response('oops', { status: 500 }));
    await expect(call('/x')).rejects.toMatchObject({ status: 500, code: 'SERVER_ERROR', message: expect.stringMatching(/try again/i) });
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    const e = await call('/x').catch((err) => err);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('is the one ApiError for the setup and dashboard screens; the dashboard keeps its own fallbacks', async () => {
    expect(SetupApiError).toBe(ApiError);
    expect(DashboardApiError).toBe(ApiError);
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
    await expect(fetchOrders('shp_1')).rejects.toMatchObject({ status: 404, code: 'HTTP_404', message: "We couldn’t find that. Reload the page." });
  });
});
