import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** shadcn's label: the field label role (14 px, 600). */
export function Label({ className, ...rest }: ComponentProps<'label'>) {
  return <label data-slot="label" className={cn('type-label text-ink', className)} {...rest} />;
}
