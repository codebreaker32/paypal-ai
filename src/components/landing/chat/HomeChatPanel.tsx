'use client';

import { useCallback, useMemo } from 'react';
import { CircleAlert, CircleCheck, CircleX, Hourglass, ReceiptText, RotateCcw, X, type LucideIcon } from 'lucide-react';
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
import { itemCards, latestOrder, quickReplies, type ItemCard, type PlacedOrder } from './order';
import { OnlineDot, TypingDots } from './parts';
import type { HomeChatPanelProps } from './types';
import './home-chat-panel.css';

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

/** The assistant's side of the conversation: the bot at the foot of a soft grey bubble. */
function AssistantRow({ grouped, children }: { grouped: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      {grouped ? <span aria-hidden className="size-7 shrink-0" /> : <BotMark className="size-7" />}
      <div className="home-chat-msg min-w-0 max-w-[85%] rounded-2xl rounded-bl-[0.25rem] bg-surface-sunken px-3.5 py-2.5 text-ink">{children}</div>
    </div>
  );
}

/**
 * The items a reply named, as cards: photo, name and the price list_products returned. A press puts "I'd like the …" in
 * the message box (not sent), so the buyer can add a quantity or a note first.
 */
function ItemCards({ cards, onPick }: { cards: ItemCard[]; onPick: (card: ItemCard) => void }) {
  if (!cards.length) return null;
  return (
    <ul aria-label="Items from the menu" className="mt-2.5 grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <li key={card.id} className="min-w-0">
          <button
            type="button"
            data-item-card=""
            onClick={() => onPick(card)}
            className="home-chat-card press-surface group flex h-full w-full flex-col overflow-hidden rounded-xl border border-line bg-surface text-left"
          >
            <span className="relative block aspect-[4/3] w-full overflow-hidden bg-blush-band">
              {card.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- small site-relative thumbnails, no optimizer round trip
                <img src={card.photoUrl} alt="" loading="lazy" decoding="async" className="home-chat-card-photo size-full object-cover" />
              )}
              {card.example && (
                <span data-example-note="" className="absolute top-1.5 left-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[0.6875rem] leading-4 font-semibold text-surface">
                  Example photo
                </span>
              )}
            </span>
            <span className="flex flex-1 items-start justify-between gap-1.5 px-2 pt-1.5 pb-2 text-sm leading-5">
              <span className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">{card.name}</span>
              <span className="type-price shrink-0 text-ink-soft">{formatUSD(card.priceCents)}</span>
            </span>
            <span className="sr-only">: put “I’d like the {card.name}” in the message box</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The order placed in this chat, pinned above the message box: lines, shipping, total and the PayPal button. */
function OrderSummary({ order }: { order: PlacedOrder }) {
  const total = money(order.total)!;
  const { approval, view } = order;
  return (
    <section aria-label={order.orderNumber ? `Your order ${order.orderNumber}` : 'Your order'} data-order-summary="" data-entrance="" className="home-chat-summary shrink-0 border-t border-blush-ring/60 bg-blush px-4 pt-3 pb-3">
      <ul className="flex flex-col gap-0.5 text-sm leading-5 text-ink-soft">
        {order.lines.map((l, i) => (
          <li key={`${l.name}-${l.option ?? ''}-${i}`} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="type-price">{l.quantity} ×</span> {l.name}
              {l.option && <span className="text-ink-muted"> · {l.option}</span>}
            </span>
            <span className="type-price shrink-0">{money(l.lineTotal)}</span>
          </li>
        ))}
        {order.shipping !== null && parseAmountToCents(order.shipping) !== 0 && (
          <li className="flex items-baseline justify-between gap-3">
            <span>Shipping</span>
            <span className="type-price shrink-0">{money(order.shipping)}</span>
          </li>
        )}
        <li className="mt-0.5 flex items-baseline justify-between gap-3 text-base leading-6 font-bold text-ink">
          <span>Total</span>
          <span className="type-price shrink-0">{total}</span>
        </li>
      </ul>

      <div className="mt-2">
        {!approval || !view ? (
          <p role="status" className="flex min-h-11 items-center justify-center gap-2 text-sm text-ink-muted">
            <span className="home-chat-typing" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            Getting the PayPal button ready
          </p>
        ) : view.approve ? (
          isPayPalApprovalUrl(approval.approvalUrl) ? (
            <PayPalLink href={approval.approvalUrl} fullWidth>
              Approve {money(approval.total)} on PayPal
            </PayPalLink>
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

/** A row of short replies or starters: blush pills that wrap. */
function Chips({ label, items, onPick }: { label: string; items: string[]; onPick: (text: string) => void }) {
  if (!items.length) return null;
  return (
    <ul aria-label={label} data-starters="" className="flex flex-wrap gap-2">
      {items.map((text) => (
        <li key={text} className="max-w-full">
          <button
            type="button"
            onClick={() => onPick(text)}
            className="home-chat-chip press min-h-11 rounded-[1.375rem] border border-blush-ring bg-blush px-3.5 py-2 text-left text-sm leading-5 font-semibold text-accent-ink [--press-local:var(--press-scale-wide)]"
          >
            {text}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The home page's chat, inside its desktop panel or phone sheet: the shop's cover photo heads it, replies show the menu
 * items they name as photo cards, and the order placed here stays pinned above the message box with its PayPal button.
 */
export function HomeChatPanel(props: HomeChatPanelProps) {
  const { api, shopName, starters, cover, menu, titleId, titleRef, inputRef, onClose, greeting } = props;
  const { state } = api;
  const order = useMemo(() => latestOrder(state), [state]);
  const replies = quickReplies(state);
  const canStartOver = !state.busy && state.entries.length > 0 && !isConversationFull(state);
  const waitingOnPayPal = !state.busy && refsToCheck(state).length > 0;
  const { setDraft, send } = api;

  const pick = useCallback(
    (card: ItemCard) => {
      const text = `I’d like the ${card.name}`;
      setDraft(text);
      requestAnimationFrame(() => {
        const box = inputRef.current;
        if (!box) return;
        box.focus();
        box.setSelectionRange(text.length, text.length);
      });
    },
    [setDraft, inputRef],
  );

  const empty = useMemo(
    () => (
      <div className="flex flex-col gap-3">
        <AssistantRow grouped={false}>
          <p className="text-[0.9375rem] leading-6">{greeting}</p>
        </AssistantRow>
        <div className="pl-9">
          <Chips label="Try asking" items={starters} onPick={send} />
        </div>
      </div>
    ),
    [greeting, starters, send],
  );

  const typing = useMemo(
    () => (
      <div className="flex items-end gap-2">
        <BotMark className="size-7" />
        <TypingDots className="home-chat-msg rounded-2xl rounded-bl-[0.25rem] bg-surface-sunken px-3.5 py-3" />
      </div>
    ),
    [],
  );

  const renderEntry = useCallback(
    (entry: Entry, ctx: EntryContext) => {
      switch (entry.kind) {
        case 'user':
          return (
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-[0.25rem] bg-accent px-3.5 py-2.5 text-[0.9375rem] leading-6 whitespace-pre-wrap text-on-accent [overflow-wrap:anywhere]">
              {entry.text}
            </p>
          );
        case 'assistant': {
          const grouped = ctx.next?.kind === 'assistant';
          return (
            <AssistantRow grouped={grouped}>
              <RichText text={entry.text} className="text-[0.9375rem] leading-6 [overflow-wrap:anywhere]" />
              <ItemCards cards={itemCards(ctx.entries, ctx.index, menu)} onPick={pick} />
            </AssistantRow>
          );
        }
        case 'activity':
          return (
            <div className="pl-9">
              <ActivityPanel calls={entry.calls} />
            </div>
          );
        case 'approval': {
          // The pinned summary holds the PayPal button; the log only marks where the order was placed.
          const view = approvalCard(entry);
          const Icon = view.approve ? ReceiptText : SETTLED[view.label];
          return (
            <p className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-blush px-3.5 py-1.5 text-sm leading-5 font-semibold text-ink-soft">
              <Icon aria-hidden className={cn('size-4 shrink-0', view.approve ? 'text-accent-ink' : 'text-ok')} />
              <span>
                {entry.orderNumber ? `Order ${entry.orderNumber}` : 'Order'} placed · {view.approve ? 'approve it below' : view.label.toLowerCase()}
              </span>
            </p>
          );
        }
        case 'error':
          return <FieldError>{entry.message}</FieldError>;
      }
    },
    [menu, pick],
  );

  const chips = waitingOnPayPal && !replies.includes(PAYMENT_CHECK_PROMPT) ? [...replies, PAYMENT_CHECK_PROMPT] : replies;

  return (
    <div data-home-chat-root="" className="flex h-full min-h-0 flex-col bg-surface">
      {/* A div, not <header>: it would be a landmark inside the dialog. */}
      <div data-assistant-header="" data-cover={cover ? '' : undefined} className={cn('home-chat-cover relative shrink-0 overflow-hidden', cover ? 'bg-charcoal' : 'bg-blush-band')}>
        {cover && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- the shop's own cover, already sized for the page */}
            <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
            <span aria-hidden className="home-chat-scrim absolute inset-0" />
          </>
        )}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
          {canStartOver && (
            <button type="button" aria-label="Start over" onClick={api.reset} className="home-chat-hdr-btn press-icon grid size-9 place-items-center rounded-full">
              <RotateCcw aria-hidden className="size-4" />
            </button>
          )}
          <button type="button" aria-label="Close the chat" onClick={onClose} className="home-chat-hdr-btn press-icon grid size-9 place-items-center rounded-full">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="home-chat-who absolute inset-x-0 bottom-0 flex items-center gap-2.5 px-4 pb-3.5">
          <BotMark className="home-chat-avatar size-10" />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="home-chat-shop truncate text-lg leading-tight font-bold">{shopName}</p>
            <div className="home-chat-sub flex items-center gap-1.5 text-sm leading-5">
              <OnlineDot className="shrink-0" />
              <h2 ref={titleRef} id={titleId} tabIndex={-1} className="truncate font-medium outline-none">
                Shelfie assistant
              </h2>
            </div>
          </div>
        </div>
      </div>

      <div className="home-chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div data-assistant-log="" className="flex min-h-full flex-col justify-end">
          <ChatLog api={api} inputRef={inputRef} empty={empty} typing={typing} renderEntry={renderEntry} className="gap-3" />
        </div>
      </div>

      {order && <OrderSummary key={order.orderRef} order={order} />}

      <div data-assistant-footer="" className="flex shrink-0 flex-col gap-2 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {chips.length > 0 && <Chips label="Quick replies" items={chips} onPick={send} />}
        <ConsoleComposer
          api={api}
          inputRef={inputRef}
          sendVariant="brand"
          sendIcon={false}
          className="flex items-end gap-2"
          boxClassName="home-chat-box block min-h-11 min-w-0 flex-1 resize-none overscroll-contain rounded-[1.375rem] border border-line-strong bg-surface px-4 py-[9px] text-base leading-6"
        />
      </div>
    </div>
  );
}
