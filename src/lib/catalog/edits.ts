// The seller's edits during setup (and the dashboard's sold-out and pause toggles):
// validation for PATCH /api/shops/[id], PATCH /api/shops/[id]/items and POST /api/shops/[id]/items.
import { z } from 'zod';
import type { Db } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import * as items from '@/lib/db/repos/items';
import { PAYEE_KEEP_MESSAGE, isDemoShop, parsePayeeEmail } from '@/lib/domain/payee';
import type { ItemWithVariants, Shop } from '@/lib/domain/types';
import { MAX_PRICE_CENTS, MAX_VARIANTS, renamed } from './rules';

export class EditError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EditError';
  }
}

const cents = z.number().int().min(0).max(MAX_PRICE_CENTS);
/** An item's price: over $0 (isPriced never sells a $0 one), within the order cap. */
const priceCents = z.number().int().min(1).max(MAX_PRICE_CENTS);
const text = (max: number) => z.string().trim().max(max);
const name = (max: number) => z.string().trim().min(1, 'Give it a name').max(max);

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
  const msg = issue.code === 'unrecognized_keys' ? `${issue.keys.map((k) => `\`${k}\``).join(', ')} is not accepted` : issue.message;
  throw new EditError('INVALID_REQUEST', 400, `${where}${msg}`);
}

// ───────────── Shop ─────────────

const ShopPatchSchema = z
  .object({
    name: name(80).optional(),
    about: text(500).optional(),
    pickupNotes: text(500).optional(),
    fulfillment: z.enum(['pickup', 'shipping', 'both']).optional(),
    shippingFeeCents: cents.optional(),
    status: z.enum(['live', 'paused']).optional(),
    /** The seller's PayPal email (checked by parsePayeeEmail below); null clears it, only while the shop is a draft. */
    payeeEmail: z.unknown().optional(),
  })
  .strict();

export type ShopPatchInput = Omit<z.infer<typeof ShopPatchSchema>, 'payeeEmail'> & { payeeEmail?: string | null };

export function parseShopPatch(body: unknown): ShopPatchInput {
  const { payeeEmail, ...rest } = parse(ShopPatchSchema, body);
  if (payeeEmail === undefined || payeeEmail === null) return payeeEmail === null ? { ...rest, payeeEmail: null } : rest;
  const parsed = parsePayeeEmail(payeeEmail);
  if (!parsed.ok) throw new EditError('INVALID_PAYEE_EMAIL', 400, parsed.message);
  return { ...rest, payeeEmail: parsed.email };
}

export function applyShopPatch(db: Db, shop: Shop, patch: ShopPatchInput): Shop {
  if (patch.status && shop.status === 'draft') {
    throw new EditError('NOT_PUBLISHED', 409, 'Publish the shop before pausing or resuming it.');
  }
  // A published shop's orders need somewhere to be paid; only the demo shop falls back to the platform account.
  if (patch.payeeEmail === null && shop.status !== 'draft' && !isDemoShop(shop)) {
    throw new EditError('PAYEE_REQUIRED', 409, PAYEE_KEEP_MESSAGE);
  }
  return shops.update(db, shop.id, patch);
}

// ───────────── Items ─────────────

const VariantSchema = z.object({ label: text(60).nullable(), priceCents: priceCents.nullable() }).strict();

const ItemUpdateSchema = z
  .object({
    itemId: z.string().min(1).max(40),
    name: name(127).optional(),
    description: text(256).nullable().optional(),
    section: text(80).nullable().optional(),
    status: z.enum(['draft', 'in_person', 'removed']).optional(),
    soldOut: z.boolean().optional(),
    resolveIssues: z.boolean().optional(),
    resolveDuplicate: z.boolean().optional(),
    variants: z.array(VariantSchema).min(1).max(MAX_VARIANTS).optional(),
  })
  .strict();

const ItemUpdatesSchema = z.object({ updates: z.array(ItemUpdateSchema).min(1).max(200) }).strict();

export type ItemUpdatesInput = z.infer<typeof ItemUpdatesSchema>;
type ItemUpdate = ItemUpdatesInput['updates'][number];

export const parseItemUpdates = (body: unknown): ItemUpdatesInput => parse(ItemUpdatesSchema, body);

/** Once an item is a PayPal product its name and prices are fixed; it can still sell out or go. */
function checkLiveEdit(item: ItemWithVariants, u: ItemUpdate): void {
  if (!item.paypalProductId) return;
  const changesListing =
    u.name !== undefined || u.description !== undefined || u.section !== undefined || u.variants !== undefined ||
    (u.status !== undefined && u.status !== 'removed');
  if (changesListing) {
    throw new EditError('ITEM_LIVE', 409, `"${item.name}" is already in PayPal. You can mark it sold out or remove it.`);
  }
}

/**
 * Applies every update in one transaction, or none of them. Returns the shop's whole menu
 * (every item, in menu order), so callers can replace their list or merge by id.
 */
export function applyItemUpdates(db: Db, shopId: string, input: ItemUpdatesInput): ItemWithVariants[] {
  const targets = input.updates.map((u) => {
    const item = items.byIdForShop(db, shopId, u.itemId);
    if (!item) throw new EditError('ITEM_NOT_FOUND', 404, `No item ${u.itemId} in this shop.`);
    checkLiveEdit(item, u);
    return { u, item };
  });
  db.transaction(() => {
    for (const { u, item } of targets) {
      items.update(db, u.itemId, {
        name: u.name,
        description: u.description,
        section: u.section,
        status: u.status,
        soldOut: u.soldOut,
        issues: u.resolveIssues ? [] : u.resolveDuplicate ? item.issues.filter((c) => c !== 'DUPLICATE') : undefined,
        category: renamed(item, u) ? null : undefined,
        examplePhoto: renamed(item, u) ? null : undefined,
      });
      if (u.variants) items.setVariants(db, u.itemId, u.variants);
    }
  })();
  return items.listWithVariants(db, shopId);
}

// ───────────── A skipped line made into an item ─────────────

const NewItemSchema = z
  .object({
    name: name(127),
    section: text(80).nullable().optional(),
    priceCents: priceCents.nullable().optional(),
    sourceText: text(500),
  })
  .strict();

export type NewItemInput = z.infer<typeof NewItemSchema>;

export const parseNewItem = (body: unknown): NewItemInput => parse(NewItemSchema, body);

/** Adds one draft item at the end of the menu; without a price it waits on the "needs you" list. */
export function addItem(db: Db, shopId: string, input: NewItemInput): ItemWithVariants {
  const shop = shops.byId(db, shopId);
  if (!shop) throw new EditError('NOT_FOUND', 404, 'No such shop.');
  const priceCents = input.priceCents ?? null;
  return items.insertDraft(db, shopId, {
    section: input.section || null,
    name: input.name,
    description: null,
    sourceText: input.sourceText,
    confidence: 'high',
    kind: shop.kind === 'services' ? 'SERVICE' : 'PHYSICAL',
    issues: priceCents == null ? ['MISSING_PRICE'] : [],
    issueDetail: null,
    status: 'draft',
    variants: [{ label: null, priceCents }],
  });
}
