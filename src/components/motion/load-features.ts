/**
 * Runs `load` and, if it fails (a chunk that didn't arrive on a flaky network), once more. If the retry fails too it
 * calls `giveUp` and returns a promise that never settles: LazyMotion then keeps rendering `m` elements statically
 * instead of throwing an unhandled rejection, and `giveUp` is where the page makes hidden content visible.
 */
export function loadWithRetry<T>(load: () => Promise<T>, giveUp: () => void): Promise<T> {
  return load()
    .catch(() => load())
    .catch(() => {
      giveUp();
      return new Promise<T>(() => {});
    });
}

/** Marks the page so globals.css shows everything an entrance would have kept hidden (see `html[data-motion-off]`). */
export function showHiddenEntrances(): void {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-motion-off', '');
}
