// The buyer console's plain-language steps: one short line per agent-door tool call ("Checked the menu", "Placed your
// order · $27.00 · waiting for your PayPal approval"), read only from the call's real result. No tool names, timings
// or counts of calls: those stay in the console's Details view. Pure, so it is unit-tested.
import { formatUSD, parseAmountToCents } from '@/lib/domain/money';

export type StepState = 'running' | 'done' | 'error';

export interface StepCall {
  name: string;
  status: 'running' | 'ok' | 'error' | 'interrupted';
  result?: unknown;
}

export interface FriendlyStep {
  label: string;
  state: StepState;
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

const STATUS_WORDS: Record<string, string> = {
  awaiting_approval: 'waiting for your PayPal approval',
  approved: 'approved, payment on its way',
  paid: 'paid',
  payment_pending: 'payment pending at PayPal',
  failed: 'payment failed',
  cancelled: 'cancelled',
  expired: 'expired',
  fulfilled: 'completed by the shop',
};

/** An order status in plain words ("awaiting_approval" → "waiting for your PayPal approval"). */
export function statusWords(status: unknown): string | null {
  if (typeof status !== 'string' || !status) return null;
  return STATUS_WORDS[status] ?? status.replace(/_/g, ' ');
}

/** Each tool's step while it runs, when it is done, and when it fails. */
const PHRASES: Record<string, { running: string; done: string; error: string }> = {
  get_shop_info: { running: 'Looking up the shop', done: 'Looked up the shop', error: 'Couldn’t look up the shop. Try again.' },
  list_products: { running: 'Checking the menu', done: 'Checked the menu', error: 'Couldn’t check the menu. Try again.' },
  create_order: { running: 'Placing your order', done: 'Placed your order', error: 'Couldn’t place the order. Try again.' },
  get_order_status: { running: 'Checking your order', done: 'Checked your order', error: 'Couldn’t check your order. Try again.' },
};

const OTHER = { running: 'Asking the shop', done: 'Asked the shop', error: 'The shop couldn’t answer that. Try again.' };

function itemsFound(result: unknown): unknown[] {
  const sections = rec(result).sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((s) => (Array.isArray(rec(s).items) ? (rec(s).items as unknown[]) : []));
}

function money(v: unknown): string | null {
  const cents = typeof v === 'string' ? parseAmountToCents(v) : null;
  return cents === null ? null : formatUSD(cents);
}

/** The plain step for one tool call. */
export function friendlyStep(call: StepCall): FriendlyStep {
  const phrases = PHRASES[call.name] ?? OTHER;
  if (call.status === 'running') return { label: `${phrases.running}…`, state: 'running' };
  if (call.status === 'interrupted') return { label: 'The shop didn’t answer', state: 'error' };
  if (call.status === 'error') return { label: phrases.error, state: 'error' };

  const r = rec(call.result);
  switch (call.name) {
    case 'list_products': {
      // One item is named ("Found Almond croissant"), so two searches in a row don't read as the same line twice.
      const items = itemsFound(call.result);
      const only = items.length === 1 ? rec(items[0]).name : null;
      if (typeof only === 'string' && only.trim()) return { label: `Found ${only.trim()}`, state: 'done' };
      return { label: items.length ? `Found ${items.length} ${items.length === 1 ? 'item' : 'items'}` : phrases.done, state: 'done' };
    }
    case 'create_order': {
      const parts = [phrases.done, money(r.total), statusWords(r.status)].filter(Boolean);
      return { label: parts.join(' · '), state: 'done' };
    }
    case 'get_order_status': {
      const words = statusWords(r.status);
      return { label: words ? `${phrases.done}: ${words}` : phrases.done, state: 'done' };
    }
    default:
      return { label: phrases.done, state: 'done' };
  }
}
