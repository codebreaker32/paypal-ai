'use client';

import type { ItemPicture } from '@/lib/domain/category';
import { listedItems } from '@/lib/domain/listed';
import Link from 'next/link';
import { useState } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { TextLink } from '@/components/ui/text-link';
import { cx } from '@/components/ui/cx';
import { CoverPicker, ExampleCaption, ItemPhotoPicker, PhotoError } from '@/components/setup/PhotoPicker';
import { itemPictures, pictureOf, pictureSource } from '@/lib/library/picture';
import { formatUSD } from '@/lib/domain/money';
import type { ItemWithVariants, ShopKind } from '@/lib/domain/types';
import { setSoldOut } from './api';
import { CounterSnap } from './menu/CounterSnap';
import { Switch } from './Switch';

function priceText(item: ItemWithVariants): string {
  const priced = item.variants.filter((v) => v.priceCents !== null);
  if (priced.length === 0) return 'Price in person';
  return priced.map((v) => (v.label ? `${v.label} ${formatUSD(v.priceCents!)}` : formatUSD(v.priceCents!))).join(' · ');
}

function bySection(items: ItemWithVariants[]): [string, ItemWithVariants[]][] {
  const out = new Map<string, ItemWithVariants[]>();
  for (const i of items) {
    const key = i.section?.trim() || 'Menu';
    out.set(key, [...(out.get(key) ?? []), i]);
  }
  return [...out.entries()];
}

