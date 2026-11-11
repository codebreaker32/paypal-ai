'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, CircleAlert, CircleCheck, CircleX, Hourglass, MessageCircleQuestion, RotateCcw, ShieldCheck, ShoppingBag, Truck, X, type LucideIcon } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { ApprovalCard, ConsoleComposer, isConversationFull } from '@/components/shop/BuyerConsole';
import { ActivityPanel } from '@/components/shop/ActivityPanel';
import { RichText } from '@/components/shop/RichText';
import { isPayPalApprovalUrl } from '@/components/shop/activity-format';
import { approvalCard, type ApprovalCardView, type Entry } from '@/components/shop/console-state';
import { FieldError } from '@/components/ui/field';
import { PayPalLink } from '@/components/ui/paypal-link';
import { ButtonLink } from '@/components/ui/button';
import { CountUp } from '@/components/motion/count-up';
import { StatusSwap } from '@/components/motion/status-swap';
import { formatUSD, parseAmountToCents } from '@/lib/domain/money';
import { cn } from '@/lib/utils';
import { BotMark } from '../BotMark';
import { ChatLog, type EntryContext } from './ChatLog';
import { latestOrder, quickReplies, type PlacedOrder } from './order';
import { TypingDots } from './parts';
import type { ChatVariantProps } from './types';
import './chat-c.css';

/** The empty drawer's suggested questions, grouped the way a counter assistant would hear them. */
interface Group {
  title: string;
  icon: LucideIcon;
  prompts: string[];
}

const MENU_QUESTIONS = ['Anything without nuts?', 'What’s good for a gift?'];
const PICKUP_QUESTIONS = ['When can I pick up?', 'How much is shipping?'];

function groupsFor(starters: string[]): Group[] {
  const asks = starters.filter((s) => s.trim().endsWith('?'));
  const orders = starters.filter((s) => !asks.includes(s));
  const menu = [...new Set([...asks, ...MENU_QUESTIONS])].slice(0, 3);
  return [
    { title: 'Order something', icon: ShoppingBag, prompts: orders },
    { title: 'Ask about the menu', icon: MessageCircleQuestion, prompts: menu },
    { title: 'Pickup and shipping', icon: Truck, prompts: PICKUP_QUESTIONS },
  ].filter((g) => g.prompts.length > 0);
}

