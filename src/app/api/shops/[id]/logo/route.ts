// The shop's logo (owner only), its picture in the shop page's avatar, the dashboard header and the start page.
// POST /api/shops/[id]/logo: multipart field "photo" → 200 { logoUrl: "/i/<file>" }. Rotated upright, the centre
//   square cut at 512 px, WebP, metadata dropped; replaces (and deletes) an earlier upload. The cover route's decoder,
//   limits and errors (src/app/api/shops/[id]/cover/route.ts): 404, 400 NO_PHOTOS, 413, 415 BAD_IMAGE, 411, 429.
// DELETE /api/shops/[id]/logo → 204 (the avatar falls back to the cover, a menu photo or a drawing).
// The handlers are shared with the cover route (src/lib/catalog/shop-image-route.ts).
import { shopImageRoutes } from '@/lib/catalog/shop-image-route';

export const runtime = 'nodejs';

const routes = shopImageRoutes('logo', { onDelete: () => new Response(null, { status: 204 }) });
export const POST = routes.POST;
export const DELETE = routes.DELETE;
