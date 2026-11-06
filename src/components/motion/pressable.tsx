import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PressableProps<T extends ElementType = 'div'> = {
  /** The element or component to render: 'li', 'article', Link ... Defaults to a div. */
  as?: T;
  /** Lift on hover (default). Turn it off for dense rows that should only answer a press. */
  lift?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

/*
 * Pure CSS, so it works in server components and before hydration. It moves with transform only: the hover shadow is a
 * pseudo-element whose opacity fades in. Hover applies only on devices that hover (Tailwind's `hover:`); under reduced
 * motion nothing moves and only the shadow answers. Don't put `overflow-hidden` on the Pressable itself (it would clip
 * that shadow): round or clip the photo inside instead.
 */
const BASE =
  'relative transition-transform duration-(--duration-fast) ease-out active:scale-[0.98] ' +
  'motion-reduce:active:scale-100';

const LIFT =
  'hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ' +
  'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-md after:opacity-0 ' +
  'after:transition-opacity after:duration-(--duration-fast) after:ease-out hover:after:opacity-100';

/** Hover lift (−2 px with shadow-md) and a 0.98 press for cards and rows. */
export function Pressable<T extends ElementType = 'div'>({ as, lift = true, className, children, ...rest }: PressableProps<T>) {
  const Tag: ElementType = as ?? 'div';
  return (
    <Tag data-slot="pressable" className={cn(BASE, lift && LIFT, className)} {...rest}>
      {children}
    </Tag>
  );
}
