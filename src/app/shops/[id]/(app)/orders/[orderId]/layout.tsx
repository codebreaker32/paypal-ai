// Resolves ownership and the order before loading.tsx streams: Next sends status 200 once streaming starts, so a
// stranger or another shop's order must get notFound() here to be a real 404 (e2e/dashboard.spec.ts).
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/db';
import * as ordersRepo from '@/lib/db/repos/orders';

export default async function OrderDetailLayout({ children, params }: LayoutProps<'/shops/[id]/orders/[orderId]'>) {
  const { id, orderId } = await params;
  const shop = await requireOwner(id);
  const stored = ordersRepo.byId(getDb(), orderId);
  if (!stored || stored.shopId !== shop.id) notFound();
  return children;
}
