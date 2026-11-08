'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { AssistantShell } from './AssistantShell';
import { useBuyerConsole } from './BuyerConsole';

const DESKTOP = '(min-width: 1024px)';
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(DESKTOP);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
/** true / false in the browser, null while server-rendering and hydrating. */
function useIsDesktop(): boolean | null {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => null);
}

export interface ShopAssistantProps {
  slug: string;
  shopName: string;
  starters: string[];
  /** `?assistant=1`: open the console on load. */
  initiallyOpen: boolean;
  /** Full-width cover above the page grid (null when the shop has no photos). */
  cover?: ReactNode;
  intro: ReactNode;
  menu: ReactNode;
  door: ReactNode;
  /** `takesOrders(shop)`: false for a paused shop or one with nowhere to be paid, where the assistant only answers questions. */
  takesOrders: boolean;
}

const ORDER = {
  title: 'Order with an assistant',
  pitch: 'Tell an assistant what you’d like. It checks the order with you and hands payment to PayPal.',
};
const ASK = {
  title: 'Ask the assistant',
  pitch: 'Not taking orders right now. An assistant can still answer questions about the menu.',
};

/**
 * The shop page layout and its one primary action, **Order with an assistant** (**Ask the assistant** while the shop
 * doesn't take orders). The console opens in one `AssistantShell`: a bottom sheet on phones, a side sheet from 640 px
 * and a dock from 1024 px, so the menu and the conversation stay side by side.
 */
export function ShopAssistant({ slug, shopName, starters, initiallyOpen, cover, intro, menu, door, takesOrders }: ShopAssistantProps) {
  const { title, pitch } = takesOrders ? ORDER : ASK;
  const api = useBuyerConsole(slug);
  const [open, setOpen] = useState(initiallyOpen);
  const isDesktop = useIsDesktop();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const orderBarRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const panelOpen = open && isDesktop !== false;

  const setUrl = (on: boolean) => {
    const url = new URL(window.location.href);
    if (on) url.searchParams.set('assistant', '1');
    else url.searchParams.delete('assistant');
    window.history.replaceState(window.history.state, '', url);
  };
  const show = () => {
    setOpen(true);
    setUrl(true);
  };
  const hide = useCallback(() => {
    setOpen(false);
    setUrl(false);
  }, []);

  // Desktop: the panel replaces the card in place, so put the cursor in the message box (and back on close).
  const wasOpen = useRef(open);
  useEffect(() => {
    if (isDesktop && open && !wasOpen.current) inputRef.current?.focus();
    if (isDesktop && !open && wasOpen.current) openerRef.current?.focus();
    wasOpen.current = open;
  }, [open, isDesktop]);

  const shell = <AssistantShell api={api} title={title} titleId={titleId} titleRef={titleRef} shopName={shopName} starters={starters} inputRef={inputRef} takesOrders={takesOrders} onClose={hide} />;

  return (
    <>
      {cover}
      <div data-page-frame="" className="mx-auto grid w-full max-w-page items-start gap-8 px-gutter pt-6 pb-10 lg:grid-cols-12 lg:gap-10 lg:pt-8 lg:pb-section">
        <div className={cn('flex min-w-0 flex-col gap-8', panelOpen ? 'lg:col-span-12' : 'lg:col-span-8')}>
          {intro}
          {menu}
          {door}
        </div>

        {!panelOpen && (
          <aside aria-label={title} className="hidden lg:sticky lg:top-6 lg:col-span-4 lg:block">
            <Card className="flex flex-col gap-4 shadow-md" padding="lg">
              <h2 className="type-title">{title}</h2>
              <p className="text-ink-soft">{pitch}</p>
              <Button ref={openerRef} size="lg" fullWidth onClick={show}>
                {title}
              </Button>
              <p className="type-meta text-ink-muted">
                Or connect your own assistant to the{' '}
                <a href="#agent-door" className="press-text font-semibold text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">
                  agent door
                </a>
                .
              </p>
            </Card>
          </aside>
        )}
      </div>

      {/* Phones: the order bar sticks to the bottom of the screen while the page scrolls. */}
      <div data-order-bar className="sticky bottom-0 z-(--z-header) border-t border-line bg-surface px-gutter pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(var(--ink-rgb)/0.18)] lg:hidden">
        {/* "PayPal" on the bar, so a buyer sees how they'll pay before tapping (only when the shop takes orders). */}
        <Button ref={orderBarRef} size="lg" fullWidth onClick={show}>
          {title}
          {takesOrders && <span className="font-medium text-surface/75 max-[24.375rem]:hidden"> · PayPal</span>}
        </Button>
      </div>

      {/* Docked from 1024 px (hidden by CSS below that, so a `?assistant=1` load never flashes a dock on a phone). */}
      {panelOpen && (
        <aside data-assistant-dock="" aria-labelledby={titleId} className="assistant-dock">
          {shell}
        </aside>
      )}

      {isDesktop === false && (
        <Sheet bare labelledBy={titleId} open={open} onClose={hide} className="assistant-sheet text-ink" initialFocusRef={titleRef} fallbackFocusRef={orderBarRef}>
          {shell}
        </Sheet>
      )}
    </>
  );
}
