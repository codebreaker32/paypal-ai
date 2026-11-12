// Cross-site write protection: the first statement of every state-changing route handler.
// No src/proxy.ts on purpose: a proxy truncated a 14 MB upload to 10 MB when measured.
import { getConfig } from '@/lib/config';
import { jsonError } from './json-error';

const refuse = (): Response => jsonError(403, 'BAD_ORIGIN', 'This request came from another site.');

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host || null;
  } catch {
    return null; // includes the literal Origin: null
  }
}

/** A refusal to return as it is, or null to carry on. */
export function assertSameOrigin(req: Request): Response | null {
  const origin = req.headers.get('origin');
  if (origin === null) return req.headers.get('sec-fetch-site') === 'cross-site' ? refuse() : null;
  const host = originHost(origin);
  if (!host) return refuse();
  const requestHost = (req.headers.get('x-forwarded-host') ?? req.headers.get('host'))?.split(',')[0].trim().toLowerCase();
  return host === requestHost || host === new URL(getConfig().appUrl).host ? null : refuse();
}
