import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';

const STEPS = ['Read', 'Check', 'Publish'] as const;
export type SetupStepNumber = 1 | 2 | 3;

/** "Step 2 of 3" in words and dots, then the page title and its lead line. */
export function StepHeader({
  step,
  title,
  lead,
  aside,
}: {
  step: SetupStepNumber;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <ol aria-label={`Setup, step ${step} of ${STEPS.length}`} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {STEPS.map((label, i) => {
          const n = (i + 1) as SetupStepNumber;
          const done = n < step;
          const current = n === step;
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className={cx('flex items-center gap-1.5 type-meta', current ? 'font-semibold text-ink' : 'text-ink-muted')}
            >
              <span
                className={cx(
                  'inline-flex size-6 items-center justify-center rounded-full border type-price',
                  done && 'border-ok bg-ok-soft text-ok',
                  current && 'border-ink bg-ink text-surface',
                  !done && !current && 'border-control',
                )}
              >
                {done ? <Icon icon={Check} size="sm" label="Done" /> : n}
              </span>
              {label}
              {i < STEPS.length - 1 && <span aria-hidden="true" className="ml-1.5 h-px w-5 bg-line-strong" />}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-measure flex-col gap-2">
          <h1 className="type-display">{title}</h1>
          {lead && <p className="type-lead text-ink-soft">{lead}</p>}
        </div>
        {aside}
      </div>
    </header>
  );
}
