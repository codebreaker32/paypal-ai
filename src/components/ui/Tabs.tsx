'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabItem {
  id: string;
  label: string;
  /** Optional count shown after the label, e.g. orders waiting. */
  count?: number;
  content: ReactNode;
}

export interface TabsProps {
  /** Names the tab list for screen readers, e.g. "Shop sections". */
  label: string;
  items: TabItem[];
  /** Controlled value. Leave unset and use defaultValue for local state. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  className?: string;
}

/** WAI-ARIA tabs: arrow keys move between tabs, Home and End jump, Tab moves into the panel. */
export function Tabs({ label, items, value, defaultValue, onValueChange, className }: TabsProps) {
  const [local, setLocal] = useState(defaultValue ?? items[0]?.id);
  const active = value ?? local;
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (id: string) => {
    if (value === undefined) setLocal(id);
    onValueChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    select(items[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
        {items.map((item, i) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cx(
                'relative inline-flex min-h-(--tabs-h) items-center gap-2 px-3 font-semibold whitespace-nowrap',
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.75 after:transition-colors',
                selected ? 'text-ink after:bg-(--tabs-indicator)' : 'text-ink-muted hover:text-ink after:bg-transparent',
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="type-price rounded-xs border border-line-strong bg-surface-raised px-1.5 text-sm text-ink-soft">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {items.map((item) =>
        item.id === active ? (
          <div
            key={item.id}
            role="tabpanel"
            id={`${baseId}-panel-${item.id}`}
            aria-labelledby={`${baseId}-tab-${item.id}`}
            tabIndex={0}
            className="pt-5 focus-visible:outline-offset-4"
          >
            {item.content}
          </div>
        ) : null,
      )}
    </div>
  );
}
