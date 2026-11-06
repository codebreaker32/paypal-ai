// Reads a request body with a byte cap. Next route handlers have no body limit of their own (there is
// no proxy), so every JSON or webhook route reads through here: a declared Content-Length over the cap
// is refused before reading, and a chunked body is counted as it streams and stopped once it passes.
import { jsonError } from './json-error';

/** JSON bodies (setup, seller and buyer-console routes) and PayPal webhook events: a few KB in practice. */
export const MAX_JSON_BODY_BYTES = 64 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super('Request body too large');
    this.name = 'BodyTooLargeError';
  }
}

export const bodyTooLarge = (): Response => jsonError(413, 'BODY_TOO_LARGE', 'That request is too large.');

/** The body as UTF-8 text; throws BodyTooLargeError past `maxBytes`. */
export async function readTextLimited(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** The body parsed as JSON; throws BodyTooLargeError past `maxBytes`, or a SyntaxError (as req.json() does). */
export async function readJsonLimited(req: Request, maxBytes: number): Promise<unknown> {
  return JSON.parse(await readTextLimited(req, maxBytes));
}
