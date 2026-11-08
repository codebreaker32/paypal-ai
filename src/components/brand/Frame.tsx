'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '@/components/ui/cx';

/** The seller's operations screens (the dashboard and an order's detail) use the wide container; everything else the page one. */
const WIDE = /^\/shops\/[^/]+(\/orders\/[^/]+)?\/?$/;

/** The header's and footer's inner container, as wide as the page below it so the logo lines up with the content. */
export function Frame({ className, children }: { className?: string; children: ReactNode }) {
  const wide = WIDE.test(usePathname() ?? '');
  return (
    <div data-page-frame="" className={cx('mx-auto w-full px-gutter', wide ? 'max-w-wide' : 'max-w-page', className)}>
      {children}
    </div>
  );
}
