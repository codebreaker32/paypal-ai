import { getConfig } from '@/lib/config';
import { createPayPalClient, type PayPalClient } from './client';

export * from './types';
export { createPayPalClient, type PayPalClient } from './client';
export { buildOrderBody } from './orders';
export { categoryFor } from './categories';
export { createSellerToolkit, scopeTool, ScopeError, ToolkitError } from './toolkit';

let singleton: PayPalClient | null = null;

/** The app-wide PayPal REST client, built lazily from config (sandbox only). */
export function getPayPal(): PayPalClient {
  if (!singleton) {
    const cfg = getConfig();
    singleton = createPayPalClient({ base: cfg.paypalBase, clientId: cfg.paypalClientId, secret: cfg.paypalSecret });
  }
  return singleton;
}
