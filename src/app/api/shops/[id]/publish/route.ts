// POST /api/shops/[id]/publish (owner): sends every resolved, priced item to PayPal's catalog and
// streams progress as NDJSON, one JSON object per line:
//   { type: 'start', items: [{ itemId, name }] }
//   { type: 'item', itemId, ok: true, paypalProductId } | { type: 'item', itemId, ok: false, message }   (per item)
//   { type: 'done', published, failed: [{ itemId, message }], shop: { status, slug } }
//   { type: 'error', message }   (only if the run itself broke)
// A shop without the seller's PayPal email (other than the demo shop) is a 409 PAYEE_REQUIRED before anything starts.
// Re-POSTing publishes only what is left (items already in PayPal are skipped), so it is the retry.
// It also finishes a run that broke after its items reached PayPal but before the shop went live.
// The run never depends on the browser: if the seller closes the tab, it carries on and goes live.
import { ConfigError } from '@/lib/config';
import * as shops from '@/lib/db/repos/shops';
import { assertPayee, canGoLive, itemsToPublish, publishShop } from '@/lib/catalog/publish';
import { errorResponse, notFound, ownedShop } from '@/lib/catalog/http';
import { jsonError } from '@/lib/http/json-error';
import type { OrderDeps } from '@/lib/orders/service';
import { getOrderDeps } from '@/lib/services';

export const runtime = 'nodejs';
export const maxDuration = 120;

// One publish run per shop at a time (a double tap would otherwise race itself; harmless, but noisy).
const running = new Set<string>();

export async function POST(_req: Request, ctx: RouteContext<'/api/shops/[id]/publish'>): Promise<Response> {
  const { id } = await ctx.params;
  const owned = await ownedShop(id);
  if (!owned) return notFound();
  // Where the money goes comes first: without the seller's PayPal email nothing is sent to PayPal (spec §8a).
  try {
    assertPayee(owned);
  } catch (err) {
    return errorResponse(err, 'POST /api/shops/[id]/publish');
  }

  let deps: OrderDeps;
  try {
    deps = getOrderDeps();
  } catch (err) {
    if (err instanceof ConfigError) {
      return jsonError(503, 'PAYPAL_NOT_CONFIGURED', 'Publishing needs PayPal sandbox keys. Add PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY to .env and restart.');
    }
    throw err;
  }
  const { db, paypal } = deps;

  const todo = itemsToPublish(db, id);
  if (todo.length === 0 && !canGoLive(db, id)) {
    return jsonError(400, 'NOTHING_TO_PUBLISH', 'Nothing is ready to publish. Give at least one item a price and clear its check.');
  }
  if (running.has(id)) return jsonError(409, 'PUBLISH_RUNNING', 'Already adding your items to PayPal.');
  running.add(id);

  const encoder = new TextEncoder();
  // Set when the browser goes away (or the stream breaks): from then on progress is dropped, not thrown.
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        send({ type: 'start', items: todo.map((i) => ({ itemId: i.id, name: i.name })) });
        const result = await publishShop({ db, paypal }, id, send);
        const shop = shops.byId(db, id)!;
        send({ type: 'done', ...result, shop: { status: shop.status, slug: shop.slug } });
      } catch (err) {
        console.error('publish:', err instanceof Error ? err.message : err);
        send({ type: 'error', message: "We couldn’t finish publishing. Try again in a moment." });
      } finally {
        running.delete(id);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed by the other side */
          }
        }
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
