'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps, MouseEvent } from 'react';
import { routerFollowsPushState } from '@/lib/seller/shell-view';
import { cn } from '@/lib/utils';

/**
 * Opens another dashboard section without a server round trip: the URL changes through the patched history API, which
 * `useSearchParams` (and so `Dashboard`) follows. Back and Forward work the same way.
 */
export function switchSection(href: string): void {
  window.history.pushState(null, '', href);
  window.scrollTo(0, 0);
  // The dashboard's one H1 keeps its element as its text changes, so focus survives the section swap.
  document.querySelector<HTMLElement>('#app-content h1')?.focus({ preventScroll: true });
}

const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export interface SectionLinkProps extends Omit<ComponentProps<typeof Link>, 'href'> {
  href: string;
  shopId: string;
  /** How it answers a press: `press` (the nav) or `press-text` (a link in a line of text). */
  pressAs?: 'press' | 'press-text';
}

/** A `next/link` to a dashboard section. A plain click while already on the dashboard swaps the section in place. */
export function SectionLink({ href, shopId, onClick, pressAs = 'press', className, ...rest }: SectionLinkProps) {
  const pathname = usePathname();
  const onDashboard = pathname === `/shops/${shopId}`;
  return (
    <Link
      href={href}
      className={cn(pressAs === 'press-text' ? 'press-text' : 'press', className)}
      // On the dashboard the section is already here; from anywhere else it prefetches like any other link.
      prefetch={onDashboard ? false : undefined}
      onClick={(e) => {
        onClick?.(e);
        // Before the router has patched pushState, leave the click to next/link, which navigates the ordinary way.
        if (e.defaultPrevented || !onDashboard || !isPlainClick(e) || !routerFollowsPushState(window.history.pushState)) return;
        e.preventDefault();
        switchSection(href);
      }}
      {...rest}
    />
  );
}
