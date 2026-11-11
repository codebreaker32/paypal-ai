'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, CircleX, ChevronDown, Hourglass, ReceiptText, RotateCcw, X, type LucideIcon } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { PayPalLink } from '@/components/ui/paypal-link';
import { ActivityPanel } from '@/components/shop/ActivityPanel';
import { ConsoleComposer, isConversationFull, PAYMENT_CHECK_PROMPT } from '@/components/shop/BuyerConsole';
import { isPayPalApprovalUrl } from '@/components/shop/activity-format';
import { approvalCard, refsToCheck, type Entry } from '@/components/shop/console-state';
import { RichText } from '@/components/shop/RichText';
import { formatUSD, parseAmountToCents } from '@/lib/domain/money';
import { cn } from '@/lib/utils';
import { BotMark } from '../BotMark';
import { ChatLog, type EntryContext } from './ChatLog';
import { itemsMentioned, latestOrder, quickReplies, type PlacedOrder } from './order';
import { OnlineDot, TypingDots } from './parts';
import type { ChatMenuItem, ChatVariantProps } from './types';
import './chat-b.css';

const money = (amount: string | null) => {
  if (amount === null) return null;
  const cents = parseAmountToCents(amount);
  return cents === null ? `$${amount}` : formatUSD(cents);
};

const SETTLED: Record<'Paid' | 'Confirming with PayPal' | 'Payment refused' | 'Cancelled' | 'Expired', LucideIcon> = {
  Paid: CircleCheck,
  'Confirming with PayPal': Hourglass,
  'Payment refused': CircleAlert,
  Cancelled: CircleX,
  Expired: CircleX,
};

