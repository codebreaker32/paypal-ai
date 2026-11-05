/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, expect, it } from 'vitest';
import { buildOrderBody } from '@/lib/paypal/orders';
import type { CreatePayPalOrderInput } from '@/lib/paypal/types';

const base: CreatePayPalOrderInput = {
  shopName: 'Dana’s Bakery',
  orderId: 'ord_1',
  orderNumber: 'SHF-K7F2',
  items: [
    { name: 'Croissant', unitCents: 450, qty: 2, sku: 'PROD-AAA', kind: 'PHYSICAL' },
    { name: 'Cake decorating class', unitCents: 3500, qty: 1, sku: null, kind: 'SERVICE' },
  ],
  shippingCents: 0,
  fulfillment: 'pickup',
  returnUrl: 'http://localhost:3000/o/ord_1/return',
  cancelUrl: 'http://localhost:3000/o/ord_1/cancel',
};

describe('buildOrderBody', () => {
  it('pickup order matches the verified shape', () => {
    expect(buildOrderBody(base)).toEqual({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'default',
          custom_id: 'ord_1',
          invoice_id: 'SHF-K7F2',
          description: 'Dana’s Bakery order SHF-K7F2',
          amount: {
            currency_code: 'USD',
            value: '44.00',
            breakdown: { item_total: { currency_code: 'USD', value: '44.00' } },
          },
          items: [
            { name: 'Croissant', quantity: '2', unit_amount: { currency_code: 'USD', value: '4.50' }, sku: 'PROD-AAA', category: 'PHYSICAL_GOODS' },
            { name: 'Cake decorating class', quantity: '1', unit_amount: { currency_code: 'USD', value: '35.00' } },
          ],
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Dana’s Bakery',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: 'http://localhost:3000/o/ord_1/return',
            cancel_url: 'http://localhost:3000/o/ord_1/cancel',
          },
        },
      },
    });
  });

  it('shipping order adds breakdown.shipping, includes it in the total and uses GET_FROM_FILE', () => {
    const body = buildOrderBody({ ...base, fulfillment: 'shipping', shippingCents: 599 }) as any;
    const unit = body.purchase_units[0];
    expect(unit.amount.value).toBe('49.99');
    expect(unit.amount.breakdown.item_total.value).toBe('44.00');
    expect(unit.amount.breakdown.shipping).toEqual({ currency_code: 'USD', value: '5.99' });
    expect(body.payment_source.paypal.experience_context.shipping_preference).toBe('GET_FROM_FILE');
  });

  it('item_total is the sum of unit x qty', () => {
    const body = buildOrderBody({ ...base, items: [{ name: 'A', unitCents: 333, qty: 3, sku: null, kind: 'PHYSICAL' }] }) as any;
    expect(body.purchase_units[0].amount.breakdown.item_total.value).toBe('9.99');
  });

  it('truncates long names, description and brand to 127 chars', () => {
    const long = 'x'.repeat(300);
    const body = buildOrderBody({ ...base, shopName: long, items: [{ ...base.items[0], name: long }] }) as any;
    expect(body.purchase_units[0].items[0].name).toHaveLength(127);
    expect(body.purchase_units[0].description).toHaveLength(127);
    expect(body.payment_source.paypal.experience_context.brand_name).toHaveLength(127);
  });
});
