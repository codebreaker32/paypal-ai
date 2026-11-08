// POST /api/auth/logout → 204: this browser's session row is deleted and its cookie cleared. `shelfie_returning` stays,
// so a shop link next time shows the login page and not a 404.
import { noStoreEmpty, authFailure } from '@/lib/auth/http';
import { endSession } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/same-origin';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const refused = assertSameOrigin(req);
  if (refused) return refused;
  try {
    await endSession();
    return noStoreEmpty();
  } catch (err) {
    return authFailure(err, 'POST /api/auth/logout');
  }
}
