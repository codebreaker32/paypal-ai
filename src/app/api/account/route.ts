// DELETE /api/account { currentPassword } → 204: the account, its shops (rows and files) and its sessions are gone, each
// shop's slug is retired and this browser's cookie is cleared. Errors: 401 LOGIN_REQUIRED; 403 PASSWORD_REQUIRED or
// PASSWORD_WRONG; 409 OPEN_ORDERS naming the shops; 429 RATE_LIMITED (before any hash); 503 BUSY.
import { authFailure, checkCurrentPassword, loginRequired, noStoreEmpty, passwordWrong, readFields } from '@/lib/auth/http';
import { accountIdOfSession, currentSession, endSession } from '@/lib/auth/session';
import { deleteAccountRows, removeFiles } from '@/lib/catalog/delete-shop';
import { getDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

export async function DELETE(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  try {
    const session = await currentSession();
    if (!session) return loginRequired();
    const { account, token } = session;
    const denied = await checkCurrentPassword(account, (await readFields(req)).currentPassword, clientIp(req));
    if (denied) return denied;
    const db = getDb();
    const outcome = db.transaction((): Response | string[] => {
      if (accountIdOfSession(db, token) !== account.id) return loginRequired();
      if (accounts.byId(db, account.id)?.passwordHash !== account.passwordHash) return passwordWrong();
      const result = deleteAccountRows(db, account.id);
      return 'blocked' in result ? jsonError(409, 'OPEN_ORDERS', result.blocked) : result.paths;
    })();
    if (outcome instanceof Response) return outcome;
    await removeFiles(outcome);
    await endSession();
    return noStoreEmpty();
  } catch (err) {
    return authFailure(err, 'DELETE /api/account');
  }
}
