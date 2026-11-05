// Order errors with stable codes. The agent door turns these into tool errors (spec §10).

export type OrderErrorCode =
  | 'INVALID_ARGUMENTS'
  | 'SHOP_NOT_ACCEPTING_ORDERS'
  | 'UNKNOWN_ITEM'
  | 'OPTION_REQUIRED'
  | 'FULFILLMENT_REQUIRED'
  | 'ITEM_UNAVAILABLE'
  | 'QUANTITY_LIMIT'
  | 'ORDER_TOO_LARGE'
  | 'TOO_MANY_OPEN_ORDERS'
  | 'RATE_LIMITED'
  | 'PAYPAL_UNAVAILABLE'
  | 'ORDER_NOT_FOUND';

const RETRYABLE: ReadonlySet<OrderErrorCode> = new Set(['PAYPAL_UNAVAILABLE', 'RATE_LIMITED']);

export class OrderError extends Error {
  public readonly retryable: boolean;

  constructor(
    public readonly code: OrderErrorCode,
    message: string,
    public readonly hint: string,
    public readonly details?: Record<string, unknown>,
    retryable?: boolean,
  ) {
    super(message);
    this.name = 'OrderError';
    this.retryable = retryable ?? RETRYABLE.has(code);
  }
}
