// GET /claim/<token>: the owner link from the "Your shop is live" screen. Opening it on another
// phone makes that browser an owner too (sets the owner cookie) and lands on the dashboard.
import { setOwnerCookie } from '@/lib/auth/owner';
import { getDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: RouteContext<'/claim/[token]'>): Promise<Response> {
  const { token } = await ctx.params;
  const shop = token.length >= 20 && token.length <= 100 ? shops.byOwnerToken(getDb(), token) : null;
  if (!shop) {
    return new Response("This owner link doesn't match any shop. Check that you copied all of it.", {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  await setOwnerCookie(shop.id, token);
  // A relative Location works behind any proxy and on any APP_URL.
  return new Response(null, {
    status: 303,
    headers: { location: `/shops/${shop.id}`, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  });
}