function SuggestionGroup({ group, onPick }: { group: Group; onPick: (p: string) => void }) {
  const id = useId();
  const Icon = group.icon;
  return (
    <section aria-labelledby={id} className="cc-card overflow-hidden rounded-xl bg-surface">
      <h3 id={id} className="flex items-center gap-2.5 px-4 pt-4 pb-1.5 text-sm font-semibold text-ink-soft">
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-blush-band text-accent-ink">
          <Icon className="size-3.5" strokeWidth={2.25} />
        </span>
        {group.title}
      </h3>
      <ul className="flex flex-col pb-1.5">
        {group.prompts.map((p) => (
          <li key={p} className="cc-row">
            <button
              type="button"
              onClick={() => onPick(p)}
              className="press group flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left text-base leading-6 text-ink [--press-local:var(--press-scale-wide)] hover:bg-blush"
            >
              <span className="min-w-0 flex-1">{p}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Shelfie assistant", once at the head of each of the assistant's turns. */
function Speaker() {
  return (
    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
      <BotMark className="size-6" />
      Shelfie assistant
    </p>
  );
}

const SETTLED: Record<Extract<ApprovalCardView, { approve: false }>['label'], { icon: LucideIcon; note: string | null }> = {
  Paid: { icon: CircleCheck, note: null },
  'Confirming with PayPal': { icon: Hourglass, note: null },
  'Payment refused': { icon: CircleAlert, note: 'Nothing was charged.' },
  Cancelled: { icon: CircleX, note: 'Nothing was charged.' },
  Expired: { icon: CircleX, note: 'Nothing was charged.' },
};

const money = (raw: string | null) => {
  if (raw === null) return null;
  const c = parseAmountToCents(raw);
  return c === null ? `$${raw}` : formatUSD(c);
};

/** The distinct "Your order" block: lines, shipping, the total in large type, and the way to PayPal. */
function OrderSummary({ entry, order, shopName, fresh }: { entry: Extract<Entry, { kind: 'approval' }>; order: PlacedOrder; shopName: string; fresh: boolean }) {
  const cents = parseAmountToCents(entry.total);
  const reduce = useReducedMotion();
  const [countFrom, setCountFrom] = useState(fresh && !reduce && cents !== null ? 0 : cents);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one count-up from zero after the block mounts
    setCountFrom(cents);
  }, [cents]);
  const total = cents === null ? `$${entry.total}` : formatUSD(cents);
  const view = approvalCard(entry);
  const settled = view.approve ? null : SETTLED[view.label];
  const safe = isPayPalApprovalUrl(entry.approvalUrl);
  const number = entry.orderNumber ?? order.orderNumber;
  const shipping = money(order.shipping);
  const how = order.fulfillment === 'shipping' ? 'Shipping' : order.fulfillment === 'pickup' ? 'Pickup' : null;

  return (
    <article aria-label="Your order" className="cc-order rounded-xl bg-surface">
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-lg leading-6 font-bold text-ink">Your order</h3>
          <p className="type-meta text-ink-muted">
            {shopName}
            {number && <span className="type-price">{` · ${number}`}</span>}
          </p>
        </div>
        {how && <span className="shrink-0 rounded-full bg-blush-band px-2.5 py-1 text-xs leading-4 font-semibold text-ink">{how}</span>}
      </header>

      <ul className="mx-5 mt-4 flex flex-col gap-2.5 border-t border-line pt-4">
        {order.lines.map((l, i) => (
          <li key={`${l.name}-${l.option ?? ''}-${i}`} className="flex items-baseline gap-3 text-base leading-6">
            <span className="type-price w-7 shrink-0 font-semibold text-ink-muted">{l.quantity}×</span>
            <span className="min-w-0 flex-1 text-ink">
              {l.name}
              {l.option && <span className="text-ink-muted">{` (${l.option})`}</span>}
            </span>
            <span className="type-price shrink-0 text-ink">{money(l.lineTotal)}</span>
          </li>
        ))}
        {shipping && (
          <li className="flex items-baseline gap-3 text-base leading-6 text-ink-muted">
            <span aria-hidden className="w-7 shrink-0" />
            <span className="flex-1">Shipping</span>
            <span className="type-price shrink-0">{shipping}</span>
          </li>
        )}
      </ul>

      <div className="mx-5 mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
        <span className="pb-1 text-sm font-semibold text-ink-soft">Total</span>
        {cents === null || countFrom === null ? (
          <span className="type-price text-3xl leading-9 font-bold text-ink">{total}</span>
        ) : (
          <CountUp cents={countFrom} className="type-price text-3xl leading-9 font-bold text-ink" />
        )}
      </div>

      <div className="flex flex-col gap-3 p-5">
        {view.approve ? (
          <>
            {safe ? (
              <PayPalLink href={entry.approvalUrl} size="lg" fullWidth>
                Approve {total} on PayPal
              </PayPalLink>
            ) : (
              <FieldError>This approval link doesn’t go to PayPal, so it isn’t shown.</FieldError>
            )}
            <p className="flex items-center justify-center gap-1.5 text-sm text-ink-muted">
              <ShieldCheck aria-hidden className="size-4 shrink-0 text-ok" />
              Nothing is charged until you approve on PayPal.
            </p>
          </>
        ) : (
          <>
            <ButtonLink href={`/o/${encodeURIComponent(entry.orderRef)}`} icon={settled!.icon} size="lg" fullWidth>
              <StatusSwap value={view.label}>{view.label} · View receipt</StatusSwap>
            </ButtonLink>
            {settled!.note && <p className="text-center text-sm text-ink-muted">{settled!.note}</p>}
          </>
        )}
      </div>
    </article>
  );
}

/**
 * Mockup C (`/?chatui=c`), "Concierge drawer": a full-height blush drawer on the right of a desktop (a bottom sheet on
 * phones). Calm and roomy: the assistant writes plain text on the blush, the buyer's messages sit in white cards, the
 * suggestions come grouped as cards, and the order arrives as its own "Your order" block with the PayPal button.
 */
export function ChatC({ api, shopName, starters, titleId, titleRef, inputRef, onClose, isDesktop, greeting }: ChatVariantProps) {
  const { state, send } = api;
  // `send` is a fresh function on every render of HomeChat; the empty state only needs the latest one.
  const sendRef = useLatest(send);
  const groups = useMemo(() => groupsFor(starters), [starters]);

  const empty = useMemo(
    () => (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col items-start gap-4 pt-1">
          <BotMark className="cc-hello size-16" />
          <p className="text-lg leading-[1.6] text-ink">{greeting}</p>
        </div>
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <SuggestionGroup key={g.title} group={g} onPick={(p) => sendRef.current(p)} />
          ))}
        </div>
      </div>
    ),
    [greeting, groups, sendRef],
  );
  const typing = useMemo(() => <TypingDots className="pt-1 text-ink-muted" />, []);

  const order = useMemo(() => latestOrder(state), [state]);
  const renderEntry = useCallback(
    (entry: Entry, ctx: EntryContext): ReactNode => {
      const head = entry.kind !== 'user' && entry.kind !== 'error' && (ctx.prev === undefined || ctx.prev.kind === 'user') ? <Speaker /> : null;
      switch (entry.kind) {
        case 'user':
          return (
            <p className="cc-card ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-surface px-4 py-3 text-base leading-[1.6] whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
              {entry.text}
            </p>
          );
        case 'assistant':
          return (
            <div>
              {head}
              <RichText text={entry.text} className="cc-prose text-base leading-[1.6] text-ink [overflow-wrap:anywhere]" />
            </div>
          );
        case 'activity':
          return (
            <div>
              {head}
              <ActivityPanel calls={entry.calls} collapsed={ctx.collapsed} />
            </div>
          );
        case 'approval':
          return (
            <div>
              {head}
              {order && order.orderRef === entry.orderRef ? (
                <OrderSummary entry={entry} order={order} shopName={shopName} fresh={ctx.fresh} />
              ) : (
                <ApprovalCard entry={entry} shopName={shopName} fresh={ctx.fresh} />
              )}
            </div>
          );
        case 'error':
          return <FieldError>{entry.message}</FieldError>;
      }
    },
    [order, shopName],
  );

  const replies = quickReplies(state);
  const subtitle = `Concierge for ${shopName} · example shop`;

  return (
    <div data-chatui-root="c" className="cc-root flex h-full min-h-0 flex-col bg-blush text-ink">
      <header className={cn('flex shrink-0 items-center gap-3 border-b border-blush-band', isDesktop === false ? 'px-5 py-4' : 'px-6 py-5')}>
        <BotMark className={isDesktop === false ? 'size-10' : 'size-11'} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="text-lg leading-6 font-bold text-ink outline-none">
            Shelfie assistant
          </h2>
          <p className="text-sm leading-5 text-pretty text-ink-muted">{subtitle}</p>
        </div>
        {!state.busy && state.entries.length > 0 && !isConversationFull(state) && (
          <button
            type="button"
            aria-label="Start over"
            onClick={api.reset}
            className="press-icon grid size-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-blush-band hover:text-ink"
          >
            <RotateCcw aria-hidden className="size-[1.125rem]" />
          </button>
        )}
        <button
          type="button"
          aria-label="Close the chat"
          onClick={onClose}
          className="press-icon -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-blush-band hover:text-ink"
        >
          <X aria-hidden className="size-5" />
        </button>
      </header>

      <div className={cn('cc-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain', isDesktop === false ? 'px-5 py-5' : 'px-6 py-6')}>
        <ChatLog api={api} inputRef={inputRef} empty={empty} typing={typing} renderEntry={renderEntry} className="gap-6" />
      </div>

      <div className={cn('flex shrink-0 flex-col gap-3', isDesktop === false ? 'px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]' : 'px-6 pt-3 pb-6')}>
        {replies.length > 0 && (
          <ul aria-label="Quick replies" className="flex flex-wrap gap-2">
            {replies.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => send(r)}
                  className="press cc-card min-h-tap rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-blush-bar"
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
          placeholder="Ask, or tell me what you’d like"
          className="cc-composer flex items-end gap-2 rounded-xl bg-surface p-2 pl-1"
          boxClassName="block min-h-11 min-w-0 flex-1 resize-none overscroll-contain border-0 bg-transparent px-3 py-2.5 text-base leading-6 shadow-none outline-none hover:border-0 focus-visible:outline-none"
        />
      </div>
    </div>
  );
}

/** A ref that always holds the latest value, so memoised nodes can call the newest function. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
