'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Ban, Hand } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { FieldError } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { formatUSD } from '@/lib/domain/money';
import type { ItemWithVariants } from '@/lib/domain/types';
import { setSoldOut } from './api';
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

export function MenuPanel({
  items,
  shopId,
  slug,
  onItemsChange,
}: {
  items: ItemWithVariants[];
  shopId: string;
  slug: string;
  onItemsChange: (update: (items: ItemWithVariants[]) => ItemWithVariants[]) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const listed = items.filter((i) => i.status === 'live' || i.status === 'in_person');

  const setItem = (id: string, soldOut: boolean) =>
    onItemsChange((all) => all.map((i) => (i.id === id ? { ...i, soldOut } : i)));

  const toggle = async (item: ItemWithVariants, next: boolean) => {
    setBusy((b) => new Set(b).add(item.id));
    setErrors((all) => {
      const rest = { ...all };
      delete rest[item.id];
      return rest;
    });
    setItem(item.id, next); // optimistic
    try {
      const { items: saved } = await setSoldOut(shopId, item.id, next);
      const byId = new Map(saved.map((i) => [i.id, i]));
      onItemsChange((all) => all.map((i) => byId.get(i.id) ?? i));
      toast({ title: next ? `${item.name}: sold out today` : `${item.name} is back on`, tone: 'ok', durationMs: 3000 });
    } catch (e) {
      setItem(item.id, !next);
      setErrors((all) => ({ ...all, [item.id]: e instanceof Error ? e.message : "Couldn't save. Try again." }));
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
      <Card tone="flat" padding="lg" className="flex flex-col gap-2">
        <h2 className="type-heading">Nothing on your menu yet</h2>
        <p className="text-ink-soft">
          Publish items from{' '}
          <Link href={`/shops/${shopId}/setup`} className="font-semibold text-accent-ink underline">
            your setup page
          </Link>{' '}
          and they will show up here.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-measure text-ink-soft">
        Ran out of something? Mark it sold out for today. It stays on{' '}
        <Link href={`/s/${slug}`} className="font-semibold text-accent-ink underline">
          your shop
        </Link>
        , but assistants can&apos;t order it until you switch it back.
      </p>
      {bySection(listed).map(([section, sectionItems]) => (
        <section key={section} aria-label={section} className="flex flex-col">
          <h2 className="type-label border-b border-line pb-2 text-ink-muted">{section}</h2>
          <ul className="flex flex-col">
            {sectionItems.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 border-b border-line py-3" data-item={item.name}>
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-semibold">{item.name}</span>
                    <span className="type-meta type-price text-ink-muted">{priceText(item)}</span>
                    {item.status === 'in_person' && (
                      <Badge icon={Hand} className="self-start">
                        Ask in person
                      </Badge>
                    )}
                    {item.status === 'live' && item.soldOut && (
                      <Badge tone="warn" icon={Ban} className="self-start">
                        Sold out today
                      </Badge>
                    )}
                  </div>
                  {item.status === 'live' && (
                    <Switch
                      label={
                        <>
                          <span className="sr-only">{item.name}: </span>Sold out today
                        </>
                      }
                      checked={item.soldOut}
                      busy={busy.has(item.id)}
                      onChange={(next) => toggle(item, next)}
                      inline
                    />
                  )}
                </div>
                {errors[item.id] && <FieldError>{errors[item.id]}</FieldError>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
