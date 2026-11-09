'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { BUYER_LINKS, COMPACT_LINKS, FOOTER_GROUPS, footerKind, type FooterLink } from '@/lib/brand/footer';
import { TEST_MODE_LINE } from '@/lib/brand/test-mode';
import { Frame } from './Frame';
import { SoundToggle } from './SoundToggle';

const LINK = 'press-text inline-flex min-h-tap items-center text-ink-soft hover:text-ink';

/** Not prefetched: a footer scrolls into view on every page, and a buyer on a phone should not pay for the legal pages. */
function FooterAnchor({ link }: { link: FooterLink }) {
  if (link.native) {
    return (
      <a href={link.href} className={LINK}>
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} prefetch={false} className={LINK}>
      {link.label}
    </Link>
  );
}

/** One row: the sentence on the left; the links and the sound switch on the right (under it on a phone). */
function CompactFooter({ links }: { links: FooterLink[] }) {
  return (
    <Frame className="flex flex-wrap items-center justify-between gap-x-6 py-2 type-meta text-ink-muted">
      <p className="py-2">{TEST_MODE_LINE}</p>
      <div className="flex w-full items-center gap-x-5 sm:w-auto">
        <nav aria-label="Footer" className="flex items-center gap-x-5">
          {links.map((link) => (
            <FooterAnchor key={link.href} link={link} />
          ))}
        </nav>
        <span className="ml-auto sm:ml-0">
          <SoundToggle />
        </span>
      </div>
    </Frame>
  );
}

/**
 * The landing, help and legal pages. In the DOM the groups come first (a phone shows them above the sentence), and the
 * logo and sentence hold nothing focusable, so moving them left at `lg` leaves the tab order matching what is seen.
 */
function SiteWideFooter() {
  return (
    <Frame className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-8 py-10 lg:grid-cols-12 lg:gap-x-10 lg:py-14">
      <nav aria-label="Footer" className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-6 lg:col-span-7 lg:col-start-5 lg:row-start-1 lg:flex lg:justify-between">
        {FOOTER_GROUPS.map((group, index) => (
          <div key={group.label}>
            <p id={`footer-group-${index}`} className="type-label text-ink">
              {group.label}
            </p>
            <ul aria-labelledby={`footer-group-${index}`} className="mt-1 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <FooterAnchor link={link} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex flex-col items-start gap-3 lg:col-span-4 lg:col-start-1 lg:row-start-1">
        <Logo />
        <p className="type-meta text-ink-muted">{TEST_MODE_LINE}</p>
      </div>
      <span className="self-start justify-self-end lg:col-start-12 lg:row-start-1">
        <SoundToggle />
      </span>
    </Frame>
  );
}

/** One honest line on every public page, the links for that kind of page, and the sound switch for anyone signed out. */
export function SiteFooter() {
  const kind = footerKind(usePathname() ?? '/');
  return (
    <footer data-site-chrome="" className="border-t border-line">
      {kind === 'site' ? <SiteWideFooter /> : <CompactFooter links={kind === 'buyer' ? BUYER_LINKS : COMPACT_LINKS} />}
    </footer>
  );
}
