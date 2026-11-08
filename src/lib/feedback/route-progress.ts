/*
 * The timing of the top-of-page progress bar, and the rule for which link clicks start it. No DOM here: Tactile renders
 * the bar from `getPhase` and calls `begin` and `finish`.
 *
 * Nothing shows for the first DELAY_MS, so a fast page change never flashes a bar.
 */

export const PROGRESS_MS = {
  delay: 120,
  /** How long the bar takes to reach 70% once it shows. */
  run: 800,
  /** When it reaches 92%, counted from when it showed. */
  creepBy: 6000,
  /** Bar completes, then fades (all of it, inside this). */
  finish: 360,
  failsafe: 10_000,
} as const;

export type ProgressPhase = 'idle' | 'start' | 'creep' | 'finish';

export function createRouteProgress({ onSettled }: { onSettled: () => void }) {
  let phase: ProgressPhase = 'idle';
  let running = false;
  let step: ReturnType<typeof setTimeout> | undefined;
  let failsafe: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  const set = (next: ProgressPhase) => {
    phase = next;
    for (const listener of listeners) listener();
  };

  const armFailsafe = () => {
    clearTimeout(failsafe);
    failsafe = setTimeout(finish, PROGRESS_MS.failsafe);
  };

  function finish() {
    if (!running) return;
    running = false;
    clearTimeout(step);
    clearTimeout(failsafe);
    onSettled();
    if (phase === 'idle') return;
    set('finish');
    step = setTimeout(() => set('idle'), PROGRESS_MS.finish);
  }

  function begin() {
    if (running) {
      // A second link while the first is still loading: that first control is done, the bar carries on.
      onSettled();
      armFailsafe();
      return;
    }
    running = true;
    clearTimeout(step);
    if (phase !== 'idle') set('idle');
    armFailsafe();
    step = setTimeout(() => {
      set('start');
      step = setTimeout(() => set('creep'), PROGRESS_MS.run);
    }, PROGRESS_MS.delay);
  }

  return {
    begin,
    finish,
    getPhase: () => phase,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export interface LinkClick {
  /** The link's resolved address. */
  url: string;
  /** The page's address now. */
  current: string;
  target: string;
  download: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** True when this click will replace the page in this tab: a plain click to another same-origin address. */
export function startsRouteNavigation(click: LinkClick): boolean {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (click.download || (click.target !== '' && click.target !== '_self')) return false;
  try {
    const to = new URL(click.url);
    const here = new URL(click.current);
    return to.origin === here.origin && (to.pathname !== here.pathname || to.search !== here.search);
  } catch {
    return false;
  }
}
