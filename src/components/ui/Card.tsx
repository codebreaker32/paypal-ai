import type { ComponentProps, ElementType, ReactNode } from 'react';
import { cx } from './cx';

export type CardTone = 'raised' | 'sunken' | 'flat';
export type CardPadding = 'none' | 'md' | 'lg';

const TONE: Record<CardTone, string> = {
  raised: 'bg-(--card-bg) border border-(--card-border) shadow-(--card-shadow)',
  sunken: 'bg-surface-sunken',
  flat: 'bg-(--card-bg) border border-(--card-border)',
};

const PADDING: Record<CardPadding, string> = {
  none: '',
  md: 'p-(--card-pad)',
  lg: 'p-(--card-pad) sm:p-(--card-pad-lg)',
};

export interface CardProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Render as a landmark or list item when it is one: section, article, li. */
  as?: ElementType;
  tone?: CardTone;
  padding?: CardPadding;
  children: ReactNode;
}

/** A sheet of paper on the page. Don't nest cards; group with spacing or a divider instead. */
export function Card({ as: Tag = 'div', tone = 'raised', padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <Tag className={cx('rounded-(--card-radius)', TONE[tone], PADDING[padding], className)} {...rest}>
      {children}
    </Tag>
  );
}
