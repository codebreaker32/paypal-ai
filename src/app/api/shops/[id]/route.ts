// PATCH /api/shops/[id] (owner): { name?, about?, pickupNotes?, fulfillment?, shippingFeeCents?, status?, payeeEmail?,
// currentPassword? } → 200 { shop }. `status` only toggles live ↔ paused on a published shop (the dashboard's pause).
// `payeeEmail` is the seller's PayPal email (400 INVALID_PAYEE_EMAIL if malformed; null is refused once live, except for
// the demo shop). Changing it on an account-owned published or paused shop needs `currentPassword` (SR18): 403
// PASSWORD_REQUIRED or PASSWORD_WRONG, 429 RATE_LIMITED, 503 BUSY; 409 SHOP_CHANGED if the shop's status or email moved
// while the request was in flight. Every change on a published shop is recorded, masked, in the same transaction as the
// update, and the transaction reads the row and the session itself: what was checked earlier may be stale by then, so a
// session ended while the body was arriving is 404 and writes nothing.
// DELETE /api/shops/[id] (owner): { confirmName, currentPassword } → 204, the shop's rows and files gone and its slug
// retired (SR19). 403 DEMO_SHOP; 403 ACCOUNT_REQUIRED (no account, and guest shops are off); 400 NAME_MISMATCH;
// 403 PASSWORD_REQUIRED or PASSWORD_WRONG; 409 OPEN_ORDERS; 429 RATE_LIMITED; 503 BUSY. An unattached shop reached with
// guests on has no password to ask for.
import { guestShopsAllowed } from '@/lib/auth/guest';
import { authFailure, checkCurrentPassword, noStoreEmpty, passwordRequired, passwordWrong, readFields } from '@/lib/auth/http';
import { ownershipCheck } from '@/lib/auth/owner';
import { deleteShopRows, openOrdersMessage, removeFiles } from '@/lib/catalog/delete-shop';
import { applyShopPatch, parseShopPatch, type ShopPatchInput } from '@/lib/catalog/edits';
import { notFound, ownedShop, readJson } from '@/lib/catalog/http';
import { getDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import * as orders from '@/lib/db/repos/orders';
import * as payeeChanges from '@/lib/db/repos/payee-changes';
import * as shops from '@/lib/db/repos/shops';
import { isDemoShop } from '@/lib/domain/payee';
import { sameShopName } from '@/lib/domain/shop-name';
import type { Shop } from '@/lib/domain/types';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

/** `currentPassword` belongs to this route, not to the shop patch, which refuses unknown fields. */
function takePassword(body: unknown): { currentPassword: unknown; rest: unknown } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { currentPassword: undefined, rest: body };
  const { currentPassword, ...rest } = body as Record<string, unknown>;
  return { currentPassword, rest };
}

const changesEmail = (shop: Shop, patch: ShopPatchInput): boolean =>
  patch.payeeEmail !== undefined && patch.payeeEmail !== shop.payeeEmail;

/** SR18: an account-owned shop that is published or paused needs the password to change where its money goes. */
const needsPassword = (shop: Shop, patch: ShopPatchInput): boolean =>
  Boolean(shop.accountId) && shop.status !== 'draft' && changesEmail(shop, patch);

const shopChanged = (): Response => jsonError(409, 'SHOP_CHANGED', 'This shop changed while you were saving. Reload the page and try again.');

export async function PATCH(req: Request, ctx: RouteContext<'/api/shops/[id]'>): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  const stillOwner = await ownershipCheck(id);
  try {
    const { currentPassword, rest } = takePassword(await readJson(req));
    const patch = parseShopPatch(rest);
    const db = getDb();
    let verifiedHash: string | null = null;
    if (needsPassword(shop, patch)) {
      const account = accounts.byId(db, shop.accountId!)!;
      const denied = await checkCurrentPassword(account, currentPassword, clientIp(req));
      if (denied) return denied;
      verifiedHash = account.passwordHash;
    }
    const result = db.transaction((): Shop | Response => {
      const fresh = shops.byId(db, id);
      if (!fresh) return notFound();
      if (patch.payeeEmail !== undefined) {
        if (needsPassword(fresh, patch) && verifiedHash === null) return passwordRequired();
        if (fresh.status !== shop.status || fresh.payeeEmail !== shop.payeeEmail) return shopChanged();
        if (verifiedHash !== null && accounts.byId(db, shop.accountId!)?.passwordHash !== verifiedHash) return passwordWrong();
      }
      if (!stillOwner(db, fresh)) return notFound();
      const next = applyShopPatch(db, fresh, patch);
      if (fresh.status !== 'draft' && changesEmail(fresh, patch) && patch.payeeEmail) {
        payeeChanges.record(db, id, fresh.payeeEmail, patch.payeeEmail);
      }
      return next;
    })();
    return result instanceof Response ? result : Response.json({ shop: result });
  } catch (err) {
    return authFailure(err, 'PATCH /api/shops/[id]');
  }
}

const sameName = (typed: unknown, name: string): boolean => typeof typed === 'string' && sameShopName(typed, name);

export async function DELETE(req: Request, ctx: RouteContext<'/api/shops/[id]'>): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  const stillOwner = await ownershipCheck(id);
  try {
    if (isDemoShop(shop)) return jsonError(403, 'DEMO_SHOP', 'The demo shop can’t be deleted.');
    if (!shop.accountId && !guestShopsAllowed()) return jsonError(403, 'ACCOUNT_REQUIRED', 'Log in to the account that owns this shop to delete it.');
    const { confirmName, currentPassword } = await readFields(req);
    const nameMismatch = () => jsonError(400, 'NAME_MISMATCH', 'Type the shop’s name exactly as it appears.');
    if (!sameName(confirmName, shop.name)) return nameMismatch(); // before the hash, so a typo costs no password check
    const db = getDb();
    let verifiedHash: string | null = null;
    if (shop.accountId) {
      const account = accounts.byId(db, shop.accountId)!;
      const denied = await checkCurrentPassword(account, currentPassword, clientIp(req));
      if (denied) return denied;
      verifiedHash = account.passwordHash;
    }
    const outcome = db.transaction((): string[] | Response => {
      const fresh = shops.byId(db, id);
      if (!fresh || !stillOwner(db, fresh)) return notFound();
      if (verifiedHash !== null && accounts.byId(db, shop.accountId!)?.passwordHash !== verifiedHash) return passwordWrong();
      if (!sameName(confirmName, fresh.name)) return nameMismatch();
      const open = orders.countUnfinished(db, id);
      if (open > 0) return jsonError(409, 'OPEN_ORDERS', openOrdersMessage(open));
      return deleteShopRows(db, fresh);
    })();
    if (outcome instanceof Response) return outcome;
    await removeFiles(outcome);
    return noStoreEmpty();
  } catch (err) {
    return authFailure(err, 'DELETE /api/shops/[id]');
  }
}
