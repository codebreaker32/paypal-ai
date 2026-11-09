'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { AssistantShell } from './AssistantShell';
import { afterHistoryMove, isOwnEntry, withOwnMark, withoutOwnMark } from './assistant-history';
import { useBuyerConsole, type BuyerConsoleApi } from './BuyerConsole';
import { OrderCtaContext, orderCtaShown } from './OrderCta';
import { useKeyboardViewport } from './use-keyboard-viewport';

const DESKTOP = '(min-width: 1024px)';
/** Headings or tiles ending above this line are under the sticky tabs: not on screen for `keepPlace`. */
const SITE_TOP_PX = 72;
/** Scrolled less than this, the site header is still in view: the top of the page is what the buyer is looking at. */
const AT_TOP_PX = 72;
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

const assistantInUrl = () => new URL(window.location.href).searchParams.get('assistant') === '1';

/** Docked and deep-linked states rewrite the current entry; a modal opened by tap adds one, so Back closes it. */
const setAssistantParam = (on: boolean, method: 'pushState' | 'replaceState' = 'replaceState') => {
  const url = new URL(window.location.href);
  if (on) url.searchParams.set('assistant', '1');
  else url.searchParams.delete('assistant');
  const state = method === 'pushState' ? withOwnMark(window.history.state) : withoutOwnMark(window.history.state);
  // The browser's own method, not Next's patch of it: on a section tab's entry (no state) the patch would write a state
  // that makes Next reload the page when the buyer comes back to that entry.
  History.prototype[method].call(window.history, state, '', url);
};

const focusAtEnd = (input: HTMLInputElement | null) => {
  input?.focus();
  input?.setSelectionRange(input.value.length, input.value.length);
};

const canTakeFocus = (el: HTMLElement | null): el is HTMLElement => !!el?.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible';

/**
 * Docking narrows the page and re-flows the menu, so a change of `open` runs through this from 1024 px: the first
 * heading or tile still on screen stays where it was.
 */
