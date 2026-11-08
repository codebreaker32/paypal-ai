// Resolves ownership before any loading skeleton below it streams, so a non-owner still gets a real 404 status.
// Layouts do not re-run on client navigation, so every page under here keeps its own requireOwner as well.
import { requireOwner } from '@/lib/auth/owner';

export default async function ShopAppLayout({ children, params }: LayoutProps<'/shops/[id]'>) {
  const { id } = await params;
  await requireOwner(id);
  return children;
}
