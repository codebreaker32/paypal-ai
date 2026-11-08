import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** An underlined text link: the underline darkens on hover, the text fades when pressed, 44 px tall. */
export function TextLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      data-slot="text-link"
      className={cn(
        'press-text inline-flex min-h-tap items-center gap-1.5 font-semibold underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink',
        className,
      )}
      {...rest}
    />
  );
}