/** A dot and a word, as the order list shows status. */
function StatusText({ tone, children }: { tone: 'warn' | 'muted'; children: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-sm font-semibold', tone === 'warn' ? 'text-warn' : 'text-ink-muted')}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

function MenuRow({
  item,
  tone,
  shopId,
  busy,
  error,
  onToggle,
  onPhoto,
  picture,
}: {
  item: ItemWithVariants;
  /** What its thumbnail shows (`itemPictures`: own photo, else a library example, else the drawing). */
  picture: ItemPicture;
  tone: number;
  shopId: string;
  busy: boolean;
  error?: string;
  onToggle: (next: boolean) => void;
  onPhoto: (url: string | null) => void;
}) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const soldOut = item.status === 'live' && item.soldOut;
  return (
    <li className="flex flex-col gap-1.5 py-3" data-item={item.name}>
      <div className="flex items-center gap-3 sm:gap-4">
        <ItemPhotoPicker
          shopId={shopId}
          itemId={item.id}
          name={item.name}
          {...picture}
          tone={tone}
          size="sm"
          onChange={onPhoto}
          onError={setPhotoError}
          className={cx(soldOut && pictureSource(picture) !== 'drawing' && 'opacity-60 grayscale')}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={cx('font-semibold leading-6 [overflow-wrap:anywhere]', soldOut && 'text-ink-muted')}>{item.name}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {item.status === 'live' && <span className="type-price text-sm text-ink-soft">{priceText(item)}</span>}
            {item.status === 'in_person' && <StatusText tone="muted">Ask in person</StatusText>}
            {soldOut && <StatusText tone="warn">Sold out today</StatusText>}
          </span>
          <ExampleCaption show={pictureSource(picture) === 'example'} />
        </div>
        {item.status === 'live' && (
          <Switch
            label={
              <>
                <span className="sr-only">{item.name}: Sold out today</span>
                <span aria-hidden="true">Sold out</span>
              </>
            }
            checked={item.soldOut}
            busy={busy}
            failed={!!error}
            onChange={onToggle}
            inline
          />
        )}
      </div>
      <PhotoError error={photoError} />
      {error && <FieldError>{error}</FieldError>}
    </li>
  );
}

export function MenuPanel({
  items,
  shopId,
  shopKind,
  slug,
  shopName,
  coverUrl,
  onItemsChange,
  onCoverChange,
}: {
  items: ItemWithVariants[];
  shopId: string;
  /** Decides an item's drawing while it has no photo, as on the public menu (`itemCategory(item, shopKind)`). */
  shopKind: ShopKind;
  slug: string;
  /** For the cover's alt text. */
  shopName?: string;
  /** The shop's cover, kept by the dashboard (like the items) so it survives switching tabs. */
  coverUrl: string | null;
  onItemsChange: (update: (items: ItemWithVariants[]) => ItemWithVariants[]) => void;
  onCoverChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const listed = listedItems(items);
  const photos = listed.filter((i) => i.photoUrl).length;
  const pictures = itemPictures(listed, shopKind);

  const setItem = (id: string, patch: Partial<ItemWithVariants>) =>
    onItemsChange((all) => all.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const toggle = async (item: ItemWithVariants, next: boolean) => {
    setBusy((b) => new Set(b).add(item.id));
    setErrors((all) => {
      const rest = { ...all };
      delete rest[item.id];
      return rest;
    });
    setItem(item.id, { soldOut: next }); // optimistic
    try {
      const { items: saved } = await setSoldOut(shopId, item.id, next);
      const byId = new Map(saved.map((i) => [i.id, i]));
      onItemsChange((all) => all.map((i) => byId.get(i.id) ?? i));
    } catch (e) {
      setItem(item.id, { soldOut: !next });
      setErrors((all) => ({ ...all, [item.id]: e instanceof Error ? e.message : "Couldn’t save. Try again." }));
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(item.id);
        return n;
      });
    }
  };

  if (listed.length === 0) {
    return (
      <div className="flex max-w-measure flex-col items-start gap-3 rounded-(--card-radius) bg-surface-sunken p-6">
        <h2 className="type-heading">Nothing on your menu yet</h2>
        <p className="text-ink-soft">Publish items from setup and they show up here.</p>
        <Link href={`/shops/${shopId}/setup`} className={buttonClasses({ variant: 'primary' })}>
          Go to setup
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:gap-x-14">
      <div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <div className="flex flex-col gap-1">
            <h2 className="type-title">Menu</h2>
            <p className="type-figures text-ink-soft">
              {listed.length} {listed.length === 1 ? 'item' : 'items'} · {photos} with photos
            </p>
          </div>
          <TextLink href={`/s/${slug}`}>See it on your shop</TextLink>
        </div>
        {bySection(listed).map(([section, sectionItems], n) => (
          <section key={section} aria-label={section} className="flex flex-col gap-1">
            <h3 className="type-heading">{section}</h3>
            <ul className="flex flex-col divide-y divide-line">
              {sectionItems.map((item) => (
                <MenuRow
                  key={item.id}
                  item={item}
                  tone={n}
                  shopId={shopId}
                  busy={busy.has(item.id)}
                  error={errors[item.id]}
                  onToggle={(next) => void toggle(item, next)}
                  onPhoto={(photoUrl) => setItem(item.id, { photoUrl })}
                  picture={pictures.get(item.id) ?? pictureOf(item, shopKind, null)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Phones: the counter action first, the cover after the list. Desktop: both in the right-hand column. */}
      <section
        aria-labelledby="counter-title"
        className="order-first flex flex-col items-start gap-3 rounded-(--card-radius) bg-surface-sunken p-5 lg:order-none lg:col-start-2 lg:row-start-1"
      >
        <h2 id="counter-title" className="type-heading">
          Photos in one go
        </h2>
        <p className="text-ink-soft">One photo of your display case: Claude crops a photo of each item it finds.</p>
        <CounterSnap
          shopId={shopId}
          hasPhoto={(id) => Boolean(items.find((i) => i.id === id)?.photoUrl)}
          onPhoto={(itemId, photoUrl) => setItem(itemId, { photoUrl })}
        />
      </section>
      <section aria-labelledby="cover-title" className="flex flex-col gap-3 lg:col-start-2 lg:row-start-2 lg:self-start">
        <h2 id="cover-title" className="type-heading">
          Cover photo
        </h2>
        <CoverPicker shopId={shopId} shopName={shopName ?? 'Your shop'} coverUrl={coverUrl} onChange={onCoverChange} />
      </section>
    </div>
  );
}
