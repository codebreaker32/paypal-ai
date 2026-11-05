// One-line summaries of agent-door tool calls for the Activity panel, and the raw request it expands to.
import { formatUSD, parseAmountToCents } from '@/lib/domain/money';
import type { ToolCall } from './console-state';

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const words = (s: string) => s.replace(/_/g, ' ');
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function argSummary(name: string, input: unknown): string {
  const a = rec(input);
  switch (name) {
    case 'get_shop_info':
      return 'no arguments';
    case 'list_products':
      if (typeof a.query === 'string' && a.query) return `query “${a.query}”`;
      if (typeof a.section === 'string' && a.section) return `section “${a.section}”`;
      return 'whole menu';
    case 'create_order': {
      const lines = Array.isArray(a.items) ? a.items : [];
      const qty = lines.reduce((sum: number, l) => sum + (typeof rec(l).quantity === 'number' ? (rec(l).quantity as number) : 0), 0);
      return [count(qty, 'item'), typeof a.fulfillment === 'string' ? a.fulfillment : null].filter(Boolean).join(' · ');
    }
    case 'get_order_status': {
      const ref = typeof a.order_ref === 'string' ? a.order_ref : '';
      return `order ${ref.length > 14 ? `${ref.slice(0, 12)}…` : ref}`;
    }
    default: {
      const json = JSON.stringify(input ?? {});
      return json.length > 60 ? `${json.slice(0, 59)}…` : json;
    }
  }
}

export function resultSummary(call: ToolCall): string {
  if (call.status === 'running') return 'waiting for the shop';
  if (call.status === 'interrupted') return 'no answer';
  const r = rec(call.result);
  if (call.status === 'error') {
    const code = rec(r.error).code;
    return typeof code === 'string' ? code : 'ERROR';
  }
  switch (call.name) {
    case 'get_shop_info':
      return `${String(r.shop_name ?? 'Shop')} · ${r.accepting_orders ? 'taking orders' : 'not taking orders'}`;
    case 'list_products': {
      const sections = Array.isArray(r.sections) ? r.sections : [];
      const items = sections.reduce((sum: number, s) => sum + (Array.isArray(rec(s).items) ? (rec(s).items as unknown[]).length : 0), 0);
      return `${count(items, 'item')} in ${count(sections.length, 'section')}`;
    }
    case 'create_order': {
      const cents = typeof r.total === 'string' ? parseAmountToCents(r.total) : null;
      return [r.order_number, cents === null ? null : formatUSD(cents), typeof r.status === 'string' ? words(r.status) : null]
        .filter(Boolean)
        .join(' · ');
    }
    case 'get_order_status':
      return typeof r.status === 'string' ? words(r.status) : 'ok';
    default:
      return 'ok';
  }
}

/** The MCP request the console sent for this call. */
export function requestJson(name: string, input: unknown): string {
  return JSON.stringify({ method: 'tools/call', params: { name, arguments: input ?? {} } }, null, 2);
}

/** Approval links are only shown when they go to PayPal over HTTPS. */
export function isPayPalApprovalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'paypal.com' || u.hostname.endsWith('.paypal.com'));
  } catch {
    return false;
  }
}
