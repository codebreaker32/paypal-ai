// GET /api/health: the host's health check (render.yaml healthCheckPath). One trivial SQLite query, so a missing or
// unwritable disk fails the check. It never calls PayPal or Claude: a sandbox or API outage must not restart the service.
import { getDb } from '@/lib/db';
import { jsonError } from '@/lib/http/json-error';
import { json } from '@/lib/seller/http';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    getDb().prepare('SELECT 1').get();
    return json({ ok: true });
  } catch (e) {
    console.error(`[shelfie] health check: database unavailable: ${e instanceof Error ? e.message : String(e)}`);
    return jsonError(503, 'DB_UNAVAILABLE', 'The database is not available.');
  }
}
