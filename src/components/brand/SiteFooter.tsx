'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { BUYER_LINKS, COMPACT_LINKS, FOOTER_NAV, FOOTER_SMALL, REPO_URL, footerKind, type FooterLink } from '@/lib/brand/footer';
import { TEST_MODE_LINE } from '@/lib/brand/test-mode';
import { cn } from '@/lib/utils';
import { Frame } from './Frame';
import { SoundToggle } from './SoundToggle';


const ANCHOR = {
  plain: 'press-text inline-flex min-h-tap items-center text-ink-soft hover:text-ink',
  band: 'press-text inline-flex min-h-tap items-center text-on-dark hover:text-blush-ring hover:underline',
  bandSmall: 'press-text inline-flex min-h-tap items-center text-sm text-on-dark-soft hover:text-on-dark hover:underline',
};

/** Not prefetched: a footer scrolls into view on every page, and a buyer on a phone should not pay for the legal pages. */
function FooterAnchor({ link, tone = 'plain' }: { link: FooterLink; tone?: keyof typeof ANCHOR }) {
  if (link.native) {
    return (
      <a href={link.href} className={ANCHOR[tone]}>
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

const ROUND_ON_DARK = 'text-on-dark hover:bg-on-dark/15 hover:text-on-dark';

/** The GitHub mark, which names the link to this project's repository. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

/**
 * Home, help and legal: a charcoal band, with the logo, four links (centred on the page) and GitHub, then the
 * test-mode sentence, the small links and the sound switch. One padding, `--footer-pad`, above, between and below
 * the rows. On the home page the chat launcher rests in the bottom-right corner; `home-chat.css` keeps exactly
 * that corner clear (`data-footer-end`, `data-footer-note`) instead of padding the whole band.
 */
function SiteWideFooter() {
  return (
    <div className="bg-charcoal text-on-dark [--focus-ring-color:var(--white)]">
      <div className="mx-auto w-full max-w-site px-band-gutter py-(--footer-pad) [--footer-pad:--spacing(3)] md:[--footer-pad:--spacing(4)]">
        <div className="flex items-center justify-between gap-x-3 pb-(--footer-pad) md:grid md:grid-cols-[1fr_auto_1fr]">
          <Logo size="sm" className="shrink-0 justify-self-start text-on-dark md:h-7" />
          <nav aria-label="Footer">
            <ul className="flex items-center gap-x-2 text-sm md:gap-x-5 md:text-base">
              {FOOTER_NAV.map((link, index) => (
                <li key={link.label} className={cn('flex items-center gap-x-2 md:gap-x-5', link.native && 'max-md:hidden')}>
                  {index > 0 && <span aria-hidden="true" className="h-4 w-px bg-on-dark-soft/50" />}
                  <FooterAnchor link={link} tone="band" />
                </li>
              ))}
            </ul>
          </nav>
          {/* -mr-2: the 28 px mark sits in a 44 px target, so its drawn edge lines up with the content edge. */}
          <a href={REPO_URL} aria-label="Shelfie on GitHub" className={`press-icon -mr-2 inline-flex size-tap items-center justify-center justify-self-end rounded-full ${ROUND_ON_DARK}`}>
            <GitHubMark className="size-7" />
          </a>
        </div>
        <div data-footer-end="" className="flex flex-wrap items-center justify-between gap-x-6 border-t border-on-dark/15 pt-(--footer-pad)">
          <p data-footer-note="" className="py-2 text-sm text-on-dark-soft max-lg:order-last max-lg:w-full">
            {TEST_MODE_LINE}
          </p>
          <div className="flex items-center gap-x-5 max-lg:w-full">
            {FOOTER_SMALL.map((link) => (
              <FooterAnchor key={link.href} link={link} tone="bandSmall" />
            ))}
            <span className="max-lg:ml-auto">
              <SoundToggle className="text-on-dark-soft ring-on-dark/30 hover:bg-on-dark/15 hover:text-on-dark" />
            </span>
          </div>
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
