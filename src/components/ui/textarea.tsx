import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { controlClasses } from './input';

/** shadcn's textarea with Shelfie's control styling; three rows unless told otherwise. */
export function Textarea({ className, rows = 3, ...rest }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" rows={rows} className={cn(controlClasses, 'py-2.5 leading-6', className)} {...rest} />;
}
