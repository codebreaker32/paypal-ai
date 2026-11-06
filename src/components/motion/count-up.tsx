'use client';

import { useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { formatUSD } from '@/lib/domain/money';
import { cn } from '@/lib/utils';
import { finishCount, startCount, type FrameClock } from './count-up-step';
import { useIsoLayoutEffect } from './use-iso-layout-effect';

const browserClock: FrameClock = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export interface CountUpProps {
  /** The amount to show, in integer cents. */
  cents: number;
  /** Formats cents for display. Defaults to formatUSD ("$12.50"). Pass it only from a client component. */
  format?: (cents: number) => string;
  className?: string;
}

/**
 * A total that counts from its previous value to a new one (360 ms, ease-out). The first render shows the value as is.
 * The final text is always in the DOM and is the accessible text; the running count is an aria-hidden overlay that
 * exists only while it counts, and the wrapper is aria-live="off" so nothing is announced per frame. Reduced motion
 * shows the final value at once.
 */
export function CountUp({ cents, format = formatUSD, className }: CountUpProps) {
  const reduce = useReducedMotion();
  const finalRef = useRef<HTMLSpanElement>(null);
  const tweenRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(cents);
  const formatRef = useRef(format);

  useIsoLayoutEffect(() => {
    formatRef.current = format;
  }, [format]);

  // A layout effect, not a passive one: React commits the new total into the final span, and this hides it and puts the
  // old value in the overlay before the browser paints. With useEffect, an update that isn't user input (a poll) could
  // paint the new total for a frame, then jump back to the old one and count.
  useIsoLayoutEffect(() => {
    const finalEl = finalRef.current;
    const tweenEl = tweenRef.current;
    if (!finalEl || !tweenEl) return;
    const targets = { final: finalEl, tween: tweenEl };
    const from = shownRef.current;
    if (from === cents || reduce) {
      shownRef.current = cents;
      finishCount(targets);
      return;
    }
    return startCount(targets, from, cents, (c) => formatRef.current(c), browserClock, (value) => {
      shownRef.current = value;
    });
  }, [cents, reduce]);

  return (
    <span data-slot="count-up" aria-live="off" className={cn('relative inline-grid type-figures', className)}>
      <span ref={finalRef} className="[grid-area:1/1]">
        {format(cents)}
      </span>
      <span ref={tweenRef} aria-hidden="true" className="[grid-area:1/1] empty:hidden" />
    </span>
  );
}
