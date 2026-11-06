// The buyer console's conversation state, built from streamed ConsoleEvents. Pure, so it is unit-tested.
import type { ConsoleEvent } from '@/lib/agent/buyer-console';
import type { OrderStatus } from '@/lib/domain/types';

export type CallStatus = 'running' | 'ok' | 'error' | 'interrupted';

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  status: CallStatus;
  result?: unknown;
  ms?: number;
}

export type Entry =
  | { kind: 'user'; key: string; text: string }
  | { kind: 'assistant'; key: string; text: string }
  | { kind: 'activity'; key: string; calls: ToolCall[] }
  | {
      kind: 'approval';
      key: string;
      approvalUrl: string;
      total: string;
      orderRef: string;
      orderNumber?: string;
      /** The order's latest known status (from get_order_status or the receipt API); unknown means just placed. */
      status?: OrderStatus;
      /** PayPal refused to complete the approved payment. */
      captureRefused?: boolean;
    }
  | { kind: 'error'; key: string; message: string; code?: 'CONVERSATION_FULL' };

type ApprovalEntry = Omit<Extract<Entry, { kind: 'approval' }>, 'key'>;

export interface ConsoleState {
  sessionId: string | null;
  entries: Entry[];
  busy: boolean;
  nextKey: number;
  /** Approval cards wait for the end of the turn, so they sit under the assistant's "tap the PayPal button". */
  held: ApprovalEntry[];
}

export type ConsoleAction =
  | { type: 'send'; text: string }
  | { type: 'event'; event: ConsoleEvent }
  | { type: 'fail'; message: string }
  | { type: 'restore'; state: ConsoleState }
  | { type: 'reset' }
  /** The order behind an approval card, read from GET /api/orders/[ref]. */
  | { type: 'order_status'; orderRef: string; status: OrderStatus; captureRefused?: boolean };

export const initialConsoleState: ConsoleState = { sessionId: null, entries: [], busy: false, nextKey: 1, held: [] };

type NewEntry = Entry extends infer E ? (E extends Entry ? Omit<E, 'key'> : never) : never;

function push(state: ConsoleState, entry: NewEntry): ConsoleState {
  return { ...state, entries: [...state.entries, { ...entry, key: `e${state.nextKey}` } as Entry], nextKey: state.nextKey + 1 };
}

/** The turn is over: show the approval cards it produced, then stop being busy. */
function endTurn(state: ConsoleState): ConsoleState {
  const flushed = state.held.reduce((s, a) => push(s, a), state);
  return { ...flushed, held: [], busy: false };
}

export function consoleReducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  switch (action.type) {
    case 'send':
      return { ...push(state, { kind: 'user', text: action.text }), busy: true };
    case 'fail':
      return push(endTurn(state), { kind: 'error', message: action.message });
    case 'order_status':
      return withOrderStatus(state, action.orderRef, action.status, action.captureRefused);
    case 'restore':
      return action.state;
    case 'reset':
      return initialConsoleState;
    case 'event':
      return applyEvent(state, action.event);
  }
}

function applyEvent(state: ConsoleState, e: ConsoleEvent): ConsoleState {
  switch (e.type) {
    case 'session':
      return { ...state, sessionId: e.id };
    case 'text':
      return push(state, { kind: 'assistant', text: e.text });
    case 'tool_call': {
      const call: ToolCall = { id: e.id, name: e.name, input: e.input, status: 'running' };
      const last = state.entries.at(-1);
      if (last?.kind === 'activity') {
        return { ...state, entries: [...state.entries.slice(0, -1), { ...last, calls: [...last.calls, call] }] };
      }
      return push(state, { kind: 'activity', calls: [call] });
    }
    case 'tool_result': {
      const call = state.entries.flatMap((entry) => (entry.kind === 'activity' ? entry.calls : [])).find((c) => c.id === e.id);
      const entries = state.entries.map((entry) =>
        entry.kind === 'activity' && entry.calls.some((c) => c.id === e.id)
          ? {
              ...entry,
              calls: entry.calls.map((c) => (c.id === e.id ? { ...c, status: e.ok ? ('ok' as const) : ('error' as const), result: e.result, ms: e.ms } : c)),
            }
          : entry,
      );
      const next = { ...state, entries };
      // "Did my payment go through?": the answer moves the approval card of that order too.
      const r = e.result as { order_ref?: unknown; status?: unknown; capture_refused?: unknown } | null;
      if (call?.name === 'get_order_status' && e.ok && r && typeof r.order_ref === 'string' && isOrderStatus(r.status)) {
        return withOrderStatus(next, r.order_ref, r.status, typeof r.capture_refused === 'boolean' ? r.capture_refused : undefined);
      }
      return next;
    }
    case 'approval':
      return {
        ...state,
        held: [...state.held, { kind: 'approval', approvalUrl: e.approvalUrl, total: e.total, orderRef: e.orderRef, orderNumber: e.orderNumber }],
      };
    case 'error':
      return push(endTurn(state), { kind: 'error', message: e.message, ...(e.code ? { code: e.code } : {}) });
    case 'done':
      return endTurn(state);
  }
}

const ORDER_STATUSES: readonly OrderStatus[] = [
  'awaiting_approval', 'approved', 'payment_pending', 'paid', 'fulfilled', 'cancelled', 'expired', 'failed',
];
const isOrderStatus = (v: unknown): v is OrderStatus => typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v);

/** Sets the status of every approval card (shown or still held) for `orderRef`. */
function withOrderStatus(state: ConsoleState, orderRef: string, status: OrderStatus, captureRefused?: boolean): ConsoleState {
  const apply = <A extends ApprovalEntry>(a: A): A =>
    a.orderRef === orderRef ? { ...a, status, ...(captureRefused === undefined ? {} : { captureRefused }) } : a;
  return {
    ...state,
    entries: state.entries.map((entry) => (entry.kind === 'approval' ? apply(entry) : entry)),
    held: state.held.map(apply),
  };
}

