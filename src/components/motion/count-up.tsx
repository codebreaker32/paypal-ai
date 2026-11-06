'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { formatUSD } from '@/lib/domain/money';
import { cn } from '@/lib/utils';
import { COUNT_UP_MS, stepCents } from './count-up-step';

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

  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  useEffect(() => {
    const finalEl = finalRef.current;
    const tweenEl = tweenRef.current;
    if (!finalEl || !tweenEl) return;
    const from = shownRef.current;
    const finish = () => {
      shownRef.current = cents;
      tweenEl.textContent = '';
      finalEl.style.opacity = '';
    };
    if (from === cents || reduce) {
      finish();
      return;
    }
    let frame = 0;
    const start = performance.now();
    finalEl.style.opacity = '0';
    const tick = (now: number) => {
      const progress = (now - start) / COUNT_UP_MS;
      const value = stepCents(from, cents, progress);
      shownRef.current = value;
      tweenEl.textContent = formatRef.current(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
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
