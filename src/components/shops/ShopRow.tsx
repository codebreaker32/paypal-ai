import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ShopStatusBadge } from '@/components/dashboard/shop-status';
import { ShopAvatar } from '@/components/shop/ShopAvatar';
import { Icon } from '@/components/ui/icon';
import type { ShopRowData } from '@/lib/seller/shop-rows';

/** One shop on `/shops`. Under @xl the count sits below the status; from @xl it has its own column before the chevron. */
export function ShopRow({ row }: { row: ShopRowData }) {
  return (
    <li>
      <Link
        href={row.href}
        data-testid="shop-row"
        className="press-surface grid min-h-22 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-(--row-pad-x) py-3 no-underline hover:bg-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus @xl:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
      >
        <ShopAvatar {...row.avatar} size="md" className="row-span-3 @xl:row-span-2" />
        <span title={row.name} className="col-start-2 row-start-1 truncate type-heading">
          {row.name}
        </span>
        <ShopStatusBadge tone={row.status.tone} word={row.status.word} className="col-start-2 row-start-2" />
        {row.toPrepare > 0 && (
          <span className="col-start-2 row-start-3 mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold @xl:col-start-3 @xl:row-span-2 @xl:row-start-1 @xl:mt-0">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 type-figures type-meta font-bold text-on-accent">{row.toPrepare}</span>
            to prepare
          </span>
        )}
        <Icon icon={ChevronRight} size="sm" className="col-start-3 row-span-3 row-start-1 text-ink-muted @xl:col-start-4 @xl:row-span-2" />
      </Link>
    </li>
  );
}
