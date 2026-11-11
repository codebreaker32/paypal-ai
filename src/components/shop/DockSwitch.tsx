'use client';

import { useState, type KeyboardEvent } from 'react';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import './assistant-shell.css';

export type DockPanel = 'assistant' | 'order';

export interface DockSwitchProps {
  active: DockPanel;
  count: number;
  itemsCents: number;
  onSwitch: (panel: DockPanel) => void;
  /** Checkout is on its way to PayPal: the order stays on screen. */
  disabled?: boolean;
  /** The ids of the tabs and of the panel under them (`aria-controls` / `aria-labelledby`). */
  ids: { assistant: string; order: string; panel: string };
}

const TAB =
  'press-text relative flex min-h-tap min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-[0.9375rem] font-semibold outline-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-60';

/**
 * The two-way switch at the top of the assistant's box (the dock from 1024 px, the sheets below it): `Assistant` and
 * `Your order · 2  $9.00`. Tabs with roving focus and arrow keys; the count gives a short bump whenever it changes.
 */
export function DockSwitch({ active, count, itemsCents, onSwitch, disabled = false, ids }: DockSwitchProps) {
  // The count the page started with doesn't bump; every change after it does.
  const [firstCount] = useState(count);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next: DockPanel = e.key === 'Home' ? 'assistant' : e.key === 'End' ? 'order' : active === 'assistant' ? 'order' : 'assistant';
    document.getElementById(ids[next])?.focus();
    if (next !== active) onSwitch(next);
  };
  const tab = (panel: DockPanel) => ({
    id: ids[panel],
    type: 'button' as const,
    role: 'tab',
    'aria-selected': active === panel,
    'aria-controls': active === panel ? ids.panel : undefined,
    tabIndex: active === panel ? 0 : -1,
    disabled,
    onClick: () => {
      if (active !== panel) onSwitch(panel);
    },
  });
  const look = (panel: DockPanel) => (active === panel ? 'bg-surface text-ink shadow-xs' : 'text-ink-soft hover:text-ink');

  return (
    <div data-dock-switch="" className="shrink-0 px-4 pt-3 pb-2">
      <div role="tablist" aria-label="Assistant or your order" onKeyDown={onKeyDown} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-1 rounded-full bg-surface-sunken p-1">
        <button {...tab('assistant')} className={cx(TAB, look('assistant'))}>Assistant</button>
        <button {...tab('order')} className={cx(TAB, look('order'))} aria-label={count > 0 ? `Your order, ${count} ${count === 1 ? 'item' : 'items'}, ${formatUSD(itemsCents)}` : 'Your order, empty'}>
          <span className="truncate">Your order</span>
          {/* Keyed by the count: each change remounts it and plays the bump once (none under reduced motion). */}
          <span key={count} data-dock-count={count} aria-hidden="true" data-bump={count !== firstCount || undefined} className={cx('dock-count inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-sm font-bold type-figures', count > 0 ? 'bg-ink text-surface' : 'bg-line text-ink-soft')}>
            {count}
          </span>
          {count > 0 && (
            <span aria-hidden="true" className="shrink-0 font-medium text-ink-soft type-figures max-[24.375rem]:hidden">
              {formatUSD(itemsCents)}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
