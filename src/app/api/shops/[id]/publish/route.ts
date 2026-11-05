// POST /api/shops/[id]/publish (owner): sends every resolved, priced item to PayPal's catalog and
// streams progress as NDJSON, one JSON object per line:
//   { type: 'start', items: [{ itemId, name }] }
//   { type: 'item', itemId, ok: true, paypalProductId } | { type: 'item', itemId, ok: false, message }   (per item)
//   { type: 'done', published, failed: [{ itemId, message }], shop: { status, slug } }
//   { type: 'error', message }   (only if the run itself broke)
// Re-POSTing publishes only what is left (items already in PayPal are skipped), so it is the retry.
import { ConfigError } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';
import { getPayPal } from '@/lib/paypal';
import { itemsToPublish, publishShop } from '@/lib/catalog/publish';
import { jsonError, notFound, ownedShop } from '@/lib/catalog/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

// One publish run per shop at a time (a double tap would otherwise race itself; harmless, but noisy).
const running = new Set<string>();

export async function POST(_req: Request, ctx: RouteContext<'/api/shops/[id]/publish'>): Promise<Response> {
  const { id } = await ctx.params;
  if (!(await ownedShop(id))) return notFound();
  const db = getDb();

  let paypal;
  try {
    paypal = getPayPal();
  } catch (err) {
    if (err instanceof ConfigError) {
      return jsonError('PAYPAL_NOT_CONFIGURED', 'Publishing needs PayPal sandbox keys. Add PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY to .env and restart.', 503);
    }
    throw err;
  }

  const todo = itemsToPublish(db, id);
  if (todo.length === 0) {
    return jsonError('NOTHING_TO_PUBLISH', 'Nothing is ready to publish. Give at least one item a price and clear its check.', 400);
  }
  if (running.has(id)) return jsonError('PUBLISH_RUNNING', 'Already adding your items to PayPal.', 409);
  running.add(id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: 'start', items: todo.map((i) => ({ itemId: i.id, name: i.name })) });
        const result = await publishShop({ db, paypal }, id, send);
        const shop = shops.byId(db, id)!;
        send({ type: 'done', ...result, shop: { status: shop.status, slug: shop.slug } });
      } catch (err) {
        console.error('publish:', err instanceof Error ? err.message : err);
        send({ type: 'error', message: "We couldn't finish publishing. Try again in a moment." });
      } finally {
        running.delete(id);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
