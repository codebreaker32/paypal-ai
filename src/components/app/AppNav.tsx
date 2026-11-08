'use client';

import { BookOpenText, ClipboardList, Settings, Share2, type LucideIcon } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { activeSection, sectionHref, sectionLabel, type ShellSection } from '@/lib/seller/shell-view';
import { SectionLink } from './SectionLink';

const LINKS: { section: ShellSection; icon: LucideIcon }[] = [
  { section: 'orders', icon: ClipboardList },
  { section: 'menu', icon: BookOpenText },
  { section: 'share', icon: Share2 },
  { section: 'settings', icon: Settings },
];

function Count({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 type-figures type-meta font-bold text-on-accent', className)}>
      {n}
      <span className="sr-only"> to prepare</span>
    </span>
  );
}

/** The four sections: a list in the sidebar, four equal columns in the phone's tab bar. */
export function AppNav({ shopId, toPrepare, variant }: { shopId: string; toPrepare: number; variant: 'sidebar' | 'bar' }) {
  const pathname = usePathname();
  const active = activeSection(shopId, pathname, useSearchParams().get('tab'));
  const bar = variant === 'bar';

  return (
    <nav aria-label="Shop sections">
      <ul className={bar ? 'grid h-[calc(var(--app-tabbar-h)-1px)] grid-cols-4 gap-1 p-1' : 'flex flex-col gap-0.5'}>
        {LINKS.map(({ section, icon }) => {
          const current = section === active;
          const count = section === 'orders' && toPrepare > 0 ? toPrepare : null;
          return (
            <li key={section}>
              <SectionLink
                href={sectionHref(shopId, section)}
                shopId={shopId}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-tap rounded-md text-ink-soft',
                  bar ? 'h-full flex-col items-center justify-center gap-0.5 text-xs' : 'items-center gap-3 px-3 text-sm',
                  current ? 'bg-surface-sunken font-semibold text-ink' : 'font-medium hover:bg-surface-sunken hover:text-ink',
                )}
              >
                <span className="relative inline-flex">
                  <Icon icon={icon} className={current ? 'text-accent' : undefined} />
                  {bar && count !== null && <Count n={count} className="absolute -top-1.5 left-3.5" />}
                </span>
                <span className={bar ? undefined : 'flex-1'}>{sectionLabel(section)}</span>
                {!bar && count !== null && <Count n={count} />}
              </SectionLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
