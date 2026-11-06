'use client';

import {
  Children,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { m, useInView, type Variants } from 'motion/react';
import { cn } from '@/lib/utils';
import { EASE_OUT, MOTION_S } from './tokens';

/** Tags a Reveal, Stagger or StaggerItem can render as. */
export type MotionTag = 'div' | 'section' | 'article' | 'header' | 'footer' | 'aside' | 'ul' | 'ol' | 'li' | 'p' | 'span';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const subscribeNothing = () => () => {};

/** False while React hydrates server HTML, true for anything mounted later on the client. */
function useMountedAfterHydration(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/**
 * Content is visible by default: server HTML paints at once, also without JavaScript. Only content that is below the
 * fold when the page hydrates, or that mounts later on the client, is hidden (instantly, while out of sight) and then
 * plays its entrance as it scrolls into view.
 */
function useRevealState(ref: RefObject<Element | null>, once: boolean) {
  const clientMount = useMountedAfterHydration();
  const [initial] = useState<'hidden' | false>(clientMount ? 'hidden' : false);
  const [armed, setArmed] = useState(clientMount);
  const inView = useInView(ref, { once, margin: '0px 0px -8% 0px' });

  useIsoLayoutEffect(() => {
    const el = ref.current;
    // Below the fold at hydration: hide it before the first paint after hydration, out of sight, so it can rise in.
    if (el && el.getBoundingClientRect().top > window.innerHeight) setArmed(true);
  }, [ref]);

  useEffect(() => {
    // A repeating reveal hides again once it has been seen and leaves the viewport.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the observer's answer
    if (inView && !once) setArmed(true);
  }, [inView, once]);

  return { initial, animate: !armed || inView ? 'show' : 'hidden' } as const;
}

export interface RevealProps {
  as?: MotionTag;
  /** Seconds before the entrance starts. */
  delay?: number;
  /** How far it rises, in px. Dropped under reduced motion (only the fade stays). */
  y?: number;
  /** Play once (default), or again each time it scrolls back into view. */
  once?: boolean;
  className?: string;
  children: ReactNode;
}

/** Fades and rises in when scrolled into view (360 ms, ease-out). Use it for one block, not every section of a page. */
export function Reveal({ as = 'div', delay = 0, y = 16, once = true, className, children }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const state = useRevealState(ref, once);
  const Tag = m[as];
  const variants: Variants = {
    hidden: { opacity: 0, y, transition: { duration: 0 } },
    show: { opacity: 1, y: 0, transition: { duration: MOTION_S.slow, delay, ease: EASE_OUT } },
  };
  return (
    <Tag ref={ref as never} data-slot="reveal" className={className} variants={variants} {...state}>
      {children}
    </Tag>
  );
}

/** The longest a whole list may take to finish staggering in, in seconds: long lists close their gaps. */
const STAGGER_TOTAL_MAX = 0.4;

/** True once the Stagger has shown, so an item added later (a new order) plays its own entrance. */
const StaggerShown = createContext(false);

export interface StaggerProps {
  as?: MotionTag;
  /** Seconds between one item and the next (capped so the whole list lands within 400 ms). */
  gap?: number;
  className?: string;
  children: ReactNode;
}

/** A list whose StaggerItem children rise in one after another as it scrolls into view. */
export function Stagger({ as = 'div', gap = 0.04, className, children }: StaggerProps) {
  const ref = useRef<HTMLElement>(null);
  const state = useRevealState(ref, true);
  const [shown, setShown] = useState(false);
  const count = Math.max(1, Children.count(children));
  const Tag = m[as];
  const variants: Variants = {
    hidden: { transition: { duration: 0 } },
    show: { transition: { staggerChildren: Math.min(gap, STAGGER_TOTAL_MAX / count) } },
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- records that the list has played
    if (state.animate === 'show') setShown(true);
  }, [state.animate]);

  return (
    <StaggerShown.Provider value={shown}>
      <Tag ref={ref as never} data-slot="stagger" className={className} variants={variants} {...state}>
        {children}
      </Tag>
    </StaggerShown.Provider>
  );
}

export interface StaggerItemProps {
  as?: MotionTag;
  /** How far it rises, in px (dropped under reduced motion). */
  y?: number;
  className?: string;
  children: ReactNode;
}

/** One item of a Stagger. An item that mounts after its list has shown rises in on its own. */
export function StaggerItem({ as = 'div', y = 8, className, children }: StaggerItemProps) {
  const listShown = useContext(StaggerShown);
  const [late] = useState(listShown);
  const Tag = m[as];
  const variants: Variants = {
    hidden: { opacity: 0, y, transition: { duration: 0 } },
    show: { opacity: 1, y: 0, transition: { duration: MOTION_S.base, ease: EASE_OUT } },
  };
  return (
    <Tag
      data-slot="stagger-item"
      className={cn(className)}
      variants={variants}
      {...(late ? { initial: 'hidden', animate: 'show' } : {})}
    >
      {children}
    </Tag>
  );
}
