'use client';

import { Search, X } from 'lucide-react';
import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react';
import { controlClasses } from '@/components/ui/input';
import { browseChips, matchesBrowse, type BrowseEntry, type BrowseFilter } from '@/lib/browse';
import { cn } from '@/lib/utils';

export interface BrowseCard extends BrowseEntry {
  slug: string;
  /** The card, drawn on the server. */
  card: ReactNode;
}

/** Writes the search and chip into the address (replaceState: no history entry per keystroke), so a link keeps them. */
function syncUrl(query: string, filter: BrowseFilter) {
  const url = new URL(window.location.href);
  if (query.trim()) url.searchParams.set('q', query.trim());
  else url.searchParams.delete('q');
  if (filter !== 'all') url.searchParams.set('category', filter);
  else url.searchParams.delete('category');
  window.history.replaceState(window.history.state, '', url);
}

const CHIP =
  'press-text inline-flex min-h-tap items-center rounded-full border px-4 text-[0.9375rem] font-semibold transition-colors ' +
  'border-blush-ring bg-surface text-ink hover:bg-blush-band aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-surface';

/** The search field, the category chips and the grid; filtering happens here, on the cards the server drew. */
export function BrowseShops({ cards, initialQuery, initialFilter }: { cards: BrowseCard[]; initialQuery: string; initialFilter: BrowseFilter }) {
  const chips = useMemo(() => browseChips(cards), [cards]);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<BrowseFilter>(chips.some((c) => c.id === initialFilter) ? initialFilter : 'all');
  const deferred = useDeferredValue(query);
  const shown = cards.filter((c) => matchesBrowse(c, deferred, filter));
  const searchId = useId();

  const update = (q: string, f: BrowseFilter) => {
    setQuery(q);
    setFilter(f);
    syncUrl(q, f);
  };
  const filtered = query.trim() !== '' || filter !== 'all';
  const chipLabel = chips.find((c) => c.id === filter)?.label;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <search className="relative w-full lg:max-w-md">
          <label htmlFor={searchId} className="sr-only">
            Search shops
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => update(e.target.value, filter)}
            placeholder="Search shops or what they sell"
            autoComplete="off"
            enterKeyHint="search"
            className={cn(controlClasses, 'min-h-12 rounded-full border-blush-ring bg-surface pr-12 pl-12 shadow-xs [&::-webkit-search-cancel-button]:hidden')}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => update('', filter)}
              className="press-icon absolute top-1/2 right-1 inline-flex size-tap -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-blush-band hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          )}
        </search>
        {chips.length > 1 && (
          <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button key={chip.id} type="button" aria-pressed={filter === chip.id} onClick={() => update(query, chip.id)} className={cn(CHIP, 'shrink-0')}>
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <p role="status" className="sr-only">
        {filtered ? `${shown.length} of ${cards.length} shops shown` : ''}
      </p>

      {shown.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {shown.map((c) => (
            <li key={c.slug}>{c.card}</li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-blush-ring bg-blush px-6 py-14 text-center">
          <p className="text-xl font-bold text-ink">
            {query.trim() ? <>No shops match “{query.trim()}”{filter !== 'all' && <> in {chipLabel}</>}.</> : <>No {chipLabel} shops yet.</>}
          </p>
          <p className="type-body text-ink-soft">Try a shop’s name or something it sells, like bread or tacos.</p>
          <button
            type="button"
            onClick={() => update('', 'all')}
            className="press-text mt-3 inline-flex min-h-tap items-center rounded-full bg-ink px-5 font-semibold text-surface hover:bg-ink/85"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
