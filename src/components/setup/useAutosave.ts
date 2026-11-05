'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, patchItems, patchShop, type ItemUpdate, type ShopPatch } from './api';
import { mergeUpdates } from './review-model';

export type SaveState = { status: 'idle' | 'pending' | 'saving' | 'saved' } | { status: 'error'; message: string; retryable: boolean };

const TYPING_DELAY_MS = 700;

/**
 * Queues the seller's edits and saves them in the background: typing waits for a pause, taps
 * (Looks right, Ask in person) save at once. Saves run one at a time; a failed save that can be
 * retried keeps its changes for the next try, and `flush()` lets Publish wait for everything.
 */
export function useAutosave(shopId: string) {
  const items = useRef(new Map<string, ItemUpdate>());
  const shop = useRef<ShopPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const [state, setState] = useState<SaveState>({ status: 'idle' });

  const hasPending = () => items.current.size > 0 || Object.keys(shop.current).length > 0;

  const saveNow = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const run = chain.current.then(async () => {
      if (!hasPending()) return;
      const updates = [...items.current.values()];
      const patch = shop.current;
      items.current = new Map();
      shop.current = {};
      setState({ status: 'saving' });
      try {
        if (updates.length) await patchItems(shopId, updates);
        if (Object.keys(patch).length) await patchShop(shopId, patch);
        setState({ status: hasPending() ? 'pending' : 'saved' });
      } catch (e) {
        const retryable = !(e instanceof ApiError) || e.code === 'NETWORK' || e.status >= 500;
        if (retryable) {
          // Keep the changes (newer edits made meanwhile win) so Retry sends them again.
          for (const u of updates) items.current.set(u.itemId, mergeUpdates(u, items.current.get(u.itemId) ?? { itemId: u.itemId }));
          shop.current = { ...patch, ...shop.current };
        }
        setState({ status: 'error', message: e instanceof Error ? e.message : String(e), retryable });
        throw e;
      }
    });
    chain.current = run.catch(() => {});
    return run;
  }, [shopId]);

  const schedule = useCallback(
    (immediate: boolean) => {
      setState((s) => (s.status === 'saving' ? s : { status: 'pending' }));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveNow().catch(() => {}), immediate ? 0 : TYPING_DELAY_MS);
    },
    [saveNow],
  );

  const queueItem = useCallback(
    (u: ItemUpdate, opts: { immediate?: boolean } = {}) => {
      items.current.set(u.itemId, mergeUpdates(items.current.get(u.itemId), u));
      schedule(Boolean(opts.immediate));
    },
    [schedule],
  );

  const queueShop = useCallback(
    (p: ShopPatch) => {
      shop.current = { ...shop.current, ...p };
      schedule(false);
    },
    [schedule],
  );

  // Leaving the tab (or the phone locking) saves what's waiting.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && hasPending()) void saveNow().catch(() => {});
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [saveNow]);

  return { state, queueItem, queueShop, flush: saveNow };
}
