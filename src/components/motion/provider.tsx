'use client';

import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import { loadWithRetry, showHiddenEntrances, whenStreamSettled } from './load-features';

// domAnimation (animations, variants, exit, gestures, in-view) is fetched after the page's first JavaScript, so it stays
// out of the critical path. Until it arrives, `m` elements render their initial state; server HTML is never hidden.
// It is fetched only once the streamed page has settled (whenStreamSettled): its arrival updates LazyMotion's context,
// and that update must not reach a Suspense boundary still waiting for its server content.
// A failed fetch is retried once; if that fails too, the page shows whatever an entrance was holding hidden.
const loadFeatures = () =>
  whenStreamSettled().then(() => loadWithRetry(() => import('./features').then((mod) => mod.default), showHiddenEntrances));

/**
 * Mount once (the root layout does). Loads Motion's DOM animation features lazily and in strict mode, so components
 * must use `m.div` (from 'motion/react'), never `motion.div`, which would pull the full bundle in. `reducedMotion="user"`
 * drops transform animations for people who ask the OS for less motion; opacity fades stay.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
