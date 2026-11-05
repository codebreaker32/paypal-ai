// The review screen's save queue, without React (useAutosave wraps it). Edits are batched: typing
// waits for a pause, taps save at once, and saves run one at a time.
// - A failure worth retrying (network, 5xx) keeps its edits for Retry; newer edits win.
// - The item batch and the shop patch are sent independently, so one being refused never drops the other.
// - A save the server refuses (4xx) is dropped. Its message stays up until the seller edits again,
//   and once nothing else is waiting, onRejected asks the screen to show the server's version,
//   so it never keeps showing edits that were not saved.
import { ApiError, type ItemUpdate, type ShopPatch } from './api';
import { mergeUpdates } from './review-model';

export type SaveState = { status: 'idle' | 'pending' | 'saving' | 'saved' } | { status: 'error'; message: string; retryable: boolean };

export interface SaveQueueOptions {
  saveItems: (updates: ItemUpdate[]) => Promise<unknown>;
  saveShop: (patch: ShopPatch) => Promise<unknown>;
  onState: (s: SaveState) => void;
  onRejected?: () => void;
  typingDelayMs?: number;
}

export interface SaveQueue {
  queueItem(u: ItemUpdate, opts?: { immediate?: boolean }): void;
  queueShop(p: ShopPatch): void;
  /** Saves everything waiting now; rejects if that save fails. */
  flush(): Promise<void>;
  hasPending(): boolean;
  /** Replaces onRejected (React passes a fresh callback from an effect). */
  setOnRejected(fn: (() => void) | undefined): void;
}

const TYPING_DELAY_MS = 700;

/** Network errors and 5xx are worth retrying; any other 4xx is the server refusing the save. */
const isRetryable = (e: unknown) => !(e instanceof ApiError) || e.code === 'NETWORK' || e.status >= 500;

export function createSaveQueue(o: SaveQueueOptions): SaveQueue {
  let items = new Map<string, ItemUpdate>();
  let shop: ShopPatch = {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let state: SaveState = { status: 'idle' };
  let refused: string | null = null; // the message of a refused save, until the seller edits again
  let resync = false;
  let onRejected = o.onRejected;

  const set = (s: SaveState) => {
    state = s;
    o.onState(s);
  };
  const hasPending = () => items.size > 0 || Object.keys(shop).length > 0;

  function flush(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = null;
    const run = chain.then(async () => {
      if (!hasPending()) return;
      const updates = [...items.values()];
      const patch = shop;
      items = new Map();
      shop = {};
      set({ status: 'saving' });
      // The item batch and the shop patch are sent independently: one being refused never drops the other.
      const both = updates.length > 0 && Object.keys(patch).length > 0;
      const failures: { error: unknown; label: string; requeue: () => void }[] = [];
      if (updates.length) {
        try {
          await o.saveItems(updates);
        } catch (error) {
          failures.push({
            error,
            label: 'Your item changes were not saved',
            // Newer edits made meanwhile win.
            requeue: () => {
              for (const u of updates) items.set(u.itemId, mergeUpdates(u, items.get(u.itemId) ?? { itemId: u.itemId }));
            },
          });
        }
      }
      if (Object.keys(patch).length) {
        try {
          await o.saveShop(patch);
        } catch (error) {
          failures.push({ error, label: 'Your shop details were not saved', requeue: () => (shop = { ...patch, ...shop }) });
        }
      }
      if (!failures.length) {
        set(hasPending() ? { status: 'pending' } : refused ? { status: 'error', message: refused, retryable: false } : { status: 'saved' });
        return;
      }
      const messages: string[] = [];
      const refusedMessages: string[] = [];
      let retryable = false;
      for (const f of failures) {
        const text = f.error instanceof Error ? f.error.message : String(f.error);
        // With both kinds in one save, say which one failed.
        const labelled = both ? `${f.label}: ${text}` : text;
        messages.push(labelled);
        if (isRetryable(f.error)) {
          // Keep the changes so Retry sends them again.
          f.requeue();
          retryable = true;
        } else {
          refusedMessages.push(labelled);
          resync = true;
        }
      }
      const message = messages.join(' ');
      // Only what the server refused stays up; a retryable failure is resent and clears itself.
      if (refusedMessages.length) refused = refusedMessages.join(' ');
      set({ status: 'error', message, retryable });
      throw failures[0].error;
    });
    chain = run
      .catch(() => {})
      .then(() => {
        if (resync && !hasPending()) {
          resync = false;
          onRejected?.();
        }
      });
    return run;
  }

  function schedule(immediate: boolean) {
    refused = null;
    if (state.status !== 'saving') set({ status: 'pending' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush().catch(() => {}), immediate ? 0 : (o.typingDelayMs ?? TYPING_DELAY_MS));
  }

  return {
    queueItem(u, opts = {}) {
      items.set(u.itemId, mergeUpdates(items.get(u.itemId), u));
      schedule(Boolean(opts.immediate));
    },
    queueShop(p) {
      shop = { ...shop, ...p };
      schedule(false);
    },
    flush,
    hasPending,
    setOnRejected(fn) {
      onRejected = fn;
    },
  };
}
