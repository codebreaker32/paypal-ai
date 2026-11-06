// The shop's cover photo (owner only), the wide photo at the top of the storefront.
// POST /api/shops/[id]/cover: multipart field "photo" → 200 { coverUrl: "/i/<file>" }. Rotated upright, fitted to
//   2000 px, WebP, metadata dropped; replaces (and deletes) an earlier upload. Errors as for an item photo
//   (src/app/api/shops/[id]/items/[itemId]/photo/route.ts): 404, 400 NO_PHOTOS, 413, 415 BAD_IMAGE, 411, 429.
// DELETE /api/shops/[id]/cover → 200 { coverUrl: null }.
// The handlers are shared with the logo route (src/lib/catalog/shop-image-route.ts).
import { shopImageRoutes } from '@/lib/catalog/shop-image-route';

export const runtime = 'nodejs';

const routes = shopImageRoutes('cover', { onDelete: () => Response.json({ coverUrl: null }) });
export const POST = routes.POST;
export const DELETE = routes.DELETE;
