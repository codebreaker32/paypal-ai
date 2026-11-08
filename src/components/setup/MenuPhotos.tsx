'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { Expand } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { cx } from '@/components/ui/cx';

export const photoUrl = (shopId: string, page: number, version = 0) =>
  `/api/shops/${shopId}/photo/${page}${version ? `?v=${version}` : ''}`;

/** One page of the seller's menu photo, as a plain rounded photo on a grey well. */
export function MenuPhoto({
  shopId,
  page,
  version,
  className,
  sizes = '(min-width: 1024px) 30vw, 100vw',
  priority,
  src,
  children,
}: {
  shopId: string;
  page: number;
  version?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** A local preview (a photo still uploading) instead of the stored page. */
  src?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx('relative overflow-hidden rounded-(--photo-radius) bg-surface-sunken', className)}>
      <Image
        src={src ?? photoUrl(shopId, page, version)}
        alt={`Your menu photo, page ${page}`}
        fill
        unoptimized
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        className="object-contain"
      />
      {children}
    </div>
  );
}

/** Thumbnails of every page; tapping one opens it full size to compare with the review. */
export function PhotoStrip({ shopId, count, version, className }: { shopId: string; count: number; version?: number; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (count === 0) return null;
  return (
    <>
      <ul aria-label="Your menu photos" className={cx('flex flex-wrap gap-3', className)}>
        {Array.from({ length: count }, (_, i) => i + 1).map((page) => (
          <li key={page}>
            <button
              type="button"
              onClick={() => setOpen(page)}
              aria-label={`See page ${page} of your menu photo full size`}
              className="press group relative block h-24 w-18 overflow-hidden rounded-(--thumb-radius) bg-surface-sunken"
            >
              <Image src={photoUrl(shopId, page, version)} alt="" fill unoptimized sizes="72px" className="object-cover" />
              <span className="absolute right-1 bottom-1 inline-flex size-6 items-center justify-center rounded-full bg-surface-raised/90 text-ink shadow-xs">
                <Icon icon={Expand} size="sm" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={count > 1 ? `Your menu, page ${open}` : 'Your menu photo'}>
        {open !== null && <MenuPhoto shopId={shopId} page={open} version={version} className="aspect-[4/5] w-full shadow-none" sizes="32rem" />}
      </Sheet>
    </>
  );
}
