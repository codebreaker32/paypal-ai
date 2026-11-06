import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import { itemCategory } from '@/lib/domain/category';
import type { ItemWithVariants, ShopKind } from '@/lib/domain/types';
import { ItemPhoto } from './ItemPhoto';
import { SectionTabs } from './SectionTabs';

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

/** A readable id that is unique on the page: the slug alone is lossy ("Coffee & Tea", "Coffee/Tea"), so the index goes on. */
export const sectionId = (name: string, i: number) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug ? `section-${slug}-${i}` : `section-${i}`;
};

function Prices({ item }: { item: ItemWithVariants }) {
  const priced = item.variants.filter((v) => v.priceCents !== null && v.priceCents > 0);
  if (item.status === 'in_person' || !priced.length) return null;
  return (
    <ul className={cx('type-price flex flex-wrap gap-x-3 gap-y-0.5 text-[0.9375rem] font-semibold', item.soldOut ? 'text-ink-muted' : 'text-ink')}>
      {priced.map((v) => (
        <li key={v.id} className="whitespace-nowrap">
          {v.label && <span className="mr-1 font-medium text-ink-muted">{v.label}</span>}
          {formatUSD(v.priceCents!)}
        </li>
      ))}
    </ul>
  );
}

function MenuItem({ item, tone, kind }: { item: ItemWithVariants; tone: number; kind: ShopKind }) {
  const unavailable = item.soldOut && item.status !== 'in_person';
  return (
    <li
      data-menu-item={item.name}
      className="flex min-h-32 items-stretch gap-4 py-4 sm:rounded-(--card-radius) sm:bg-(--card-bg) sm:py-0 sm:pl-4 sm:shadow-(--card-shadow) sm:overflow-hidden"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:py-3.5">
        <h4 className={cx('font-bold leading-6 [overflow-wrap:anywhere]', unavailable && 'text-ink-muted')}>{item.name}</h4>
        {/* The price sits right under the name, where the eye lands next; the description follows, clamped. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Prices item={item} />
          {item.status === 'in_person' ? (
            <span className="type-meta font-semibold text-ink-soft">Ask in person</span>
          ) : (
            item.soldOut && <span className="type-meta font-bold text-ink">Sold out today</span>
          )}
        </div>
        {item.description && <p className="mt-1 line-clamp-2 text-sm text-ink-muted [overflow-wrap:anywhere]">{item.description}</p>}
      </div>
      <ItemPhoto
        name={item.name}
        photoUrl={item.photoUrl}
        category={itemCategory(item, kind)}
        tone={tone}
        dim={unavailable}
        className="size-28 shrink-0 self-center rounded-(--thumb-radius) sm:size-32 sm:self-stretch sm:rounded-none lg:size-34"
      />
    </li>
  );
}

/** The shop's menu as people order from it: sticky section tabs, then each section's items as photo cards. */
export function Menu({ sections, kind }: { sections: MenuSection[]; kind: ShopKind }) {
  const ids = sections.map((s, i) => ({ id: sectionId(s.name, i), name: s.name }));
  return (
    <section aria-labelledby="menu-title" className="flex flex-col gap-6">
      <h2 id="menu-title" className="sr-only">
        Menu
      </h2>
      <SectionTabs sections={ids} />
      {sections.length === 0 ? (
        <p className="text-ink-soft">Nothing on the menu yet.</p>
      ) : (
        sections.map((section, i) => (
          <div
            key={section.name}
            id={ids[i].id}
            className="flex scroll-mt-[calc(var(--shop-tabs-h)+1rem)] scroll-mb-[calc(var(--shop-bar-h)+1rem)] flex-col gap-1 sm:gap-4"
          >
            <h3 className="type-title">{section.name}</h3>
            <ul className="flex flex-col divide-y divide-line sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0">
              {section.items.map((item) => (
                <MenuItem key={item.id} item={item} tone={i} kind={kind} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
