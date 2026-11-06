/** The motion tokens of globals.css (`--duration-*`, `--ease-out`) in the units Motion takes: seconds and a bezier array. */
export const MOTION_S = {
  instant: 0.09,
  fast: 0.14,
  base: 0.22,
  slow: 0.36,
} as const;

/** `--ease-out`: cubic-bezier(0.22, 1, 0.36, 1). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
