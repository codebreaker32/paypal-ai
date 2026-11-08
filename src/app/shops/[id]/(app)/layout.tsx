// Resolves ownership before any loading skeleton below it streams, so a non-owner still gets a real 404 status.
// Layouts do not re-run on client navigation, so every page under here keeps its own requireOwner as well.
import { AppShell } from '@/components/app/AppShell';
import { requireOwner } from '@/lib/auth/owner';
import { loadShell } from '@/lib/seller/shell';

export default async function ShopAppLayout({ children, params }: LayoutProps<'/shops/[id]'>) {
  const { id } = await params;
  const shop = await requireOwner(id);
  const { data, account } = await loadShell(shop);
  return (
    <AppShell data={data} account={account}>
      {children}
    </AppShell>
  );
}
