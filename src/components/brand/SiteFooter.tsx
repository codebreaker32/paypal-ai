'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { BUYER_LINKS, COMPACT_LINKS, FOOTER_BLURB, FOOTER_GROUPS, REPO_URL, footerKind, type FooterLink } from '@/lib/brand/footer';
import { TEST_MODE_LINE } from '@/lib/brand/test-mode';
import { Frame } from './Frame';
import { SoundToggle } from './SoundToggle';


const ANCHOR = {
  plain: 'press-text inline-flex min-h-tap items-center text-ink-soft hover:text-ink',
  band: 'press-text inline-flex min-h-tap min-w-tap items-center gap-2 text-base sm:whitespace-nowrap text-on-dark underline-offset-4 hover:text-blush-ring hover:underline',
};

/** Not prefetched: a footer scrolls into view on every page, and a buyer on a phone should not pay for the legal pages. */
function FooterAnchor({ link, tone = 'plain' }: { link: FooterLink; tone?: keyof typeof ANCHOR }) {
  if (link.native) {
    return (
      <a href={link.href} className={ANCHOR[tone]}>
        {link.href === REPO_URL && <GitHubMark className="size-5 shrink-0" />}
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} prefetch={false} className={ANCHOR[tone]}>
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

/** The GitHub mark, beside the link to this project's repository. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

/**
 * Home, browse, help and legal: a charcoal band in the bands' container. On top, the logo and one line about Shelfie
 * beside three titled link columns (under the logo on a phone, two columns there); under a hairline, the test-mode
 * sentence and the Sound switch. `--footer-pad` below (20 px on a phone, where it matches the chat launcher's inset), the same above from 640 px. On the home page the closing photo
 * band fades into this charcoal, so the two read as one piece, and the chat launcher rests in the bottom-right corner;
 * `home-chat.css` keeps exactly that corner clear (`data-footer-end`, `data-footer-note`).
 */
function SiteWideFooter() {
  return (
    <div className="bg-charcoal text-on-dark [--focus-ring-color:var(--white)]">
      <div className="mx-auto w-full max-w-site px-band-gutter pt-8 pb-(--footer-pad) [--footer-pad:--spacing(5)] sm:[--footer-pad:--spacing(8)] md:pt-12 md:[--footer-pad:--spacing(12)]">
        <div className="grid gap-y-8 pb-8 md:pb-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-12">
          <div className="max-w-sm">
            <Logo size="sm" className="text-on-dark md:h-8" />
            <p className="mt-4 text-base text-on-dark-soft">{FOOTER_BLURB}</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-10 gap-y-6 sm:flex sm:justify-between sm:gap-x-10 lg:justify-end lg:gap-x-16 xl:gap-x-24">
            {FOOTER_GROUPS.map((group, index) => (
              // On a phone the first column spans two rows, so the other two stack beside it.
              <div key={group.title} className={index === 0 ? 'max-sm:row-span-2' : undefined}>
                <h2 className="text-sm font-semibold text-on-dark-soft">{group.title}</h2>
                <ul className="mt-1">
                  {group.links.map((link) => (
                    // Each link is a whole 44 px target, rows 44 px apart, never overlapping.
                    <li key={link.href}>
                      <FooterAnchor link={link} tone="band" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div data-footer-end="" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-on-dark/15 pt-6 max-sm:pt-4">
          <p data-footer-note="" className="py-2 text-sm text-on-dark-soft max-sm:order-last max-sm:w-full">
            {TEST_MODE_LINE}
          </p>
          <SoundToggle className="text-on-dark-soft ring-on-dark/30 hover:bg-on-dark/15 hover:text-on-dark" />
        </div>
      </div>
    </div>
  );
}

/** One honest line on every public page, the links for that kind of page, and the sound switch for anyone signed out. */
export function SiteFooter() {
  const kind = footerKind(usePathname() ?? '/');
  return (
    <footer data-site-chrome="" className={kind === 'site' ? undefined : 'border-t border-line'}>
      {kind === 'site' ? <SiteWideFooter /> : <CompactFooter links={kind === 'buyer' ? BUYER_LINKS : COMPACT_LINKS} />}
    </footer>
  );
}
