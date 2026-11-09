'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { usePrefersReducedMotion } from '@/components/motion/use-prefers-reduced-motion';

/**
 * Drives a staged animation, such as the hero's paper -> shop -> assistant -> paid story.
 *
 * `durations[i]` is how long stage `i` holds, in ms; pass a module constant, because a new array restarts it. The sequence loops while the element is on screen and the tab is
 * visible, and pauses otherwise. Under reduced motion it shows the last stage and never advances, so the last stage must
 * be a complete picture. The server and first paint also show the last stage: nothing is hidden before hydration.
 * `?still` in the URL holds the last stage, for full-page screenshots.
 *
 * Returns the ref for the element to watch and the current stage.
 */
export function useSequence<E extends HTMLElement>(durations: readonly number[]): { ref: RefObject<E | null>; stage: number; playing: boolean } {
  const last = durations.length - 1;
  const reduced = usePrefersReducedMotion();
  const ref = useRef<E | null>(null);
  const [stage, setStage] = useState(last);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (reduced || !element || new URLSearchParams(window.location.search).has('still')) {
      setPlaying(false);
      setStage(last);
      return;
    }

    let current = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onScreen = false;
    let left = durations[0];
    let startedAt = 0;

    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      clear();
      if (!onScreen || document.hidden) return;
      startedAt = performance.now();
      timer = setTimeout(() => {
        current = current === last ? 0 : current + 1;
        left = durations[current];
        setStage(current);
        schedule();
      }, left);
    };
    const pause = () => {
      if (timer === undefined) return;
      left = Math.max(0, left - (performance.now() - startedAt));
      clear();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) schedule();
        else pause();
      },
      { threshold: 0.2 },
    );
    const onVisibility = () => (document.hidden ? pause() : schedule());

    setStage(0);
    setPlaying(true);
    observer.observe(element);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clear();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [durations, last, reduced]);

  return { ref, stage, playing };
}
