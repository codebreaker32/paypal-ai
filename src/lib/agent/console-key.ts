// The buyer console calls the shop's agent door over HTTP from the server, so the door sees the server's IP. The console
// proves itself with a per-process random secret and passes the buyer's IP; only then does the door key create_order by
// that IP. A wrong or missing secret never changes the key.
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const CONSOLE_HEADER = 'x-shelfie-console';
export const BUYER_IP_HEADER = 'x-shelfie-buyer-ip';

// On globalThis so every route bundle in the process shares one secret.
const g = globalThis as unknown as { __shelfieConsoleKey?: Buffer };
const key = (): Buffer => (g.__shelfieConsoleKey ??= Buffer.from(randomBytes(32).toString('hex')));

/** Headers the console sends on every request to the agent door. */
export function consoleHeaders(buyerIp: string): Record<string, string> {
  return { [CONSOLE_HEADER]: key().toString(), [BUYER_IP_HEADER]: buyerIp };
}

/**
 * The rate-limit identity for an agent-door request: `console:<buyer ip>` when the console secret matches (timing-safe)
 * and a buyer IP is present, otherwise the request IP.
 */
export function doorRateIdentity(req: Request, requestIp: string): string {
  const given = req.headers.get(CONSOLE_HEADER);
  const buyerIp = req.headers.get(BUYER_IP_HEADER)?.trim().slice(0, 64);
  if (!given || !buyerIp) return requestIp;
  const expected = key();
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return requestIp;
  return `console:${buyerIp}`;
}
