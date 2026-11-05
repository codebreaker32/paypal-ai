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
    <ul className={cx('type-price flex shrink-0 flex-col items-end text-right', item.soldOut ? 'text-ink-muted' : 'text-ink')}>
      {priced.map((v) => (
        <li key={v.id} className="whitespace-nowrap">
          {v.label && <span className="mr-1.5 text-sm text-ink-muted">{v.label}</span>}
          <span className="font-semibold">{formatUSD(v.priceCents!)}</span>
        </li>
      ))}
    </ul>
  );
}

function MenuItem({ item }: { item: ItemWithVariants }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-1">
        <span className={cx('font-semibold [overflow-wrap:anywhere]', item.soldOut && 'text-ink-muted')}>{item.name}</span>
        {item.description && <span className="text-sm text-ink-muted [overflow-wrap:anywhere]">{item.description}</span>}
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
      </div>
      <Prices item={item} />
    </li>
  );
}

/** The shop's menu as people read it: sections, items, prices per option, sold-out and in-person markers. */
export function Menu({ sections }: { sections: MenuSection[] }) {
  return (
    <section aria-labelledby="menu-title" className="flex flex-col gap-6">
      <h2 id="menu-title" className="type-title">
        Menu
      </h2>
      {sections.length === 0 ? (
        <p className="text-ink-soft">Nothing on the menu yet.</p>
      ) : (
        sections.map((section) => (
          <div key={section.name} className="flex flex-col">
            <h3 className="type-heading border-b border-line-strong pb-2">{section.name}</h3>
            <ul className="flex flex-col divide-y divide-line">
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
