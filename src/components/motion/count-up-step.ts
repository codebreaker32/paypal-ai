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
