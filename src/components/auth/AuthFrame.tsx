import Image from 'next/image';
import type { ReactNode } from 'react';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { cx } from '@/components/ui/cx';
import { STEPS } from '@/components/landing/HowItWorks';

const LINE = 'Your price list, open to AI shoppers.';
/** The landing page's How it works steps, without their "1. " (the list numbers them). */
const STEP_COPY = STEPS.map(({ title, body }) => ({ title: title.replace(/^\d+\.\s*/, ''), body }));

export interface AuthFrameProps {
  children: ReactNode;
  /** `wide` for /shops/new, whose sample chips want more room than a login form. */
  width?: 'form' | 'wide';
  /** The step the visitor is on, marked in the panel (1-based). Account screens are before step 1, so none. */
  current?: number;
}

/**
 * The account screens' frame (login, sign-up, recovery, the recovery key, Add your shop): a blush ground with the form
 * on a white card. From lg a warm photo panel stands beside it (Marigold's bread shelves under a charcoal scrim, the
 * reversed logo, the brand line and the home page's three steps); below lg a blush band carries the mark and the line.
 * The panel and band are print:hidden, so the recovery key still prints alone.
 */
export function AuthFrame({ children, width = 'form', current }: AuthFrameProps) {
  return (
    <div className="flex flex-1 flex-col bg-blush lg:flex-row">
      <PhoneBand />
      <PhotoPanel current={current} />
      <div className="flex flex-1 justify-center px-gutter pt-5 pb-section sm:pt-8 lg:items-center lg:py-16">
        <div
          className={cx(
            'w-full self-start rounded-2xl bg-surface p-5 shadow-md sm:p-8 lg:self-center lg:p-10 print:p-0 print:shadow-none',
            width === 'wide' ? 'max-w-(--auth-card-wide-w)' : 'max-w-(--auth-card-w)',
          )}
        >
          <noscript>
            <p className="mb-6 type-body">Shelfie needs JavaScript for this page. Turn it on and reload.</p>
          </noscript>
          {children}
        </div>
      </div>
    </div>
  );
}

function PhoneBand() {
  return (
    <div className="border-b border-blush-ring/60 bg-blush-band px-gutter py-4 lg:hidden print:hidden">
      <div className="mx-auto flex max-w-(--auth-card-wide-w) items-center gap-3">
        <LogoMark className="size-8" />
        <p className="text-base font-semibold text-ink">{LINE}</p>
      </div>
    </div>
  );
}

function PhotoPanel({ current }: { current?: number }) {
  return (
    <aside
      aria-label="About Shelfie"
      className="relative isolate hidden w-(--auth-panel-w) shrink-0 overflow-hidden bg-charcoal text-on-dark lg:flex print:hidden"
    >
      {/* Eager: from lg it is the page's largest paint. Below lg the panel is hidden and `sizes` asks for the smallest copy. */}
      <Image
        src="/demo/marigold-bakehouse/cover.jpg"
        alt=""
        fill
        loading="eager"
        sizes="(min-width: 1024px) 42vw, 1px"
        className="-z-20 object-cover object-[30%_50%]"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-(image:--auth-scrim)" />
      <div className="flex w-full flex-col justify-between gap-12 px-10 py-12 xl:px-14 xl:py-14">
        <Logo size="lg" className="self-start text-on-dark" label="Shelfie" />
        <div className="flex flex-col gap-8">
          <p className="type-band-closing text-balance">{LINE}</p>
          <ol className="flex flex-col gap-5">
            {STEP_COPY.map(({ title, body }, i) => (
              <li key={title} aria-current={current === i + 1 ? 'step' : undefined} className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                    current === i + 1 ? 'bg-accent text-on-dark' : 'bg-on-dark text-charcoal',
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-lg font-bold text-on-dark">{title}</span>
                  <span className="text-base text-on-dark-soft">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </aside>
  );
}
