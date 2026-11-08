// POST /api/auth/login { email, password, next? } → 200 { next }, session set.
// Errors: 401 BAD_CREDENTIALS, the same for an unknown email and a wrong password (SR9); 429 RATE_LIMITED (before any
// hash, SR8); 503 BUSY.
import { authFailure, noStoreJson, readFields, stringField, tooManyTries } from '@/lib/auth/http';
import { safeNext } from '@/lib/auth/next-path';
import { dummyVerify, hashPassword, needsRehash, verifyPassword } from '@/lib/auth/password';
import { landingPath, startSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import { parsePayeeEmail } from '@/lib/domain/payee';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { assertSameOrigin } from '@/lib/http/same-origin';
import { allowLogin, recordLoginFailure } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const badCredentials = (): Response => jsonError(401, 'BAD_CREDENTIALS', 'That email and password don’t match.');

export async function POST(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  try {
    const fields = await readFields(req);
    const typedEmail = stringField(fields.email);
    const password = stringField(fields.password);
    const ip = clientIp(req);
    if (!allowLogin(ip, typedEmail)) return tooManyTries();

    const db = getDb();
    const parsed = parsePayeeEmail(typedEmail);
    const account = parsed.ok ? accounts.byEmail(db, parsed.email) : null;
    if (!account) {
      await dummyVerify(password);
      recordLoginFailure(ip, typedEmail);
      return badCredentials();
    }
    if (!(await verifyPassword(password, account.passwordHash))) {
      recordLoginFailure(ip, typedEmail);
      return badCredentials();
    }
    if (needsRehash(account.passwordHash)) accounts.setPasswordHash(db, account.id, await hashPassword(password));
    await startSession(account.id);
    return noStoreJson({ next: safeNext(fields.next) ?? landingPath(account.id, db) });
  } catch (err) {
    return authFailure(err, 'POST /api/auth/login');
  }
}
