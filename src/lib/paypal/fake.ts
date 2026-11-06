// In-memory PayPal used by unit tests. Mirrors the sandbox behaviour Shelfie relies on
// (probed 2026-11-06): request-id idempotency, PAYER_ACTION_REQUIRED until approved,
// 422 ORDER_NOT_APPROVED / ORDER_ALREADY_CAPTURED on capture.
import { toPayPalValue } from '@/lib/domain/money';
import { PayPalApiError, type CreatePayPalOrderInput, type CreateProductInput, type PayPalOrder, type PayPalPort } from './types';

export interface FakePayPal extends PayPalPort {
  calls: { method: string; args: unknown[] }[];
  orders: Map<string, PayPalOrder>;
  products: Map<string, CreateProductInput>;
  /** Buyer approves on PayPal. */
  approve(paypalOrderId: string, payer?: { name?: string; email?: string; shipTo?: { city: string; state: string } }): void;
  /**
   * Next capture returns this outcome instead of COMPLETED. PENDING_UNILATERAL is what the sandbox does for a payee email
   * with no PayPal account: capture PENDING with status_details.reason UNILATERAL (verified 6 Nov).
   */
  nextCapture: 'COMPLETED' | 'PENDING' | 'PENDING_UNILATERAL' | 'DECLINED_422' | null;
  /** Makes the next call to `method` throw this error. */
  failNext(method: keyof PayPalPort, err: Error): void;
}

export function createFakePayPal(): FakePayPal {
  const orders = new Map<string, PayPalOrder>();
  const products = new Map<string, CreateProductInput>();
  const byRequestId = new Map<string, string>();
  const failures = new Map<string, Error>();
  const calls: { method: string; args: unknown[] }[] = [];
  let seq = 0;

  const maybeFail = (method: string) => {
    const err = failures.get(method);
    if (err) {
      failures.delete(method);
      throw err;
    }
  };
  const err422 = (issue: string) => new PayPalApiError(422, 'UNPROCESSABLE_ENTITY', issue, 'fake-debug', issue);

  const fake: FakePayPal = {
    calls,
    orders,
    products,
    nextCapture: null,
    failNext(method, err) {
      failures.set(method, err);
    },
    async createProduct(p, requestId) {
      calls.push({ method: 'createProduct', args: [p, requestId] });
      maybeFail('createProduct');
      const existing = byRequestId.get(requestId);
      if (existing) return { id: existing };
      const id = `PROD-FAKE${String(++seq).padStart(8, '0')}`;
      products.set(id, p);
      byRequestId.set(requestId, id);
      return { id };
    },
    async createOrder(input: CreatePayPalOrderInput, requestId) {
      calls.push({ method: 'createOrder', args: [input, requestId] });
      maybeFail('createOrder');
      const existing = byRequestId.get(requestId);
      const id = existing ?? `FAKE${String(++seq).padStart(13, '0')}`;
      if (!existing) {
        const items = input.items.reduce((s, i) => s + i.unitCents * i.qty, 0);
        orders.set(id, {
          id,
          status: 'PAYER_ACTION_REQUIRED',
          purchase_units: [
            {
              custom_id: input.orderId,
              invoice_id: input.orderNumber,
              amount: { currency_code: 'USD', value: toPayPalValue(items + input.shippingCents) },
              // PayPal echoes the payee we sent (with display_data, which Shelfie ignores).
              ...(input.payeeEmail !== null ? { payee: { email_address: input.payeeEmail } } : {}),
            },
          ],
          links: [{ rel: 'payer-action', href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` }],
        });
        byRequestId.set(requestId, id);
      }
      const o = orders.get(id)!;
      return { id, status: o.status, approveUrl: o.links!.find((l) => l.rel === 'payer-action')!.href };
    },
    async getOrder(id) {
      calls.push({ method: 'getOrder', args: [id] });
      maybeFail('getOrder');
      const o = orders.get(id);
      if (!o) throw new PayPalApiError(404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID', 'fake-debug', 'not found');
      return structuredClone(o);
    },
    async captureOrder(id, requestId) {
      calls.push({ method: 'captureOrder', args: [id, requestId] });
      maybeFail('captureOrder');
      const o = orders.get(id);
      if (!o) throw new PayPalApiError(404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID', 'fake-debug', 'not found');
      if (o.status === 'COMPLETED') throw err422('ORDER_ALREADY_CAPTURED');
      if (o.status !== 'APPROVED') throw err422('ORDER_NOT_APPROVED');
      const outcome = fake.nextCapture ?? 'COMPLETED';
      fake.nextCapture = null;
      if (outcome === 'DECLINED_422') throw err422('INSTRUMENT_DECLINED');
      o.status = 'COMPLETED';
      const capId = `CAP${String(++seq).padStart(14, '0')}`;
      o.purchase_units[0].payments = {
        captures: [outcome === 'PENDING_UNILATERAL' ? { id: capId, status: 'PENDING', status_details: { reason: 'UNILATERAL' } } : { id: capId, status: outcome }],
      };
      return structuredClone(o);
    },
    approve(id, payer) {
      const o = orders.get(id);
      if (!o) throw new Error(`fake: unknown order ${id}`);
      o.status = 'APPROVED';
      const [given, ...rest] = (payer?.name ?? 'Dana Buyer').split(' ');
      o.payer = { name: { given_name: given, surname: rest.join(' ') }, email_address: payer?.email ?? 'dana@example.com' };
      if (payer?.shipTo) {
        o.purchase_units[0].shipping = {
          name: { full_name: payer.name ?? 'Dana Buyer' },
          address: { address_line_1: '1 Main St', admin_area_2: payer.shipTo.city, admin_area_1: payer.shipTo.state, postal_code: '78701', country_code: 'US' },
        };
      }
    },
  };
  return fake;
}
