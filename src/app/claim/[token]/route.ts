// GET /claim/<token>: the owner link of an unattached shop (the seed and the test harness). Opening it on another
// phone makes that browser an owner too (sets the owner cookie) and lands on the dashboard. A shop with an account has
// no owner link: its token never opens it, so it answers like an unknown link.
import { setOwnerCookie } from '@/lib/auth/owner';
import { getDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';

export const runtime = 'nodejs';

/** A constant, so it can't echo the token and reads the same for every kind of bad link. */
const BAD_LINK_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>This owner link doesn’t work · Shelfie</title>
</head>
<body style="margin:0;background:#fff;color:#111214;font-family:system-ui,sans-serif">
<main style="box-sizing:border-box;max-width:36rem;padding:48px 20px">
<img src="/brand/lockup.svg" alt="Shelfie" width="118" height="24">
<p style="margin:32px 0 24px;font-size:18px;line-height:1.5">This owner link doesn’t work. Check that you copied all of it, or log in.</p>
<a href="/login" style="display:inline-flex;align-items:center;min-height:44px;padding:0 24px;border-radius:999px;background:#111214;color:#fff;font-weight:600;text-decoration:none">Log in</a>
</main>
</body>
</html>
`;

export async function GET(_req: Request, ctx: RouteContext<'/claim/[token]'>): Promise<Response> {
  const { token } = await ctx.params;
  const shop = token.length >= 20 && token.length <= 100 ? shops.byOwnerToken(getDb(), token) : null;
  if (!shop || shop.accountId) {
    return new Response(BAD_LINK_PAGE, {
      status: 404,
      // The bad link is still a token someone may have mistyped by a character, so it stays out of any referrer.
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
    });
  }
  await setOwnerCookie(shop.id, token);
  // A relative Location works behind any proxy and on any APP_URL.
  return new Response(null, {
    status: 303,
    headers: { location: `/shops/${shop.id}`, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  });
}
