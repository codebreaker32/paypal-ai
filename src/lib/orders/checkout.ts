// The cart's checkout (POST /api/checkout/[slug]): its request shape and what each refusal says to the buyer.
// The client never sends a price: `expectedTotalCents` is only compared with what the server computes.
import { z } from 'zod';
import type { Db } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import { formatUSD } from '@/lib/domain/money';
import type { Shop } from '@/lib/domain/types';
import { sanitizeLabel } from '@/lib/text';
import type { OrderError } from './errors';
import { ORDER_LIMITS, shopLabel } from './pricing';

export const CheckoutBody = z
  .object({
    lines: z
      .array(
        z
          .object({
            itemId: z.string().min(1).max(64),
            optionId: z.string().min(1).max(64).optional(),
            quantity: z.number().int().min(1).max(ORDER_LIMITS.maxQtyPerLine),
          })
          .strict(),
      )
      .min(1)
      .max(ORDER_LIMITS.maxLines),
    fulfillment: z.enum(['pickup', 'shipping']).optional(),
    note: z.string().max(280).optional(),
    expectedTotalCents: z.number().int(),
    requestId: z.string().min(8).max(64),
  })
  .strict();

export const CHECKOUT_COPY = {
  invalid: 'Check your order and try again.',
  rateLimited: 'You’ve tried a lot in the last hour. Try again later.',
  priceChanged: 'Prices changed. Check your total, then try again.',
  stale: 'That order has already moved on. Try again.',
  conflict: 'Your order changed. Try again.',
} as const;

export interface CheckoutFailure {
  status: number;
  code: string;
  message: string;
  /** The line to take out of the cart. */
  itemId?: string;
  /** Whose open orders filled the limit. Only on TOO_MANY_OPEN_ORDERS. */
  scope?: 'client' | 'shop';
}

/** A refusal in the buyer's words. The OrderError's own message and hint are written for agents, so they stay on the server. */
export function checkoutFailure(e: OrderError, db: Db, shop: Shop): CheckoutFailure {
  const { code } = e;
  const itemId = typeof e.details?.item_id === 'string' ? e.details.item_id : undefined;
  switch (code) {
    case 'SHOP_NOT_ACCEPTING_ORDERS':
      return { status: 409, code, message: `${shopLabel(shop)} isn’t taking orders right now. Your items are saved here.` };
    case 'UNKNOWN_ITEM':
    case 'ITEM_UNAVAILABLE': {
      // Looked up in this shop only, so another shop's item never lends its name.
      const known = itemId ? itemsRepo.byIdForShop(db, shop.id, itemId) : null;
      const name = (known && sanitizeLabel(known.name, 80)) || 'That item';
      return { status: 409, code, message: `${name} is no longer available, so we took it out.`, itemId };
    }
    case 'ORDER_TOO_LARGE':
      return { status: 409, code, message: `This shop takes online orders up to ${formatUSD(shop.orderCapCents)}.` };
    case 'TOO_MANY_OPEN_ORDERS':
      return e.details?.max_open_orders_per_client !== undefined
        ? { status: 409, code, scope: 'client', message: 'You have orders waiting for payment here. Pay one, or try again in an hour.' }
        : {
            status: 409,
            code,
            scope: 'shop',
            message: `${shopLabel(shop)} has a lot of orders waiting for payment right now. Try again in a few minutes. Your items are saved here.`,
          };
    case 'IDEMPOTENCY_CONFLICT':
      return { status: 409, code, message: CHECKOUT_COPY.conflict };
    case 'OPTION_REQUIRED':
      return { status: 409, code, message: 'Something in your order changed. Check it, then try again.', itemId };
    case 'FULFILLMENT_REQUIRED':
      return { status: 400, code, message: 'Choose pickup or shipping, then try again.' };
    case 'RATE_LIMITED':
      return { status: 429, code, message: CHECKOUT_COPY.rateLimited };
    case 'PAYPAL_UNAVAILABLE':
      return { status: 502, code, message: 'We can’t reach PayPal right now. Your order is saved here. Try again in a moment.' };
    default:
      return { status: 400, code, message: CHECKOUT_COPY.invalid };
  }
}
