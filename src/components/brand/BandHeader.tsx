'use client';

import { AnimatePresence, m } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ButtonLink } from '@/components/ui/button';
import type { HeaderView } from '@/lib/brand/header';
import { cn } from '@/lib/utils';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';

const SECTIONS = [
  { label: 'How it works', href: '/#how-it-works', id: 'how-it-works' },
  { label: 'FAQ', href: '/#faq', id: 'faq' },
] as const;
const BROWSE = { label: 'Browse', href: '/browse' };
const HELP = { label: 'Help', href: '/help' };
/** The receipts this browser has opened (localStorage only; buyers have no accounts). */
const ORDERS = { label: 'Your orders', href: '/orders' };

const LINK = 'nav-link press-text inline-flex min-h-tap items-center whitespace-nowrap rounded-sm px-3 text-(length:--text-nav) leading-5 font-medium text-ink';
const CTA = 'nav-hit min-h-10 px-4 text-(length:--text-nav) leading-5';
const ROW = 'press-text flex min-h-14 w-full items-center text-lg font-medium text-ink hover:text-accent-ink';

// Live browser values read through useSyncExternalStore: the server and the first client render both see the defaults,
// so nothing mismatches on hydration and no effect has to copy them into state.
const onScroll = (notify: () => void) => {
  window.addEventListener('scroll', notify, { passive: true });
  window.addEventListener('resize', notify);
  return () => {
    window.removeEventListener('scroll', notify);
    window.removeEventListener('resize', notify);
  };
};
const scrolledNow = () => window.scrollY > 8;
/** The section that crosses a line 40% down the viewport (scroll-spy). */
const sectionNow = () => {
  const line = window.innerHeight * 0.4;
  for (const { id } of SECTIONS) {
    const rect = document.getElementById(id)?.getBoundingClientRect();
    if (rect && rect.top <= line && rect.bottom > line) return id;
  }
  return null;
};
const serverFalse = () => false;
const serverNull = () => null;

/**
 * The sticky header on the home, help and legal pages: a full-width bar that turns translucent with a blur, a hairline
 * and a soft shadow once the page scrolls. Below 768 px the links move into a full-width panel under the bar.
 */
