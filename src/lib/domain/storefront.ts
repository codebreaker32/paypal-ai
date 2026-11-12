// The shop's own page as an order source (the cart's checkout route). Client-safe: the seller views and the receipt use it.

/** Stored as `orders.agent_name` for an order placed from the shop page's cart. Reserved: an agent can never use it. */
export const STOREFRONT_AGENT_NAME = 'shelfie-storefront';

const WINDOW_MINUTES = 60;
/** A cart buyer is already on the page, so an abandoned checkout should stop holding an open-order slot sooner. */
const STOREFRONT_WINDOW_MINUTES = 20;

/** The reserved name and the words a seller sees for it (`agentLabel`: "via your shop page"), normalised. */
const RESERVED = ['shelfiestorefront', 'yourshoppage'];

/**
 * True for anything that is, or could be displayed or stored as, the reserved name or its seller-facing label once
 * case, spacing, punctuation and control characters are ignored. Used to refuse the name from agents, who choose their own.
 */
export function isStorefrontAgentName(name: string | null | undefined): boolean {
  const normalised = (name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return RESERVED.some((reserved) => normalised.startsWith(reserved));
}

/** How long a new order's PayPal approval link works, by who placed it. */
export function approvalMinutes(agentName: string | null | undefined): number {
  return agentName?.trim() === STOREFRONT_AGENT_NAME ? STOREFRONT_WINDOW_MINUTES : WINDOW_MINUTES;
}
