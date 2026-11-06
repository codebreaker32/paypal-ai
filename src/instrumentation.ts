// Runs once when the Next.js server starts: starts the order poller (spec §7, polling fallback).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.SHELFIE_TEST) return;
    try {
      const [{ getOrderDeps }, { startPoller }] = await Promise.all([import('@/lib/services'), import('@/lib/orders/poller')]);
      try {
        startPoller(getOrderDeps());
      } catch (e) {
        // PayPal not configured yet (or no database): the app still serves pages; orders sync via the return URL.
        // Next dev reloads .env without running register() again, so keep trying (startPoller is idempotent).
        console.warn(`[shelfie] Order poller not started: ${e instanceof Error ? e.message : String(e)} Retrying every 15 s.`);
        const retry = setInterval(() => {
          try {
            startPoller(getOrderDeps());
          } catch {
            return;
          }
          clearInterval(retry);
          console.info('[shelfie] Order poller started.');
        }, 15_000);
        retry.unref?.();
      }
    } catch (e) {
      console.warn(`[shelfie] Order poller not started: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
