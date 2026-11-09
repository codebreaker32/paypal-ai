'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { formatUSD } from '@/lib/domain/money';
import { Sheet } from '@/components/ui/sheet';
import { AssistantShell } from './AssistantShell';
import { CartContext, type CartApi } from './cart-context';
import type { ShopCartData } from './cart';
import { CartStatus, CartView } from './CartView';
import { ItemSheet } from './ItemSheet';
import { useCartState, viewOrderLabel } from './use-cart-state';
import { useHistoryParam } from './use-history-param';
import { afterHistoryMove, isOwnEntry, urlWithPanels, withOwnMark, withoutOwnMark } from './assistant-history';
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
  /** The menu as the cart sees it, and the shop's fulfilment rules. */
  cartData?: ShopCartData;
}

const NO_CART_DATA: ShopCartData = { items: [], fulfillment: 'pickup', shippingCents: 0, pickupNotes: '', orderCapCents: 0 };

const isDocked = () => window.matchMedia(DESKTOP).matches;

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

const focusAtEnd = (input: HTMLTextAreaElement | null) => {
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  input.scrollTop = input.scrollHeight;
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
export function ShopAssistant({ slug, shopName, starters, initiallyOpen, cover, intro, menu, door, takesOrders, cartData = NO_CART_DATA }: ShopAssistantProps) {
  const title = takesOrders ? 'Order with an assistant' : 'Ask the assistant';
  const [open, setOpen] = useState(initiallyOpen);
  const isDesktop = useIsDesktop();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const heroButton = useRef<HTMLButtonElement>(null);
  const compactButton = useRef<HTMLButtonElement>(null);
  const orderBarRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const cartTitleRef = useRef<HTMLHeadingElement>(null);
  const cartDialogRef = useRef<HTMLDialogElement>(null);
  const cartTitleId = useId();
  const cart = useCartState(slug, cartData);
  const cartParam = useHistoryParam('order', isDocked);
  const dismissCart = cartParam.dismiss;
  const openCartParam = cartParam.open;
  const closeCartParam = cartParam.close;
  const cartOpen = cartParam.value !== null;
  const itemParam = useHistoryParam('item');
  const closeItemParam = itemParam.close;
  const dismissItemParam = itemParam.dismiss;
  const panelOpen = (open || cartOpen) && isDesktop !== false;
  useKeyboardViewport(dialogRef, open && isDesktop === false);
  useKeyboardViewport(cartDialogRef, cartOpen && isDesktop === false);

  const [heroInView, setHeroInView] = useState(true);
  const shown = orderCtaShown({ docked: panelOpen, heroInView });

  const opener = useRef<HTMLElement | null>(null);
  /** True while this page's open assistant sits on a history entry of its own, so closing is `history.back()`. */
  const ownEntry = useRef(false);
  /** A `history.back()` is on its way: a second close before its `popstate` would leave the shop. */
  const goingBack = useRef(false);

  const show = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    keepPlace(() => {
      if (isDocked()) dismissCart(); // one panel at a time in the dock
      setOpen(true);
    });
    ownEntry.current = isDesktop === false;
    setAssistantParam(true, ownEntry.current ? 'pushState' : 'replaceState');
  }, [isDesktop, dismissCart]);
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

  const cartOpener = useRef<HTMLElement | null>(null);
  const showCart = useCallback(() => {
    cartOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!isDocked()) {
      openCartParam('1', true);
      return;
    }
    keepPlace(() => {
      setOpen(false); // one panel at a time in the dock
      openCartParam('1', false);
    });
    setAssistantParam(false);
    ownEntry.current = false;
  }, [openCartParam]);
  const cartBusy = cart.busy;
  const hideCart = useCallback(() => {
    if (cartBusy) return; // The controls are disabled; Esc and the backdrop don't get round them.
    if (isDocked()) keepPlace(() => closeCartParam());
    else closeCartParam();
  }, [closeCartParam, cartBusy]);
  // The dock's switch: the assistant replaces the cart, nothing to go back to.
  const switchToAssistant = useCallback(() => {
    cartOpener.current = null;
    keepPlace(() => {
      dismissCart();
      setOpen(true);
    });
    setAssistantParam(true);
    ownEntry.current = false;
  }, [dismissCart]);

  const showForDraft = useCallback(() => {
    if (!open) show();
  }, [open, show]);
  const api = useBuyerConsole(slug, { takesOrders, onOpen: showForDraft });
  const { openWithDraft, draftRevision } = api;

  // An "Ask the assistant" control anywhere on the page carries `data-order-item={name}`.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const name = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-order-item]')?.dataset.orderItem : undefined;
      if (name) openWithDraft(name);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [openWithDraft]);

  // A drafted item: on the dock the cursor goes to the end of the message box, in the commit that shows the draft. In a
  // sheet focus stays on the title (`Sheet`), so the keyboard doesn't cover the menu.
  useEffect(() => {
    if (draftRevision && window.matchMedia(DESKTOP).matches) focusAtEnd(inputRef.current);
  }, [draftRevision]);

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
  const hasItems = cart.count > 0;
  const orderLabel = hasItems ? viewOrderLabel(cart.count, cart.itemsCents) : title;
  const cta = useMemo(
    () => ({ title: orderLabel, takesOrders: takesOrders && !hasItems, shown, onOpen: hasItems ? showCart : show, setHeroInView, attachHeroButton, attachCompactButton }),
    [orderLabel, takesOrders, hasItems, shown, show, showCart, attachHeroButton, attachCompactButton],
  );

  // The cart dock takes focus like the assistant's: its title on opening, the opener on closing.
  const wasCartOpen = useRef(cartOpen);
  useEffect(() => {
    if (isDesktop && cartOpen && !wasCartOpen.current) cartTitleRef.current?.focus();
    // A phone sheet returns focus itself, except when the last line went: it unmounts with the closing, open, so no `close` event fires.
    if ((isDesktop || (isDesktop === false && !hasItems)) && !cartOpen && wasCartOpen.current && !open) {
      const back = cartOpener.current;
      cartOpener.current = null;
      [back !== document.body ? back : null, heroInView ? heroButton.current : null, compactButton.current, orderBarRef.current].find(canTakeFocus)?.focus();
    }
    wasCartOpen.current = cartOpen;
  }, [cartOpen, isDesktop, heroInView, open, hasItems]);

  // `router.refresh()` writes back the URL and entry state Next last knew, without the panels' params and own-entry mark.
  // New props are the refresh arriving, in the same commit as that write, so the URL says what the page shows before paint.
  const refreshing = useRef(false);
  const seenCartData = useRef(cartData);
  const itemOwnEntry = itemParam.isOwn;
  const cartOwnEntry = cartParam.isOwn;
  useLayoutEffect(() => {
    if (seenCartData.current === cartData) return;
    seenCartData.current = cartData;
    if (!refreshing.current) return;
    refreshing.current = false;
    const url = urlWithPanels(window.location.href, { assistant: open, order: cartParam.value, item: itemParam.value });
    const state = ownEntry.current || cartOwnEntry() || itemOwnEntry() ? withOwnMark(window.history.state) : window.history.state;
    History.prototype.replaceState.call(window.history, state, '', url);
  });
  const onRefresh = useCallback(() => {
    refreshing.current = true;
  }, []);

  const { add, decrement, quantity, busy } = cart;
  const itemOpener = useRef<HTMLElement | null>(null);
  const openItemSheet = itemParam.open;
  const cartApi = useMemo<CartApi>(
    () => ({
      add,
      decrement,
      quantity,
      busy,
      openItem: (itemId, openedBy) => {
        itemOpener.current = openedBy;
        openItemSheet(itemId, true);
      },
    }),
    [add, decrement, quantity, busy, openItemSheet],
  );

  // The sheet keeps its last item while it animates shut. Each opening is a fresh mount, so it starts at 1 and the first option.
  const [sheetState, setSheetState] = useState<{ id: string | null; key: number; shown: string | null }>({ id: null, key: 0, shown: null });
  if (itemParam.value !== sheetState.id) {
    setSheetState((s) => ({ id: itemParam.value, key: itemParam.value ? s.key + 1 : s.key, shown: itemParam.value ?? s.shown }));
  }
  const sheetItem = sheetState.shown ? (cartData.items.find((i) => i.id === sheetState.shown) ?? null) : null;

  // An id that isn't on this menu opens nothing, and the link is cleaned up.
  const unknownItem = itemParam.value !== null && !cartData.items.some((i) => i.id === itemParam.value);
  useEffect(() => {
    // `dismiss`, not `close`: close flushes synchronously for the dialog's focus, which React refuses during an effect.
    if (unknownItem) dismissItemParam();
  }, [unknownItem, dismissItemParam]);

  const closeItem = useCallback(() => closeItemParam(), [closeItemParam]);
  const askAboutItem = () => {
    if (sheetItem) closeItemParam(() => openWithDraft(sheetItem.name));
  };
  const lines = cart.lines;
  const qtyInOrder = useCallback((optionId: string) => lines.find((l) => l.itemId === sheetItem?.id && l.optionId === optionId)?.qty ?? 0, [lines, sheetItem?.id]);
  const addFromSheet = (optionId: string, qty: number) => {
    if (!sheetItem) return;
    add(sheetItem.id, optionId, qty);
    closeItemParam();
  };

  const shell = <AssistantShell api={panelApi} title={title} titleId={titleId} titleRef={titleRef} shopName={shopName} starters={starters} inputRef={inputRef} takesOrders={takesOrders} onClose={hide} />;

  return (
    <CartContext.Provider value={cartApi}>
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
          {hasItems ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" aria-label={title} onClick={show} className="shrink-0 px-4 text-base">
                Assistant
              </Button>
              {/* On a very narrow phone the words give way, never the total. */}
              <Button ref={orderBarRef} size="lg" fullWidth aria-label={viewOrderLabel(cart.count, cart.itemsCents)} onClick={showCart} className="min-w-0 flex-1 px-4 text-base [&>span]:flex [&>span]:min-w-0 [&>span]:items-baseline [&>span]:gap-2">
                <span className="min-w-0 truncate">View order · {cart.count}</span>
                <span className="shrink-0 type-figures">{formatUSD(cart.itemsCents)}</span>
              </Button>
            </div>
          ) : (
            <Button ref={orderBarRef} size="lg" fullWidth onClick={show}>
              {title}
              {takesOrders && <span className="font-medium text-surface/75 max-[24.375rem]:hidden"> · PayPal</span>}
            </Button>
          )}
        </div>
      </div>

      {/* Docked from 1024 px (hidden by CSS below that, so a `?assistant=1` load never flashes a dock on a phone). */}
      {panelOpen && (
        <aside
          data-assistant-dock=""
          aria-labelledby={cartOpen ? cartTitleId : titleId}
          className="assistant-dock"
          onKeyDown={(e) => {
            if (e.key === 'Escape') (cartOpen ? hideCart : hide)();
          }}
        >
          {cartOpen ? <CartView cart={cart} data={cartData} titleId={cartTitleId} titleRef={cartTitleRef} shopName={shopName} onClose={hideCart} onRefresh={onRefresh} onAssistant={switchToAssistant} /> : shell}
        </aside>
      )}

      {isDesktop === false && (
        <Sheet bare dialogRef={dialogRef} labelledBy={titleId} open={open} onClose={hide} className="assistant-sheet text-ink" initialFocusRef={titleRef} fallbackFocusRef={orderBarRef}>
          {shell}
        </Sheet>
      )}

      {/* Mounted only with something to show: an empty page keeps one dialog, the assistant's. */}
      {isDesktop === false && (cartOpen || hasItems) && (
        <Sheet bare dialogRef={cartDialogRef} labelledBy={cartTitleId} open={cartOpen} onClose={hideCart} className="assistant-sheet text-ink" initialFocusRef={cartTitleRef} fallbackFocusRef={orderBarRef}>
          <CartView cart={cart} data={cartData} titleId={cartTitleId} titleRef={cartTitleRef} shopName={shopName} onClose={hideCart} onRefresh={onRefresh} />
          {cartOpen && <CartStatus cart={cart} />}
        </Sheet>
      )}
      {/* The modal cart holds its own status line, since everything behind a modal dialog is inert to a screen reader. */}
      {!(cartOpen && isDesktop === false) && <CartStatus cart={cart} />}

      {sheetItem && (
        <ItemSheet
          key={sheetState.key}
          item={sheetItem}
          open={itemParam.value !== null && !unknownItem}
          onClose={closeItem}
          onAdd={addFromSheet}
          onAsk={askAboutItem}
          openerRef={itemOpener}
          inOrder={qtyInOrder}
          busy={cart.busy}
        />
      )}
    </CartContext.Provider>
  );
}
