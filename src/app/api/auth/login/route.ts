// POST /api/auth/login { email, password, next? } → 200 { next }, session set.
// Errors: 401 BAD_CREDENTIALS, the same for an unknown email and a wrong password (SR9); 429 RATE_LIMITED (before any
// hash, SR8); 503 BUSY.
import { authFailure, noStoreJson, readFields, stringField, tooManyTries } from '@/lib/auth/http';
import { safeNext } from '@/lib/auth/next-path';
import { dummyVerify, hashPassword, needsRehash, verifyPassword } from '@/lib/auth/password';
import { landingPath, startSessionIfPasswordUnchanged } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import { parsePayeeEmail } from '@/lib/domain/payee';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { assertSameOrigin } from '@/lib/http/same-origin';
import { reserveLogin, type ReleaseFailure } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const badCredentials = (): Response => jsonError(401, 'BAD_CREDENTIALS', 'That email and password don’t match.');

export async function POST(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  let release: ReleaseFailure | null = null;
  try {
    const fields = await readFields(req);
    const typedEmail = stringField(fields.email);
    const password = stringField(fields.password);
    const ip = clientIp(req);
    // The failure is counted before the hash and handed back on success, so a burst cannot run more guesses than the limit.
    release = reserveLogin(ip, typedEmail);
    if (!release) return tooManyTries('Too many tries. Wait 15 minutes, or reset your password with your recovery key.');

    const db = getDb();
    const parsed = parsePayeeEmail(typedEmail);
    const account = parsed.ok ? accounts.byEmail(db, parsed.email) : null;
    if (!account) {
      await dummyVerify(password);
      return badCredentials();
    }
    if (!(await verifyPassword(password, account.passwordHash))) return badCredentials();

    let verifiedHash = account.passwordHash;
    if (needsRehash(verifiedHash)) {
      const stronger = await hashPassword(password);
      if (accounts.setPasswordHash(db, account.id, stronger, verifiedHash)) verifiedHash = stronger;
    }
    // A recovery can commit while the hash runs: a password it replaced must not start a session after it ended them all.
    if (!(await startSessionIfPasswordUnchanged(account.id, verifiedHash))) return badCredentials();
    release();
    return noStoreJson({ next: safeNext(fields.next) ?? landingPath(account.id, db) });
  } catch (err) {
    release?.(); // no guess was checked (503 BUSY, or a failure on our side)
    return authFailure(err, 'POST /api/auth/login');
  }
}
