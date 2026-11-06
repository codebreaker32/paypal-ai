'use client';

import type { ReactNode } from 'react';
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';

/**
 * Mount once (the root layout does). Loads Motion's DOM animation features lazily and in strict mode, so components
 * must use `m.div` (from 'motion/react'), never `motion.div`, which would pull the full bundle in. `reducedMotion="user"`
 * drops transform animations for people who ask the OS for less motion; opacity fades stay.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
