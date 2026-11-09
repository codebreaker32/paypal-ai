'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '@/components/ui/cx';
import { isWidePath } from '@/lib/brand/frame';

/** The header's and footer's inner container, as wide as the page below it so the logo lines up with the content. */
export function Frame({ className, children }: { className?: string; children: ReactNode }) {
  const wide = isWidePath(usePathname() ?? '');
  return (
    <div data-page-frame="" className={cx('mx-auto w-full px-gutter', wide ? 'max-w-wide' : 'max-w-page', className)}>
      {children}
    </div>
  );
}
