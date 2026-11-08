/*
 * A one-shot timer that stops counting while anything holds it. No DOM or React here: a toast holds it for the pointer
 * over it and for focus inside it, and it only runs again once each has let go.
 */

export interface PausableTimer {
  start: () => void;
  /** Stops the count for `reason` (say 'hover' or 'focus'). */
  hold: (reason: string) => void;
  /** Ends that hold; the remaining time runs once no hold is left. */
  release: (reason: string) => void;
  /** Cancels for good (the toast went away). */
  stop: () => void;
}

export function createPausableTimer(onFire: () => void, ms: number): PausableTimer {
  let remaining = ms;
  let started = false;
  let over = false;
  let runningSince: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const holds = new Set<string>();

  const run = () => {
    if (!started || over || holds.size > 0 || runningSince !== null) return;
    runningSince = Date.now();
    timer = setTimeout(() => {
      runningSince = null;
      over = true;
      onFire();
    }, remaining);
  };

  const pause = () => {
    if (runningSince === null) return;
    clearTimeout(timer);
    remaining -= Date.now() - runningSince;
    runningSince = null;
  };

  return {
    start() {
      started = true;
      run();
    },
    hold(reason) {
      holds.add(reason);
      pause();
    },
    release(reason) {
      holds.delete(reason);
      run();
    },
    stop() {
      clearTimeout(timer);
      runningSince = null;
      over = true;
    },
  };
}
