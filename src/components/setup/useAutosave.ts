'use client';

import { useEffect, useState } from 'react';
import { patchItems, patchShop } from './api';
import { createSaveQueue, type SaveState } from './save-queue';

export type { SaveState } from './save-queue';

/**
 * Queues the seller's edits and saves them in the background (see save-queue.ts): typing waits for
 * a pause, taps save at once, a failed save that can be retried keeps its changes, and `flush()`
 * lets Publish wait for everything. `onRejected` runs after the server refuses a save, once nothing
 * else is waiting, so the screen can show the server's version again.
 */
export function useAutosave(shopId: string, opts: { onRejected?: () => void } = {}) {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const [queue] = useState(() =>
    createSaveQueue({
      saveItems: (updates) => patchItems(shopId, updates),
      saveShop: (patch) => patchShop(shopId, patch),
      onState: setState,
    }),
  );
  const { onRejected } = opts;
  useEffect(() => queue.setOnRejected(onRejected), [queue, onRejected]);

  // Leaving the tab (or the phone locking) saves what's waiting.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && queue.hasPending()) void queue.flush().catch(() => {});
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [queue]);

  return { state, queueItem: queue.queueItem, queueShop: queue.queueShop, flush: queue.flush };
}
