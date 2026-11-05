// Prices an order from the shop's database rows only. Agent input never carries a price (spec §2, §10).
import type { Db } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import { formatUSD, toPayPalValue } from '@/lib/domain/money';
import type { Fulfillment, ItemKind, ItemWithVariants, OrderLine, Shop, Variant } from '@/lib/domain/types';
import { OrderError } from './errors';

export const ORDER_LIMITS = { maxQtyPerLine: 20, maxLines: 15 } as const;

export interface PriceLineInput {
  itemId: string;
  optionId?: string;
  quantity: number;
}

export interface PricedLine extends OrderLine {
  kind: ItemKind;
}

export interface PricedOrder {
  lines: PricedLine[];
  itemsCents: number;
  shippingCents: number;
  totalCents: number;
  fulfillment: Fulfillment;
}

export interface OptionView {
  option_id: string;
  label: string | null;
  price: string;
}

export function shopModes(shop: Shop): Fulfillment[] {
  return shop.fulfillment === 'both' ? ['pickup', 'shipping'] : [shop.fulfillment];
}

/** Items an agent can see: live ones and "ask in person" ones. */
export const isListed = (item: ItemWithVariants): boolean => item.status === 'live' || item.status === 'in_person';

/** Options with a real price. Unpriced options are never orderable. */
export function pricedOptions(item: ItemWithVariants): Variant[] {
  return item.variants.filter((v) => v.priceCents !== null && v.priceCents > 0);
}

export function optionViews(item: ItemWithVariants): OptionView[] {
  return pricedOptions(item).map((v) => ({ option_id: v.id, label: v.label, price: toPayPalValue(v.priceCents!) }));
}

/** Why a listed item can't be ordered online right now, or null when it can. */
export function unavailableReason(item: ItemWithVariants): string | null {
  if (item.status === 'in_person') return 'Available in person only: ask the shop for the price on the day.';
  if (item.soldOut) return 'Sold out today.';
  if (!pricedOptions(item).length) return 'The shop has not set a price for it yet.';
  return null;
}

