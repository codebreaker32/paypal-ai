// POST /api/checkout/[slug] { lines, fulfillment?, note?, expectedTotalCents, requestId } → 201 { orderRef, number, approvalUrl, totalCents }.
// The shop page's cart. Same money path as the agent door: prices come from the database, PayPal is approved by the buyer.
// Errors are { error: { code, message, itemId?, scope? } }: BAD_ORIGIN 403, RATE_LIMITED 429, BODY_TOO_LARGE 413, INVALID_ORDER 400,
// SHOP_NOT_FOUND 404, PRICE_CHANGED and CHECKOUT_STALE 409, plus the codes in checkoutFailure.
import * as shopsRepo from '@/lib/db/repos/shops';
import { STOREFRONT_AGENT_NAME } from '@/lib/domain/storefront';
import { clientIp } from '@/lib/http/client-ip';
import { BodyTooLargeError, MAX_JSON_BODY_BYTES, bodyTooLarge, readJsonLimited } from '@/lib/http/read-body';
import { assertSameOrigin } from '@/lib/http/same-origin';
import { CREATE_ORDER_RATE } from '@/lib/mcp/tools';
import { CHECKOUT_COPY, CheckoutBody, checkoutFailure, type CheckoutFailure } from '@/lib/orders/checkout';
import { OrderError } from '@/lib/orders/errors';
import { priceOrder } from '@/lib/orders/pricing';
import { createOrderForShop } from '@/lib/orders/service';
import { allow } from '@/lib/rate-limit';
import { getOrderDeps } from '@/lib/services';

export const runtime = 'nodejs';

const NO_STORE = { 'cache-control': 'no-store' };

const refuse = ({ status, ...error }: CheckoutFailure): Response => Response.json({ error }, { status, headers: NO_STORE });

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;

  // Before the body is read: an over-limit caller costs no parsing, no pricing and no PayPal call.
  const ip = clientIp(req);
  if (!allow(`checkout:${ip}`, CREATE_ORDER_RATE.limit, CREATE_ORDER_RATE.windowMs)) {
    return refuse({ status: 429, code: 'RATE_LIMITED', message: CHECKOUT_COPY.rateLimited });
  }

  let raw: unknown;
  try {
    raw = await readJsonLimited(req, MAX_JSON_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return bodyTooLarge();
    raw = null;
  }
  const parsed = CheckoutBody.safeParse(raw);
  if (!parsed.success) return refuse({ status: 400, code: 'INVALID_ORDER', message: CHECKOUT_COPY.invalid });
  const body = parsed.data;

  const { slug } = await ctx.params;
  const deps = getOrderDeps();
  const shop = shopsRepo.bySlug(deps.db, slug);
  if (!shop || shop.status === 'draft') return refuse({ status: 404, code: 'SHOP_NOT_FOUND', message: 'There is no shop at this address.' });

  const priceChanged = () => refuse({ status: 409, code: 'PRICE_CHANGED', message: CHECKOUT_COPY.priceChanged });
  try {
    const priced = priceOrder(deps.db, shop, body.lines, body.fulfillment);
    if (priced.totalCents !== body.expectedTotalCents) return priceChanged();

    const order = await createOrderForShop(deps, shop, {
      lines: body.lines,
      fulfillment: body.fulfillment,
      agentName: STOREFRONT_AGENT_NAME,
      clientRequestId: body.requestId,
      clientKey: ip,
      // Null, not undefined, so dropping a note on a retried request id counts as a different request (SR27).
      buyerNote: body.note ?? null,
    });

    // A retried request id can return an order that has moved on, or whose approval window has already passed.
    if (order.status !== 'awaiting_approval' || Date.parse(order.expiresAt) <= (deps.now?.() ?? Date.now())) {
      return refuse({ status: 409, code: 'CHECKOUT_STALE', message: CHECKOUT_COPY.stale });
    }
    // The price can move between our check and the order, or a retry can return an order at an older price.
    if (order.totalCents !== body.expectedTotalCents) return priceChanged();

    return Response.json(
      { orderRef: order.id, number: order.number, approvalUrl: order.approvalUrl, totalCents: order.totalCents },
      { status: 201, headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof OrderError) return refuse(checkoutFailure(e, deps.db, shop));
    console.error(`[shelfie] checkout failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    return refuse({ status: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Try again in a moment.' });
  }
}
