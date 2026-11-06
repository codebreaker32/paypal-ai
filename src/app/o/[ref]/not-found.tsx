import { ArrowLeft, SearchX } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export default function OrderNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col *:max-w-measure items-start gap-4 px-gutter pt-8 pb-section lg:pt-12">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-sunken text-ink-soft">
        <Icon icon={SearchX} size="lg" />
      </span>
      <h1 className="type-display">We couldn’t find that order</h1>
      <p className="type-lead text-ink-soft">
        Check the link, or go back to the shop you ordered from.
      </p>
      {/* Same button row as every other receipt state: full width on a phone. */}
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <ButtonLink href="/" variant="primary" icon={ArrowLeft}>
          Go to Shelfie
        </ButtonLink>
      </div>
    </div>
  );
}
