// Shared domain contracts. Frozen in Task 0: change only with a ledger ruling.
import type { ItemCategory } from './category';

export type ShopKind = 'food' | 'goods' | 'services';
export type ShopFulfillment = 'pickup' | 'shipping' | 'both';
export type Fulfillment = 'pickup' | 'shipping';
export type ShopStatus = 'draft' | 'live' | 'paused';

export interface Shop {
  id: string;
  slug: string;
  name: string;
  about: string;
  kind: ShopKind;
  fulfillment: ShopFulfillment;
  pickupNotes: string;
  shippingFeeCents: number;
  status: ShopStatus;
  orderCapCents: number;
  menuPhotoPaths: string[];
  createdAt: string;
  publishedAt: string | null;
  /** The seller's PayPal email (lower-cased): where buyers' payments go. Only the demo shop may have none (spec §8a). */
  payeeEmail: string | null;
  /** Cover photo, a site-relative URL (`/demo/...` bundled, `/i/<file>` uploaded); null shows the designed fallback. */
  coverUrl: string | null;
  /** The shop's logo, a site-relative URL to a square WebP; null: the avatar uses the cover, a menu photo or a drawing. */
  logoUrl: string | null;
}

export type Confidence = 'high' | 'medium' | 'low';
export type IssueCode = 'MISSING_PRICE' | 'MARKET_PRICE' | 'CHECK' | 'DUPLICATE';
export type ItemStatus = 'draft' | 'live' | 'in_person' | 'removed';
export type ItemKind = 'PHYSICAL' | 'SERVICE';

export interface Variant {
  id: string;
  itemId: string;
  label: string | null;
  priceCents: number | null;
  sort: number;
}

export interface Item {
  id: string;
  shopId: string;
  section: string | null;
  name: string;
  description: string | null;
  sourceText: string;
  confidence: Confidence;
  issues: IssueCode[];
  issueDetail: string | null;
  kind: ItemKind;
  status: ItemStatus;
  soldOut: boolean;
  /** Item photo, a site-relative URL like `Shop.coverUrl`; null shows the designed fallback. */
  photoUrl: string | null;
  /** The picture drawn for the item when it has no photo (Claude's pick); null on older rows: `itemCategory` guesses. */
  category: ItemCategory | null;
  sort: number;
  paypalProductId: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ItemWithVariants extends Item {
  variants: Variant[];
}

export interface DraftVariant {
  label: string | null;
  priceCents: number | null;
}

export interface DraftItem {
  section: string | null;
  name: string;
  description: string | null;
  sourceText: string;
  confidence: Confidence;
  kind: ItemKind;
  issues: IssueCode[];
  issueDetail: string | null;
  status: 'draft' | 'in_person' | 'removed';
  /** Claude's picture for the item; null or absent when the reading has none (older recordings, hand-added items). */
  category?: ItemCategory | null;
  variants: DraftVariant[];
}

export type SkipReason = 'header' | 'contact' | 'hours' | 'policy' | 'addon' | 'illegible' | 'instruction' | 'other';

export interface SkippedLine {
  text: string;
  page: number;
  reason: SkipReason;
}

export interface DraftCatalog {
  shop: { name: string; about: string; pickupNotes: string };
  kind: ShopKind;
  items: DraftItem[];
  skipped: SkippedLine[];
  needsAttention: number;
  warnings: string[];
  nonUsd: boolean;
}

export type UnreadableReason = 'not_a_menu' | 'unreadable' | 'no_items';

export interface UnreadableMenu {
  unreadable: true;
  reason: UnreadableReason;
  tip: string;
}

export type OrderStatus =
  | 'awaiting_approval'
  | 'approved'
  | 'paid'
  | 'payment_pending'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'fulfilled';

/** Events the pure state machine understands (spec §7). */
export type OrderEvent =
  | 'created'
  | 'paypal_approved'
  | 'capture_completed'
  | 'capture_pending'
  | 'capture_declined'
  | 'capture_denied'
  | 'capture_refused'
  | 'mismatch'
  | 'cancelled'
  | 'expired'
  | 'fulfilled';

export type EventSource = 'mcp' | 'return_url' | 'cancel_url' | 'webhook' | 'poller' | 'seller';

export interface OrderLine {
  itemId: string;
  variantId: string;
  name: string;
  label: string | null;
  unitCents: number;
  qty: number;
  paypalProductId: string | null;
}

export interface ShipTo {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  countryCode: string | null;
}

export interface OrderBrief {
  headline: string;
  prep_list: { text: string; qty: number | null }[];
  buyer_requests: { kind: 'allergy' | 'timing' | 'inscription' | 'other'; text: string }[];
  flags: { severity: 'warn' | 'info'; text: string }[];
  next_action: 'prepare' | 'ship' | 'contact_buyer' | 'none';
}

export interface Order {
  id: string;
  number: string;
  shopId: string;
  status: OrderStatus;
  fulfillment: Fulfillment;
  buyerName: string | null;
  buyerNote: string | null;
  agentName: string | null;
  clientRequestId: string | null;
  itemsCents: number;
  shippingCents: number;
  totalCents: number;
  paypalOrderId: string;
  approvalUrl: string;
  expiresAt: string;
  captureClaimedAt: string | null;
  captureId: string | null;
  payerName: string | null;
  payerEmail: string | null;
  /** The shop's PayPal email when the order was created (sent to PayPal as the payee); null: paid to the platform. */
  payeeEmail: string | null;
  shipTo: ShipTo | null;
  brief: OrderBrief | null;
  briefSource: 'agent' | 'template' | null;
  paidAt: string | null;
  fulfilledAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
  /** `approved`, but PayPal refused the capture for a non-transient reason (nothing was charged). Set by the repo. */
  captureRefused?: boolean;
}

export interface NewOrder {
  shopId: string;
  fulfillment: Fulfillment;
  buyerName: string | null;
  buyerNote: string | null;
  agentName: string | null;
  clientRequestId: string | null;
  /** Hashed caller identity for the per-client unpaid-order cap (null when unknown). */
  clientKey?: string | null;
  itemsCents: number;
  shippingCents: number;
  totalCents: number;
  paypalOrderId: string;
  approvalUrl: string;
  expiresAt: string;
  /** The payee the PayPal order was created with (the shop's email then); null or omitted: the platform account. */
  payeeEmail?: string | null;
  /** Optional pre-generated ids: the PayPal order needs them before the row exists. */
  id?: string;
  number?: string;
}

export interface Tracker {
  orderId: string;
  carrier: string;
  trackingNumber: string;
  paypalStatus: string | null;
  createdAt: string;
}

export interface OrderEventRow {
  id: string;
  orderId: string;
  type: string;
  source: EventSource;
  detail: unknown;
  createdAt: string;
}
