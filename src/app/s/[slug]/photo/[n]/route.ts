// GET /s/[slug]/photo/[n]: the original menu photo (1-based) a published shop was made from. Public.
// ?size=avatar: its centre square at 160 px, WebP, for the shop's picture (src/lib/catalog/menu-photo.ts).
import path from 'node:path';
import { menuPhotoResponse } from '@/lib/catalog/menu-photo';
import { getDb } from '@/lib/db';
import * as shopsRepo from '@/lib/db/repos/shops';
import { readUpload } from '@/lib/uploads';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; n: string }> }): Promise<Response> {
  const { slug, n } = await ctx.params;
  if (!/^[1-9]\d{0,1}$/.test(n)) return notFound();
  const shop = shopsRepo.bySlug(getDb(), slug);
  if (!shop || (shop.status !== 'live' && shop.status !== 'paused')) return notFound();
  const stored = shop.menuPhotoPaths[Number(n) - 1];
  if (!stored) return notFound();

  const type = TYPES[path.extname(stored).toLowerCase()];
  if (!type) return notFound();
  // readUpload only reads a path relative to UPLOADS_DIR that stays inside it (the form writeUpload stores).
  const bytes = await readUpload(stored).catch(() => null);
  if (!bytes) return notFound();
  const cache = 'public, max-age=300';
  return (await menuPhotoResponse(req, bytes, type, { original: cache, avatar: cache })) ?? notFound();
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
