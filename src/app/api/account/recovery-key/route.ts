// POST /api/account/recovery-key { currentPassword } → 200 { recoveryKey }: a new key, the old one cancelled.
// Errors: 401 LOGIN_REQUIRED; 403 PASSWORD_REQUIRED (none sent) or PASSWORD_WRONG; 429 RATE_LIMITED; 503 BUSY.
// PATCH (no body) → 204: the seller has saved the current key, so the banner goes. 401 LOGIN_REQUIRED.
import { authFailure, checkCurrentPassword, loginRequired, noStoreEmpty, noStoreJson, passwordWrong, readFields } from '@/lib/auth/http';
import { generateRecoveryKey, hashRecoveryKey } from '@/lib/auth/recovery';
import { currentAccount } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as accounts from '@/lib/db/repos/accounts';
import { clientIp } from '@/lib/http/client-ip';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  try {
    const account = await currentAccount();
    if (!account) return loginRequired();
    const denied = await checkCurrentPassword(account, (await readFields(req)).currentPassword, clientIp(req));
    if (denied) return denied;
    const recoveryKey = generateRecoveryKey();
    // A recovery may have replaced the password during the check above: its new key must stay the live one.
    if (!accounts.replaceRecoveryHash(getDb(), account.id, hashRecoveryKey(recoveryKey), account.passwordHash)) return passwordWrong();
    return noStoreJson({ recoveryKey });
  } catch (err) {
    return authFailure(err, 'POST /api/account/recovery-key');
  }
}

export async function PATCH(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  try {
    const account = await currentAccount();
    if (!account) return loginRequired();
    accounts.markRecoverySaved(getDb(), account.id);
    return noStoreEmpty();
  } catch (err) {
    return authFailure(err, 'PATCH /api/account/recovery-key');
  }
}