export function BandHeader({ view }: { view: Extract<HeaderView, { kind: 'public' | 'account' }> }) {
  const pathname = usePathname() ?? '/';
  const scrolled = useSyncExternalStore(onScroll, scrolledNow, serverFalse);
  const spied = useSyncExternalStore(onScroll, sectionNow, serverNull);
  const active = pathname === '/' ? spied : null;
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dashboardHref = view.kind === 'public' ? view.dashboardHref : null;

  const refocus = useRef(false);
  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    refocus.current = returnFocus;
    if (returnFocus) toggleRef.current?.focus({ preventScroll: true });
  }, []);
  // A link tap can leave focus on <body> once the panel unmounts (an in-page jump): hand it back to the toggle then.
  const afterExit = useCallback(() => {
    if (refocus.current && (document.activeElement === document.body || !document.activeElement)) {
      toggleRef.current?.focus({ preventScroll: true });
    }
    refocus.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('a,button')?.focus({ preventScroll: true });
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointer = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) close(false);
    };
    const onFocus = (event: FocusEvent) => {
      if (!barRef.current?.contains(event.target as Node)) close(false);
    };
    const wide = window.matchMedia('(width >= 48rem)');
    const onWide = () => wide.matches && close(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    wide.addEventListener('change', onWide);
    return () => {
      root.style.overflow = before;
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocus);
      wide.removeEventListener('change', onWide);
    };
  }, [open, close]);

  const current = (id: string) => (active === id ? ('location' as const) : undefined);

  const bar = (
    <>
      <div className="flex shrink-0 items-center gap-6 lg:gap-10">
        <Link href={view.logoHref} aria-label="Shelfie home" className="press-text -mx-1 inline-flex min-h-tap shrink-0 items-center rounded-sm px-1">
          <Logo size="sm" className="max-[24rem]:h-5 md:h-7" />
        </Link>
        <nav aria-label="Main" className="hidden items-center md:flex">
          <ul className="flex items-center">
            <li>
              <Link href={BROWSE.href} aria-current={pathname === BROWSE.href ? 'page' : undefined} className={LINK}>
                {BROWSE.label}
              </Link>
            </li>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <Link href={section.href} aria-current={current(section.id)} className={LINK}>
                  {section.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={HELP.href} aria-current={pathname === HELP.href ? 'page' : undefined} className={LINK}>
                {HELP.label}
              </Link>
            </li>
            <li>
              <Link href={ORDERS.href} aria-current={pathname === ORDERS.href ? 'page' : undefined} className={LINK}>
                {ORDERS.label}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {dashboardHref && (
          <Link href={dashboardHref} className={cn(LINK, 'max-md:hidden')}>
            Dashboard
          </Link>
        )}
        {view.kind === 'account' ? (
          <AccountMenu email={view.email} placement="down" />
        ) : (
          <>
            <Link href="/login" className={cn(LINK, 'max-[24rem]:hidden max-md:px-2')}>
              Log in
            </Link>
            <ButtonLink href="/signup" variant="brand" className={cn(CTA, 'max-md:min-h-9 max-md:px-3.5 max-md:text-sm max-[24rem]:px-3')}>
              Add your shop
            </ButtonLink>
          </>
        )}
        <button
          ref={toggleRef}
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="band-menu"
          onClick={() => (open ? close() : setOpen(true))}
          className="press-icon -mr-2.5 inline-flex size-tap items-center justify-center rounded-full text-ink hover:bg-blush-band aria-expanded:bg-blush-band md:hidden"
        >
          <span className="nav-burger" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>
    </>
  );

  const menuLinks = [BROWSE, ...SECTIONS, HELP, ORDERS, ...(dashboardHref ? [{ label: 'Dashboard', href: dashboardHref }] : [])];

  return (
    <header
      ref={barRef}
      data-site-chrome=""
      data-band-header=""
      data-scrolled={scrolled || open ? '' : undefined}
      className="sticky top-0 z-(--z-header)"
    >
      <div aria-hidden="true" className="nav-layer nav-layer-top absolute inset-0 border-b border-blush-ring/60 bg-blush-bar" />
      <div aria-hidden="true" className="nav-layer nav-layer-scrolled absolute inset-0 border-b border-blush-ring shadow-sm" />
      <div className="relative mx-auto flex h-bar w-full max-w-site items-center justify-between gap-2 px-band-gutter md:h-bar-lg">{bar}</div>

      <AnimatePresence onExitComplete={afterExit}>
        {open && (
          <m.div
            key="menu"
            data-entrance=""
            ref={panelRef}
            id="band-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--spacing-bar))] overflow-y-auto overscroll-contain md:hidden"
          >
            <nav
              aria-label="Menu"
              className="border-b border-blush-ring bg-blush-bar px-band-gutter pt-1 pb-5 shadow-lg"
            >
              <ul>
                {menuLinks.map((link) => (
                  <li key={link.label} className="border-b border-blush-ring/70">
                    <Link
                      href={link.href}
                      aria-current={'id' in link ? current(link.id) : pathname === link.href ? 'page' : undefined}
                      className={cn(ROW, 'aria-[current]:text-accent-ink')}
                      onClick={() => close()}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                {view.kind === 'public' && (
                  <li className="border-b border-blush-ring/70">
                    <Link href="/login" className={ROW} onClick={() => close()}>
                      Log in
                    </Link>
                  </li>
                )}
              </ul>
              {view.kind === 'public' && (
                <ButtonLink href="/signup" variant="brand" size="lg" fullWidth className="mt-5" onClick={() => close()}>
                  Add your shop
                </ButtonLink>
              )}
            </nav>
          </m.div>
        )}
      </AnimatePresence>
      {/* A soft scrim below the open panel; a press on it closes the menu. */}
      <AnimatePresence>
        {open && (
          <m.div
            key="scrim"
            data-entrance=""
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onPointerDown={() => close(false)}
            className="fixed inset-0 -z-10 bg-ink/20 md:hidden"
          />
        )}
      </AnimatePresence>
    </header>
  );
}
