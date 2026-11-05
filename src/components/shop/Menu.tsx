import { CircleSlash, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import type { ItemWithVariants } from '@/lib/domain/types';

export interface MenuSection {
  name: string;
  items: ItemWithVariants[];
}

/** Live and "ask in person" items grouped by section, in menu order. */
export function menuSections(items: ItemWithVariants[]): MenuSection[] {
  const sections = new Map<string, ItemWithVariants[]>();
  for (const item of items) {
    if (item.status !== 'live' && item.status !== 'in_person') continue;
    const name = item.section?.trim() || 'Menu';
    if (!sections.has(name)) sections.set(name, []);
    sections.get(name)!.push(item);
  }
  return [...sections].map(([name, list]) => ({ name, items: list }));
}

function Prices({ item }: { item: ItemWithVariants }) {
  const priced = item.variants.filter((v) => v.priceCents !== null && v.priceCents > 0);
  if (item.status === 'in_person' || !priced.length) return null;
  return (
    <ul className={cx('type-receipt flex shrink-0 flex-col items-end text-right text-base', item.soldOut ? 'text-ink-muted' : 'text-ink')}>
      {priced.map((v) => (
        <li key={v.id} className="whitespace-nowrap">
          {v.label && <span className="mr-1.5 text-sm text-ink-muted">{v.label}</span>}
          <span className="font-medium">{formatUSD(v.priceCents!)}</span>
        </li>
      ))}
    </ul>
  );
}

function MenuItem({ item }: { item: ItemWithVariants }) {
  const priced = item.status !== 'in_person' && item.variants.some((v) => v.priceCents !== null && v.priceCents > 0);
  return (
    <li className="flex flex-col gap-1 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className={cx('min-w-0 text-lg leading-6 font-semibold [overflow-wrap:anywhere]', item.soldOut && 'text-ink-muted')}>
          {item.name}
        </span>
        {/* Menu-board leader dots between the name and its price */}
        {priced && (
          <span aria-hidden="true" className="min-w-4 flex-1 -translate-y-1 border-b-2 border-dotted border-line-strong" />
        )}
        <Prices item={item} />
      </div>
      {item.description && <span className="text-sm text-ink-muted italic [overflow-wrap:anywhere]">{item.description}</span>}
      {item.status === 'in_person' ? (
        <Badge icon={MessageCircle} className="self-start">
          Ask in person
        </Badge>
      ) : (
        item.soldOut && (
          <Badge tone="warn" icon={CircleSlash} className="self-start">
            Sold out today
          </Badge>
        )
      )}
    </li>
  );
}

/** The shop's menu as people read it: sections, items, prices per option, sold-out and in-person markers. */
export function Menu({ sections }: { sections: MenuSection[] }) {
  return (
    <section aria-labelledby="menu-title" className="flex flex-col gap-8">
      <h2 id="menu-title" className="type-title border-b-2 border-ink pb-2">
        Menu
      </h2>
      {sections.length === 0 ? (
        <p className="text-ink-soft">Nothing on the menu yet.</p>
      ) : (
        sections.map((section) => (
          <div key={section.name} className="flex flex-col gap-1">
            <h3 className="type-kicker text-2xl leading-8">{section.name}</h3>
            <ul className="flex flex-col">
              {section.items.map((item) => (
                <MenuItem key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
