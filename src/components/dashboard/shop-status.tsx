import { cn } from '@/lib/utils';

const TONE = { ok: 'text-ok', warn: 'text-warn', neutral: 'text-ink-muted' } as const;

/** A shop's state: a dot and a word, the word from `shopStatusWord` or `shopRowStatus`. Never colour alone. */
export function ShopStatusBadge({ tone, word, className }: { tone: keyof typeof TONE; word: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 type-meta font-semibold', TONE[tone], className)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {word}
    </span>
  );
}
