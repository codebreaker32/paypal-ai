'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/components/ui/cx';

/** Sticky section links over the menu; the section in view carries the accent underline. */
export function SectionTabs({ sections }: { sections: { id: string; name: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  if (sections.length < 2) return null;
  return (
    <nav aria-label="Menu sections" className="sticky top-0 z-(--z-header) -mx-gutter border-b border-line bg-surface px-gutter lg:mx-0 lg:px-0">
      <ul className="no-scrollbar -mb-px flex gap-6 overflow-x-auto">
        {sections.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? 'true' : undefined}
              onClick={() => setActive(s.id)}
              className={cx(
                'inline-flex min-h-(--shop-tabs-h) items-center border-b-2 font-semibold whitespace-nowrap no-underline transition-colors',
                active === s.id ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {s.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
