import type { ComponentProps, ElementType, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export type CardTone = 'raised' | 'sunken' | 'flat';
export type CardPadding = 'none' | 'md' | 'lg';

// shadcn's card pattern (cva + data-slot): white and lifted, or a grey well.
export const cardVariants = cva('rounded-(--card-radius)', {
  variants: {
    tone: {
      raised: 'bg-(--card-bg) shadow-(--card-shadow)',
      sunken: 'bg-surface-sunken',
      flat: 'bg-surface-sunken',
    } satisfies Record<CardTone, string>,
    padding: {
      none: '',
      md: 'p-(--card-pad)',
      lg: 'p-(--card-pad) sm:p-(--card-pad-lg)',
    } satisfies Record<CardPadding, string>,
  },
  defaultVariants: { tone: 'raised', padding: 'md' },
});

export interface CardProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Render as a landmark or list item when it is one: section, article, li. */
  as?: ElementType;
  tone?: CardTone;
  padding?: CardPadding;
  children: ReactNode;
}

/** A white surface lifted by a soft shadow (raised) or a grey well (flat, sunken). Don't nest cards; group with spacing or a divider instead. */
export function Card({ as: Tag = 'div', tone = 'raised', padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <Tag data-slot="card" className={cn(cardVariants({ tone, padding }), className)} {...rest}>
      {children}
    </Tag>
  );
}
