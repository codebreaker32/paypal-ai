// POST /api/auth/recover { email, recoveryKey, newPassword } → 200 { recoveryKey, next }: a new key, every old session
// ended, a new session here. Errors: 401 BAD_RECOVERY, the same for an unknown email and a wrong key; 400
// WEAK_PASSWORD; 429 RATE_LIMITED (before any hash); 503 BUSY. The swap is atomic (`redeemRecoveryKey`).
import { authFailure, noStoreJson, readFields, stringField, tooManyTries } from '@/lib/auth/http';
import { checkNewPassword } from '@/lib/auth/password';
import { redeemRecoveryKey } from '@/lib/auth/recovery';
import { landingPath, startSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { parsePayeeEmail } from '@/lib/domain/payee';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { assertSameOrigin } from '@/lib/http/same-origin';
import { reserveRecovery, type ReleaseFailure } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  let release: ReleaseFailure | null = null;
  try {
    const fields = await readFields(req);
    const typedEmail = stringField(fields.email);
    const ip = clientIp(req);
    release = reserveRecovery(ip, typedEmail);
    if (!release) return tooManyTries('Too many tries. Wait an hour and try again.'); // every recovery limit is hourly

    const parsed = parsePayeeEmail(typedEmail);
    const email = parsed.ok ? parsed.email : '';
    const check = checkNewPassword(fields.newPassword, email);
    if (!check.ok) {
      release();
      return jsonError(400, 'WEAK_PASSWORD', check.message);
    }

    const db = getDb();
    const result = await redeemRecoveryKey(db, {
      email,
      recoveryKey: stringField(fields.recoveryKey),
      newPassword: stringField(fields.newPassword),
    });
    if (!result.ok) return jsonError(401, 'BAD_RECOVERY', 'That email and recovery key don’t match. Check for typos.');
    release();
    await startSession(result.account.id);
    return noStoreJson({ recoveryKey: result.recoveryKey, next: landingPath(result.account.id, db) });
  } catch (err) {
    release?.(); // no key was checked (503 BUSY, or a failure on our side)
    return authFailure(err, 'POST /api/auth/recover');
  }
}
