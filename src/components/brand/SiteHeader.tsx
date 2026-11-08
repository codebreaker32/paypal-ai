import Link from 'next/link';
import { Frame } from './Frame';
import { Logo } from './Logo';

/** Minimal header shared by every screen: the wordmark, linking home. */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <Frame className="flex h-16 items-center">
        <Link href="/" aria-label="Shelfie home" className="press-text -mx-1 inline-flex min-h-tap items-center rounded-sm px-1">
          <Logo />
        </Link>
      </Frame>
    </header>
  );
}
