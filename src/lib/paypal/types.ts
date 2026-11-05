import type { Fulfillment } from '@/lib/domain/types';

export type PayPalOrderStatus = 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';

/** The subset of a PayPal Orders v2 order that Shelfie reads. */
export interface PayPalOrder {
  id: string;
  status: PayPalOrderStatus;
  payer?: { name?: { given_name?: string; surname?: string }; email_address?: string };
  purchase_units: {
    custom_id?: string;
    invoice_id?: string;
    amount?: { currency_code: string; value: string };
    shipping?: {
      name?: { full_name?: string };
      address?: {
        address_line_1?: string;
        address_line_2?: string;
        admin_area_2?: string;
        admin_area_1?: string;
        postal_code?: string;
        country_code?: string;
      };
    };
    payments?: { captures?: { id: string; status: 'COMPLETED' | 'PENDING' | 'DECLINED' | 'REFUNDED' | 'FAILED' | string }[] };
  }[];
  links?: { rel: string; href: string; method?: string }[];
}

export interface CreatePayPalOrderInput {
  shopName: string;
  /** Shelfie order id → purchase_units[0].custom_id */
  orderId: string;
  /** Human order number → purchase_units[0].invoice_id */
  orderNumber: string;
  items: { name: string; unitCents: number; qty: number; sku: string | null; kind: 'PHYSICAL' | 'SERVICE' }[];
  shippingCents: number;
  fulfillment: Fulfillment;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  type: 'PHYSICAL' | 'SERVICE';
  category?: string;
}

/** Everything Shelfie's money paths need from PayPal. Implemented by the REST client and by the test fake. */
export interface PayPalPort {
  createProduct(p: CreateProductInput, requestId: string): Promise<{ id: string }>;
  createOrder(input: CreatePayPalOrderInput, requestId: string): Promise<{ id: string; status: PayPalOrderStatus; approveUrl: string }>;
  getOrder(paypalOrderId: string): Promise<PayPalOrder>;
  captureOrder(paypalOrderId: string, requestId: string): Promise<PayPalOrder>;
}

/** A PayPal API error with PayPal's own issue code kept (e.g. ORDER_NOT_APPROVED). */
export class PayPalApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorName: string,
    public readonly issue: string | null,
    public readonly debugId: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'PayPalApiError';
  }
}
