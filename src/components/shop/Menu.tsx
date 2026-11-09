import { Pressable } from '@/components/motion/pressable';
import { Reveal } from '@/components/motion/reveal';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import type { ItemPicture } from '@/lib/domain/category';
import type { ItemWithVariants, ShopKind } from '@/lib/domain/types';
import { itemPictures, pictureOf, pictureSource } from '@/lib/library/picture';
import { AddControl } from './AddControl';
import { ExampleNote } from './ExampleNote';
import { ItemOpen } from './ItemOpen';
import { ItemPhoto } from './ItemPhoto';
import { SectionTabs } from './SectionTabs';
import { orderableOptions, tilePrice } from './tile';
import './menu-grid.css';

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
  const price = tilePrice(item);
  if (!price) return null;
  const tone = item.soldOut ? 'text-ink-muted' : 'text-ink';
  if (price.kind === 'from') {
    return (
      <p className={cx('type-price text-[0.9375rem] font-semibold', tone)}>
        From {formatUSD(price.cents)} <span className="font-medium text-ink-muted">· {price.count} options</span>
      </p>
    );
  }
  return (
    <ul className={cx('type-price flex flex-wrap gap-x-3 text-[0.9375rem] font-semibold', tone)}>
      {price.options.map((option) => (
        <li key={option.id} className="whitespace-nowrap">
          {option.label && <span className="mr-1 font-medium text-ink-muted">{option.label}</span>}
          {formatUSD(option.cents)}
        </li>
      ))}
    </ul>
  );
}

/** Up to four across on a wide page (`menu-grid.css`), two on a phone. */
const TILE_SIZES = '(min-width: 1024px) 280px, (min-width: 640px) 30vw, 50vw';

function MenuItem({ item, tone, picture, takesOrders }: { item: ItemWithVariants; tone: number; picture: ItemPicture; takesOrders: boolean }) {
  const soldOut = item.soldOut && item.status !== 'in_person';
  const options = orderableOptions(item, takesOrders);
  return (
    // No card: the tile is its photo and its words. Only the photo is rounded and only the photo answers a hover, inside
    // its own clip; the wrapper takes no z-index so the add control can sit over the tile's stretched button.
    <Pressable as="li" lift={false} data-menu-item={item.name} className="group/tile grid grid-cols-[minmax(0,1fr)] content-start gap-2 [--press-bg:transparent]">
      <div className="tile-photo relative aspect-[4/3] overflow-hidden rounded-(--photo-radius) bg-surface-sunken">
        <ItemPhoto
          name={item.name}
          {...picture}
          tone={tone}
          dim={soldOut}
          sizes={TILE_SIZES}
          className="size-full transition-[scale] duration-(--duration-base) ease-out motion-safe:group-hover/tile:scale-[1.03]"
        />
        {pictureSource(picture) === 'example' && <ExampleNote />}
        {soldOut && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-ink">Sold out today</span>}
        {options.length > 0 && <AddControl itemId={item.id} itemName={item.name} optionId={options.length === 1 ? options[0].id : null} />}
      </div>
      <div className="tile-text flex flex-col">
        <h4 className={cx('leading-6 font-bold', soldOut && 'text-ink-muted')}>
          <ItemOpen itemId={item.id}>{item.name}</ItemOpen>
        </h4>
        <div className="mt-0.5">
          {item.status === 'in_person' ? <p className="type-meta font-semibold text-ink-soft">Ask in person</p> : <Prices item={item} />}
        </div>
        {item.description && <p className="mt-1 line-clamp-2 text-sm/5 text-ink-muted [overflow-wrap:anywhere]">{item.description}</p>}
      </div>
    </Pressable>
  );
}

/** The shop's menu as people order from it: sticky section tabs, then each section's items as photo tiles. */
export function Menu({ sections, kind, takesOrders = true }: { sections: MenuSection[]; kind: ShopKind; takesOrders?: boolean }) {
  const ids = sections.map((s, i) => ({ id: sectionId(s.name, i), name: s.name }));
  // Example photos are matched across the whole menu, so two items avoid sharing one.
  const pictures = itemPictures(
    sections.flatMap((s) => s.items),
    kind,
  );
  const anyExample = [...pictures.values()].some((picture) => pictureSource(picture) === 'example');
  return (
    <section aria-labelledby="menu-title" className="flex flex-col gap-4">
      <h2 id="menu-title" className="sr-only">
        Menu
      </h2>
      <SectionTabs sections={ids} />
      {anyExample && <p className="type-meta text-ink-muted">Some photos are examples, not the shop’s own.</p>}
      {sections.length === 0 ? (
        <p className="text-ink-soft">Nothing on the menu yet.</p>
      ) : (
        <div className="flex flex-col gap-10 min-[56rem]:gap-14">
          {sections.map((section, i) => (
            <div
              key={section.name}
              id={ids[i].id}
              className="scroll-mt-[calc(var(--shop-tabs-h)+1rem)] scroll-mb-[calc(var(--shop-bar-h)+1rem)]"
            >
              {/* A section below the fold rises in once as it scrolls into view; the first screen paints as served. */}
              <Reveal className="flex flex-col gap-3 @[36rem]/shop:gap-4">
                <h3 className="type-title">{section.name}</h3>
                <ul className="menu-grid">
                  {section.items.map((item) => (
                    <MenuItem key={item.id} item={item} tone={i} picture={pictures.get(item.id) ?? pictureOf(item, kind, null)} takesOrders={takesOrders} />
                  ))}
                </ul>
              </Reveal>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
