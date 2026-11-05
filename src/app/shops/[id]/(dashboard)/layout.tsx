// Resolves ownership before the loading skeleton streams, so a non-owner still gets a real 404 status.
import { requireOwner } from '@/lib/auth/owner';

export default async function DashboardGroupLayout({ children, params }: LayoutProps<'/shops/[id]'>) {
  const { id } = await params;
  await requireOwner(id);
  return children;
}
