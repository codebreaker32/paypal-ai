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

/**
 * True while the server-rendered HTML still holds a Suspense boundary that hasn't been revealed: React marks one with a
 * `<!--$?-->` comment (still streaming) or `<!--$~-->` (streamed, its reveal queued; React 19.2+ batches reveals).
 */
export function hasPendingBoundary(doc: Document): boolean {
  const walker = doc.createTreeWalker(doc.body ?? doc, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Comment).data;
    if (data === '$?' || data === '$~') return true;
  }
  return false;
}

/**
 * Resolves once the page has finished streaming and every Suspense boundary in it is revealed ('settled'), or after
 * `timeout` ms ('timeout'). LazyMotion re-renders its context when the features arrive; if that update reaches a boundary
 * React hasn't hydrated because the server's content is still pending (a route's loading.tsx), React client-renders the
 * boundary and the server's copy stays in the page in a hidden `<div id="S:0">`: two of everything (the dashboard's two
 * tab panels). Loading the features after this keeps hydration intact.
 */
export function whenStreamSettled<D extends { readyState: DocumentReadyState }>(
  doc: D | undefined = typeof document === 'undefined' ? undefined : (document as unknown as D),
  { hasPending = hasPendingBoundary as unknown as (d: D) => boolean, interval = 50, timeout = 5000 } = {},
): Promise<'settled' | 'timeout'> {
  if (!doc) return Promise.resolve('settled');
  const settled = () => doc.readyState === 'complete' && !hasPending(doc);
  if (settled()) return Promise.resolve('settled');
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      if (settled()) resolve('settled');
      else if (Date.now() - started >= timeout) resolve('timeout');
      else setTimeout(check, interval);
    };
    setTimeout(check, interval);
  });
}

/** Marks the page so globals.css shows everything an entrance would have kept hidden (see `html[data-motion-off]`). */
export function showHiddenEntrances(): void {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-motion-off', '');
}
