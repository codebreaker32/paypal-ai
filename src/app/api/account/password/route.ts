// POST /api/account/password { currentPassword, password } → 204: the password changed, every other session ended, this
// one kept. Errors: 400 WEAK_PASSWORD; 401 LOGIN_REQUIRED; 403 PASSWORD_REQUIRED or PASSWORD_WRONG; 429 RATE_LIMITED
// (before any hash); 503 BUSY.
import { authFailure, checkCurrentPassword, loginRequired, noStoreEmpty, passwordWrong, readFields } from '@/lib/auth/http';
import { checkNewPassword, hashPassword } from '@/lib/auth/password';
import { accountIdOfSession, currentSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import { hashToken } from '@/lib/domain/ids';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  try {
    const session = await currentSession();
    if (!session) return loginRequired();
    const { account, token } = session;
    const { currentPassword, password } = await readFields(req);
    const check = checkNewPassword(password, account.email);
    if (!check.ok) return jsonError(400, 'WEAK_PASSWORD', check.message);
    const denied = await checkCurrentPassword(account, currentPassword, clientIp(req));
    if (denied) return denied;
    const passwordHash = await hashPassword(password as string);
    const db = getDb();
    // Both waits above can outlast the session or the password: the write answers for what is true now.
    const outcome = db.transaction((): Response | null => {
      if (accountIdOfSession(db, token) !== account.id) return loginRequired();
      return accounts.changePassword(db, account.id, passwordHash, account.passwordHash, hashToken(token)) ? null : passwordWrong();
    })();
    return outcome ?? noStoreEmpty();
  } catch (err) {
    return authFailure(err, 'POST /api/account/password');
  }
}
