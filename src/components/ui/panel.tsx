import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/*
 * The one row system for working screens: a Panel (heading, count, right-aligned value) above a PanelList of `li` rows.
 * The list is a size container: a row's two parts share a line once the list is @xl (36rem) wide, and the action drops
 * under the text when it is narrower. The list's width is what matters, not the viewport's, so the sidebar's or a second
 * column's space is already taken into account.
 */

/** A row's box. Rows with their own layout (an order row) use it directly; anything else uses PanelRow. */
export const PANEL_ROW = 'min-h-(--row-min-h) px-(--row-pad-x) py-(--row-pad-y)';

/** A Panel's title row: heading on the left, value on the right, on one line. Also usable on a `summary`. */
export const PANEL_HEAD = 'flex items-center justify-between gap-4';

export function PanelTitle({ id, heading, count, after }: { id?: string; heading: ReactNode; count?: number; after?: ReactNode }) {
  return (
    <h2 id={id} className="type-section flex min-w-0 items-center gap-2">
      <span className="min-w-0 [overflow-wrap:anywhere]">{heading}</span>
      {count !== undefined && <span className="type-figures font-semibold text-ink-muted">{count}</span>}
      {after}
    </h2>
  );
}

export function PanelValue({ as: Tag = 'p', children }: { as?: 'p' | 'span'; children: ReactNode }) {
  return <Tag className="ml-auto flex shrink-0 items-baseline gap-2 whitespace-nowrap">{children}</Tag>;
}

export interface PanelProps extends Omit<ComponentPropsWithoutRef<'section'>, 'children'> {
  heading: ReactNode;
  count?: number;
  value?: ReactNode;
  children: ReactNode;
}

export function Panel({ heading, count, value, children, className, ...rest }: PanelProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3', className)} {...rest}>
      <div className={PANEL_HEAD}>
        <PanelTitle id={id} heading={heading} count={count} />
        {value !== undefined && value !== null && <PanelValue>{value}</PanelValue>}
      </div>
      {children}
    </section>
  );
}

export function PanelList({ className, ...rest }: ComponentPropsWithoutRef<'ul'>) {
  return (
    <ul
      data-slot="panel-list"
      className={cn('@container divide-y divide-line overflow-hidden rounded-(--card-radius) bg-(--card-bg) shadow-(--card-shadow)', className)}
      {...rest}
    />
  );
}

export interface PanelRowProps extends Omit<ComponentPropsWithoutRef<'li'>, 'children'> {
  children: ReactNode;
  /** Beside the text from @xl, under it when the list is narrower. */
  action?: ReactNode;
}

export function PanelRow({ children, action, className, ...rest }: PanelRowProps) {
  return (
    <li className={cn('grid grid-cols-1 gap-x-4 gap-y-3 @xl:grid-cols-[minmax(0,1fr)_auto] @xl:items-center', PANEL_ROW, className)} {...rest}>
      <div className="min-w-0">{children}</div>
      {action != null && <div className="min-w-0 @xl:justify-self-end">{action}</div>}
    </li>
  );
}

export interface LinkRowProps extends Omit<ComponentPropsWithoutRef<typeof Link>, 'title' | 'children'> {
  title: ReactNode;
  detail?: ReactNode;
  /** A picture or avatar before the text. */
  leading?: ReactNode;
  /** A short value before the chevron. */
  value?: ReactNode;
}

/** A whole row that goes somewhere. */
export function LinkRow({ title, detail, leading, value, className, ...rest }: LinkRowProps) {
  return (
    <li>
      <Link
        className={cn(
          'press-surface flex items-center gap-4 no-underline hover:bg-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          PANEL_ROW,
          className,
        )}
        {...rest}
      >
        {leading}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold [overflow-wrap:anywhere]">{title}</span>
          {detail && <span className="text-sm text-ink-muted [overflow-wrap:anywhere]">{detail}</span>}
        </span>
        {value && <span className="shrink-0 type-figures text-sm text-ink-soft">{value}</span>}
        <Icon icon={ChevronRight} size="sm" className="shrink-0 text-ink-muted" />
      </Link>
    </li>
  );
}
