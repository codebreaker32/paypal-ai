import Link from 'next/link';
import { Logo } from './Logo';

/** Minimal header shared by every screen: the wordmark, linking home. */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-page items-center px-gutter">
        <Link href="/" aria-label="Shelfie home" className="-mx-1 inline-flex min-h-tap items-center rounded-sm px-1">
          <Logo />
        </Link>
      </div>
    </header>
  );
}
