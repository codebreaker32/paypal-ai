import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { Banner, BANNER_ACTION } from '@/components/app/Banner';

/** Until the seller has saved a recovery key: on every seller page (the shell's banner slot) and on `/shops`. */
export function RecoveryBanner() {
  return (
    <Banner
      icon={KeyRound}
      action={
        <Link href="/account#recovery-key" className={BANNER_ACTION}>
          Get a new key
        </Link>
      }
    >
      <span className="font-semibold">Save your recovery key.</span> Without it we can’t get you back into your account.
    </Banner>
  );
}
