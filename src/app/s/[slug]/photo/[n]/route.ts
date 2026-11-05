// GET /s/[slug]/photo/[n]: the original menu photo (1-based) a published shop was made from. Public.
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as shopsRepo from '@/lib/db/repos/shops';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; n: string }> }): Promise<Response> {
  const { slug, n } = await ctx.params;
  if (!/^[1-9]\d{0,1}$/.test(n)) return notFound();
  const shop = shopsRepo.bySlug(getDb(), slug);
  if (!shop || (shop.status !== 'live' && shop.status !== 'paused')) return notFound();
  const stored = shop.menuPhotoPaths[Number(n) - 1];
  if (!stored) return notFound();

  const type = TYPES[path.extname(stored).toLowerCase()];
  const file = type ? await resolveUpload(stored) : null;
  if (!file || !type) return notFound();
  const bytes = await fs.readFile(file).catch(() => null);
  if (!bytes) return notFound();
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': type, 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' },
  });
}

/**
 * The stored path may be relative to UPLOADS_DIR, relative to the app folder, or absolute. Whatever it is, only a
 * file inside UPLOADS_DIR is ever served.
 */
async function resolveUpload(stored: string): Promise<string | null> {
  const root = path.resolve(getConfig().uploadsDir);
  const candidates = path.isAbsolute(stored) ? [path.resolve(stored)] : [path.resolve(root, stored), path.resolve(stored)];
  for (const candidate of candidates) {
    if (!candidate.startsWith(root + path.sep)) continue;
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat?.isFile()) return candidate;
  }
  return null;
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