export function priceOrder(
  db: Db,
  shop: Shop,
  lines: PriceLineInput[],
  fulfillment: Fulfillment | undefined,
): PricedOrder {
  if (shop.status !== 'live') {
    throw new OrderError(
      'SHOP_NOT_ACCEPTING_ORDERS',
      `${shop.name} is not taking online orders right now.`,
      'Tell the user the shop has paused online orders. They can try again later or order in person.',
    );
  }
  if (!lines.length) {
    throw new OrderError('INVALID_ARGUMENTS', 'An order needs at least one item.', 'Pass items: [{ item_id, quantity }] with IDs from list_products.');
  }
  if (lines.length > ORDER_LIMITS.maxLines) {
    throw new OrderError(
      'ORDER_TOO_LARGE',
      `An order can have at most ${ORDER_LIMITS.maxLines} lines; this one has ${lines.length}.`,
      'Combine repeated items into one line with a higher quantity, or split the order in two.',
      { max_lines: ORDER_LIMITS.maxLines },
    );
  }

  let listed: ItemWithVariants[] | null = null;
  const listedItems = () => (listed ??= itemsRepo.listWithVariants(db, shop.id).filter(isListed));

  const priced = lines.map((line, i): PricedLine => {
    const q = line.quantity;
    if (!Number.isInteger(q) || q < 1 || q > ORDER_LIMITS.maxQtyPerLine) {
      throw new OrderError(
        'QUANTITY_LIMIT',
        `Line ${i + 1}: quantity must be a whole number from 1 to ${ORDER_LIMITS.maxQtyPerLine}.`,
        'Lower the quantity. For bigger orders the user should contact the shop directly.',
        { line: i, max_qty_per_line: ORDER_LIMITS.maxQtyPerLine },
      );
    }
    const item = itemsRepo.byIdForShop(db, shop.id, line.itemId);
    if (!item || !isListed(item)) {
      throw new OrderError(
        'UNKNOWN_ITEM',
        `This shop has no item with ID "${line.itemId}".`,
        'Use an item_id exactly as returned by list_products.',
        { item_id: line.itemId, didYouMean: suggestItems(line.itemId, listedItems()) },
      );
    }
    const reason = unavailableReason(item);
    if (reason) {
      throw new OrderError(
        'ITEM_UNAVAILABLE',
        `${item.name} can't be ordered online. ${reason}`,
        'Tell the user and offer something else from list_products.',
        { item_id: item.id, reason },
      );
    }
    const options = pricedOptions(item);
    let variant: Variant | undefined;
    if (line.optionId !== undefined) {
      variant = options.find((v) => v.id === line.optionId);
      if (!variant) {
        throw new OrderError(
          'OPTION_REQUIRED',
          `"${line.optionId}" is not an option of ${item.name}.`,
          'Pass one of the listed option_id values for this item.',
          { item_id: item.id, options: optionViews(item) },
        );
      }
    } else if (options.length === 1) {
      variant = options[0];
    } else {
      throw new OrderError(
        'OPTION_REQUIRED',
        `${item.name} comes in ${options.length} options; choose one.`,
        'Ask the user which option they want, then pass its option_id.',
        { item_id: item.id, options: optionViews(item) },
      );
    }
    return {
      itemId: item.id,
      variantId: variant.id,
      name: item.name,
      label: variant.label,
      unitCents: variant.priceCents!,
      qty: q,
      paypalProductId: item.paypalProductId,
      kind: item.kind,
    };
  });

  const modes = shopModes(shop);
  let mode = fulfillment;
  if (mode === undefined) {
    if (modes.length > 1) {
      throw new OrderError(
        'FULFILLMENT_REQUIRED',
        `${shop.name} offers pickup and shipping; choose one.`,
        `Ask the user whether they want pickup or shipping (shipping adds ${formatUSD(shop.shippingFeeCents)}), then pass fulfillment.`,
        { modes },
      );
    }
    mode = modes[0];
  } else if (!modes.includes(mode)) {
    throw new OrderError(
      'FULFILLMENT_REQUIRED',
      `${shop.name} does not offer ${mode}; it offers ${modes.join(' and ')} only.`,
      `Tell the user, then pass fulfillment: "${modes[0]}" if that works for them.`,
      { modes },
    );
  }

  const itemsCents = priced.reduce((sum, l) => sum + l.unitCents * l.qty, 0);
  const shippingCents = mode === 'shipping' ? shop.shippingFeeCents : 0;
  const totalCents = itemsCents + shippingCents;
  if (totalCents > shop.orderCapCents) {
    throw new OrderError(
      'ORDER_TOO_LARGE',
      `This order comes to ${formatUSD(totalCents)}; ${shop.name} takes online orders up to ${formatUSD(shop.orderCapCents)}.`,
      'Reduce quantities or split the order. For bigger orders the user should contact the shop directly.',
      { total: toPayPalValue(totalCents), max_order: toPayPalValue(shop.orderCapCents) },
    );
  }
  return { lines: priced, itemsCents, shippingCents, totalCents, fulfillment: mode };
}

// ---- "did you mean" ---------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9_ ]+/g, ' ').replace(/\s+/g, ' ').trim();

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const similarity = (a: string, b: string) => (a.length || b.length ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 0);

/** Up to three listed items that look like what the agent meant (by name or by a mistyped ID). */
export function suggestItems(query: string, candidates: ItemWithVariants[]): { item_id: string; name: string }[] {
  const q = norm(query.slice(0, 100));
  if (!q) return [];
  const qTokens = new Set(q.split(' '));
  return candidates
    .map((c) => {
      const name = norm(c.name);
      const tokens = name.split(' ');
      const overlap = tokens.filter((t) => qTokens.has(t)).length / Math.max(tokens.length, 1);
      const score = Math.max(
        similarity(q, name),
        similarity(q, c.id.toLowerCase()),
        name.includes(q) || q.includes(name) ? 0.9 : 0,
        overlap * 0.8,
      );
      return { c, score };
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ c }) => ({ item_id: c.id, name: c.name }));
}