export type ApprovalCardView =
  | { approve: true }
  | { approve: false; label: 'Paid' | 'Confirming with PayPal' | 'Payment refused' | 'Cancelled' | 'Expired'; tone: 'ok' | 'info' | 'danger' | 'neutral' };

/** The approval card offers PayPal only while the order waits for approval; after that it says what happened. */
export function approvalCard(entry: Pick<ApprovalEntry, 'status' | 'captureRefused'>): ApprovalCardView {
  switch (entry.status) {
    case undefined:
    case 'awaiting_approval':
      return { approve: true };
    case 'paid':
    case 'fulfilled':
      return { approve: false, label: 'Paid', tone: 'ok' };
    case 'approved':
      return entry.captureRefused
        ? { approve: false, label: 'Payment refused', tone: 'danger' }
        : { approve: false, label: 'Confirming with PayPal', tone: 'info' };
    case 'payment_pending':
      return { approve: false, label: 'Confirming with PayPal', tone: 'info' };
    case 'failed':
      return { approve: false, label: 'Payment refused', tone: 'danger' };
    case 'cancelled':
      return { approve: false, label: 'Cancelled', tone: 'neutral' };
    case 'expired':
      return { approve: false, label: 'Expired', tone: 'neutral' };
  }
}

/** Orders behind approval cards that PayPal may still move (waiting, or being confirmed), each once. */
export function refsToCheck(state: ConsoleState): string[] {
  const open = (a: ApprovalEntry) => {
    const view = approvalCard(a);
    return view.approve || view.label === 'Confirming with PayPal';
  };
  const refs = state.entries.filter((e): e is Extract<Entry, { kind: 'approval' }> => e.kind === 'approval' && open(e)).map((e) => e.orderRef);
  return [...new Set(refs)];
}

/** How often the console re-reads its orders while a card says "Confirming with PayPal" (the receipt's pace). */
export const CONFIRM_POLL_MS = 3000;

/** True while some approval card says "Confirming with PayPal": the poller or webhook may finish it any moment. */
export function confirmingWithPayPal(state: ConsoleState): boolean {
  return state.entries.some((e) => {
    if (e.kind !== 'approval') return false;
    const view = approvalCard(e);
    return !view.approve && view.label === 'Confirming with PayPal';
  });
}

/** Runs `check` every `ms`, each wait starting once the previous check is done. Returns a function that stops it. */
export function pollEvery(ms: number, check: () => Promise<void>): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    await check();
    if (!stopped) timer = setTimeout(tick, ms);
  };
  timer = setTimeout(tick, ms);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/**
 * Where the latest turn starts on screen: the first reply entry after the buyer's latest message (its Activity card),
 * or the message itself while no reply has arrived. -1 when there is nothing to show.
 */
export function turnStartIndex(entries: Pick<Entry, 'kind'>[]): number {
  if (!entries.length) return -1;
  let user = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].kind === 'user') {
      user = i;
      break;
    }
  }
  if (user === -1) return 0;
  return user + 1 < entries.length ? user + 1 : user;
}

// ---- saving across page loads (sessionStorage) ---------------------------------------------------------

const str = (v: unknown): v is string => typeof v === 'string';

/**
 * What the console saves to sessionStorage. Approval cards still held for the end of the turn are saved too, so a
 * reload while the assistant is still writing doesn't lose the order's PayPal button.
 */
export function consoleToSave(state: ConsoleState): { sessionId: string | null; entries: unknown[] } {
  return { sessionId: state.sessionId, entries: [...state.entries, ...state.held] };
}

function validEntry(raw: unknown): NewEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  switch (e.kind) {
    case 'user':
    case 'assistant':
      return str(e.text) ? { kind: e.kind, text: e.text } : null;
    case 'error':
      return str(e.message) ? { kind: 'error', message: e.message, ...(e.code === 'CONVERSATION_FULL' ? { code: e.code } : {}) } : null;
    case 'approval':
      return str(e.approvalUrl) && str(e.total) && str(e.orderRef)
        ? {
            kind: 'approval',
            approvalUrl: e.approvalUrl,
            total: e.total,
            orderRef: e.orderRef,
            orderNumber: str(e.orderNumber) ? e.orderNumber : undefined,
            ...(isOrderStatus(e.status) ? { status: e.status } : {}),
            ...(typeof e.captureRefused === 'boolean' ? { captureRefused: e.captureRefused } : {}),
          }
        : null;
    case 'activity': {
      if (!Array.isArray(e.calls)) return null;
      const calls = e.calls
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object' && str(c.id) && str(c.name))
        .map((c): ToolCall => ({
          id: c.id as string,
          name: c.name as string,
          input: c.input,
          status: c.status === 'ok' || c.status === 'error' ? c.status : 'interrupted',
          result: c.result,
          ms: typeof c.ms === 'number' ? c.ms : undefined,
        }));
      return calls.length ? { kind: 'activity', calls } : null;
    }
    default:
      return null;
  }
}

/** Rebuilds a saved conversation. Never busy; calls that never got an answer are marked interrupted. */
export function restoreConsoleState(saved: unknown): ConsoleState {
  if (!saved || typeof saved !== 'object') return initialConsoleState;
  const s = saved as { sessionId?: unknown; entries?: unknown };
  if (!Array.isArray(s.entries)) return initialConsoleState;
  let state: ConsoleState = { ...initialConsoleState, sessionId: str(s.sessionId) ? s.sessionId : null };
  for (const raw of s.entries) {
    const entry = validEntry(raw);
    if (entry) state = push(state, entry);
  }
  return state;
}
