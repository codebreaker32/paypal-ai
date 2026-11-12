// Polling fallback: every 15 s, sync open orders under 3 h old, plus the expiry sweep.
import * as ordersRepo from '@/lib/db/repos/orders';
import { lastCaptureFailure, syncOrder, type OrderDeps } from './service';

export const POLL_WINDOW_MS = 3 * 60 * 60_000;

/**
 * One pass: open orders created in the last 3 h, plus any older order past its expiry that is still waiting for
 * approval or holds a refused capture (both settle on that sync).
 */
export async function pollOnce(deps: OrderDeps): Promise<void> {
  const nowMs = deps.now?.() ?? Date.now();
  const since = new Date(nowMs - POLL_WINDOW_MS).toISOString();
  const due = ordersRepo
    .listOpen(deps.db, new Date(0).toISOString())
    .filter(
      (o) =>
        o.createdAt >= since ||
        (Date.parse(o.expiresAt) <= nowMs &&
          (o.status === 'awaiting_approval' || (o.status === 'approved' && lastCaptureFailure(deps.db, o) !== null))),
    );
  for (const o of due) {
    try {
      await syncOrder(deps, o.id, 'poller');
    } catch (e) {
      console.warn(`[shelfie] poller could not sync order ${o.number}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

interface PollerState {
  timer: ReturnType<typeof setInterval>;
  running: boolean;
}

// On globalThis so Next dev hot reloads don't start a second poller.
const g = globalThis as unknown as { __shelfiePoller?: PollerState };

/** Starts the background poller once per process; later calls are no-ops. Returns a stop function. */
export function startPoller(deps: OrderDeps, intervalMs = 15_000): () => void {
  if (g.__shelfiePoller) return stopPoller;
  const state: PollerState = {
    running: false,
    timer: setInterval(() => {
      if (state.running) return; // a slow pass (PayPal latency) never overlaps the next one
      state.running = true;
      pollOnce(deps)
        .catch((e) => console.warn(`[shelfie] poller pass failed: ${e instanceof Error ? e.message : String(e)}`))
        .finally(() => {
          state.running = false;
        });
    }, intervalMs),
  };
  state.timer.unref?.();
  g.__shelfiePoller = state;
  return stopPoller;
}

export function stopPoller(): void {
  if (!g.__shelfiePoller) return;
  clearInterval(g.__shelfiePoller.timer);
  delete g.__shelfiePoller;
}

export const isPollerRunning = (): boolean => Boolean(g.__shelfiePoller);
