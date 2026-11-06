import { toPayPalValue } from '@/lib/domain/money';
import type { CreatePayPalOrderInput } from './types';

const money = (cents: number) => ({ currency_code: 'USD', value: toPayPalValue(cents) });

/** Order body built only from DB-derived input. Shapes verified against the sandbox on 2026-11-06. */
export function buildOrderBody(input: CreatePayPalOrderInput): object {
  const itemTotal = input.items.reduce((s, i) => s + i.unitCents * i.qty, 0);
  const breakdown: Record<string, unknown> = { item_total: money(itemTotal) };
  if (input.shippingCents > 0) breakdown.shipping = money(input.shippingCents);
  const total = itemTotal + Math.max(0, input.shippingCents);
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: 'default',
        custom_id: input.orderId,
        invoice_id: input.orderNumber,
        description: `${input.shopName} order ${input.orderNumber}`.slice(0, 127),
        amount: { ...money(total), breakdown },
        items: input.items.map((i) => ({
          name: i.name.slice(0, 127),
          quantity: String(i.qty),
          unit_amount: money(i.unitCents),
          ...(i.sku !== null ? { sku: i.sku } : {}),
          ...(i.kind === 'PHYSICAL' ? { category: 'PHYSICAL_GOODS' } : {}),
        })),
        // PayPal pays the seller's own account; the platform app still creates and captures the order (spec §8a).
        ...(input.payeeEmail !== null ? { payee: { email_address: input.payeeEmail } } : {}),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: input.shopName.slice(0, 127),
          user_action: 'PAY_NOW',
          shipping_preference: input.fulfillment === 'pickup' ? 'NO_SHIPPING' : 'GET_FROM_FILE',
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      },
    },
  };
}

export function approveUrlOf(order: { links?: { rel: string; href: string }[] }): string {
  const link = order.links?.find((l) => l.rel === 'payer-action') ?? order.links?.find((l) => l.rel === 'approve');
  if (!link) throw new Error('PayPal order response has no payer-action link');
  return link.href;
}
