// PATCH /api/shops/[id] (owner): { name?, about?, pickupNotes?, fulfillment?, shippingFeeCents?, status?, payeeEmail?,
// currentPassword? } → 200 { shop }. `status` only toggles live ↔ paused on a published shop (the dashboard's pause).
// `payeeEmail` is the seller's PayPal email (400 INVALID_PAYEE_EMAIL if malformed; null is refused once live, except for
// the demo shop). Changing it on an account-owned published or paused shop needs `currentPassword` (SR18): 403
// PASSWORD_REQUIRED or PASSWORD_WRONG, 429 RATE_LIMITED, 503 BUSY. Every change on a published shop is recorded, masked,
// in the same transaction as the update.
import { authFailure, checkCurrentPassword } from '@/lib/auth/http';
import { applyShopPatch, parseShopPatch } from '@/lib/catalog/edits';
import { notFound, ownedShop, readJson } from '@/lib/catalog/http';
import { getDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import * as payeeChanges from '@/lib/db/repos/payee-changes';
import { clientIp } from '@/lib/http/client-ip';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

/** `currentPassword` belongs to this route, not to the shop patch, which refuses unknown fields. */
function takePassword(body: unknown): { currentPassword: unknown; rest: unknown } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { currentPassword: undefined, rest: body };
  const { currentPassword, ...rest } = body as Record<string, unknown>;
  return { currentPassword, rest };
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/shops/[id]'>): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  try {
    const { currentPassword, rest } = takePassword(await readJson(req));
    const patch = parseShopPatch(rest);
    const db = getDb();
    const newEmail = patch.payeeEmail !== undefined && patch.payeeEmail !== shop.payeeEmail;
    const published = shop.status !== 'draft';
    if (shop.accountId && published && newEmail) {
      const denied = await checkCurrentPassword(accounts.byId(db, shop.accountId)!, currentPassword, clientIp(req));
      if (denied) return denied;
    }
    const updated = db.transaction(() => {
      const next = applyShopPatch(db, shop, patch);
      if (published && newEmail && patch.payeeEmail) payeeChanges.record(db, shop.id, shop.payeeEmail, patch.payeeEmail);
      return next;
    })();
    return Response.json({ shop: updated });
  } catch (err) {
    return authFailure(err, 'PATCH /api/shops/[id]');
  }
}
