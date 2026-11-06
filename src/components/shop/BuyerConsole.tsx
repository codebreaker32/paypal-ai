'use client';

import { useCallback, useEffect, useId, useReducer, useRef, useState, type FormEvent, type RefObject } from 'react';
import {
  Bot,
  CircleAlert,
  CircleCheck,
  CircleX,

  Hourglass,
  RotateCcw,
  SendHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import type { ConsoleEvent } from '@/lib/agent/buyer-console';
import { formatUSD, parseAmountToCents } from '@/lib/domain/money';
import type { OrderStatus } from '@/lib/domain/types';
import { Button, ButtonLink, buttonClasses } from '@/components/ui/button';
import { FieldError, TextInput } from '@/components/ui/field';
import { cx } from '@/components/ui/cx';
import { Icon } from '@/components/ui/icon';
import { CountUp } from '@/components/motion/count-up';
import { Pressable } from '@/components/motion/pressable';
import { StatusSwap } from '@/components/motion/status-swap';
import { EASE_OUT, MOTION_S } from '@/components/motion/tokens';
import { ActivityPanel } from './ActivityPanel';
import { isPayPalApprovalUrl } from './activity-format';
import {
  approvalCard,
  CONFIRM_POLL_FOR_MS,
  CONFIRM_POLL_MS,
  confirmingWithPayPal,
  consoleReducer,
  consoleToSave,
  firstFreshEntry,
  initialConsoleState,
  pollEvery,
  refsToCheck,
  restoreConsoleState,
  turnStartIndex,
  type ApprovalCardView,
  type ConsoleState,
  type Entry,
} from './console-state';
import { RichText } from './RichText';
import './console-motion.css';

const SHOP_DIDNT_ANSWER = "The shop didn’t answer. Try again.";
const RATE_LIMITED = "You’ve sent a lot of messages in the last hour. Try again later.";
export const PAYMENT_CHECK_PROMPT = 'Did my payment go through?';

export interface BuyerConsoleApi {
  /** Includes `restored`: how many entries came back from sessionStorage (shown without an entrance; 0 after a reset). */
  state: ConsoleState;
  send: (text: string) => void;
  reset: () => void;
}

/**
 * Conversation state for one shop, kept in sessionStorage so it survives the trip to PayPal and back. Approval cards
 * follow their order: the hook re-reads each open order from the receipt API after a reload and whenever the page is
 * shown again, so a paid order never still offers "Approve on PayPal".
 */
export function useBuyerConsole(slug: string): BuyerConsoleApi {
  const [state, dispatch] = useReducer(consoleReducer, initialConsoleState);
  const storageKey = `shelfie:console:${slug}`;
  const latest = useRef(state);
  const loaded = useRef(false);
  /** The turn being streamed: aborted when the console goes away, so a closed page stops the assistant. */
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    latest.current = state;
  }, [state]);

  // Abort only on a real unmount: React's dev StrictMode unmounts and remounts once on hydration, and a starter tapped
  // in that instant would otherwise lose its turn and sit on "Thinking…". The remount lands before the timeout runs.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const turn = inflight.current;
      setTimeout(() => {
        if (!mounted.current) turn?.abort();
      }, 0);
    };
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        dispatch({ type: 'restore', state: restoreConsoleState(JSON.parse(saved)) });
      }
    } catch {
      // Private mode or bad data: start with an empty conversation.
    }
    loaded.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (state.entries.length) sessionStorage.setItem(storageKey, JSON.stringify(consoleToSave(state)));
      else sessionStorage.removeItem(storageKey);
    } catch {
      // Storage full or unavailable: the conversation still works for this page view.
    }
  }, [state, storageKey]);

  const checkOrders = useCallback(async () => {
    await Promise.all(
      refsToCheck(latest.current).map(async (ref) => {
        try {
          const res = await fetch(`/api/orders/${encodeURIComponent(ref)}`, { cache: 'no-store' });
          if (!res.ok) return;
          const { order } = (await res.json()) as { order: { status: OrderStatus; captureRefused?: boolean } };
          dispatch({ type: 'order_status', orderRef: ref, status: order.status, captureRefused: order.captureRefused });
        } catch {
          // Offline for a moment: the card keeps what it knew.
        }
      }),
    );
  }, []);

  const openOrders = refsToCheck(state).join(' ');
  useEffect(() => {
    if (loaded.current && openOrders) void checkOrders();
  }, [openOrders, checkOrders]);

  // A card saying "Confirming with PayPal" keeps its order's refs unchanged, so re-read on a timer until none does.
  const confirming = confirmingWithPayPal(state);
  useEffect(() => (confirming ? pollEvery(CONFIRM_POLL_MS, checkOrders, CONFIRM_POLL_FOR_MS) : undefined), [confirming, checkOrders]);

  // Back from PayPal with the browser's Back button (bfcache), or back to this tab.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === 'visible') void checkOrders();
    };
    window.addEventListener('pageshow', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      window.removeEventListener('pageshow', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, [checkOrders]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, 500);
      if (!text || latest.current.busy) return;
      const sessionId = latest.current.sessionId;
      dispatch({ type: 'send', text });
      const turn = new AbortController();
      inflight.current = turn;
      void (async () => {
        try {
          const res = await fetch(`/api/assistant/${encodeURIComponent(slug)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(sessionId ? { text, sessionId } : { text }),
            signal: turn.signal,
          });
          if (!res.ok || !res.body) {
            const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
            dispatch({ type: 'fail', message: res.status === 429 ? (body?.error?.message ?? RATE_LIMITED) : SHOP_DIDNT_ANSWER });
            return;
          }
          let finished = false;
          for await (const event of readNdjson(res.body)) {
            dispatch({ type: 'event', event });
            if (event.type === 'done' || event.type === 'error') finished = true;
          }
          if (!finished) dispatch({ type: 'fail', message: SHOP_DIDNT_ANSWER });
        } catch {
          // Aborted because the console went away: nobody is left to tell.
          if (!turn.signal.aborted) dispatch({ type: 'fail', message: SHOP_DIDNT_ANSWER });
        } finally {
          if (inflight.current === turn) inflight.current = null;
        }
      })();
    },
    [slug],
  );

  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  return { state, send, reset };
}

async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<ConsoleEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as ConsoleEvent;
    }
    if (done) break;
  }
  if (buffer.trim()) yield JSON.parse(buffer) as ConsoleEvent;
}

// ---- conversation --------------------------------------------------------------------------------------

function UserBubble({ text }: { text: string }) {
  return (
    <p className="ml-auto max-w-[85%] rounded-md rounded-br-none bg-ink px-3.5 py-2.5 text-sm leading-5 whitespace-pre-wrap text-surface [overflow-wrap:anywhere]">
      {text}
    </p>
  );
}

function AssistantSays({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-surface">
        <Icon icon={Bot} size="sm" label="Assistant" />
      </span>
      <RichText text={text} className="min-w-0 flex-1 pt-1 text-sm leading-6 [overflow-wrap:anywhere]" />
    </div>
  );
}

/** After approval the card links the receipt; the button says what happened. */
const SETTLED: Record<Extract<ApprovalCardView, { approve: false }>['label'], { icon: LucideIcon; note: string | null }> = {
  Paid: { icon: CircleCheck, note: null },
  'Confirming with PayPal': { icon: Hourglass, note: null },
  'Payment refused': { icon: CircleAlert, note: 'Nothing was charged.' },
  Cancelled: { icon: CircleX, note: 'Nothing was charged.' },
  Expired: { icon: CircleX, note: 'Nothing was charged.' },
};

/**
 * The order to approve. A card that arrives during the conversation counts its total up from zero once (a card restored
 * after the trip to PayPal shows its total as is); the PayPal button presses in; a status change crossfades.
 */
function ApprovalCard({ entry, shopName, fresh }: { entry: Extract<Entry, { kind: 'approval' }>; shopName: string; fresh: boolean }) {
  const cents = parseAmountToCents(entry.total);
  const reduce = useReducedMotion();
  const [countFrom, setCountFrom] = useState(fresh && !reduce && cents !== null ? 0 : cents);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one count-up from zero after the card mounts
    setCountFrom(cents);
  }, [cents]);
  const total = cents === null ? `$${entry.total}` : formatUSD(cents);
  const safe = isPayPalApprovalUrl(entry.approvalUrl);
  const view = approvalCard(entry);
  const settled = view.approve ? null : SETTLED[view.label];
  return (
    <div className="flex flex-col gap-3 rounded-(--card-radius) bg-surface-sunken p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-lg leading-6 font-bold">{shopName}</span>
          {entry.orderNumber && <span className="type-meta type-price text-ink-muted">Order {entry.orderNumber}</span>}
        </span>
        {cents === null || countFrom === null ? (
          <span className="type-price text-xl font-semibold">{total}</span>
        ) : (
          <CountUp cents={countFrom} className="type-price text-xl font-semibold" />
        )}
      </div>
      {view.approve ? (
        <>
          {safe ? (
            <Pressable
              as="a"
              lift={false}
              href={entry.approvalUrl}
              className={cx(buttonClasses({ variant: 'paypal', fullWidth: true }), 'active:scale-[0.97]')}
            >
              Approve {total} on PayPal
            </Pressable>
          ) : (
            <FieldError>This approval link doesn’t go to PayPal, so it isn’t shown.</FieldError>
          )}
          <p className="type-meta text-ink-muted">Nothing is charged until you approve on PayPal.</p>
        </>
      ) : (
        <>
          <ButtonLink href={`/o/${encodeURIComponent(entry.orderRef)}`} icon={settled!.icon} fullWidth>
            <StatusSwap value={view.label}>{view.label} · View receipt</StatusSwap>
          </ButtonLink>
          {settled!.note && <p className="type-meta text-ink-muted">{settled!.note}</p>}
        </>
      )}
    </div>
  );
}

function EntryView({ entry, shopName, fresh }: { entry: Entry; shopName: string; fresh: boolean }) {
  switch (entry.kind) {
    case 'user':
      return <UserBubble text={entry.text} />;
    case 'assistant':
      return <AssistantSays text={entry.text} />;
    case 'activity':
      return <ActivityPanel calls={entry.calls} />;
    case 'approval':
      return <ApprovalCard entry={entry} shopName={shopName} fresh={fresh} />;
    case 'error':
      return <FieldError>{entry.message}</FieldError>;
  }
}

function Starters({ prompts, onPick, disabled }: { prompts: string[]; onPick: (p: string) => void; disabled?: boolean }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Try asking">
      {prompts.map((p) => (
        <li key={p}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(p)}
            className="flex min-h-tap w-full items-center rounded-(--radius-xl) bg-surface-sunken px-4 py-2.5 text-left text-sm font-semibold text-ink transition-[background-color,transform] duration-(--duration-fast) ease-out hover:bg-line active:scale-[0.98] disabled:opacity-50 motion-reduce:active:scale-100"
          >
            <span className="flex-1">{p}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface ConsoleConversationProps {
  api: BuyerConsoleApi;
  shopName: string;
  starters: string[];
}

/** The chat: an empty state with starter prompts, the turns with their Activity, approval cards, and a status line. */
export function ConsoleConversation({ api, shopName, starters }: ConsoleConversationProps) {
  const { state, send, reset } = api;
  const end = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const last = state.entries.at(-1);
  const calling = last?.kind === 'activity' && last.calls.some((c) => c.status === 'running');
  // Offer the status question only while an order may still change; a full conversation offers a new one.
  const waitingOnPayPal = refsToCheck(state).length > 0;
  const full = last?.kind === 'error' && last.code === 'CONVERSATION_FULL';

  // Follow new content, but never past the start of the latest turn: when a reply is taller than the log, its
  // Activity card stays at the top (under the sheet or panel title) and the buyer scrolls on from there.
  const anchor = turnStartIndex(state.entries);
  // How many entries the conversation had when it was first shown (restored from sessionStorage or empty). A reset
  // empties it, and from then on everything is new (adjusted during render, so the next entry already rises in).
  const [shownAtOpen, setShownAtOpen] = useState(state.entries.length);
  if (shownAtOpen > 0 && state.entries.length === 0) setShownAtOpen(0);
  const freshFrom = firstFreshEntry(state, shownAtOpen);
  // Found once per mount (the log moves between the sheet and the panel by remounting), not on every streamed event.
  const scrollerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const endEl = end.current;
    if (!endEl) return;
    if (!scrollerRef.current?.contains(endEl)) {
      scrollerRef.current = scrollParentOf(endEl) ?? (document.scrollingElement as HTMLElement | null);
    }
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // The page itself scrolls against the viewport, not against its own (full-height) box.
    const box = scroller === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
    const toEnd = scroller.scrollTop + endEl.getBoundingClientRect().bottom - box.bottom + parseFloat(getComputedStyle(scroller).paddingBottom);
    const start = anchor >= 0 ? log.current?.children[anchor] : undefined;
    const toStart = start ? scroller.scrollTop + start.getBoundingClientRect().top - box.top - parseFloat(getComputedStyle(scroller).paddingTop) : Infinity;
    const target = Math.min(toEnd, toStart);
    // Only ever move down: a buyer who scrolled further on keeps their place.
    if (target > scroller.scrollTop) scroller.scrollTop = target;
  }, [state.entries, state.busy, anchor]);

  if (!state.entries.length) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base leading-6 text-ink">
          Hi! I’m Claude. Tell me what you’d like from {shopName}, and you’ll approve the payment on PayPal.
        </p>
        <Starters prompts={starters} onPick={send} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={log} role="log" aria-label="Conversation" className="flex flex-col gap-4">
        {/* Each new message, Activity card and order card rises in as it arrives (one after another as they stream);
            what was already there when the console opened (a restored conversation) shows as is. */}
        {state.entries.map((entry, i) => {
          const fresh = i >= freshFrom;
          return (
            <m.div
              key={entry.key}
              initial={fresh ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: MOTION_S.base, ease: EASE_OUT }}
            >
              <EntryView entry={entry} shopName={shopName} fresh={fresh} />
            </m.div>
          );
        })}
      </div>
      {state.busy && !calling && (
        <p className="flex items-center gap-2.5 text-sm text-ink-muted" role="status">
          <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-surface">
            <Icon icon={Bot} size="sm" />
          </span>
          <span className="bc-thinking font-semibold">Thinking…</span>
        </p>
      )}
      {!state.busy && (
        <div className="flex flex-wrap items-center gap-2">
          {waitingOnPayPal && !full && (
            <Button variant="secondary" onClick={() => send(PAYMENT_CHECK_PROMPT)}>
              {PAYMENT_CHECK_PROMPT}
            </Button>
          )}
          {full ? (
            <Button variant="primary" icon={RotateCcw} onClick={reset}>
              Start a new conversation
            </Button>
          ) : (
            <Button variant="ghost" icon={RotateCcw} onClick={reset}>
              Start over
            </Button>
          )}
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

/** The nearest ancestor that scrolls vertically: the sheet's body on phones, the side panel's log on desktop. */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return null;
}

/** The message box. Enter sends. Typing ahead is fine while the assistant works; sending waits. */
export function ConsoleComposer({ api, inputRef }: { api: BuyerConsoleApi; inputRef?: RefObject<HTMLInputElement | null> }) {
  const [text, setText] = useState('');
  const id = useId();
  const busy = api.state.busy;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    api.send(text);
    setText('');
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Message to the assistant
      </label>
      <TextInput
        ref={inputRef}
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        autoComplete="off"
        enterKeyHint="send"
        placeholder="Message the assistant"
        className="min-w-0 flex-1"
      />
      <Button type="submit" icon={SendHorizontal} loading={busy} disabled={!text.trim()} className="shrink-0">
        Send
      </Button>
    </form>
  );
}
