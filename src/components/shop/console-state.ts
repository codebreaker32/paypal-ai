// The buyer console's conversation state, built from streamed ConsoleEvents. Pure, so it is unit-tested.
import type { ConsoleEvent } from '@/lib/agent/buyer-console';

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
  | { kind: 'approval'; key: string; approvalUrl: string; total: string; orderRef: string; orderNumber?: string }
  | { kind: 'error'; key: string; message: string };

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
  | { type: 'reset' };

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
      const entries = state.entries.map((entry) =>
        entry.kind === 'activity' && entry.calls.some((c) => c.id === e.id)
          ? {
              ...entry,
              calls: entry.calls.map((c) => (c.id === e.id ? { ...c, status: e.ok ? ('ok' as const) : ('error' as const), result: e.result, ms: e.ms } : c)),
            }
          : entry,
      );
      return { ...state, entries };
    }
    case 'approval':
      return {
        ...state,
        held: [...state.held, { kind: 'approval', approvalUrl: e.approvalUrl, total: e.total, orderRef: e.orderRef, orderNumber: e.orderNumber }],
      };
    case 'error':
      return push(endTurn(state), { kind: 'error', message: e.message });
    case 'done':
      return endTurn(state);
  }
}

// ---- saving across page loads (sessionStorage) ---------------------------------------------------------

const str = (v: unknown): v is string => typeof v === 'string';

function validEntry(raw: unknown): NewEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  switch (e.kind) {
    case 'user':
    case 'assistant':
      return str(e.text) ? { kind: e.kind, text: e.text } : null;
    case 'error':
      return str(e.message) ? { kind: 'error', message: e.message } : null;
    case 'approval':
      return str(e.approvalUrl) && str(e.total) && str(e.orderRef)
        ? { kind: 'approval', approvalUrl: e.approvalUrl, total: e.total, orderRef: e.orderRef, orderNumber: str(e.orderNumber) ? e.orderNumber : undefined }
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
