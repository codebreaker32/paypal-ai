import { unstable_rethrow } from 'next/navigation';
import { listOwnedShops } from '@/lib/auth/owner';
import { currentAccount } from '@/lib/auth/session';
import { Frame } from './Frame';
import { HeaderNav } from './HeaderNav';

/** Who is looking: a logged-in account, or the unattached shops this browser holds a cookie for. */
async function readVisitor(): Promise<{ account: { email: string } | null; ownerShopIds: string[] }> {
  try {
    const account = await currentAccount();
    if (account) return { account: { email: account.email }, ownerShopIds: [] };
    return { account: null, ownerShopIds: (await listOwnedShops()).map((s) => s.id) };
  } catch (err) {
    unstable_rethrow(err); // let Next's own signals (dynamic rendering) through
    // Every page has this header: a storage problem must only cost the account links.
    console.error('Header: could not read the visitor', err instanceof Error ? err.message : err);
    return { account: null, ownerShopIds: [] };
  }
}

/** The public header, shared by every screen outside the seller shell. */
export async function SiteHeader() {
  const visitor = await readVisitor();
  return (
    <header data-site-chrome="" className="border-b border-line bg-surface">
      <Frame className="flex h-16 items-center justify-between gap-3">
        <HeaderNav account={visitor.account} ownerShopIds={visitor.ownerShopIds} />
      </Frame>
    </header>
  );
}
