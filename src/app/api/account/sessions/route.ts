// DELETE /api/account/sessions → 204: this account's other devices are logged out, this one stays. 401 LOGIN_REQUIRED.
import { authFailure, loginRequired, noStoreEmpty } from '@/lib/auth/http';
import { currentSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as sessions from '@/lib/db/repos/sessions';
import { hashToken } from '@/lib/domain/ids';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

export async function DELETE(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  try {
    const session = await currentSession();
    if (!session) return loginRequired();
    sessions.deleteOthersForAccount(getDb(), session.account.id, hashToken(session.token));
    return noStoreEmpty();
  } catch (err) {
    return authFailure(err, 'DELETE /api/account/sessions');
  }
}