/** A menu item's picture: the seller's photo, else a blush tile with its initial. Decorative (the name is beside it). */
function ItemPicture({ item, className }: { item: ChatMenuItem; className?: string }) {
  return item.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- small site-relative thumbnails, no optimizer round trip
    <img src={item.photoUrl} alt="" loading="lazy" decoding="async" className={cn('object-cover', className)} />
  ) : (
    <span aria-hidden className={cn('grid place-items-center bg-blush-band font-display text-xl font-bold text-accent-ink', className)}>
      {item.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Up to three cards for the menu items a reply names: photo, name, price. Not interactive. */
function MentionedItems({ items }: { items: ChatMenuItem[] }) {
  if (!items.length) return null;
  return (
    <ul aria-label="Items mentioned" className="chat-b-cards mt-2 grid grid-cols-3 gap-2">
      {items.slice(0, 3).map((item) => (
        <li key={item.id} className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-surface shadow-sm">
          <ItemPicture item={item} className="aspect-[4/3] w-full" />
          <span className="flex flex-col gap-0.5 px-2.5 pt-2 pb-2.5">
            <span className="line-clamp-2 text-xs leading-4 font-semibold text-ink">{item.name}</span>
            <span className="type-price text-xs leading-4 text-ink-muted">{formatUSD(item.priceCents)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The running order, pinned above the message box: its lines fold to one row, the PayPal button never does. */
function OrderSummary({ order, shopName, startOpen }: { order: PlacedOrder; shopName: string; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const linesId = useId();
  const total = money(order.total)!;
  const approval = order.approval;
  const view = order.view;
  const itemCount = order.lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <section aria-label="Your order" data-entrance="" className="chat-b-summary border-t border-blush-ring/60 bg-blush px-4 pt-3 pb-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={linesId}
        onClick={() => setOpen((o) => !o)}
        className="press-text -mx-1 flex min-h-11 w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm leading-5 font-bold text-ink">
            Your order{order.orderNumber && <span className="type-price font-semibold text-ink-muted"> · {order.orderNumber}</span>}
          </span>
          <span className="text-xs leading-4 text-ink-muted">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} from {shopName}
            {order.fulfillment ? ` · ${order.fulfillment}` : ''}
          </span>
        </span>
        <span className="type-price text-lg font-bold text-ink">{total}</span>
        <ChevronDown aria-hidden className={cn('chat-b-chevron size-4 text-ink-muted', open && 'chat-b-chevron-open')} />
        <span className="sr-only">{open ? 'Hide the order lines' : 'Show the order lines'}</span>
      </button>

      <div id={linesId} hidden={!open}>
        <ul className="type-receipt mt-1 flex flex-col text-ink-soft">
          {order.lines.map((l, i) => (
            <li key={`${l.name}-${l.option ?? ''}-${i}`} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="type-price font-semibold text-ink">{l.quantity} ×</span> {l.name}
                {l.option && <span className="text-ink-muted"> · {l.option}</span>}
              </span>
              <span className="type-price shrink-0">{money(l.lineTotal)}</span>
            </li>
          ))}
          {order.shipping !== null && (
            <li className="flex items-baseline justify-between gap-3">
              <span>Shipping</span>
              <span className="type-price shrink-0">{money(order.shipping)}</span>
            </li>
          )}
          <li className="mt-1 flex items-baseline justify-between gap-3 border-t border-blush-ring pt-1 font-bold text-ink">
            <span>Total</span>
            <span className="type-price shrink-0">{total}</span>
          </li>
        </ul>
      </div>

      <div className="mt-2.5">
        {!approval || !view ? (
          <p role="status" className="flex min-h-11 items-center justify-center gap-2 text-sm text-ink-muted">
            <span className="chatui-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            Getting the PayPal button ready
          </p>
        ) : view.approve ? (
          isPayPalApprovalUrl(approval.approvalUrl) ? (
            <>
              <PayPalLink href={approval.approvalUrl} fullWidth>
                Approve {money(approval.total)} on PayPal
              </PayPalLink>
              <p className="mt-1.5 text-center text-xs leading-4 text-ink-muted">Nothing is charged until you approve on PayPal.</p>
            </>
          ) : (
            <FieldError>This approval link doesn’t go to PayPal, so it isn’t shown.</FieldError>
          )
        ) : (
          <ButtonLink href={`/o/${encodeURIComponent(order.orderRef)}`} variant={view.label === 'Paid' ? 'primary' : 'secondary'} icon={SETTLED[view.label]} fullWidth>
            {view.label} · View receipt
          </ButtonLink>
        )}
      </div>
    </section>
  );
}

/**
 * Mockup B (`/?chatui=b`), "Shop-aware": the example shop's cover photo heads the chat, replies show the menu items they
 * name as photo cards, and the order being placed stays pinned above the message box with its PayPal button.
 */
export function ChatB(props: ChatVariantProps) {
  const { api, shopName, starters, cover, menu, titleId, titleRef, inputRef, onClose, isDesktop, greeting } = props;
  const { state } = api;
  const order = useMemo(() => latestOrder(state), [state]);
  const replies = quickReplies(state);
  const canStartOver = !state.busy && state.entries.length > 0 && !isConversationFull(state);
  const waitingOnPayPal = !state.busy && refsToCheck(state).length > 0;
  const firstWord = shopName.split(' ')[0];

  const popular = useMemo(() => {
    const withPhoto = menu.filter((i) => i.photoUrl);
    return (withPhoto.length >= 3 ? withPhoto : menu).slice(0, 3);
  }, [menu]);

  const draft = useCallback(
    (item: ChatMenuItem) => {
      const text = `I’d like a ${item.name}`;
      api.setDraft(text);
      requestAnimationFrame(() => {
        const box = inputRef.current;
        if (!box) return;
        box.focus();
        box.setSelectionRange(text.length, text.length);
      });
    },
    [api, inputRef],
  );
  const send = api.send;

  const empty = useMemo(
    () => (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-2.5">
          <BotMark className="mt-0.5 size-8" />
          <p className="chat-b-bubble min-w-0 flex-1 rounded-2xl rounded-tl-md bg-surface-sunken px-3.5 py-2.5 text-sm leading-6 text-ink">{greeting}</p>
        </div>
        {popular.length > 0 && (
          <section aria-labelledby={`${titleId}-popular`} className="flex flex-col gap-2.5">
            <h3 id={`${titleId}-popular`} className="text-sm leading-5 font-bold text-ink">
              Popular at {firstWord}
            </h3>
            <ul className="grid grid-cols-3 gap-2">
              {popular.map((item) => (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => draft(item)}
                    className="chat-b-pick press-surface group flex h-full w-full flex-col overflow-hidden rounded-lg bg-surface text-left shadow-sm hover:shadow-md"
                  >
                    <span className="block overflow-hidden">
                      <ItemPicture item={item} className="chat-b-pick-photo aspect-[4/3] w-full" />
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2 pb-2.5">
                      <span className="line-clamp-2 text-xs leading-4 font-semibold text-ink">{item.name}</span>
                      <span className="type-price mt-auto text-xs leading-4 text-ink-muted">{formatUSD(item.priceCents)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {starters.length > 0 && (
          <section aria-labelledby={`${titleId}-ask`} className="flex flex-col gap-2.5">
            <h3 id={`${titleId}-ask`} className="text-sm leading-5 font-bold text-ink">
              Or ask
            </h3>
            <ul className="flex flex-wrap gap-2">
              {starters.map((p) => (
                <li key={p} className="max-w-full">
                  <button
                    type="button"
                    onClick={() => send(p)}
                    className="press min-h-11 rounded-[1.375rem] border border-line bg-surface px-3.5 py-2 text-left text-sm leading-5 font-semibold text-ink [--press-local:var(--press-scale-wide)] hover:border-line-strong hover:bg-surface-sunken"
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    ),
    [greeting, popular, starters, firstWord, titleId, draft, send],
  );

  const typing = useMemo(() => <TypingDots className="pl-0.5" />, []);

  const renderEntry = useCallback(
    (entry: Entry, ctx: EntryContext) => {
      switch (entry.kind) {
        case 'user':
          return (
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-sm leading-5 whitespace-pre-wrap text-surface [overflow-wrap:anywhere]">
              {entry.text}
            </p>
          );
        case 'assistant': {
          const grouped = ctx.prev?.kind === 'assistant' || ctx.prev?.kind === 'activity';
          return (
            <div className="flex items-start gap-2.5">
              {grouped ? <span aria-hidden className="size-8 shrink-0" /> : <BotMark className="mt-0.5 size-8" />}
              <div className="min-w-0 flex-1">
                <div className="chat-b-bubble rounded-2xl rounded-tl-md bg-surface-sunken px-3.5 py-2.5">
                  <RichText text={entry.text} className="text-sm leading-6 [overflow-wrap:anywhere]" />
                </div>
                <MentionedItems items={itemsMentioned(entry.text, menu)} />
              </div>
            </div>
          );
        }
        case 'activity':
          return (
            <div className="pl-10.5">
              <ActivityPanel calls={entry.calls} collapsed={ctx.collapsed} />
            </div>
          );
        case 'approval': {
          const view = approvalCard(entry);
          const Icon = view.approve ? ReceiptText : SETTLED[view.label];
          return (
            <p className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-blush px-3.5 py-1.5 text-xs leading-4 font-semibold text-ink-soft">
              <Icon aria-hidden className={cn('size-4 shrink-0', view.approve ? 'text-accent-ink' : 'text-ok')} />
              <span>
                {entry.orderNumber ? `Order ${entry.orderNumber}` : 'Order'} placed ·{' '}
                {view.approve ? 'approve it below' : view.label.toLowerCase()}
              </span>
            </p>
          );
        }
        case 'error':
          return <FieldError>{entry.message}</FieldError>;
      }
    },
    [menu],
  );

  const chips = waitingOnPayPal && !replies.includes(PAYMENT_CHECK_PROMPT) ? [...replies, PAYMENT_CHECK_PROMPT] : replies;

  return (
    <div data-chatui-root="b" className="flex h-full min-h-0 flex-col bg-surface">
      <header className={cn('chat-b-header relative shrink-0 overflow-hidden', cover ? 'bg-charcoal' : 'bg-blush-band')} data-cover={cover ? '' : undefined}>
        {cover && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- the shop's own cover, already sized for the page */}
            <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
            <span aria-hidden className="chat-b-scrim absolute inset-0" />
          </>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {canStartOver && (
            <button type="button" aria-label="Start over" onClick={api.reset} className="chat-b-hdr-btn press-icon grid size-11 place-items-center rounded-full">
              <RotateCcw aria-hidden className="size-[1.125rem]" />
            </button>
          )}
          <button type="button" aria-label="Close the chat" onClick={onClose} className="chat-b-hdr-btn press-icon grid size-11 place-items-center rounded-full">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className={cn('absolute inset-x-0 bottom-0 flex items-end gap-3 px-4', isDesktop === false ? 'pb-3' : 'pb-4')}>
          <BotMark className={cn('chat-b-avatar', isDesktop === false ? 'size-10' : 'size-12')} />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className={cn('chat-b-shop truncate font-display leading-tight font-extrabold tracking-tight', isDesktop === false ? 'text-xl' : 'text-2xl')}>{shopName}</p>
            <div className="chat-b-sub flex items-center gap-1.5 text-sm leading-5">
              <OnlineDot className="shrink-0" />
              <h2 ref={titleRef} id={titleId} tabIndex={-1} className="inline font-semibold outline-none">
                Shelfie assistant
              </h2>
              <span className="truncate">· example shop</span>
            </div>
          </div>
        </div>
      </header>

      <div className="chat-b-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
        <ChatLog api={api} inputRef={inputRef} empty={empty} typing={typing} renderEntry={renderEntry} className="gap-3.5" />
      </div>

      {order && <OrderSummary key={order.orderRef} order={order} shopName={shopName} startOpen={isDesktop !== false} />}

      <div className={cn('shrink-0 px-4 pt-2 pb-4', !order && 'border-t border-line')}>
        {chips.length > 0 && (
          <ul aria-label="Quick replies" className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
            {chips.map((r) => (
              <li key={r} className="shrink-0">
                <button
                  type="button"
                  onClick={() => api.send(r)}
                  className="press min-h-11 rounded-full border border-accent/30 bg-surface px-3.5 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
                >
                  {r}
                </button>
              </li>
            ))}
          </ul>
        )}
        <ConsoleComposer
          api={api}
          inputRef={inputRef}
          iconSend
          placeholder={`Order from ${shopName}…`}
          className="chat-b-composer flex items-end gap-1.5 rounded-[1.625rem] border border-line-strong bg-surface p-1 pl-1"
          boxClassName="chat-b-box block min-h-11 min-w-0 flex-1 resize-none overscroll-contain rounded-[1.375rem] border-0 bg-transparent px-3.5 py-[10px] text-base leading-6 shadow-none focus-visible:border-0"
        />
      </div>
    </div>
  );
}
