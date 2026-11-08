'use client';

import { createContext, useContext, useEffect, useRef, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import './assistant-shell.css';

export type OrderCtaShown = 'hero' | 'compact' | null;

/** Which order button shows from 1024 px: exactly one, and neither while the assistant is docked. */
export function orderCtaShown({ docked, heroInView }: { docked: boolean; heroInView: boolean }): OrderCtaShown {
  if (docked) return null;
  return heroInView ? 'hero' : 'compact';
}

export interface OrderCtaValue {
  /** `Order with an assistant`, or `Ask the assistant` for a shop not taking orders. */
  title: string;
  takesOrders: boolean;
  shown: OrderCtaShown;
  onOpen: () => void;
  setHeroInView: (inView: boolean) => void;
  heroButtonRef: RefObject<HTMLButtonElement | null>;
  compactButtonRef: RefObject<HTMLButtonElement | null>;
}

export const OrderCtaContext = createContext<OrderCtaValue | null>(null);

const AGENT_DOOR_LINK = 'press-text font-semibold text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink';

/**
 * The hero's order button, at the right end of the shop's name row from 1024 px. The wrapper stays mounted while the
 * buttons inside hide, so its IntersectionObserver keeps saying whether the hero is on screen (and an open dock frees
 * the row's width for the name).
 */
export function HeroOrderCta() {
  const cta = useContext(OrderCtaContext);
  const wrapper = useRef<HTMLDivElement>(null);
  const setHeroInView = cta?.setHeroInView;

  useEffect(() => {
    const el = wrapper.current;
    if (!el || !setHeroInView || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setHeroInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [setHeroInView]);

  if (!cta) return null;
  return (
    <div ref={wrapper} data-hero-cta="" className="hidden shrink-0 lg:block">
      {cta.shown !== null && (
        <div className={cn('flex flex-col items-end gap-2', cta.shown !== 'hero' && 'invisible')}>
          <Button ref={cta.heroButtonRef} size="lg" onClick={cta.onOpen}>
            {cta.title}
            {cta.takesOrders && <span className="font-medium text-surface/75"> · PayPal</span>}
          </Button>
          <p className="type-meta text-right text-ink-muted">
            Or connect your own assistant to the{' '}
            <a href="#agent-door" className={AGENT_DOOR_LINK}>
              agent door
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The same action once the hero has scrolled out: a compact button at the right end of the sticky section-tabs row.
 * `row` is for a shop without tabs: the sticky row exists only for this button, takes no space in the page (so nothing
 * shifts when it fades in) and has no surface of its own until it shows.
 */
export function CompactOrderCta({ row = false }: { row?: boolean }) {
  const cta = useContext(OrderCtaContext);
  if (!cta || cta.shown === null) return null;
  const show = cta.shown === 'compact';
  const button = (
    <Button ref={cta.compactButtonRef} size="md" onClick={cta.onOpen} className="shrink-0">
      {cta.title}
    </Button>
  );
  if (!row) {
    return (
      <div data-compact-cta="" data-shown={show || undefined} className="compact-order-cta hidden shrink-0 lg:block">
        {button}
      </div>
    );
  }
  return (
    <div className="sticky top-0 z-(--z-header) -mb-6 hidden h-0 lg:block">
      <div data-compact-cta="" data-shown={show || undefined} className="compact-order-cta absolute inset-x-0 top-0 flex min-h-(--shop-tabs-h) items-center justify-end border-b border-line bg-surface">
        {button}
      </div>
    </div>
  );
}