function keepPlace(change: () => void): void {
  if (!window.matchMedia(DESKTOP).matches) return change();
  // At the top nothing needs holding: the hero re-flows below the buyer, and scrolling would take the header away.
  if (window.scrollY < AT_TOP_PX) return flushSync(change);
  const anchor = Array.from(document.querySelectorAll('main h3, main li')).find((el) => el.getBoundingClientRect().bottom > SITE_TOP_PX);
  // Measured at its middle: a tile changes height with the tracks, and this shares that between it and the heading under it.
  const middle = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };
  const before = anchor ? middle(anchor) : undefined;
  // The browser's own scroll anchoring would correct the same shift a second time.
  const root = document.documentElement.style;
  root.overflowAnchor = 'none';
  flushSync(change);
  if (anchor?.isConnected && before !== undefined) {
    const delta = middle(anchor) - before;
    if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
  }
  requestAnimationFrame(() => root.removeProperty('overflow-anchor'));
}

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
  const heroButton = useRef<HTMLButtonElement>(null);
  const compactButton = useRef<HTMLButtonElement>(null);
  const orderBarRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const panelOpen = open && isDesktop !== false;
  useKeyboardViewport(dialogRef, open && isDesktop === false);

  const [heroInView, setHeroInView] = useState(true);
  const shown = orderCtaShown({ docked: panelOpen, heroInView });

  const opener = useRef<HTMLElement | null>(null);
  /** True while this page's open assistant sits on a history entry of its own, so closing is `history.back()`. */
  const ownEntry = useRef(false);
  /** A `history.back()` is on its way: a second close before its `popstate` would leave the shop. */
  const goingBack = useRef(false);

  const show = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    keepPlace(() => setOpen(true));
    ownEntry.current = isDesktop === false;
    setAssistantParam(true, ownEntry.current ? 'pushState' : 'replaceState');
  }, [isDesktop]);
  const hide = useCallback(() => {
    if (goingBack.current) return;
    if (ownEntry.current) {
      goingBack.current = true;
      window.history.back();
      return;
    }
    keepPlace(() => setOpen(false));
    setAssistantParam(false);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const step = afterHistoryMove({
        closing: goingBack.current,
        docked: window.matchMedia(DESKTOP).matches,
        inUrl: assistantInUrl(),
        ownMark: isOwnEntry(window.history.state),
        open,
      });
      goingBack.current = false;
      ownEntry.current = step.ownEntry;
      if (step.open !== open) keepPlace(() => setOpen(step.open));
      if (step.fixUrl) setAssistantParam(step.open);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [open]);

  // Docked, opened by the buyer: the cursor goes to the end of the message box; on closing, focus goes back to the
  // opener or, when that is gone, the order button showing now. A `?assistant=1` load moves nothing. Modal forms: `Sheet`.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (isDesktop && open && !wasOpen.current) focusAtEnd(inputRef.current);
    if (isDesktop && !open && wasOpen.current) {
      const back = opener.current;
      opener.current = null;
      [back !== document.body ? back : null, heroInView ? heroButton.current : null, compactButton.current, orderBarRef.current].find(canTakeFocus)?.focus();
    }
    wasOpen.current = open;
  }, [open, isDesktop, heroInView]);

  // The URL on arrival decides, not `initiallyOpen`: Back from a client-side link restores the page as the server first
  // sent it, while the param has come and gone without the router knowing. Set `wasOpen` so this moves no focus, as a
  // `?assistant=1` load moves none. After the effect above, which would overwrite it.
  useEffect(() => {
    const inUrl = assistantInUrl();
    ownEntry.current = inUrl && isOwnEntry(window.history.state);
    wasOpen.current = inUrl;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable after commit
    setOpen(inUrl);
  }, []);

  // A control the buyer just used in the dock can vanish with the state it changes, and focus would fall to `body`,
  // outside the panel (where Esc no longer reaches it). Sheets keep it: the keyboard stays down, the dialog holds focus.
  const stayInPanel = () => {
    if (window.matchMedia(DESKTOP).matches) focusAtEnd(inputRef.current);
  };
  const panelApi: BuyerConsoleApi = {
    ...api,
    send: (text) => {
      api.send(text);
      stayInPanel();
    },
    reset: () => {
      api.reset();
      stayInPanel();
    },
  };

  const attachHeroButton = useCallback((el: HTMLButtonElement | null) => {
    heroButton.current = el;
  }, []);
  const attachCompactButton = useCallback((el: HTMLButtonElement | null) => {
    compactButton.current = el;
  }, []);
  const cta = useMemo(
    () => ({ title, takesOrders, shown, onOpen: show, setHeroInView, attachHeroButton, attachCompactButton }),
    [title, takesOrders, shown, show, attachHeroButton, attachCompactButton],
  );

  const shell = <AssistantShell api={panelApi} title={title} titleId={titleId} titleRef={titleRef} shopName={shopName} starters={starters} inputRef={inputRef} takesOrders={takesOrders} onClose={hide} />;

  return (
    <>
      <OrderCtaContext.Provider value={cta}>
        {cover}
        <div data-page-frame="" className="mx-auto w-full max-w-page px-gutter pt-6 pb-10 lg:pt-8 lg:pb-section">
          <div className="@container/shop flex min-w-0 flex-col gap-8 transition-none @[56rem]/shop:gap-6">
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
        <aside
          data-assistant-dock=""
          aria-labelledby={titleId}
          className="assistant-dock"
          onKeyDown={(e) => {
            if (e.key === 'Escape') hide();
          }}
        >
          {shell}
        </aside>
      )}

      {isDesktop === false && (
        <Sheet bare dialogRef={dialogRef} labelledBy={titleId} open={open} onClose={hide} className="assistant-sheet text-ink" initialFocusRef={titleRef} fallbackFocusRef={orderBarRef}>
          {shell}
        </Sheet>
      )}
    </>
  );
}
