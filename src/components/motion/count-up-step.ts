/** How long a total takes to count to its new value: the slow motion token (`--duration-slow`). */
export const COUNT_UP_MS = 360;

/** Exponential-feeling ease-out (cubic), close to `--ease-out`: quick start, gentle landing on the final value. */
export function easeOutCount(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * The amount to show `progress` (0..1, linear time) of the way from `from` to `to`, in whole cents.
 * Eases out, never passes either end, and lands exactly on `to` at 1 (or on a bad progress value).
 */
export function stepCents(from: number, to: number, progress: number): number {
  if (!(progress < 1)) return to;
  if (progress <= 0) return from;
  const value = from + (to - from) * easeOutCount(progress);
  // Round toward `from` so the count never reaches `to` before the end and never overshoots.
  return to >= from ? Math.floor(value) : Math.ceil(value);
}

/** The two spans a count drives: the final text (hidden while counting) and the aria-hidden running overlay. */
export interface CountTargets {
  final: { style: { opacity: string } };
  tween: { textContent: string | null };
}

/** requestAnimationFrame and the clock, injectable for tests. */
export interface FrameClock {
  now(): number;
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

/** Ends a count: the overlay empties and the final text shows again. */
export function finishCount(t: CountTargets): void {
  t.tween.textContent = '';
  t.final.style.opacity = '';
}

/**
 * Counts from `from` to `to`. The setup is synchronous, so a caller in a layout effect hides the new text and shows the
 * old value before the browser paints: the first frame on screen is never the new total. Each frame reports the value
 * shown through `onValue`. Returns a stop function that cancels the next frame and leaves the overlay as it is, so a
 * new count can carry on from the value on screen.
 */
export function startCount(
  t: CountTargets,
  from: number,
  to: number,
  format: (cents: number) => string,
  clock: FrameClock,
  onValue: (cents: number) => void,
): () => void {
  t.final.style.opacity = '0';
  t.tween.textContent = format(from);
  const start = clock.now();
  let frame = 0;
  const tick = (now: number) => {
    const progress = (now - start) / COUNT_UP_MS;
    const value = stepCents(from, to, progress);
    onValue(value);
    t.tween.textContent = format(value);
    if (progress < 1) frame = clock.request(tick);
    else finishCount(t);
  };
  frame = clock.request(tick);
  return () => clock.cancel(frame);
}
