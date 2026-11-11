// What the home chat reads out of the console's state: the latest order the assistant placed, the menu items a reply
// names (from the turn's list_products results), and contextual quick replies.
import { PAYMENT_CHECK_PROMPT } from '@/components/shop/BuyerConsole';
import { approvalCard, refsToCheck, type ApprovalCardView, type ConsoleState, type Entry } from '@/components/shop/console-state';
import { parseAmountToCents } from '@/lib/domain/money';
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

/** How a read-back says the order reaches the buyer, or null when it names neither or both. */
export function readBackFulfillment(text: string): 'pickup' | 'shipping' | null {
  // "no shipping fee" or "free delivery" says nothing about shipping this order.
  const t = text.replace(/\b(?:no|free|without)\s+(?:shipping|delivery)(?:\s+(?:fee|cost|charge))?/gi, ' ');
  const pickup = /\bpick(?:ing)?[- ]?up\b|\bcollect(?:ion|ing)?\b/i.test(t);
  const shipping = /\bship(?:s|ped|ping)?\b|\bdeliver(?:y|ed|s)?\b|\bpost(?:ed|age)\b|\bmail(?:ed)?\b/i.test(t);
  if (pickup === shipping) return null;
  return pickup ? 'pickup' : 'shipping';
}

/**
 * Short replies that fit where the conversation is: confirm a read-back order (with the other way to get it when the
 * read-back names one), or ask after a payment.
 */
export function quickReplies(state: ConsoleState): string[] {
  if (state.busy) return [];
  const last = state.entries.at(-1);
  if (!last) return [];
  if (refsToCheck(state).length > 0) return [PAYMENT_CHECK_PROMPT];
  if (last.kind === 'assistant' && /\b(place it|confirm|shall i|should i)\b/i.test(last.text)) {
    const way = readBackFulfillment(last.text);
    if (way === 'pickup') return ['Yes, place it', 'Ship it to me instead'];
    if (way === 'shipping') return ['Yes, place it', 'Make it pickup instead'];
    return ['Yes, place it'];
  }
  return [];
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();

/** Where a whole item name (or its plural) first appears in a reply, or -1. */
function mentionAt(text: string, name: string): number {
  const n = norm(name);
  if (!n) return -1;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^| )${escaped}(?:s|es)?(?= |$)`).exec(text);
  return m ? m.index : -1;
}

/** A card under a reply: an item the assistant looked up and named, with the price the tool returned. */
export interface ItemCard {
  id: string;
  name: string;
  priceCents: number;
  photoUrl: string | null;
  example: boolean;
}

/** At most this many cards under one reply. */
export const MAX_CARDS = 4;

const cents = (price: unknown): number | null => (typeof price === 'string' ? parseAmountToCents(price) : null);

/** The orderable items (id, name, lowest option price) in one list_products result. */
function listedIn(result: unknown): { id: string; name: string; priceCents: number }[] {
  const sections = (result as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section) => {
    const items = (section as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) return [];
    return items.flatMap((raw) => {
      const item = raw as { item_id?: unknown; name?: unknown; orderable?: unknown; options?: unknown };
      if (typeof item?.item_id !== 'string' || typeof item.name !== 'string' || item.orderable === false) return [];
      const prices = Array.isArray(item.options) ? item.options.map((o) => cents((o as { price?: unknown } | null)?.price)).filter((c): c is number => c !== null && c > 0) : [];
      return prices.length ? [{ id: item.item_id, name: item.name, priceCents: Math.min(...prices) }] : [];
    });
  });
}

/**
 * The cards under the reply at `index`: items that this turn's list_products calls returned (so name and price come
 * from the shop, never from the reply) and that the reply names, in the order it names them, at most `MAX_CARDS`. The
 * picture comes from the home page's menu (own photo, else example photo); an item missing there has none.
 */
export function itemCards(entries: readonly Entry[], index: number, menu: readonly ChatMenuItem[]): ItemCard[] {
  const entry = entries[index];
  if (entry?.kind !== 'assistant') return [];
  const found = new Map<string, { id: string; name: string; priceCents: number }>();
  for (let i = index - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === 'user') break;
    if (e.kind !== 'activity') continue;
    for (const call of e.calls) {
      if (call.name !== 'list_products' || call.status !== 'ok') continue;
      for (const item of listedIn(call.result)) if (!found.has(item.id)) found.set(item.id, item);
    }
  }
  if (!found.size) return [];
  const text = norm(entry.text);
  const pictures = new Map(menu.map((m) => [m.id, m]));
  return [...found.values()]
    .map((item) => ({ item, at: mentionAt(text, item.name) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_CARDS)
    .map(({ item }) => {
      const pic = pictures.get(item.id);
      return { ...item, photoUrl: pic?.photoUrl ?? null, example: pic ? pic.example : false };
    });
}
