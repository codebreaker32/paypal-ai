// PATCH /api/shops/[id]/items (owner)
//   { updates: [{ itemId, name?, description?, section?, status?: 'draft'|'in_person'|'removed', soldOut?,
//                 resolveIssues?: boolean, resolveDuplicate?: boolean, variants?: [{ label, priceCents }] }] }
//   resolveIssues clears every issue; resolveDuplicate clears only DUPLICATE (the item's own question stays).
//   → 200 { items: ItemWithVariants[] }: the shop's WHOLE menu after the updates, in menu order
//     (replace your list, or merge by id). All updates apply, or none do.
//   Prices are integer cents, 0 to 100000. Items already in PayPal accept only soldOut and
//   status 'removed' (409 ITEM_LIVE otherwise).
// POST /api/shops/[id]/items (owner): { name, section?, priceCents?, sourceText } → 201 { item }
//   Turns a skipped line into a draft item ("Make it an item" on the review screen).
import { getDb } from '@/lib/db';
import { addItem, applyItemUpdates, parseItemUpdates, parseNewItem } from '@/lib/catalog/edits';
import { errorResponse, notFound, ownedShop, readJson } from '@/lib/catalog/http';

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: RouteContext<'/api/shops/[id]/items'>): Promise<Response> {
  const { id } = await ctx.params;
  if (!(await ownedShop(id))) return notFound();
  try {
    const input = parseItemUpdates(await readJson(req));
    return Response.json({ items: applyItemUpdates(getDb(), id, input) });
  } catch (err) {
    return errorResponse(err, 'PATCH /api/shops/[id]/items');
  }
}

export async function POST(req: Request, ctx: RouteContext<'/api/shops/[id]/items'>): Promise<Response> {
  const { id } = await ctx.params;
  const shop = await ownedShop(id);
  if (!shop) return notFound();
  if (shop.status !== 'draft') {
    return Response.json({ error: { code: 'SHOP_LIVE', message: 'New items can only be added before publishing.' } }, { status: 409 });
  }
  try {
    const item = addItem(getDb(), id, parseNewItem(await readJson(req)));
    return Response.json({ item }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'POST /api/shops/[id]/items');
  }
}
