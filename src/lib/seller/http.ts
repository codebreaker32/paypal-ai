// JSON responses for Task 8's route handlers. Errors follow the wave-2 contract: { error: { code, message } }.
import { MAX_JSON_BODY_BYTES, readJsonLimited } from '@/lib/http/read-body';

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

/** Reads a JSON body; null when it is missing, not JSON or over 64 KB (read with a byte cap, never buffered whole). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await readJsonLimited(req, MAX_JSON_BODY_BYTES);
  } catch {
    return null;
  }
}
