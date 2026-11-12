// POST /api/auth/signup { email, password } → 201 { recoveryKey, next }, session set. The key is shown once.
// Errors: 400 INVALID_EMAIL, WEAK_PASSWORD; 409 EMAIL_TAKEN; 429 RATE_LIMITED (before any hash); 503 BUSY.
import { authFailure, noStoreJson, readFields, tooManyTries } from '@/lib/auth/http';
import { checkNewPassword, hashPassword } from '@/lib/auth/password';
import { generateRecoveryKey, hashRecoveryKey } from '@/lib/auth/recovery';
import { landingPath, startSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import { parsePayeeEmail } from '@/lib/domain/payee';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { assertSameOrigin } from '@/lib/http/same-origin';
import { TERMS_VERSION } from '@/lib/legal/version';
import { allowSignup } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const emailTaken = (): Response =>
  jsonError(409, 'EMAIL_TAKEN', 'There’s already an account with this email. Log in or use your recovery key.');

const isDuplicateEmail = (err: unknown): boolean =>
  (err as { code?: unknown } | null)?.code === 'SQLITE_CONSTRAINT_UNIQUE';

export async function POST(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  if (!allowSignup(clientIp(req))) return tooManyTries();
  try {
    const { email: rawEmail, password } = await readFields(req);
    const parsed = parsePayeeEmail(rawEmail);
    if (!parsed.ok) return jsonError(400, 'INVALID_EMAIL', 'Enter your email, like rosa@example.com.');
    const { email } = parsed;
    const check = checkNewPassword(password, email);
    if (!check.ok) return jsonError(400, 'WEAK_PASSWORD', check.message);

    const db = getDb();
    if (accounts.byEmail(db, email)) return emailTaken();
    const passwordHash = await hashPassword(password as string);
    const recoveryKey = generateRecoveryKey();
    let account: accounts.Account;
    try {
      account = accounts.create(db, { email, passwordHash, recoveryHash: hashRecoveryKey(recoveryKey), termsVersion: TERMS_VERSION });
    } catch (err) {
      if (isDuplicateEmail(err)) return emailTaken(); // two sign-ups raced past the check above
      throw err;
    }
    await startSession(account.id);
    return noStoreJson({ recoveryKey, next: landingPath(account.id, db) }, 201);
  } catch (err) {
    return authFailure(err, 'POST /api/auth/signup');
  }
}
