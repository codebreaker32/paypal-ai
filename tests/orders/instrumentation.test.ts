import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { register } from '@/instrumentation';
import { isPollerRunning, stopPoller } from '@/lib/orders/poller';
import { setPayPalForServices } from '@/lib/services';
import { createFakePayPal } from '@/lib/paypal/fake';
import { tempDbPath } from '../helpers/temp-db';

describe('instrumentation register()', () => {
  const saved = { runtime: process.env.NEXT_RUNTIME, test: process.env.SHELFIE_TEST, db: process.env.DATABASE_PATH };
  beforeEach(() => {
    process.env.DATABASE_PATH = tempDbPath('instr');
  });
  afterEach(() => {
    stopPoller();
    for (const [k, v] of [['NEXT_RUNTIME', saved.runtime], ['SHELFIE_TEST', saved.test], ['DATABASE_PATH', saved.db]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.restoreAllMocks();
  });

  it('does nothing in tests or outside the Node runtime', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    process.env.SHELFIE_TEST = '1';
    await register();
    process.env.NEXT_RUNTIME = 'edge';
    delete process.env.SHELFIE_TEST;
    await register();
    expect(isPollerRunning()).toBe(false);
  });

  it('logs one warning and keeps the server up when PayPal credentials are missing', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    delete process.env.SHELFIE_TEST;
    const savedId = process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_ID;
    setPayPalForServices(undefined);
    onTestFinished(() => {
      if (savedId !== undefined) process.env.PAYPAL_CLIENT_ID = savedId;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(register()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('Order poller not started');
    expect(isPollerRunning()).toBe(false);
  });

  it('starts the poller once PayPal is wired', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    delete process.env.SHELFIE_TEST;
    setPayPalForServices(createFakePayPal());
    await register();
    expect(isPollerRunning()).toBe(true);
  });
});
