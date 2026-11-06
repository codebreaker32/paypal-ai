'use client';

import { useCallback, useEffect, useId, useReducer, useRef, useState, type FormEvent, type RefObject } from 'react';
import {
  Bot,
  CircleAlert,
  CircleCheck,
  CircleX,
  CornerDownLeft,
  Hourglass,
  Loader2,
  RotateCcw,
  SendHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { ConsoleEvent } from '@/lib/agent/buyer-console';
import { formatUSD, parseAmountToCents } from '@/lib/domain/money';
import type { OrderStatus } from '@/lib/domain/types';
import { Button, ButtonLink, buttonClasses } from '@/components/ui/Button';
import { FieldError, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { ActivityPanel } from './ActivityPanel';
import { isPayPalApprovalUrl } from './activity-format';
import {
  approvalCard,
  consoleReducer,
  initialConsoleState,
  refsToCheck,
  restoreConsoleState,
  type ApprovalCardView,
  type ConsoleState,
  type Entry,
} from './console-state';
import { RichText } from './RichText';

const SHOP_DIDNT_ANSWER = "The shop didn’t answer. Try again.";
const RATE_LIMITED = "You’ve sent a lot of messages in the last hour. Try again later.";
export const PAYMENT_CHECK_PROMPT = 'Did my payment go through?';

export interface BuyerConsoleApi {
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

  useEffect(() => () => inflight.current?.abort(), []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) dispatch({ type: 'restore', state: restoreConsoleState(JSON.parse(saved)) });
    } catch {
      // Private mode or bad data: start with an empty conversation.
    }
    loaded.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (state.entries.length) sessionStorage.setItem(storageKey, JSON.stringify({ sessionId: state.sessionId, entries: state.entries }));
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

  // Back from PayPal with the browser’s Back button (bfcache), or back to this tab.
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
    <p className="ml-auto max-w-[85%] rounded-md rounded-br-xs bg-ink px-3.5 py-2.5 text-sm leading-5 whitespace-pre-wrap text-surface [overflow-wrap:anywhere]">
      {text}
    </p>
  );
}

function AssistantSays({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent-ink">
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

function ApprovalCard({ entry, shopName }: { entry: Extract<Entry, { kind: 'approval' }>; shopName: string }) {
  const cents = parseAmountToCents(entry.total);
  const total = cents === null ? `$${entry.total}` : formatUSD(cents);
  const safe = isPayPalApprovalUrl(entry.approvalUrl);
  const view = approvalCard(entry);
  const settled = view.approve ? null : SETTLED[view.label];
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-line-strong border-t-4 border-t-ink bg-surface-raised p-3 shadow-xs">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{shopName}</span>
          {entry.orderNumber && (
            <span className="type-meta text-ink-muted">
              Order <span className="type-ref">{entry.orderNumber}</span>
            </span>
          )}
        </span>
        <span className="type-amount rule-total text-xl">{total}</span>
      </div>
      {view.approve ? (
        <>
          {safe ? (
            <a href={entry.approvalUrl} className={buttonClasses({ variant: 'paypal', fullWidth: true })}>
              Approve {total} on PayPal
            </a>
          ) : (
            <FieldError>This approval link doesn’t go to PayPal, so it isn’t shown.</FieldError>
          )}
          <p className="type-meta text-ink-muted">Nothing is charged until you approve on PayPal.</p>
        </>
      ) : (
        <>
          <ButtonLink href={`/o/${encodeURIComponent(entry.orderRef)}`} icon={settled!.icon} fullWidth>
            {view.label} · View receipt
          </ButtonLink>
          {settled!.note && <p className="type-meta text-ink-muted">{settled!.note}</p>}
        </>
      )}
    </div>
  );
}

function EntryView({ entry, shopName }: { entry: Entry; shopName: string }) {
  switch (entry.kind) {
    case 'user':
      return <UserBubble text={entry.text} />;
    case 'assistant':
      return <AssistantSays text={entry.text} />;
    case 'activity':
      return <ActivityPanel calls={entry.calls} />;
    case 'approval':
      return <ApprovalCard entry={entry} shopName={shopName} />;
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
            className="flex min-h-tap w-full items-center gap-2.5 rounded-md border border-line-strong bg-surface-raised px-3.5 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:border-control hover:bg-surface-sunken disabled:opacity-50"
          >
            <Icon icon={CornerDownLeft} size="sm" className="text-ink-muted" />
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
  const last = state.entries.at(-1);
  const calling = last?.kind === 'activity' && last.calls.some((c) => c.status === 'running');
  // Offer the status question only while an order may still change; a full conversation offers a new one.
  const waitingOnPayPal = refsToCheck(state).length > 0;
  const full = last?.kind === 'error' && last.code === 'CONVERSATION_FULL';

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [state.entries, state.busy]);

  if (!state.entries.length) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-6 text-ink-soft">
          Ask in your own words. This assistant is Claude, and it orders from {shopName} through the shop’s agent door,
          the same one any AI assistant can use. Every step it takes shows up here, and you approve payment on PayPal.
        </p>
        <Starters prompts={starters} onPick={send} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="log" aria-label="Conversation" className="flex flex-col gap-4">
        {state.entries.map((entry) => (
          <EntryView key={entry.key} entry={entry} shopName={shopName} />
        ))}
      </div>
      {state.busy && !calling && (
        <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
          <Icon icon={Loader2} size="sm" className="animate-spin" />
          Thinking…
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
