// JSON helpers shared by the setup route handlers. Every error is { error: { code, message } }.
//
// Where handlers get their dependencies: the one that calls PayPal (publish) takes db + PayPal from
// the composition root, getOrderDeps() in src/lib/services.ts. The others only touch SQLite and use
// getDb(), the same connection getOrderDeps().db returns: getOrderDeps() builds the PayPal client
// and so throws without PayPal keys, and every step before publishing works without them.
import { getOwnedShop } from '@/lib/auth/owner';
import type { Shop } from '@/lib/domain/types';
import { UploadError } from '@/lib/uploads';
import { EditError } from './edits';

export function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });
}

export const notFound = () => jsonError('NOT_FOUND', 'No such shop, or this browser does not own it.', 404);

/** Maps the errors our libraries throw on purpose; anything else is a logged 500. */
export function errorResponse(err: unknown, where: string): Response {
  if (err instanceof EditError || err instanceof UploadError) return jsonError(err.code, err.message, err.status);
  console.error(`${where}:`, err instanceof Error ? err.message : err);
  return jsonError('SERVER_ERROR', 'Something went wrong on our side. Try again in a moment.', 500);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new EditError('INVALID_REQUEST', 400, 'Send a JSON body.');
  }
}

/** The shop if this browser owns it (owner cookie), else null. Route handlers answer 404 for null. */
export function ownedShop(id: string): Promise<Shop | null> {
  return getOwnedShop(id);
}
