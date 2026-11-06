'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Bot, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { ConsoleComposer, ConsoleConversation, useBuyerConsole } from './BuyerConsole';

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
  intro: ReactNode;
  menu: ReactNode;
  door: ReactNode;
}

const PITCH = 'An AI assistant reads the menu, checks the order with you, and hands payment to PayPal. You see every step.';

/**
 * The shop page layout and its one primary action, **Order with an assistant**. The console opens as a bottom sheet on
 * phones and as a side panel next to the menu from 1024 px, so the menu and the conversation stay side by side.
 */
export function ShopAssistant({ slug, shopName, starters, initiallyOpen, intro, menu, door }: ShopAssistantProps) {
  const api = useBuyerConsole(slug);
  const [open, setOpen] = useState(initiallyOpen);
  const isDesktop = useIsDesktop();
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
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

  const conversation = <ConsoleConversation api={api} shopName={shopName} starters={starters} />;

  return (
    <div className="mx-auto grid w-full max-w-page items-start gap-10 px-gutter pt-8 pb-section lg:grid-cols-12 lg:gap-12 lg:pt-12">
      <div className="flex min-w-0 flex-col gap-10 lg:col-span-7">
        {intro}
        <div className="flex flex-col gap-2 lg:hidden">
          <Button size="lg" icon={Bot} fullWidth onClick={show}>
            Order with an assistant
          </Button>
          <p className="type-meta text-ink-muted">{PITCH}</p>
        </div>
        {menu}
        {door}
      </div>

      <aside aria-label="Order with an assistant" className="hidden lg:sticky lg:top-6 lg:col-span-5 lg:block">
        {panelOpen ? (
          // Fits the first screen under the header (and stays in view, sticky, as the menu scrolls).
          <Card padding="none" className="flex h-[min(52rem,calc(100dvh-8.5rem))] min-h-96 flex-col overflow-hidden">
            <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3">
              <div className="flex-1 pt-1.5">
                <h2 className="type-heading">Order with an assistant</h2>
                <p className="type-meta text-ink-muted">Claude, through {shopName}’s agent door</p>
              </div>
              <button
                type="button"
                onClick={hide}
                className="-mr-2 inline-flex size-(--spacing-tap) items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunken hover:text-ink"
              >
                <Icon icon={X} label="Close the assistant" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{conversation}</div>
            <div className="border-t border-line px-5 py-4">
              <ConsoleComposer api={api} inputRef={inputRef} />
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col gap-4" padding="lg">
            <h2 className="type-heading">Order with an assistant</h2>
            <p className="text-ink-soft">{PITCH}</p>
            <Button ref={openerRef} size="lg" icon={Bot} fullWidth onClick={show}>
              Order with an assistant
            </Button>
            <p className="type-meta text-ink-muted">
              Or connect your own assistant to the{' '}
              <a href="#agent-door" className="font-semibold text-accent-ink underline">
                agent door
              </a>
              .
            </p>
          </Card>
        )}
      </aside>

      {isDesktop === false && (
        <Sheet
          open={open}
          onClose={hide}
          title="Order with an assistant"
          footer={<ConsoleComposer api={api} />}
        >
          {conversation}
        </Sheet>
      )}
    </div>
  );
}
