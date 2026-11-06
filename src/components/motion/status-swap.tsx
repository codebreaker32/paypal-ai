'use client';

import type { ReactNode, Ref } from 'react';
import { AnimatePresence, m, useIsPresent, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { EASE_OUT, MOTION_S } from './tokens';

export interface StatusSwapProps {
  /** The state the children show ("PAID", "SHIPPED"). A new value crossfades the new children in. */
  value: string;
  className?: string;
  children: ReactNode;
}

/**
 * Crossfades a status to its next state with a 4 px rise (220 ms). The leaving copy pops out of the layout at once, so
 * nothing shifts, and is hidden from screen readers while it fades. Reduced motion swaps instantly.
 */
export function StatusSwap({ value, className, children }: StatusSwapProps) {
  const reduce = useReducedMotion();
  return (
    <span data-slot="status-swap" className={cn('relative inline-flex', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <SwapItem key={value} instant={!!reduce}>
          {children}
        </SwapItem>
      </AnimatePresence>
    </span>
  );
}

interface SwapItemProps {
  /** Reduced motion: the new state renders at its final look and the old one leaves at once. */
  instant: boolean;
  children: ReactNode;
  ref?: Ref<HTMLSpanElement>;
}

// The same element tree with and without reduced motion (only the timing differs), so hydration always matches.
function SwapItem({ instant, children, ref }: SwapItemProps) {
  const present = useIsPresent();
  return (
    <m.span
      ref={ref}
      aria-hidden={present ? undefined : true}
      data-entrance=""
      className="inline-flex"
      initial={instant ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: instant ? 0 : MOTION_S.fast, ease: EASE_OUT } }}
      transition={{ duration: MOTION_S.base, ease: EASE_OUT }}
    >
      {children}
    </m.span>
  );
}
