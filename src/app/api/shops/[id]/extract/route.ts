// Reading the menu (owner only).
// POST /api/shops/[id]/extract: reads the shop's photos with Claude (8-15 s, synchronous) and drafts
//   the menu. Optional multipart "photos" + "mode" ('replace' | 'add') swaps or adds pages first
//   (the retake screen). Answers:
//     200 { catalog }                        read; the review is ready
//     200 { unreadable: { reason, tip } }    not a menu / unreadable / no items: retake
//     202 { reading: true }                  a reading is already going; poll GET
//     502 { error: { code: 'READING_FAILED', message } }
// GET /api/shops/[id]/extract: { status: 'none'|'running'|'done'|'failed'|'unreadable', message?, reason?, tip? }
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { extractMenu } from '@/lib/ai/extract';
import { loadSetupView, runReading, setShopPhotos } from '@/lib/catalog/setup';
import { errorResponse, notFound, ownedShop } from '@/lib/catalog/http';
import { jsonError } from '@/lib/http/json-error';
import { MAX_PHOTOS, UploadError, checkUploadSize, readFileLimited } from '@/lib/uploads';

export const runtime = 'nodejs';
// A reading can take 90 s plus one 90 s retry (src/lib/ai/extract.ts); READING_STALE_MS is 4 minutes.
export const maxDuration = 240;

// A recorded sample reading still shows the reading screen for a moment, so the flow reads the same.
const RECORDED_DELAY_MS = 2500;

export async function POST(req: Request, ctx: RouteContext<'/api/shops/[id]/extract'>): Promise<Response> {
  const { id } = await ctx.params;
  let shop = await ownedShop(id);
  if (!shop) return notFound();
  if (shop.status !== 'draft') return jsonError(409, 'SHOP_LIVE', 'This shop is already published.');
  const db = getDb();

  try {
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const view = loadSetupView(db, shop);
      if (view.step === 'reading' && view.running) return Response.json({ reading: true }, { status: 202 });
      checkUploadSize(req);
      const form = await req.formData().catch(() => null);
      const files = (form?.getAll('photos') ?? []).filter((f): f is File => typeof f !== 'string');
      if (files.length > MAX_PHOTOS) throw new UploadError('TOO_MANY_PHOTOS');
      const mode = form?.get('mode') === 'add' ? 'add' : 'replace';
      shop = await setShopPhotos(db, shop, await Promise.all(files.map(readFileLimited)), mode);
    }

    const out = await runReading(
      {
        db,
        extract: (photos) => extractMenu(photos),
        hasAiKey: Boolean(getConfig().anthropicApiKey),
        recordedDelayMs: RECORDED_DELAY_MS,
      },
      shop.id,
    );
    switch (out.status) {
      case 'running':
        return Response.json({ reading: true }, { status: 202 });
      case 'done':
        return Response.json({ catalog: out.catalog });
      case 'unreadable':
        return Response.json({ unreadable: { reason: out.reason, tip: out.tip } });
      case 'failed':
        return jsonError(502, 'READING_FAILED', out.message);
    }
  } catch (err) {
    return errorResponse(err, 'POST /api/shops/[id]/extract');
  }
}

export async function GET(_req: Request, ctx: RouteContext<'/api/shops/[id]/extract'>): Promise<Response> {
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  const view = loadSetupView(getDb(), shop);
  const body =
    view.step === 'reading'
      ? { status: view.running ? 'running' : 'none' }
      : view.step === 'failed'
        ? { status: 'failed', message: view.message }
        : view.step === 'unreadable'
          ? { status: 'unreadable', reason: view.reason, tip: view.tip }
          : { status: 'done' };
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
}
