import Link from 'next/link';
import { Logo } from './Logo';

/** Minimal header shared by every screen: the wordmark, linking home, on a ruled bar. */
export function SiteHeader() {
  return (
    <header className="border-b border-(--header-border) bg-(--header-bg)">
      <div className="mx-auto flex h-(--header-h) w-full max-w-page items-center justify-between px-gutter">
        <Link href="/" aria-label="Shelfie home" className="-mx-1 inline-flex min-h-tap items-center rounded-sm px-1">
          <Logo />
        </Link>
        <span className="hidden type-stamp text-ink-muted sm:inline">PayPal sandbox</span>
      </div>
    </header>
  );
}
