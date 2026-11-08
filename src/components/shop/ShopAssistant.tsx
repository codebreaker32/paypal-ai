'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { AssistantShell } from './AssistantShell';
import { useBuyerConsole } from './BuyerConsole';
import { OrderCtaContext, orderCtaShown } from './OrderCta';

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

const setAssistantParam = (on: boolean) => {
  const url = new URL(window.location.href);
  if (on) url.searchParams.set('assistant', '1');
  else url.searchParams.delete('assistant');
  window.history.replaceState(window.history.state, '', url);
};

/**
 * The shop page layout and its one primary action, **Order with an assistant** (**Ask the assistant** while the shop
 * doesn't take orders). The console opens in one `AssistantShell`: a bottom sheet on phones, a side sheet from 640 px
 * and a dock from 1024 px, so the menu and the conversation stay side by side.
 */
export function ShopAssistant({ slug, shopName, starters, initiallyOpen, cover, intro, menu, door, takesOrders }: ShopAssistantProps) {
  const title = takesOrders ? 'Order with an assistant' : 'Ask the assistant';
  const api = useBuyerConsole(slug);
  const [open, setOpen] = useState(initiallyOpen);
  const isDesktop = useIsDesktop();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const heroButtonRef = useRef<HTMLButtonElement>(null);
  const compactButtonRef = useRef<HTMLButtonElement>(null);
  const orderBarRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const panelOpen = open && isDesktop !== false;

  const [heroInView, setHeroInView] = useState(true);
  const shown = orderCtaShown({ docked: panelOpen, heroInView });

  const show = useCallback(() => {
    setOpen(true);
    setAssistantParam(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
    setAssistantParam(false);
  }, []);

  // Desktop: put the cursor in the message box on opening; on closing, back on the order button that is showing now.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (isDesktop && open && !wasOpen.current) inputRef.current?.focus();
    if (isDesktop && !open && wasOpen.current) (heroInView ? heroButtonRef : compactButtonRef).current?.focus();
    wasOpen.current = open;
  }, [open, isDesktop, heroInView]);

  const cta = useMemo(
    () => ({ title, takesOrders, shown, onOpen: show, setHeroInView, heroButtonRef, compactButtonRef }),
    [title, takesOrders, shown, show],
  );

  const shell = <AssistantShell api={api} title={title} titleId={titleId} titleRef={titleRef} shopName={shopName} starters={starters} inputRef={inputRef} takesOrders={takesOrders} onClose={hide} />;

  return (
    <>
      <OrderCtaContext.Provider value={cta}>
        {cover}
        <div data-page-frame="" className="mx-auto w-full max-w-page px-gutter pt-6 pb-10 lg:pt-8 lg:pb-section">
          <div className="@container/shop flex min-w-0 flex-col gap-8">
            {intro}
            {menu}
            {door}
          </div>
        </div>
      </OrderCtaContext.Provider>

      {/* Under 1024 px: the order bar sticks to the bottom of the screen while the page scrolls. */}
      <div data-order-bar className="sticky bottom-0 z-(--z-header) border-t border-line bg-surface px-gutter pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(var(--ink-rgb)/0.18)] lg:hidden">
        {/* "PayPal" on the bar, so a buyer sees how they'll pay before tapping (only when the shop takes orders). */}
        <div className="mx-auto w-full sm:max-w-md">
          <Button ref={orderBarRef} size="lg" fullWidth onClick={show}>
            {title}
            {takesOrders && <span className="font-medium text-surface/75 max-[24.375rem]:hidden"> · PayPal</span>}
          </Button>
        </div>
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
