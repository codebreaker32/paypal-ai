// Decides before the list's loading skeleton streams, so a logged-out visitor or an empty account gets a real redirect.
// A route group, not `shops/layout.tsx`: a loading.tsx at `shops/` would stream a 200 for every `/shops/[id]` page, and a non-owner must get a real 404.
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireAccount } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as shops from '@/lib/db/repos/shops';

export default async function ShopsListLayout({ children }: { children: ReactNode }) {
  const account = await requireAccount('/shops');
  if (shops.listByAccount(getDb(), account.id).length === 0) redirect('/shops/new');
  return <div className="mx-auto w-full max-w-page px-gutter pt-6 pb-12 lg:pt-10">{children}</div>;
}
