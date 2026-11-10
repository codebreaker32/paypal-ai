'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { AssistantShell } from '@/components/shop/AssistantShell';
import { useBuyerConsole, type BuyerConsoleApi } from '@/components/shop/BuyerConsole';
import { useKeyboardViewport } from '@/components/shop/use-keyboard-viewport';
import { BotMark } from './BotMark';
import './home-chat.css';

/** What the home page's chat needs from the example shop (computed on the server, only while it is live and takes orders). */
export interface HomeChatShop {
  slug: string;
  name: string;
  starters: string[];
}

const DESKTOP = '(min-width: 1024px)';
/** Below this height the panel would be too short to open by itself (it still opens from the launcher). */
const TALL_ENOUGH = '(min-height: 700px)';
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(DESKTOP);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
/** true / false in the browser, null while server-rendering and hydrating. */
const useIsDesktop = (): boolean | null => useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => null);

/** How long after the page loads the chat opens itself (desktop) or says hello (phones). */
export const AUTO_OPEN_MS = 4000;
/** Set once the chat has opened itself or shown its bubble: once per browser session. */
const AUTO_KEY = 'shelfie:home-chat:auto';
/** Set once the visitor has seen the chat: the launcher's unread dot goes. */
const SEEN_KEY = 'shelfie:home-chat:seen';

const readFlag = (key: string) => {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const setFlag = (key: string) => {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // Private mode: the chat may say hello again on the next page view.
  }
};

const focusAtEnd = (input: HTMLTextAreaElement | null) => {
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
};

/**
 * The home page's chat: the real buyer console (`/api/assistant/[slug]`) taking orders for the example shop, so a visitor
 * can try ordering, PayPal sandbox checkout included, without leaving the page. A round launcher at the bottom right; a
 * compact panel above it from 1024 px, which opens by itself once per session without taking focus; a bottom sheet below
 * 1024 px, where a small greeting bubble stands in for the auto-open.
 */
export function HomeChat({ shop, autoOpen }: { shop: HomeChatShop; autoOpen: boolean }) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const [bubble, setBubble] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const panelId = useId();
  useKeyboardViewport(dialogRef, open && isDesktop === false);

  const markSeen = useCallback(() => {
    setUnread(false);
    setBubble(false);
    setFlag(SEEN_KEY);
    setFlag(AUTO_KEY);
  }, []);

  /** Opened by the visitor: on the desktop panel the cursor goes to the message box (a sheet focuses its title). */
  const show = useCallback(() => {
    markSeen();
    setOpen(true);
    if (window.matchMedia(DESKTOP).matches) requestAnimationFrame(() => focusAtEnd(inputRef.current));
  }, [markSeen]);

  const hide = useCallback(() => {
    setOpen(false);
    // Focus inside the closing panel (or lost to the page) goes back to the launcher; the phone sheet returns it itself.
    if (window.matchMedia(DESKTOP).matches) {
      const active = document.activeElement;
      if (!active || active === document.body || panelRef.current?.contains(active)) launcherRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after hydration
    if (readFlag(SEEN_KEY)) setUnread(false);
  }, []);

  // Once per session, about 4 s in: the panel opens on a desktop (focus stays where it is), a phone gets the bubble.
  useEffect(() => {
    if (!autoOpen || isDesktop === null || readFlag(AUTO_KEY)) return;
    const timer = window.setTimeout(() => {
      if (readFlag(AUTO_KEY)) return;
      // A short laptop screen keeps the page to itself (the panel would crowd the header); the launcher and its dot stay.
      if (isDesktop && !window.matchMedia(TALL_ENOUGH).matches) return;
      setFlag(AUTO_KEY);
      if (isDesktop) {
        setOpen(true);
        setUnread(false);
        setFlag(SEEN_KEY);
      } else {
        setBubble(true);
      }
    }, AUTO_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [autoOpen, isDesktop]);

  // Esc closes the desktop panel from anywhere on the page (the phone sheet is a modal dialog with its own Esc).
  useEffect(() => {
    if (!open || !isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // A sheet or dialog elsewhere on the page owns its own Esc.
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      setOpen(false);
      launcherRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isDesktop]);

  const api = useBuyerConsole(shop.slug, { takesOrders: true, onOpen: show });
  // A control used in the desktop panel can vanish with the state it changes; the message box keeps focus there.
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

  // A stable element, so the console's memoised conversation doesn't re-render on every keystroke.
  const greeting = useMemo(
    () => <>Hi! I’m the Shelfie assistant. Try me: I’m taking orders for {shop.name}, an example shop. What would you like?</>,
    [shop.name],
  );
  const shell = (
    <AssistantShell
      api={panelApi}
      title="Shelfie assistant"
      titleId={titleId}
      titleRef={titleRef}
      shopName={shop.name}
      starters={shop.starters}
      inputRef={inputRef}
      takesOrders
      onClose={hide}
      subtitle={`Ordering from ${shop.name}\u00a0·\u00a0example shop`}
      mark={<BotMark className="size-9" />}
      greeting={greeting}
      closeLabel="Close the chat"
    />
  );

  return (
    <div data-home-chat="">
      {bubble && !open && isDesktop === false && (
        <div data-entrance="" className="home-chat-bubble">
          <button type="button" onClick={show} className="press-text min-h-11 flex-1 py-2 pr-1 pl-4 text-left text-base font-semibold text-ink">
            Hi! Want to try ordering?
          </button>
          <button
            type="button"
            aria-label="Dismiss the greeting"
            onClick={() => setBubble(false)}
            className="press-icon grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        aria-label="Chat with the Shelfie assistant"
        aria-expanded={open}
        aria-controls={open && isDesktop ? panelId : undefined}
        onClick={() => (open ? hide() : show())}
        className="home-chat-launcher press-icon"
      >
        <BotMark className="size-full" />
        {unread && <span data-unread="" aria-hidden className="home-chat-dot" />}
      </button>

      {open && isDesktop && (
        <section
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          data-entrance=""
          data-home-chat-panel=""
          className="home-chat-panel text-ink"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              launcherRef.current?.focus();
            }
          }}
        >
          {shell}
        </section>
      )}

      {isDesktop === false && (
        <Sheet bare dialogRef={dialogRef} labelledBy={titleId} open={open} onClose={hide} className="home-chat-sheet text-ink" initialFocusRef={titleRef} fallbackFocusRef={launcherRef}>
          {shell}
        </Sheet>
      )}
    </div>
  );
}
