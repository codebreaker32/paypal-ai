import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The reading pages (Help, Terms, Privacy): one column at reading width, in line with the logo above it. */
export function DocPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-page px-gutter pt-12 pb-section lg:pt-16">
      <div className="max-w-measure">
        <h1 className="type-display">
          {title}
          {subtitle && <span className="mt-2 block type-body font-semibold tracking-normal text-ink-soft">{subtitle}</span>}
        </h1>
        {children}
      </div>
    </div>
  );
}

export function DocSection({ id, title, className, children }: { id?: string; title: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id && `${id}-title`} className={cn('mt-10 scroll-mt-6 first-of-type:mt-8', className)}>
      <h2 id={id && `${id}-title`} className="type-heading">
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3 type-body text-ink-soft">{children}</div>
    </section>
  );
}

/** A plain bulleted list inside a section. */
export function DocList({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5">{children}</ul>;
}

/** A link inside a sentence: it keeps the line's height, unlike the 44 px `TextLink` that stands on its own. */
export function DocLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return <Link className={cn('press-text font-semibold underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink', className)} {...rest} />;
}
