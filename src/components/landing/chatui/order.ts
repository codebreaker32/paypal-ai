// What the mockups read out of the console's state: the latest order the assistant placed, and contextual quick replies.
import { PAYMENT_CHECK_PROMPT } from '@/components/shop/BuyerConsole';
import { approvalCard, refsToCheck, type ApprovalCardView, type ConsoleState, type Entry } from '@/components/shop/console-state';
import type { ChatMenuItem } from './types';

export interface OrderLine {
  name: string;
  option: string | null;
  quantity: number;
  lineTotal: string;
}

export interface PlacedOrder {
  orderRef: string;
  orderNumber: string | null;
  fulfillment: string | null;
  lines: OrderLine[];
  itemsTotal: string | null;
  shipping: string | null;
  total: string;
  /** The approval card for this order once the turn has ended (it carries the PayPal link and the latest status). */
  approval: Extract<Entry, { kind: 'approval' }> | null;
  view: ApprovalCardView | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** The newest order created in this conversation (from create_order's result), or null. */
export function latestOrder(state: ConsoleState): PlacedOrder | null {
  for (let i = state.entries.length - 1; i >= 0; i--) {
    const e = state.entries[i];
    if (e.kind !== 'activity') continue;
    for (let j = e.calls.length - 1; j >= 0; j--) {
      const c = e.calls[j];
      if (c.name !== 'create_order' || c.status !== 'ok' || !c.result || typeof c.result !== 'object') continue;
      const r = c.result as Record<string, unknown>;
      const orderRef = str(r.order_ref);
      const total = str(r.total);
      if (!orderRef || !total) continue;
      const lines = Array.isArray(r.lines)
        ? r.lines.flatMap((l) => {
            const o = l as Record<string, unknown>;
            return typeof o.name === 'string' && typeof o.quantity === 'number'
              ? [{ name: o.name, option: str(o.option), quantity: o.quantity, lineTotal: str(o.line_total) ?? '' }]
              : [];
          })
        : [];
      const approval = state.entries.find((x): x is Extract<Entry, { kind: 'approval' }> => x.kind === 'approval' && x.orderRef === orderRef) ?? null;
      return {
        orderRef,
        orderNumber: str(r.order_number),
        fulfillment: str(r.fulfillment),
        lines,
        itemsTotal: str(r.items_total),
        shipping: str(r.shipping),
        total,
        approval,
        view: approval ? approvalCard(approval) : null,
      };
    }
  }
  return null;
}

/** Short replies that fit where the conversation is: confirm a read-back order, or ask after a payment. */
export function quickReplies(state: ConsoleState): string[] {
  if (state.busy) return [];
  const last = state.entries.at(-1);
  if (!last) return [];
  if (refsToCheck(state).length > 0) return [PAYMENT_CHECK_PROMPT];
  if (last.kind === 'assistant' && /\b(place it|confirm|shall i|should i)\b/i.test(last.text)) return ['Yes, place it', 'Make it pickup instead'];
  return [];
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();

/** Menu items a reply names, in the order it names them (whole names only, so "croissant" alone matches nothing). */
export function itemsMentioned(text: string, menu: readonly ChatMenuItem[]): ChatMenuItem[] {
  const t = ` ${norm(text)} `;
  return menu
    .map((item) => ({ item, at: t.indexOf(` ${norm(item.name)} `) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.item);
}
