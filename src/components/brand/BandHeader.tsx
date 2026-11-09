'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import type { HeaderView } from '@/lib/brand/header';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';

const SECTIONS = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'FAQ', href: '/#faq' },
];
const LINK = 'press-text inline-flex min-h-tap items-center whitespace-nowrap font-medium text-ink hover:text-accent-ink';

/** The sticky blush bar on the home, help and legal pages. Below 768 px the section links move into a menu. */
export function BandHeader({ view }: { view: Extract<HeaderView, { kind: 'public' | 'account' }> }) {
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dashboardHref = view.kind === 'public' ? view.dashboardHref : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <header ref={barRef} data-site-chrome="" data-band-header="" className="sticky top-0 z-(--z-header) border-b border-blush-ring bg-blush-bar shadow-xs">
      <div className="mx-auto flex h-16 w-full max-w-site items-center justify-between gap-2 px-band-gutter xl:h-20">
        <div className="flex items-center gap-12">
          <Link href={view.logoHref} aria-label="Shelfie home" className="press-text -mx-1 inline-flex min-h-tap items-center rounded-sm px-1">
            <Logo size="sm" className="md:h-7 xl:h-9" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            {SECTIONS.map((section) => (
              <Link key={section.href} href={section.href} className={`${LINK} text-lg`}>
                {section.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1 md:gap-3">
          {dashboardHref && (
            <Link href={dashboardHref} className={`${LINK} px-2 max-md:hidden`}>
              Dashboard
            </Link>
          )}
          {view.kind === 'account' ? (
            <AccountMenu email={view.email} placement="down" />
          ) : (
            <>
              <Link href="/login" className={`${LINK} px-2 max-[22rem]:hidden md:px-3 md:text-lg`}>
                Log in
              </Link>
              <ButtonLink href="/signup" variant="brand" className="max-md:px-4 max-md:text-sm xl:min-h-13 xl:px-7 xl:text-lg">
                Add your shop
              </ButtonLink>
            </>
          )}
          <IconButton
            ref={toggleRef}
            icon={open ? X : Menu}
            iconSize="lg"
            label="Menu"
            aria-expanded={open}
            aria-controls="band-menu"
            className="-mr-2 text-ink hover:bg-blush-band md:hidden"
            onClick={() => setOpen((value) => !value)}
          />
        </div>
      </div>

      <nav
        id="band-menu"
        aria-label="Menu"
        hidden={!open}
        className="absolute inset-x-0 top-full animate-fade-in border-b border-blush-ring bg-blush-bar px-band-gutter pb-3 shadow-md md:hidden"
      >
        <ul>
          {[...SECTIONS, { label: 'Help', href: '/help' }, ...(dashboardHref ? [{ label: 'Dashboard', href: dashboardHref }] : [])].map((link) => (
            <li key={link.label} className="border-t border-blush-ring first:border-t-0">
              <Link href={link.href} className={`${LINK} w-full text-lg`} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            </li>
          ))}
          {view.kind === 'public' && (
            <li className="border-t border-blush-ring min-[22rem]:hidden">
              <Link href="/login" className={`${LINK} w-full text-lg`} onClick={() => setOpen(false)}>
                Log in
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
